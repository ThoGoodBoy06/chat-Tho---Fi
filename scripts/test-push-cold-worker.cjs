// Real worker lifecycle test: no application window, no Firebase SDK network,
// stop the worker, deliver an FCM envelope and inspect its OS notification.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../flutter_frontend/web/firebase-messaging-sw.js'));
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url.startsWith('/firebase-messaging-sw.js')) {res.setHeader('Content-Type','text/javascript');return res.end(source);}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Push lifecycle test</title>');
});
(async()=>{
  let browser;
  try {
    await new Promise(r=>server.listen(0,'127.0.0.2',r));
    const origin='http://127.0.0.2:'+server.address().port;
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const context=await browser.newContext({permissions:['notifications']});
    // The observer stays on about:blank; it is not an app window/client.
    const observer=await context.newPage(),cdp=await context.newCDPSession(observer);
    let registrationId;
    cdp.on('ServiceWorker.workerRegistrationUpdated',({registrations})=>{
      for(const reg of registrations)if(reg.scopeURL.startsWith(origin))registrationId=reg.registrationId;
    });
    await cdp.send('ServiceWorker.enable');
    let app=await context.newPage();await app.goto(origin);
    await app.evaluate(async()=>{
      const r=await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=push-5',{scope:'/firebase-cloud-messaging-push-scope'});
      if(!r.active)await new Promise(resolve=>{const w=r.installing||r.waiting;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();});});
    });
    assert(registrationId,'Browser did not expose push registration');
    await app.close();
    for(const type of ['chat_message','incoming_call']) {
      await cdp.send('ServiceWorker.stopAllWorkers');
      // FCM's HTTP v1 envelope at the Push API boundary, including data-only calls.
      const data={type,callId:'cold-call',conversationId:'cold-room',title:type,body:'Closed app delivery'};
      const payload=type==='chat_message'?{notification:{title:type,body:data.body},data}:{data};
      await cdp.send('ServiceWorker.deliverPushMessage',{origin,registrationId,data:JSON.stringify(payload)});
      app=await context.newPage();await app.goto(origin);
      await app.waitForFunction(async()=>{
        const r=await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
        return r&&(await r.getNotifications()).length>0;
      });
      const notices=await app.evaluate(async()=>{
        const r=await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
        const n=await r.getNotifications();const result=n.map(v=>({title:v.title,data:v.data,tag:v.tag}));
        n.forEach(v=>v.close());return result;
      });
      assert.equal(notices.length,1);assert.equal(notices[0].title,type);assert.equal(notices[0].data.type,type);
      await app.close();
      console.log('Cold native worker, no open app: '+type+' displayed once');
    }
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
