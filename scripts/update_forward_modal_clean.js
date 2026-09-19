const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

const modalFuncCode = `  // ════════════════════════════════════════════════════════════════
  // 🌟 MODAL CHUYỂN TIẾP TIN NHẮN / ALBUM ẢNH (FORWARD DIALOG)
  // ════════════════════════════════════════════════════════════════
  window.openForwardModal = function (payload) {
    try {
      if (!payload) return;
      var messageIds = payload.messageIds || [];
      if (typeof messageIds === 'string') messageIds = [messageIds];
      if (payload.messageId && !messageIds.includes(payload.messageId)) messageIds.push(payload.messageId);
      var urls = payload.urls || [];
      var contentText = payload.content || '';
      var cluster = payload.cluster || [];

      var host = window.location.hostname;
      var port = window.location.port;
      var isLocal = host === 'localhost' || host === '127.0.0.1' || port === '3000' || port === '5000' || /^192\\.168\\./.test(host) || /^10\\./.test(host) || /^172\\.(1[6-9]|2\\d|3[01])\\./.test(host);
      var isCloudflare = host.indexOf('pages.dev') !== -1 || host.indexOf('workers.dev') !== -1 || host.indexOf('cloudflare') !== -1 || host.indexOf('web.app') !== -1;
      
      var baseUrl = (isLocal || !isCloudflare)
        ? (port ? window.location.origin : (window.location.protocol + '//' + host + ':3000'))
        : 'https://chat-tho-fi-vn-9s8u.onrender.com';
      if (isCloudflare) {
        baseUrl = 'https://chat-tho-fi-vn-9s8u.onrender.com';
      }

      if (!messageIds.length && cluster.length) {
        for (var ci = 0; ci < cluster.length; ci++) {
          var mid = cluster[ci].a || cluster[ci].id;
          if (mid) messageIds.push(mid);
          var u = cluster[ci].f || cluster[ci].imageUrl || cluster[ci].content;
          if (u && typeof u === 'string' && (u.startsWith('http') || u.startsWith('/') || u.startsWith('data:image'))) {
            if (u.startsWith('/')) u = baseUrl + u;
            if (!urls.includes(u)) urls.push(u);
          }
        }
      }

      var existing = document.getElementById('forward-msg-modal-root');
      if (existing) existing.remove();

      function getToken() {
        var t = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || '';
        if (t && t.startsWith('"') && t.endsWith('"')) {
          try { t = JSON.parse(t); } catch(e) {}
        }
        if (!t) {
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            var val = localStorage.getItem(k);
            if (val && typeof val === 'string' && val.indexOf('eyJ') !== -1) {
              if (val.startsWith('"') && val.endsWith('"')) {
                try { val = JSON.parse(val); } catch(e) {}
              }
              if (val.split('.').length === 3) {
                t = val;
                break;
              }
            }
          }
        }
        return t;
      }

      var token = getToken();

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
        if (!uid && token) {
          try {
            var payloadStr = atob(token.split('.')[1]);
            var jwtPayload = JSON.parse(payloadStr);
            uid = jwtPayload.id || jwtPayload.userId || jwtPayload.sub || '';
          } catch(e) {}
        }
        return uid;
      }

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
      var count = messageIds.length;
      if (urls.length > 1) {
        subtitle.innerText = 'Album ' + urls.length + ' ảnh';
      } else if (urls.length === 1) {
        subtitle.innerText = '1 hình ảnh';
      } else if (contentText) {
        subtitle.innerText = 'Tin nhắn văn bản';
      } else {
        subtitle.innerText = (count > 0 ? count : 1) + ' tin nhắn';
      }
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
      } else if (contentText) {
        var textPreview = document.createElement('div');
        textPreview.style.cssText = 'padding: 9px 14px; margin: 8px 16px 0; background: #f0f2f5; border-radius: 10px; font-size: 13.5px; color: #1c1e21; border-left: 3px solid #0068FF; max-height: 48px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0;';
        textPreview.innerText = '💬 ' + contentText;
        card.appendChild(textPreview);
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
        listContainer.innerHTML = '<div style="text-align: center; padding: 30px 16px; color: #8a8d91; font-size: 14px;">Lỗi kết nối (' + (err.message || 'Network error') + '). Vui lòng thử lại.</div>';
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

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('window.openForwardModal = function')) {
    content = content.replace(/\/\/\s*═+[\s\S]*?window\.openForwardModal[\s\S]*?\n  \};\n/g, '');
  }
  const endIdx = content.lastIndexOf('})();');
  if (endIdx !== -1) {
    content = content.substring(0, endIdx) + modalFuncCode + '\n' + content.substring(endIdx);
    fs.writeFileSync(file, content, 'utf8');
    console.log('  [OK] Đã cập nhật openForwardModal vào:', file);
  }
});
