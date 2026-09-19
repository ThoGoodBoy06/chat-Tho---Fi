const fs = require('fs');
const files = [
  'flutter_frontend/build/web/webrtc_audio_helper.js',
  'public/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js'
];
const hook = `
  window.addEventListener('error', function(e) {
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'window.onerror',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error ? e.error.stack : null
        })
      }).catch(function(){});
    } catch(_) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'unhandledrejection',
          reason: e.reason ? (e.reason.message || String(e.reason)) : null,
          stack: e.reason ? e.reason.stack : null
        })
      }).catch(function(){});
    } catch(_) {}
  });
`;
files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('/api/client-error')) {
      content = content.replace('window.openImageModal = function', hook + '\n  window.openImageModal = function');
      fs.writeFileSync(f, content, 'utf8');
      console.log('Hook added to:', f);
    }
  }
});
