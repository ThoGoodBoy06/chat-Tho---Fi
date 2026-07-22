// Version tracking - giúp trình duyệt iOS/Android nhận diện cập nhật mới và không dùng bản cache cũ
const SW_VERSION = "1.2.0";
console.log("[firebase-messaging-sw.js] Version:", SW_VERSION);

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js",
);

// TODO: Dán đúng Cấu hình Firebase Web (firebaseConfig) của bạn vào đây
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

  const isCall = payload.data?.type === "incoming_call";

  const title = payload.notification?.title || payload.data?.title || "Tin nhắn mới";
  const body = payload.notification?.body || payload.data?.body || "Bạn có thông báo mới";

  const options = {
    body: body,
    icon: payload.data?.callerAvatar || payload.data?.image || payload.notification?.image || "/icon.png",
    badge: "/icon.png",
    data: payload.data,
    // Rung liên tục (Rung 3s, nghỉ 0.5s, lặp lại 8 lần) cho cuộc gọi, hoặc nhịp mặc định cho tin nhắn
    vibrate: isCall ? [3000, 500, 3000, 500, 3000, 500, 3000, 500, 3000, 500, 3000, 500, 3000, 500, 3000, 500] : [400, 100, 400, 100, 600],
    tag: isCall ? "incoming-call-notification" : (payload.data?.conversationId || "tho-fi-chat-notification"),
    renotify: true,
    requireInteraction: isCall ? true : false, // Cuộc gọi thì giữ thông báo trên màn hình không tự biến mất
  };

  if (isCall) {
    options.actions = [
      { action: "accept", title: "Trả lời" },
      { action: "decline", title: "Từ chối" }
    ];
  }

  // LUÔN LUÔN gọi showNotification đồng bộ để đảm bảo iOS/Android hiển thị thông báo tin nhắn khi bị xóa đa nhiệm
  return self.registration.showNotification(title, options);
});

// Xử lý khi click vào banner thông báo chạy ngầm trên điện thoại
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const action = event.action; // "accept" hoặc "decline" hoặc undefined
  const notificationData = event.notification.data;

  if (notificationData && notificationData.type === "incoming_call") {
    // Tạo URL chứa query parameters cuộc gọi để trang web nhận diện và mở giao diện cuộc gọi
    let url = `/?action=incoming_call&callerId=${notificationData.callerId}&callerName=${encodeURIComponent(notificationData.callerName)}&callType=${notificationData.callType}&callerAvatar=${encodeURIComponent(notificationData.callerAvatar || "")}&t=${Date.now()}`;
    
    if (action === "accept") {
      url += "&autoAccept=true";
    } else if (action === "decline") {
      url += "&autoDecline=true";
    }

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
        // Tìm xem có tab web Tho-Fi nào đang mở không
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i];
          if (client.url.includes(self.location.origin) && "navigate" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Nếu không có tab nào mở, mở tab mới với URL chứa query cuộc gọi
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  } else {
    // Thông báo tin nhắn bình thường
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

// Hỏa tốc kích hoạt Service Worker mới ngay lập tức để nhận thông báo mới khi cập nhật app
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Xóa tất cả cache cũ khi Service Worker mới được kích hoạt
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim())
  );
});

// Bắt buộc tải HTML/CSS/JS mới nhất từ mạng (network-first) để tránh cache cũ
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Chỉ xử lý request cùng origin
  if (url.origin !== self.location.origin) return;
  
  // HTML pages: luôn tải từ mạng, không bao giờ dùng cache
  if (event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // CSS/JS: luôn tải từ mạng (vì đã có version query parameter)
  if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
});
