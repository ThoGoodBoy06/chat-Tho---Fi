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
let holdUpgradeOffers=false, heldUpgradeOffers=[], releaseHeldOffers;
const originalTo=io.to.bind(io);
io.to=room=>{
 const operator=originalTo(room),emit=operator.emit.bind(operator);
 operator.emit=(event,data)=>{
  if(holdUpgradeOffers&&event==='webrtc_signal'&&data?.signal?.type==='offer'&&data.signal.video===true){
   heldUpgradeOffers.push(()=>emit(event,data));
   if(heldUpgradeOffers.length===2){holdUpgradeOffers=false;for(const deliver of heldUpgradeOffers.splice(0))deliver();releaseHeldOffers?.();}
   return operator;
  }
  return emit(event,data);
 };
 return operator;
};
const prisma={conversationMembers:{findMany:async()=>[{conversationId:'room'}]},friendRequests:{findMany:async()=>[]},block:{findFirst:async()=>null},users:{findUnique:async()=>null},messages:{create:async({data})=>data}};
const sandbox={module:{exports:{}},global:globals,process:{env:{}},console:{log(...v){if(/call|WebRTC/.test(v.join(' ')))trace.push(v.join(' '));},warn(){},error(...v){errors.push(v.join(' '));}},setTimeout,clearTimeout,require(n){if(n==='../prisma')return prisma;if(n==='uuid')return {v4:()=> 'test-id'};if(n==='jsonwebtoken')return {verify:token=>({id:token.replace('test-','')})};if(n==='../controllers/chat.controller')return {sendPushNotification:async()=>{},clearConversationMessagesCache(){}};if(n==='../services/call-disconnect-grace')return require('../services/call-disconnect-grace');throw Error(n);}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sockets/socketHandler.js'),'utf8'),sandbox);sandbox.module.exports(io);
io.on('connection',socket=>socket.onAny((event,data)=>{if(/call|webrtc/.test(event))trace.push(JSON.stringify({user:socket.userId,event,type:data?.signal?.type}));}));
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.2',r));
  browser=process.env.TEST_WEBKIT ? await webkit.launch({headless:true}) : await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});

  for (const scenario of process.env.CALL_SCENARIO ? [process.env.CALL_SCENARIO] : ['voice','video','cold','failure']) {
    const video=scenario==='video',fail=scenario==='failure';
    const pages=[],contexts=[];
    for(const user of ['a','b']){
      const context=await browser.newContext({...(process.env.TEST_WEBKIT ? devices['iPhone 13'] : {}),viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});contexts.push(context); if(process.env.TEST_WEBKIT) await context.grantPermissions(['microphone','camera']);
      await context.addInitScript(({delay,fail})=>{
        window.testPeers=[];
        const NativePeer=window.RTCPeerConnection;
        if (!NativePeer) throw Error('This browser build has no WebRTC support; it cannot validate calls.');
        window.RTCPeerConnection=new Proxy(NativePeer,{construct(Target,args){if(fail)throw Error('NotReadableError: interrupted mobile device');const pc=new Target(...args);window.testPeers.push(pc);return pc;}});
        const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia=async constraints=>{
          if(window.testDenyCamera && constraints.video && !constraints.audio) throw new DOMException('Camera permission denied','NotAllowedError');
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
      },{delay:user==='b',fail:fail&&user==='b'});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(user+': '+e.stack));
      await page.goto('http://127.0.0.2:'+server.address().port+'/?user='+user);
      await page.getByRole('button',{name:'Gọi thoại',exact:true}).waitFor({timeout:30000});pages.push(page);
    }
    if(scenario==='cold'){
      const socket=[...io.sockets.sockets.values()].find(s=>s.userId==='b');
      const disconnected=new Promise(resolve=>socket.once('disconnect',resolve));
      await pages[1].close();await disconnected;
    }
    await pages[0].getByRole('button',{name:video?'Gọi Video':'Gọi thoại',exact:true}).click();
    if(scenario==='cold'){
      pages[1]=await contexts[1].newPage();pages[1].on('pageerror',e=>errors.push('cold: '+e.stack));
      await pages[1].goto('http://127.0.0.2:'+server.address().port+'/?user=b&action=incoming_call&conversationId=room');
    }
    await pages[1].getByRole('button',{name:'Trả lời',exact:true}).waitFor({timeout:30000});
    await pages[1].screenshot({path:path.join(root,'scratch/mobile-before-answer-'+(video?'video':'voice')+'.png')});
    await pages[1].getByRole('button',{name:'Trả lời',exact:true}).click();
    // Mobile viewport changes while the OS permission request is resolving.
    await pages[1].setViewportSize({width:390,height:650});
    if(fail){
      for(const page of pages)await page.getByRole('button',{name:'Đóng',exact:true}).waitFor({timeout:10000});
      assert(await pages[1].getByText('Không thể kết nối',{exact:true}).isVisible());
      assert.equal(globals.activeCalls.size,0);
      for(const context of contexts)await context.close();
      console.log('Mobile initialization failure: visible error, retained call screen, released server session passed');
      continue;
    }
    await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).waitFor({timeout:30000});
    for(const page of pages)await page.waitForFunction(()=>window.testPeers.some(pc=>pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed'),{},{timeout:30000});
    await pages[1].getByText(/^00:\d{2}$/).waitFor({timeout:10000});
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
    if(!video){
      const micBefore=await pages[1].evaluate(()=>window.testPeers.at(-1).getSenders().find(s=>s.track?.kind==='audio').track.id);
      await pages[1].evaluate(()=>{window.testDenyCamera=true;});
      await pages[1].getByRole('button',{name:'Bật video',exact:true}).click();
      await pages[1].getByText(/Chưa được phép dùng micro\/camera/).waitFor();
      assert(await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).isVisible());
      await pages[1].evaluate(()=>{window.testDenyCamera=false;});
      await pages[1].getByRole('button',{name:'Bật video',exact:true}).click();
      await pages[0].waitForFunction(()=>{const v=document.getElementById('remoteVideoPlayer');return v?.videoWidth>0&&v.readyState>=2;});
      assert.equal(await pages[0].evaluate(()=>window.testPeers.at(-1).getSenders().filter(s=>s.track?.kind==='video').length),0,'Receiving video must not start the other camera');
      await pages[0].getByRole('button',{name:'Bật video',exact:true}).click();
      assert.equal(await pages[1].evaluate(()=>window.testPeers.at(-1).getSenders().find(s=>s.track?.kind==='audio').track.id),micBefore,'Upgrade replaced the live microphone');
    }
    for(const page of pages) {
      await page.waitForFunction(async()=>{for(const r of(await window.testPeers.at(-1).getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='video'&&r.framesDecoded>0)return true;return false;},{},{timeout:15000});
      await page.waitForFunction(()=>{const v=document.getElementById('remoteVideoPlayer');return v?.videoWidth>0&&v.readyState>=2;},{},{timeout:10000});
    }
    for(const [i,page] of pages.entries())await page.waitForFunction(async previous=>{
      for(const r of(await window.testPeers.at(-1).getStats()).values())
        if(r.type==='inbound-rtp'&&r.kind==='audio'&&r.packetsReceived>previous+5&&r.totalAudioEnergy>0)return true;
      return false;
    },audio[i].received,{timeout:10000});
    await pages[1].getByRole('button',{name:'Tắt micro',exact:true}).click();
    await pages[1].waitForFunction(()=>window.testPeers.some(pc=>pc.getSenders().some(s=>s.track?.kind==='audio'&&!s.track.enabled)));
    await pages[1].getByRole('button',{name:'Bật micro',exact:true}).click();
    const oldMic=await pages[1].evaluate(()=>window.testPeers[0].getSenders().find(s=>s.track?.kind==='audio').track.id);
    await pages[1].evaluate(()=>window.testPeers[0].getSenders().find(s=>s.track?.kind==='audio').track.dispatchEvent(new Event('mute')));
    await pages[1].getByRole('button',{name:'Thử lại âm thanh',exact:true}).click();
    await pages[1].waitForFunction(old=>window.testPeers[0].getSenders().some(s=>s.track?.kind==='audio'&&s.track.id!==old),oldMic);
    await pages[1].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).click();
    await pages[0].getByRole('button',{name:'Đóng',exact:true}).waitFor({timeout:30000});
    assert(await pages[0].getByText('Cuộc gọi đã kết thúc',{exact:true}).isVisible());
    await pages[0].getByRole('button',{name:'Đóng',exact:true}).click();
    await pages[0].getByRole('button',{name:'Gọi thoại',exact:true}).waitFor({timeout:30000});
    assert.equal(globals.activeCalls.size,0);
    // Reuse the same mounted ChatScreen: a fresh page hides stale call guards.
    for(const [caller,callee,withVideo] of [[0,1,true],[1,0,false]]) {
      const peerCounts=await Promise.all(pages.map(page=>page.evaluate(()=>window.testPeers.length)));
      await pages[caller].getByRole('button',{name:withVideo?'Gọi Video':'Gọi thoại',exact:true}).click();
      await pages[callee].getByRole('button',{name:'Trả lời',exact:true}).waitFor({timeout:10000});
      await pages[callee].getByRole('button',{name:'Trả lời',exact:true}).click();
      for(const [i,page] of pages.entries())await page.waitForFunction(count=>window.testPeers.length>count&&['connected','completed'].includes(window.testPeers.at(-1)?.iceConnectionState),peerCounts[i],{timeout:15000});
      for(const page of pages)await page.getByText('Đang đàm thoại',{exact:true}).waitFor();
      if(withVideo)for(const page of pages)await page.waitForFunction(async()=>{for(const r of(await window.testPeers.at(-1).getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='video'&&r.framesDecoded>0)return true;return false;});
      if(!withVideo){
        holdUpgradeOffers=true;
        const delivered=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Both mobile camera offers did not arrive')),10000);releaseHeldOffers=()=>{clearTimeout(timer);resolve();};});
        await Promise.all(pages.map(page=>page.getByRole('button',{name:'Bật video',exact:true}).click()));
        await delivered;
        for(const page of pages)await page.waitForFunction(async()=>{for(const r of(await window.testPeers.at(-1).getStats()).values())if(r.type==='inbound-rtp'&&r.kind==='video'&&r.framesDecoded>0)return true;return false;},{},{timeout:15000});
        assert.equal(heldUpgradeOffers.length,0,'Simultaneous camera offers were not delivered');
      }
      await pages[caller].getByRole('button',{name:'Kết thúc cuộc gọi',exact:true}).click();
      await pages[callee].getByRole('button',{name:'Đóng',exact:true}).click();
      for(const page of pages)await page.getByRole('button',{name:'Gọi thoại',exact:true}).waitFor();
      assert.equal(globals.activeCalls.size,0);
    }
    console.log('Mobile '+scenario+' UI: answer, two-way audio/video frames, camera denial/upgrade, repeated calls both directions and simultaneous upgrade passed',JSON.stringify(audio));
    for(const context of contexts)await context.close();
  }
  assert.equal(errors.length,0,errors.join('\n'));

 }catch(e){if(browser)for(const ctx of browser.contexts())for(const p of ctx.pages()){console.error('PAGE:',await p.locator('body').innerText()); await p.screenshot({path:path.join(root,'scratch/mobile-failed-'+browser.contexts().indexOf(ctx)+'.png')});} console.error('Mobile UI test failed:',e.message);console.error('Trace:',trace);console.error('Errors:',errors.slice(-12));process.exitCode=1;}
 finally{if(browser)await browser.close();await new Promise(r=>io.close(r));server.close();}
})();


