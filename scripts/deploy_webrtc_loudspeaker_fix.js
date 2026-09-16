const fs = require('fs');

console.log('🚀 [DEPLOY FIX] Deploying Loudspeaker & Web Audio API WebRTC fix...');

const cacheVer = 'audio_speaker_' + Date.now();
console.log('🔑 New Cache-busting version token:', cacheVer);

// 1. Sync webrtc_audio_helper.js
const helperContent = fs.readFileSync('public/webrtc_audio_helper.js', 'utf8');
const helperTargets = [
  'flutter_frontend/web/webrtc_audio_helper.js',
  'flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js'
];

for (const target of helperTargets) {
  try {
    fs.writeFileSync(target, helperContent, 'utf8');
    console.log('✅ Synced helper to:', target);
  } catch (err) {
    console.warn('⚠️ Sync warning for', target, err.message);
  }
}

// 2. Update cache busting in public/index.html & flutter_bootstrap.js
const indexFiles = [
  'public/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  html = html.replace(/main\.dart\.js\?v=[a-zA-Z0-9_-]+/g, `main.dart.js?v=${cacheVer}`);
  html = html.replace(/flutter_bootstrap\.js\?v=[a-zA-Z0-9_-]+/g, `flutter_bootstrap.js?v=${cacheVer}`);
  html = html.replace(/webrtc_audio_helper\.js(\?v=[a-zA-Z0-9_-]+)?/g, `webrtc_audio_helper.js?v=${cacheVer}`);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ Updated cache-busting URLs in:', fp);
}

const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

for (const fp of bootstrapFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');
  js = js.replace(/main\.dart\.js\?v=[a-zA-Z0-9_-]+/g, `main.dart.js?v=${cacheVer}`);
  fs.writeFileSync(fp, js, 'utf8');
  console.log('✅ Updated cache-busting in bootstrap:', fp);
}

// 3. Patch main.dart.js files
const mainFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // A. Hook b42
  const b42OldMarker = 'b42(a){';
  const b42NewCode = `b42(a){
  var rtcCfg = null;
  try {
    rtcCfg = new A.Ko([],[]).lh(a) || {};
    rtcCfg.iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ];
    rtcCfg.iceCandidatePoolSize = 10;
  } catch(e) { rtcCfg = new A.Ko([],[]).lh(a); }
  var s = new window.RTCPeerConnection(rtcCfg);
  try {
    window._activePeerConnection = s;
    s.addEventListener("iceconnectionstatechange", function() {
      console.log("⚡ [Native P2P ICE State]:", s.iceConnectionState);
      if (s.iceConnectionState === "failed" && s.restartIce) {
        console.log("⚠️ [Native P2P ICE] failed -> calling restartIce()...");
        try { s.restartIce(); } catch(err) {}
      }
    });
    s.addEventListener("track", function(e) {
      console.log("🔊 [Native P2P Track]:", e.track ? e.track.kind : "unknown", e.streams);
      var stm = (e.streams && e.streams[0]) ? e.streams[0] : (e.track ? new MediaStream([e.track]) : null);
      if (stm) {
        if (window.attachRemoteStream) {
          window.attachRemoteStream(stm);
        }
        if (window._callAudioEngine && window._callAudioEngine.playRemoteStream) {
          window._callAudioEngine.playRemoteStream(stm);
        }
      }
    });
    s.addEventListener("addstream", function(e) {
      console.log("🔊 [Native P2P AddStream]:", e.stream ? e.stream.id : "null");
      if (e.stream) {
        if (window.attachRemoteStream) {
          window.attachRemoteStream(e.stream);
        }
        if (window._callAudioEngine && window._callAudioEngine.playRemoteStream) {
          window._callAudioEngine.playRemoteStream(e.stream);
        }
      }
    });
  } catch(hkErr) { console.warn("Lỗi hook RTCPeerConnection b42:", hkErr); }
  return s},`;

  if (js.includes('b42(a){')) {
    const idx = js.indexOf('b42(a){');
    const endIdx = js.indexOf('return s},', idx);
    if (endIdx !== -1) {
      js = js.slice(0, idx) + b42NewCode + js.slice(endIdx + 10);
      console.log('✅ Re-patched b42 in:', fp);
    }
  }

  // B. Hook unlockAudio into unlockCallAudio
  if (js.includes('unlockCallAudio()') && !js.includes('window.unlockAudio()')) {
    js = js.replace(/window\._callAudioEngine\.unlockCallAudio\(\)/g, 'try{if(window.unlockAudio)window.unlockAudio();}catch(_){};if(window._callAudioEngine)window._callAudioEngine.unlockCallAudio()');
  }

  fs.writeFileSync(fp, js, 'utf8');
  console.log('✅ Finished patching main bundle:', fp);
}

console.log('🎉 [DEPLOY FIX] Completed Loudspeaker WebRTC deployment script!');
