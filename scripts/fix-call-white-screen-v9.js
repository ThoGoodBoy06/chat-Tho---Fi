const fs = require('fs');
const path = require('path');

console.log('🚀 [FIX WHITE SCREEN V9] Sửa dứt điểm lỗi trắng màn hình khi kết thúc cuộc gọi...');

const ROOT = path.resolve(__dirname, '..');

// 1. SỬA SOCKET HANDLER: Dùng socket.to(conversationId) thay vì io.to(conversationId)
const socketFiles = [
  path.join(ROOT, 'sockets', 'socketHandler.js'),
  path.join(ROOT, 'backend', 'sockets', 'socketHandler.js')
];

socketFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  let code = fs.readFileSync(sf, 'utf8');
  
  const targetIoConv = 'if (conversationId) {\n          io.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId, conversationId });\n        }';
  const replaceSocketConv = 'if (conversationId) {\n          socket.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId, conversationId });\n        }';
  
  if (code.includes(targetIoConv)) {
    code = code.replace(targetIoConv, replaceSocketConv);
    fs.writeFileSync(sf, code, 'utf8');
    console.log(`✅ Đã sửa socket.to(conversationId) trong: ${sf}`);
  } else {
    const regex = /if\s*\(conversationId\)\s*\{\s*io\.to\(conversationId\)\.emit\("call_ended"[^\}]*\}\s*\}/;
    if (regex.test(code)) {
      code = code.replace(regex, `if (conversationId) {\n          socket.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId, conversationId });\n        }`);
      fs.writeFileSync(sf, code, 'utf8');
      console.log(`✅ Đã sửa regex socket.to(conversationId) trong: ${sf}`);
    } else {
      console.log(`ℹ️ Socket file đã chuẩn hoặc không cần sửa: ${sf}`);
    }
  }
});

// 2. SỬA main.dart.js TRONG CẢ 3 THƯ MỤC
const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const safeDismissFuncV9 = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow V9] Tắt chuông & dọn dẹp cuộc gọi an toàn...");

  // 1. DỪNG TOÀN BỘ ÂM THANH CHUÔNG, RUNG & MEDIA TỨC THÌ
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

  // Dừng tất cả thẻ audio và video trong DOM
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

  // CHỈ POP NẾU HỘP THOẠI ĐANG THỰC SỰ MỞ - TUYỆT ĐỐI KHÔNG POP NẾU ĐÃ ĐÓNG ĐỂ TRÁNH TRẮNG MÀN HÌNH
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    console.log("ℹ️ [dismissIncomingCallNow V9] Không có hộp thoại nào đang mở, không pop để bảo vệ giao diện.");
    return;
  }

  // Khóa chống lặp / debounce
  if (window._isDismissingCall) return;
  window._isDismissingCall = true;

  var popped = false;

  // Pop Incoming Call Dialog (chỉ pop đúng 1 lần nếu canPop rB() là true)
  if (window._incomingCallShowing) {
    var ctx = window._incomingCallContext || (window._incomingRejectAction && window._incomingRejectAction.d);
    if (ctx) {
      try {
        var nav1 = A.b1(ctx, false);
        if (nav1 && typeof nav1.rB === "function" && nav1.rB()) {
          nav1.dN(0);
          popped = true;
          console.log("✅ Đã đóng incoming dialog qua ctx (canPop)");
        }
      } catch(_) {}
    }
    if (!popped && window._incomingNav) {
      try {
        if (typeof window._incomingNav.rB === "function" && window._incomingNav.rB()) {
          window._incomingNav.dN(0);
          popped = true;
          console.log("✅ Đã đóng incoming dialog qua _incomingNav (canPop)");
        }
      } catch(_) {}
    }
  }

  // Pop Active CallRoom nếu đang trong phòng gọi
  if (!popped && window._activeCallShowing && window._activeCallContext) {
    try {
      var navAct = A.b1(window._activeCallContext, false);
      if (navAct && typeof navAct.rB === "function" && navAct.rB()) {
        navAct.dN(0);
        popped = true;
        console.log("✅ Đã đóng activeCall dialog (canPop)");
      }
    } catch(_) {}
  }

  // ĐẶT LẠI TRẠNG THÁI NGAY TỨC THÌ ĐỂ TUYỆT ĐỐI KHÔNG BAO GIỜ POP LẦN THỨ HAI
  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingNav = null;
  window._incomingCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;

  setTimeout(function() {
    window._isDismissingCall = false;
  }, 1000);
};`;

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let js = fs.readFileSync(jf, 'utf8');

  // Tìm vị trí của window.dismissIncomingCallNow
  const startMarker = 'window.dismissIncomingCallNow = function()';
  const endMarker = 'doPopActive();\n  }\n};';
  
  const startIdx = js.indexOf(startMarker);
  if (startIdx !== -1) {
    const endIdx = js.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
      const fullEndIdx = endIdx + endMarker.length;
      js = js.substring(0, startIdx) + safeDismissFuncV9 + js.substring(fullEndIdx);
      console.log(`  ✅ Đã thay thế window.dismissIncomingCallNow V9 an toàn không bị trắng màn hình!`);
    } else {
      console.warn(`  ⚠️ Không tìm thấy endMarker trong ${jf}`);
    }
  } else {
    console.warn(`  ⚠️ Không tìm thấy startMarker trong ${jf}`);
  }

  fs.writeFileSync(jf, js, 'utf8');
});

// 3. CẬP NHẬT CACHE BUSTER CHO index.html
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const newVersion = Date.now();
indexFiles.forEach(inf => {
  if (!fs.existsSync(inf)) return;
  let html = fs.readFileSync(inf, 'utf8');
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${newVersion}`);
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${newVersion}`);
  fs.writeFileSync(inf, html, 'utf8');
  console.log(`✅ Đã cập nhật cache buster v=${newVersion} cho: ${inf}`);
});

console.log(`\n🎉 [HOÀN TẤT V9] Đã vá dứt điểm lỗi trắng màn hình!`);
