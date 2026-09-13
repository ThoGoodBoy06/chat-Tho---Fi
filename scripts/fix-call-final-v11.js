const fs = require('fs');
const path = require('path');

console.log('🚀 [FINAL V11] Sửa triệt để đồng bộ cuộc gọi và cập nhật toàn diện cache-buster...');

const ROOT = path.resolve(__dirname, '..');
const timestamp = Date.now();

// =========================================================================
// 1. CẬP NHẬT window.dismissIncomingCallNow TRONG main.dart.js
// Sử dụng chính xác window._incomingRejectAction.$0() của Flutter
// =========================================================================
const safeDismissFuncV11 = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow V11] Tắt chuông & đóng hộp thoại an toàn...");

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

  // 2. NẾU HỘP THOẠI KHÔNG MỞ -> BỎ QUA, TUYỆT ĐỐI KHÔNG POP ĐỂ TRÁNH TRẮNG MÀN HÌNH
  var hasIncoming = window._incomingCallShowing || window._incomingCallContext || window._incomingRejectAction;
  var hasActive = window._activeCallShowing || window._activeCallContext;

  if (!hasIncoming && !hasActive) {
    console.log("ℹ️ [dismissIncomingCallNow V11] Không có hộp thoại nào đang mở, bỏ qua.");
    return;
  }

  // Khóa single-pop
  if (window._isDismissingCall) return;
  window._isDismissingCall = true;

  var rejectAction = window._incomingRejectAction;
  var ctx = window._incomingCallContext;
  var inNav = window._incomingNav;
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

  var dismissed = false;

  // Cách 1: Gọi trực tiếp Action Từ chối chuẩn gốc của Flutter (chính là code chạy khi bấm nút Từ chối màu đỏ)
  if (rejectAction && typeof rejectAction.$0 === "function") {
    try {
      rejectAction.$0();
      dismissed = true;
      console.log("✅ [V11] Đã đóng incoming dialog thành công qua Flutter rejectAction.$0()!");
    } catch(e) {
      console.warn("Lỗi rejectAction.$0:", e);
    }
  }

  // Cách 2: Nếu chưa đóng, pop qua rootNav của ctx
  if (!dismissed && ctx) {
    try {
      var rootNav = A.b1(ctx, !0);
      if (rootNav && typeof rootNav.dN === "function") {
        rootNav.dN(0);
        dismissed = true;
        console.log("✅ [V11] Đã đóng incoming dialog thành công qua rootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop ctx rootNav:", e);
    }
  }

  // Cách 3: Pop qua inNav
  if (!dismissed && inNav) {
    try {
      if (typeof inNav.dN === "function") {
        inNav.dN(0);
        dismissed = true;
        console.log("✅ [V11] Đã đóng incoming dialog thành công qua inNav.dN(0)!");
      }
    } catch(e) {}
  }

  // Cách 4: Pop CallRoom đang đàm thoại nếu có
  if (!dismissed && actCtx) {
    try {
      var actRootNav = A.b1(actCtx, !0);
      if (actRootNav && typeof actRootNav.dN === "function") {
        actRootNav.dN(0);
        console.log("✅ [V11] Đã đóng activeCall dialog thành công qua actRootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop active call dialog:", e);
    }
  }

  setTimeout(function() {
    window._isDismissingCall = false;
  }, 1000);
};`;

const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let js = fs.readFileSync(jf, 'utf8');

  const startMarker = 'window.dismissIncomingCallNow = function()';
  const startIdx = js.indexOf(startMarker);
  if (startIdx !== -1) {
    const nextFunc = 'window._isDismissingCall = false;\n  }, 1000);\n};';
    const nextFunc2 = 'window._isDismissingCall = false;\n  }, 800);\n};';
    const oldEndMarker = 'doPopActive();\n  }\n};';
    
    let fullEndIdx = -1;
    if (js.indexOf(nextFunc, startIdx) !== -1) {
      fullEndIdx = js.indexOf(nextFunc, startIdx) + nextFunc.length;
    } else if (js.indexOf(nextFunc2, startIdx) !== -1) {
      fullEndIdx = js.indexOf(nextFunc2, startIdx) + nextFunc2.length;
    } else if (js.indexOf(oldEndMarker, startIdx) !== -1) {
      fullEndIdx = js.indexOf(oldEndMarker, startIdx) + oldEndMarker.length;
    }

    if (fullEndIdx !== -1) {
      js = js.substring(0, startIdx) + safeDismissFuncV11 + js.substring(fullEndIdx);
      console.log(`  ✅ Đã thay thế window.dismissIncomingCallNow V11 hoàn hảo!`);
    }
  }

  fs.writeFileSync(jf, js, 'utf8');
});

// =========================================================================
// 2. CẬP NHẬT flutter_bootstrap.js ĐỂ BROWSER LUÔN TẢI main.dart.js MỚI NHẤT
// =========================================================================
const bootstrapFiles = [
  path.join(ROOT, 'public', 'flutter_bootstrap.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let code = fs.readFileSync(bf, 'utf8');
  // Thay thế tất cả chuỗi main.dart.js?v=... thành timestamp mới
  code = code.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${timestamp}`);
  fs.writeFileSync(bf, code, 'utf8');
  console.log(`✅ [Bootstrap] Đã cập nhật cache buster v=${timestamp} cho: ${bf}`);
});

// =========================================================================
// 3. CẬP NHẬT index.html VỚI TIMESTAMP MỚI
// =========================================================================
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(inf => {
  if (!fs.existsSync(inf)) return;
  let html = fs.readFileSync(inf, 'utf8');
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${timestamp}`);
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${timestamp}`);
  fs.writeFileSync(inf, html, 'utf8');
  console.log(`✅ [Index] Đã cập nhật cache buster v=${timestamp} cho: ${inf}`);
});

console.log(`\n🎉 [HOÀN TẤT V11] Toàn bộ hệ thống đã được đồng bộ chuẩn xác!`);
