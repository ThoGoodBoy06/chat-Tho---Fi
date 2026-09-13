const fs = require('fs');
const path = require('path');

console.log('🚀 Đang sửa triệt để lỗi màn hình trắng sau khi tắt cuộc gọi...');

const ROOT = path.resolve(__dirname, '..');

// =========================================================================
// 1. SỬA sockets/socketHandler.js và backend/sockets/socketHandler.js
// Không phát call_ended ngược lại cho người vừa bấm tắt máy
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

  // Thay thế khối end_call
  const oldEndCall = /socket\.on\("end_call",\s*async\s*\(data\s*=\s*\{\}\)\s*=>\s*\{[\s\S]*?activeCalls\.delete\(socket\.userId\);\s*\};?/;
  const newEndCall = `socket.on("end_call", async (data = {}) => {
      let d = data;
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch (_) {}
      }
      d = d || {};
      const activeInfo = activeCalls.get(socket.userId);
      const targetId = d.connectedUserId || d.to || d.targetUserId || d.userId || d.calleeId || d.callerId || activeInfo?.partnerId;
      const conversationId = d.conversationId || d.convId || activeInfo?.conversationId;
      console.log(\`🔴 [end_call] Tắt cuộc gọi từ user \${socket.userId} -> partner \${targetId}, room \${conversationId}\`);

      if (targetId) {
        io.to(targetId).emit("call_ended", { callerId: socket.userId, targetId });
        const targetSocketId = userSockets.get(targetId);
        if (targetSocketId && targetSocketId !== targetId) {
          io.to(targetSocketId).emit("call_ended", { callerId: socket.userId, targetId });
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

      // 🌟 ĐỒNG BỘ PHÒNG CHAT: Bắn call_ended cho đối phương trong phòng (trừ caller để không bị pop nhầm màn hình)
      if (conversationId) {
        socket.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId });
      }

      activeCalls.delete(socket.userId);
    });`;

  if (oldEndCall.test(code)) {
    code = code.replace(oldEndCall, newEndCall);
    console.log(`✅ [Socket] Đã sửa end_call không gửi lại cho caller trong ${sf}`);
  } else {
    console.warn(`⚠️ [Socket] Không khớp oldEndCall trong ${sf}`);
  }

  fs.writeFileSync(sf, isCRLF ? code.replace(/\n/g, '\r\n') : code, 'utf8');
});

// =========================================================================
// 2. SỬA main.dart.js (public, build/web, backend)
// Thay thế window.dismissIncomingCallNow:
// - Chỉ pop đúng 1 lần khi canPop (rB) là true
// - Tuyệt đối không pop _chatScreenContext
// - Không dùng setTimeout pop bừa bãi
// =========================================================================
const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Dừng chuông và đóng hộp thoại cuộc gọi...");
  try { A.FS(); } catch(e) {}
  try { if (navigator.vibrate) navigator.vibrate(0); } catch(_) {}
  if (window.stopTestCallSound) { try { window.stopTestCallSound(); } catch(_) {} }
  try {
    if (window._incomingCallTimer && window._incomingCallTimer.a) window._incomingCallTimer.a.ai(0);
    if (window._incomingCallTimerHolder && window._incomingCallTimerHolder.a) window._incomingCallTimerHolder.a.ai(0);
  } catch(_) {}
  var _ra = document.getElementById("remoteAudioPlayer");
  if (_ra) { try { _ra.pause(); _ra.srcObject = null; } catch(_) {} }
  var _lv = document.getElementById("localVideoPlayer");
  if (_lv) { try { _lv.pause(); _lv.srcObject = null; _lv.remove(); } catch(_) {} }
  var _rv = document.getElementById("remoteVideoPlayer");
  if (_rv) { try { _rv.pause(); _rv.srcObject = null; _rv.remove(); } catch(_) {} }

  // CHỈ POP NẾU HỘP THOẠI ĐANG MỞ
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    console.log("ℹ️ [dismissIncomingCallNow] Không có hộp thoại cuộc gọi nào đang hiển thị, không pop để tránh trắng màn hình.");
    return;
  }

  var popped = false;
  var ctx = window._incomingCallContext || (window._incomingRejectAction && window._incomingRejectAction.d);
  if (ctx) {
    try {
      var nav1 = A.b1(ctx, false);
      if (nav1 && nav1.rB()) {
        nav1.dN(0);
        popped = true;
        console.log("✅ Đã đóng incoming dialog qua ctx (canPop)");
      }
    } catch(_) {}
  }

  if (!popped && window._incomingNav) {
    try {
      if (window._incomingNav.rB()) {
        window._incomingNav.dN(0);
        popped = true;
        console.log("✅ Đã đóng incoming dialog qua _incomingNav (canPop)");
      }
    } catch(_) {}
  }

  if (!popped && window._activeCallContext) {
    try {
      var navAct = A.b1(window._activeCallContext, false);
      if (navAct && navAct.rB()) {
        navAct.dN(0);
        popped = true;
        console.log("✅ Đã đóng activeCall dialog (canPop)");
      }
    } catch(_) {}
  }

  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingNav = null;
  window._incomingCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;
};`;

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let raw = fs.readFileSync(jf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let js = raw.replace(/\r\n/g, '\n');

  // Thay thế định nghĩa cũ của window.dismissIncomingCallNow
  const oldFuncRegex = /window\.dismissIncomingCallNow\s*=\s*function\(\)\s*\{[\s\S]*?window\._incomingCallShowing\s*=\s*false;\s*\};/m;
  if (oldFuncRegex.test(js)) {
    js = js.replace(oldFuncRegex, safeDismissFunc);
    console.log(`✅ [JS] Đã thay thế safe window.dismissIncomingCallNow trong ${jf}`);
  } else {
    console.warn(`⚠️ [JS] Không tìm thấy oldFuncRegex trong ${jf}`);
  }

  // Đảm bảo A.aw4 đánh dấu window._activeCallShowing
  const targetAw4 = 'A.aw4.prototype={\n$3(a,b,c){var s=this;window._activeCallContext=a;';
  const newAw4 = 'A.aw4.prototype={\n$3(a,b,c){var s=this;window._activeCallContext=a;window._activeCallShowing=true;';
  if (js.includes(targetAw4)) {
    js = js.replace(targetAw4, newAw4);
    console.log(`✅ [JS] Đã thêm _activeCallShowing vào A.aw4 trong ${jf}`);
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// =========================================================================
// 3. Cập nhật version timestamp trong index.html
// =========================================================================
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let raw = fs.readFileSync(f, 'utf8');
  const now = Date.now();
  raw = raw.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  fs.writeFileSync(f, raw, 'utf8');
  console.log(`✅ [Index] Đã cập nhật cache buster mới v=${now} cho ${f}`);
});

console.log('🎉 Hoàn tất sửa triệt để lỗi màn hình trắng!');
