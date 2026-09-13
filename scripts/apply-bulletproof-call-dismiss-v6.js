const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

console.log('🚀 [BULLETPROOF V6] Bắt đầu triển khai giải pháp toàn diện từ A - Z...');

// =========================================================================
// 1. VÁ sockets/socketHandler.js & backend/sockets/socketHandler.js
// =========================================================================
const socketFiles = [
  path.join(ROOT, 'sockets', 'socketHandler.js'),
  path.join(ROOT, 'backend', 'sockets', 'socketHandler.js')
];

socketFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  console.log(`\n🔍 Đang xử lý: ${sf}`);
  let code = fs.readFileSync(sf, 'utf8');

  // Thêm global.endCallCore nếu chưa có
  if (!code.includes('global.endCallCore =')) {
    const endMarker = 'module.exports = { registerSocketHandlers';
    if (code.includes(endMarker)) {
      const globalCoreSnippet = `
// 🌟 Hàm toàn cục hỗ trợ HTTP Fallback khi client cúp máy
async function handleEndCallCore({ callerId, targetId, conversationId }) {
  console.log(\`🔴 [handleEndCallCore] Phát call_ended cho targetId: \${targetId}, callerId: \${callerId}, room: \${conversationId}\`);
  if (global.io) {
    if (targetId) {
      global.io.to(targetId).emit("call_ended", { callerId, targetId, conversationId });
      const targetSocketId = userSockets.get(targetId);
      if (targetSocketId && targetSocketId !== targetId) {
        global.io.to(targetSocketId).emit("call_ended", { callerId, targetId, conversationId });
      }
      activeCalls.delete(targetId);
    }
    if (conversationId) {
      global.io.to(conversationId).emit("call_ended", { callerId, targetId, conversationId });
    }
  }
  if (callerId) {
    activeCalls.delete(callerId);
  }
}
global.endCallCore = handleEndCallCore;

`;
      code = code.replace(endMarker, globalCoreSnippet + endMarker);
      fs.writeFileSync(sf, code, 'utf8');
      console.log(`  ✅ Đã gắn global.endCallCore vào ${sf}`);
    }
  } else {
    console.log(`  ℹ️ Đã có global.endCallCore trong ${sf}`);
  }
});

// =========================================================================
// 2. VÁ server.js & backend/server.js: THÊM REST API POST /api/call/end
// =========================================================================
const serverFiles = [
  path.join(ROOT, 'server.js'),
  path.join(ROOT, 'backend', 'server.js')
];

serverFiles.forEach(svf => {
  if (!fs.existsSync(svf)) return;
  console.log(`\n🔍 Đang xử lý: ${svf}`);
  let code = fs.readFileSync(svf, 'utf8');

  // Thêm endpoint /api/call/end nếu chưa có
  if (!code.includes('/api/call/end')) {
    const targetRoute = 'app.post("/api/client_debug"';
    const apiCallEnd = `// Endpoint HTTP Fallback: Kết thúc cuộc gọi chắc chắn 100%
app.post("/api/call/end", async (req, res) => {
    try {
        const { callerId, connectedUserId, conversationId } = req.body || {};
        console.log(\`🔴 [HTTP API /api/call/end] Nhận lệnh kết thúc: caller=\${callerId}, partner=\${connectedUserId}, room=\${conversationId}\`);
        if (global.endCallCore) {
            await global.endCallCore({ callerId, targetId: connectedUserId, conversationId });
        }
        res.status(200).json({ status: "ok" });
    } catch (e) {
        console.error("Lỗi /api/call/end:", e);
        res.status(500).json({ error: e.message });
    }
});

`;
    if (code.includes(targetRoute)) {
      code = code.replace(targetRoute, apiCallEnd + targetRoute);
      console.log(`  ✅ Đã thêm endpoint POST /api/call/end vào ${svf}`);
    }
  } else {
    console.log(`  ℹ️ Đã có endpoint POST /api/call/end trong ${svf}`);
  }

  // Đảm bảo flutter.js không bị cache
  if (code.includes('basename.includes("main.dart")') && !code.includes('basename === "flutter.js"')) {
    code = code.replace('basename.includes("main.dart")', 'basename === "flutter.js" || basename.includes("main.dart")');
    console.log(`  ✅ Đã cập nhật no-cache cho flutter.js trong ${svf}`);
  }

  fs.writeFileSync(svf, code, 'utf8');
});

// =========================================================================
// 3. VÁ main.dart.js (3 thư mục)
// =========================================================================
const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const bulletproofDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu dừng chuông & đóng hộp thoại cuộc gọi...");

  // 1. DỪNG TRIỆT ĐỂ TOÀN BỘ ÂM THANH CHUÔNG & RUNG TỨC THÌ
  try { A.FS(); } catch(_) {}
  try {
    if (typeof $ !== "undefined") {
      if ($.aJx) $.aJx().cs(0);
      if ($.aJy) $.aJy().cs(0);
      $.aor = false;
      $.aos = false;
    }
  } catch(_) {}
  try { if (navigator.vibrate) navigator.vibrate(0); } catch(_) {}
  if (window.stopTestCallSound) { try { window.stopTestCallSound(); } catch(_) {} }

  // Hủy các timer đổ chuông
  try {
    if (window._incomingCallTimer && window._incomingCallTimer.a) window._incomingCallTimer.a.ai(0);
    if (window._incomingCallTimerHolder && window._incomingCallTimerHolder.a) window._incomingCallTimerHolder.a.ai(0);
  } catch(_) {}

  // Dừng tất cả thẻ <audio> và <video> trong DOM
  try {
    var allMedia = document.querySelectorAll("audio, video");
    for (var i = 0; i < allMedia.length; i++) {
      try {
        allMedia[i].pause();
        allMedia[i].currentTime = 0;
        allMedia[i].srcObject = null;
      } catch(_) {}
    }
  } catch(_) {}

  var _ra = document.getElementById("remoteAudioPlayer");
  if (_ra) { try { _ra.pause(); _ra.srcObject = null; } catch(_) {} }
  var _lv = document.getElementById("localVideoPlayer");
  if (_lv) { try { _lv.pause(); _lv.srcObject = null; _lv.remove(); } catch(_) {} }
  var _rv = document.getElementById("remoteVideoPlayer");
  if (_rv) { try { _rv.pause(); _rv.srcObject = null; _rv.remove(); } catch(_) {} }

  // 2. CHỐNG POP ĐÚP / POP QUÁ ĐÀ:
  // Khóa 2.5s để bảo vệ ChatScreen không bao giờ bị pop nhầm
  if (window._callDismissLock) {
    console.log("ℹ️ [dismissIncomingCallNow] Đã xử lý đóng trong chu kỳ này, bỏ qua để chống trắng màn hình.");
    return;
  }
  window._callDismissLock = true;
  setTimeout(function() { window._callDismissLock = false; }, 2500);

  window._incomingCallShowing = false;
  window._activeCallShowing = false;

  var popped = false;

  // 3. Đóng IncomingCall Dialog qua context của chính dialog
  if (window._incomingCallContext) {
    try {
      var nav = A.b1(window._incomingCallContext, true);
      if (nav && typeof nav.rB === "function" && nav.rB()) {
        nav.dN(0);
        popped = true;
        console.log("✅ [1] Đã pop đóng IncomingCall qua _incomingCallContext!");
      }
    } catch(e) {
      console.warn("Lỗi pop _incomingCallContext:", e);
    }
  }

  // 4. Đóng IncomingCall qua _incomingNav nếu chưa pop được
  if (!popped && window._incomingNav) {
    try {
      var nav2 = window._incomingNav;
      if (nav2 && typeof nav2.rB === "function" && nav2.rB()) {
        nav2.dN(0);
        popped = true;
        console.log("✅ [2] Đã pop đóng IncomingCall qua _incomingNav!");
      }
    } catch(e) {
      console.warn("Lỗi pop _incomingNav:", e);
    }
  }

  // 5. Đóng CallRoom (Active Call) nếu đang hiển thị
  if (!popped && window._activeCallContext) {
    try {
      var actNav = A.b1(window._activeCallContext, true);
      if (actNav && typeof actNav.rB === "function" && actNav.rB()) {
        actNav.dN(0);
        popped = true;
        console.log("✅ [3] Đã pop đóng CallRoom qua _activeCallContext!");
      }
    } catch(e) {
      console.warn("Lỗi pop _activeCallContext:", e);
    }
  }

  // Gửi telemetry kết quả về server
  try {
    fetch('/api/client_debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismissIncomingCallNow_result', popped: popped, t: Date.now() })
    }).catch(function() {});
  } catch(_) {}

  // Dọn dẹp sạch sẽ toàn bộ biến cờ và tham chiếu
  window._incomingNav = null;
  window._incomingCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;
};`;

// Đoạn code mới cho A.avH (Nút đỏ Cúp máy của Caller)
const newAvH = `A.avH.prototype={
$0(){
  var s, r = $.bj;
  var targetId = this.a || window._currentCallPartnerId || "";
  var convId = (window._currentActiveChatConvId || "");
  console.log("🔴 [Caller cúp máy] Đang cúp máy tới partner:", targetId);
  try { A.FS(); } catch(_) {}
  try { if (typeof $ !== "undefined" && $.aJy) $.aJy().cs(0); } catch(_) {}
  try { if (typeof $ !== "undefined") $.aos = false; } catch(_) {}
  if (r != null) {
    s = t.N;
    r.cn("end_call", A.V(["connectedUserId", targetId, "conversationId", convId], s, s));
  }
  try {
    fetch('/api/call/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ callerId: (window._currentUserId || ""), connectedUserId: targetId, conversationId: convId })
    }).catch(function() {});
  } catch(_) {}
  try { this.b.$0(); } catch(_) {}
  try {
    r = this.c;
    var nav = A.b1(r, !0);
    if (nav && nav.rB()) nav.dN(0);
  } catch(e) {
    console.warn("Lỗi đóng CallRoom:", e);
  }
},
$S:0}`;

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let raw = fs.readFileSync(jf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let js = raw.replace(/\r\n/g, '\n');

  // a) Lưu window._currentCallPartnerId khi gọi VI
  const oldVI = 'this.VI(a,!0,c,j.b,s)';
  const newVI = 'window._currentCallPartnerId=s;this.VI(a,!0,c,j.b,s)';
  if (js.includes(oldVI) && !js.includes(newVI)) {
    js = js.replace(oldVI, newVI);
    console.log('  ✅ Đã gắn window._currentCallPartnerId vào _startCall!');
  }

  // b) Thay thế A.avH.prototype
  const avHStart = 'A.avH.prototype={';
  const avHEnd = '$S:0}\nA.avI.prototype={';
  const startPos = js.indexOf(avHStart);
  if (startPos !== -1) {
    const endPos = js.indexOf(avHEnd, startPos);
    if (endPos !== -1) {
      js = js.substring(0, startPos) + newAvH + '\n' + js.substring(endPos + '$S:0}\n'.length);
      console.log('  ✅ Đã nâng cấp A.avH (Caller End Call + HTTP Fallback + Dừng tút tút)!');
    }
  }

  // c) Thay thế window.dismissIncomingCallNow
  const dismStart = js.indexOf('window.dismissIncomingCallNow = function');
  if (dismStart !== -1) {
    const endMarker = 'window._activeCallContext = null;\n};';
    const endMarker2 = 'window._incomingCallTimer = null;\n};';
    let dismEnd = -1;
    if (js.indexOf(endMarker, dismStart) !== -1) dismEnd = js.indexOf(endMarker, dismStart) + endMarker.length;
    else if (js.indexOf(endMarker2, dismStart) !== -1) dismEnd = js.indexOf(endMarker2, dismStart) + endMarker2.length;
    else {
      const fastObjIdx = js.indexOf('convertToFastObject($);', dismStart);
      if (fastObjIdx !== -1) dismEnd = fastObjIdx;
    }

    if (dismEnd !== -1) {
      js = js.substring(0, dismStart) + bulletproofDismissFunc + '\n\n' + js.substring(dismEnd);
      console.log('  ✅ Đã cập nhật safe window.dismissIncomingCallNow V6!');
    }
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// =========================================================================
// 4. CẬP NHẬT CACHE BUSTER CHO FLUTTER.JS, FLUTTER_BOOTSTRAP.JS, INDEX.HTML
// =========================================================================
const flutterJsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'flutter.js'),
  path.join(ROOT, 'public', 'flutter.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'flutter.js')
];

flutterJsFiles.forEach(fj => {
  if (!fs.existsSync(fj)) return;
  let code = fs.readFileSync(fj, 'utf8');
  code = code.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  fs.writeFileSync(fj, code, 'utf8');
  console.log(`✅ [flutter.js] Cập nhật cache buster v=${now} cho ${fj}`);
});

const bootstrapFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(ROOT, 'public', 'flutter_bootstrap.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let code = fs.readFileSync(bf, 'utf8');
  code = code.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  fs.writeFileSync(bf, code, 'utf8');
  console.log(`✅ [Bootstrap] Cập nhật cache buster v=${now} cho ${bf}`);
});

const indexFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let raw = fs.readFileSync(f, 'utf8');
  raw = raw.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  raw = raw.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
  raw = raw.replace(/flutter\.js(\?v=\d+)?/g, `flutter.js?v=${now}`);
  fs.writeFileSync(f, raw, 'utf8');
  console.log(`✅ [Index] Cập nhật cache buster v=${now} cho ${f}`);
});

console.log('\n🎉 HOÀN TẤT TRIỂN KHAI BULLETPROOF V6 TỪ A - Z!');
