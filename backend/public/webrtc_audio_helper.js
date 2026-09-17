// webrtc_audio_helper.js - Unified Bulletproof WebRTC Audio Engine
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
          console.log(`🎤 Local track live: id=${t.id}, label=${t.label}, muted=${t.muted}`);
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
      console.log(`🎤 Remote track #${idx}: id=${track.id}, readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`);
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
