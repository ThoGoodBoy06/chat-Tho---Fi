const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'flutter_frontend/web/web_notifications.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'flutter_frontend/web/index.html'), 'utf8');
function client(permission = 'granted', installed = true) {
  const calls = [], notices = [], alerts = [];
  const storage = new Map([['flutter.authToken', '"test-auth"']]);
  let prompts = 0, onMessage;
  const registration = {active: {}, showNotification: async (...args) => notices.push(args)};
  const messaging = {getToken: async options => {calls.push(options); return 'test-fcm';}, onMessage: fn => {onMessage = fn;}};
  const context = {console, setTimeout, clearTimeout, location: {hostname: 'chat-tho-fi.pages.dev'},
    navigator: {serviceWorker: {register: async (...args) => {calls.push(args); return registration;}}},
    localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    Notification: {permission, requestPermission: async () => {prompts++; context.Notification.permission = 'granted'; return 'granted';}},
    firebase: {apps: [{}], messaging: () => messaging}, isSecureContext: true,
    fetch: async (url, options) => {calls.push({url, ...options}); return {ok: true, json: async () => ({success: true})};},
    document: {getElementById: () => null}, alert: value => alerts.push(value)};
  if (installed) context.PushManager = function () {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(clientSource, context);
  context.updateNotificationModalState = () => {};
  const start = html.indexOf('    window.handleActivateNotificationClick');
  const end = html.indexOf('    window.handleTestPushClick', start);
  vm.runInContext(html.slice(start, end), context);
  return {context, calls, notices, alerts, prompts: () => prompts, foreground: payload => onMessage(payload)};
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
test('worker has a single Firebase push owner and handles data-only messages once', async () => {
  const listeners = {}, shown = [], order = [];
  let background;
  const context = {console, clients: {matchAll: async () => [], openWindow: async url => {shown.push(url);}},
    firebase: {initializeApp: () => {}, messaging: () => ({onBackgroundMessage: fn => {background = fn;}})},
    importScripts: () => order.push('firebase'),
    location: {origin: 'https://chat-tho-fi.pages.dev'},
    registration: {showNotification: async (...args) => shown.push(args), getNotifications: async () => []},
    addEventListener: (name, fn) => {listeners[name] = fn; order.push(name);}, skipWaiting: () => {}};
  context.self = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'flutter_frontend/web/firebase-messaging-sw.js'), 'utf8'), context);
  assert.equal(listeners.push, undefined, 'Do not install a second raw handler beside Firebase');
  assert.ok(order.indexOf('notificationclick') < order.indexOf('firebase'));
  await background({data: {title: 'Sender', body: 'Hello', conversationId: 'room'}});
  assert.equal(shown.length, 1);
  await background({notification: {title: 'SDK notification'}, data: {conversationId: 'room'}});
  assert.equal(shown.length, 1, 'Firebase owns notification payload rendering');
  let pending;
  listeners.notificationclick({notification: {close() {}, data: {FCM_MSG: {data: {conversationId: 'room & 1'}}}},
    stopImmediatePropagation() {}, waitUntil: promise => {pending = promise;}});
  await pending;
  assert.equal(shown.at(-1), '/?conversationId=room%20%26%201');
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
test('test endpoint reports failure when Firebase is unconfigured or accepts zero deliveries', async () => {
  for (const server of [pushServer([]), pushServer([{}], 0)]) {
    let handler;
    const context = {console, app: {post: (_, fn) => {handler = fn;}}, jwt: {verify: () => ({id: 'user-a'})},
      process: {env: {}}, require: () => ({sendPushNotification: server.send})};
    vm.createContext(context);
    const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    vm.runInContext(source.slice(source.indexOf('app.post("/api/users/test-push"'), source.indexOf('// Middleware xử lý lỗi chung')), context);
    let status = 200, body;
    const response = {status: value => {status = value; return response;}, json: value => {body = value;}};
    await handler({headers: {authorization: 'Bearer test-auth'}, body: {deviceId: 'installation-a'}}, response);
    assert.equal(status, 503);
    assert.equal(body.success, false);
  }
});
