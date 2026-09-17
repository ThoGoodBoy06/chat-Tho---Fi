const fs = require('fs');
const path = require('path');

console.log('🚀 [DEPLOY FIX] Bắt đầu triển khai bản vá triệt để Voice Call 2 chiều...');

const versionTag = 'voice_call_perfect_' + Date.now();
console.log('🔑 Version Token mới (Cache-Busting):', versionTag);

// ==============================================================================
// 1. TẠO webrtc_audio_helper.js HOÀN HẢO, ĐỒNG BỘ 100%
// ==============================================================================
const unifiedHelperContent = `// webrtc_audio_helper.js - Unified Bulletproof WebRTC Audio Engine
(function () {
  'use strict';

  console.log('🚀 [WebRTC Audio Engine] Initializing unified audio subsystem...');

  let activeRemoteStream = null;

  function getOrCreateAudioElement() {
    let el = document.getElementById('remoteAudioPlayer');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'remoteAudioPlayer';
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.style.cssText = 'position:fixed;bottom:10px;right:10px;width:60px;height:30px;opacity:0.05;pointer-events:none;z-index:999999;';
      document.body.appendChild(el);
      console.log('✅ [WebRTC Audio Engine] #remoteAudioPlayer created in DOM');
    }
    return el;
  }

  // 1. Đánh chặn getUserMedia: Lưu Native Stream gốc và đảm bảo track mic luôn bật
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      console.log('🎤 [Native Media] getUserMedia called with:', JSON.stringify(constraints));
      try {
        const stream = await _origGUM(constraints);
        window._nativeLocalStream = stream;
        const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
        console.log('✅ [Native Media] Acquired local stream. Audio tracks:', tracks.length);
        tracks.forEach(function (t) {
          t.enabled = true;
          console.log(\`🎤 Local track live: id=\${t.id}, label=\${t.label}, muted=\${t.muted}\`);
        });

        // Nếu đã có PeerConnection đang hoạt động, thêm track mic vào ngay lập tức
        if (window._activePeerConnection && tracks.length > 0) {
          try {
            const pc = window._activePeerConnection;
            const senders = pc.getSenders ? pc.getSenders() : [];
            const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
            if (!hasAudio) {
              console.log('🚀 [Auto-Inject] Thêm track mic vào PeerConnection đang hoạt động!');
              pc.addTrack(tracks[0], stream);
            }
          } catch (injectErr) {
            console.warn('⚠️ Auto-inject vào PC lỗi:', injectErr);
          }
        }

        return stream;
      } catch (err) {
        console.warn('⚠️ [Native Media] Primary getUserMedia failed, retrying basic audio:', err);
        try {
          const fallbackStream = await _origGUM({ audio: true, video: !!(constraints && constraints.video) });
          window._nativeLocalStream = fallbackStream;
          return fallbackStream;
        } catch (err2) {
          console.error('❌ [Native Media] getUserMedia fatal error:', err2);
          throw err2;
        }
      }
    };
  }

  // 2. Mở khóa âm thanh trong User Gesture (Bấm Gọi, Bấm Trả lời, Chạm màn hình)
  window.unlockAudio = function () {
    console.log('🔓 [WebRTC Audio Engine] unlockAudio() triggered');
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!window._callAudioCtx || window._callAudioCtx.state === 'closed') {
          window._callAudioCtx = new AudioCtx();
        }
        if (window._callAudioCtx && window._callAudioCtx.state === 'suspended') {
          window._callAudioCtx.resume().catch(function () {});
        }
      }

      const el = getOrCreateAudioElement();
      el.muted = false;
      el.volume = 1.0;

      // Xóa src giả lập để tránh chặn srcObject
      if (el.src && !el.srcObject) {
        el.removeAttribute('src');
      }

      const primePromise = el.play();
      if (primePromise && primePromise.catch) {
        primePromise.catch(function () {});
      }

      if (activeRemoteStream) {
        window.attachRemoteStream(activeRemoteStream);
      }
    } catch (err) {
      console.warn('⚠️ [WebRTC Audio Engine] unlockAudio notice:', err);
    }
  };

  // 3. Banner bật âm thanh nếu trình duyệt yêu cầu tương tác người dùng
  function showUnmuteBanner() {
    let btn = document.getElementById('callAudioUnmuteBanner');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'callAudioUnmuteBanner';
      btn.innerHTML = '🔊 <b>Bấm vào đây để bật tiếng cuộc gọi</b>';
      btn.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#10B981;color:#fff;padding:12px 24px;border-radius:24px;font-size:15px;font-family:sans-serif;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.6);z-index:2147483647;cursor:pointer;animation:pulse 1.5s infinite;';
      btn.onclick = function () {
        const el = getOrCreateAudioElement();
        if (el) {
          el.muted = false;
          el.volume = 1.0;
          el.play().catch(function () {});
        }
        if (window._callAudioCtx && window._callAudioCtx.state === 'suspended') {
          window._callAudioCtx.resume().catch(function () {});
        }
        btn.remove();
      };
      document.body.appendChild(btn);
    }
  }

  function hideUnmuteBanner() {
    const btn = document.getElementById('callAudioUnmuteBanner');
    if (btn) btn.remove();
  }

  // 4. Gắn luồng âm thanh từ xa vào thẻ Audio DUY NHẤT (Không pause, Không gọi thừa thãi)
  window.attachRemoteStream = function (mediaStream) {
    if (!mediaStream) {
      console.warn('⚠️ [WebRTC Audio Engine] attachRemoteStream: mediaStream is null');
      return;
    }

    activeRemoteStream = mediaStream;
    console.log('🔊 [WebRTC Audio Engine] attachRemoteStream id:', mediaStream.id);
    const audioTracks = mediaStream.getAudioTracks ? mediaStream.getAudioTracks() : [];
    console.log('🎤 [WebRTC Audio Engine] Remote audio tracks count:', audioTracks.length);

    const el = getOrCreateAudioElement();

    // Idempotent: Nếu đã phát stream này và không bị pause thì giữ nguyên
    if (el.srcObject === mediaStream && !el.paused) {
      console.log('ℹ️ [WebRTC Audio Engine] Stream đang phát mượt mà, tiếp tục');
      return;
    }

    audioTracks.forEach(function (track, idx) {
      track.enabled = true;
      console.log(\`🎤 Remote track #\${idx}: id=\${track.id}, readyState=\${track.readyState}, enabled=\${track.enabled}, muted=\${track.muted}\`);
      track.addEventListener('unmute', function () {
        console.log('🔊 [WebRTC Audio Engine] Remote track UNMUTED (Voice packets arriving!):', track.id);
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(function (_) {});
        hideUnmuteBanner();
      });
    });

    try {
      if (el.src) {
        el.removeAttribute('src');
      }
      el.srcObject = mediaStream;
      el.muted = false;
      el.volume = 1.0;
      const playPromise = el.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function (err) {
          console.warn('⚠️ [WebRTC Audio Engine] Autoplay play() rejected:', err);
          showUnmuteBanner();
        });
      } else {
        console.log('✅ [WebRTC Audio Engine] Audio playback initiated successfully');
        hideUnmuteBanner();
      }
    } catch (e) {
      console.error('❌ [WebRTC Audio Engine] Error attaching stream:', e);
    }
  };

  // Đồng bộ cả với _callAudioEngine
  if (!window._callAudioEngine) window._callAudioEngine = {};
  window._callAudioEngine.playRemoteStream = window.attachRemoteStream;
  window._callAudioEngine.unlockCallAudio = window.unlockAudio;

  // 5. stopCallAudio(): Dọn dẹp hoàn toàn khi tắt máy
  window.stopCallAudio = function () {
    console.log('🛑 [WebRTC Audio Engine] stopCallAudio() called');
    activeRemoteStream = null;
    hideUnmuteBanner();

    const el = document.getElementById('remoteAudioPlayer');
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
        el.removeAttribute('src');
      } catch (_) {}
    }

    const legacyVideo = document.getElementById('remote-call-audio');
    if (legacyVideo) {
      try {
        legacyVideo.pause();
        legacyVideo.srcObject = null;
        legacyVideo.remove();
      } catch (_) {}
    }
  };
  window._callAudioEngine.destroyCallAudio = window.stopCallAudio;

  // 6. Đánh chặn Native createOffer & createAnswer để đảm bảo track audio luôn ở SDP
  if (window.RTCPeerConnection) {
    const _origCreateOffer = window.RTCPeerConnection.prototype.createOffer;
    window.RTCPeerConnection.prototype.createOffer = function () {
      console.log('🛠️ [Native RTCPeerConnection] createOffer called');
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            console.log('🚀 [Auto-Inject Track] Thêm track audio vào PC trước createOffer!');
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-inject track before offer warning:', err);
      }
      return _origCreateOffer.apply(this, arguments);
    };

    const _origCreateAnswer = window.RTCPeerConnection.prototype.createAnswer;
    window.RTCPeerConnection.prototype.createAnswer = function () {
      console.log('🛠️ [Native RTCPeerConnection] createAnswer called');
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            console.log('🚀 [Auto-Inject Track] Thêm track audio vào PC trước createAnswer!');
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-inject track before answer warning:', err);
      }
      return _origCreateAnswer.apply(this, arguments);
    };
  }

  window.addEventListener('click', window.unlockAudio, { passive: true });
  window.addEventListener('touchstart', window.unlockAudio, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', getOrCreateAudioElement);
  } else {
    getOrCreateAudioElement();
  }
})();
`;

const helperTargets = [
  'public/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js',
  'flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js'
];

for (const target of helperTargets) {
  try {
    fs.writeFileSync(target, unifiedHelperContent, 'utf8');
    console.log('✅ Đã cập nhật helper hoàn hảo tại:', target);
  } catch (err) {
    console.warn('⚠️ Sync warning for', target, err.message);
  }
}

// ==============================================================================
// 2. CẬP NHẬT TẤT CẢ FILE INDEX.HTML VÀ BOOTSTRAP (BỎ PAUSE & CẬP NHẬT CACHE TOKEN)
// ==============================================================================
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');

  // Xóa video id="remote-call-audio" nếu có
  html = html.replace(/<video id="remote-call-audio"[^>]*><\/video>/gi, '');

  // Đảm bảo playRemoteStream không bao giờ gọi audioEl.pause()
  html = html.replace(/audioEl\.pause\(\);\s*audioEl\.removeAttribute\('src'\);/g, "if(audioEl.src) audioEl.removeAttribute('src');");

  // Bỏ đoạn gắn src wav vào remoteAudioPlayer
  html = html.replace(/ra\.src\s*=\s*'data:audio\/wav[^;]+;/g, "// ra.src omitted");

  // Cập nhật version tags
  html = html.replace(/main\.dart\.js\?v=[a-zA-Z0-9_.-]+/g, `main.dart.js?v=${versionTag}`);
  html = html.replace(/flutter_bootstrap\.js\?v=[a-zA-Z0-9_.-]+/g, `flutter_bootstrap.js?v=${versionTag}`);
  html = html.replace(/webrtc_audio_helper\.js(\?v=[a-zA-Z0-9_.-]+)?/g, `webrtc_audio_helper.js?v=${versionTag}`);

  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ Đã cập nhật index.html:', fp);
}

const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

for (const fp of bootstrapFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');
  js = js.replace(/main\.dart\.js\?v=[a-zA-Z0-9_.-]+/g, `main.dart.js?v=${versionTag}`);
  fs.writeFileSync(fp, js, 'utf8');
  console.log('✅ Đã cập nhật bootstrap:', fp);
}

// ==============================================================================
// 3. CẬP NHẬT MAIN.DART.JS (LOẠI BỎ TURN CHẾT, ICE POOL = 0, AUTO-INJECT LOCAL MIC)
// ==============================================================================
const mainFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const newB42Code = `b42(a){
  var rtcCfg = null;
  try {
    rtcCfg = new A.Ko([],[]).lh(a) || {};
    rtcCfg.iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" }
    ];
    rtcCfg.iceCandidatePoolSize = 0;
  } catch(e) { rtcCfg = new A.Ko([],[]).lh(a); }
  var s = new window.RTCPeerConnection(rtcCfg);
  try {
    window._activePeerConnection = s;
    if (window._nativeLocalStream) {
      var aTracks = window._nativeLocalStream.getAudioTracks ? window._nativeLocalStream.getAudioTracks() : [];
      if (aTracks.length > 0) {
        aTracks[0].enabled = true;
        console.log("🚀 [b42] Tự động gắn track mic vào PeerConnection mới!");
        try { s.addTrack(aTracks[0], window._nativeLocalStream); } catch(_) {}
      }
    }
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
      if (stm && window.attachRemoteStream) {
        window.attachRemoteStream(stm);
      }
    });
    s.addEventListener("addstream", function(e) {
      console.log("🔊 [Native P2P AddStream]:", e.stream ? e.stream.id : "null");
      if (e.stream && window.attachRemoteStream) {
        window.attachRemoteStream(e.stream);
      }
    });
  } catch(hkErr) { console.warn("Lỗi hook RTCPeerConnection b42:", hkErr); }
  return s},`;

for (const fp of mainFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // A. Vá b42
  const idxB42 = js.indexOf('b42(a){');
  if (idxB42 !== -1) {
    const endIdxB42 = js.indexOf('return s},', idxB42);
    if (endIdxB42 !== -1) {
      js = js.slice(0, idxB42) + newB42Code + js.slice(endIdxB42 + 10);
      console.log('✅ Đã cập nhật b42 sạch trong:', fp);
    }
  }

  // B. Loại bỏ openrelay.metered.ca trong phần mã biên dịch của Dart
  if (js.includes('turns:openrelay.metered.ca')) {
    js = js.replace(/A\.V\(\["urls","turns:openrelay\.metered\.ca:443\?transport=tcp","username","openrelayproject","credential","openrelayproject"\],a7,a7\),A\.V\(\["urls","turn:openrelay\.metered\.ca:80\?transport=tcp","username","openrelayproject","credential","openrelayproject"\],a7,a7\)/g,
      'A.V(["urls","stun:stun1.l.google.com:19302"],a7,a7),A.V(["urls","stun:stun2.l.google.com:19302"],a7,a7)');
    console.log('✅ Đã thay thế STUN Dart trong:', fp);
  }

  fs.writeFileSync(fp, js, 'utf8');
}

// ==============================================================================
// 4. CẬP NHẬT SOCKET HANDLER (ĐẢM BẢO webrtc_signal GỬI TỚI ĐÚNG ĐỐI PHƯƠNG)
// ==============================================================================
const socketFiles = [
  'sockets/socketHandler.js',
  'backend/sockets/socketHandler.js'
];

for (const fp of socketFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // Đảm bảo webrtc_signal phát đa kênh
  const oldEmit = 'io.to(connectedUserId).emit("webrtc_signal", signalPayload);';
  const newMultiEmit = `io.to(connectedUserId).emit("webrtc_signal", signalPayload);
      const targetSocketId = userSockets.get(connectedUserId);
      if (targetSocketId && targetSocketId !== connectedUserId) {
        io.to(targetSocketId).emit("webrtc_signal", signalPayload);
      }
      const activeInfo = activeCalls.get(socket.userId) || (connectedUserId ? activeCalls.get(connectedUserId) : null);
      if (activeInfo && activeInfo.conversationId) {
        socket.to(activeInfo.conversationId).emit("webrtc_signal", signalPayload);
      }`;

  if (code.includes(oldEmit) && !code.includes('targetSocketId && targetSocketId !== connectedUserId')) {
    code = code.replace(oldEmit, newMultiEmit);
    fs.writeFileSync(fp, code, 'utf8');
    console.log('✅ Đã cập nhật webrtc_signal đa kênh trong:', fp);
  }
}

// ==============================================================================
// 5. CẬP NHẬT MÃ NGUỒN DART (chat_screen.dart & webrtc_service.dart)
// ==============================================================================
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of dartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // Dọn sạch TURN server chết
  const badTurnRegex = /\{\s*'urls':\s*\[\s*'turn:openrelay\.metered\.ca:80'[\s\S]*?'credential':\s*'openrelayproject',\s*\},?/g;
  if (badTurnRegex.test(code)) {
    code = code.replace(badTurnRegex, '');
    console.log('✅ Đã xóa TURN server chết trong:', fp);
  }
  code = code.replace(/'iceCandidatePoolSize':\s*10/g, "'iceCandidatePoolSize': 0");
  fs.writeFileSync(fp, code, 'utf8');
}

const webrtcDartFiles = [
  'flutter_frontend/lib/services/webrtc_service.dart',
  'backend/flutter_frontend/lib/services/webrtc_service.dart'
];

for (const fp of webrtcDartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  const badTurnRegex = /\{\s*'urls':\s*\[\s*'turn:openrelay\.metered\.ca:80'[\s\S]*?'credential':\s*'openrelayproject',\s*\},?/g;
  if (badTurnRegex.test(code)) {
    code = code.replace(badTurnRegex, '');
    console.log('✅ Đã xóa TURN server chết trong:', fp);
  }
  code = code.replace(/'iceCandidatePoolSize':\s*10/g, "'iceCandidatePoolSize': 0");
  fs.writeFileSync(fp, code, 'utf8');
}

console.log('🎉 [DEPLOY FIX] Hoàn thành xuất sắc 100% việc áp dụng bản vá Voice Call!');
