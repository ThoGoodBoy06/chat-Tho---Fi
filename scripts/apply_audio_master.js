const fs = require('fs');

console.log('=== TIẾN HÀNH ÁP DỤNG AUDIO MASTER PATCH ===');

const versionTag = 'audio_master_' + Date.now();
console.log('Phiên bản mới (Cache-Busting):', versionTag);

// 1. CẬP NHẬT TẤT CẢ FILE INDEX.HTML
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const newPlayRemoteStream = `        playRemoteStream: function (stream) {
          if (!stream) return;
          var audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
          if (audioTracks.length === 0) {
            console.log('ℹ️ [playRemoteStream] Bỏ qua stream không có track audio');
            return;
          }

          // Dừng toàn bộ chuông gọi và chuông chờ
          this.stopCallRingtones();

          // Kích hoạt tất cả audio tracks
          audioTracks.forEach(function (track) {
            track.enabled = true;
            console.log('🎤 [AudioTrack LIVE]:', track.id, 'label:', track.label, 'muted:', track.muted);
            track.addEventListener('unmute', function () {
              console.log('🔊 [AudioTrack UNMUTED - PACKETS FLOWING!]:', track.id);
              var ra = document.getElementById('remoteAudioPlayer');
              if (ra) {
                ra.muted = false;
                ra.volume = 1.0;
                ra.play().catch(function () {});
              }
            });
          });

          window._activeRemoteStreamId = stream.id;
          console.log('🔊 [_callAudioEngine] Kết nối âm thanh ra loa qua #remoteAudioPlayer duy nhất...');

          // 🌟 KÊNH PHÁT DUY NHẤT: Thẻ Audio tiêu chuẩn, tránh chồng chéo nhiều thẻ gây triệt tiêu âm thanh (phase cancellation)
          var audioEl = document.getElementById('remoteAudioPlayer');
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'remoteAudioPlayer';
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.setAttribute('webkit-playsinline', 'true');
            audioEl.style.cssText = 'position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:999999;';
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = stream;
          audioEl.muted = false;
          audioEl.volume = 1.0;

          function showUnmuteOverlay() {
            var btn = document.getElementById('callAudioUnmuteBanner');
            if (!btn) {
              btn = document.createElement('div');
              btn.id = 'callAudioUnmuteBanner';
              btn.innerHTML = '🔊 <b>Bấm vào đây để bật tiếng cuộc gọi</b>';
              btn.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#10B981;color:#fff;padding:12px 24px;border-radius:24px;font-size:15px;font-family:sans-serif;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.6);z-index:2147483647;cursor:pointer;animation:pulse 1.5s infinite;';
              btn.onclick = function () {
                if (audioEl) {
                  audioEl.muted = false;
                  audioEl.volume = 1.0;
                  audioEl.play().catch(function () {});
                }
                var c = getAudioCtx();
                if (c && c.state === 'suspended') c.resume().catch(function () {});
                btn.remove();
              };
              document.body.appendChild(btn);
            }
          }

          var pAudio = audioEl.play();
          if (pAudio && pAudio.catch) {
            pAudio.catch(function (e) {
              console.warn('⚠️ audioEl.play() cần tương tác người dùng:', e);
              showUnmuteOverlay();
            });
          }

          setTimeout(function () {
            if (audioEl && audioEl.paused) {
              showUnmuteOverlay();
            } else {
              var btn = document.getElementById('callAudioUnmuteBanner');
              if (btn) btn.remove();
            }
          }, 800);
        },`;

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');

  // Thay thế playRemoteStream
  const startIdx = html.indexOf('playRemoteStream: function (stream) {');
  if (startIdx !== -1) {
    const endIdx = html.indexOf('// Đăng ký Service Worker', startIdx);
    if (endIdx !== -1) {
      // Tìm vị trí đóng ngoặc trước '// Đăng ký Service Worker'
      const funcEndIdx = html.lastIndexOf('},', endIdx) + 2;
      const oldSnippet = html.slice(startIdx, funcEndIdx);
      html = html.replace(oldSnippet, newPlayRemoteStream);
      console.log(`✅ [index.html] Đã cập nhật playRemoteStream sạch sẽ trong: ${fp}`);
    }
  }

  // Cập nhật version query
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
  bs = bs.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?v=${versionTag}`);
  fs.writeFileSync(fp, bs, 'utf8');
  console.log(`✅ [flutter_bootstrap.js] Đã cập nhật version trong: ${fp}`);
}

// 3. CẬP NHẬT CHAT_SCREEN.DART
const chatFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of chatFiles) {
  if (!fs.existsSync(fp)) continue;
  let dart = fs.readFileSync(fp, 'utf8');

  // Đảm bảo signalingState checks cho offer và answer
  const oldOfferBlock = `if (type == 'offer') {
                  await pc!.setRemoteDescription({
                    'type': 'offer',
                    'sdp': signal['sdp'],
                  });`;
  const newOfferBlock = `if (type == 'offer') {
                  if (pc!.signalingState != 'stable') {
                    print('⚠️ Bỏ qua offer trùng lặp vì signalingState là: ' + pc!.signalingState.toString());
                    return;
                  }
                  await pc!.setRemoteDescription({
                    'type': 'offer',
                    'sdp': signal['sdp'],
                  });`;

  const oldAnswerBlock = `} else if (type == 'answer') {
                  await pc!.setRemoteDescription({
                    'type': 'answer',
                    'sdp': signal['sdp'],
                  });`;
  const newAnswerBlock = `} else if (type == 'answer') {
                  if (pc!.signalingState != 'have-local-offer') {
                    print('⚠️ Bỏ qua answer trùng lặp vì signalingState là: ' + pc!.signalingState.toString());
                    return;
                  }
                  await pc!.setRemoteDescription({
                    'type': 'answer',
                    'sdp': signal['sdp'],
                  });`;

  if (dart.includes(oldOfferBlock)) {
    dart = dart.replace(oldOfferBlock, newOfferBlock);
    console.log(`✅ [chat_screen.dart] Đã thêm signalingState guard cho offer trong: ${fp}`);
  }
  if (dart.includes(oldAnswerBlock)) {
    dart = dart.replace(oldAnswerBlock, newAnswerBlock);
    console.log(`✅ [chat_screen.dart] Đã thêm signalingState guard cho answer trong: ${fp}`);
  }

  // Đảm bảo (track as dynamic).enabled = true khi addTrack
  const oldTrackAdd = `for (var track in localStream!.getTracks()) {
                    try {
                      pc!.addTrack(track, localStream!);
                    } catch (_) {}
                  }`;
  const newTrackAdd = `for (var track in localStream!.getTracks()) {
                    try {
                      (track as dynamic).enabled = true;
                      pc!.addTrack(track, localStream!);
                    } catch (_) {}
                  }`;
  if (dart.includes(oldTrackAdd)) {
    dart = dart.replace(oldTrackAdd, newTrackAdd);
    console.log(`✅ [chat_screen.dart] Đã đảm bảo track.enabled = true trong: ${fp}`);
  }

  fs.writeFileSync(fp, dart, 'utf8');
}

// 4. CẬP NHẬT MAIN.DART.JS
const mainJsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainJsFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // Đảm bảo b42 gắn listeners đúng và không bắn candidate thừa thãi
  const idxB42 = js.indexOf('b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a));');
  if (idxB42 !== -1) {
    const endB42 = js.indexOf('return s},', idxB42);
    if (endB42 !== -1) {
      const oldB42Snippet = js.slice(idxB42, endB42 + 10);
      const newB42Snippet = `b42(a){var s=new window.RTCPeerConnection(new A.Ko([],[]).lh(a));
try{
  window._activePeerConnection=s;
  s.addEventListener("track",function(e){
    console.log("🔊 [Native P2P Track]:",e.track?e.track.kind:"unknown");
    if(e.track){
      e.track.enabled=true;
      var stm=(e.streams&&e.streams[0])?e.streams[0]:new MediaStream([e.track]);
      if(stm&&window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
        window._callAudioEngine.playRemoteStream(stm);
      }
      e.track.addEventListener("unmute",function(){
        console.log("🔊 [AudioTrack UNMUTED]:",e.track.id);
        if(window._callAudioEngine&&window._callAudioEngine.playRemoteStream){
          window._callAudioEngine.playRemoteStream(stm);
        }
      });
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
      js = js.replace(oldB42Snippet, newB42Snippet);
      console.log(`✅ [main.dart.js] Đã làm sạch hook b42() trong: ${fp}`);
    }
  }

  // Đảm bảo A.avY bắn candidate chính xác
  const idxAvY = js.indexOf('A.avY.prototype={');
  if (idxAvY !== -1) {
    const endAvY = js.indexOf('$S:610}', idxAvY);
    if (endAvY !== -1) {
      const oldAvYSnippet = js.slice(idxAvY, endAvY + 7);
      const newAvYSnippet = `A.avY.prototype={
$1(a){try{var s,r,q=a?a.candidate:null,tgt=this.a||window._currentCallPartnerId||window._currentCallerId||"";
if(q!=null&&q.candidate!=null&&tgt){s=$.bj;
if(s!=null){r=t.N;
s.cn("webrtc_signal",A.V(["connectedUserId",tgt,"signal",A.V(["type","candidate","candidate",q.candidate,"sdpMid",q.sdpMid,"sdpMLineIndex",q.sdpMLineIndex],r,t.X)],r,t.K))}}}catch(_){}},
$S:610}`;
      js = js.replace(oldAvYSnippet, newAvYSnippet);
      console.log(`✅ [main.dart.js] Đã chuẩn hóa A.avY trong: ${fp}`);
    }
  }

  fs.writeFileSync(fp, js, 'utf8');
}

console.log('=== HOÀN THÀNH ÁP DỤNG AUDIO MASTER PATCH ===');
