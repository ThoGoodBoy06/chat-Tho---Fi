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

  // Nếu payload đã có trường notification và KHÔNG phải cuộc gọi, Firebase SDK sẽ tự động hiển thị thông báo.
  // Chúng ta không gọi showNotification() để tránh bị trùng lặp (hiển thị 2 lần).
  // Riêng cuộc gọi (isCall = true), chúng ta bắt buộc gọi showNotification() thủ công để cấu hình actions và rung dài.
  if (payload.notification && !isCall) {
    console.log("[firebase-messaging-sw.js] Trình duyệt tự động hiển thị thông báo từ payload.notification");
    return;
  }

  const title = payload.notification?.title || payload.data?.title || "Cuộc gọi đến";
  const body = payload.notification?.body || payload.data?.body || "Bạn có cuộc gọi mới";

  const options = {
    body: body,
    icon: payload.data?.callerAvatar || payload.data?.image || "/icon.png",
    badge: "/icon.png",
    data: payload.data,
    vibrate: isCall ? [1000, 500, 1000, 500, 1000, 500, 1000] : [400, 100, 400, 100, 600],
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

  self.registration.showNotification(title, options);
});

// Xử lý khi click vào banner thông báo chạy ngầm trên điện thoại
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const action = event.action; // "accept" hoặc "decline" hoặc undefined
  const notificationData = event.notification.data;

  if (notificationData && notificationData.type === "incoming_call") {
    // Tạo URL chứa query parameters cuộc gọi để trang web nhận diện và mở giao diện cuộc gọi
    let url = `/?action=incoming_call&callerId=${notificationData.callerId}&callerName=${encodeURIComponent(notificationData.callerName)}&callType=${notificationData.callType}&callerAvatar=${encodeURIComponent(notificationData.callerAvatar || "")}`;
    
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
