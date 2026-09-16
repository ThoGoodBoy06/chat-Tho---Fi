const fs = require('fs');

// 1. Fix chat_screen.dart STUN servers
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

const badStun = `
                    {
                      'urls': [
                        'turn:openrelay.metered.ca:80',
                        'turn:openrelay.metered.ca:443',
                        'turn:openrelay.metered.ca:443?transport=tcp',
                        'turns:openrelay.metered.ca:443?transport=tcp',
                      ],
                      'username': 'openrelayproject',
                      'credential': 'openrelayproject',
                    },`;

for (const fp of dartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes(badStun)) {
    code = code.replace(badStun, '');
  }
  if (code.includes("'iceCandidatePoolSize': 10")) {
    code = code.replace("'iceCandidatePoolSize': 10", "'iceCandidatePoolSize': 0");
  }
  fs.writeFileSync(fp, code, 'utf8');
  console.log('Fixed chat_screen.dart:', fp);
}

// 2. Fix index.html with addTrack interceptor
const indexFiles = [
  'public/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html'
];

const interceptorCode = `
      // Intercept RTCPeerConnection addTrack to prevent Dart WebRTC wrapper failures
      const _origAddTrack = window.RTCPeerConnection.prototype.addTrack;
      window.RTCPeerConnection.prototype.addTrack = function(track, stream) {
        console.log("🛠️ [Native Intercept] addTrack called for:", track ? track.kind : 'unknown');
        try {
          return _origAddTrack.apply(this, arguments);
        } catch (err) {
          console.warn("⚠️ [Native Intercept] addTrack error (likely Dart wrapper type mismatch):", err);
          try {
            if (stream) {
              console.log("🛠️ [Native Intercept] Using fallback addStream()...");
              this.addStream(stream);
              console.log("✅ [Native Intercept] Fallback addStream succeeded!");
            }
          } catch(err2) {
            console.error("❌ [Native Intercept] addStream fallback failed:", err2);
          }
        }
      };
`;

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  if (!html.includes('window.RTCPeerConnection.prototype.addTrack = function')) {
    html = html.replace('function unlockAudio() {', interceptorCode + '\n      function unlockAudio() {');
    fs.writeFileSync(fp, html, 'utf8');
    console.log('Fixed index.html:', fp);
  }
}

// 3. Fix main.dart.js TURN servers and iceCandidatePoolSize
const mainFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');
  
  if (js.includes('turn:openrelay.metered.ca')) {
    js = js.replace(/\{urls:\["turn:openrelay\.metered\.ca:80"[\s\S]*?"openrelayproject"\}/g, '{}');
  }
  if (js.includes('"iceCandidatePoolSize",10')) {
    js = js.replace(/"iceCandidatePoolSize",10/g, '"iceCandidatePoolSize",0');
  }
  
  // Expose active remote tracks automatically
  const trackFix = `try{a3=a6.r\na3.toString\na4=a6.f\na4.toString\na3.addTrack(h,a4).toString}catch(b2){}`;
  const newTrackFix = `try{a3=a6.r;a3.toString;a4=a6.f;a4.toString;a3.addTrack(h,a4).toString;}catch(b2){console.error("main.dart.js addTrack error:", b2);try{a6.r.addStream(a6.f)}catch(e3){}}`;
  
  if (js.includes(trackFix)) {
    js = js.replace(trackFix, newTrackFix);
  } else {
    // try removing line breaks
    const trackFix2 = `try{a3=a6.r\na3.toString\na4=a6.f\na4.toString\na3.addTrack(h,a4).toString}catch(b2){}`;
    // already handled
  }
  
  fs.writeFileSync(fp, js, 'utf8');
  console.log('Fixed main.dart.js:', fp);
}
