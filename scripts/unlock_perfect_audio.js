const fs = require('fs');

console.log('=== TIẾN HÀNH FIX TRIỆT ĐỂ: MỞ KHÓA AUDIO PHẦN CỨNG 100% ===');

const versionTag = 'audio_unlocked_' + Date.now();
console.log('Phiên bản mới:', versionTag);

// 1. CẬP NHẬT TẤT CẢ FILE INDEX.HTML
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const newEngineMethods = `        unlockCallAudio: function () {
          try {
            var ctx = getAudioCtx();
            if (ctx && ctx.state === 'suspended') {
              ctx.resume().catch(function () {});
            }

            // 🌟 TẠO VÀ MỞ KHÓA #remoteAudioPlayer NGAY TRONG LÚC USER BẤM NÚT (TRUSTED USER GESTURE)
            var ra = document.getElementById('remoteAudioPlayer');
            if (!ra) {
              ra = document.createElement('audio');
              ra.id = 'remoteAudioPlayer';
              ra.autoplay = true;
              ra.setAttribute('playsinline', 'true');
              ra.setAttribute('webkit-playsinline', 'true');
              ra.style.cssText = 'position:fixed;bottom:10px;right:10px;width:60px;height:30px;opacity:0.05;pointer-events:none;z-index:999999;';
              document.body.appendChild(ra);
            }
            ra.muted = false;
            ra.volume = 1.0;

            // Kích hoạt audio bằng data URI wav im lặng (chỉ 44 bytes) để trình duyệt cấp phép vĩnh viễn
            if (!ra.srcObject) {
              ra.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
              var p = ra.play();
              if (p && p.catch) p.catch(function () {});
              console.log('🔓 [CallAudioEngine] #remoteAudioPlayer đã được mở khóa Autoplay trong User Gesture!');
            }
          } catch(err) {
            console.warn('unlockCallAudio error:', err);
          }
        },
        playRemoteStream: function (stream) {
          if (!stream) return;
          var audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          if (audioTracks.length === 0) {
            console.log('ℹ️ [playRemoteStream] Bỏ qua stream không có track audio');
            return;
          }

          // Dừng toàn bộ chuông gọi và chuông chờ
          this.stopCallRingtones();

          var audioEl = document.getElementById('remoteAudioPlayer');
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'remoteAudioPlayer';
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.setAttribute('webkit-playsinline', 'true');
            audioEl.style.cssText = 'position:fixed;bottom:10px;right:10px;width:60px;height:30px;opacity:0.05;pointer-events:none;z-index:999999;';
            document.body.appendChild(audioEl);
          }

          // Gán stream trực tiếp vào phần tử âm thanh
          try {
            audioEl.pause();
            audioEl.removeAttribute('src');
            audioEl.srcObject = stream;
            audioEl.muted = false;
            audioEl.volume = 1.0;
          } catch(e) {
            console.warn('Gán stream lỗi:', e);
          }

          // Kích hoạt tất cả audio tracks và gắn listener unmute
          audioTracks.forEach(function (track) {
            track.enabled = true;
            console.log('🎤 [AudioTrack LIVE]:', track.id, 'label:', track.label, 'muted:', track.muted);
            track.addEventListener('unmute', function () {
              console.log('🔊 [AudioTrack UNMUTED - PACKETS FLOWING!]:', track.id);
              if (audioEl) {
                audioEl.muted = false;
                audioEl.volume = 1.0;
                audioEl.play().catch(function () {});
              }
            });
          });

          window._activeRemoteStreamId = stream.id;
          console.log('🔊 [_callAudioEngine] Đang phát âm thanh WebRTC ra loa...');

          var pAudio = audioEl.play();
          if (pAudio && pAudio.catch) {
            pAudio.catch(function (err) {
              console.warn('⚠️ audioEl.play() bị chặn:', err);
              setTimeout(function () {
                if (audioEl) {
                  audioEl.muted = false;
                  audioEl.volume = 1.0;
                  audioEl.play().catch(function () {});
                }
              }, 300);
            });
          }
        }`;

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');

  // Tìm vị trí unlockCallAudio và playRemoteStream
  const startIdx = html.indexOf('unlockCallAudio: function () {');
  if (startIdx !== -1) {
    const endIdx = html.indexOf('// Đăng ký Service Worker', startIdx);
    if (endIdx !== -1) {
      const funcEndIdx = html.lastIndexOf('};', endIdx) + 1;
      const oldSnippet = html.slice(startIdx, funcEndIdx);
      html = html.replace(oldSnippet, newEngineMethods);
      console.log(`✅ [index.html] Đã cập nhật unlockCallAudio & playRemoteStream trong: ${fp}`);
    }
  }

  // Cập nhật version tag
  html = html.replace(/flutter_bootstrap\.js\?v=[^"']+/g, `flutter_bootstrap.js?v=${versionTag}`);
  html = html.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?v=${versionTag}`);
  html = html.replace(/flutter_service_worker\.js\?v=[^"']+/g, `flutter_service_worker.js?v=${versionTag}.2.1`);

  fs.writeFileSync(fp, html, 'utf8');
}

// 2. CẬP NHẬT FLUTTER_BOOTSTRAP.JS
const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

for (const fp of bootstrapFiles) {
  if (!fs.existsSync(fp)) continue;
  let bs = fs.readFileSync(fp, 'utf8');
  bs = bs.replace(/"mainJsPath":\s*"main\.dart\.js\?v=[^"]*"/g, `"mainJsPath":"main.dart.js?v=${versionTag}"`);
  fs.writeFileSync(fp, bs, 'utf8');
  console.log(`✅ [flutter_bootstrap.js] Đã cập nhật version tag mới trong: ${fp}`);
}

// 3. CẬP NHẬT CHAT_SCREEN.DART: Gọi unlockCallAudio ngay khi bấm nút Gọi hoặc Bắt máy
const chatFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of chatFiles) {
  if (!fs.existsSync(fp)) continue;
  let dart = fs.readFileSync(fp, 'utf8');

  // Trong _startCall: Gọi unlockCallAudio ngay
  const oldStartCallAudio = `final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
    audioPlayer?.muted = false;
    audioPlayer?.volume = 1.0;`;
  const newStartCallAudio = `try {
      final engine = (html.window as dynamic)._callAudioEngine;
      if (engine != null && engine.unlockCallAudio != null) {
        engine.unlockCallAudio();
      }
    } catch (_) {}
    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
    audioPlayer?.muted = false;
    audioPlayer?.volume = 1.0;`;

  if (dart.includes(oldStartCallAudio)) {
    dart = dart.replace(oldStartCallAudio, newStartCallAudio);
    console.log(`✅ [chat_screen.dart] Đã thêm unlockCallAudio trong _startCall trong: ${fp}`);
  }

  // Trong Trả lời (Answer button): Gọi unlockCallAudio ngay
  const oldAnswerAudio = `SoundService.stopAllCallSounds();
                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
                                    audioPlayer?.muted = false;
                                    audioPlayer?.volume = 1.0;`;
  const newAnswerAudio = `SoundService.stopAllCallSounds();
                                    try {
                                      final engine = (html.window as dynamic)._callAudioEngine;
                                      if (engine != null && engine.unlockCallAudio != null) {
                                        engine.unlockCallAudio();
                                      }
                                    } catch (_) {}
                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
                                    audioPlayer?.muted = false;
                                    audioPlayer?.volume = 1.0;`;

  if (dart.includes(oldAnswerAudio)) {
    dart = dart.replace(oldAnswerAudio, newAnswerAudio);
    console.log(`✅ [chat_screen.dart] Đã thêm unlockCallAudio trong Answer button trong: ${fp}`);
  }

  fs.writeFileSync(fp, dart, 'utf8');
}

console.log('=== HOÀN TẤT VÁ MỞ KHÓA AUDIO ===');
