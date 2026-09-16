const fs = require('fs');
const path = require('path');

console.log('=== BẮT ĐẦU FIX TRIỆT ĐỂ LỖI NÓI CHUYỆN KHÔNG NGHE (WEBRTC AUDIO 2 CHIỀU) ===');

// 1. CẬP NHẬT INDEX.HTML (TẤT CẢ CÁC BẢN)
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const newPlayRemoteStream = `        stopAllCallSounds: function () {
          var ring = document.getElementById('callRingtoneAudio');
          if (ring) { ring.pause(); ring.currentTime = 0; }
          var tut = document.getElementById('callTutTutAudio');
          if (tut) { tut.pause(); tut.currentTime = 0; }
          var end = document.getElementById('callEndAudio');
          if (end) { end.pause(); end.currentTime = 0; }
          if (window._remoteAudioSourceNode) {
            try { window._remoteAudioSourceNode.disconnect(); } catch(_) {}
            window._remoteAudioSourceNode = null;
          }
          var me = document.getElementById('remoteAudioMediaElement');
          if (me) { try { me.pause(); me.srcObject = null; } catch(_) {} }
          var ra = document.getElementById('remoteAudioPlayer');
          if (ra) { try { ra.pause(); ra.srcObject = null; } catch(_) {} }
        },
        playRemoteStream: function (stream) {
          if (!stream) return;
          this.stopAllCallSounds();
          console.log('🔊 [_callAudioEngine] Đang kích hoạt toàn bộ luồng đàm thoại 2 chiều...');
          try {
            if (stream.getAudioTracks) {
              stream.getAudioTracks().forEach(function (track) {
                track.enabled = true;
                console.log('🎤 [playRemoteStream] Audio Track:', track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
              });
            }

            // KÊNH 1: Web Audio API - Bơm trực tiếp vào loa hệ thống (Bỏ qua giới hạn thẻ audio)
            try {
              var ctx = getAudioCtx();
              if (ctx) {
                if (ctx.state === 'suspended') {
                  ctx.resume().catch(function () {});
                }
                if (window._remoteAudioSourceNode) {
                  try { window._remoteAudioSourceNode.disconnect(); } catch(_) {}
                }
                window._remoteAudioSourceNode = ctx.createMediaStreamSource(stream);
                var gain = ctx.createGain ? ctx.createGain() : null;
                if (gain) {
                  gain.gain.value = 1.0;
                  window._remoteAudioSourceNode.connect(gain);
                  gain.connect(ctx.destination);
                } else {
                  window._remoteAudioSourceNode.connect(ctx.destination);
                }
                console.log('✅ [_callAudioEngine] Web Audio API đã nối trực tiếp ra loa ngoài!');
              }
            } catch (ctxErr) {
              console.warn('⚠️ Web Audio API stream bridge note:', ctxErr);
            }

            // KÊNH 2: Thẻ Video playsinline chuyên dụng cho iOS Safari & Mobile WebKit
            try {
              var mediaEl = document.getElementById('remoteAudioMediaElement');
              if (!mediaEl) {
                mediaEl = document.createElement('video');
                mediaEl.id = 'remoteAudioMediaElement';
                mediaEl.setAttribute('playsinline', 'true');
                mediaEl.setAttribute('webkit-playsinline', 'true');
                mediaEl.autoplay = true;
                mediaEl.muted = false;
                mediaEl.volume = 1.0;
                mediaEl.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:999999;';
                document.body.appendChild(mediaEl);
              }
              mediaEl.srcObject = stream;
              mediaEl.muted = false;
              mediaEl.volume = 1.0;
              var pMedia = mediaEl.play();
              if (pMedia && pMedia.catch) {
                pMedia.catch(function (e) {
                  console.warn('⚠️ Remote media element play deferred:', e);
                  var unlock = function () {
                    mediaEl.play().catch(function () {});
                    window.removeEventListener('click', unlock);
                    window.removeEventListener('touchstart', unlock);
                  };
                  window.addEventListener('click', unlock, { once: true, passive: true });
                  window.addEventListener('touchstart', unlock, { once: true, passive: true });
                });
              }
            } catch(e) {}

            // KÊNH 3: Thẻ Audio tiêu chuẩn
            var audioEl = document.getElementById('remoteAudioPlayer');
            if (!audioEl) {
              audioEl = document.createElement('audio');
              audioEl.id = 'remoteAudioPlayer';
              document.body.appendChild(audioEl);
            }
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:999999;';
            audioEl.srcObject = stream;
            audioEl.muted = false;
            audioEl.volume = 1.0;

            var p = audioEl.play();
            if (p && p.catch) {
              p.catch(function (err) {
                var retryPlay = function () {
                  audioEl.play().catch(function () {});
                  window.removeEventListener('click', retryPlay);
                  window.removeEventListener('touchstart', retryPlay);
                };
                window.addEventListener('click', retryPlay, { once: true, passive: true });
                window.addEventListener('touchstart', retryPlay, { once: true, passive: true });
              });
            }
            console.log('✅ [_callAudioEngine] Đã kích hoạt 3 kênh phát âm thanh ra loa ngoài!');
          } catch (e) {
            console.error('❌ [_callAudioEngine] Lỗi phát âm thanh:', e);
          }
        }`;

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const startMarker = 'stopAllCallSounds: function () {';
  const endMarker = 'window._callAudioEngine = {';
  const endFuncMarker = '};\n    })();\n  </script>';
  
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endFuncMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    html = html.slice(0, startIdx) + newPlayRemoteStream + '\n      ' + html.slice(endIdx);
    fs.writeFileSync(fp, html, 'utf8');
    console.log(`✅ Đã cập nhật 3 kênh âm thanh đàm thoại trong: ${fp}`);
  } else {
    console.warn(`⚠️ Không tìm thấy vị trí khớp trong ${fp}`);
  }
}

// 2. CẬP NHẬT MAIN.DART.JS
const mainJsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainJsFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // A. Đổi iceCandidatePoolSize từ 10 thành 0 để tránh pre-gather mất candidate
  if (js.includes('"iceCandidatePoolSize",10]')) {
    js = js.replace('"iceCandidatePoolSize",10]', '"iceCandidatePoolSize",0]');
    console.log(`✅ [main.dart.js] Đã đặt iceCandidatePoolSize = 0 trong: ${fp}`);
  }

  // B. Hook b42(a) để gắn icecandidate, track, addstream NGAY LẬP TỨC đồng bộ
  const oldB42 = `b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a))\ns.toString\nreturn s},`;
  const newB42 = `b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a))\ns.toString
try{
  window._activePeerConnection=s;
  s.addEventListener("icecandidate",function(e){
    if(e&&e.candidate&&e.candidate.candidate){
      var pid=window._currentCallPartnerId||"";
      console.log("⚡ [Native P2P ICE] Gửi candidate tới:",pid,e.candidate.candidate);
      if(typeof $!=="undefined"&&$.bj&&pid){
        try{
          var r=(typeof t!=="undefined"&&t.N)?t.N:null;
          if(typeof A!=="undefined"&&A.V&&r&&t.X&&t.K){
            $.bj.cn("webrtc_signal",A.V(["connectedUserId",pid,"signal",A.V(["type","candidate","candidate",e.candidate.candidate,"sdpMid",e.candidate.sdpMid,"sdpMLineIndex",e.candidate.sdpMLineIndex],r,t.X)],r,t.K));
          }
        }catch(err){console.warn("Lỗi emit candidate:",err);}
      }
    }
  });
  s.addEventListener("track",function(e){
    console.log("🔊 [Native P2P Track]:",e.track?e.track.kind:"unknown",e.streams);
    var stm=(e.streams&&e.streams[0])?e.streams[0]:(e.track?new MediaStream([e.track]):null);
    if(stm&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
      window._callAudioEngine.playRemoteStream(stm);
    }
  });
  s.addEventListener("addstream",function(e){
    console.log("🔊 [Native P2P AddStream]:",e.stream?e.stream.id:"null");
    if(e.stream&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
      window._callAudioEngine.playRemoteStream(e.stream);
    }
  });
}catch(hkErr){console.warn("Lỗi hook RTCPeerConnection:",hkErr);}
return s},`;

  if (js.includes(oldB42)) {
    js = js.replace(oldB42, newB42);
    console.log(`✅ [main.dart.js] Đã gắn Native Hook đồng bộ cho b42() trong: ${fp}`);
  }

  // C. Cập nhật A.avY để có fallback partnerId an toàn
  const oldAvY = `A.avY.prototype={\n$1(a){var s,r,q=a.candidate\nif(q!=null&&q.candidate!=null){s=$.bj\nif(s!=null){r=t.N\ns.cn("webrtc_signal",A.V(["connectedUserId",this.a,"signal",A.V(["type","candidate","candidate",q.candidate,"sdpMid",q.sdpMid,"sdpMLineIndex",q.sdpMLineIndex],r,t.X)],r,t.K))}}},`;
  const newAvY = `A.avY.prototype={\n$1(a){try{var s,r,q=a.candidate,tgt=this.a||window._currentCallPartnerId||"";\nif(q!=null&&q.candidate!=null&&tgt){s=$.bj\nif(s!=null){r=t.N\ns.cn("webrtc_signal",A.V(["connectedUserId",tgt,"signal",A.V(["type","candidate","candidate",q.candidate,"sdpMid",q.sdpMid,"sdpMLineIndex",q.sdpMLineIndex],r,t.X)],r,t.K))}}}catch(_){}}},`;

  if (js.includes(oldAvY)) {
    js = js.replace(oldAvY, newAvY);
    console.log(`✅ [main.dart.js] Đã vá A.avY an toàn trong: ${fp}`);
  }

  fs.writeFileSync(fp, js, 'utf8');
}

// 3. CẬP NHẬT CHAT_SCREEN.DART
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of dartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // Đổi iceCandidatePoolSize từ 10 thành 0
  if (code.includes("'iceCandidatePoolSize': 10")) {
    code = code.replace("'iceCandidatePoolSize': 10", "'iceCandidatePoolSize': 0");
    console.log(`✅ [chat_screen.dart] Đã đặt iceCandidatePoolSize = 0 trong: ${fp}`);
  }

  // Đảm bảo audio track của localStream luôn enabled
  if (code.contains && !code.includes('track.enabled = true') && code.includes('pc!.addTrack(track, localStream!);')) {
    code = code.replace('pc!.addTrack(track, localStream!);', '(track as dynamic).enabled = true;\n                      pc!.addTrack(track, localStream!);');
  }

  fs.writeFileSync(fp, code, 'utf8');
}

// 4. BUST SERVICE WORKER CACHE
const swFiles = [
  'public/flutter_service_worker.js',
  'flutter_frontend/build/web/flutter_service_worker.js',
  'backend/flutter_frontend/build/web/flutter_service_worker.js'
];
const newVer = Date.now().toString();
for (const fp of swFiles) {
  if (!fs.existsSync(fp)) continue;
  let sw = fs.readFileSync(fp, 'utf8');
  sw = sw.replace(/const CORE = \[[^\]]*\];/, `const CORE = ["/main.dart.js?v=${newVer}", "/index.html?v=${newVer}"];`);
  fs.writeFileSync(fp, sw, 'utf8');
  console.log(`✅ Cache busted service worker: ${fp}`);
}

console.log('=== HOÀN TẤT VÁ ÂM THANH WEBRTC 2 CHIỀU ===');
