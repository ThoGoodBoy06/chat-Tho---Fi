# 📘 TÀI LIỆU TỔNG QUAN HỆ THỐNG (PROJECT BLUEPRINT & ARCHITECTURE)
## DỰ ÁN: CHAT THO-FI (NHẮN TIN & GỌI ĐIỆN REAL-TIME)

> **Mục đích**: Tài liệu này chứa toàn bộ kiến trúc, công nghệ, cấu trúc cơ sở dữ liệu, các luồng xử lý chính và danh sách file quan trọng của dự án. Bạn có thể sao chép (copy) tài liệu này để gửi cho bất kỳ AI nào (ChatGPT, Claude, Gemini, DeepSeek...) để AI đó hiểu 100% dự án của bạn ngay lập tức.

---

### 1. 🛠️ CÔNG NGHỆ SỬ DỤNG (TECH STACK)

- **Mobile & Web Frontend**: 
  - Ngôn ngữ: **Dart / Flutter** (Hỗ trợ iOS, Android, Web).
  - Quản lý trạng thái (State Management): **Provider** (`ChatProvider`, `ThemeProvider`).
  - Kết nối Real-time: **socket_io_client**.
  - Push Notification: **firebase_core**, **firebase_messaging** (FCM), **flutter_local_notifications**.
  - Âm thanh & Cuộc gọi: **audioplayers**, **SoundService**.

- **Backend Server**:
  - Runtime: **Node.js (Express.js)**.
  - Real-time Server: **Socket.IO** (`Server`).
  - ORM / Cơ sở dữ liệu: **Prisma ORM** (SQL Server / PostgreSQL).
  - Push Notification Server: **firebase-admin** (Gửi FCM Push Notification cho Android/iOS).
  - File Storage: Multer / Static Serving (`/uploads`, `/public`).

---

### 2. 🗄️ CẤU TRÚC BẢNG CƠ SỞ DỮ LIỆU (PRISMA SCHEMA)

Cơ sở dữ liệu gồm các bảng chính:

1. **`Users`**: Lưu thông tin người dùng (`id`, `username`, `fullName`, `avatar`, `coverPhoto`, `bio`, `fcmToken`, `isOnline`, `lastActive`).
2. **`Conversations`**: Lưu phòng chat (`id`, `type`: `private` / `group`, `name`, `avatar`, `theme`).
3. **`ConversationMembers`**: Lưu thành viên phòng chat (`id`, `conversationId`, `userId`, `role`, `nickname`, `deletedAt`).
4. **`Messages`**: Lưu tin nhắn (`id`, `conversationId`, `senderId`, `content`, `type`: `text`/`image`/`audio`/`file`, `replyMessageId`, `isRead`, `isDelivered`, `isRecalled`, `deletedBy`, `createdAt`).
5. **`FriendRequests`**: Quản lý lời mời kết bạn (`id`, `requesterId`, `receiverId`, `status`: `PENDING`/`ACCEPTED`/`REJECTED`).
6. **`Block`**: Quản lý chặn người dùng (`blockerId`, `blockedId`).

---

### 3. 📂 CẤU TRÚC FILE QUAN TRỌNG VÀ VAI TRÒ

#### 🟢 Phía Backend (Node.js Server):
- [server.js](file:///c:/Du_an_nhantin_goidien/server.js): Khởi tạo Express, HTTP Server, Socket.IO, middleware bảo mật và các route chính.
- [controllers/chat.controller.js](file:///c:/Du_an_nhantin_goidien/controllers/chat.controller.js): Chứa logic REST API cho tin nhắn (`sendMessage`, `getMessages`, `getConversations`, `markAsRead`, `markAsDelivered`, `sendPushNotification`).
- [sockets/socketHandler.js](file:///c:/Du_an_nhantin_goidien/sockets/socketHandler.js): Lắng nghe các sự kiện Socket.IO thời gian thực (`user_connected`, `go_online`, `go_offline`, `typing`, `mark_as_delivered`, `mark_as_read`, `call_user`).
- [routes/chat.routes.js](file:///c:/Du_an_nhantin_goidien/routes/chat.routes.js): Định tuyến API cho các tính năng chat.
- [prisma/schema.prisma](file:///c:/Du_an_nhantin_goidien/prisma/schema.prisma): Định nghĩa schema database.

#### 🔵 Phía Frontend (Flutter Mobile / Web):
- [flutter_frontend/lib/services/api_service.dart](file:///c:/Du_an_nhantin_goidien/flutter_frontend/lib/services/api_service.dart): Gọi REST API lên Server (`login`, `sendMessage`, `getConversations`, `getMessages`, `updateFcmToken`, `markAsRead`, `markAsDelivered`).
- [flutter_frontend/lib/services/socket_service.dart](file:///c:/Du_an_nhantin_goidien/flutter_frontend/lib/services/socket_service.dart): Quản lý kết nối Socket.IO, lắng nghe và phát các sự kiện thời gian thực.
- [flutter_frontend/lib/services/fcm_service.dart](file:///c:/Du_an_nhantin_goidien/flutter_frontend/lib/services/fcm_service.dart): Đăng ký Token FCM với Firebase, xử lý thông báo đẩy ngầm (`_firebaseMessagingBackgroundHandler`) và thông báo đẩy foreground.
- [flutter_frontend/lib/providers/chat_provider.dart](file:///c:/Du_an_nhantin_goidien/flutter_frontend/lib/providers/chat_provider.dart): Quản lý state danh sách cuộc trò chuyện, tin nhắn, hiển thị optimistic UI và lắng nghe sự kiện từ socket.
- [flutter_frontend/lib/screens/chat_screen.dart](file:///c:/Du_an_nhantin_goidien/flutter_frontend/lib/screens/chat_screen.dart): Giao diện màn hình nhắn tin chính, hiển thị tin nhắn, biểu tượng trạng thái tin nhắn (`_buildMessageStatusIndicator`).
- [flutter_frontend/ios/Runner/Info.plist](file:///c:/Du_an_nhantin_goidien/flutter_frontend/ios/Runner/Info.plist) & [Runner.entitlements](file:///c:/Du_an_nhantin_goidien/flutter_frontend/ios/Runner/Runner.entitlements): Cấu hình quyền iOS (`remote-notification`, `fetch`, `aps-environment`).

---

### 4. 🔄 CƠ CHẾ TRẠNG THÁI TIN NHẮN (MESSAGE STATUS LOGIC)

1. **"Đã gửi" (Sent)**:
   - `isRead = false`, `isDelivered = false`.
   - Giao diện người gửi hiển thị: **Hình tròn viền xám mảnh có dấu tích**.
2. **"Đã nhận" (Delivered)**:
   - `isRead = false`, `isDelivered = true`.
   - Giao diện người gửi hiển thị: **Hình tròn màu xanh dương (`#0068FF`) có dấu tích trắng**.
   - Được cập nhật khi thiết bị người nhận phát tín hiệu nhận dữ liệu (`mark_as_delivered` qua socket hoặc HTTP POST `/api/chat/messages/mark-delivered`).
3. **"Đã xem" (Read)**:
   - `isRead = true`.
   - Giao diện người gửi hiển thị: **Avatar nhỏ của người nhận**.
   - Được cập nhật khi người nhận bấm mở cuộc trò chuyện (`markAsRead`).
