// webrtc_audio_helper.js - Bulletproof Native WebRTC Audio Engine with Speakerphone & Web Audio API
(function () {
  'use strict';

  console.log('🚀 [WebRTC Audio Engine] Initializing bulletproof native audio subsystem...');

  let audioContext = null;
  let remoteMediaSourceNode = null;
  let dummyAudioElement = null;
  let activeRemoteStream = null;

  function getAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(function (_) {});
    }
    return audioContext;
  }

  // 1. Tự động đánh chặn getUserMedia để luôn lưu Native Stream gốc của Micro
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      console.log('🎤 [Native Media] getUserMedia called with constraints:', JSON.stringify(constraints));
      try {
        const stream = await _origGUM(constraints);
        window._nativeLocalStream = stream;
        const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
        console.log('✅ [Native Media] Acquired local stream. Audio tracks:', tracks.length);
        tracks.forEach(function (t) {
          t.enabled = true;
          console.log(`🎤 Local track live: id=${t.id}, label=${t.label}, muted=${t.muted}`);
        });
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

  // 2. Tạo phần tử Media nhận luồng từ xa - Dùng <video playsinline> để ÉP trình duyệt Mobile phát qua LOA NGOÀI (LOUDSPEAKER)
  window.initCallAudio = function () {
    let el = document.getElementById('remote-call-audio');
    if (!el) {
      // Dùng thẻ VIDEO thay vì AUDIO để tránh lỗi Mobile Safari/Chrome định tuyến nhầm vào LOA TRONG (Earpiece)!
      el = document.createElement('video');
      el.id = 'remote-call-audio';
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-9999;';
      document.body.appendChild(el);
      console.log('✅ [WebRTC Audio Engine] remote-call-audio (video-speaker element) initialized');
    }
    return el;
  };

  // 3. Mở khóa Audio Pipeline ngay trong User Interaction (Bắt máy hoặc Gọi)
  window.unlockAudio = function () {
    console.log('🔓 [WebRTC Audio Engine] unlockAudio() triggered on User Gesture');
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(function () {
          console.log('✅ [WebRTC Audio Engine] AudioContext resumed successfully');
        }).catch(function (_) {});
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

      // Kích hoạt thêm thẻ remoteAudioPlayer cũ nếu có
      const legacy = document.getElementById('remoteAudioPlayer');
      if (legacy) {
        legacy.muted = false;
        legacy.volume = 1.0;
        const pl = legacy.play();
        if (pl && pl.catch) pl.catch(function (_) {});
      }

      // Nếu đã có luồng stream đang chờ, phát ngay
      if (activeRemoteStream) {
        window.attachRemoteStream(activeRemoteStream);
      }
    } catch (err) {
      console.warn('⚠️ [WebRTC Audio Engine] unlockAudio warning:', err);
    }
  };

  // 4. Gắn và phát luồng âm thanh đối phương ra LOA NGOÀI bằng 2 ENGINE SONG SONG:
  //    Engine 1: Native <video playsinline> (Đảm bảo định tuyến ra loa ngoài trên Android & iOS)
  //    Engine 2: Web Audio API AudioContext.destination (Đưa trực tiếp PCM ra phần cứng, chống chặn Autoplay)
  window.attachRemoteStream = function (mediaStream) {
    if (!mediaStream) {
      console.warn('⚠️ [WebRTC Audio Engine] attachRemoteStream: mediaStream is null');
      return;
    }

    activeRemoteStream = mediaStream;
    console.log('🔊 [WebRTC Audio Engine] attachRemoteStream called with stream id:', mediaStream.id);
    const audioTracks = mediaStream.getAudioTracks ? mediaStream.getAudioTracks() : [];
    console.log('🎤 [WebRTC Audio Engine] Remote audio tracks count:', audioTracks.length);

    audioTracks.forEach(function (track, idx) {
      track.enabled = true;
      console.log(`🎤 Remote track #${idx}: id=${track.id}, readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`);
      track.addEventListener('unmute', function () {
        console.log('🔊 [WebRTC Audio Engine] Remote track UNMUTED (Voice packets arriving!):', track.id);
        const el = window.initCallAudio();
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(function (_) {});
      });
    });

    // ENGINE 1: HTML Element Playback
    const el = window.initCallAudio();
    try {
      el.srcObject = mediaStream;
      el.muted = false;
      el.volume = 1.0;
      const playPromise = el.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(function (err) {
          console.warn('⚠️ [WebRTC Audio Engine] el.play() retry warning:', err);
          setTimeout(function () {
            if (el) {
              el.muted = false;
              el.volume = 1.0;
              el.play().catch(function (_) {});
            }
          }, 300);
        });
      } else {
        console.log('✅ [WebRTC Audio Engine] HTML Media Element play initiated');
      }
    } catch (e) {
      console.error('❌ [WebRTC Audio Engine] Error attaching mediaStream to HTML element:', e);
    }

    // ENGINE 2: Web Audio API Direct Output
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (remoteMediaSourceNode) {
          try { remoteMediaSourceNode.disconnect(); } catch (_) {}
          remoteMediaSourceNode = null;
        }
        remoteMediaSourceNode = ctx.createMediaStreamSource(mediaStream);
        remoteMediaSourceNode.connect(ctx.destination);
        console.log('✅ [WebRTC Audio Engine] Web Audio API connected stream directly to ctx.destination (Loudspeaker)!');
      }
    } catch (webAudioErr) {
      console.warn('ℹ️ [WebRTC Audio Engine] Web Audio API routing notice:', webAudioErr);
    }

    // Cập nhật thêm thẻ cũ remoteAudioPlayer để tương thích 100%
    const legacy = document.getElementById('remoteAudioPlayer');
    if (legacy) {
      try {
        legacy.srcObject = mediaStream;
        legacy.muted = false;
        legacy.volume = 1.0;
        legacy.play().catch(function (_) {});
      } catch (_) {}
    }
  };

  // 5. Dọn dẹp hoàn toàn luồng âm thanh khi gác máy
  window.stopCallAudio = function () {
    console.log('🛑 [WebRTC Audio Engine] stopCallAudio() called');
    activeRemoteStream = null;
    if (remoteMediaSourceNode) {
      try { remoteMediaSourceNode.disconnect(); } catch (_) {}
      remoteMediaSourceNode = null;
    }
    const el = document.getElementById('remote-call-audio');
    if (el) {
      try {
        el.pause();
        el.srcObject = null;
      } catch (_) {}
    }
    const legacy = document.getElementById('remoteAudioPlayer');
    if (legacy) {
      try {
        legacy.pause();
        legacy.srcObject = null;
      } catch (_) {}
    }
    if (window._callAudioEngine && window._callAudioEngine.destroyCallAudio) {
      try { window._callAudioEngine.destroyCallAudio(); } catch (_) {}
    }
  };

  // 6. Đánh chặn RTCPeerConnection Native để ĐẢM BẢO Track Audio luôn được gửi đi trong SDP Offer/Answer
  if (window.RTCPeerConnection) {
    const _origCreateOffer = window.RTCPeerConnection.prototype.createOffer;
    window.RTCPeerConnection.prototype.createOffer = async function () {
      console.log('🛠️ [Native RTCPeerConnection] createOffer called');
      // Tự động kiểm tra và thêm audio track nếu Dart chưa kịp add
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            console.log('🚀 [Auto-Inject Track] Adding local audio track to peer connection before createOffer!');
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-inject track before offer warning:', err);
      }
      return _origCreateOffer.apply(this, arguments);
    };

    const _origCreateAnswer = window.RTCPeerConnection.prototype.createAnswer;
    window.RTCPeerConnection.prototype.createAnswer = async function () {
      console.log('🛠️ [Native RTCPeerConnection] createAnswer called');
      try {
        const senders = this.getSenders ? this.getSenders() : [];
        const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
        if (!hasAudio && window._nativeLocalStream) {
          const audioTrack = window._nativeLocalStream.getAudioTracks()[0];
          if (audioTrack) {
            console.log('🚀 [Auto-Inject Track] Adding local audio track to peer connection before createAnswer!');
            this.addTrack(audioTrack, window._nativeLocalStream);
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-inject track before answer warning:', err);
      }
      return _origCreateAnswer.apply(this, arguments);
    };
  }

  // Tự động mở khóa khi người dùng chạm vào màn hình bất cứ lúc nào trong cuộc gọi
  window.addEventListener('click', window.unlockAudio, { passive: true });
  window.addEventListener('touchstart', window.unlockAudio, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCallAudio);
  } else {
    window.initCallAudio();
  }
})();
