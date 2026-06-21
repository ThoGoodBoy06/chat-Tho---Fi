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

  // Nếu payload đã có trường notification, Firebase SDK sẽ tự động hiển thị thông báo.
  // Chúng ta không gọi showNotification() để tránh bị trùng lặp (hiển thị 2 lần).
  if (payload.notification) {
    console.log("[firebase-messaging-sw.js] Trình duyệt tự động hiển thị thông báo từ payload.notification");
    return;
  }

  const title = payload.data?.title || "Tin nhắn mới";
  const body = payload.data?.body || "Bạn có một tin nhắn mới trên Tho-Fi Chat";

  const options = {
    body: body,
    icon: payload.data?.image || "/icon.png",
    badge: "/icon.png",
    data: payload.data,
    vibrate: [400, 100, 400, 100, 600],
    tag: payload.data?.conversationId || "tho-fi-chat-notification",
    renotify: true
  };

  self.registration.showNotification(title, options);
});

// Xử lý khi click vào banner thông báo chạy ngầm trên điện thoại
self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      // Tìm xem có tab web Tho-Fi nào đang mở không
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Nếu không có tab nào mở, mở tab mới
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
