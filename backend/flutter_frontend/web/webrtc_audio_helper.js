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
        fullUrl = window.location.origin + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
      } else {
        fullUrl = 'https://chat-tho-fi-vn-9s8u.onrender.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
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
          fullUrl = window.location.origin + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
        } else {
          fullUrl = 'https://chat-tho-fi-vn-9s8u.onrender.com' + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;
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
})();

// =========================================================================
// BỘ TRÌNH CHIẾU GALLERY CHUẨN XÁC:
// - Album: Chỉ hiển thị các ảnh của đúng Album đó, hỗ trợ vuốt/kéo mượt mà
// - Ảnh riêng: Chỉ hiển thị 1 ảnh (1/1), không gộp ảnh linh tinh vào
// =========================================================================
(function () {
  window.openAlbumGalleryModal = function (photoList, initialIndex) {
    if (!photoList) photoList = [];
    try {
      var existingModal = document.getElementById('globalAlbumGalleryModal');
      if (existingModal) existingModal.remove();

      var list = [];
      var seen = {};

      function addUrl(u) {
        if (!u || typeof u !== 'string' || (u.startsWith('data:') && u.length > 500000)) return;
        var full = u;
        if (!full.startsWith('http://') && !full.startsWith('https://') && !full.startsWith('blob:') && !full.startsWith('data:')) {
          var origin = window.location.origin;
          var be = (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) ? origin : 'https://chat-tho-fi-vn-9s8u.onrender.com';
          full = be + (full.startsWith('/') ? '' : '/') + full;
        }
        if (!seen[full]) {
          seen[full] = true;
          list.push(full);
        }
      }

      // CHỈ hiển thị đúng danh sách ảnh thuộc Album hoặc ảnh đơn lẻ được truyền vào
      for (var i = 0; i < photoList.length; i++) {
        var item = photoList[i];
        var raw = typeof item === 'string' ? item : (item && (item.url || item.imageUrl || item.f || item.content || item.e) ? (item.url || item.imageUrl || item.f || item.content || item.e) : '');
        addUrl(raw);
      }

      if (!list.length) return;

      var currentIndex = typeof initialIndex === 'number' ? Math.max(0, Math.min(initialIndex, list.length - 1)) : 0;
      var isAlbum = list.length > 1;

      var snapStyle = document.getElementById('gallerySnapStyle');
      if (!snapStyle) {
        snapStyle = document.createElement('style');
        snapStyle.id = 'gallerySnapStyle';
        snapStyle.textContent = 
          '#galleryTrack::-webkit-scrollbar{display:none;}' +
          '#galleryTrack{-ms-overflow-style:none;scrollbar-width:none;}' +
          '.gallery-slide{flex:0 0 100vw;width:100vw;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:8px 12px;user-select:none;-webkit-user-select:none;cursor:grab;touch-action:pan-y;}' +
          '.gallery-slide img{max-width:96vw;max-height:75vh;object-fit:contain;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,0.85);user-select:none;-webkit-user-select:none;pointer-events:none;-webkit-user-drag:none;display:block;}' +
          '@media (min-width: 768px) {.gallery-slide img{max-width:88vw;max-height:78vh;}}' +
          '#galleryThumbs::-webkit-scrollbar{display:none;}';
        document.head.appendChild(snapStyle);
      }

      var modal = document.createElement('div');
      modal.id = 'globalAlbumGalleryModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,9,0.97);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10px 0 14px 0;box-sizing:border-box;user-select:none;-webkit-user-select:none;overflow:hidden;';

      // Header: Counter + Nút Lưu + Nút Đóng
      var header = document.createElement('div');
      header.id = 'galleryHeader';
      header.style.cssText = 'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;z-index:100;padding:4px 16px;box-sizing:border-box;';

      var counterPill = document.createElement('div');
      counterPill.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;padding:6px 15px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      counterPill.innerHTML = (isAlbum ? '<span>⊞</span> ' : '<span>🖼</span> ') + '<span id="galleryCounterText">' + (currentIndex + 1) + ' / ' + list.length + '</span>';

      var actionsDiv = document.createElement('div');
      actionsDiv.id = 'galleryActions';
      actionsDiv.style.cssText = 'display:flex;align-items:center;gap:10px;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu ảnh';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.92);color:#fff;border:none;border-radius:22px;padding:8px 16px;font-size:13.5px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        var curUrl = list[currentIndex];
        if (!curUrl) return;
        try {
          var a = document.createElement('a');
          a.href = curUrl;
          a.download = 'image_' + Date.now() + '.jpg';
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          window.open(curUrl, '_blank');
        }
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.22);color:#fff;border:none;font-size:16px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.2s;';
      
      var cleanupAndClose = function () {
        window.removeEventListener('keydown', keyListener);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        modal.style.transition = 'opacity 0.2s ease';
        modal.style.opacity = '0';
        setTimeout(function () { modal.remove(); }, 200);
      };
      closeBtn.onclick = function (e) {
        e.stopPropagation();
        cleanupAndClose();
      };

      actionsDiv.appendChild(dlBtn);
      actionsDiv.appendChild(closeBtn);
      header.appendChild(counterPill);
      header.appendChild(actionsDiv);
      modal.appendChild(header);

      // Body: Container cuộn Track CSS Scroll Snap
      var track = document.createElement('div');
      track.id = 'galleryTrack';
      track.style.cssText = 'flex:1;width:100vw;display:flex;flex-direction:row;overflow-x:' + (isAlbum ? 'auto' : 'hidden') + ';overflow-y:hidden;scroll-snap-type:' + (isAlbum ? 'x mandatory' : 'none') + ';-webkit-overflow-scrolling:touch;scroll-behavior:smooth;align-items:center;cursor:' + (isAlbum ? 'grab' : 'default') + ';';

      for (var j = 0; j < list.length; j++) {
        var slide = document.createElement('div');
        slide.className = 'gallery-slide';
        var img = document.createElement('img');
        img.src = list[j];
        img.loading = 'eager';
        img.draggable = false;
        slide.appendChild(img);
        track.appendChild(slide);
      }
      modal.appendChild(track);

      // Nút điều hướng (Trái / Phải) - CHỈ hiển thị khi là Album (có > 1 ảnh)
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = 'position:absolute;left:18px;top:48%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:32px;cursor:pointer;display:' + (isAlbum ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      prevBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        }
      };

      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = 'position:absolute;right:18px;top:48%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:32px;cursor:pointer;display:' + (isAlbum ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        }
      };

      modal.appendChild(prevBtn);
      modal.appendChild(nextBtn);

      // Thumbnail Strip (Thanh ảnh xem trước ở đáy) - CHỈ hiển thị khi là Album
      var thumbStrip = document.createElement('div');
      thumbStrip.id = 'galleryThumbs';
      thumbStrip.style.cssText = 'display:' + (isAlbum ? 'flex' : 'none') + ';align-items:center;gap:8px;max-width:94vw;overflow-x:auto;padding:8px 12px;z-index:100;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box;';
      var thumbEls = [];

      if (isAlbum) {
        list.forEach(function (url, idx) {
          var t = document.createElement('div');
          t.style.cssText = 'width:42px;height:42px;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;border:2px solid ' + (idx === currentIndex ? '#0068FF' : 'transparent') + ';opacity:' + (idx === currentIndex ? '1' : '0.45') + ';flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.4);';
          var tImg = document.createElement('img');
          tImg.src = url;
          tImg.draggable = false;
          tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;';
          t.appendChild(tImg);
          t.onclick = function (e) {
            e.stopPropagation();
            currentIndex = idx;
            updateScrollPos(true);
          };
          thumbEls.push(t);
          thumbStrip.appendChild(t);
        });
      }
      modal.appendChild(thumbStrip);

      function updateCounter() {
        var txt = document.getElementById('galleryCounterText');
        if (txt) txt.textContent = (currentIndex + 1) + ' / ' + list.length;
        if (prevBtn) prevBtn.style.opacity = currentIndex > 0 ? '1' : '0.25';
        if (nextBtn) nextBtn.style.opacity = currentIndex < list.length - 1 ? '1' : '0.25';
        thumbEls.forEach(function (t, idx) {
          t.style.borderColor = (idx === currentIndex ? '#0068FF' : 'transparent');
          t.style.opacity = (idx === currentIndex ? '1' : '0.45');
          t.style.transform = (idx === currentIndex ? 'scale(1.1)' : 'scale(1)');
        });
        if (thumbEls[currentIndex]) {
          thumbEls[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }

      function updateScrollPos(smooth) {
        var w = window.innerWidth;
        if (track && isAlbum) {
          track.scrollTo({ left: currentIndex * w, behavior: smooth ? 'smooth' : 'instant' });
        }
        updateCounter();
      }

      var scrollTimer = null;
      if (isAlbum) {
        track.addEventListener('scroll', function () {
          if (scrollTimer) clearTimeout(scrollTimer);
          scrollTimer = setTimeout(function () {
            var w = window.innerWidth;
            var newIdx = Math.round(track.scrollLeft / w);
            if (newIdx !== currentIndex && newIdx >= 0 && newIdx < list.length) {
              currentIndex = newIdx;
              updateCounter();
            }
          }, 40);
        }, { passive: true });
      }

      // Kéo chuột trên máy tính (chỉ khi là Album)
      var isMouseDown = false, startMouseX = 0, scrollStart = 0, hasDragged = false;
      if (isAlbum) {
        track.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          isMouseDown = true;
          hasDragged = false;
          startMouseX = e.clientX;
          scrollStart = track.scrollLeft;
          track.style.scrollSnapType = 'none';
          track.style.scrollBehavior = 'auto';
          track.style.cursor = 'grabbing';
        });

        var onMouseMove = function (e) {
          if (!isMouseDown) return;
          var dx = e.clientX - startMouseX;
          if (Math.abs(dx) > 4) hasDragged = true;
          track.scrollLeft = scrollStart - dx;
        };

        var onMouseUp = function (e) {
          if (!isMouseDown) return;
          isMouseDown = false;
          track.style.cursor = 'grab';
          track.style.scrollSnapType = 'x mandatory';
          track.style.scrollBehavior = 'smooth';
          if (hasDragged) {
            var dx = e.clientX - startMouseX;
            var w = window.innerWidth;
            if (dx < -50 && currentIndex < list.length - 1) {
              currentIndex++;
            } else if (dx > 50 && currentIndex > 0) {
              currentIndex--;
            } else {
              currentIndex = Math.max(0, Math.min(Math.round(track.scrollLeft / w), list.length - 1));
            }
            updateScrollPos(true);
          }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Vuốt cảm ứng mobile
        var touchStartX = 0, touchDeltaX = 0, hasTouchSwiped = false;
        track.addEventListener('touchstart', function (e) {
          if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchDeltaX = 0;
            hasTouchSwiped = false;
          }
        }, { passive: true });

        track.addEventListener('touchmove', function (e) {
          if (e.touches && e.touches.length === 1) {
            touchDeltaX = e.touches[0].clientX - touchStartX;
            if (Math.abs(touchDeltaX) > 10) hasTouchSwiped = true;
          }
        }, { passive: true });

        track.addEventListener('touchend', function () {
          if (hasTouchSwiped && Math.abs(touchDeltaX) > 40) {
            if (touchDeltaX < -40 && currentIndex < list.length - 1) {
              currentIndex++;
              updateScrollPos(true);
            } else if (touchDeltaX > 40 && currentIndex > 0) {
              currentIndex--;
              updateScrollPos(true);
            }
          }
        }, { passive: true });

        // Cuộn chuột ngang
        track.addEventListener('wheel', function (e) {
          var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (Math.abs(delta) > 20) {
            e.preventDefault();
            if (delta > 0 && currentIndex < list.length - 1) {
              currentIndex++;
              updateScrollPos(true);
            } else if (delta < 0 && currentIndex > 0) {
              currentIndex--;
              updateScrollPos(true);
            }
          }
        }, { passive: false });
      }

      // Phím điều hướng
      var keyListener = function (e) {
        if (e.key === 'Escape') cleanupAndClose();
        else if (isAlbum && e.key === 'ArrowLeft' && currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        } else if (isAlbum && e.key === 'ArrowRight' && currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        }
      };
      window.addEventListener('keydown', keyListener);

      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target === track) {
          cleanupAndClose();
        }
      });

      document.body.appendChild(modal);
      requestAnimationFrame(function () {
        updateScrollPos(false);
      });
    } catch (err) {
      console.error('Lỗi mở Album Gallery:', err);
    }
  };

  window.openImageModal = function (imageUrl) {
    if (!imageUrl) return;
    // Mở ảnh riêng lẻ: chỉ hiển thị đúng duy nhất 1 ảnh đó!
    window.openAlbumGalleryModal([imageUrl], 0);
  };
})();
