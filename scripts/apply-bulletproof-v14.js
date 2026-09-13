const fs = require('fs');
const path = require('path');

const TIMESTAMP = Date.now();
console.log(`🚀 V14 - Đặt polling trực tiếp trong index.html, không phụ thuộc main.dart.js`);

// ============================================================================
// index.html: Thay thế toàn bộ script polling/dismiss cũ bằng 1 script hoàn chỉnh
// hoạt động độc lập, gọi window.dismissIncomingCallNow khi sẵn sàng
// ============================================================================
const indexFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const NEW_CALL_SYNC_SCRIPT = `
  <script>
    // ============================================================
    // [Call Sync V14] Standalone polling + dismiss
    // Không phụ thuộc main.dart.js, chạy ngay từ index.html
    // ============================================================
    (function() {
      var _pollInterval = null;
      var _pollDelay = 600; // ms

      function _doCallStatusCheck() {
        var callerId = window._currentCallerId || '';
        var calleeId = window._currentUserId || (typeof $ !== 'undefined' && $.aLM) || '';
        if (!callerId && !calleeId) return;
        fetch('/api/call/status?callerId=' + encodeURIComponent(callerId)
            + '&calleeId=' + encodeURIComponent(calleeId)
            + '&t=' + Date.now(), { cache: 'no-store' })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data && data.active === false) {
              console.log('[Call-V14] Cuộc gọi đã kết thúc trên server -> Dismiss ngay!');
              _stopPoll();
              if (window.dismissIncomingCallNow) {
                window.dismissIncomingCallNow();
              } else {
                // Thử lại sau 200ms nếu dismissIncomingCallNow chưa sẵn sàng
                setTimeout(function() {
                  if (window.dismissIncomingCallNow) window.dismissIncomingCallNow();
                }, 200);
              }
            }
          })
          .catch(function() {});
      }

      function _startPoll() {
        _stopPoll();
        console.log('[Call-V14] Bắt đầu polling trạng thái cuộc gọi mỗi 600ms...');
        _pollInterval = setInterval(function() {
          var isShowing = window._incomingCallShowing || window._incomingRejectAction || window._incomingCallContext;
          if (!isShowing) {
            _stopPoll();
            return;
          }
          _doCallStatusCheck();
        }, _pollDelay);
        // Check ngay lập tức lần đầu sau 300ms
        setTimeout(_doCallStatusCheck, 300);
      }

      function _stopPoll() {
        if (_pollInterval) {
          clearInterval(_pollInterval);
          _pollInterval = null;
          console.log('[Call-V14] Đã dừng polling.');
        }
      }

      // Expose ra global để main.dart.js có thể gọi
      window._startCallStatusPolling = function(callerId, calleeId) {
        window._currentCallerId = callerId;
        _startPoll();
      };
      window._stopCallStatusPolling = _stopPoll;

      // Khi app focus lại / visible lại: check ngay
      function _onResume() {
        var isShowing = window._incomingCallShowing || window._incomingRejectAction;
        if (isShowing) {
          console.log('[Call-V14] App visible lại, kiểm tra trạng thái cuộc gọi...');
          _doCallStatusCheck();
          // Cũng restart poll nếu đã bị dừng
          if (!_pollInterval) _startPoll();
        }
      }

      window.addEventListener('focus', _onResume);
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') _onResume();
      });

      // Lắng nghe postMessage từ Service Worker (call_ended push notification)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function(event) {
          if (event.data && (event.data.type === 'call_ended' || event.data.type === 'CALL_ENDED')) {
            console.log('[Call-V14] Service Worker báo call_ended -> Dismiss ngay!');
            _stopPoll();
            if (window.dismissIncomingCallNow) window.dismissIncomingCallNow();
          }
        });
      }

      console.log('[Call-V14] Call Sync polling engine sẵn sàng.');
    })();
  </script>
`;

for (const inf of indexFiles) {
  if (!fs.existsSync(inf)) continue;
  let html = fs.readFileSync(inf, 'utf8');

  // Cập nhật cache buster timestamp
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${TIMESTAMP}`);
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);

  // XÓA tất cả block script call sync cũ (tránh trùng lặp)
  html = html.replace(/<script>\s*\/\/ \[Call Sync\][^<]*<\/script>/gs, '');
  html = html.replace(/<script>\s*if \('serviceWorker' in navigator\) \{[\s\S]*?serviceWorker\.addEventListener.*?call_ended.*?\}\s*\}\s*<\/script>/gs, '');
  html = html.replace(/<script>\s*\/\/ \[Call Sync V1[0-9]\][^<]*<\/script>/gs, '');
  html = html.replace(/<script>\s*\/\/[^<]*_checkCallStatusOnResume[\s\S]*?<\/script>/gs, '');

  // Thêm script mới ngay trước </body>
  if (!html.includes('Call Sync V14')) {
    html = html.replace('</body>', NEW_CALL_SYNC_SCRIPT.trim() + '\n</body>');
    console.log(`  ✅ Đã thêm Call Sync V14 script vào ${path.basename(inf)}`);
  } else {
    console.log(`  ℹ️ Đã có V14 trong ${path.basename(inf)}`);
  }

  fs.writeFileSync(inf, html, 'utf8');
  console.log(`  ✅ Đã cập nhật ${inf}`);
}

// ============================================================================
// Cập nhật flutter_bootstrap.js
// ============================================================================
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
  console.log(`  ✅ Bootstrap v=${TIMESTAMP} trong ${path.basename(bf)}`);
}

console.log(`\n🎉 V14 hoàn thành! Timestamp: ${TIMESTAMP}`);
console.log(`\n📌 Quan trọng: Bảo người dùng MỞ trình duyệt Safari trên iPhone và:`);
console.log(`   1. Vào Settings > Safari > Clear History and Website Data`);
console.log(`   2. HOẶC bấm giữ icon reload trên Safari -> "Request Desktop Site" rồi reload lại`);
console.log(`   3. HOẶC dùng Incognito (Private Browsing) để test`);
