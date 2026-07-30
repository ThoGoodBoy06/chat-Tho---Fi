// Version tracking - giúp trình duyệt iOS/Android nhận diện cập nhật mới và không dùng bản cache cũ
const SW_VERSION = "1.2.2";
console.log("[firebase-messaging-sw.js] Version:", SW_VERSION);

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js",
);

// Cấu hình Firebase Web (firebaseConfig)
const firebaseConfig = {
  apiKey: "AIzaSyDk6fayVDs0YbbhwldYxgHcN4nnjnPwmRc",
  authDomain: "chat-tho-fi.firebaseapp.com",
  projectId: "chat-tho-fi",
  storageBucket: "chat-tho-fi.firebasestorage.app",
  messagingSenderId: "513501588929",
  appId: "1:513501588929:web:54fd6c5fab227868bfd340",
};
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Đã nhận tin nhắn chạy ngầm", payload);

  const isCall = payload.data?.type === "incoming_call" || payload.data?.type === "INCOMING_CALL";

  const title = payload.notification?.title || (payload.data?.callerName ? `${payload.data.callerName} đang gọi cho bạn` : (payload.data?.title || "Tin nhắn mới"));
  const body = payload.notification?.body || payload.data?.body || (isCall ? `Cuộc gọi ${payload.data?.callType === 'video' ? 'Video' : 'Thoại'} đến` : "Bạn có thông báo mới");

  const options = {
    body: body,
    icon: payload.data?.callerAvatar || payload.data?.image || payload.notification?.image || "/icon.png",
    badge: "/icon.png",
    data: payload.data,
    vibrate: isCall ? [1000, 500, 1000, 500, 1000, 500, 1000, 500] : [400, 100, 400, 100, 600],
    tag: isCall ? "incoming-call" : (payload.data?.conversationId || "tho-fi-chat-notification"),
    renotify: true,
    requireInteraction: isCall ? true : false,
  };

  if (isCall) {
    options.actions = [
      { action: "accept", title: "Trả lời" },
      { action: "decline", title: "Từ chối" }
    ];
  }

  return self.registration.showNotification(title, options);
});

// Bắt sự kiện Push thô (dành cho Data-Only Push Payload từ Firebase Admin)
self.addEventListener("push", function (event) {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const data = payload.data || payload;

    const isCall = data.type === "INCOMING_CALL" || data.type === "incoming_call";
    if (isCall) {
      const callerName = data.callerName || data.title || "Cuộc gọi đến";
      const callType = data.callType === "video" ? "Video" : "Thoại";
      const title = `${callerName} đang gọi cho bạn...`;

      const options = {
        body: `Cuộc gọi ${callType} đến. Nhấn để trả lời.`,
        icon: data.callerAvatar || "/icon.png",
        badge: "/icon.png",
        data: data,
        vibrate: [1000, 500, 1000, 500, 1000, 500, 1000],
        tag: "incoming-call",
        renotify: true,
        requireInteraction: true,
        actions: [
          { action: "accept", title: "Trả lời" },
          { action: "decline", title: "Từ chối" }
        ]
      };

      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    }
  } catch (err) {
    console.error("[firebase-messaging-sw.js] Lỗi parse push event:", err);
  }
});

// Xử lý khi click vào banner thông báo chạy ngầm trên điện thoại
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const action = event.action; // "accept" hoặc "decline" hoặc undefined
  const notificationData = event.notification.data;

  if (notificationData && (notificationData.type === "incoming_call" || notificationData.type === "INCOMING_CALL")) {
    let url = `/?action=incoming_call&callerId=${notificationData.callerId}&callerName=${encodeURIComponent(notificationData.callerName || "")}&callType=${notificationData.callType || "voice"}&callerAvatar=${encodeURIComponent(notificationData.callerAvatar || "")}&t=${Date.now()}`;
    
    if (action === "accept") {
      url += "&autoAccept=true";
    } else if (action === "decline") {
      url += "&autoDecline=true";
    }

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url.includes(self.location.origin) && "navigate" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
    );
  }
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  if (event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
});
