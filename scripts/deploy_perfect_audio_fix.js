const fs = require('fs');
const path = require('path');

console.log('🚀 [DEPLOY FIX v2] Bắt đầu triển khai bản vá triệt để Voice Call 2 chiều (Chống trùng lặp tín hiệu & Khóa chặt Audio)...');

const versionTag = 'voice_call_fixed_' + Date.now();
console.log('🔑 Version Token mới (Cache-Busting):', versionTag);

// ==============================================================================
// 1. TẠO webrtc_audio_helper.js HOÀN HẢO VỚI WEBRTC GUARD & AUDIO ENGINE
// ==============================================================================
const unifiedHelperContent = `// webrtc_audio_helper.js - Unified Bulletproof WebRTC Audio Engine & Guard
(function () {
  'use strict';

  console.log('🚀 [WebRTC Audio Subsystem] Khởi tạo hệ thống âm thanh & Guard chống lỗi tín hiệu...');

  let activeRemoteStream = null;

  // 1. DOM Audio Player duy nhất, bất khả xâm phạm
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
      console.log('✅ [WebRTC Audio Engine] #remoteAudioPlayer được tạo thành công');
    }
    return el;
  }

  // 2. Mở khóa Audio Pipeline trong User Gesture (Bấm Gọi, Bấm Nghe, Chạm màn hình)
  window.unlockAudio = function () {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!window._callAudioCtx || window._callAudioCtx.state === 'closed') {
          window._callAudioCtx = new AudioCtx();
        }
        if (window._callAudioCtx && window._callAudioCtx.state === 'suspended') {
          window._callAudioCtx.resume().catch(function () {});
        }
        // Phát 1 frame im lặng để browser cấp phép phát âm thanh tự do
        try {
          const buffer = window._callAudioCtx.createBuffer(1, 1, 22050);
          const source = window._callAudioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(window._callAudioCtx.destination);
          source.start(0);
        } catch (_) {}
      }

      const el = getOrCreateAudioElement();
      el.muted = false;
      el.volume = 1.0;
      if (el.src && !el.srcObject) {
        el.removeAttribute('src');
      }

      const p = el.play();
      if (p && p.catch) p.catch(function () {});

      if (activeRemoteStream) {
        window.attachRemoteStream(activeRemoteStream);
      }
    } catch (err) {
      console.warn('⚠️ [WebRTC Audio Engine] unlockAudio notice:', err);
    }
  };

  // Bắt sự kiện click/touch ở capture phase để chắc chắn ăn trước khi Flutter stopPropagation
  window.addEventListener('click', window.unlockAudio, { capture: true, passive: true });
  window.addEventListener('touchstart', window.unlockAudio, { capture: true, passive: true });

  // 3. Banner bật âm thanh dự phòng cho thiết bị mobile nghiêm ngặt
  function showUnmuteBanner() {
    let btn = document.getElementById('callAudioUnmuteBanner');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'callAudioUnmuteBanner';
      btn.innerHTML = '🔊 <b>Bấm vào đây để nghe tiếng cuộc gọi</b>';
      btn.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#10B981;color:#fff;padding:14px 28px;border-radius:28px;font-size:16px;font-family:sans-serif;font-weight:700;box-shadow:0 8px 32px rgba(0,0,0,0.8);z-index:2147483647;cursor:pointer;';
      const handleTap = function (ev) {
        if (ev) {
          try { ev.stopPropagation(); ev.preventDefault(); } catch (_) {}
        }
        window.unlockAudio();
        btn.remove();
      };
      btn.addEventListener('click', handleTap, { capture: true });
      btn.addEventListener('touchend', handleTap, { capture: true });
      document.body.appendChild(btn);
    }
  }

  function hideUnmuteBanner() {
    const btn = document.getElementById('callAudioUnmuteBanner');
    if (btn) btn.remove();
  }

  // 4. Gắn luồng âm thanh đối phương vào thẻ Audio
  window.attachRemoteStream = function (mediaStream) {
    if (!mediaStream) {
      console.warn('⚠️ [WebRTC Audio Engine] attachRemoteStream: mediaStream is null');
      return;
    }

    activeRemoteStream = mediaStream;
    const el = getOrCreateAudioElement();

    const audioTracks = mediaStream.getAudioTracks ? mediaStream.getAudioTracks() : [];
    console.log('🎤 [WebRTC Audio Engine] Gắn stream id=' + mediaStream.id + ', audio tracks=' + audioTracks.length);

    audioTracks.forEach(function (track, idx) {
      track.enabled = true;
      track.addEventListener('unmute', function () {
        console.log('🔊 [WebRTC Audio Engine] Remote track UNMUTED (Voice packets arriving live!):', track.id);
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(function (_) {});
        hideUnmuteBanner();
      });
    });

    if (el.srcObject !== mediaStream) {
      if (el.src) el.removeAttribute('src');
      el.srcObject = mediaStream;
    }
    el.muted = false;
    el.volume = 1.0;

    const playPromise = el.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function (err) {
        console.warn('⚠️ [WebRTC Audio Engine] Autoplay cần tương tác:', err);
        showUnmuteBanner();
      });
    } else {
      hideUnmuteBanner();
    }
  };

  if (!window._callAudioEngine) window._callAudioEngine = {};
  window._callAudioEngine.playRemoteStream = window.attachRemoteStream;
  window._callAudioEngine.unlockCallAudio = window.unlockAudio;

  // 5. Dọn dẹp âm thanh khi kết thúc cuộc gọi
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
  };
  window._callAudioEngine.destroyCallAudio = window.stopCallAudio;

  // 6. Đánh chặn getUserMedia: Giữ track mic luôn bật & tự động inject vào PC
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      console.log('🎤 [Native Media] getUserMedia called with constraints:', JSON.stringify(constraints));
      try {
        const stream = await _origGUM(constraints);
        window._nativeLocalStream = stream;
        const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
        tracks.forEach(function (t) { t.enabled = true; });

        if (window._activePeerConnection && tracks.length > 0) {
          try {
            const pc = window._activePeerConnection;
            const senders = pc.getSenders ? pc.getSenders() : [];
            const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
            if (!hasAudio) {
              console.log('🚀 [Auto-Inject] Thêm track mic vào PeerConnection active!');
              pc.addTrack(tracks[0], stream);
            }
          } catch (e) {}
        }
        return stream;
      } catch (err) {
        console.warn('⚠️ Primary getUserMedia failed, retrying fallback audio:', err);
        const fb = await _origGUM({ audio: true, video: !!(constraints && constraints.video) });
        window._nativeLocalStream = fb;
        return fb;
      }
    };
  }

  // 7. WEBRTC GUARD: KHẮC PHỤC TRIỆT ĐỂ LỖI JSEP STATE MACHINE & TRÙNG TÍN HIỆU
  if (window.RTCPeerConnection) {
    const _origSetRemoteDescription = window.RTCPeerConnection.prototype.setRemoteDescription;
    window.RTCPeerConnection.prototype.setRemoteDescription = async function (desc) {
      if (!desc) return;
      const state = this.signalingState;
      // Chống lỗi InvalidStateError khi nhận trùng offer/answer
      if (desc.type === 'offer' && state !== 'stable') {
        console.warn('⚠️ [WebRTC Guard] Bỏ qua offer trùng lặp ở trạng thái:', state);
        return;
      }
      if (desc.type === 'answer' && state !== 'have-local-offer') {
        console.warn('⚠️ [WebRTC Guard] Bỏ qua answer trùng lặp ở trạng thái:', state);
        return;
      }

      const res = await _origSetRemoteDescription.apply(this, arguments);

      // Khi remoteDescription đã sẵn sàng, xả hàng đợi candidate
      if (this._queuedCandidates && this._queuedCandidates.length > 0) {
        const queue = this._queuedCandidates.splice(0);
        for (const cand of queue) {
          try {
            await _origAddIceCandidate.call(this, cand);
          } catch (_) {}
        }
      }
      return res;
    };

    const _origAddIceCandidate = window.RTCPeerConnection.prototype.addIceCandidate;
    window.RTCPeerConnection.prototype.addIceCandidate = async function (candidate) {
      if (!candidate) return;
      const candObj = (arguments[0] instanceof RTCIceCandidate) ? arguments[0] : (typeof arguments[0] === 'object' ? arguments[0] : null);
      if (!candObj || !candObj.candidate) return;

      // Chống xử lý trùng lặp candidate
      if (!this._seenCandidates) this._seenCandidates = new Set();
      const candKey = candObj.candidate + '|' + (candObj.sdpMid || '') + '|' + (candObj.sdpMLineIndex != null ? candObj.sdpMLineIndex : '');
      if (this._seenCandidates.has(candKey)) {
        return;
      }
      this._seenCandidates.add(candKey);

      // Nếu remoteDescription chưa thiết lập xong, lưu vào hàng đợi
      if (!this.remoteDescription || !this.remoteDescription.type) {
        if (!this._queuedCandidates) this._queuedCandidates = [];
        this._queuedCandidates.push(candObj);
        return;
      }

      try {
        return await _origAddIceCandidate.call(this, candObj);
      } catch (e) {
        console.warn('⚠️ [WebRTC Guard] addIceCandidate non-fatal warning:', e.message);
      }
    };

    const _origAddTrack = window.RTCPeerConnection.prototype.addTrack;
    window.RTCPeerConnection.prototype.addTrack = function (track, ...streams) {
      if (!track) return;
      const senders = this.getSenders ? this.getSenders() : [];
      const exists = senders.some(s => s.track && (s.track.id === track.id || s.track === track));
      if (exists) {
        return senders.find(s => s.track && (s.track.id === track.id || s.track === track));
      }
      return _origAddTrack.apply(this, arguments);
    };

    const _origCreateOffer = window.RTCPeerConnection.prototype.createOffer;
    window.RTCPeerConnection.prototype.createOffer = function () {
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (_) {}
      return _origCreateOffer.apply(this, arguments);
    };

    const _origCreateAnswer = window.RTCPeerConnection.prototype.createAnswer;
    window.RTCPeerConnection.prototype.createAnswer = function () {
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (_) {}
      return _origCreateAnswer.apply(this, arguments);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', getOrCreateAudioElement);
  } else {
    getOrCreateAudioElement();
  }
})();
`;

// Ghi đồng bộ vào tất cả các file webrtc_audio_helper.js
const helperLocations = [
  'public/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js',
  'flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js'
];

for (const p of helperLocations) {
  const dir = path.dirname(p);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(p, unifiedHelperContent, 'utf8');
    console.log('✅ Đã ghi đè webrtc_audio_helper.js:', p);
  }
}

// ==============================================================================
// 2. CẬP NHẬT INDEX.HTML (CACHE-BUSTING & HEAD INJECTION)
// ==============================================================================
const indexFiles = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

for (const fp of indexFiles) {
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');

  // Thay thế version tag trong index.html
  html = html.replace(/flutter_bootstrap\.js\?v=[^"']+/g, 'flutter_bootstrap.js?v=' + versionTag);
  html = html.replace(/main\.dart\.js\?v=[^"']+/g, 'main.dart.js?v=' + versionTag);
  html = html.replace(/webrtc_audio_helper\.js\?v=[^"']+/g, 'webrtc_audio_helper.js?v=' + versionTag);

  fs.writeFileSync(fp, html, 'utf8');
  console.log('✅ Đã cập nhật version tags trong:', fp);
}

// ==============================================================================
// 3. VÁ MAIN.DART.JS (B42 & STUN SERVERS HOẠT ĐỘNG 100%)
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
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.nextcloud.com:443" },
      { urls: "stun:stun.12connect.com:3478" }
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

  // Vá b42
  const idxB42 = js.indexOf('b42(a){');
  if (idxB42 !== -1) {
    const endIdxB42 = js.indexOf('return s},', idxB42);
    if (endIdxB42 !== -1) {
      js = js.slice(0, idxB42) + newB42Code + js.slice(endIdxB42 + 10);
      console.log('✅ Đã cập nhật b42 sạch trong:', fp);
    }
  }

  // Thay thế version tag trong main.dart.js
  js = js.replace(/voice_call_perfect_\d+/g, versionTag);
  js = js.replace(/voice_call_fixed_\d+/g, versionTag);

  fs.writeFileSync(fp, js, 'utf8');
}

// ==============================================================================
// 4. CẬP NHẬT SOCKET HANDLER (ĐẢM BẢO CHỈ PHÁT TÍN HIỆU 1 LẦN DUY NHẤT)
// ==============================================================================
const socketFiles = [
  'sockets/socketHandler.js',
  'backend/sockets/socketHandler.js'
];

for (const fp of socketFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // Đảm bảo webrtc_signal chỉ phát 1 lần duy nhất tới connectedUserId
  const multiEmitRegex = /io\.to\(connectedUserId\)\.emit\("webrtc_signal", signalPayload\);[\s\S]*?socket\.to\(activeInfo\.conversationId\)\.emit\("webrtc_signal", signalPayload\);\s*\}/g;
  if (multiEmitRegex.test(code)) {
    code = code.replace(multiEmitRegex, 'io.to(connectedUserId).emit("webrtc_signal", signalPayload);');
    console.log('✅ Đã loại bỏ multi-emit webrtc_signal gây storm trong:', fp);
  }

  // Đảm bảo call_accepted chỉ phát 1 lần duy nhất
  const multiAcceptRegex = /if \(callerId\) \{\s*io\.to\(callerId\)\.emit\("call_accepted", acceptEventData\);[\s\S]*?io\.to\(callerId\)\.emit\("call_accepted", withInfo\);\s*\}\s*\}\)\.catch\(\(\) => \{\}\);/g;
  if (multiAcceptRegex.test(code)) {
    code = code.replace(multiAcceptRegex, 'if (callerId) { io.to(callerId).emit("call_accepted", acceptEventData); }');
    console.log('✅ Đã loại bỏ multi-emit call_accepted trong:', fp);
  }

  fs.writeFileSync(fp, code, 'utf8');
}

// ==============================================================================
// 5. CẬP NHẬT DART SOURCE (chat_screen.dart & webrtc_service.dart)
// ==============================================================================
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of dartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  code = code.replace(/'iceCandidatePoolSize':\s*10/g, "'iceCandidatePoolSize': 0");
  fs.writeFileSync(fp, code, 'utf8');
}

console.log('🎉 [DEPLOY FIX v2] Triển khai bản vá hoàn tất 100%!');
