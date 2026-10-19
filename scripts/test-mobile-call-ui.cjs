const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {Server}=require('socket.io'),{chromium,webkit,devices}=require('playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'flutter_frontend/build/web');
const trace=[],errors=[],globals={};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');const user=(req.headers.authorization||'test-b').split('test-').at(-1);const peer=user==='a'?'b':'a';
 if(u.pathname.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(u.pathname==='/api/call/ice-config')return res.end(JSON.stringify({success:true,data:{iceServers:[],relayConfigured:false}}));
  if(u.pathname==='/api/call/status')return res.end(JSON.stringify({isAccepted:globals.activeCalls?.get(u.searchParams.get('callerId'))?.isAccepted===true}));
  const conv={id:'room',name:'User '+peer,targetUserId:peer,theme:'classic',members:[{id:user,fullName:'User '+user},{id:peer,fullName:'User '+peer}]};
  return res.end(JSON.stringify({success:true,data:u.pathname.includes('conversations')?[conv]:[]}));
 }
 if(u.pathname==='/'||u.pathname==='/index.html'){
  res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app_fonts.css"><audio id="remoteAudioPlayer" autoplay playsinline></audio><script src="/webrtc_audio_helper.js"></script><script src="/flutter_bootstrap.js" async></script>');
 }
 let file=u.pathname==='/main.dart.js'?path.join(root,'scratch/mobile-call-app.js'):path.join(web,u.pathname);
 if(u.pathname==='/webrtc_audio_helper.js')file=path.join(root,'flutter_frontend/web/webrtc_audio_helper.js');
 if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
const io=new Server(server,{cors:{origin:true}});
const prisma={conversationMembers:{findMany:async()=>[{conversationId:'room'}]},friendRequests:{findMany:async()=>[]},block:{findFirst:async()=>null},users:{findUnique:async()=>null},messages:{create:async({data})=>data}};
const sandbox={module:{exports:{}},global:globals,process:{env:{}},console:{log(...v){if(/call|WebRTC/.test(v.join(' ')))trace.push(v.join(' '));},warn(){},error(...v){errors.push(v.join(' '));}},setTimeout,clearTimeout,require(n){if(n==='../prisma')return prisma;if(n==='uuid')return {v4:()=> 'test-id'};if(n==='jsonwebtoken')return {verify:token=>({id:token.replace('test-','')})};if(n==='../controllers/chat.controller')return {sendPushNotification:async()=>{},clearConversationMessagesCache(){}};if(n==='../services/call-disconnect-grace')return require('../services/call-disconnect-grace');throw Error(n);}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sockets/socketHandler.js'),'utf8'),sandbox);sandbox.module.exports(io);
io.on('connection',socket=>socket.onAny((event,data)=>{if(/call|webrtc/.test(event))trace.push(JSON.stringify({user:socket.userId,event,type:data?.signal?.type}));}));
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.2',r));
  browser=process.env.TEST_WEBKIT ? await webkit.launch({headless:true}) : await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});

  for (const video of [false,true]) {
    const pages=[],contexts=[];
    for(const user of ['a','b']){
      const context=await browser.newContext({...(process.env.TEST_WEBKIT ? devices['iPhone 13'] : {}),viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});contexts.push(context); if(process.env.TEST_WEBKIT) await context.grantPermissions(['microphone','camera']);
      await context.addInitScript(({delay})=>{
        window.testPeers=[];
        const NativePeer=window.RTCPeerConnection;
        if (!NativePeer) throw Error('This browser build has no WebRTC support; it cannot validate calls.');
        window.RTCPeerConnection=new Proxy(NativePeer,{construct(Target,args){const pc=new Target(...args);window.testPeers.push(pc);return pc;}});
        const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia=async constraints=>{
          const stream=await gum(constraints);
          if(constraints.audio && window._callAudioCtx){
            const ctx=window._callAudioCtx,osc=ctx.createOscillator(),out=ctx.createMediaStreamDestination();
            osc.frequency.value=440;osc.connect(out);osc.start();
            window.testOscillator=osc;
            for(const track of stream.getAudioTracks()){stream.removeTrack(track);track.stop();}
            for(const track of out.stream.getAudioTracks())stream.addTrack(track);
          }
          if(delay)await new Promise(r=>setTimeout(r,600));
          return stream;
        };
      },{delay:user==='b'});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(user+': '+e.stack));
      await page.goto('http://127.0.0.2:'+server.address().port+'/?user='+user);
      await page.getByRole('button',{name:'Gọi thoại',exact:true}).waitFor({timeout:30000});pages.push(page);
    }
    await pages[0].getByRole('button',{name:video?'Gọi Video':'Gọi thoại',exact:true}).click();
    await pages[1].getByRole('button',{name:'Trả lời',exact:true}).waitFor({timeout:30000});
    await pages[1].screenshot({path:path.join(root,'scratch/mobile-before-answer-'+(video?'video':'voice')+'.png')});
    await pages[1].getByRole('button',{name:'Trả lời',exact:true}).click();
    // Mobile viewport changes while the OS permission request is resolving.
    await pages[1].setViewportSize({width:390,height:650});
    await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).waitFor({timeout:30000});
    for(const page of pages)await page.waitForFunction(()=>window.testPeers.some(pc=>pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed'),{},{timeout:30000});
    io.to('b').emit('call_ended',{callerId:'a',targetId:'b',conversationId:'room',callId:'previous-call'});
    await pages[1].waitForTimeout(300);
    assert(await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).isVisible(),'Stale end event closed the mobile call');
    const audio=[];
    for(const page of pages){
      await page.waitForFunction(async()=>{for(const pc of window.testPeers){for(const r of(await pc.getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='audio'&&r.totalAudioEnergy>0)return true;}return false;},{},{timeout:30000});
      audio.push(await page.evaluate(async()=>{const el=document.getElementById('remoteAudioPlayer');let received=0,energy=0;for(const pc of window.testPeers)for(const r of(await pc.getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='audio'){received+=r.packetsReceived||0;energy+=r.totalAudioEnergy||0;}return {received,energy,playing:!el.paused,hasStream:!!el.srcObject};}));
    }
    await pages[1].setViewportSize({width:390,height:844});
    await pages[1].screenshot({path:path.join(root,'scratch/mobile-after-answer-'+(video?'video':'voice')+'.png')});
    assert(audio.every(a=>a.energy>0&&a.playing&&a.hasStream));
    await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).click();
    await pages[0].getByRole('button',{name:'Gọi thoại',exact:true}).waitFor({timeout:30000});
    assert.equal(globals.activeCalls.size,0);
    console.log('Mobile '+(video?'video':'voice')+' UI: permission resize, answer, stale-end protection, two-way audio and hangup passed',JSON.stringify(audio));
    for(const context of contexts)await context.close();
  }
  assert.equal(errors.length,0,errors.join('\n'));

 }catch(e){if(browser)for(const ctx of browser.contexts())for(const p of ctx.pages()){console.error('PAGE:',await p.locator('body').innerText()); await p.screenshot({path:path.join(root,'scratch/mobile-failed-'+browser.contexts().indexOf(ctx)+'.png')});} console.error('Mobile UI test failed:',e.message);console.error('Trace:',trace);console.error('Errors:',errors.slice(-12));process.exitCode=1;}
 finally{if(browser)await browser.close();await new Promise(r=>io.close(r));server.close();}
})();


