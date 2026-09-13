const fs = require('fs');
const path = require('path');

console.log('🚀 [FIX V5] Áp dụng giải pháp dừng chuông tận gốc và pop chuẩn xác qua nav.rB()...');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu dừng chuông & đóng hộp thoại cuộc gọi...");

  // 1. DỪNG TRIỆT ĐỂ TOÀN BỘ ÂM THANH CHUÔNG & RUNG
  try { A.FS(); } catch(_) {}
  try { if (typeof $ !== "undefined" && $.aJx) $.aJx().cs(0); } catch(_) {}
  try { if (typeof $ !== "undefined" && $.aJy) $.aJy().cs(0); } catch(_) {}
  try { if (typeof $ !== "undefined") $.aor = false; } catch(_) {}
  try { if (typeof $ !== "undefined") $.aos = false; } catch(_) {}
  try { if (navigator.vibrate) navigator.vibrate(0); } catch(_) {}
  if (window.stopTestCallSound) { try { window.stopTestCallSound(); } catch(_) {} }

  // Hủy các timer đổ chuông
  try {
    if (window._incomingCallTimer && window._incomingCallTimer.a) window._incomingCallTimer.a.ai(0);
    if (window._incomingCallTimerHolder && window._incomingCallTimerHolder.a) window._incomingCallTimerHolder.a.ai(0);
  } catch(_) {}

  // Dừng tất cả thẻ <audio> trong DOM
  try {
    var allAudios = document.getElementsByTagName("audio");
    for (var i = 0; i < allAudios.length; i++) {
      try {
        allAudios[i].pause();
        allAudios[i].currentTime = 0;
      } catch(_) {}
    }
  } catch(_) {}

  var _ra = document.getElementById("remoteAudioPlayer");
  if (_ra) { try { _ra.pause(); _ra.srcObject = null; } catch(_) {} }
  var _lv = document.getElementById("localVideoPlayer");
  if (_lv) { try { _lv.pause(); _lv.srcObject = null; _lv.remove(); } catch(_) {} }
  var _rv = document.getElementById("remoteVideoPlayer");
  if (_rv) { try { _rv.pause(); _rv.srcObject = null; _rv.remove(); } catch(_) {} }

  // 2. Kiểm tra nếu không có cuộc gọi nào đang hiển thị thì dừng
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    return;
  }

  // Đánh dấu false ngay lập tức để chống chạy đúp
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

const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let raw = fs.readFileSync(jf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let js = raw.replace(/\r\n/g, '\n');

  // Thêm dừng chuông trực tiếp vào nút "Từ chối" (A.ave)
  const oldAve = 'A.ave.prototype={\n$0(){var s,r=this,q=r.a.a\nwindow._incomingCallContext=null;window._incomingCallTimer=null;';
  const newAve = 'A.ave.prototype={\n$0(){var s,r=this,q=r.a.a\ntry{A.FS();}catch(_){}\ntry{if($.aJx)$.aJx().cs(0);}catch(_){}\nwindow._incomingCallShowing=false;window._incomingCallContext=null;window._incomingCallTimer=null;';
  if (js.includes(oldAve)) {
    js = js.replace(oldAve, newAve);
    console.log('  ✅ [A.ave] Đã gắn dừng chuông trực tiếp vào nút Từ chối!');
  }

  // Thay thế hàm window.dismissIncomingCallNow V5
  const startIdx = js.indexOf('window.dismissIncomingCallNow = function');
  if (startIdx !== -1) {
    const endMarker = 'window._activeCallContext = null;\n};';
    const endMarker2 = 'window._incomingCallTimer = null;\n};';
    let endIdx = -1;
    if (js.indexOf(endMarker, startIdx) !== -1) endIdx = js.indexOf(endMarker, startIdx) + endMarker.length;
    else if (js.indexOf(endMarker2, startIdx) !== -1) endIdx = js.indexOf(endMarker2, startIdx) + endMarker2.length;
    else {
      const fastObjIdx = js.indexOf('convertToFastObject($);', startIdx);
      if (fastObjIdx !== -1) endIdx = fastObjIdx;
    }

    if (endIdx !== -1) {
      js = js.substring(0, startIdx) + safeDismissFunc + '\n\n' + js.substring(endIdx);
      console.log('  ✅ [JS] Đã cập nhật safe window.dismissIncomingCallNow V5!');
    }
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// Cập nhật Cache Buster trong flutter.js
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
  console.log(`✅ [flutter.js] Đã cập nhật cache buster v=${now} cho ${fj}`);
});

// Cập nhật Cache Buster trong flutter_bootstrap.js
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
  console.log(`✅ [Bootstrap] Đã cập nhật cache buster v=${now} cho ${bf}`);
});

// Cập nhật Cache Buster trong index.html
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
  console.log(`✅ [Index] Đã cập nhật cache buster v=${now} cho ${f}`);
});

console.log('\n🎉 HOÀN TẤT TOÀN DIỆN FIX V5!');
