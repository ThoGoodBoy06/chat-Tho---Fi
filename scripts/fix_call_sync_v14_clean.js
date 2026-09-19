const fs = require("fs");

const files = [
  "flutter_frontend/build/web/index.html",
  "public/index.html",
  "flutter_frontend/web/index.html",
  "backend/public/index.html",
  "backend/flutter_frontend/build/web/index.html"
];

const callSyncV14Clean = `  <script>
    // ============================================================
    // [Call Sync V14] Standalone polling + dismiss
    // Không phụ thuộc main.dart.js, chạy ngay từ index.html
    // ============================================================
    (function() {
      var _pollInterval = null;
      var _pollDelay = 600; // ms

      function _doCallStatusCheck() {
        var callerId = window._currentIncomingCallerId || window._currentCallerId || '';
        var calleeId = window._currentUserId || (typeof $ !== 'undefined' && $.aLM) || '';
        if (!callerId && !calleeId) return;
        var bUrl = (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('workers.dev') || window.location.hostname.includes('cloudflare'))
          ? 'https://chat-tho-fi-vn-9s8u.onrender.com'
          : '';
        fetch(bUrl + '/api/call/status?callerId=' + encodeURIComponent(callerId)
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
        setTimeout(_doCallStatusCheck, 300);
      }

      function _stopPoll() {
        if (_pollInterval) {
          clearInterval(_pollInterval);
          _pollInterval = null;
          console.log('[Call-V14] Đã dừng polling.');
        }
      }

      window._startCallStatusPolling = function(callerId, calleeId) {
        window._currentCallerId = callerId;
        _startPoll();
      };
      window._stopCallStatusPolling = _stopPoll;

      function _onResume() {
        var isShowing = window._incomingCallShowing || window._incomingRejectAction;
        if (isShowing) {
          console.log('[Call-V14] App visible lại, kiểm tra trạng thái cuộc gọi...');
          _doCallStatusCheck();
          if (!_pollInterval) _startPoll();
        }
      }

      window.addEventListener('focus', _onResume);
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') _onResume();
      });

      console.log('[Call-V14] Polling module loaded successfully.');
    })();
  </script>`;

const blockRegex = /<script>\s*\/\/\s*={2,}\s*[\r\n]+\s*\/\/\s*\[Call Sync V14\][\s\S]*?<\/script>/;

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (blockRegex.test(content)) {
      content = content.replace(blockRegex, callSyncV14Clean);
      fs.writeFileSync(f, content, 'utf8');
      console.log('✓ Cleanly replaced Call Sync V14 in:', f);
    } else {
      console.log('Pattern not matched in:', f);
    }
  }
});
