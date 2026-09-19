const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu triển khai tính năng Chuyển tiếp tin nhắn (Forward Message)...');

// ==========================================
// 1. NỘI DUNG WINDOW.OPENFORWARDMODAL CHO WEBRTC_AUDIO_HELPER.JS
// ==========================================
const forwardModalHelperCode = `
  // ════════════════════════════════════════════════════════════════
  // 🌟 MODAL CHUYỂN TIẾP TIN NHẮN / ALBUM ẢNH (FORWARD DIALOG)
  // ════════════════════════════════════════════════════════════════
  window.openForwardModal = function (payload) {
    try {
      if (!payload) return;
      var messageIds = payload.messageIds || [];
      var urls = payload.urls || [];
      var cluster = payload.cluster || [];
      if (!messageIds.length && cluster.length) {
        for (var ci = 0; ci < cluster.length; ci++) {
          var mid = cluster[ci].a || cluster[ci].id;
          if (mid) messageIds.push(mid);
        }
      }

      var existing = document.getElementById('forward-msg-modal-root');
      if (existing) existing.remove();

      var baseUrl = (window.location.origin.indexOf('localhost') !== -1 || window.location.origin.indexOf('127.0.0.1') !== -1)
        ? window.location.origin
        : 'https://chat-tho-fi-vn-9s8u.onrender.com';

      function getToken() {
        var t = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || '';
        if (t && t.startsWith('"') && t.endsWith('"')) {
          try { t = JSON.parse(t); } catch(e) {}
        }
        return t;
      }

      function getMyUserId() {
        var uid = localStorage.getItem('flutter.userId') || localStorage.getItem('userId') || '';
        if (uid && uid.startsWith('"') && uid.endsWith('"')) {
          try { uid = JSON.parse(uid); } catch(e) {}
        }
        if (!uid) {
          var u = localStorage.getItem('flutter.currentUser') || localStorage.getItem('currentUser') || '';
          if (u) {
            try {
              var parsed = JSON.parse(u);
              if (typeof parsed === 'string') parsed = JSON.parse(parsed);
              if (parsed && parsed.id) uid = parsed.id;
            } catch(e) {}
          }
        }
        return uid;
      }

      var token = getToken();
      var myUserId = getMyUserId();

      // Tạo Container Root
      var root = document.createElement('div');
      root.id = 'forward-msg-modal-root';
      root.style.cssText = 'position: fixed; inset: 0; z-index: 1000000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; opacity: 0; transition: opacity 0.2s ease;';

      var card = document.createElement('div');
      card.style.cssText = 'width: 100%; max-width: 440px; max-height: 82vh; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); display: flex; flex-direction: column; overflow: hidden; transform: scale(0.94); transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);';

      // Header
      var header = document.createElement('div');
      header.style.cssText = 'padding: 16px 20px 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;';

      var titleBox = document.createElement('div');
      var title = document.createElement('div');
      title.innerText = 'Chuyển tiếp tin nhắn';
      title.style.cssText = 'font-size: 17px; font-weight: 700; color: #1c1e21;';
      var subtitle = document.createElement('div');
      var count = messageIds.length || urls.length || 1;
      subtitle.innerText = urls.length > 1 ? ('Album ' + urls.length + ' ảnh') : (urls.length === 1 ? '1 ảnh' : (count + ' tin nhắn'));
      subtitle.style.cssText = 'font-size: 13px; color: #65676b; margin-top: 2px;';
      titleBox.appendChild(title);
      titleBox.appendChild(subtitle);

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&#10005;';
      closeBtn.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; border: none; background: #f0f2f5; color: #606770; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; outline: none;';
      closeBtn.onmouseenter = function() { closeBtn.style.background = '#e4e6eb'; };
      closeBtn.onmouseleave = function() { closeBtn.style.background = '#f0f2f5'; };

      function closeModal() {
        root.style.opacity = '0';
        card.style.transform = 'scale(0.94)';
        setTimeout(function() { if (root.parentNode) root.remove(); }, 200);
      }
      closeBtn.onclick = closeModal;
      root.onclick = function(e) { if (e.target === root) closeModal(); };

      header.appendChild(titleBox);
      header.appendChild(closeBtn);
      card.appendChild(header);

      // Xem trước nội dung chuyển tiếp (Preview banner)
      if (urls && urls.length > 0) {
        var previewBanner = document.createElement('div');
        previewBanner.style.cssText = 'padding: 10px 20px; background: #f7f8fa; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; overflow-x: auto; flex-shrink: 0;';
        for (var pi = 0; pi < Math.min(urls.length, 5); pi++) {
          var pimg = document.createElement('img');
          pimg.src = urls[pi];
          pimg.style.cssText = 'width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid #e1e4e8; flex-shrink: 0;';
          previewBanner.appendChild(pimg);
        }
        if (urls.length > 5) {
          var moreBadge = document.createElement('div');
          moreBadge.innerText = '+' + (urls.length - 5);
          moreBadge.style.cssText = 'font-size: 13px; font-weight: 700; color: #0068FF; background: #E7F0FE; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
          previewBanner.appendChild(moreBadge);
        }
        card.appendChild(previewBanner);
      }

      // Ô tìm kiếm
      var searchBox = document.createElement('div');
      searchBox.style.cssText = 'padding: 10px 16px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0;';
      var searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = '🔍 Tìm kiếm cuộc trò chuyện...';
      searchInput.style.cssText = 'width: 100%; box-sizing: border-box; padding: 9px 14px; border-radius: 20px; border: 1px solid #e4e6eb; background: #f0f2f5; font-size: 14px; outline: none; transition: border-color 0.2s;';
      searchInput.onfocus = function() { searchInput.style.borderColor = '#0068FF'; searchInput.style.background = '#ffffff'; };
      searchInput.onblur = function() { searchInput.style.borderColor = '#e4e6eb'; searchInput.style.background = '#f0f2f5'; };
      searchBox.appendChild(searchInput);
      card.appendChild(searchBox);

      // Danh sách cuộc trò chuyện (Scrollable list)
      var listContainer = document.createElement('div');
      listContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 6px 12px; -webkit-overflow-scrolling: touch; min-height: 220px;';
      listContainer.innerHTML = '<div style="text-align: center; padding: 40px 16px; color: #8a8d91; font-size: 14px;"><div style="display: inline-block; width: 22px; height: 22px; border: 2.5px solid #0068FF; border-top-color: transparent; border-radius: 50%; animation: fwdSpin 0.7s linear infinite; margin-bottom: 8px;"></div><br/>Đang tải danh sách cuộc trò chuyện...</div>';
      card.appendChild(listContainer);

      // Style cho animation spinner
      if (!document.getElementById('fwd-style-keyframes')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'fwd-style-keyframes';
        styleEl.innerHTML = '@keyframes fwdSpin { to { transform: rotate(360deg); } }';
        document.head.appendChild(styleEl);
      }

      root.appendChild(card);
      document.body.appendChild(root);

      requestAnimationFrame(function() {
        root.style.opacity = '1';
        card.style.transform = 'scale(1)';
      });

      // Tải danh sách cuộc trò chuyện qua API
      var conversationsData = [];
      fetch(baseUrl + '/api/chat/conversations', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (!json || !json.data || !Array.isArray(json.data)) {
          listContainer.innerHTML = '<div style="text-align: center; padding: 30px 16px; color: #8a8d91; font-size: 14px;">Không thể tải danh sách cuộc trò chuyện.</div>';
          return;
        }

        conversationsData = json.data;
        renderList(conversationsData);
      })
      .catch(function(err) {
        console.error('Lỗi tải danh sách cuộc trò chuyện:', err);
        listContainer.innerHTML = '<div style="text-align: center; padding: 30px 16px; color: #8a8d91; font-size: 14px;">Lỗi kết nối. Vui lòng thử lại.</div>';
      });

      function renderList(items) {
        listContainer.innerHTML = '';
        if (!items || items.length === 0) {
          listContainer.innerHTML = '<div style="text-align: center; padding: 30px 16px; color: #8a8d91; font-size: 14px;">Không tìm thấy cuộc trò chuyện nào.</div>';
          return;
        }

        items.forEach(function(item) {
          var conv = item.Conversations || {};
          var convId = conv.id || item.conversationId;
          if (!convId) return;

          var isGroup = conv.type === 'group';
          var convName = 'Người dùng';
          var avatarUrl = '';
          var isOnline = false;

          if (isGroup) {
            convName = conv.name || 'Nhóm';
            avatarUrl = conv.avatar ? (conv.avatar.startsWith('/') ? baseUrl + conv.avatar : conv.avatar) : '';
          } else {
            var members = conv.ConversationMembers || [];
            var other = members.find(function(m) { return m.userId !== myUserId; }) || members[0];
            if (other) {
              convName = other.nickname || (other.Users ? (other.Users.fullName || other.Users.username) : 'Người dùng');
              if (other.Users && other.Users.avatar) {
                avatarUrl = other.Users.avatar.startsWith('/') ? baseUrl + other.Users.avatar : other.Users.avatar;
              }
              if (other.Users && other.Users.isOnline) isOnline = true;
            }
          }

          var row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 12px; margin-bottom: 4px; transition: background 0.15s; cursor: pointer;';
          row.onmouseenter = function() { row.style.background = '#f2f4f7'; };
          row.onmouseleave = function() { row.style.background = 'transparent'; };

          // Left info
          var left = document.createElement('div');
          left.style.cssText = 'display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; margin-right: 12px;';

          // Avatar
          var avWrap = document.createElement('div');
          avWrap.style.cssText = 'position: relative; width: 44px; height: 44px; flex-shrink: 0;';
          if (avatarUrl) {
            var avImg = document.createElement('img');
            avImg.src = avatarUrl;
            avImg.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
            avWrap.appendChild(avImg);
          } else {
            var avFallback = document.createElement('div');
            avFallback.innerText = convName.charAt(0).toUpperCase();
            avFallback.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; background: #0068FF; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 17px;';
            avWrap.appendChild(avFallback);
          }
          if (isOnline) {
            var onDot = document.createElement('div');
            onDot.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; background: #31a24c; border: 2px solid #fff;';
            avWrap.appendChild(onDot);
          }
          left.appendChild(avWrap);

          // Name & Type
          var infoBox = document.createElement('div');
          infoBox.style.cssText = 'min-width: 0; flex: 1;';
          var nameEl = document.createElement('div');
          nameEl.innerText = convName;
          nameEl.style.cssText = 'font-size: 15px; font-weight: 600; color: #1c1e21; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
          var typeEl = document.createElement('div');
          typeEl.innerText = isGroup ? 'Nhóm trò chuyện' : (isOnline ? 'Đang hoạt động' : 'Trò chuyện');
          typeEl.style.cssText = 'font-size: 12px; color: ' + (isOnline ? '#31a24c' : '#65676b') + '; margin-top: 2px;';
          infoBox.appendChild(nameEl);
          infoBox.appendChild(typeEl);
          left.appendChild(infoBox);

          // Right button "Gửi"
          var sendBtn = document.createElement('button');
          sendBtn.innerText = 'Gửi';
          sendBtn.style.cssText = 'padding: 7px 18px; border-radius: 20px; font-size: 13.5px; font-weight: 600; color: #ffffff; background: #0068FF; border: none; cursor: pointer; transition: all 0.18s ease; flex-shrink: 0; outline: none;';
          
          sendBtn.onclick = function(e) {
            e.stopPropagation();
            if (sendBtn.disabled) return;
            sendBtn.disabled = true;
            sendBtn.innerText = 'Đang gửi...';
            sendBtn.style.background = '#80b3ff';

            fetch(baseUrl + '/api/chat/messages/forward', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                messageIds: messageIds,
                conversationIds: [convId]
              })
            })
            .then(function(res) { return res.json(); })
            .then(function(resData) {
              if (resData.success) {
                sendBtn.innerText = 'Đã gửi ✓';
                sendBtn.style.background = '#E8F5E9';
                sendBtn.style.color = '#2E7D32';
                sendBtn.style.cursor = 'default';
                showToast('Đã chuyển tiếp tới ' + convName + ' thành công!');
              } else {
                sendBtn.disabled = false;
                sendBtn.innerText = 'Thử lại';
                sendBtn.style.background = '#ff4d4f';
                sendBtn.style.color = '#fff';
                showToast(resData.message || 'Chuyển tiếp thất bại');
              }
            })
            .catch(function(err) {
              console.error('Lỗi chuyển tiếp tin nhắn:', err);
              sendBtn.disabled = false;
              sendBtn.innerText = 'Thử lại';
              sendBtn.style.background = '#ff4d4f';
              sendBtn.style.color = '#fff';
              showToast('Lỗi mạng khi chuyển tiếp tin nhắn');
            });
          };

          row.appendChild(left);
          row.appendChild(sendBtn);
          listContainer.appendChild(row);
        });
      }

      // Lọc danh sách theo từ khóa tìm kiếm
      searchInput.oninput = function() {
        var query = searchInput.value.trim().toLowerCase();
        if (!query) {
          renderList(conversationsData);
          return;
        }
        var filtered = conversationsData.filter(function(item) {
          var conv = item.Conversations || {};
          var name = '';
          if (conv.type === 'group') {
            name = conv.name || '';
          } else {
            var members = conv.ConversationMembers || [];
            var other = members.find(function(m) { return m.userId !== myUserId; }) || members[0];
            if (other) {
              name = other.nickname || (other.Users ? (other.Users.fullName || other.Users.username) : '');
            }
          }
          return name.toLowerCase().indexOf(query) !== -1;
        });
        renderList(filtered);
      };

      // Toast thông báo nhỏ
      function showToast(msg) {
        var oldToast = document.getElementById('forward-toast-notify');
        if (oldToast) oldToast.remove();

        var toast = document.createElement('div');
        toast.id = 'forward-toast-notify';
        toast.innerText = msg;
        toast.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #fff; padding: 10px 22px; border-radius: 24px; font-size: 14px; font-weight: 500; z-index: 1000002; box-shadow: 0 6px 20px rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s ease; pointer-events: none;';
        document.body.appendChild(toast);

        requestAnimationFrame(function() { toast.style.opacity = '1'; });
        setTimeout(function() {
          toast.style.opacity = '0';
          setTimeout(function() { if (toast.parentNode) toast.remove(); }, 250);
        }, 2500);
      }
    } catch (e) {
      console.error('Lỗi khi mở modal chuyển tiếp:', e);
    }
  };
`;

// ==========================================
// 2. GHI VÀO CẢ 6 VỊ TRÍ WEBRTC_AUDIO_HELPER.JS
// ==========================================
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js')
];

helperFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Xóa helper cũ nếu đã có
  if (content.includes('window.openForwardModal = function')) {
    content = content.replace(/\/\/ ═+[\s\S]*?window\.openForwardModal[\s\S]*?\n  \};\n/g, '');
  }

  // Chèn trước dấu đóng })(); cuối cùng
  const lastIndex = content.lastIndexOf('})();');
  if (lastIndex !== -1) {
    content = content.slice(0, lastIndex) + forwardModalHelperCode + '\n})();' + content.slice(lastIndex + 5);
  } else {
    content += '\n' + forwardModalHelperCode;
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [OK] Đã cập nhật window.openForwardModal vào ${file}`);
});

// ==========================================
// 3. CẬP NHẬT MAIN.DART.JS CHO CẢ 4 VỊ TRÍ
// ==========================================
const mainDartFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

mainDartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // 3.1. Cập nhật A.aAlbumShareTap để gọi window.openForwardModal
  const oldShareTapPattern = /A\.aAlbumShareTap\s*=\s*function[\s\S]*?A\.aAlbumShareTap\.prototype\s*=\s*\{[\s\S]*?\$S:\s*0\s*\};/;
  const newShareTap = `A.aAlbumShareTap = function aAlbumShareTap(cluster) {
  this.cluster = cluster;
};
A.aAlbumShareTap.prototype = {
  $0() {
    try {
      if (!this.cluster || !this.cluster.length) return;
      var msgIds = [];
      var urls = [];
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
        if (m.a) msgIds.push(m.a);
        var s = m.e || "";
        var j = m.f || s;
        if (J.pX(s, "http") || J.pX(s, "/")) {
          j = s;
          if (j && j.startsWith("/")) {
            var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
            j = _be + j;
          }
        }
        urls.push(j || s);
      }
      if (window.openForwardModal) {
        window.openForwardModal({ messageIds: msgIds, urls: urls, cluster: this.cluster });
      }
    } catch(e) {
      console.error("Album share forward error:", e);
    }
  },
  $S: 0
};`;

  if (oldShareTapPattern.test(content)) {
    content = content.replace(oldShareTapPattern, newShareTap);
    console.log(`  [OK] Đã cập nhật A.aAlbumShareTap trong ${path.basename(file)}`);
  }

  // 3.2. Cập nhật $.buildPhotoDeckWidget để hiển thị nhãn "↪ Đã chuyển tiếp" khi isForwarded = true
  const oldBuildPhotoDeck = /\$\.buildPhotoDeckWidget\s*=\s*function\(cluster,\s*chatState,\s*isMe\)\s*\{[\s\S]*?return A\.bm\(A\.b\(\[headerTitle,\s*headerSpacing,\s*middleRow\],\s*t\.p\),\s*isMe\s*\?\s*B\.dw\s*:\s*B\.aS,\s*B\.m,\s*B\.G\);\s*\};/;
  const newBuildPhotoDeck = `$.buildPhotoDeckWidget = function(cluster, chatState, isMe) {
  if (!cluster || cluster.length < 2) return null;

  var count = cluster.length;
  var cardW = 200;
  var cardH = 260;

  function makeCardImg(msg, w, h) {
    var s = msg.e || "";
    var j = msg.f || s;
    var r = null;
    if (J.pX(s, "http") || J.pX(s, "/")) {
      r = s;
      if (r && r.startsWith("/")) {
        var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
        r = _be + r;
      }
    }
    var img;
    if (r != null && r.length !== 0) {
      img = new A.mD(A.aLD(null, null, new A.oH(r, 1)), new A.auP(), null, null, B.cp, B.e8, null);
    } else if (j != null && j.length !== 0) {
      img = new A.mD(A.aLD(null, null, new A.eY(j, 1, null)), new A.auQ(), null, null, B.cp, B.e8, null);
    } else {
      img = B.yF;
    }

    var cellImg = new A.cv(w, h, img, null);
    var isSending = msg.status === "sending" || (msg.a && (msg.a.indexOf("optimistic-") === 0 || msg.a.indexOf("uploading-") === 0 || msg.a.indexOf("temp_") === 0));

    if (isSending) {
      var _spin = A.bV(B.rw, B.f, null, 26);
      var _shade = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(1879048192), null, null, null, null, null, B.t), null, w, null, null, null, null, h);
      return A.dt(B.aF, A.b([cellImg, _shade], t.p), B.r, B.ap);
    }
    return cellImg;
  }

  // 1. Tiêu đề "⊞ N ảnh"
  var headerTitle = A.a2("⊞ " + count + " ảnh", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4283124560), null, null, null, null, null, null, null, null, 17, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 6, null, null);

  // 2. Chồng Thẻ Ảnh 3D (Stacked Cards)
  var stackCards = [];

  if (count >= 3) {
    var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 8, null, null, null, null, cardH - 8);
    var pos2 = A.eG(0, backCard2, null, null, 4, null, null, null);
    stackCards.push(pos2);
  }

  if (count >= 2) {
    var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 4, null, null, null, null, cardH - 4);
    var pos1 = A.eG(4, backCard1, null, null, 12, null, null, null);
    stackCards.push(pos1);
  }

  var frontImg = makeCardImg(cluster[0], cardW, cardH);
  var frontClipped = A.aP5(A.ag(24), frontImg);
  var posFront = A.eG(8, frontClipped, null, null, 0, null, null, null);
  stackCards.push(posFront);

  var deckStack = new A.cv(cardW + 16, cardH + 12, A.dt(B.aF, A.b(stackCards, t.p), B.r, B.ap), null);
  var deckWithTap = A.dr(null, deckStack, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster), null, null, null, null, null, null, !1, B.ao);

  // 3. Nút tròn chuyển tiếp (Circular Forward Button với mũi tên cong ↪)
  var shareArrow = A.a2("↪", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4279244074), null, null, null, null, null, null, null, null, 20, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var shareBtnInner = A.a5(null, shareArrow, B.h, null, null, new A.ak(new A.q(4293125611), null, null, A.ag(20), null, null, B.t), null, 40, null, null, null, null, 40);
  var shareBtn = A.dr(null, shareBtnInner, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumShareTap(cluster), null, null, null, null, null, null, !1, B.ao);

  var middleRow;
  if (isMe) {
    middleRow = A.b9(A.b([shareBtn, new A.cv(12, null, null, null), deckWithTap], t.p), B.dw, B.m, B.G);
  } else {
    middleRow = A.b9(A.b([deckWithTap, new A.cv(12, null, null, null), shareBtn], t.p), B.l, B.m, B.G);
  }

  // Kiểm tra tin nhắn chuyển tiếp
  var isFwd = cluster && cluster.some(function(m) { return m && (m.isForwarded === true || m.is_forwarded === true); });
  var colWidgets = [];
  if (isFwd) {
    var fwdLabel = A.a2("↪ Đã chuyển tiếp", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4286611584), null, null, null, null, null, null, null, null, 12, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
    colWidgets.push(new A.bc(B.i6, fwdLabel, null));
  }
  colWidgets.push(headerTitle);
  colWidgets.push(headerSpacing);
  colWidgets.push(middleRow);

  return A.bm(A.b(colWidgets, t.p), isMe ? B.dw : B.aS, B.m, B.G);
};`;

  if (oldBuildPhotoDeck.test(content)) {
    content = content.replace(oldBuildPhotoDeck, newBuildPhotoDeck);
    console.log(`  [OK] Đã cập nhật $.buildPhotoDeckWidget nhãn chuyển tiếp trong ${path.basename(file)}`);
  }

  // 3.3. Cập nhật wf(a) để lưu cờ isForwarded vào MessageModel (A.k1)
  const wfPattern = /return new A\.k1\(c,i,h,o,n,b,p,l,k,j,g,s,d\)\},/g;
  const newWfReturn = `var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);
if(a && (a.isForwarded === true || a.is_forwarded === true || (d && d.h && (d.h(a,"isForwarded") === true || d.h(a,"is_forwarded") === true)))){
  _mRes.isForwarded = true;
}
return _mRes;},`;

  if (content.includes('return new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d)},')) {
    content = content.replace(wfPattern, newWfReturn);
    console.log(`  [OK] Đã gắn cờ isForwarded vào wf(a) trong ${path.basename(file)}`);
  }

  // 3.4. Cập nhật A.au_.prototype.$2 cho tin nhắn đơn lẻ để hiển thị nhãn "↪ Đã chuyển tiếp"
  // Trong A.au_.prototype.$2: d=A.b([A.dt(B.aF,k,B.h,B.ap)],f)
  const targetBubblePattern = /d=A\.b\(\[A\.dt\(B\.aF,k,B\.h,B\.ap\)\],f\)/g;
  const newBubbleTarget = `var _bbStack = A.dt(B.aF,k,B.h,B.ap);
var _dArr = [];
if(e.isForwarded || e.is_forwarded){
  _dArr.push(new A.bc(B.i6, A.a2("\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp", h, h, h, h, h, B.Ec, h, h, h), h));
}
_dArr.push(_bbStack);
d=A.b(_dArr, f);`;

  if (content.includes('d=A.b([A.dt(B.aF,k,B.h,B.ap)],f)')) {
    content = content.replace(targetBubblePattern, newBubbleTarget);
    console.log(`  [OK] Đã chèn nhãn ↪ Đã chuyển tiếp vào tin nhắn đơn trong ${path.basename(file)}`);
  }

  fs.writeFileSync(file, content, 'utf8');
});

// ==========================================
// 4. CẬP NHẬT CACHE BUSTING TRONG INDEX.HTML & FLUTTER_BOOTSTRAP.JS
// ==========================================
const cacheBustFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

const newVersionTag = 'v_fwd_' + Date.now();

cacheBustFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/webrtc_audio_helper\.js\?v=[a-zA-Z0-9_\-]+/g, `webrtc_audio_helper.js?v=${newVersionTag}`);
  content = content.replace(/main\.dart\.js\?v=[a-zA-Z0-9_\-]+/g, `main.dart.js?v=${newVersionTag}`);

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [OK] Cập nhật Cache Busting ${newVersionTag} vào ${file}`);
});

console.log('\n🎉 ĐÃ TRIỂN KHAI HOÀN TẤT TÍNH NĂNG CHUYỂN TIẾP TIN NHẮN!');
