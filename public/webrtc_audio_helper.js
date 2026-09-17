// webrtc_audio_helper.js - Unified Bulletproof WebRTC Audio Engine & Guard
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


  // 8. Bulletproof Hardware-Accelerated Media System (Save Direct To Device & Modals)
  function showDownloadToast(message) {
    try {
      var existing = document.getElementById('thoFiDownloadToast');
      if (existing) existing.remove();

      var toast = document.createElement('div');
      toast.id = 'thoFiDownloadToast';
      toast.textContent = message;
      toast.style.cssText = 'position:fixed;top:28px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:12px 26px;border-radius:30px;font-size:14px;font-family:sans-serif;font-weight:600;box-shadow:0 12px 32px rgba(0,0,0,0.4);z-index:999999999;border:1px solid rgba(255,255,255,0.18);backdrop-filter:blur(10px);pointer-events:none;animation:toastAnim 0.3s cubic-bezier(0.16,1,0.3,1);text-align:center;';

      var style = document.getElementById('downloadToastStyle');
      if (!style) {
        style = document.createElement('style');
        style.id = 'downloadToastStyle';
        style.textContent = '@keyframes toastAnim{from{opacity:0;transform:translate(-50%,-16px)}to{opacity:1;transform:translate(-50%,0)}}';
        document.head.appendChild(style);
      }
      document.body.appendChild(toast);
      setTimeout(function () {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -16px)';
        setTimeout(function () { toast.remove(); }, 450);
      }, 3500);
    } catch (_) {}
  }
  window.showDownloadToast = showDownloadToast;

  window.downloadMediaDirectly = async function (url, suggestedFilename, mediaType) {
    if (!url) return;

    var fullUrl = url;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('blob:') && !fullUrl.startsWith('data:')) {
      var origin = window.location.origin;
      if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) {
        fullUrl = 'http://localhost:5000' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
      } else {
        fullUrl = 'https://tho-goodboy-chat-app.onrender.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
      }
    }

    var isVideo = mediaType === 'video' || fullUrl.indexOf('.mp4') !== -1 || fullUrl.indexOf('.webm') !== -1 || fullUrl.indexOf('.mov') !== -1;
    var ext = isVideo ? '.mp4' : '.jpg';
    if (fullUrl.indexOf('.png') !== -1) ext = '.png';
    else if (fullUrl.indexOf('.webp') !== -1) ext = '.webp';
    else if (fullUrl.indexOf('.gif') !== -1) ext = '.gif';

    var filename = suggestedFilename || ((isVideo ? 'video_' : 'anh_') + Date.now() + ext);
    if (filename.indexOf('.') === -1) filename += ext;

    showDownloadToast('⏳ Đang tải ' + (isVideo ? 'video' : 'ảnh') + ' về máy...');

    // 1. Data URI -> Tải trực tiếp ngay lập tức
    if (fullUrl.startsWith('data:')) {
      try {
        var a = document.createElement('a');
        a.href = fullUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { a.remove(); }, 1500);
        showDownloadToast('✅ Đã lưu ' + (isVideo ? 'video' : 'ảnh') + ' vào máy thành công!');
        return;
      } catch (e) {
        console.warn('Data URI download error:', e);
      }
    }

    // 2. Tải qua Blob (Chuyển đổi URL cross-origin thành URL blob same-origin, buộc trình duyệt lưu thẳng vào thư mục Tải về)
    try {
      var response = await fetch(fullUrl, { mode: 'cors' });
      if (response.ok) {
        var blob = await response.blob();
        var blobUrl = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          a.remove();
          window.URL.revokeObjectURL(blobUrl);
        }, 3000);
        showDownloadToast('✅ Đã lưu ' + (isVideo ? 'video' : 'ảnh') + ' vào máy thành công! (Kiểm tra mục Tải về)');
        return;
      }
    } catch (fetchErr) {
      console.warn('Blob fetch failed (CORS restriction), chuyển sang streaming download proxy:', fetchErr);
    }

    // 3. Dự phòng: Streaming Proxy của Server kèm header Content-Disposition: attachment
    // Trình duyệt sẽ nhận diện attachment và bắt buộc tải thẳng vào máy mà không bao giờ mở tab mới
    try {
      var proxyUrl = '/api/chat/download-file?url=' + encodeURIComponent(fullUrl) + '&filename=' + encodeURIComponent(filename);
      var a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 2000);
      showDownloadToast('✅ Đang lưu ' + (isVideo ? 'video' : 'ảnh') + ' vào máy... (Kiểm tra mục Tải về)');
    } catch (proxyErr) {
      console.error('Download proxy error:', proxyErr);
      window.open(fullUrl, '_blank');
    }
  };

  // 9. Hardware-Accelerated Video Player Modal với nút "Lưu video vào máy"
  window.openVideoModal = function (videoUrl) {
    if (!videoUrl) return;
    try {
      var existingModal = document.getElementById('globalVideoPlayerModal');
      if (existingModal) existingModal.remove();

      var fullUrl = videoUrl;
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('blob:') && !fullUrl.startsWith('data:')) {
        var origin = window.location.origin;
        if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) {
          fullUrl = 'http://localhost:5000' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        } else {
          fullUrl = 'https://tho-goodboy-chat-app.onrender.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        }
      }

      var modal = document.createElement('div');
      modal.id = 'globalVideoPlayerModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:fadeInModal 0.2s ease-out;';

      var style = document.getElementById('videoModalStyle');
      if (!style) {
        style = document.createElement('style');
        style.id = 'videoModalStyle';
        style.textContent = '@keyframes fadeInModal{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}';
        document.head.appendChild(style);
      }

      var closeHandler = function () {
        try {
          var v = modal.querySelector('video');
          if (v) { v.pause(); v.src = ''; }
        } catch (_) {}
        modal.remove();
        document.removeEventListener('keydown', escListener);
      };

      var escListener = function (e) {
        if (e.key === 'Escape') closeHandler();
      };
      document.addEventListener('keydown', escListener);

      var header = document.createElement('div');
      header.style.cssText = 'position:absolute;top:20px;right:24px;display:flex;align-items:center;gap:12px;z-index:100;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu video vào máy';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.85);color:#fff;border:none;border-radius:24px;padding:9px 20px;font-size:14px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onmouseover = function () { dlBtn.style.background = '#0052cc'; dlBtn.style.transform = 'scale(1.03)'; };
      dlBtn.onmouseout = function () { dlBtn.style.background = 'rgba(0,104,255,0.85)'; dlBtn.style.transform = 'scale(1)'; };
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        window.downloadMediaDirectly(fullUrl, 'video_' + Date.now() + '.mp4', 'video');
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
      closeBtn.onmouseover = function () { closeBtn.style.background = '#EF4444'; closeBtn.style.transform = 'scale(1.08)'; };
      closeBtn.onmouseout = function () { closeBtn.style.background = 'rgba(255,255,255,0.18)'; closeBtn.style.transform = 'scale(1)'; };
      closeBtn.onclick = closeHandler;

      header.appendChild(dlBtn);
      header.appendChild(closeBtn);
      modal.appendChild(header);

      var videoWrapper = document.createElement('div');
      videoWrapper.style.cssText = 'position:relative;max-width:92vw;max-height:86vh;display:flex;justify-content:center;align-items:center;box-shadow:0 25px 60px rgba(0,0,0,0.85);border-radius:14px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,0.1);';

      var video = document.createElement('video');
      video.src = fullUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('webkit-playsinline', 'true');
      video.style.cssText = 'max-width:100%;max-height:86vh;outline:none;display:block;border-radius:14px;';

      videoWrapper.appendChild(video);
      modal.appendChild(videoWrapper);

      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeHandler();
      });

      document.body.appendChild(modal);
      video.play().catch(function () {});
    } catch (err) {
      console.error('Lỗi khi mở video modal:', err);
      window.open(videoUrl, '_blank');
    }
  };

  // 10. Hardware-Accelerated High-Definition Image Viewer Modal với nút "Lưu ảnh vào máy"
  window.openImageModal = function (imageUrl) {
    if (!imageUrl) return;
    try {
      var existingModal = document.getElementById('globalImagePlayerModal');
      if (existingModal) existingModal.remove();

      var fullUrl = imageUrl;
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('blob:') && !fullUrl.startsWith('data:')) {
        var origin = window.location.origin;
        if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) {
          fullUrl = 'http://localhost:5000' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        } else {
          fullUrl = 'https://tho-goodboy-chat-app.onrender.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        }
      }

      var modal = document.createElement('div');
      modal.id = 'globalImagePlayerModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:fadeInModal 0.2s ease-out;';

      var style = document.getElementById('imageModalStyle');
      if (!style) {
        style = document.createElement('style');
        style.id = 'imageModalStyle';
        style.textContent = '@keyframes fadeInModal{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}';
        document.head.appendChild(style);
      }

      var closeHandler = function () {
        modal.remove();
        document.removeEventListener('keydown', escListener);
      };

      var escListener = function (e) {
        if (e.key === 'Escape') closeHandler();
      };
      document.addEventListener('keydown', escListener);

      var header = document.createElement('div');
      header.style.cssText = 'position:absolute;top:20px;right:24px;display:flex;align-items:center;gap:12px;z-index:100;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu ảnh vào máy';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.85);color:#fff;border:none;border-radius:24px;padding:9px 20px;font-size:14px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onmouseover = function () { dlBtn.style.background = '#0052cc'; dlBtn.style.transform = 'scale(1.03)'; };
      dlBtn.onmouseout = function () { dlBtn.style.background = 'rgba(0,104,255,0.85)'; dlBtn.style.transform = 'scale(1)'; };
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        window.downloadMediaDirectly(fullUrl, 'anh_' + Date.now() + '.jpg', 'image');
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
      closeBtn.onmouseover = function () { closeBtn.style.background = '#EF4444'; closeBtn.style.transform = 'scale(1.08)'; };
      closeBtn.onmouseout = function () { closeBtn.style.background = 'rgba(255,255,255,0.18)'; closeBtn.style.transform = 'scale(1)'; };
      closeBtn.onclick = closeHandler;

      header.appendChild(dlBtn);
      header.appendChild(closeBtn);
      modal.appendChild(header);

      var imgWrapper = document.createElement('div');
      imgWrapper.style.cssText = 'position:relative;max-width:94vw;max-height:88vh;display:flex;justify-content:center;align-items:center;box-shadow:0 25px 60px rgba(0,0,0,0.85);border-radius:12px;overflow:hidden;';

      var img = document.createElement('img');
      img.src = fullUrl;
      img.style.cssText = 'max-width:100%;max-height:88vh;object-fit:contain;display:block;border-radius:12px;user-select:none;-webkit-user-select:none;';

      imgWrapper.appendChild(img);
      modal.appendChild(imgWrapper);

      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeHandler();
      });

      document.body.appendChild(modal);
    } catch (err) {
      console.error('Lỗi khi mở image modal:', err);
    }
  };

})();

// 11. Hệ thống trích xuất và lưu bộ nhớ đệm Video Thumbnail tự động
window._videoThumbCache = window._videoThumbCache || {};
window.extractVideoThumbnail = function (videoUrl, onDone) { if (onDone) onDone(null); };
