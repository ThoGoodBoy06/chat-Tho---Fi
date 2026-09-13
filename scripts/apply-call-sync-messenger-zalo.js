const fs = require('fs');
const path = require('path');

console.log('🚀 Đang triển khai bản vá ĐỒNG BỘ CUỘC GỌI TOÀN DIỆN CHUẨN ZALO/MESSENGER...');

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

  // a) Nâng cấp request_call: Nhận conversationId an toàn từ payload object
  const reqPattern = /socket\.on\(\s*"request_call",\s*async\s*\(\{([^}]+)\}\)\s*=>\s*\{/;
  if (reqPattern.test(code)) {
    code = code.replace(
      reqPattern,
      `socket.on("request_call", async (payload = {}) => {\n        const { callerId, callerName, calleeId, callType, callerAvatar, conversationId } = payload;\n        const convId = conversationId || payload.convId || "";`
    );
    console.log(`✅ [Socket] Đã nâng cấp request_call signature trong ${sf}`);
  }

  // Đảm bảo activeCalls lưu convId
  code = code.replace(
    /const convId = \(typeof arguments !== 'undefined'[^;]+;/g,
    `const convId = (typeof payload !== 'undefined' && (payload.conversationId || payload.convId)) || "";`
  );

  // b) Nâng cấp end_call: Nhận mọi format data, phát targetId, targetSocketId, conversationId, FCM và tự phản hồi caller
  const endPattern = /socket\.on\("end_call",\s*async\s*\([^\)]*\)\s*=>\s*\{[\s\S]*?activeCalls\.delete\(socket\.userId\);\s*\};/m;
  const newEndCallCode = `socket.on("end_call", async (data = {}) => {
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

      // 🌟 ĐỒNG BỘ PHÒNG CHAT: Bắn call_ended vào cả phòng conversationId để chắc chắn 100% không sót socket nào
      if (conversationId) {
        io.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId });
      }

      // Phản hồi lại cho caller để đóng màn hình gọi phía caller
      socket.emit("call_ended", { callerId: socket.userId, targetId });

      activeCalls.delete(socket.userId);
    });`;

  if (endPattern.test(code)) {
    code = code.replace(endPattern, newEndCallCode);
    console.log(`✅ [Socket] Đã thay thế end_call hoàn chỉnh trong ${sf}`);
  } else {
    console.warn(`⚠️ [Socket] Không khớp regex end_call trong ${sf}`);
  }

  // c) Nâng cấp disconnect: Tự động huỷ cuộc gọi nếu mất mạng/tắt máy khi đang gọi
  const discTarget = 'socket.on("disconnect", () => {\n      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);';
  const newDisc = `socket.on("disconnect", () => {
      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);
      if (socket.userId && activeCalls.has(socket.userId)) {
        const activeInfo = activeCalls.get(socket.userId);
        const partnerId = activeInfo?.partnerId;
        const convId = activeInfo?.conversationId;
        console.log(\`🔴 [disconnect] Tự động kết thúc cuộc gọi dở dang cho partner \${partnerId}, room \${convId}\`);
        if (partnerId) {
          io.to(partnerId).emit("call_ended", { callerId: socket.userId, targetId: partnerId });
          const pSocketId = userSockets.get(partnerId);
          if (pSocketId && pSocketId !== partnerId) {
            io.to(pSocketId).emit("call_ended", { callerId: socket.userId, targetId: partnerId });
          }
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
        }
        if (convId) {
          io.to(convId).emit("call_ended", { callerId: socket.userId, targetId: partnerId });
        }
        activeCalls.delete(socket.userId);
      }`;

  if (code.includes(discTarget) && !code.includes('activeCalls.has(socket.userId)')) {
    code = code.replace(discTarget, newDisc);
    console.log(`✅ [Socket] Đã thêm tự động huỷ cuộc gọi khi disconnect trong ${sf}`);
  }

  fs.writeFileSync(sf, isCRLF ? code.replace(/\n/g, '\r\n') : code, 'utf8');
});

// =========================================================================
// 2. VÁ Service Worker: Auto-dismiss + broadcast postMessage tới Client
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

  // Thay thế khối xử lý call_ended trong raw push event
  const oldRawPushCallEnded = /if \(data\.type === "call_ended" \|\| data\.type === "CALL_ENDED"\) \{[\s\S]*?return;\s*\}/;
  const newRawPushCallEnded = `if (data.type === "call_ended" || data.type === "CALL_ENDED") {
      event.waitUntil(
        Promise.all([
          self.registration.getNotifications().then(function(notifications) {
            notifications.forEach(function(n) {
              if (n.tag === "incoming-call" || (n.title && n.title.includes("gọi"))) {
                n.close();
              }
            });
          }),
          self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
            clients.forEach(function(client) {
              client.postMessage({ type: "call_ended" });
            });
          })
        ])
      );
      return;
    }`;

  if (oldRawPushCallEnded.test(swCode)) {
    swCode = swCode.replace(oldRawPushCallEnded, newRawPushCallEnded);
    console.log(`✅ [SW] Đã nâng cấp auto-dismiss + broadcast call_ended cho ${swf}`);
  }

  // Tăng version SW để force update
  swCode = swCode.replace(/const SW_VERSION = "[^"]+";/, `const SW_VERSION = "2.1.${Date.now()}";`);

  fs.writeFileSync(swf, isCRLF ? swCode.replace(/\n/g, '\r\n') : swCode, 'utf8');
});

// =========================================================================
// 3. VÁ index.html: Lắng nghe postMessage từ Service Worker và gọi dismissIncomingCallNow
// =========================================================================
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(idxF => {
  if (!fs.existsSync(idxF)) return;
  let raw = fs.readFileSync(idxF, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let html = raw.replace(/\r\n/g, '\n');

  const swListenerCode = `    // [Call Sync] Lắng nghe tín hiệu call_ended từ Service Worker để đóng màn hình gọi ngay lập tức
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && (event.data.type === 'call_ended' || event.data.type === 'CALL_ENDED')) {
          console.log('🔴 [SW Message] Cuộc gọi đã kết thúc -> Đóng toàn bộ chuông và màn hình cuộc gọi!');
          if (window.dismissIncomingCallNow) {
            window.dismissIncomingCallNow();
          }
        }
      });
    }`;

  if (!html.includes('// [Call Sync] Lắng nghe tín hiệu call_ended từ Service Worker')) {
    html = html.replace('</script>', `${swListenerCode}\n  </script>`);
    console.log(`✅ [Index] Đã thêm SW message listener cho ${idxF}`);
  }

  // Update cache buster
  const now = Date.now();
  html = html.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);

  fs.writeFileSync(idxF, isCRLF ? html.replace(/\n/g, '\r\n') : html, 'utf8');
});

// =========================================================================
// 4. VÁ main.dart.js: Định nghĩa window.dismissIncomingCallNow và vá A.ao2
// =========================================================================
const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let raw = fs.readFileSync(jf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let js = raw.replace(/\r\n/g, '\n');

  // a) Cập nhật agj(a) (incoming_call handler) để lưu window._chatScreenContext và phát chuông
  const oldAgjPart = 'o=this.c\no.toString\nwindow._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';
  const newAgjPart = 'o=this.c\no.toString\nwindow._chatScreenContext=o;window._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\ntry{A.FQ();}catch(_){}\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';

  if (js.includes(oldAgjPart)) {
    js = js.replace(oldAgjPart, newAgjPart);
    console.log(`✅ [JS] Đã thêm _chatScreenContext & playRingtone vào agj cho ${jf}`);
  } else if (js.includes('window._chatScreenContext=o;')) {
    console.log(`ℹ️ [JS] agj đã có _chatScreenContext trong ${jf}`);
  }

  // b) Thay thế A.ao2.prototype.$1(a) bằng bộ đóng cuộc gọi tối thượng:
  const ao2Pattern = /A\.ao2\.prototype=\{[\s\S]*?\$S:2\}/;
  const newAo2Code = `A.ao2.prototype={
$1(a){
A.bQ("🔴 Socket call_ended: Dừng chuông, dừng rung và đóng màn hình cuộc gọi!");
$.aNP().D(0,null);
if(window.dismissIncomingCallNow){
  try{window.dismissIncomingCallNow();}catch(e){console.warn("Lỗi dismissIncomingCallNow:",e);}
}
},
$S:2}`;

  if (ao2Pattern.test(js)) {
    js = js.replace(ao2Pattern, newAo2Code);
    console.log(`✅ [JS] Đã thay thế A.ao2.prototype trong ${jf}`);
  } else {
    console.warn(`⚠️ [JS] Không khớp A.ao2.prototype trong ${jf}`);
  }

  // c) Thêm hàm window.dismissIncomingCallNow toàn cục vào đầu file JS (sau init)
  const dismissFunc = `
window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Tiến hành đóng màn hình cuộc gọi đến & tắt toàn bộ chuông rung...");
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

  var popped = false;
  var ctx = window._incomingCallContext || (window._incomingRejectAction && window._incomingRejectAction.d);
  if (ctx) {
    try {
      var nav1 = A.b1(ctx, false);
      if (nav1) { nav1.dN(0); popped = true; }
    } catch(_) {}
    if (!popped) {
      try {
        var navRoot = A.b1(ctx, true);
        if (navRoot) { navRoot.dN(0); popped = true; }
      } catch(_) {}
    }
  }

  if (!popped && window._incomingNav) {
    try {
      window._incomingNav.dN(0);
      popped = true;
    } catch(_) {}
  }

  if (!popped && window._chatScreenContext) {
    try {
      var navChat = A.b1(window._chatScreenContext, true);
      if (navChat) { navChat.dN(0); popped = true; }
    } catch(_) {}
  }

  if (window._activeCallContext) {
    try {
      var navAct = A.b1(window._activeCallContext, false);
      if (navAct) navAct.dN(0);
      else {
        var navActRoot = A.b1(window._activeCallContext, true);
        if (navActRoot) navActRoot.dN(0);
      }
    } catch(_) {}
  }

  // Thử lại sau 120ms nếu Flutter đang render frame
  setTimeout(function() {
    var c2 = window._incomingCallContext || (window._incomingRejectAction && window._incomingRejectAction.d);
    if (c2) {
      try { A.b1(c2, false).dN(0); } catch(_) {
        try { A.b1(c2, true).dN(0); } catch(_) {}
      }
    } else if (window._incomingNav) {
      try { window._incomingNav.dN(0); } catch(_) {}
    }
    window._incomingCallShowing = false;
    window._incomingNav = null;
    window._incomingCallContext = null;
    window._incomingCallTimer = null;
    window._incomingCallTimerHolder = null;
    window._incomingRejectAction = null;
    window._activeCallContext = null;
  }, 120);

  window._incomingCallShowing = false;
};
`;

  if (!js.includes('window.dismissIncomingCallNow = function()')) {
    // Chèn sau convertAllToFastObject
    const hookPoint = 'convertAllToFastObject(w)';
    if (js.includes(hookPoint)) {
      js = js.replace(hookPoint, `${hookPoint};\n${dismissFunc}`);
      console.log(`✅ [JS] Đã gắn window.dismissIncomingCallNow vào ${jf}`);
    } else {
      js = `${dismissFunc}\n${js}`;
      console.log(`✅ [JS] Đã thêm window.dismissIncomingCallNow vào đầu ${jf}`);
    }
  } else {
    console.log(`ℹ️ [JS] Đã có window.dismissIncomingCallNow trong ${jf}`);
  }

  // d) Trong A.avH (khi User A bấm cúp máy màu đỏ): gửi kèm conversationId
  const oldAvH = 'r.cn("end_call",A.V(["connectedUserId",this.a],s,s))}this.b.$0()';
  const newAvH = 'var convId=(window._currentActiveChatConvId||"");r.cn("end_call",A.V(["connectedUserId",this.a,"conversationId",convId],s,s))}this.b.$0()';
  if (js.includes(oldAvH)) {
    js = js.replace(oldAvH, newAvH);
    console.log(`✅ [JS] Đã thêm conversationId vào nút cúp máy đỏ A.avH trong ${jf}`);
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

console.log('🎉 TOÀN BỘ BẢN VÁ ĐÃ HOÀN TẤT THÀNH CÔNG!');
