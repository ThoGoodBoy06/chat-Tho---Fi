'use strict';
const SW_VERSION = 'push-5';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  const raw = event.notification.data || {};
  const data = raw.FCM_MSG?.data || raw;
  const kind = String(data.type || '').toLowerCase();
  const target = new URL('/', self.location.origin);
  if (data.conversationId) target.searchParams.set('conversationId', data.conversationId);
  if (kind === 'incoming_call') {
    target.searchParams.set('action', 'incoming_call');
    if (data.callId) target.searchParams.set('callId', data.callId);
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (client) {
      // Reloading an existing PWA would interrupt its live call.
      client.postMessage({type:'PUSH_OPEN',data});
      return client.focus();
    }
    return self.clients.openWindow(target.pathname + target.search);
  })());
});
// One native Push API owner. FCM still transports the encrypted payload, but a
// cold iOS worker must not fetch/initialize external SDKs before showing it.
// Keep this worker URL/scope so existing FCM subscriptions continue to work.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch (_) {}
  const data = payload.data || {};
  const notice = payload.notification || {};
  const kind = String(data.type || '').toLowerCase();
  const isCall = kind === 'incoming_call', ended = kind === 'call_ended';
  // Start display immediately, even with a suspended/hung page or no windows.
  // Every push, including call-end and malformed data, must remain user-visible.
  const expired = isCall && Number(data.expiresAt)>0 && Number(data.expiresAt)<Date.now();
  const title = expired ? 'Cuộc gọi nhỡ' : notice.title || data.title || (isCall ? (data.callerName || 'Người dùng')+' đang gọi cho bạn' : ended ? 'Cuộc gọi đã kết thúc' : 'Tin nhắn mới');
  const display = self.registration.showNotification(title, {
    body:notice.body || data.body || (isCall ? 'Mở app để nhận cuộc gọi' : 'Mở app để xem'),
    icon:data.callerAvatar || data.avatar || notice.icon || '/icon.png',badge:'/icon.png',data,
    tag:isCall || ended ? 'call-'+(data.callId || data.conversationId || 'incoming') : data.conversationId ? 'conv-'+data.conversationId : 'tho-fi-message',
    renotify:!ended && !expired,requireInteraction:isCall && !expired,
    vibrate:isCall ? [500,250,500] : [200,100,200]
  });
  const update = ended && data.callId ? self.clients.matchAll({type:'window',includeUncontrolled:true})
    .then(windows => {for (const client of windows) client.postMessage({type:'PUSH_CALL_ENDED',data});})
    .catch(() => {}) : Promise.resolve();
  // Register the lifetime synchronously; no page, socket or network dependency.
  event.waitUntil(Promise.all([display, update]));
});
