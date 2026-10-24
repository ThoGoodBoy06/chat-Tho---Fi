'use strict';
const SW_VERSION = 'push-4';
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
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey:'AIzaSyDk6fayVDs0YbbhwldYxgHcN4nnjnPwmRc',
  authDomain:'chat-tho-fi.firebaseapp.com',projectId:'chat-tho-fi',
  storageBucket:'chat-tho-fi.firebasestorage.app',messagingSenderId:'513501588929',
  appId:'1:513501588929:web:54fd6c5fab227868bfd340'
});
firebase.messaging().onBackgroundMessage(async payload => {
  const data = payload.data || {};
  const kind = String(data.type || '').toLowerCase();
  const isCall = kind === 'incoming_call', ended = kind === 'call_ended';
  if (ended && data.callId) {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) client.postMessage({type:'PUSH_CALL_ENDED',data});
  }
  if (payload.notification) return; // Firebase already displayed it.
  // Web pushes must remain visible, including call-end updates, on Safari.
  const expired = isCall && Number(data.expiresAt)>0 && Number(data.expiresAt)<Date.now();
  const title = expired ? 'Cuộc gọi nhỡ' : data.title || (isCall ? (data.callerName || 'Người dùng')+' đang gọi cho bạn' : ended ? 'Cuộc gọi đã kết thúc' : 'Tin nhắn mới');
  return self.registration.showNotification(title, {
    body:data.body || (isCall ? 'Mở app để nhận cuộc gọi' : 'Mở app để xem'),
    icon:data.callerAvatar || data.avatar || '/icon.png',badge:'/icon.png',data,
    tag:isCall || ended ? 'call-'+(data.callId || data.conversationId || 'incoming') : data.conversationId ? 'conv-'+data.conversationId : 'tho-fi-message',
    renotify:!ended && !expired,requireInteraction:isCall && !expired,
    vibrate:isCall ? [500,250,500] : [200,100,200]
  });
});
