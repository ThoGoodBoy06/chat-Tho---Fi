const fs = require('fs');
const path = require('path');

console.log('🚀 [APPLY BULLETPROOF V10] Bắt đầu vá toàn diện cơ chế tắt cuộc gọi chuẩn Zalo/Messenger...');

const ROOT = path.resolve(__dirname, '..');

// 1. SỬA SOCKET HANDLER
const socketFiles = [
  path.join(ROOT, 'sockets', 'socketHandler.js'),
  path.join(ROOT, 'backend', 'sockets', 'socketHandler.js')
];

socketFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  let code = fs.readFileSync(sf, 'utf8');

  // Đảm bảo không phát call_ended ngược lại cho caller
  code = code.replace(
    /if\s*\(conversationId\)\s*\{\s*io\.to\(conversationId\)\.emit\("call_ended"[^\}]*\}\s*\}/g,
    `if (conversationId) {\n          socket.to(conversationId).emit("call_ended", { callerId: socket.userId, targetId, conversationId });\n        }`
  );

  fs.writeFileSync(sf, code, 'utf8');
  console.log(`✅ [Socket] Đã chuẩn hóa emit call_ended trong: ${sf}`);
});

// 2. ĐỊNH NGHĨA window.dismissIncomingCallNow CHUẨN XÁC TUYỆT ĐỐI
const safeDismissFuncV10 = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow V10] Tắt chuông & đóng hộp thoại an toàn...");

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

  // 2. NẾU HỘP THOẠI KHÔNG MỞ -> BỎ QUA, TUYỆT ĐỐI KHÔNG POP ĐỂ TRÁNH MÀN HÌNH TRẮNG
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    console.log("ℹ️ [dismissIncomingCallNow V10] Không có hộp thoại nào đang mở, bỏ qua.");
    return;
  }

  // 3. KHÓA SINGLE-POP: Đảm bảo chỉ pop đúng 1 lần duy nhất trong đời của 1 cuộc gọi
  if (window._isDismissingCall) return;
  window._isDismissingCall = true;

  var ctx = window._incomingCallContext;
  var actCtx = window._activeCallContext;

  // XÓA SẠCH TRẠNG THÁI NGAY TỨC THÌ ĐỂ KHÔNG BAO GIỜ POP LẦN THỨ HAI
  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingCallContext = null;
  window._incomingNav = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;

  // 4. THỰC HIỆN POP QUA ROOT NAVIGATOR (A.b1(ctx, !0)) CHUẨN XÁC 100% NHƯ NÚT TỪ CHỐI CỦA FLUTTER
  if (ctx) {
    try {
      var rootNav = A.b1(ctx, !0);
      if (rootNav && typeof rootNav.dN === "function") {
        rootNav.dN(0);
        console.log("✅ [V10] Đã đóng incoming dialog thành công qua rootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop incoming dialog:", e);
    }
  } else if (actCtx) {
    try {
      var actRootNav = A.b1(actCtx, !0);
      if (actRootNav && typeof actRootNav.dN === "function") {
        actRootNav.dN(0);
        console.log("✅ [V10] Đã đóng active call dialog thành công qua actRootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop active call dialog:", e);
    }
  }

  // Mở khóa sau 1 giây cho cuộc gọi tiếp theo
  setTimeout(function() {
    window._isDismissingCall = false;
  }, 1000);
};`;

// SỬA main.dart.js TRONG CẢ 3 THƯ MỤC
const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let js = fs.readFileSync(jf, 'utf8');

  // Tìm vị trí của window.dismissIncomingCallNow
  const startMarker = 'window.dismissIncomingCallNow = function()';
  const startIdx = js.indexOf(startMarker);
  if (startIdx !== -1) {
    // Tìm điểm kết thúc hàm
    const nextFunc = 'window._isDismissingCall = false;\n  }, 1000);\n};';
    const nextFunc2 = 'window._isDismissingCall = false;\n  }, 800);\n};';
    const oldEndMarker = 'doPopActive();\n  }\n};';
    
    let endIdx = -1;
    let fullEndIdx = -1;
    if (js.indexOf(nextFunc, startIdx) !== -1) {
      endIdx = js.indexOf(nextFunc, startIdx);
      fullEndIdx = endIdx + nextFunc.length;
    } else if (js.indexOf(nextFunc2, startIdx) !== -1) {
      endIdx = js.indexOf(nextFunc2, startIdx);
      fullEndIdx = endIdx + nextFunc2.length;
    } else if (js.indexOf(oldEndMarker, startIdx) !== -1) {
      endIdx = js.indexOf(oldEndMarker, startIdx);
      fullEndIdx = endIdx + oldEndMarker.length;
    }

    if (fullEndIdx !== -1) {
      js = js.substring(0, startIdx) + safeDismissFuncV10 + js.substring(fullEndIdx);
      console.log(`  ✅ Đã thay thế window.dismissIncomingCallNow V10 hoàn hảo!`);
    } else {
      console.warn(`  ⚠️ Không tìm thấy endMarker trong ${jf}`);
    }
  } else {
    console.warn(`  ⚠️ Không tìm thấy startMarker trong ${jf}`);
  }

  fs.writeFileSync(jf, js, 'utf8');
});

// 3. CẬP NHẬT index.html (CACHE BUSTER + SERVICE WORKER CALL_ENDED LISTENER)
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const newVersion = Date.now();
const swHook = `<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && (e.data.type === 'call_ended' || e.data.type === 'CALL_ENDED')) {
      if (window.dismissIncomingCallNow) window.dismissIncomingCallNow();
    }
  });
}
</script>`;

indexFiles.forEach(inf => {
  if (!fs.existsSync(inf)) return;
  let html = fs.readFileSync(inf, 'utf8');
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${newVersion}`);
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${newVersion}`);
  
  if (!html.includes('e.data.type === \'call_ended\'')) {
    html = html.replace('</body>', `${swHook}\n</body>`);
  }
  
  fs.writeFileSync(inf, html, 'utf8');
  console.log(`✅ Đã cập nhật cache buster v=${newVersion} + SW Listener cho: ${inf}`);
});

console.log(`\n🎉 [HOÀN TẤT V10] Toàn bộ bản vá đã được áp dụng thành công!`);
