const fs = require('fs');
const path = require('path');

console.log('🚀 [FIX V2] Bắt đầu sửa triệt để lỗi r.toString null và đóng dialog cuộc gọi qua Root Navigator...');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  if (window.logCallHUD) {
    window.logCallHUD("🔴 [1] Nhận lệnh cúp máy -> Đang tắt chuông & đóng hộp thoại...", "#f59e0b");
  }
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu dừng chuông & đóng hộp thoại cuộc gọi...");

  // 1. Dừng ngay toàn bộ âm thanh chuông, rung, timer
  try { A.FS(); if (window.logCallHUD) window.logCallHUD("🔇 [2] Đã dừng chuông SoundService A.FS()", "#94a3b8"); } catch(e) { if (window.logCallHUD) window.logCallHUD("⚠️ Lỗi tắt chuông A.FS(): " + e, "#f87171"); }
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

  // 2. Kiểm tra nếu hộp thoại không hiển thị thì bỏ qua
  if (!window._incomingCallShowing && !window._activeCallShowing) {
    if (window.logCallHUD) {
      window.logCallHUD("ℹ️ [3] Hộp thoại không ở trạng thái hiển thị (showing=false)", "#94a3b8");
    }
    return;
  }

  // ĐÁNH DẤU FALSE NGAY LẬP TỨC ĐỂ CHỐNG POP LẦN 2
  window._incomingCallShowing = false;
  window._activeCallShowing = false;

  var popped = false;

  // 3. ĐÓNG DIALOG QUA window._incomingNav (Root Navigator đã lưu lúc mở showGeneralDialog)
  if (window._incomingNav) {
    try {
      var nav = window._incomingNav;
      var canSafePop = true;
      if (nav.e && nav.e.a && Array.isArray(nav.e.a)) {
        if (nav.e.a.length <= 1) {
          canSafePop = false;
          if (window.logCallHUD) window.logCallHUD("⚠️ Route count <= 1, hủy pop để không trắng màn hình!", "#f87171");
        }
      }
      if (canSafePop) {
        nav.dN(0);
        popped = true;
        if (window.logCallHUD) window.logCallHUD("✅ [3] ĐÃ POP ĐÓNG DIALOG THÀNH CÔNG QUA _incomingNav (Root)!", "#4ade80");
      }
    } catch(e) {
      if (window.logCallHUD) window.logCallHUD("❌ Lỗi pop _incomingNav: " + e, "#f87171");
    }
  }

  // 4. Nếu chưa pop được và có context của dialog
  if (!popped && window._incomingCallContext) {
    try {
      var rootNav = A.b1(window._incomingCallContext, true);
      if (rootNav) {
        var canSafePop = true;
        if (rootNav.e && rootNav.e.a && Array.isArray(rootNav.e.a) && rootNav.e.a.length <= 1) {
          canSafePop = false;
        }
        if (canSafePop) {
          rootNav.dN(0);
          popped = true;
          if (window.logCallHUD) window.logCallHUD("✅ [4] ĐÃ POP ĐÓNG DIALOG QUA _incomingCallContext (Root)!", "#4ade80");
        }
      }
    } catch(e) {
      if (window.logCallHUD) window.logCallHUD("❌ Lỗi pop rootNav: " + e, "#f87171");
    }
  }

  // 5. Nếu đang trong phòng gọi activeCall (_activeCallContext)
  if (!popped && window._activeCallContext) {
    try {
      var navAct = A.b1(window._activeCallContext, true);
      if (navAct) {
        navAct.dN(0);
        popped = true;
        if (window.logCallHUD) window.logCallHUD("✅ [5] ĐÃ POP ĐÓNG activeCall!", "#4ade80");
      }
    } catch(_) {}
  }

  // Gửi telemetry kết quả về server
  try {
    fetch('/api/client_debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismissIncomingCallNow_result', popped: popped, t: Date.now() })
    }).catch(function() {});
  } catch(_) {}

  // Dọn dẹp sạch sẽ toàn bộ biến cờ và tham chiếu để không bao giờ pop lần 2
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

  // 1. Sửa hàm A.b1: Không bao giờ crash 'r.toString' khi Navigator null, tự động fallback sang Root Navigator
  const oldB1 = '}else{if(r==null)r=a.lZ(t.uK)\ns=r}s.toString\nreturn s},';
  const newB1 = '}else{if(r==null)r=a.lZ(t.uK)\nif(r==null)r=a.atQ(t.uK)\ns=r}if(s!=null)s.toString\nreturn s},';
  if (js.includes(oldB1)) {
    js = js.replace(oldB1, newB1);
    console.log('  ✅ [A.b1] Đã sửa A.b1 tự động fallback sang Root Navigator và chặn null.toString!');
  } else if (js.includes('if(r==null)r=a.atQ(t.uK)')) {
    console.log('  ℹ️ [A.b1] Đã có bản vá fallback Root Navigator trước đó.');
  } else {
    console.warn('  ⚠️ [A.b1] Không tìm thấy đoạn oldB1');
  }

  // 2. Sửa Action Từ chối (Reject button - A.ave) gọi Root Navigator (!0 thay vì !1)
  const oldRejectPop = 'q.cn("reject_call",A.V(["callerId",r.b,"callType",r.c],s,s))}A.b1(r.d,!1).dN(0)},';
  const newRejectPop = 'q.cn("reject_call",A.V(["callerId",r.b,"callType",r.c],s,s))}A.b1(r.d,!0).dN(0)},';
  if (js.includes(oldRejectPop)) {
    js = js.replace(oldRejectPop, newRejectPop);
    console.log('  ✅ [A.ave] Đã sửa Reject Action gọi Root Navigator (!0)!');
  }

  // 3. Sửa Action Hết giờ (Timeout - A.avd) gọi Root Navigator (!0 thay vì !1)
  const oldTimeoutPop = 'if(A.b1(r,!1).rB())A.b1(r,!1).dN(0)},';
  const newTimeoutPop = 'if(A.b1(r,!0).rB())A.b1(r,!0).dN(0)},';
  if (js.includes(oldTimeoutPop)) {
    js = js.replace(oldTimeoutPop, newTimeoutPop);
    console.log('  ✅ [A.avd] Đã sửa Timeout Action gọi Root Navigator (!0)!');
  }

  // 4. Sửa Action Trả lời (Accept button - A.avf) gọi Root Navigator (!0 thay vì !1)
  const oldAcceptPop = 'p.cn("accept_call",A.V(["callerId",q.c],r,r))}A.b1(q.d,!1).dN(0)';
  const newAcceptPop = 'p.cn("accept_call",A.V(["callerId",q.c],r,r))}A.b1(q.d,!0).dN(0)';
  if (js.includes(oldAcceptPop)) {
    js = js.replace(oldAcceptPop, newAcceptPop);
    console.log('  ✅ [A.avf] Đã sửa Accept Action gọi Root Navigator (!0)!');
  }

  // 5. Sửa Dart call_ended listener (A.avD) gọi Root Navigator (!0 thay vì !1)
  const oldEndedPop = 's=this.b\nif(A.b1(s,!1).rB())A.b1(s,!1).dN(0)},';
  const newEndedPop = 's=this.b\nif(A.b1(s,!0).rB())A.b1(s,!0).dN(0)},';
  if (js.includes(oldEndedPop)) {
    js = js.replace(oldEndedPop, newEndedPop);
    console.log('  ✅ [A.avD] Đã sửa Dart call_ended listener gọi Root Navigator (!0)!');
  }

  // 6. Cho phép WillPopScope pop (thay q=!1 thành q=!0)
  const oldAvgPattern = 'while(true)switch(s){case 0:q=!1\ns=1\nbreak\ncase 1:return A.v(q,r)}})\nreturn A.w($async$$0,r)},\n$S:72}';
  const newAvgPattern = 'while(true)switch(s){case 0:q=!0\ns=1\nbreak\ncase 1:return A.v(q,r)}})\nreturn A.w($async$$0,r)},\n$S:72}';
  if (js.includes(oldAvgPattern)) {
    js = js.replace(oldAvgPattern, newAvgPattern);
    console.log('  ✅ [WillPopScope] Đã cho phép pop WillPopScope!');
  }

  // 7. Thay thế toàn bộ định nghĩa window.dismissIncomingCallNow
  const startIdx = js.indexOf('window.dismissIncomingCallNow = function');
  if (startIdx !== -1) {
    // Tìm đến hết hàm dismissIncomingCallNow cũ
    const endMarker = 'window._incomingCallTimer = null;\n};';
    const endMarker2 = 'window._incomingCallTimer = null;\r\n};';
    const endMarker3 = 'window._activeCallContext = null;\n};';
    let endIdx = -1;
    if (js.indexOf(endMarker, startIdx) !== -1) endIdx = js.indexOf(endMarker, startIdx) + endMarker.length;
    else if (js.indexOf(endMarker2, startIdx) !== -1) endIdx = js.indexOf(endMarker2, startIdx) + endMarker2.length;
    else if (js.indexOf(endMarker3, startIdx) !== -1) endIdx = js.indexOf(endMarker3, startIdx) + endMarker3.length;
    else {
      const fastObjIdx = js.indexOf('convertToFastObject($);', startIdx);
      if (fastObjIdx !== -1) endIdx = fastObjIdx;
    }

    if (endIdx !== -1) {
      js = js.substring(0, startIdx) + safeDismissFunc + '\n\n' + js.substring(endIdx);
      console.log('  ✅ [JS] Đã cập nhật safe window.dismissIncomingCallNow!');
    } else {
      console.warn('  ⚠️ Không tìm thấy điểm kết thúc của window.dismissIncomingCallNow cũ');
    }
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// 8. Cập nhật Cache Buster trong flutter_bootstrap.js và index.html
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
  fs.writeFileSync(f, raw, 'utf8');
  console.log(`✅ [Index] Đã cập nhật cache buster v=${now} cho ${f}`);
});

console.log('\n🎉 HOÀN TẤT ÁP DỤNG FIX V2!');
