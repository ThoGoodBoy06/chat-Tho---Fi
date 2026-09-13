const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

console.log('🚀 [CALL SYNC V8] Bắt đầu vá đồng bộ cuộc gọi chuẩn Messenger/Zalo...');

const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const newDismissFunc = `window.dismissIncomingCallNow = function() {
  console.log("🔴 [dismissIncomingCallNow] Bắt đầu tắt chuông & đóng hộp thoại cuộc gọi...");

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

  var hasIncoming = window._incomingCallShowing || window._incomingCallContext || window._incomingRejectAction || window._incomingNav;
  var hasActive = window._activeCallShowing || window._activeCallContext;

  if (!hasIncoming && !hasActive) {
    console.log("ℹ️ [dismissIncomingCallNow] Không có hộp thoại cuộc gọi nào cần đóng.");
    return;
  }

  // 2. ĐÓNG MÀN HÌNH CUỘC GỌI ĐẾN (INCOMING CALL)
  function doPopIncoming() {
    var closed = false;
    // Cách 1: Pop qua _incomingCallContext (context của dialog)
    if (window._incomingCallContext) {
      try {
        var nav = A.b1(window._incomingCallContext, true);
        if (nav && typeof nav.dN === "function") {
          nav.dN(0);
          closed = true;
          console.log("✅ Đã đóng cuộc gọi đến qua _incomingCallContext rootNav!");
        } else if (nav && typeof nav.awX === "function") {
          nav.awX(null);
          closed = true;
        }
      } catch(e) {
        console.warn("Lỗi pop _incomingCallContext root:", e);
      }
      if (!closed) {
        try {
          var navLocal = A.b1(window._incomingCallContext, false);
          if (navLocal && typeof navLocal.dN === "function") {
            navLocal.dN(0);
            closed = true;
          }
        } catch(_) {}
      }
    }

    // Cách 2: Pop qua _incomingNav (Navigator của ChatScreen đã lưu khi mở dialog)
    if (!closed && window._incomingNav) {
      try {
        if (typeof window._incomingNav.dN === "function") {
          window._incomingNav.dN(0);
          closed = true;
          console.log("✅ Đã đóng cuộc gọi đến qua _incomingNav!");
        } else if (typeof window._incomingNav.awX === "function") {
          window._incomingNav.awX(null);
          closed = true;
        }
      } catch(e) {
        console.warn("Lỗi pop _incomingNav:", e);
      }
    }

    // Cách 3: Pop qua _chatScreenContext
    if (!closed && window._chatScreenContext) {
      try {
        var navChat = A.b1(window._chatScreenContext, true);
        if (navChat && typeof navChat.dN === "function") {
          navChat.dN(0);
          closed = true;
          console.log("✅ Đã đóng cuộc gọi đến qua _chatScreenContext!");
        }
      } catch(_) {}
    }

    // Cách 4: Dùng _incomingRejectAction
    if (!closed && window._incomingRejectAction && typeof window._incomingRejectAction.$0 === "function") {
      try {
        window._incomingRejectAction.$0();
        closed = true;
      } catch(_) {}
    }

    return closed;
  }

  // 3. ĐÓNG MÀN HÌNH ĐÀM THOẠI (CALLROOM) NẾU ĐANG MỞ
  function doPopActive() {
    if (window._activeCallContext) {
      try {
        var actNav = A.b1(window._activeCallContext, true);
        if (actNav && typeof actNav.dN === "function") {
          actNav.dN(0);
          console.log("✅ Đã pop đóng CallRoom qua _activeCallContext!");
        }
      } catch(e) {
        console.warn("Lỗi pop _activeCallContext:", e);
      }
    }
  }

  if (hasIncoming) {
    doPopIncoming();
    // Retry sau 60ms và 180ms phòng trường hợp dialog đang render animation vào
    setTimeout(function() {
      if (window._incomingCallShowing) {
        doPopIncoming();
      }
    }, 60);
    setTimeout(function() {
      if (window._incomingCallShowing) {
        doPopIncoming();
      }
      window._incomingCallShowing = false;
      window._activeCallShowing = false;
      window._incomingCallContext = null;
      window._incomingRejectAction = null;
      window._incomingNav = null;
      window._activeCallContext = null;
      window._incomingCallTimer = null;
      window._incomingCallTimerHolder = null;
    }, 180);
  }

  if (hasActive) {
    doPopActive();
  }
};`;

const newAvH = `A.avH.prototype={
$0(){
  var s, r = $.bj;
  var targetId = (typeof this.a === "string" && this.a) || window._currentCallPartnerId || "";
  var convId = (typeof $ !== "undefined" && $._currentActiveChatConvId) || window._currentActiveChatConvId || "";
  console.log("🔴 [Caller cúp máy] Đang cúp máy tới partner:", targetId, "room:", convId);
  try { A.FS(); } catch(_) {}
  try { if (typeof $ !== "undefined" && $.aJy) $.aJy().cs(0); } catch(_) {}
  try { if (typeof $ !== "undefined") $.aos = false; } catch(_) {}
  if (r != null) {
    s = t.N;
    r.cn("end_call", A.V(["connectedUserId", targetId, "conversationId", convId], s, s));
  }
  try {
    var bUrl = (window.location.origin && window.location.origin.includes("pages.dev")) ? "https://chat-tho-fi-vn-9s8u.onrender.com" : "";
    fetch(bUrl + '/api/call/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ callerId: (window._currentUserId || ""), connectedUserId: targetId, conversationId: convId })
    }).catch(function() {});
  } catch(_) {}
  try { this.b.$0(); } catch(_) {}
  try {
    r = this.c;
    var nav = A.b1(r, true);
    if (nav && typeof nav.dN === "function") nav.dN(0);
    else if (nav && typeof nav.awX === "function") nav.awX(null);
  } catch(e) {
    console.warn("Lỗi đóng CallRoom:", e);
  }
  window._activeCallShowing = false;
  window._activeCallContext = null;
},
$S:0}`;

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  console.log(`\n🔍 Đang xử lý: ${jf}`);
  let js = fs.readFileSync(jf, 'utf8');

  // a) Thay thế window.dismissIncomingCallNow
  const dismStart = js.indexOf('window.dismissIncomingCallNow = function');
  if (dismStart !== -1) {
    const dismEnd = js.indexOf('window._activeCallContext = null;\n};', dismStart);
    let endPoint = -1;
    if (dismEnd !== -1) {
      endPoint = dismEnd + 'window._activeCallContext = null;\n};'.length;
    } else {
      const altEnd = js.indexOf('};\n\n', dismStart);
      endPoint = altEnd !== -1 ? altEnd + 3 : js.indexOf('};', dismStart) + 2;
    }
    js = js.slice(0, dismStart) + newDismissFunc + js.slice(endPoint);
    console.log('  ✅ Đã thay thế window.dismissIncomingCallNow V8 hoàn hảo!');
  } else {
    // Chèn sau convertAllToFastObject
    const hook = 'convertAllToFastObject(w);';
    if (js.includes(hook)) {
      js = js.replace(hook, `${hook}\n\n${newDismissFunc}\n`);
      console.log('  ✅ Đã chèn mới window.dismissIncomingCallNow V8!');
    }
  }

  // b) Thay thế A.avH
  const avhStart = js.indexOf('A.avH.prototype={');
  if (avhStart !== -1) {
    const avhEnd = js.indexOf('A.avI.prototype={', avhStart);
    if (avhEnd !== -1) {
      js = js.slice(0, avhStart) + newAvH + '\n' + js.slice(avhEnd);
      console.log('  ✅ Đã cập nhật A.avH cúp máy dứt điểm!');
    }
  }

  fs.writeFileSync(jf, js, 'utf8');
});

console.log('\n--- Đồng bộ sang index.html cache buster ---');
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
];

const timestamp = Date.now();
indexFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${timestamp}`);
  html = html.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${timestamp}`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ Đã cập nhật version cache buster (v=${timestamp}) cho: ${file}`);
});

console.log('\n🎉 [HOÀN TẤT V8] Đã triển khai bản vá thành công!');
