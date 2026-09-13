const fs = require('fs');
const path = require('path');

console.log('🚀 Đang cập nhật cơ chế đóng cuộc gọi chính xác 100%...');

const ROOT = path.resolve(__dirname, '..');
const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const exactDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Tắt chuông & đóng hộp thoại cuộc gọi đến...");
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

  // 1. Đóng hộp thoại cuộc gọi đến bằng dialogContext (giống hệt nút Từ chối A.ave)
  var ctx = window._incomingCallContext || (window._incomingRejectAction && window._incomingRejectAction.d);
  if (ctx) {
    try {
      A.b1(ctx, false).dN(0);
      console.log("✅ [dismissIncomingCallNow] Đã đóng incoming dialog thành công qua dialogContext!");
    } catch(e) {
      console.warn("Lỗi đóng incoming dialog qua ctx:", e);
      if (window._incomingNav) {
        try {
          window._incomingNav.dN(0);
          console.log("✅ [dismissIncomingCallNow] Đã đóng incoming dialog qua _incomingNav!");
        } catch(_) {}
      }
    }
  } else if (window._incomingCallShowing && window._incomingNav) {
    try {
      window._incomingNav.dN(0);
      console.log("✅ [dismissIncomingCallNow] Đã đóng incoming dialog qua _incomingNav!");
    } catch(_) {}
  }

  // 2. Nếu đang trong phòng gọi activeCall (_activeCallContext)
  if (window._activeCallShowing && window._activeCallContext) {
    try {
      A.b1(window._activeCallContext, false).dN(0);
      console.log("✅ [dismissIncomingCallNow] Đã đóng activeCall dialog thành công!");
    } catch(_) {}
  }

  // 3. Reset toàn bộ cờ để không bị pop lần thứ 2
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

  const oldFuncRegex = /window\.dismissIncomingCallNow\s*=\s*function\(\)\s*\{[\s\S]*?window\._activeCallContext\s*=\s*null;\s*\};/m;
  if (oldFuncRegex.test(js)) {
    js = js.replace(oldFuncRegex, exactDismissFunc);
    console.log(`✅ [JS] Đã thay thế exact window.dismissIncomingCallNow trong ${jf}`);
  } else {
    console.warn(`⚠️ [JS] Không khớp oldFuncRegex trong ${jf}`);
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// Update cache buster in index.html
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

console.log('🎉 Hoàn tất vá đóng cuộc gọi chính xác!');
