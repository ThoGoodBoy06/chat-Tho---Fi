const fs = require('fs');

console.log('=== FIX TRIỆT ĐỂ BẢO VỆ LUỒNG ÂM THANH KHÔNG BỊ TỰ NGẮT/TỰ MUTE ===');

// 1. CẬP NHẬT INDEX.HTML
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const newEngineMethods = `        stopCallRingtones: function () {
          var ring = document.getElementById('callRingtoneAudio');
          if (ring) { ring.pause(); ring.currentTime = 0; }
          var tut = document.getElementById('callTutTutAudio');
          if (tut) { tut.pause(); tut.currentTime = 0; }
        },
        stopAllCallSounds: function () {
          this.stopCallRingtones();
          var end = document.getElementById('callEndAudio');
          if (end) { end.pause(); end.currentTime = 0; }
          window._activeRemoteStreamId = null;
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
          // Chỉ xử lý nếu stream có chứa track âm thanh (bỏ qua video-only)
          var audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          if (audioTracks.length === 0) {
            console.log('ℹ️ [playRemoteStream] Bỏ qua stream không có track audio');
            return;
          }

          // Dừng chuông gọi đến và tút tút - TUYỆT ĐỐI KHÔNG ngắt luồng đàm thoại
          this.stopCallRingtones();

          // Kích hoạt tất cả track audio
          audioTracks.forEach(function (track) {
            track.enabled = true;
            console.log('🎤 [AudioTrack LIVE]:', track.id, 'label:', track.label, 'enabled:', track.enabled);
          });

          // Nếu luồng này đã kết nối và đang phát, giữ nguyên không ngắt quãng
          if (window._activeRemoteStreamId === stream.id && window._remoteAudioSourceNode) {
            console.log('ℹ️ [playRemoteStream] Luồng audio đang phát ổn định, tiếp tục duy trì.');
            return;
          }
          window._activeRemoteStreamId = stream.id;

          console.log('🔊 [_callAudioEngine] Đang kết nối luồng đàm thoại ra loa ngoài...');

          // KÊNH 1: Web Audio API - Nối thẳng vào loa hệ thống (Bỏ qua giới hạn thẻ audio)
          try {
            var ctx = getAudioCtx();
            if (ctx) {
              if (ctx.state === 'suspended') {
                ctx.resume().catch(function () {});
              }
              if (window._remoteAudioSourceNode) {
                try { window._remoteAudioSourceNode.disconnect(); } catch (_) {}
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
              console.log('✅ [_callAudioEngine] Web Audio API đã nối trực tiếp ra loa hệ điều hành!');
            }
          } catch (ctxErr) {
            console.warn('⚠️ Web Audio API note:', ctxErr);
          }

          // KÊNH 2: Thẻ Video playsinline chuyên biệt cho iOS Safari & WebKit di động
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
            if (mediaEl.srcObject !== stream) {
              mediaEl.srcObject = stream;
            }
            mediaEl.muted = false;
            mediaEl.volume = 1.0;
            var pMedia = mediaEl.play();
            if (pMedia && pMedia.catch) {
              pMedia.catch(function (e) {
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
          try {
            var audioEl = document.getElementById('remoteAudioPlayer');
            if (!audioEl) {
              audioEl = document.createElement('audio');
              audioEl.id = 'remoteAudioPlayer';
              audioEl.autoplay = true;
              audioEl.setAttribute('playsinline', 'true');
              audioEl.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:999999;';
              document.body.appendChild(audioEl);
            }
            if (audioEl.srcObject !== stream) {
              audioEl.srcObject = stream;
            }
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
          } catch(e) {}
        }`;

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const startMarker = 'stopAllCallSounds: function () {';
  const endFuncMarker = '};\n    })();\n  </script>';

  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endFuncMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    html = html.slice(0, startIdx) + newEngineMethods + '\n      ' + html.slice(endIdx);
    fs.writeFileSync(fp, html, 'utf8');
    console.log(`✅ Đã bảo vệ luồng đàm thoại trong: ${fp}`);
  }
}

// 2. CẬP NHẬT MAIN.DART.JS ĐỂ BẢO VỆ CHỈ CHUYỂN TRACK AUDIO
const mainJsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainJsFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // Chỉ gọi playRemoteStream cho track audio ở b42 hook
  const oldTrackHook = 's.addEventListener("track",function(e){\n    console.log("🔊 [Native P2P Track]:",e.track?e.track.kind:"unknown",e.streams);\n    var stm=(e.streams&&e.streams[0])?e.streams[0]:(e.track?new MediaStream([e.track]):null);\n    if(stm&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){\n      window._callAudioEngine.playRemoteStream(stm);\n    }\n  });';
  const newTrackHook = 's.addEventListener("track",function(e){\n    console.log("🔊 [Native P2P Track]:",e.track?e.track.kind:"unknown");\n    if(e.track&&e.track.kind==="audio"){\n      var stm=(e.streams&&e.streams[0])?e.streams[0]:new MediaStream([e.track]);\n      if(stm&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){\n        window._callAudioEngine.playRemoteStream(stm);\n      }\n    }\n  });';

  if (js.includes(oldTrackHook)) {
    js = js.replace(oldTrackHook, newTrackHook);
    console.log(`✅ [main.dart.js] Đã lọc chỉ nhận audio track trong b42: ${fp}`);
  }

  // Đổi query version để bust cache
  const ts = Date.now().toString();
  fs.writeFileSync(fp, js, 'utf8');
}

console.log('=== HOÀN TẤT BẢO VỆ LUỒNG ÂM THANH ===');
