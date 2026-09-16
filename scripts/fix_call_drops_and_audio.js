const fs = require('fs');

console.log('=== TIẾN HÀNH SỬA TRIỆT ĐỂ: LỖI TỰ ĐỘNG TẮT MÁY VÀ KHÔNG NGHE TIẾNG ===');

const versionTag = 'call_robust_' + Date.now();

// 1. SỬA SOCKET HANDLER: Chống tự động tắt máy khi socket blip / reconnect và đảm bảo webrtc_signal gửi tới room connectedUserId
const socketFiles = [
  'sockets/socketHandler.js',
  'backend/sockets/socketHandler.js'
];

for (const fp of socketFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // A. webrtc_signal: Luôn gửi đến room connectedUserId (đảm bảo tab active luôn nhận được)
  const oldSignalBlock = `      const targetSocketId = userSockets.get(connectedUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("webrtc_signal", signalPayload);
      } else {
        io.to(connectedUserId).emit("webrtc_signal", signalPayload);
      }`;
  const newSignalBlock = `      // 🌟 Gửi đến TOÀN BỘ các socket kết nối của connectedUserId (room socket.userId)
      // Đảm bảo tab đang đàm thoại của đối phương luôn nhận được tín hiệu 100%
      io.to(connectedUserId).emit("webrtc_signal", signalPayload);`;

  if (code.includes(oldSignalBlock)) {
    code = code.replace(oldSignalBlock, newSignalBlock);
    console.log(`✅ [socketHandler] Đã chuẩn hóa webrtc_signal phát trực tiếp tới room user trong: ${fp}`);
  }

  // B. disconnect: KHÔNG tự động kết thúc cuộc gọi ngay lập tức nếu user vẫn còn tab khác hoặc chỉ reconnect tạm thời
  const oldDisconnectBlock = `    // 2. Lắng nghe khi người dùng tắt app hoặc mất mạng
    socket.on("disconnect", () => {
      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);
      if (socket.userId && activeCalls.has(socket.userId)) {
        const activeInfo = activeCalls.get(socket.userId);
        const partnerId = activeInfo?.partnerId;
        const convId = activeInfo?.conversationId;
        console.log(\`🔴 [disconnect] Tự động kết thúc cuộc gọi dở dang cho partner \${partnerId}, room \${convId}\`);
        if (partnerId) {
          io.to(partnerId).emit("call_ended", { callerId: socket.userId, targetId: partnerId, conversationId: convId });
          activeCalls.delete(partnerId);
          try {
            prisma.users.findUnique({
              where: { id: partnerId },
              select: { fcmToken: true }
            }).then(u => {
              if (u && u.fcmToken) {
                sendPushNotification(u.fcmToken, "Cuộc gọi đã kết thúc", "", {
                  type: "call_ended",
                  callerId: String(socket.userId || ""),
                  t: String(Date.now())
                }, true).catch(() => {});
              }
            }).catch(() => {});
          } catch (_) {}
        } else if (convId) {
          socket.to(convId).emit("call_ended", { callerId: socket.userId, conversationId: convId });
        }
        activeCalls.delete(socket.userId);
      }
      if (socket.userId) {
        // Chỉ xóa khỏi map nếu socket.id đang ngắt kết nối là socket đang lưu trữ trong map
        if (userSockets.get(socket.userId) === socket.id) {
          userSockets.delete(socket.userId);
        }

        // Kiểm tra xem người dùng này còn bất kỳ socket kết nối nào khác không (thông qua room của họ)
        const userRoom = io.sockets.adapter.rooms.get(socket.userId);
        if (!userRoom || userRoom.size === 0) {
          io.emit("user_status_changed", { userId: socket.userId, isOnline: false });
          io.emit("user_status_change", { userId: socket.userId, isOnline: false });
          console.log(\`👤 User \${socket.userId} ngắt kết nối hoàn toàn (Offline).\`);
        }
      }
    });`;

  const newDisconnectBlock = `    // 2. Lắng nghe khi người dùng tắt app hoặc mất mạng
    socket.on("disconnect", () => {
      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);
      const uid = socket.userId;
      if (uid) {
        if (userSockets.get(uid) === socket.id) {
          userSockets.delete(uid);
        }

        // Kiểm tra xem user này còn socket kết nối nào khác trong room không
        const userRoom = io.sockets.adapter.rooms.get(uid);
        const stillConnected = userRoom && userRoom.size > 0;

        // 🌟 CHỐNG TỰ ĐỘNG TẮT MÁY:
        // Nếu user vẫn còn kết nối khác đang mở (tab khác, hoặc vừa reconnect), TUYỆT ĐỐI KHÔNG hủy cuộc gọi!
        if (activeCalls.has(uid) && !stillConnected) {
          console.log(\`⏳ [disconnect] User \${uid} tạm ngắt kết nối. Chờ 10s trước khi hủy cuộc gọi...\`);
          setTimeout(() => {
            const checkRoom = io.sockets.adapter.rooms.get(uid);
            if (checkRoom && checkRoom.size > 0) {
              console.log(\`🔄 [disconnect] User \${uid} đã kết nối lại kịp thời. Giữ nguyên cuộc gọi!\`);
              return;
            }
            if (activeCalls.has(uid)) {
              const activeInfo = activeCalls.get(uid);
              const partnerId = activeInfo?.partnerId;
              const convId = activeInfo?.conversationId;
              console.log(\`🔴 [disconnect timeout 10s] User \${uid} ngắt kết nối hoàn toàn -> Đóng cuộc gọi\`);
              if (partnerId) {
                io.to(partnerId).emit("call_ended", { callerId: uid, targetId: partnerId, conversationId: convId });
                activeCalls.delete(partnerId);
              } else if (convId) {
                io.to(convId).emit("call_ended", { callerId: uid, conversationId: convId });
              }
              activeCalls.delete(uid);
            }
          }, 10000);
        }

        if (!stillConnected) {
          io.emit("user_status_changed", { userId: uid, isOnline: false });
          io.emit("user_status_change", { userId: uid, isOnline: false });
          console.log(\`👤 User \${uid} ngắt kết nối hoàn toàn (Offline).\`);
        }
      }
    });`;

  if (code.includes(oldDisconnectBlock)) {
    code = code.replace(oldDisconnectBlock, newDisconnectBlock);
    console.log(`✅ [socketHandler] Đã vá chống tự động tắt máy khi disconnect trong: ${fp}`);
  }

  fs.writeFileSync(fp, code, 'utf8');
}

// 2. SỬA CHAT_SCREEN.DART: Xóa bỏ bộ đếm tự động tắt máy 10s trên client
const chatFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of chatFiles) {
  if (!fs.existsSync(fp)) continue;
  let dart = fs.readFileSync(fp, 'utf8');

  // Xóa bỏ đoạn tự động đóng phòng gọi sau 10s mất kết nối ICE
  const oldIceListener = `pc?.onIceConnectionStateChange.listen((_) {
                  print('⚡ WebRTC ICE Connection State: \${pc?.iceConnectionState}');
                  final iceState = pc?.iceConnectionState;
                  if (iceState == 'disconnected' || iceState == 'closed') {
                    Future.delayed(const Duration(milliseconds: 10000), () {
                      if (pc?.iceConnectionState == 'disconnected' || pc?.iceConnectionState == 'closed') {
                        print('🔴 Mất kết nối ICE quá 10s -> Tự động đóng phòng gọi');
                        cleanupCall();
                        try {
                          Navigator.of(dialogContext, rootNavigator: true).pop();
                        } catch (_) {
                          try {
                            Navigator.of(context, rootNavigator: true).pop();
                          } catch (_) {}
                        }
                      }
                    });
                  }
                });`;

  const newIceListener = `pc?.onIceConnectionStateChange.listen((_) {
                  print('⚡ WebRTC ICE Connection State: \${pc?.iceConnectionState}');
                  // 🌟 Giữ nguyên phòng đàm thoại, không tự động tắt máy khi mạng biến động
                });`;

  if (dart.includes(oldIceListener)) {
    dart = dart.replace(oldIceListener, newIceListener);
    console.log(`✅ [chat_screen.dart] Đã gỡ bỏ timer tự động tắt máy trong: ${fp}`);
  }

  // Thêm TURN UDP
  const oldTurn = `'urls': [
                        'turns:openrelay.metered.ca:443?transport=tcp',
                        'turn:openrelay.metered.ca:443?transport=tcp',
                        'turn:openrelay.metered.ca:80?transport=tcp',
                      ],`;
  const newTurn = `'urls': [
                        'turn:openrelay.metered.ca:80',
                        'turn:openrelay.metered.ca:443',
                        'turn:openrelay.metered.ca:443?transport=tcp',
                        'turns:openrelay.metered.ca:443?transport=tcp',
                      ],`;
  if (dart.includes(oldTurn)) {
    dart = dart.replace(oldTurn, newTurn);
    console.log(`✅ [chat_screen.dart] Đã thêm TURN UDP OpenRelay trong: ${fp}`);
  }

  fs.writeFileSync(fp, dart, 'utf8');
}

// 3. CẬP NHẬT CACHE-BUSTER TRONG INDEX.HTML & FLUTTER_BOOTSTRAP.JS
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  html = html.replace(/flutter_bootstrap\.js\?v=[^"']+/g, `flutter_bootstrap.js?v=${versionTag}`);
  html = html.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?v=${versionTag}`);
  html = html.replace(/flutter_service_worker\.js\?v=[^"']+/g, `flutter_service_worker.js?v=${versionTag}.2.1`);
  fs.writeFileSync(fp, html, 'utf8');
  console.log(`✅ [index.html] Đã cập nhật version tag mới trong: ${fp}`);
}

const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

for (const fp of bootstrapFiles) {
  if (!fs.existsSync(fp)) continue;
  let bs = fs.readFileSync(fp, 'utf8');
  bs = bs.replace(/"mainJsPath":\s*"main\.dart\.js\?v=[^"]*"/g, `"mainJsPath":"main.dart.js?v=${versionTag}"`);
  fs.writeFileSync(fp, bs, 'utf8');
  console.log(`✅ [flutter_bootstrap.js] Đã cập nhật version tag mới trong: ${fp}`);
}

console.log('=== HOÀN TẤT VÁ TOÀN DIỆN ===');
