// Compile fixtures/call_transport.dart first; NODE_PATH may point to a Playwright installation.
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=path.resolve(process.argv[2]||path.join(root,'scratch/call-transport.js'));
const helper=fs.readFileSync(path.join(root,'flutter_frontend/web/webrtc_audio_helper.js'));
const compiled=fs.readFileSync(fixture);
const server=http.createServer((req,res)=>{
 if(req.url==='/helper.js'){res.setHeader('Content-Type','text/javascript');return res.end(helper);}
 if(req.url==='/transport.js'){res.setHeader('Content-Type','text/javascript');return res.end(compiled);}
 res.setHeader('Content-Type','text/html');
 res.end('<!doctype html><body><audio id="remoteAudioPlayer" autoplay playsinline></audio><button id="start">Start</button><script src="/helper.js"></script><script>window.createTestToneStream=()=>{const c=window._callAudioCtx;const o=c.createOscillator();o.frequency.value=440;const d=c.createMediaStreamDestination();o.connect(d);o.start();return d.stream;};window.measureTestStream=async(stream)=>{const c=window._callAudioCtx,a=c.createAnalyser(),src=c.createMediaStreamSource(stream);src.connect(a);await new Promise(r=>setTimeout(r,300));const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);src.disconnect();return Math.sqrt(data.reduce((n,v)=>n+v*v,0)/data.length);};document.getElementById("start").onclick=()=>{window.unlockAudio();const s=document.createElement("script");s.src="/transport.js";document.body.appendChild(s);};</script>');
});
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  for (const video of [false,true]) {
  const page=await browser.newPage();
  page.on('console',message=>{if(message.type()==='warning')console.log('Browser warning:',message.text());});
  page.on('pageerror',error=>console.error('Browser error:',error.stack));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?video='+video);
  await page.locator('#start').click();
  try { await page.waitForFunction(()=>window.callTransportTestResult,{},{timeout:20000}); } catch(error) { console.error('Last phase:',await page.evaluate(()=>window.callTransportTestPhase)); throw error; }
  const result=await page.evaluate(()=>window.callTransportTestResult);
  assert(!result.error,JSON.stringify(result));
  for(const name of ['a','b']){assert(result[name].sent>0,name+' did not send audio');assert(result[name].received>0,name+' did not receive audio');assert(result[name+'Rms']>0.01,name+' received only silence: '+JSON.stringify(result));}
  assert.equal(result.sinkHasStream,true);assert.equal(result.sinkPaused,false);
  assert.equal(result.aAudioTracks,1);assert.equal(result.bAudioTracks,1);assert.equal(result.aVideoTracks,video?1:0);assert.equal(result.bVideoTracks,video?1:0);assert.equal(result.audioMuted,false);
  console.log('Compiled Dart '+(video?'video':'voice')+' call, two-way audio:',JSON.stringify(result));
  await page.close();
  }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
