// Exercise the actual Flutter SettingsScreen -> shared PWA settings, not just
// calling the HTML functions directly. The signed-in fixture stays in scratch.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'flutter_frontend/build/web');
const html=fs.readFileSync(path.join(root,'flutter_frontend/web/index.html'),'utf8');
const cssStart=html.lastIndexOf('<style>',html.indexOf('#notif-modal-overlay'));
const css=html.slice(cssStart,html.indexOf('</style>',cssStart)+8);
const modalStart=html.indexOf('<div id="notif-modal-overlay">');
const modal=html.slice(modalStart,html.indexOf('</script>',modalStart)+9);
const requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/users/')) {
  let body='';req.on('data',c=>{body+=c;});req.on('end',()=>{
   requests.push({path:url.pathname,body:JSON.parse(body||'{}'),auth:req.headers.authorization});
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,testId:'settings-probe',expiresAt:Date.now()+60000,phase:'accepted'}));
  });return;
 }
 if(url.pathname==='/') {
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+css+modal+'<script src="/web_notifications.js"></script><script src="/flutter_bootstrap.js" async></script>');
 }
 const file=url.pathname==='/main.dart.js'?path.join(root,'scratch/mobile-call-app.js'):
   url.pathname==='/web_notifications.js'?path.join(root,'flutter_frontend/web/web_notifications.js'):path.join(web,url.pathname);
 if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['notifications']});
 await context.addInitScript(()=>{
  window.testRenewals=0;
  const registration={active:{},pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'https://push.test/sub',keys:{p256dh:'public',auth:'auth'}})})},showNotification:async()=>{}};
  Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,addEventListener(){}}});
  const messaging={deleteToken:async()=>{window.testRenewals++;},getToken:async()=> 'settings-test-token',onMessage(){}};
  window.firebase={apps:[{}],messaging:()=>messaging};
 });
 const page=await context.newPage();page.on('dialog',d=>d.accept());page.on('pageerror',e=>console.error('Browser error:',e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?settings=1');
 try {await page.getByText('Thông báo & Âm thanh Tùy chỉnh chuông gọi, âm nhắn & iOS PWA',{exact:true}).click({timeout:30000});}
 catch(error){console.error('Settings UI:',await page.locator('body').innerText());await page.screenshot({path:path.join(root,'scratch/notification-settings-failed.png')});throw error;}
 await page.getByRole('button',{name:'Thử khi khóa màn hình / đóng app (15 giây)',exact:true}).waitFor();
 assert((await page.locator('#notif-activate-btn').boundingBox()).height>=44,'Mobile tap target must not shrink');
 await page.locator('#notif-activate-btn').click();
 await page.waitForFunction(()=>window.isWebPushRegistered());
 await page.getByText('Làm mới đăng ký thông báo',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.testRenewals),1,'Real Settings repair must renew the subscription');
 assert(requests.some(r=>r.path.endsWith('/fcm-token')&&r.body.fcmToken==='settings-test-token'&&r.auth==='Bearer test-b'));
 await page.locator('#notif-background-test-btn').click();
 await page.getByText(/Đã hẹn gửi sau 15 giây/).waitFor();
 assert(requests.some(r=>r.path.endsWith('/test-push-background')&&r.body.deviceId));
 await page.screenshot({path:path.join(root,'scratch/notification-settings-mobile.png')});
 await page.getByRole('button',{name:'✕',exact:true}).click();
 assert.equal(await page.locator('#notif-modal-overlay').evaluate(el=>el.classList.contains('active')),false);
 console.log('Real mobile Flutter Settings: opens shared PWA panel, repairs subscription, saves device and exposes delayed background test.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
