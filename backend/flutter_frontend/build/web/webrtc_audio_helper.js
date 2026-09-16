// webrtc_audio_helper.js - Native Web Audio & HTMLAudioElement Manager for Flutter Web
(function () {
  'use strict';

  let audioContext = null;
  let callAudioElement = null;
  let dummyAudioElement = null;
  let activeRemoteStream = null;

  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    return audioContext;
  }

  // 1. Tạo sẵn thẻ <audio id="remote-call-audio" autoplay playsinline></audio>
  window.initCallAudio = function () {
    let el = document.getElementById('remote-call-audio');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'remote-call-audio';
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.style.position = 'fixed';
      el.style.bottom = '0';
      el.style.right = '0';
      el.style.width = '2px';
      el.style.height = '2px';
      el.style.opacity = '0.01';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '-9999';
      document.body.appendChild(el);
      console.log('✅ [WebRTC Audio Helper] remote-call-audio element initialized in DOM');
    }
    callAudioElement = el;
    return el;
  };

  // 2. Mở khóa Audio Pipeline ngay trong User Interaction (Gọi hoặc Bắt máy)
  window.unlockAudio = function () {
    console.log('🔓 [WebRTC Audio Helper] unlockAudio() triggered on User Gesture');
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(function () {
          console.log('✅ [WebRTC Audio Helper] AudioContext resumed successfully');
        }).catch(function (e) {
          console.warn('⚠️ AudioContext resume error:', e);
        });
      }

      const el = window.initCallAudio();
      el.muted = false;
      el.volume = 1.0;

      // Dummy silent sound (44-byte silent WAV) để trình duyệt cấp phép vĩnh viễn
      if (!dummyAudioElement) {
        dummyAudioElement = document.createElement('audio');
        dummyAudioElement.autoplay = true;
        dummyAudioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      }
      const p = dummyAudioElement.play();
      if (p && p.catch) {
        p.catch(function (_) {});
      }

      // Nếu đã có active stream đang chờ, thử play ngay
      if (activeRemoteStream && el.srcObject !== activeRemoteStream) {
        window.attachRemoteStream(activeRemoteStream);
      }
    } catch (err) {
      console.warn('⚠️ [WebRTC Audio Helper] unlockAudio warning:', err);
    }
  };

  // 3. Gán remote stream vào audio element và tự động phát với volume tối đa
  window.attachRemoteStream = function (mediaStream) {
    if (!mediaStream) {
      console.warn('⚠️ [WebRTC Audio Helper] attachRemoteStream called with null/empty stream');
      return;
    }

    activeRemoteStream = mediaStream;
    console.log('🔊 [WebRTC Audio Helper] attachRemoteStream called with stream id:', mediaStream.id);
    const audioTracks = mediaStream.getAudioTracks ? mediaStream.getAudioTracks() : [];
    console.log('🎤 [WebRTC Audio Helper] Remote audio tracks count:', audioTracks.length);

    audioTracks.forEach(function (track, idx) {
      track.enabled = true;
      console.log(`🎤 Track #${idx}: id=${track.id}, readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`);
      track.addEventListener('unmute', function () {
        console.log('🔊 [WebRTC Audio Helper] Track UNMUTED (packets flowing!):', track.id);
        if (callAudioElement) {
          callAudioElement.muted = false;
          callAudioElement.volume = 1.0;
          callAudioElement.play().catch(function (e) {
            console.warn('⚠️ play() on unmute retry:', e);
          });
        }
      });
    });

    const el = window.initCallAudio();
    try {
      el.pause();
      el.removeAttribute('src');
      el.srcObject = mediaStream;
      el.muted = false;
      el.volume = 1.0;

      const playPromise = el.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function (err) {
          console.warn('⚠️ [WebRTC Audio Helper] Autoplay retry error:', err);
          setTimeout(function () {
            if (el) {
              el.muted = false;
              el.volume = 1.0;
              el.play().catch(function (e) {
                console.error('❌ [WebRTC Audio Helper] Autoplay retry failed:', e);
              });
            }
          }, 300);
        });
      } else {
        console.log('✅ [WebRTC Audio Helper] remoteAudioElement.play() initiated');
      }
    } catch (e) {
      console.error('❌ [WebRTC Audio Helper] Error attaching mediaStream:', e);
    }
  };

  // 4. Dọn dẹp stream, dừng play và gán srcObject = null
  window.stopCallAudio = function () {
    console.log('🛑 [WebRTC Audio Helper] stopCallAudio() invoked');
    activeRemoteStream = null;
    try {
      if (callAudioElement) {
        callAudioElement.pause();
        callAudioElement.srcObject = null;
      }
      const legacyAudio = document.getElementById('remoteAudioPlayer');
      if (legacyAudio) {
        legacyAudio.pause();
        legacyAudio.srcObject = null;
      }
      if (window._callAudioEngine && window._callAudioEngine.destroyCallAudio) {
        try { window._callAudioEngine.destroyCallAudio(); } catch (_) {}
      }
    } catch (e) {
      console.warn('⚠️ [WebRTC Audio Helper] stopCallAudio warning:', e);
    }
  };

  // Tự động khởi tạo thẻ khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCallAudio);
  } else {
    window.initCallAudio();
  }
})();
