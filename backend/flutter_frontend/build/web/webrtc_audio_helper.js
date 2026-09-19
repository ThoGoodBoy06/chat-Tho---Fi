
  // ══════════════════════════════════════════════════════════════════════════════
  // HỆ THỐNG THẢ CẢM XÚC (REACTION SYSTEM)
  // ══════════════════════════════════════════════════════════════════════════════
  
  // ══════════════════════════════════════════════════════════════════════════════
  // MODAL CHI TIẾT NGƯỜI THẢ CẢM XÚC & NÚT GỠ CẢM XÚC (MESSENGER/ZALO STYLE)
  // ══════════════════════════════════════════════════════════════════════════════
  window.showReactionDetailsModal = function (reactionsObj, messageId) {
    if (!messageId) return;

    // Đóng modal cũ nếu đang mở
    var existing = document.getElementById('reactionDetailsOverlay');
    if (existing) existing.remove();

    var token = localStorage.getItem('authToken') || (localStorage.getItem('flutter.authToken') ? JSON.parse(localStorage.getItem('flutter.authToken')) : null);
    var currentUserId = localStorage.getItem('userId') || (localStorage.getItem('flutter.userId') ? JSON.parse(localStorage.getItem('flutter.userId')) : null);

    // Overlay nền mờ sang trọng
    var overlay = document.createElement('div');
    overlay.id = 'reactionDetailsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.22s ease-out;user-select:none;';

    var isMobile = window.innerWidth <= 600;
    var modal = document.createElement('div');
    modal.id = 'reactionDetailsModal';
    modal.style.cssText = isMobile
      ? 'width:100%;max-width:100%;background:#FFFFFF;border-radius:24px 24px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,0.18);display:flex;flex-direction:column;max-height:80vh;overflow:hidden;transform:translateY(100%);transition:transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28);'
      : 'width:92%;max-width:440px;background:#FFFFFF;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06);display:flex;flex-direction:column;max-height:80vh;overflow:hidden;transform:scale(0.92) translateY(15px);transition:all 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);';

    if (isMobile) {
      overlay.style.alignItems = 'flex-end';
    }

    // Drag bar (mobile)
    if (isMobile) {
      var dragHandle = document.createElement('div');
      dragHandle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:#CBD5E1;margin:10px auto 4px auto;';
      modal.appendChild(dragHandle);
    }

    // Header: Tiêu đề + Nút đóng (X)
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 20px 10px 20px;border-bottom:1px solid #F1F5F9;';

    var title = document.createElement('div');
    title.textContent = 'Cảm xúc';
    title.style.cssText = 'font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-0.2px;';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'border:none;background:#F1F5F9;width:32px;height:32px;border-radius:50%;font-size:20px;font-weight:500;color:#64748B;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;line-height:1;';
    closeBtn.onmouseenter = function() { closeBtn.style.background = '#E2E8F0'; closeBtn.style.color = '#0F172A'; };
    closeBtn.onmouseleave = function() { closeBtn.style.background = '#F1F5F9'; closeBtn.style.color = '#64748B'; };
    closeBtn.onclick = closeModal;

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Filter Tabs Bar
    var tabsBar = document.createElement('div');
    tabsBar.id = 'reactionFilterTabs';
    tabsBar.style.cssText = 'display:flex;gap:8px;padding:10px 20px;border-bottom:1px solid #F1F5F9;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;';

    // List container
    var listContainer = document.createElement('div');
    listContainer.id = 'reactionUsersList';
    listContainer.style.cssText = 'flex:1;overflow-y:auto;padding:8px 20px 20px 20px;min-height:140px;';

    // Loading indicator
    var loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;height:120px;color:#94A3B8;font-size:14px;gap:8px;';
    loadingDiv.innerHTML = '<div style="width:18px;height:18px;border:2px solid #CBD5E1;border-top-color:#0084FF;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Đang tải cảm xúc...';
    listContainer.appendChild(loadingDiv);

    modal.appendChild(tabsBar);
    modal.appendChild(listContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Hiệu ứng mở mượt
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      if (isMobile) {
        modal.style.transform = 'translateY(0)';
      } else {
        modal.style.transform = 'scale(1) translateY(0)';
      }
    });

    overlay.onclick = function (e) {
      if (e.target === overlay) closeModal();
    };

    function closeModal() {
      overlay.style.opacity = '0';
      if (isMobile) {
        modal.style.transform = 'translateY(100%)';
      } else {
        modal.style.transform = 'scale(0.92) translateY(15px)';
      }
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 240);
    }

    // Nạp dữ liệu từ Backend API
    var activeTab = 'ALL';
    var reactionDataList = [];

    function renderList() {
      tabsBar.innerHTML = '';
      listContainer.innerHTML = '';

      if (reactionDataList.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:140px;color:#94A3B8;font-size:14px;';
        emptyDiv.innerHTML = '<div style="font-size:32px;margin-bottom:6px;">💭</div>Không còn cảm xúc nào';
        listContainer.appendChild(emptyDiv);
        setTimeout(closeModal, 800);
        return;
      }

      // Nhóm icon để vẽ tabs
      var emojiCounts = {};
      reactionDataList.forEach(function (item) {
        emojiCounts[item.emoji] = (emojiCounts[item.emoji] || 0) + 1;
      });

      // Tab 'Tất cả'
      var allTabBtn = document.createElement('button');
      allTabBtn.style.cssText = 'border:none;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all 0.15s;white-space:nowrap;';
      if (activeTab === 'ALL') {
        allTabBtn.style.background = '#0084FF';
        allTabBtn.style.color = '#FFFFFF';
      } else {
        allTabBtn.style.background = '#F1F5F9';
        allTabBtn.style.color = '#475569';
      }
      allTabBtn.innerHTML = 'Tất cả <span>' + reactionDataList.length + '</span>';
      allTabBtn.onclick = function () {
        activeTab = 'ALL';
        renderList();
      };
      tabsBar.appendChild(allTabBtn);

      // Các tab riêng cho từng Emoji
      Object.keys(emojiCounts).forEach(function (em) {
        var emBtn = document.createElement('button');
        emBtn.style.cssText = 'border:none;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all 0.15s;white-space:nowrap;';
        if (activeTab === em) {
          emBtn.style.background = '#0084FF';
          emBtn.style.color = '#FFFFFF';
        } else {
          emBtn.style.background = '#F1F5F9';
          emBtn.style.color = '#475569';
        }
        emBtn.innerHTML = '<span>' + em + '</span> <span>' + emojiCounts[em] + '</span>';
        emBtn.onclick = function () {
          activeTab = em;
          renderList();
        };
        tabsBar.appendChild(emBtn);
      });

      // Lọc danh sách theo Tab
      var filtered = activeTab === 'ALL'
        ? reactionDataList
        : reactionDataList.filter(function (it) { return it.emoji === activeTab; });

      filtered.forEach(function (item) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F8FAFC;';

        // Cụm bên trái: Avatar + Tên
        var leftCol = document.createElement('div');
        leftCol.style.cssText = 'display:flex;align-items:center;gap:12px;';

        var avatarWrapper = document.createElement('div');
        avatarWrapper.style.cssText = 'position:relative;width:44px;height:44px;flex-shrink:0;';

        var avatarImg = document.createElement('div');
        if (item.avatar) {
          avatarImg.style.cssText = 'width:44px;height:44px;border-radius:50%;background-image:url("' + item.avatar + '");background-size:cover;background-position:center;border:1px solid #E2E8F0;';
        } else {
          var initial = (item.displayName || 'U').substring(0, 1).toUpperCase();
          avatarImg.style.cssText = 'width:44px;height:44px;border-radius:50%;background:#E2E8F0;color:#334155;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;';
          avatarImg.textContent = initial;
        }

        var emojiBadge = document.createElement('div');
        emojiBadge.textContent = item.emoji;
        emojiBadge.style.cssText = 'position:absolute;right:-2px;bottom:-2px;font-size:16px;background:#FFFFFF;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.15);';

        avatarWrapper.appendChild(avatarImg);
        avatarWrapper.appendChild(emojiBadge);
        leftCol.appendChild(avatarWrapper);

        var nameCol = document.createElement('div');
        nameCol.style.cssText = 'display:flex;flex-direction:column;';

        var nameSpan = document.createElement('div');
        nameSpan.textContent = item.displayName;
        nameSpan.style.cssText = 'font-size:15px;font-weight:600;color:#0F172A;';

        nameCol.appendChild(nameSpan);

        if (item.isMe) {
          var subSpan = document.createElement('div');
          subSpan.textContent = 'Nhấn để gỡ cảm xúc';
          subSpan.style.cssText = 'font-size:12px;color:#94A3B8;';
          nameCol.appendChild(subSpan);
        }

        leftCol.appendChild(nameCol);
        row.appendChild(leftCol);

        // Cụm bên phải: Nút Gỡ (Chỉ hiện cho chính mình)
        if (item.isMe) {
          var removeBtn = document.createElement('button');
          removeBtn.innerHTML = 'Gỡ';
          removeBtn.style.cssText = 'border:none;border-radius:18px;padding:6px 14px;background:#FEE2E2;color:#DC2626;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:4px;';
          removeBtn.onmouseenter = function () {
            removeBtn.style.background = '#FCA5A5';
            removeBtn.style.color = '#B91C1C';
          };
          removeBtn.onmouseleave = function () {
            removeBtn.style.background = '#FEE2E2';
            removeBtn.style.color = '#DC2626';
          };

          removeBtn.onclick = function (e) {
            e.stopPropagation();
            removeBtn.disabled = true;
            removeBtn.style.opacity = '0.5';

            // Kích hoạt logic hủy cảm xúc
            if (window.reactToMessage) {
              window.reactToMessage(messageId, item.emoji);
            }

            // Cập nhật UI ngay lập tức
            reactionDataList = reactionDataList.filter(function (it) { return it.userId !== item.userId; });
            renderList();
          };

          row.appendChild(removeBtn);
        }

        listContainer.appendChild(row);
      });
    }

    // Gọi API lấy dữ liệu chi tiết
    if (token) {
      fetch('/api/chat/messages/' + encodeURIComponent(messageId) + '/reactions', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success && Array.isArray(data.reactions)) {
          reactionDataList = data.reactions;
        } else {
          // Fallback từ reactionsObj nếu API trống
          reactionDataList = buildFallbackList(reactionsObj, currentUserId);
        }
        renderList();
      })
      .catch(function (err) {
        console.warn('Lỗi gọi API reactions, dùng fallback:', err);
        reactionDataList = buildFallbackList(reactionsObj, currentUserId);
        renderList();
      });
    } else {
      reactionDataList = buildFallbackList(reactionsObj, currentUserId);
      renderList();
    }

    function buildFallbackList(rObj, myId) {
      var arr = [];
      if (!rObj) return arr;
      var obj = rObj;
      if (typeof obj.entries === 'function') {
        obj = Object.fromEntries(obj.entries());
      }
      Object.keys(obj).forEach(function (uid) {
        var isMe = uid === myId;
        arr.push({
          userId: uid,
          displayName: isMe ? 'Bạn' : 'Người dùng',
          fullName: isMe ? 'Bạn' : 'Người dùng',
          avatar: null,
          emoji: obj[uid],
          isMe: isMe
        });
      });
      arr.sort(function (a, b) { return a.isMe ? -1 : 1; });
      return arr;
    }
  };

  window.reactToMessage = function (messageId, emoji) {
    if (!messageId || !emoji) return;
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (prov && typeof prov.a1l === 'function') {
        prov.a1l(messageId, emoji);
        console.log('✅ Reacted via prov.a1l:', messageId, emoji);
        return;
      }
    } catch (e) {
      console.warn('prov react error:', e);
    }

    // Fallback qua API trực tiếp
    try {
      var token = localStorage.getItem('authToken') || (localStorage.getItem('flutter.authToken') ? JSON.parse(localStorage.getItem('flutter.authToken')) : null);
      if (token) {
        fetch('/api/chat/messages/' + encodeURIComponent(messageId) + '/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ reaction: emoji })
        }).then(function (res) { return res.json(); }).then(function (data) {
          console.log('✅ Reacted via API:', data);
        }).catch(function (err) {
          console.error('Lỗi gọi API react:', err);
        });
      }
    } catch (err2) {
      console.error('Fallback react error:', err2);
    }
  };

  // Ngăn chặn menu chuột phải mặc định của trình duyệt để nhường cho menu cảm xúc của app
  if (!window._contextMenuGuarded) {
    window._contextMenuGuarded = true;
    window.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
    }, { passive: false });
  }

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

      
      // ── Bảng cảm xúc nổi xuất hiện khi NHẤN GIỮ vào ảnh (chuẩn Messenger & Zalo) ──
      var emojiBar = document.createElement('div');
      emojiBar.id = 'galleryReactionRow';
      emojiBar.style.cssText = 'display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.85);background:rgba(255,255,255,0.98);padding:8px 14px;border-radius:36px;box-shadow:0 14px 40px rgba(0,0,0,0.45),0 2px 8px rgba(0,0,0,0.15);z-index:100000000;align-items:center;gap:12px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:all 0.22s cubic-bezier(0.175,0.885,0.32,1.275);opacity:0;pointer-events:auto;user-select:none;';

      var emojiList = ['❤️', '😆', '😮', '😢', '😡', '👍'];
      emojiList.forEach(function(em) {
        var emBtn = document.createElement('span');
        emBtn.textContent = em;
        emBtn.style.cssText = 'font-size:30px;cursor:pointer;transition:transform 0.18s cubic-bezier(0.175,0.885,0.32,1.275);user-select:none;padding:2px 4px;display:inline-block;';
        emBtn.onmouseenter = function() { emBtn.style.transform = 'scale(1.4) translateY(-4px)'; };
        emBtn.onmouseleave = function() { emBtn.style.transform = 'scale(1) translateY(0)'; };
        emBtn.onclick = function(e) {
          e.stopPropagation();
          var curUrl = list[currentIndex];
          var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          var targetMsgId = null;
          if (prov && prov.d) {
            for (var mIdx = prov.d.length - 1; mIdx >= 0; mIdx--) {
              var m = prov.d[mIdx];
              var u = m.imageUrl || m.f || m.content || m.e;
              if (u && (u === curUrl || (typeof u === 'string' && u.includes(curUrl)) || (typeof curUrl === 'string' && curUrl.includes(u)))) {
                targetMsgId = m.id || m.a;
                break;
              }
            }
          }
          if (!targetMsgId && prov && prov.d && prov.d.length > 0) {
            targetMsgId = prov.d[prov.d.length - 1].id || prov.d[prov.d.length - 1].a;
          }
          if (targetMsgId) {
            window.reactToMessage(targetMsgId, em);
            // Hiệu ứng bay cảm xúc siêu mượt
            var flying = document.createElement('div');
            flying.textContent = em;
            flying.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.5);font-size:80px;z-index:999999999;pointer-events:none;transition:all 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28);opacity:1;';
            document.body.appendChild(flying);
            setTimeout(function() {
              flying.style.transform = 'translate(-50%,-130%) scale(1.5)';
              flying.style.opacity = '0';
            }, 30);
            setTimeout(function() { flying.remove(); }, 650);
          }
          hideGalleryEmojiBar();
        };
        emojiBar.appendChild(emBtn);
      });

      function showGalleryEmojiBar(x, y) {
        emojiBar.style.display = 'flex';
        if (typeof x === 'number' && typeof y === 'number' && x > 0 && y > 0) {
          var targetY = Math.max(80, Math.min(y - 70, window.innerHeight - 100));
          var targetX = Math.max(160, Math.min(x, window.innerWidth - 160));
          emojiBar.style.left = targetX + 'px';
          emojiBar.style.top = targetY + 'px';
        } else {
          emojiBar.style.left = '50%';
          emojiBar.style.top = '50%';
        }
        setTimeout(function() {
          emojiBar.style.transform = 'translate(-50%,-50%) scale(1)';
          emojiBar.style.opacity = '1';
        }, 10);
      }

      function hideGalleryEmojiBar() {
        emojiBar.style.transform = 'translate(-50%,-50%) scale(0.85)';
        emojiBar.style.opacity = '0';
        setTimeout(function() {
          emojiBar.style.display = 'none';
        }, 200);
      }

      modal.appendChild(emojiBar);
      modal.addEventListener('click', function(e) {
        if (!e.target.closest('#galleryReactionRow')) {
          hideGalleryEmojiBar();
        }
      });
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

      // Bắt cử chỉ NHẤN GIỮ (Press and Hold >= 350ms) trên ảnh Gallery để bật menu cảm xúc
      (function() {
        var pressTimer = null;
        var startX = 0, startY = 0;
        var isHolding = false;

        function startPress(e) {
          if (e.target.closest && e.target.closest('#galleryReactionRow')) return;
          var pt = e.touches ? e.touches[0] : e;
          startX = pt.clientX;
          startY = pt.clientY;
          isHolding = false;
          clearTimeout(pressTimer);
          pressTimer = setTimeout(function() {
            isHolding = true;
            showGalleryEmojiBar(startX, startY);
          }, 350);
        }

        function movePress(e) {
          if (!pressTimer) return;
          var pt = e.touches ? e.touches[0] : e;
          if (Math.abs(pt.clientX - startX) > 12 || Math.abs(pt.clientY - startY) > 12) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        }

        function endPress(e) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }

        track.addEventListener('touchstart', startPress, { passive: true });
        track.addEventListener('touchmove', movePress, { passive: true });
        track.addEventListener('touchend', endPress, { passive: true });
        track.addEventListener('touchcancel', endPress, { passive: true });

        track.addEventListener('mousedown', startPress);
        track.addEventListener('mousemove', movePress);
        track.addEventListener('mouseup', endPress);

        track.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showGalleryEmojiBar(e.clientX, e.clientY);
        });
      })();

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
