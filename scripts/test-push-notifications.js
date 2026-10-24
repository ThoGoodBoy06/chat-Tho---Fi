const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'flutter_frontend/web/web_notifications.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'flutter_frontend/web/index.html'), 'utf8');
function client(permission = 'granted', installed = true) {
  const calls = [], notices = [], alerts = [], events = [], listeners = {};
  const storage = new Map([['flutter.authToken', '"test-auth"']]);
  let prompts = 0, onMessage;
  const registration = {active: {}, pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'https://push.test/subscription',keys:{p256dh:'public',auth:'auth'}})})}, showNotification: async (...args) => notices.push(args)};
  const messaging = {deleteToken:async()=>{calls.push('deleteToken');},getToken: async options => {calls.push(options); return 'test-fcm';}, onMessage: fn => {onMessage = fn;}};
  const context = {console, setTimeout, clearTimeout, location: {hostname: 'chat-tho-fi.pages.dev'},
    navigator: {serviceWorker: {register: async (...args) => {calls.push(args); return registration;},addEventListener:(name,fn)=>{listeners[name]=fn;}}},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    Notification: {permission, requestPermission: async () => {prompts++; context.Notification.permission = 'granted'; return 'granted';}},
    firebase: {apps: [{}], messaging: () => messaging}, isSecureContext: true,
    fetch: async (url, options) => {calls.push({url, ...options}); return {ok: true, json: async () => ({success: true})};},
    document: {getElementById: () => null}, alert: value => alerts.push(value),
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:event=>events.push(event)};
  if (installed) context.PushManager = function () {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(clientSource, context);
  context.updateNotificationModalState = () => {};
  const start = html.indexOf('    window.handleActivateNotificationClick');
  const end = html.indexOf('    window.handleTestPushClick', start);
  vm.runInContext(html.slice(start, end), context);
  return {context, registration, messaging, calls, notices, alerts, events, listeners, prompts: () => prompts, foreground: payload => onMessage(payload)};
}
test('iOS Home Screen: no automatic permission prompt, tap grants and saves to Render', async () => {
  const c = client('default');
  assert.equal(await c.context.registerFCMAndGetToken(), null);
  assert.equal(c.prompts(), 0);
  await c.context.handleActivateNotificationClick();
  assert.equal(c.prompts(), 1);
  assert.equal(c.context.isWebPushRegistered(), true);
  const request = c.calls.find(call => call.url);
  assert.equal(request.url, 'https://chat-tho-fi-vn-9s8u.onrender.com/api/users/fcm-token');
  assert.equal(JSON.parse(request.body).platform, 'web');
  assert.equal(request.headers.Authorization, 'Bearer test-auth');
});
test('iOS browser without PushManager cannot register until a supported Home Screen context', async () => {
  const c = client('default', false);
  assert.equal(await c.context.registerFCMAndGetToken(undefined, {requestPermission: true}), null);
  assert.equal(c.prompts(), 0);
});
test('Android granted permission still requires successful server registration', async () => {
  const c = client();
  c.context.fetch = async () => ({ok: false, json: async () => ({success: false, message: 'Token save failed'})});
  await c.context.handleActivateNotificationClick();
  assert.equal(c.context.isWebPushRegistered(), false);
  assert.match(c.alerts.at(-1), /Token save failed/);
  assert.equal(c.prompts(), 0);
});
test('HTML returned by a static host is never treated as registration success', async () => {
  const c = client();
  c.context.fetch = async () => ({ok: true, json: async () => {throw Error('HTML');}});
  await c.context.handleActivateNotificationClick();
  assert.equal(c.context.isWebPushRegistered(), false);
  assert.ok(!c.alerts.some(value => value.includes('thành công')));
});
test('foreground web messages show one notification and repeat messages renotify', async () => {
  const c = client();
  await c.context.registerFCMAndGetToken();
  await c.context.registerFCMAndGetToken();
  c.foreground({data: {conversationId: 'room', title: 'Sender', body: 'Hello'}});
  assert.equal(c.notices.length, 1);
  assert.equal(c.notices[0][1].renotify, true);
});
test('cold worker displays every push without Firebase imports or an open app', async () => {
  const listeners = {}, shown = [], order = [];
  const context = {URL,console, clients: {matchAll: async () => [], openWindow: async url => {shown.push(url);}},
    importScripts: () => {throw Error('Cold worker must not require a network SDK');},
    location: {origin: 'https://chat-tho-fi.pages.dev'},
    registration: {showNotification: async (...args) => shown.push(args), getNotifications: async () => []},
    addEventListener: (name, fn) => {listeners[name] = fn; order.push(name);}, skipWaiting: () => {}};
  context.self = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'flutter_frontend/web/firebase-messaging-sw.js'), 'utf8'), context);
  assert.equal(typeof listeners.push, 'function');
  async function background(payload) {
    let lifetime;
    listeners.push({data:{json:()=>payload},waitUntil:p=>{lifetime=p;}});
    assert(lifetime,'Push lifetime must be registered synchronously');
    await lifetime;
  }
  await background({data: {title: 'Sender', body: 'Hello', conversationId: 'room'}});
  assert.equal(shown.length, 1);
  await background({notification: {title: 'SDK notification'}, data: {conversationId: 'room'}});
  assert.equal(shown.length, 2, 'Native worker owns FCM notification payloads too');
  assert.equal(shown.at(-1)[0], 'SDK notification');
  let pending;
  listeners.notificationclick({notification: {close() {}, data: {FCM_MSG: {data: {conversationId: 'room & 1'}}}},
    stopImmediatePropagation() {}, waitUntil: promise => {pending = promise;}});
  await pending;
  assert.equal(new URL(shown.at(-1),'https://chat-tho-fi.pages.dev').searchParams.get('conversationId'),'room & 1');
  let focused=0,opened;
  context.clients.matchAll=async()=>[{url:'https://chat-tho-fi.pages.dev/',postMessage:data=>{opened=data;},focus:async()=>{focused++;},navigate:()=>{throw Error('Reload interrupted the call');}}];
  listeners.notificationclick({notification:{close(){},data:{type:'incoming_call',callId:'call-1'}},stopImmediatePropagation(){},waitUntil:p=>{pending=p;}});
  await pending;assert.equal(focused,1);assert.equal(opened.type,'PUSH_OPEN');assert.equal(opened.data.callId,'call-1');
  await background({data:{type:'call_ended',callId:'call-1',title:'Cuộc gọi đã kết thúc'}});
  assert.equal(shown.at(-1)[1].tag,'call-call-1');
  assert.equal(shown.at(-1)[1].renotify,false);
  await background({data:{type:'incoming_call',callId:'old',expiresAt:String(Date.now()-1000)}});
  assert.equal(shown.at(-1)[0],'Cuộc gọi nhỡ');
  const count=shown.length;
  let lifetime;
  listeners.push({data:{json(){throw Error('Invalid JSON');}},waitUntil:p=>{lifetime=p;}});
  await lifetime;assert.equal(shown.length,count+1,'Malformed push must still be visible on Safari');
  assert.equal(shown.at(-1)[0],'Tin nhắn mới');
  // A suspended window must not delay the mandatory visible notification.
  context.clients.matchAll=()=>new Promise(()=>{});
  listeners.push({data:{json:()=>({data:{type:'call_ended',callId:'hung'}})},waitUntil(){}});
  assert.equal(shown.at(-1)[1].tag,'call-hung');
});

test('resume refreshes granted subscriptions without prompting and queues cold-start intents',async()=>{
 const c=client();await c.context.refreshPushRegistration();
 assert.equal(c.prompts(),0);assert(c.context.isWebPushRegistered());
 const calls=c.calls.length;await c.context.refreshPushRegistration();assert.equal(c.calls.length,calls);
 c.listeners.message({data:{type:'PUSH_OPEN',data:{type:'incoming_call',callId:'pending'}}});
 assert.equal(JSON.parse(c.context.consumePushIntent()).callId,'pending');assert.equal(c.context.consumePushIntent(),null);
 assert.equal(c.events[0].type,'tho-fi-push');
});

test('explicit repair replaces the subscription; automatic startup preserves it',async()=>{
 const c=client();await c.context.registerFCMAndGetToken();
 assert(!c.calls.includes('deleteToken'));
 await c.context.handleActivateNotificationClick();
 assert.equal(c.calls.filter(x=>x==='deleteToken').length,1);
 assert(c.context.isWebPushRegistered());
 assert(c.calls.indexOf('deleteToken')<c.calls.findLastIndex(x=>x?.serviceWorkerRegistration));
});

test('empty WebKit push subscriptions are never saved as enabled',async()=>{
 const c=client();c.registration.pushManager.getSubscription=async()=>({toJSON:()=>({endpoint:'',keys:{}})});
 await c.context.handleActivateNotificationClick();
 assert(!c.context.isWebPushRegistered());assert(!c.calls.some(x=>x.url));
 assert(c.alerts.at(-1).includes('chưa hoàn tất'));
});

test('manual repair waits for in-flight registration before deleting its token',async()=>{
 const c=client();let release;
 c.messaging.getToken=()=>new Promise(resolve=>{release=resolve;});
 const startup=c.context.registerFCMAndGetToken();
 await new Promise(resolve=>setImmediate(resolve));
 const repair=c.context.registerFCMAndGetToken(undefined,{renewSubscription:true});
 assert(!c.calls.includes('deleteToken'));
 c.messaging.getToken=async()=> 'new-token';release('old-token');
 assert.equal(await startup,'old-token');assert.equal(await repair,'new-token');
 assert.equal(c.calls.filter(x=>x==='deleteToken').length,1);
});

test('resumed background test distinguishes Firebase acceptance from device receipt',async()=>{
 const c=client();const element={textContent:''};c.context.document.getElementById=()=>element;
 c.context.setTimeout=()=>1;
 c.context.postUserPushApi=async()=>({testId:'probe',expiresAt:Date.now()+60000});
 await c.context.startBackgroundPushTest();assert(element.textContent.includes('15 giây'));
 c.context.postUserPushApi=async()=>({phase:'accepted'});
 await c.context.refreshBackgroundPushTest();assert(element.textContent.includes('chưa có xác nhận'));
 c.context.postUserPushApi=async()=>({phase:'worker_received',notificationRequested:true});
 await c.context.refreshBackgroundPushTest();assert(element.textContent.includes('yêu cầu hệ điều hành'));
 c.context.postUserPushApi=async()=>({phase:'worker_received',notificationRequested:false});
 await c.context.refreshBackgroundPushTest();assert(element.textContent.includes('từ chối'));
});
test('registering a phone preserves other phones and keeps native platform identity', async () => {
  const calls = [];
  const prisma = {userDevices: {deleteMany: async value => calls.push(['delete', value]), upsert: async value => calls.push(['upsert', value])},
    users: {updateMany: async value => calls.push(['clearLegacy', value]), update: async () => {}}};
  const {registerPushDevice} = require('../services/push_devices.service');
  await registerPushDevice(prisma, 'user', {fcmToken: 'new', platform: 'ios', deviceId: 'phone-a'}, 'iPhone Mobile');
  const deletions = calls.filter(([name]) => name === 'delete');
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0][1].where.deviceId, 'phone-a');
  assert.equal(calls.find(([name]) => name === 'upsert')[1].create.platform, 'ios');
});

function pushServer(apps = [{}], successCount = 1) {
  const captured = [];
  const context = {exports: {}, console, BASE_HOST_URL: 'https://backend.test', FRONTEND_URL: 'https://chat-tho-fi.pages.dev',
    getApps: () => apps, getMessaging: () => ({sendEachForMulticast: async payload => {
      captured.push(payload); return {successCount, failureCount: 0, responses: []};
    }}),
    prisma: {userDevices: {findMany: async query => {captured.push(query); return [{fcmToken: 'phone-a'}];}},
      users: {findUnique: async () => ({fcmToken: 'phone-b'})}}};
  vm.createContext(context);
  const source = fs.readFileSync(path.join(root, 'controllers/chat.controller.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('exports.sendPushNotification ='), source.indexOf('// 15. Thay đổi chủ đề')), context);
  return {send: context.exports.sendPushNotification, captured};
}
test('test push targets this installation and links to the PWA origin', async () => {
  const server = pushServer();
  const result = await server.send('user-a', 'Test', 'Body', {conversationId: 'room 1'}, false, {deviceId: 'installation-a'});
  assert.equal(result.successCount, 1);
  assert.equal(server.captured[0].where.deviceId, 'installation-a');
  const payload = server.captured[1];
  assert.equal(payload.tokens.length, 1);
  assert.equal(payload.tokens[0], 'phone-a');
  assert.equal(payload.webpush.fcmOptions.link, 'https://chat-tho-fi.pages.dev/?conversationId=room%201');
  assert.equal(payload.webpush.notification.renotify, true);
});
test('incoming calls target all devices, expire promptly and carry the call identity',async()=>{
 const server=pushServer();
 await server.send('user-a','Caller','Call',{type:'incoming_call',callId:'session',conversationId:'room'},true);
 const payload=server.captured.find(x=>x.tokens);
 assert.equal(payload.tokens.length,2);assert.equal(payload.webpush.headers.TTL,'60');
 assert.equal(payload.webpush.notification.tag,'call-session');assert(payload.webpush.fcmOptions.link.includes('callId=session'));
});
test('a cancelled call is not sent after asynchronous token lookup',async()=>{
 const server=pushServer();
 const result=await server.send('user-a','Caller','Call',{type:'incoming_call'},true,{shouldSend:()=>false});
 assert.equal(result.reason,'cancelled');assert(!server.captured.some(x=>x.tokens));
});
test('test endpoint reports failure when Firebase is unconfigured or accepts zero deliveries', async () => {
  for (const server of [pushServer([]), pushServer([{}], 0)]) {
    let handler;
    const context = {console, app: {post: (_, fn) => {handler = fn;}}, jwt: {verify: () => ({id: 'user-a'})},
      process: {env: {}}, require: () => ({sendPushNotification: server.send})};
    vm.createContext(context);
    const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('app.post("/api/users/test-push"'), source.indexOf("require('./services/push_probe.service')")), context);
    let status = 200, body;
    const response = {status: value => {status = value; return response;}, json: value => {body = value;}};
    await handler({headers: {authorization: 'Bearer test-auth'}, body: {deviceId: 'installation-a'}}, response);
    assert.equal(status, 503);
    assert.equal(body.success, false);
  }
});
