const fs = require('fs');
const path = require('path');

const TIMESTAMP = Date.now();
console.log(`🚀 Bắt đầu áp dụng V12 - ĐỒNG BỘ CUỘC GỌI TOÀN DIỆN (Timestamp: ${TIMESTAMP})`);

// ==============================================================================
// 1. CẬP NHẬT sockets/socketHandler.js & backend/sockets/socketHandler.js
// ==============================================================================
const socketFiles = [
  path.join(__dirname, '..', 'sockets', 'socketHandler.js'),
  path.join(__dirname, '..', 'backend', 'sockets', 'socketHandler.js')
];

for (const sf of socketFiles) {
  if (!fs.existsSync(sf)) continue;
  let code = fs.readFileSync(sf, 'utf8');

  // Đảm bảo global.activeCalls được expose
  if (!code.includes('global.activeCalls = activeCalls;')) {
    code = code.replace(
      'const activeCalls = new Map();',
      'const activeCalls = new Map();\n  global.activeCalls = activeCalls;'
    );
  }

  // Đảm bảo trong end_call xoá cả callerId và targetId ngay lập tức
  if (code.includes('activeCalls.delete(targetId);') && !code.includes('activeCalls.delete(socket.userId);')) {
    code = code.replace(
      'activeCalls.delete(targetId);',
      'activeCalls.delete(targetId);\n        if (socket.userId) activeCalls.delete(socket.userId);'
    );
  }

  fs.writeFileSync(sf, code, 'utf8');
  console.log(`✅ Đã cập nhật ${sf}`);
}

// ==============================================================================
// 2. CẬP NHẬT server.js & backend/server.js: THÊM GET /api/call/status
// ==============================================================================
const serverFiles = [
  path.join(__dirname, '..', 'server.js'),
  path.join(__dirname, '..', 'backend', 'server.js')
];

const statusEndpoint = `
// [Call Status API] Kiểm tra trạng thái cuộc gọi theo thời gian thực (Polling Fallback)
app.get("/api/call/status", (req, res) => {
    try {
        const { callerId, calleeId, room } = req.query;
        let isActive = false;
        if (global.activeCalls) {
            if (callerId && global.activeCalls.has(callerId)) isActive = true;
            if (calleeId && global.activeCalls.has(calleeId)) isActive = true;
        }
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.status(200).json({ active: isActive, t: Date.now() });
    } catch (e) {
        res.status(200).json({ active: false });
    }
});
`;

for (const sv of serverFiles) {
  if (!fs.existsSync(sv)) continue;
  let code = fs.readFileSync(sv, 'utf8');

  if (!code.includes('/api/call/status')) {
    code = code.replace(
      'app.post("/api/call/end"',
      statusEndpoint.trim() + '\n\napp.post("/api/call/end"'
    );
    fs.writeFileSync(sv, code, 'utf8');
    console.log(`✅ Đã thêm endpoint GET /api/call/status vào ${sv}`);
  } else {
    console.log(`ℹ️ Đã có GET /api/call/status trong ${sv}`);
  }
}

// ==============================================================================
// 3. CẬP NHẬT main.dart.js TRONG CẢ 3 THƯ MỤC
// ==============================================================================
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

// Hàm polling kiểm tra call status
const pollCodeSnippet = `
function _startCallStatusPolling(callerId, calleeId) {
  if (window._incomingCallPollInterval) clearInterval(window._incomingCallPollInterval);
  window._incomingCallPollInterval = setInterval(function() {
    if (!window._incomingCallShowing && !window._incomingRejectAction) {
      clearInterval(window._incomingCallPollInterval);
      window._incomingCallPollInterval = null;
      return;
    }
    var cId = callerId || window._currentCallerId || "";
    var uId = calleeId || window._currentUserId || "";
    fetch("/api/call/status?callerId=" + encodeURIComponent(cId) + "&calleeId=" + encodeURIComponent(uId) + "&t=" + Date.now(), { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.active === false) {
          console.log("🔴 [Heartbeat] Máy chủ xác nhận cuộc gọi đã kết thúc -> Đóng hộp thoại ngay lập tức!");
          if (window.dismissIncomingCallNow) window.dismissIncomingCallNow();
        }
      })
      .catch(function() {});
  }, 600);
}
`;

// window.dismissIncomingCallNow V12 an toàn 100%, có check canPop
const safeDismissFuncV12 = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow V12] Bắt đầu tắt chuông & đóng màn hình an toàn...");

  // Dừng polling
  if (window._incomingCallPollInterval) {
    clearInterval(window._incomingCallPollInterval);
    window._incomingCallPollInterval = null;
  }

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

  // 2. KIỂM TRA XEM CÓ HỘP THOẠI NÀO ĐANG HIỂN THỊ KHÔNG
  var hasIncoming = window._incomingCallShowing || window._incomingCallContext || window._incomingRejectAction;
  var hasActive = window._activeCallShowing || window._activeCallContext;

  if (!hasIncoming && !hasActive) {
    console.log("ℹ️ [dismissIncomingCallNow V12] Không có hộp thoại nào đang mở, bỏ qua.");
    return;
  }

  // Khóa chống pop kép
  if (window._isDismissingCall) return;
  window._isDismissingCall = true;

  var rejectAction = window._incomingRejectAction;
  var ctx = window._incomingCallContext;
  var inNav = window._incomingNav;
  var actCtx = window._activeCallContext;

  // Xóa sạch trạng thái ngay để không bao giờ pop lần 2
  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingCallContext = null;
  window._incomingNav = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;

  var dismissed = false;

  // Cách 1: Gọi Action Từ chối chuẩn của Flutter
  if (rejectAction && typeof rejectAction.$0 === "function") {
    try {
      rejectAction.$0();
      dismissed = true;
      console.log("✅ [V12] Đã đóng incoming dialog thành công qua Flutter rejectAction.$0()!");
    } catch(e) {
      console.warn("Lỗi rejectAction.$0:", e);
    }
  }

  // Cách 2: Pop an toàn qua rootNav của ctx (BẮT BUỘC CHECK canPop rB)
  if (!dismissed && ctx) {
    try {
      var rootNav = A.b1(ctx, !0);
      if (rootNav && typeof rootNav.rB === "function" && rootNav.rB() && typeof rootNav.dN === "function") {
        rootNav.dN(0);
        dismissed = true;
        console.log("✅ [V12] Đã đóng incoming dialog an toàn qua rootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop ctx rootNav:", e);
    }
  }

  // Cách 3: Pop an toàn qua inNav (BẮT BUỘC CHECK canPop rB)
  if (!dismissed && inNav) {
    try {
      if (typeof inNav.rB === "function" && inNav.rB() && typeof inNav.dN === "function") {
        inNav.dN(0);
        dismissed = true;
        console.log("✅ [V12] Đã đóng incoming dialog an toàn qua inNav.dN(0)!");
      }
    } catch(e) {}
  }

  // Cách 4: Pop CallRoom đang đàm thoại nếu có
  if (!dismissed && actCtx) {
    try {
      var actRootNav = A.b1(actCtx, !0);
      if (actRootNav && typeof actRootNav.rB === "function" && actRootNav.rB() && typeof actRootNav.dN === "function") {
        actRootNav.dN(0);
        console.log("✅ [V12] Đã đóng activeCall dialog thành công qua actRootNav.dN(0)!");
      }
    } catch(e) {
      console.warn("Lỗi pop active call dialog:", e);
    }
  }

  setTimeout(function() {
    window._isDismissingCall = false;
  }, 1000);
};`;

for (const jf of jsFiles) {
  if (!fs.existsSync(jf)) continue;
  let js = fs.readFileSync(jf, 'utf8');

  // a) Thay thế window.dismissIncomingCallNow
  const startMarker = 'window.dismissIncomingCallNow = function()';
  const startIdx = js.indexOf(startMarker);
  if (startIdx !== -1) {
    const endMarker = 'window._isDismissingCall = false;\n  }, 1000);\n};';
    const endIdx = js.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
      js = js.slice(0, startIdx) + safeDismissFuncV12 + '\n' + pollCodeSnippet + '\n' + js.slice(endIdx + endMarker.length);
      console.log(`  ✅ Đã thay thế window.dismissIncomingCallNow V12 trong ${jf}`);
    }
  }

  // b) Đảm bảo A.ave.prototype.$0 có check canPop rB() trước khi pop để không bị trắng màn hình
  const oldAve = 'q.cn("reject_call",A.V(["callerId",r.b,"callType",r.c],s,s))}A.b1(r.d,!0).dN(0)}';
  const safeAve = 'q.cn("reject_call",A.V(["callerId",r.b,"callType",r.c],s,s))}var _nav=A.b1(r.d,!0);if(_nav&&_nav.rB())_nav.dN(0)}';
  if (js.includes(oldAve)) {
    js = js.replace(oldAve, safeAve);
    console.log(`  ✅ Đã vá A.ave.prototype.$0 check canPop an toàn trong ${jf}`);
  }

  // c) Trong agj(a) (nhận cuộc gọi đến): Lưu callerId và bắt đầu polling kiểm tra call status
  const targetAgj = 'window._chatScreenContext=o;window._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;';
  const newAgj = 'window._chatScreenContext=o;window._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;window._currentCallerId=m;if(typeof _startCallStatusPolling==="function")_startCallStatusPolling(m,$.aLM);';
  if (js.includes(targetAgj)) {
    js = js.replace(targetAgj, newAgj);
    console.log(`  ✅ Đã gắn _startCallStatusPolling vào agj trong ${jf}`);
  }

  // d) Trong A.avh.prototype.$3 (khi dialog build): Đảm bảo polling cũng kích hoạt
  const targetAvh = 'window._incomingCallShowing=true;window._incomingCallContext=a;window._incomingCallTimer=i;window._incomingRejectAction=new A.ave(i,k,j,a);';
  const newAvh = 'window._incomingCallShowing=true;window._incomingCallContext=a;window._incomingCallTimer=i;window._incomingRejectAction=new A.ave(i,k,j,a);if(typeof _startCallStatusPolling==="function")_startCallStatusPolling(k,$.aLM);';
  if (js.includes(targetAvh)) {
    js = js.replace(targetAvh, newAvh);
    console.log(`  ✅ Đã gắn _startCallStatusPolling vào avh.$3 trong ${jf}`);
  }

  fs.writeFileSync(jf, js, 'utf8');
  console.log(`✅ Hoàn thành cập nhật ${jf}`);
}

// ==============================================================================
// 4. CẬP NHẬT index.html: Thêm kiểm tra khi visibilitychange / focus
// ==============================================================================
const indexFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const lifecycleListener = `
  <script>
    // [Call Sync V12] Tự động kiểm tra trạng thái cuộc gọi khi mở lại app hoặc focus tab
    function _checkCallStatusOnResume() {
      if (window._incomingCallShowing && window._currentCallerId) {
        fetch("/api/call/status?callerId=" + encodeURIComponent(window._currentCallerId) + "&t=" + Date.now(), { cache: "no-store" })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data && data.active === false && window.dismissIncomingCallNow) {
              console.log("🔴 [Resume] Máy chủ báo cuộc gọi đã kết thúc -> Đóng hộp thoại!");
              window.dismissIncomingCallNow();
            }
          })
          .catch(function() {});
      }
    }
    window.addEventListener("focus", _checkCallStatusOnResume);
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "visible") _checkCallStatusOnResume();
    });
  </script>
`;

for (const inf of indexFiles) {
  if (!fs.existsSync(inf)) continue;
  let html = fs.readFileSync(inf, 'utf8');

  // Cập nhật timestamp preloads
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${TIMESTAMP}`);
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);

  if (!html.includes('_checkCallStatusOnResume')) {
    html = html.replace('</body>', lifecycleListener.trim() + '\n</body>');
  }

  fs.writeFileSync(inf, html, 'utf8');
  console.log(`✅ Đã cập nhật ${inf}`);
}

// ==============================================================================
// 5. CẬP NHẬT flutter_bootstrap.js
// ==============================================================================
const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

for (const bf of bootstrapFiles) {
  if (!fs.existsSync(bf)) continue;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);
  fs.writeFileSync(bf, bs, 'utf8');
  console.log(`✅ Đã cập nhật ${bf} với v=${TIMESTAMP}`);
}

console.log(`\n🎉 ĐÃ ÁP DỤNG THÀNH CÔNG V12 CHO TOÀN BỘ HỆ THỐNG!`);
