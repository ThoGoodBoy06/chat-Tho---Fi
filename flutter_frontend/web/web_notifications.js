(function () {
  'use strict';
  const backend = 'https://chat-tho-fi-vn-9s8u.onrender.com';
  let registered = false;
  let foregroundListening = false;
  window.isNotificationSupported = () => window.isSecureContext &&
    'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  window.isWebPushRegistered = () => registered && Notification.permission === 'granted';
  window.markWebPushRegistered = function (value) {
    registered = value === true;
    if (window.updateNotificationModalState) window.updateNotificationModalState();
  };
  window.getWebDeviceId = function () {
    let id = localStorage.getItem('tho_fi_web_device_id');
    if (!id) {
      id = 'web_' + Math.random().toString(36).slice(2) + '_' + Date.now();
      localStorage.setItem('tho_fi_web_device_id', id);
    }
    return id;
  };
  window.postUserPushApi = async function (path, body) {
    const stored = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken');
    if (!stored) throw new Error('Bạn cần đăng nhập trước khi bật thông báo.');
    let token;
    try { token = JSON.parse(stored); } catch (_) { token = stored; }
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    const response = await fetch((local ? '' : backend) + '/api/users/' + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify(body || {})
    });
    let result;
    try { result = await response.json(); }
    catch (_) { throw new Error('Máy chủ thông báo trả về dữ liệu không hợp lệ.'); }
    if (!response.ok || result.success !== true) {
      throw new Error(result.message || 'Máy chủ chưa đăng ký được thông báo.');
    }
    return result;
  };
  window.registerFCMAndGetToken = async function (vapidKey, options) {
    if (!window.isNotificationSupported()) return null;
    // A permission prompt must originate directly from an explicit tap on iOS.
    let permission = Notification.permission;
    if (permission !== 'granted' && options && options.requestPermission && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return null;
    try {
      if (!window.firebase) throw new Error('Không tải được dịch vụ thông báo. Hãy kiểm tra mạng rồi thử lại.');
      if (!firebase.apps.length) firebase.initializeApp({
        apiKey: 'AIzaSyDk6fayVDs0YbbhwldYxgHcN4nnjnPwmRc',
        authDomain: 'chat-tho-fi.firebaseapp.com', projectId: 'chat-tho-fi',
        storageBucket: 'chat-tho-fi.firebasestorage.app', messagingSenderId: '513501588929',
        appId: '1:513501588929:web:54fd6c5fab227868bfd340'
      });
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=push-4', {
        scope: '/firebase-cloud-messaging-push-scope', updateViaCache: 'none'
      });
      if (!registration.active) await new Promise((resolve, reject) => {
        const worker = registration.installing || registration.waiting;
        if (!worker) { reject(new Error('Chưa khởi tạo được thông báo nền.')); return; }
        const timer = setTimeout(() => { cleanup(); reject(new Error('Thông báo nền khởi tạo quá lâu.')); }, 15000);
        function cleanup() { clearTimeout(timer); worker.removeEventListener('statechange', changed); }
        function changed() {
          if (worker.state === 'activated') { cleanup(); resolve(); }
          if (worker.state === 'redundant') { cleanup(); reject(new Error('Khởi tạo thông báo nền thất bại.')); }
        }
        worker.addEventListener('statechange', changed);
        changed();
      });
      const messaging = firebase.messaging();
      if (!foregroundListening) {
        messaging.onMessage(payload => {
          const data = payload.data || {};
          if (/^(call_ended|CALL_ENDED)$/.test(data.type || '')) {
            if (data.callId) dispatchIntent({...data,type:'call_ended'});
            return;
          }
          const notice = payload.notification || {};
          registration.showNotification(notice.title || data.title || 'Tin nhắn mới', {
            body: notice.body || data.body || 'Bạn có tin nhắn mới',
            icon: data.avatar || '/icon.png', badge: '/icon.png', data,
            tag: data.conversationId ? 'conv-' + data.conversationId : 'tho-fi-message',
            renotify: true
          }).catch(error => console.warn('[Push] Không hiện được thông báo:', error.message));
        });
        foregroundListening = true;
      }
      return await messaging.getToken({
        vapidKey: vapidKey || 'BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0',
        serviceWorkerRegistration: registration
      });
    } catch (error) {
      console.warn('[Push] Đăng ký thất bại:', error.message);
      throw error;
    }
  };
  let pendingIntent = null;
  function dispatchIntent(data) {
    pendingIntent = data;
    window.dispatchEvent(new CustomEvent('tho-fi-push', {detail:JSON.stringify(data)}));
  }
  window.consumePushIntent = function () {
    const value = pendingIntent;
    pendingIntent = null;
    return value ? JSON.stringify(value) : null;
  };
  if (navigator.serviceWorker?.addEventListener) navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'PUSH_OPEN' && event.data?.type !== 'PUSH_CALL_ENDED') return;
    const data = event.data.data || {};
    dispatchIntent(event.data.type === 'PUSH_CALL_ENDED' ? {...data,type:'call_ended'} : data);
  });
  let refreshing = false, lastRefresh = 0;
  window.refreshPushRegistration = async function () {
    if (refreshing || Date.now()-lastRefresh < 60000 || !window.isNotificationSupported() || Notification.permission !== 'granted') return;
    if (!localStorage.getItem('flutter.authToken') && !localStorage.getItem('authToken')) return;
    refreshing = true; lastRefresh = Date.now();
    try {
      const token = await window.registerFCMAndGetToken();
      if (token) {
        await window.postUserPushApi('fcm-token',{fcmToken:token,platform:'web',deviceId:window.getWebDeviceId()});
        window.markWebPushRegistered(true);
      }
    } catch (error) { window.markWebPushRegistered(false); console.warn('[Push] Không cập nhật được đăng ký:',error.message); }
    finally {refreshing=false;}
  };
  if (window.addEventListener) window.addEventListener('online',window.refreshPushRegistration);
  if (window.addEventListener) window.addEventListener('load',window.refreshPushRegistration);
  if (document.addEventListener) document.addEventListener('visibilitychange', () => {
    if (!document.hidden) window.refreshPushRegistration();
  });
})();
