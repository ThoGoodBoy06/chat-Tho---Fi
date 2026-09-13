const fs = require('fs');
const path = require('path');

console.log('🚀 Đang triển khai bản vá ĐỒNG BỘ CUỘC GỌI TOÀN DIỆN (Chuẩn Zalo/Messenger)...');

const ROOT = path.resolve(__dirname, '..');

// =========================================================================
// 1. VÁ sockets/socketHandler.js và backend/sockets/socketHandler.js
// =========================================================================
const socketFiles = [
  path.join(ROOT, 'sockets', 'socketHandler.js'),
  path.join(ROOT, 'backend', 'sockets', 'socketHandler.js')
];

socketFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  let raw = fs.readFileSync(sf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let code = raw.replace(/\r\n/g, '\n');

  // a) Trong request_call: Nhận conversationId và lưu vào activeCalls cả khi online lẫn push
  const oldReq = `        if (isCalleeOnline) {
          console.log(\`📞 \${callerName} đang gọi cho \${calleeId}\`);
          activeCalls.set(callerId, { partnerId: calleeId });
          activeCalls.set(calleeId, { partnerId: callerId });
          // Chuyển tiếp cuộc gọi đến (incoming_call) cho User B (qua room)
          io.to(calleeId).emit("incoming_call", {
            callerId,
            callerName,
            callerAvatar,
            callType,
          });
        } else if (hasFcmToken) {
          console.log(\`📞 \${callerName} đang gọi qua Push cho \${calleeId} (tạm thời offline socket)\`);
          // Không bắn call_rejected về cho Caller, cho phép đổ chuông chờ người nhận bấm push notification để vào app.
        }`;

  const newReq = `        const convId = (typeof arguments !== 'undefined' && arguments[0] && (arguments[0].conversationId || arguments[0].convId)) || "";
        if (isCalleeOnline) {
          console.log(\`📞 \${callerName} đang gọi cho \${calleeId} (room: \${convId || 'none'})\`);
          activeCalls.set(callerId, { partnerId: calleeId, conversationId: convId });
          activeCalls.set(calleeId, { partnerId: callerId, conversationId: convId });
          // Chuyển tiếp cuộc gọi đến (incoming_call) cho User B (qua room)
          io.to(calleeId).emit("incoming_call", {
            callerId,
            callerName,
            callerAvatar,
            callType,
            conversationId: convId,
          });
        } else if (hasFcmToken) {
          console.log(\`📞 \${callerName} đang gọi qua Push cho \${calleeId} (tạm thời offline socket)\`);
          activeCalls.set(callerId, { partnerId: calleeId, conversationId: convId });
          activeCalls.set(calleeId, { partnerId: callerId, conversationId: convId });
        }`;

  if (code.includes(oldReq)) {
    code = code.replace(oldReq, newReq);
    console.log(`✅ [Socket] Đã cập nhật request_call lưu conversationId trong ${sf}`);
  } else if (code.includes('const convId =')) {
    console.log(`ℹ️ [Socket] request_call đã có convId trong ${sf}`);
  } else {
    console.warn(`⚠️ [Socket] Không tìm thấy oldReq trong ${sf}`);
  }

  // b) Trong end_call: Phát call_ended cho cả targetId, targetSocketId và conversationId
  const oldEnd = `      if (targetId) {
        io.to(targetId).emit("call_ended");
        const targetSocketId = userSockets.get(targetId);
        if (targetSocketId && targetSocketId !== targetId) {
          io.to(targetSocketId).emit("call_ended");
        }
        activeCalls.delete(targetId);

        // Huỷ thông báo chuông cuộc gọi đến trên FCM nếu có
        try {
          const targetUser = await prisma.users.findUnique({
            where: { id: targetId },
            select: { fcmToken: true }
          });
          if (targetUser && targetUser.fcmToken) {
            sendPushNotification(targetUser.fcmToken, "Cuộc gọi đã kết thúc", "", {
              type: "call_ended",
              callerId: String(socket.userId || ""),
              t: String(Date.now())
            }, true).catch(() => {});
          }
        } catch (_) {}
      }
      activeCalls.delete(socket.userId);`;

  const newEnd = `      if (targetId) {
        io.to(targetId).emit("call_ended", { callerId: socket.userId });
        const targetSocketId = userSockets.get(targetId);
        if (targetSocketId && targetSocketId !== targetId) {
          io.to(targetSocketId).emit("call_ended", { callerId: socket.userId });
        }
        activeCalls.delete(targetId);

        // Huỷ thông báo chuông cuộc gọi đến trên FCM nếu có
        try {
          const targetUser = await prisma.users.findUnique({
            where: { id: targetId },
            select: { fcmToken: true }
          });
          if (targetUser && targetUser.fcmToken) {
            sendPushNotification(targetUser.fcmToken, "Cuộc gọi đã kết thúc", "", {
              type: "call_ended",
              callerId: String(socket.userId || ""),
              t: String(Date.now())
            }, true).catch(() => {});
          }
        } catch (_) {}
      }

      // 🌟 ĐỒNG BỘ PHÒNG CHAT: Bắn call_ended vào cả phòng conversationId để chắc chắn 100% không sót socket nào
      if (conversationId) {
        io.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId: targetId });
      }

      activeCalls.delete(socket.userId);`;

  if (code.includes(oldEnd)) {
    code = code.replace(oldEnd, newEnd);
    console.log(`✅ [Socket] Đã cập nhật end_call phát tới cả conversationId trong ${sf}`);
  } else if (code.includes('io.to(conversationId).emit("call_ended"')) {
    console.log(`ℹ️ [Socket] end_call đã có conversationId trong ${sf}`);
  } else {
    console.warn(`⚠️ [Socket] Không tìm thấy oldEnd trong ${sf}`);
  }

  fs.writeFileSync(sf, isCRLF ? code.replace(/\n/g, '\r\n') : code, 'utf8');
});

// =========================================================================
// 2. VÁ Service Worker: Tự động đóng thông báo cuộc gọi khi nhận call_ended
// =========================================================================
const swFiles = [
  path.join(ROOT, 'public', 'firebase-messaging-sw.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'firebase-messaging-sw.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'firebase-messaging-sw.js')
];

swFiles.forEach(swf => {
  if (!fs.existsSync(swf)) return;
  let raw = fs.readFileSync(swf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let swCode = raw.replace(/\r\n/g, '\n');

  // a) Trong onBackgroundMessage
  if (!swCode.includes('// [Auto-Dismiss] Huỷ thông báo cuộc gọi đến khi đối phương tắt máy')) {
    const targetBg = 'messaging.onBackgroundMessage((payload) => {\n  console.log("[firebase-messaging-sw.js] Đã nhận tin nhắn chạy ngầm", payload);';
    const newBg = `messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Đã nhận tin nhắn chạy ngầm", payload);
  // [Auto-Dismiss] Huỷ thông báo cuộc gọi đến khi đối phương tắt máy
  if (payload.data?.type === "call_ended" || payload.data?.type === "CALL_ENDED") {
    return self.registration.getNotifications({ tag: "incoming-call" }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }`;
    if (swCode.includes(targetBg)) {
      swCode = swCode.replace(targetBg, newBg);
      console.log(`✅ [SW] Đã thêm auto-dismiss call_ended trong onBackgroundMessage cho ${swf}`);
    }
  }

  // b) Trong sự kiện push thô
  if (!swCode.includes('// [Auto-Dismiss Raw Push] Huỷ thông báo cuộc gọi đến khi đối phương tắt máy')) {
    const targetPush = '  try {\n    const payload = event.data.json();\n    const data = payload.data || payload;';
    const newPush = `  try {
    const payload = event.data.json();
    const data = payload.data || payload;
    // [Auto-Dismiss Raw Push] Huỷ thông báo cuộc gọi đến khi đối phương tắt máy
    if (data.type === "call_ended" || data.type === "CALL_ENDED") {
      event.waitUntil(
        self.registration.getNotifications({ tag: "incoming-call" }).then(function(notifications) {
          notifications.forEach(function(n) { n.close(); });
        })
      );
      return;
    }`;
    if (swCode.includes(targetPush)) {
      swCode = swCode.replace(targetPush, newPush);
      console.log(`✅ [SW] Đã thêm auto-dismiss call_ended trong push event cho ${swf}`);
    }
  }

  fs.writeFileSync(swf, isCRLF ? swCode.replace(/\n/g, '\r\n') : swCode, 'utf8');
});

// =========================================================================
// 3. VÁ chat_screen.dart: Thêm SoundService.stopAllCallSounds() khi call_ended
// =========================================================================
const dartFiles = [
  path.join(ROOT, 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let raw = fs.readFileSync(df, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let dContent = raw.replace(/\r\n/g, '\n');

  // a) Trong _startCall: Gửi thêm conversationId
  const oldStartEmit = `    SocketService.socket?.emit('request_call', {
      'callerId': callerId,
      'callerName': callerName,
      'callerAvatar': callerAvatar,
      'calleeId': targetUserId,
      'callType': isVideo ? 'video' : 'audio',
    });`;

  const newStartEmit = `    SocketService.socket?.emit('request_call', {
      'callerId': callerId,
      'callerName': callerName,
      'callerAvatar': callerAvatar,
      'calleeId': targetUserId,
      'callType': isVideo ? 'video' : 'audio',
      'conversationId': conv.id,
    });`;

  if (dContent.includes(oldStartEmit)) {
    dContent = dContent.replace(oldStartEmit, newStartEmit);
    console.log(`✅ [Dart] Đã thêm conversationId vào request_call trong ${df}`);
  }

  // b) Trong incomingEndSub: Thêm SoundService.stopAllCallSounds()
  const oldIncomingSub = `        incomingEndSub = SocketService.onCallEnded.listen((_) {
          print('🔴 Người gọi đã tắt máy -> Đóng màn hình cuộc gọi đến!');
          autoRejectTimer?.cancel();
          incomingEndSub?.cancel();
          _isIncomingCallShowing = false;
          try {
            Navigator.of(dialogContext, rootNavigator: true).pop();
          } catch (_) {
            try {
              Navigator.of(context, rootNavigator: true).pop();
            } catch (_) {}
          }
        });`;

  const newIncomingSub = `        incomingEndSub = SocketService.onCallEnded.listen((_) {
          print('🔴 Người gọi đã tắt máy -> Đóng màn hình cuộc gọi đến & tắt chuông!');
          autoRejectTimer?.cancel();
          incomingEndSub?.cancel();
          _isIncomingCallShowing = false;
          SoundService.stopAllCallSounds();
          try {
            if (Navigator.of(dialogContext).canPop()) {
              Navigator.of(dialogContext).pop();
            } else if (Navigator.of(dialogContext, rootNavigator: true).canPop()) {
              Navigator.of(dialogContext, rootNavigator: true).pop();
            } else if (Navigator.of(context, rootNavigator: true).canPop()) {
              Navigator.of(context, rootNavigator: true).pop();
            }
          } catch (_) {}
        });`;

  if (dContent.includes(oldIncomingSub)) {
    dContent = dContent.replace(oldIncomingSub, newIncomingSub);
    console.log(`✅ [Dart] Đã cập nhật incomingEndSub tắt chuông + pop an toàn trong ${df}`);
  }

  // c) Khi bấm Từ chối: Thêm SoundService.stopAllCallSounds()
  const oldRejectBtn = `                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    incomingEndSub?.cancel();
                                    SocketService.socket?.emit('reject_call', {`;

  const newRejectBtn = `                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    incomingEndSub?.cancel();
                                    SoundService.stopAllCallSounds();
                                    SocketService.socket?.emit('reject_call', {`;

  if (dContent.includes(oldRejectBtn)) {
    dContent = dContent.replace(oldRejectBtn, newRejectBtn);
    console.log(`✅ [Dart] Đã thêm stopAllCallSounds vào nút Từ chối trong ${df}`);
  }

  // d) Trong .then của showGeneralDialog: Thêm SoundService.stopAllCallSounds()
  const oldThen = `    ).then((_) {
      autoRejectTimer?.cancel();
      incomingEndSub?.cancel();
      _isIncomingCallShowing = false;
    });`;

  const newThen = `    ).then((_) {
      autoRejectTimer?.cancel();
      incomingEndSub?.cancel();
      _isIncomingCallShowing = false;
      SoundService.stopAllCallSounds();
    });`;

  if (dContent.includes(oldThen)) {
    dContent = dContent.replace(oldThen, newThen);
    console.log(`✅ [Dart] Đã thêm stopAllCallSounds vào .then của incoming dialog trong ${df}`);
  }

  fs.writeFileSync(df, isCRLF ? dContent.replace(/\n/g, '\r\n') : dContent, 'utf8');
});

console.log('🎉 TOÀN BỘ BẢN VÁ ĐỒNG BỘ CUỘC GỌI ĐÃ ĐƯỢC ÁP DỤNG HOÀN TẤT!');
