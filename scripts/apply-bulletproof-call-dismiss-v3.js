const fs = require('fs');
const path = require('path');

console.log('🚀 [FIX V3] Tiến hành sửa triệt để: Gỡ bỏ Debug HUD, sửa toàn bộ A.b1(!0) và chống pop nhầm...');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

// 1. Safe dismissIncomingCallNow với cơ chế bảo vệ Route nghiêm ngặt:
// Chỉ pop khi route trên cùng THỰC SỰ là dialog cuộc gọi (IncomingCall, CallRoom, A.rZ)
const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu dừng chuông & đóng hộp thoại cuộc gọi...");

  // 1. Dừng ngay toàn bộ âm thanh chuông, rung, timer
  try { A.FS(); } catch(_) {}
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

  // 2. Kiểm tra nếu không có cuộc gọi nào đang hiển thị thì dừng
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    return;
  }

  // Đánh dấu false ngay lập tức để chống chạy đúp
  window._incomingCallShowing = false;
  window._activeCallShowing = false;

  var popped = false;

  // Hàm kiểm tra xem route trên đỉnh có đúng là dialog cuộc gọi không
  function isCallDialog(nav) {
    if (!nav || !nav.e) return false;
    try {
      var topEntry = null;
      if (typeof nav.e.aws === "function") {
        topEntry = nav.e.aws(0, A.lZ());
      }
      if (!topEntry && nav.e.a && Array.isArray(nav.e.a) && nav.e.a.length > 0) {
        topEntry = nav.e.a[nav.e.a.length - 1];
      }
      if (topEntry && topEntry.a) {
        var r = topEntry.a;
        if (r.au === "IncomingCall" || r.au === "CallRoom") return true;
        if (typeof A.rZ === "function" && r instanceof A.rZ) return true;
      }
    } catch(_) {}
    // Fallback: Nếu route array có hơn 1 route thì cho phép pop 1 route dialog
    if (nav.e && nav.e.a && Array.isArray(nav.e.a) && nav.e.a.length > 1) {
      return true;
    }
    return false;
  }

  // 3. Đóng IncomingCall Dialog qua Root Navigator
  var nav = window._incomingNav || (window._incomingCallContext ? A.b1(window._incomingCallContext, true) : null);
  if (nav && isCallDialog(nav)) {
    try {
      nav.dN(0);
      popped = true;
      console.log("✅ Đã pop đóng IncomingCall dialog thành công!");
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
        console.log("✅ Đã pop đóng CallRoom thành công!");
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

  // 1. Sửa hàm A.b1: fallback sang Root Navigator và chặn null.toString
  const oldB1 = '}else{if(r==null)r=a.lZ(t.uK)\ns=r}s.toString\nreturn s},';
  const newB1 = '}else{if(r==null)r=a.lZ(t.uK)\nif(r==null)r=a.atQ(t.uK)\ns=r}if(s!=null)s.toString\nreturn s},';
  if (js.includes(oldB1)) {
    js = js.replace(oldB1, newB1);
    console.log('  ✅ [A.b1] Đã sửa A.b1 fallback sang Root Navigator!');
  }

  // 2. Sửa A.avH (Nút Cúp máy màu đỏ trong phòng gọi CallRoom) gọi Root Navigator (!0 thay vì !1)
  // r=this.c\nif(A.b1(r,!1).rB())A.b1(r,!1).dN(0)},
  const oldAvH = 'r=this.c\nif(A.b1(r,!1).rB())A.b1(r,!1).dN(0)},';
  const newAvH = 'r=this.c\nif(A.b1(r,!0).rB())A.b1(r,!0).dN(0)},';
  if (js.includes(oldAvH)) {
    js = js.replace(oldAvH, newAvH);
    console.log('  ✅ [A.avH] Đã sửa nút Cúp máy trong CallRoom gọi Root Navigator (!0)!');
  } else if (js.includes('A.b1(r,!0).dN(0)')) {
    console.log('  ℹ️ [A.avH] Đã dùng Root Navigator trước đó.');
  }

  // 3. Sửa A.avD (Listener khi đối phương cúp máy trong CallRoom) gọi Root Navigator (!0 thay vì !1)
  // s=this.b\nif(A.b1(s,!1).rB())A.b1(s,!1).dN(0)},
  const oldAvD = 's=this.b\nif(A.b1(s,!1).rB())A.b1(s,!1).dN(0)},';
  const newAvD = 's=this.b\nif(A.b1(s,!0).rB())A.b1(s,!0).dN(0)},';
  if (js.includes(oldAvD)) {
    js = js.replace(oldAvD, newAvD);
    console.log('  ✅ [A.avD] Đã sửa CallRoom call_ended listener gọi Root Navigator (!0)!');
  }

  // 4. Sửa A.auN (Đóng modal) gọi Root Navigator (!0 thay vì !1)
  const oldAuN = 'return A.b1(s,!1).dN(0)},';
  const newAuN = 'return A.b1(s,!0).dN(0)},';
  if (js.includes(oldAuN)) {
    js = js.replace(oldAuN, newAuN);
    console.log('  ✅ [A.auN] Đã sửa A.auN gọi Root Navigator (!0)!');
  }

  // 5. Thay thế hàm window.dismissIncomingCallNow
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
      console.log('  ✅ [JS] Đã cập nhật safe window.dismissIncomingCallNow V3!');
    }
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// 6. GỠ BỎ HOÀN TOÀN ON-SCREEN DEBUG HUD KHỎI INDEX.HTML
const indexFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let raw = fs.readFileSync(f, 'utf8');
  let isCRLF = raw.includes('\r\n');
  let html = raw.replace(/\r\n/g, '\n');

  // Gỡ bỏ div #debug-call-hud và script logCallHUD
  const hudStartMarker = '<!-- CALL DEBUG ON-SCREEN HUD -->';
  const hudEndMarker = '</body>';
  const startIdx = html.indexOf(hudStartMarker);
  if (startIdx !== -1) {
    const bodyIdx = html.indexOf(hudEndMarker, startIdx);
    if (bodyIdx !== -1) {
      html = html.substring(0, startIdx) + '</body>' + html.substring(bodyIdx + 7);
      console.log(`✅ [Index] Đã GỠ BỎ HOÀN TOÀN On-Screen Debug HUD khỏi ${f}`);
    }
  }

  // Cập nhật Cache Buster
  html = html.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  html = html.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
  fs.writeFileSync(f, isCRLF ? html.replace(/\n/g, '\r\n') : html, 'utf8');
});

// 7. Cập nhật Cache Buster trong flutter_bootstrap.js
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

console.log('\n🎉 HOÀN TẤT TOÀN DIỆN FIX V3!');
