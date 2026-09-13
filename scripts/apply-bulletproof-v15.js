const fs = require('fs');
const path = require('path');

const TIMESTAMP = Date.now();
console.log(`🚀 BẮT ĐẦU ÁP DỤNG V15 - SỬA LỖI TẮT CUỘC GỌI LẦN 2 (Timestamp: ${TIMESTAMP})`);

// =======================================================================
// 1. SỬA SERVER: socketHandler.js & backend/sockets/socketHandler.js
// - Sửa `end_call`: Xóa CẢ caller (socket.userId) VÀ callee (targetId) khỏi activeCalls
// - Sửa `global.endCallCore`: Xóa CẢ callerId VÀ targetId khỏi activeCalls
// - Dọn dẹp triệt để mọi entry trong activeCalls có liên quan
// =======================================================================
const socketFiles = [
  path.join(__dirname, '../sockets/socketHandler.js'),
  path.join(__dirname, '../backend/sockets/socketHandler.js'),
];

socketFiles.forEach((sf) => {
  if (!fs.existsSync(sf)) return;
  let code = fs.readFileSync(sf, 'utf8');

  // a) Trong global.endCallCore (dòng 35)
  const targetEndCore = `      activeCalls.delete(targetId);`;
  const newEndCore = `      activeCalls.delete(targetId);
      if (callerId) activeCalls.delete(callerId);
      for (const [uid, info] of activeCalls.entries()) {
        if (uid === targetId || uid === callerId || info?.partnerId === targetId || info?.partnerId === callerId) {
          activeCalls.delete(uid);
        }
      }`;
  if (code.includes(targetEndCore) && !code.includes('if (callerId) activeCalls.delete(callerId);')) {
    code = code.replace(targetEndCore, newEndCore);
    console.log(`  ✅ Đã sửa global.endCallCore xóa sạch activeCalls trong ${sf}`);
  }

  // b) Trong socket.on("end_call")
  const targetEndCall = `        activeCalls.delete(targetId);`;
  const newEndCall = `        activeCalls.delete(targetId);
        if (socket.userId) activeCalls.delete(socket.userId);
        for (const [uid, info] of activeCalls.entries()) {
          if (uid === targetId || uid === socket.userId || info?.partnerId === targetId || info?.partnerId === socket.userId) {
            activeCalls.delete(uid);
          }
        }`;
  if (code.includes(targetEndCall) && !code.includes('if (socket.userId) activeCalls.delete(socket.userId);')) {
    code = code.replace(targetEndCall, newEndCall);
    console.log(`  ✅ Đã sửa socket.on("end_call") xóa sạch activeCalls trong ${sf}`);
  }

  fs.writeFileSync(sf, code, 'utf8');
});

// =======================================================================
// 2. SỬA SERVER: server.js & backend/server.js (/api/call/status)
// - Kiểm tra chính xác partnerId thay vì chỉ check has(callerId)
// =======================================================================
const serverFiles = [
  path.join(__dirname, '../server.js'),
  path.join(__dirname, '../backend/server.js'),
];

serverFiles.forEach((sf) => {
  if (!fs.existsSync(sf)) return;
  let code = fs.readFileSync(sf, 'utf8');

  const oldStatusCheck = `        if (global.activeCalls) {
            if (callerId && global.activeCalls.has(callerId)) isActive = true;
            if (calleeId && global.activeCalls.has(calleeId)) isActive = true;
        }`;

  const newStatusCheck = `        if (global.activeCalls) {
            const callCaller = callerId ? global.activeCalls.get(callerId) : null;
            const callCallee = calleeId ? global.activeCalls.get(calleeId) : null;
            if (callCaller && (!calleeId || callCaller.partnerId === calleeId)) isActive = true;
            if (callCallee && (!callerId || callCallee.partnerId === callerId)) isActive = true;
        }`;

  if (code.includes(oldStatusCheck)) {
    code = code.replace(oldStatusCheck, newStatusCheck);
    console.log(`  ✅ Đã sửa logic kiểm tra /api/call/status theo partnerId trong ${sf}`);
    fs.writeFileSync(sf, code, 'utf8');
  }
});

// =======================================================================
// 3. SỬA CLIENT: main.dart.js (public/ & flutter_frontend/build/web/)
// - Lưu CẢ local nav (!1) và root nav (!0) trong agj(a)
// - Sửa A.ave.prototype.$0 để thử CẢ local nav (!1) trước, rồi root nav (!0)
// - Cập nhật window.dismissIncomingCallNow V15 hỗ trợ pop toàn diện và retry
// =======================================================================
const jsFiles = [
  path.join(__dirname, '../flutter_frontend/build/web/main.dart.js'),
  path.join(__dirname, '../public/main.dart.js'),
];

const safeDismissFuncV15 = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow V15] Bắt đầu tắt chuông & đóng màn hình...");

  // 1. DỪNG TOÀN BỘ ÂM THANH CHUÔNG, RUNG & MEDIA
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

  try {
    if (window._incomingCallTimer && window._incomingCallTimer.a) window._incomingCallTimer.a.ai(0);
    if (window._incomingCallTimerHolder && window._incomingCallTimerHolder.a) window._incomingCallTimerHolder.a.ai(0);
  } catch(_) {}

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

  var rejectAction = window._incomingRejectAction;
  var ctx = window._incomingCallContext;
  var inNav = window._incomingNav;
  var inNavLocal = window._incomingNavLocal;
  var chatCtx = window._chatScreenContext;
  var actCtx = window._activeCallContext;

  var dismissed = false;

  // Helper pop navigator an toàn (kiểm tra rB canPop)
  function _safePop(nav) {
    if (!nav) return false;
    try {
      if (typeof nav.rB === "function" && nav.rB() && typeof nav.dN === "function") {
        nav.dN(0);
        return true;
      }
    } catch(_) {}
    return false;
  }

  // Cách 1: Gọi Action Từ chối chuẩn của Flutter
  if (rejectAction && typeof rejectAction.$0 === "function") {
    try {
      rejectAction.$0();
      dismissed = true;
      console.log("✅ [V15] Đã gọi rejectAction.$0() thành công!");
    } catch(e) {
      console.warn("Lỗi rejectAction.$0:", e);
    }
  }

  // Cách 2: Pop qua dialog ctx (thử local !1 trước, rồi root !0)
  if (!dismissed && ctx) {
    try {
      var n1 = A.b1(ctx, !1);
      if (_safePop(n1)) {
        dismissed = true;
        console.log("✅ [V15] Pop thành công qua ctx localNav (!1)");
      } else {
        var n0 = A.b1(ctx, !0);
        if (_safePop(n0)) {
          dismissed = true;
          console.log("✅ [V15] Pop thành công qua ctx rootNav (!0)");
        }
      }
    } catch(_) {}
  }

  // Cách 3: Pop qua inNavLocal (!1) hoặc inNav (!0)
  if (!dismissed) {
    if (_safePop(inNavLocal)) {
      dismissed = true;
      console.log("✅ [V15] Pop thành công qua inNavLocal (!1)");
    } else if (_safePop(inNav)) {
      dismissed = true;
      console.log("✅ [V15] Pop thành công qua inNav (!0)");
    }
  }

  // Cách 4: Pop qua chatScreenContext (thử cả !1 và !0)
  if (!dismissed && chatCtx) {
    try {
      var cn1 = A.b1(chatCtx, !1);
      if (_safePop(cn1)) {
        dismissed = true;
        console.log("✅ [V15] Pop thành công qua chatCtx localNav (!1)");
      } else {
        var cn0 = A.b1(chatCtx, !0);
        if (_safePop(cn0)) {
          dismissed = true;
          console.log("✅ [V15] Pop thành công qua chatCtx rootNav (!0)");
        }
      }
    } catch(_) {}
  }

  // Cách 5: Pop activeCall dialog nếu có
  if (!dismissed && actCtx) {
    try {
      var an = A.b1(actCtx, !0) || A.b1(actCtx, !1);
      if (_safePop(an)) {
        dismissed = true;
        console.log("✅ [V15] Đã đóng activeCall dialog");
      }
    } catch(_) {}
  }

  // Xóa sạch trạng thái sau khi đã đóng
  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingCallContext = null;
  window._incomingNav = null;
  window._incomingNavLocal = null;
  window._incomingRejectAction = null;
  window._activeCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;

  // Dừng polling
  if (window._incomingCallPollInterval) {
    clearInterval(window._incomingCallPollInterval);
    window._incomingCallPollInterval = null;
  }
  if (window._stopCallStatusPolling) {
    window._stopCallStatusPolling();
  }
};

window._startCallStatusPolling = function _startCallStatusPolling(callerId, calleeId) {
  if (window._incomingCallPollInterval) clearInterval(window._incomingCallPollInterval);
  window._incomingCallPollInterval = setInterval(function() {
    var cId = callerId || window._currentCallerId || "";
    var uId = calleeId || window._currentUserId || (typeof $ !== "undefined" && $.aLM) || "";
    if (!cId && !uId) return;
    fetch("/api/call/status?callerId=" + encodeURIComponent(cId) + "&calleeId=" + encodeURIComponent(uId) + "&t=" + Date.now(), { cache: "no-store" })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.active === false) {
          console.log("🔴 [V15 Heartbeat] Máy chủ xác nhận cuộc gọi đã kết thúc -> Đóng hộp thoại!");
          if (window.dismissIncomingCallNow) window.dismissIncomingCallNow();
        }
      })
      .catch(function() {});
  }, 500);
};`;

jsFiles.forEach((jf) => {
  if (!fs.existsSync(jf)) return;
  let js = fs.readFileSync(jf, 'utf8');

  // a) Thay thế dismissIncomingCallNow và _startCallStatusPolling
  const startIdx = js.indexOf('window.dismissIncomingCallNow = function');
  const endIdx = js.indexOf('convertToFastObject($);', startIdx);
  if (startIdx !== -1 && endIdx !== -1) {
    js = js.slice(0, startIdx) + safeDismissFuncV15 + '\n\n' + js.slice(endIdx);
    console.log(`  ✅ Đã cập nhật dismissIncomingCallNow & _startCallStatusPolling V15 trong ${jf}`);
  }

  // b) Trong agj(a): lưu cả inNavLocal (!1)
  const targetAgj = 'window._incomingNav=A.b1(o,!0);';
  const newAgj = 'window._incomingNav=A.b1(o,!0);window._incomingNavLocal=A.b1(o,!1);';
  if (js.includes(targetAgj) && !js.includes('window._incomingNavLocal')) {
    js = js.replace(targetAgj, newAgj);
    console.log(`  ✅ Đã thêm _incomingNavLocal trong agj(a) của ${jf}`);
  }

  // c) Sửa A.ave.prototype.$0 để thử cả !1 và !0
  const oldAve = 'var _nav=A.b1(r.d,!0);if(_nav&&_nav.rB())_nav.dN(0)}';
  const newAve = 'var _n1=A.b1(r.d,!1);if(_n1&&_n1.rB()){_n1.dN(0)}else{var _n0=A.b1(r.d,!0);if(_n0&&_n0.rB())_n0.dN(0)}}';
  if (js.includes(oldAve)) {
    js = js.replace(oldAve, newAve);
    console.log(`  ✅ Đã sửa A.ave.prototype.$0 thử cả !1 và !0 trong ${jf}`);
  }

  fs.writeFileSync(jf, js, 'utf8');
});

// =======================================================================
// 4. SỬA index.html & flutter_bootstrap.js với cache buster mới
// =======================================================================
const htmlFiles = [
  path.join(__dirname, '../flutter_frontend/build/web/index.html'),
  path.join(__dirname, '../public/index.html'),
];

htmlFiles.forEach((hf) => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');

  // Cập nhật cache buster cho flutter_bootstrap.js
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${TIMESTAMP}`);

  // Cập nhật polling trong index.html
  const oldPollCheck = `fetch('/api/call/status?callerId=' + encodeURIComponent(callerId)
            + '&calleeId=' + encodeURIComponent(calleeId)
            + '&t=' + Date.now(), { cache: 'no-store' })`;
  if (html.includes(oldPollCheck)) {
    console.log(`  ℹ️ index.html đã có polling standalone.`);
  }

  fs.writeFileSync(hf, html, 'utf8');
  console.log(`  ✅ Đã cập nhật cache buster ${TIMESTAMP} trong ${hf}`);
});

const bootFiles = [
  path.join(__dirname, '../flutter_frontend/build/web/flutter_bootstrap.js'),
  path.join(__dirname, '../public/flutter_bootstrap.js'),
];

bootFiles.forEach((bf) => {
  if (!fs.existsSync(bf)) return;
  let boot = fs.readFileSync(bf, 'utf8');
  boot = boot.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);
  fs.writeFileSync(bf, boot, 'utf8');
  console.log(`  ✅ Đã cập nhật cache buster ${TIMESTAMP} trong ${bf}`);
});

console.log(`\n🎉 HOÀN TẤT ÁP DỤNG V15!`);
