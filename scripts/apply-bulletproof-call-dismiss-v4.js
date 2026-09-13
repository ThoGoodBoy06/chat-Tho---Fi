const fs = require('fs');
const path = require('path');

console.log('🚀 [FIX V4] Sửa chuẩn xác r.d9 ("IncomingCall" / "CallRoom"), dừng toàn bộ audio DOM và cập nhật cache buster cho flutter.js...');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu dừng chuông & đóng hộp thoại cuộc gọi...");

  // 1. Dừng ngay toàn bộ âm thanh chuông (SoundService, HTML audio, rung, timer)
  try { A.FS(); } catch(_) {}
  try { $.aor = false; } catch(_) {}
  try { if (navigator.vibrate) navigator.vibrate(0); } catch(_) {}
  if (window.stopTestCallSound) { try { window.stopTestCallSound(); } catch(_) {} }
  try {
    if (window._incomingCallTimer && window._incomingCallTimer.a) window._incomingCallTimer.a.ai(0);
    if (window._incomingCallTimerHolder && window._incomingCallTimerHolder.a) window._incomingCallTimerHolder.a.ai(0);
  } catch(_) {}

  // Dừng TẤT CẢ các thẻ <audio> trên toàn bộ DOM (triệt tiêu chuông trên Safari/iOS)
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

  // 2. Kiểm tra trạng thái hiển thị
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    return;
  }

  // Đánh dấu false ngay lập tức để chống chạy đúp
  window._incomingCallShowing = false;
  window._activeCallShowing = false;

  var popped = false;

  // Hàm kiểm tra xem route trên đỉnh có đúng là dialog cuộc gọi không
  // Lưu ý: Trong RawDialogRoute của Flutter minified, r.d9 là barrierLabel ("IncomingCall" / "CallRoom")!
  function isCallDialog(nav) {
    if (!nav) return false;
    // Kiểm tra canPop() qua nav.rB()
    try {
      if (typeof nav.rB === "function" && !nav.rB()) {
        return false; // Chỉ còn 1 route thì tuyệt đối không pop
      }
    } catch(_) {}

    // Kiểm tra tên route trên đỉnh (d9 === "IncomingCall" || d9 === "CallRoom")
    try {
      if (nav.e && typeof nav.e.aws === "function") {
        var topEntry = nav.e.aws(0, A.lZ());
        if (topEntry && topEntry.a) {
          var r = topEntry.a;
          if (r.d9 === "IncomingCall" || r.d9 === "CallRoom") {
            return true;
          }
        }
      }
    } catch(_) {}

    // Fallback an toàn: Nếu canPop() trả về true thì cho phép pop 1 route dialog
    try {
      if (typeof nav.rB === "function" && nav.rB()) {
        return true;
      }
    } catch(_) {}

    return false;
  }

  // 3. Đóng IncomingCall Dialog qua Root Navigator
  var nav = window._incomingNav || (window._incomingCallContext ? A.b1(window._incomingCallContext, true) : null);
  if (nav && isCallDialog(nav)) {
    try {
      nav.dN(0);
      popped = true;
      console.log("✅ [3] Đã pop đóng IncomingCall dialog thành công!");
    } catch(e) {
      console.warn("Lỗi pop IncomingCall:", e);
    }
  }

  // 4. Đóng CallRoom (Active Call) nếu đang hiển thị
  if (!popped && window._activeCallContext) {
    try {
      var actNav = A.b1(window._activeCallContext, true);
      if (actNav && isCallDialog(actNav)) {
        actNav.dN(0);
        popped = true;
        console.log("✅ [4] Đã pop đóng CallRoom thành công!");
      }
    } catch(e) {
      console.warn("Lỗi pop CallRoom:", e);
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

  // Thay thế hàm window.dismissIncomingCallNow V4
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
      console.log('  ✅ [JS] Đã cập nhật safe window.dismissIncomingCallNow V4!');
    }
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// Cập nhật Cache Buster trong flutter.js (Rất quan trọng cho Safari iOS!)
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

console.log('\n🎉 HOÀN TẤT TOÀN DIỆN FIX V4!');
