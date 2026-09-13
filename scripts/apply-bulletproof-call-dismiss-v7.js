const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

console.log('🚀 [CALL SYNC V7] Bắt đầu vá đồng bộ cuộc gọi chuẩn Messenger/Zalo...');

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

  var hasIncoming = window._incomingCallShowing || window._incomingCallContext || window._incomingRejectAction;
  var hasActive = window._activeCallShowing || window._activeCallContext;

  if (!hasIncoming && !hasActive) {
    console.log("ℹ️ [dismissIncomingCallNow] Không có hộp thoại cuộc gọi nào cần đóng.");
    return;
  }

  // 2. ĐÓNG MÀN HÌNH CUỘC GỌI ĐẾN (INCOMING CALL)
  if (hasIncoming) {
    // Cách 1: Sử dụng chính _incomingRejectAction (cơ chế chuẩn 100% của Flutter)
    if (window._incomingRejectAction && typeof window._incomingRejectAction.$0 === "function") {
      try {
        console.log("✅ [1] Đã đóng cuộc gọi đến qua _incomingRejectAction!");
        window._incomingRejectAction.$0();
      } catch(e) {
        console.warn("Lỗi _incomingRejectAction:", e);
      }
    }

    // Cách 2: Pop trực tiếp qua _incomingCallContext mà không bị canPop chặn
    if (window._incomingCallContext) {
      try {
        var nav = A.b1(window._incomingCallContext, true);
        if (nav && typeof nav.dN === "function") {
          console.log("✅ [2] Đã pop đóng cuộc gọi đến qua _incomingCallContext!");
          nav.dN(0);
        }
      } catch(e) {
        console.warn("Lỗi pop _incomingCallContext:", e);
      }
    }

    // Cách 3: Pop qua _incomingNav nếu còn
    if (window._incomingNav && typeof window._incomingNav.dN === "function") {
      try {
        console.log("✅ [3] Đã pop đóng cuộc gọi đến qua _incomingNav!");
        window._incomingNav.dN(0);
      } catch(e) {
        console.warn("Lỗi pop _incomingNav:", e);
      }
    }
  }

  // 3. ĐÓNG MÀN HÌNH ĐÀM THOẠI (CALLROOM) NẾU ĐANG MỞ
  if (window._activeCallContext) {
    try {
      var actNav = A.b1(window._activeCallContext, true);
      if (actNav && typeof actNav.dN === "function") {
        console.log("✅ [4] Đã pop đóng CallRoom qua _activeCallContext!");
        actNav.dN(0);
      }
    } catch(e) {
      console.warn("Lỗi pop _activeCallContext:", e);
    }
  }

  // Dọn dẹp sạch sẽ toàn bộ biến cờ
  window._incomingCallShowing = false;
  window._activeCallShowing = false;
  window._incomingCallContext = null;
  window._incomingRejectAction = null;
  window._incomingNav = null;
  window._activeCallContext = null;
  window._incomingCallTimer = null;
  window._incomingCallTimerHolder = null;
};`;

const newAvH = `A.avH.prototype={
$0(){
  var s, r = $.bj;
  var targetId = this.a || window._currentCallPartnerId || "";
  var convId = (window._currentActiveChatConvId || "");
  console.log("🔴 [Caller cúp máy] Đang cúp máy tới partner:", targetId);
  try { A.FS(); } catch(_) {}
  try { if (typeof $ !== "undefined" && $.aJy) $.aJy().cs(0); } catch(_) {}
  try { if (typeof $ !== "undefined") $.aos = false; } catch(_) {}
  if (r != null) {
    s = t.N;
    r.cn("end_call", A.V(["connectedUserId", targetId, "conversationId", convId], s, s));
  }
  try {
    fetch('/api/call/end', {
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
  } catch(e) {
    console.warn("Lỗi đóng CallRoom:", e);
  }
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
    const endPoint = dismEnd !== -1 ? (dismEnd + 'window._activeCallContext = null;\n};'.length) : js.indexOf('};', dismStart) + 2;
    js = js.slice(0, dismStart) + newDismissFunc + js.slice(endPoint);
    console.log('  ✅ Đã thay thế window.dismissIncomingCallNow V7 hoàn hảo!');
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

console.log('\n🎉 [HOÀN TẤT V7] Đã triển khai thành công!');
