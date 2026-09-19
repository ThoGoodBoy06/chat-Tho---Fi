const fs = require("fs");
const path = require("path");

const files = [
  "flutter_frontend/build/web/index.html",
  "public/index.html",
  "flutter_frontend/web/index.html",
  "backend/public/index.html",
  "backend/flutter_frontend/build/web/index.html"
];

const badPattern = /\/\/\s*Không phụ thuộc main\.dart\.js[^\r\n]*[\r\n]+\s*var calleeId =/g;
const goodReplacement = `// Không phụ thuộc main.dart.js
    (function() {
      var _pollInterval = null;
      var _pollDelay = 600;
      function _doCallStatusCheck() {
        var callerId = window._currentIncomingCallerId || window._currentCallerId || "";
        var calleeId =`;

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, "utf8");
    if (badPattern.test(c)) {
      c = c.replace(badPattern, goodReplacement);
      // Close the IIFE properly at the end of that script block
      const stopPollPattern = /clearInterval\(_pollInterval\);\s*_pollInterval = null;\s*console\.log\('\[Call-V14\] Đã dừng polling\.'\);\s*\}\s*\}\s*<\/script>/;
      if (stopPollPattern.test(c)) {
        c = c.replace(stopPollPattern, `clearInterval(_pollInterval);
        _pollInterval = null;
        console.log('[Call-V14] Đã dừng polling.');
      }
    }
    window._startCallPolling = _startPoll;
    window._stopCallPolling = _stopPoll;
  })();
  </script>`);
      }
      fs.writeFileSync(f, c, "utf8");
      console.log("Fixed syntax error in:", f);
    } else {
      console.log("No syntax error in:", f);
    }
  }
});
