const fs = require('fs');
const path = require('path');

console.log('🚀 Đang áp dụng giải pháp đóng dialog chuẩn qua _incomingNav (Root Navigator)...');

const ROOT = path.resolve(__dirname, '..');
const now = Date.now();

const safeDismissFunc = `window.dismissIncomingCallNow = function() {
  if (window.logCallHUD) {
    window.logCallHUD("🔴 [1] Nhận lệnh cúp máy -> Bắt đầu đóng...", "#f59e0b");
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
      window.logCallHUD("ℹ️ [3] Hộp thoại đã đóng hoặc không hiển thị (showing=false)", "#94a3b8");
    }
    return;
  }

  // ĐÁNH DẤU FALSE NGAY LẬP TỨC ĐỂ CHỐNG POP LẦN 2
  window._incomingCallShowing = false;
  window._activeCallShowing = false;

  var popped = false;

  // 3. ĐÓNG DIALOG QUA window._incomingNav (Root Navigator nơi showGeneralDialog đã đẩy vào)
  if (window._incomingNav) {
    try {
      var nav = window._incomingNav;
      var canSafePop = true;
      if (nav.e && nav.e.a && Array.isArray(nav.e.a)) {
        if (nav.e.a.length <= 1) {
          canSafePop = false;
          if (window.logCallHUD) window.logCallHUD("⚠️ Chỉ còn 1 route, hủy pop để không trắng màn hình!", "#f87171");
        }
      }
      if (canSafePop) {
        nav.dN(0);
        popped = true;
        if (window.logCallHUD) window.logCallHUD("✅ [3] ĐÃ POP ĐÓNG DIALOG THÀNH CÔNG QUA _incomingNav!", "#4ade80");
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
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let raw = fs.readFileSync(jf, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let js = raw.replace(/\r\n/g, '\n');

  // 1. Cho phép WillPopScope pop (thay q=!1 thành q=!0)
  const oldAvgPattern = 'while(true)switch(s){case 0:q=!1\ns=1\nbreak\ncase 1:return A.v(q,r)}})\nreturn A.w($async$$0,r)},\n$S:72}';
  const newAvgPattern = 'while(true)switch(s){case 0:q=!0\ns=1\nbreak\ncase 1:return A.v(q,r)}})\nreturn A.w($async$$0,r)},\n$S:72}';
  if (js.includes(oldAvgPattern)) {
    js = js.replace(oldAvgPattern, newAvgPattern);
    console.log(`✅ [WillPopScope] Đã cho phép pop WillPopScope trong ${jf}`);
  }

  // 2. Thay thế toàn bộ định nghĩa window.dismissIncomingCallNow
  const startIdx = js.indexOf('window.dismissIncomingCallNow = function');
  const endMarker = 'convertToFastObject($);';
  const endIdx = js.indexOf(endMarker, startIdx);
  if (startIdx !== -1 && endIdx !== -1) {
    js = js.substring(0, startIdx) + safeDismissFunc + '\n\n' + js.substring(endIdx);
    console.log(`✅ [JS] Đã cập nhật safe window.dismissIncomingCallNow trong ${jf}`);
  }

  fs.writeFileSync(jf, isCRLF ? js.replace(/\n/g, '\r\n') : js, 'utf8');
});

// Cập nhật Cache Buster trong flutter_bootstrap.js và index.html
const bootstrapFiles = [
  path.join(ROOT, 'public', 'flutter_bootstrap.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let code = fs.readFileSync(bf, 'utf8');
  code = code.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  fs.writeFileSync(bf, code, 'utf8');
  console.log(`✅ [Bootstrap] Đã cập nhật cache buster v=${now} cho ${bf}`);
});

const hudHtml = `
  <!-- CALL DEBUG ON-SCREEN HUD -->
  <div id="debug-call-hud" style="position:fixed; bottom:12px; right:12px; max-width:440px; width:92%; background:rgba(15,23,42,0.95); color:#f8fafc; font-family:Consolas,monospace; font-size:12px; border:2px solid #3b82f6; border-radius:10px; padding:12px; z-index:999999999; box-shadow:0 8px 32px rgba(0,0,0,0.7); pointer-events:auto; line-height:1.5;">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:6px; margin-bottom:8px;">
      <strong style="color:#60a5fa; font-size:13px;">🛠️ TRẠNG THÁI CUỘC GỌI (DEBUG)</strong>
      <button onclick="document.getElementById('hud-content').innerHTML=''" style="background:#475569; color:#fff; border:none; border-radius:4px; padding:2px 8px; font-size:11px; cursor:pointer;">Xóa log</button>
    </div>
    <div id="hud-content" style="max-height:200px; overflow-y:auto; word-break:break-all;">
      <div style="color:#94a3b8;">[READY] Đang theo dõi cuộc gọi trực tiếp...</div>
    </div>
  </div>

  <script>
    window.logCallHUD = function(msg, color) {
      const box = document.getElementById('hud-content');
      if (!box) return;
      const d = new Date();
      const time = d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
      const div = document.createElement('div');
      div.style.color = color || '#38bdf8';
      div.style.borderBottom = '1px dashed rgba(255,255,255,0.1)';
      div.style.padding = '3px 0';
      div.innerHTML = '<span style="color:#94a3b8;">[' + time + ']</span> ' + msg;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    };

    window.addEventListener('error', function(e) {
      window.logCallHUD('❌ Lỗi JS: ' + (e.message || e), '#f87171');
    });
    window.addEventListener('unhandledrejection', function(e) {
      window.logCallHUD('❌ Lỗi Promise: ' + (e.reason ? (e.reason.message || e.reason) : e), '#f87171');
    });
  </script>
`;

const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let raw = fs.readFileSync(f, 'utf8');

  // Gỡ bỏ HUD cũ nếu có
  if (raw.includes('id="debug-call-hud"')) {
    const startIdx = raw.indexOf('<!-- CALL DEBUG ON-SCREEN HUD -->');
    const endMarker = '</script>\n</body>';
    const endIdx = raw.indexOf(endMarker, startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
      raw = raw.substring(0, startIdx) + raw.substring(endIdx + '</script>\n'.length);
    }
  }

  // Chèn HUD mới vào trước </body>
  raw = raw.replace('</body>', `${hudHtml}\n</body>`);

  raw = raw.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  raw = raw.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
  fs.writeFileSync(f, raw, 'utf8');
  console.log(`✅ [Index] Đã gắn On-Screen Debug HUD và cache buster v=${now} cho ${f}`);
});

console.log('🎉 ĐÃ HOÀN TẤT CẬP NHẬT!');
