/**
 * Chat Tho-Fi - Reaction Detail Modal & Bottom Sheet
 * Supports viewing reaction details & removing own reaction ("Bạn" + "Gỡ" button)
 * Compatible with http://localhost:3000 & production
 */
(function() {
  var emojiAssets = {
    '❤️': '/assets/emojis/2764-fe0f.png',
    '😆': '/assets/emojis/1f606.png',
    '😮': '/assets/emojis/1f62e.png',
    '😢': '/assets/emojis/1f622.png',
    '😡': '/assets/emojis/1f621.png',
    '👍': '/assets/emojis/1f44d.png'
  };

  function normalizeEmoji(em) {
    if (!em) return '';
    em = String(em).trim();
    if (em.indexOf('❤️') !== -1 || em.indexOf('\u2764') !== -1) return '❤️';
    if (em.indexOf('😆') !== -1 || em.indexOf('\ud83d\ude06') !== -1) return '😆';
    if (em.indexOf('😮') !== -1 || em.indexOf('\ud83d\ude2e') !== -1) return '😮';
    if (em.indexOf('😢') !== -1 || em.indexOf('\ud83d\ude22') !== -1) return '😢';
    if (em.indexOf('😡') !== -1 || em.indexOf('\ud83d\ude21') !== -1) return '😡';
    if (em.indexOf('👍') !== -1 || em.indexOf('\ud83d\udc4d') !== -1) return '👍';
    if (em.indexOf('😂') !== -1 || em.indexOf('\ud83d\ude02') !== -1) return '😂';
    return em;
  }

  function renderEmoji(emoji, size) {
    size = size || 24;
    var norm = normalizeEmoji(emoji);
    var asset = emojiAssets[norm];
    if (asset) {
      return '<img src="' + asset + '" width="' + size + '" height="' + size + '" style="vertical-align:middle;object-fit:contain;display:inline-block;" alt="' + norm + '" onerror="this.outerHTML=\'' + norm + '\'"/>';
    }
    return '<span style="font-size:' + size + 'px;line-height:1;display:inline-block;vertical-align:middle;">' + (norm || '') + '</span>';
  }

  function formatAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    var base = window.location.origin || 'http://localhost:3000';
    return base + (url.startsWith('/') ? url : '/' + url);
  }

  window._openReactionDetailModal = function(msg, scope) {
    var old = document.getElementById('reaction-detail-modal-overlay');
    if (old) old.remove();

    if (!msg) return;
    var msgId = msg.a;

    // Trích xuất reactions từ msg.Q (Dart LinkedHashMap) chính xác 100%
    var rawReactions = {};
    try {
      if (msg && msg.Q) {
        // Cách 1: Duyệt qua entries từ geK (MapEntry trong Dart2js: entry.a = key, entry.b = value)
        if (typeof msg.Q.geK === 'function') {
          var entries = msg.Q.geK(msg.Q).fa(0);
          for (var i = 0; i < entries.length; i++) {
            var ent = entries[i];
            if (ent) {
              var u = (ent.a !== undefined) ? ent.a : ent.key;
              var em = (ent.b !== undefined) ? ent.b : ent.value;
              if (u && em) rawReactions[u] = em;
            }
          }
        }
        // Cách 2: Danh sách liên kết nội bộ của Dart LinkedHashMap (A.fO.e)
        if (Object.keys(rawReactions).length === 0 && msg.Q.e) {
          var curr = msg.Q.e;
          while (curr) {
            if (curr.a && curr.b) {
              rawReactions[curr.a] = curr.b;
            }
            curr = curr.c;
          }
        }
        // Cách 3: Bảng băm nội bộ (A.fO.b)
        if (Object.keys(rawReactions).length === 0 && msg.Q.b) {
          for (var k in msg.Q.b) {
            var node = msg.Q.b[k];
            if (node && node.a && node.b) {
              rawReactions[node.a] = node.b;
            }
          }
        }
        // Cách 4: Plain JS object fallback
        if (Object.keys(rawReactions).length === 0 && typeof msg.Q === 'object') {
          for (var k in msg.Q) {
            if (typeof msg.Q[k] === 'string') {
              rawReactions[k] = msg.Q[k];
            }
          }
        }
      }
    } catch(e) {
      console.error('Error reading msg reactions:', e);
    }

    var userIds = Object.keys(rawReactions);
    if (userIds.length === 0) return;

    // Phân giải State, Provider, Conversation, Current User
    var chatState = (scope && scope.a && typeof scope.a.K === 'function') ? scope.a : scope;
    var provider = (scope && scope.b) ? scope.b : (chatState && chatState.d);
    var conv = (scope && scope.d) ? scope.d : (provider && provider.c ? provider.c : null);
    var currentUser = (provider && provider.a) ? provider.a : null;

    // Lấy ID người dùng hiện tại
    var currentUserId = (currentUser && currentUser.a) || (window.$ && window.$.aLM) || '';
    var currentUserAvatar = (currentUser && (currentUser.r || currentUser.e || currentUser.avatar)) || '';

    if (!currentUserId) {
      try {
        var userStr = localStorage.getItem('flutter.userData') || localStorage.getItem('user');
        if (userStr) {
          var u = JSON.parse(userStr);
          currentUserId = u.id || u.userId || '';
          currentUserAvatar = currentUserAvatar || u.avatar || '';
        }
      } catch(e) {}
    }

    // Lấy danh sách thành viên cuộc trò chuyện
    var membersMap = {};
    var convName = (conv && conv.b) || 'Người dùng';
    var convAvatar = (conv && conv.c) || '';
    var convId = (conv && conv.a) || msg.b || '';

    // Trích xuất members từ conv.x (Dart List<UserModel>)
    if (conv && conv.x && conv.x.length) {
      for (var mi = 0; mi < conv.x.length; mi++) {
        var m = conv.x[mi];
        if (m) {
          var uid = m.a;
          var displayName = (typeof m.gCo === 'function' ? m.gCo() : (m.d || m.c || m.b || ''));
          var avatar = m.r || m.e || m.avatar || '';
          if (uid) {
            membersMap[uid] = {
              name: displayName,
              avatar: avatar
            };
          }
        }
      }
    }

    // Nếu là chat 1-1, đối phương là convName/convAvatar
    userIds.forEach(function(uid) {
      if (uid !== currentUserId && !membersMap[uid]) {
        membersMap[uid] = {
          name: convName,
          avatar: convAvatar
        };
      }
    });

    var selectedEmojiFilter = null; // null = Tất cả

    // Tạo overlay DOM
    var overlay = document.createElement('div');
    overlay.id = 'reaction-detail-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.48);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99999999;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.22s ease;';

    // Tạo bottom sheet
    var sheet = document.createElement('div');
    sheet.id = 'reaction-detail-sheet';
    sheet.style.cssText = 'background:#ffffff;width:100%;max-width:440px;max-height:78vh;border-top-left-radius:24px;border-top-right-radius:24px;padding:12px 0 24px;box-shadow:0 -12px 40px rgba(0,0,0,0.22);transform:translateY(100%);transition:transform 0.25s cubic-bezier(0.16,1,0.3,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;display:flex;flex-direction:column;box-sizing:border-box;';

    // Desktop responsive styling
    if (window.innerWidth > 600) {
      overlay.style.alignItems = 'center';
      sheet.style.borderRadius = '24px';
      sheet.style.maxHeight = '520px';
      sheet.style.transform = 'scale(0.92)';
      sheet.style.transition = 'transform 0.22s cubic-bezier(0.16,1,0.3,1), opacity 0.22s ease';
    }

    function closeModal() {
      overlay.style.opacity = '0';
      if (window.innerWidth > 600) {
        sheet.style.transform = 'scale(0.92)';
      } else {
        sheet.style.transform = 'translateY(100%)';
      }
      setTimeout(function() {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 220);
    }

    overlay.onclick = function(e) {
      if (e.target === overlay) closeModal();
    };

    function renderContent() {
      var allUserIds = Object.keys(rawReactions);
      if (allUserIds.length === 0) {
        closeModal();
        return;
      }

      // Thống kê số lượng từng emoji chuẩn hóa
      var emojiCounts = {};
      for (var uid in rawReactions) {
        var em = normalizeEmoji(rawReactions[uid]);
        if (em) {
          emojiCounts[em] = (emojiCounts[em] || 0) + 1;
        }
      }

      if (selectedEmojiFilter && !emojiCounts[selectedEmojiFilter]) {
        selectedEmojiFilter = null;
      }

      // Lọc danh sách theo tab được chọn
      var filteredUserIds = allUserIds.filter(function(uid) {
        if (!selectedEmojiFilter) return true;
        return normalizeEmoji(rawReactions[uid]) === selectedEmojiFilter;
      });

      // Ưu tiên "Bạn" lên đầu tiên
      filteredUserIds.sort(function(a, b) {
        if (a === currentUserId) return -1;
        if (b === currentUserId) return 1;
        return 0;
      });

      var html = '';

      // Drag bar
      html += '<div style="display:flex;justify-content:center;margin-bottom:10px;"><div style="width:40px;height:4px;background:#CBD5E1;border-radius:2px;"></div></div>';

      // Header tiêu đề + nút đóng
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 20px 10px;">';
      html += '<div style="font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-0.2px;">Cảm xúc về tin nhắn</div>';
      html += '<button id="reaction-modal-close-btn" style="border:none;background:#F1F5F9;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;font-size:16px;font-weight:bold;transition:background 0.15s, transform 0.1s;">✕</button>';
      html += '</div>';

      // Tabs lọc cảm xúc (Tất cả N, ❤️ N, 👍 N, ...)
      html += '<div style="display:flex;gap:8px;padding:4px 20px 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;">';
      var allSel = (selectedEmojiFilter === null);
      html += '<div class="rx-tab-btn" data-emoji="" style="padding:6px 14px;border-radius:20px;cursor:pointer;white-space:nowrap;font-size:13px;font-weight:' + (allSel ? '700' : '600') + ';background:' + (allSel ? '#EBF5FF' : '#F1F5F9') + ';color:' + (allSel ? '#0068FF' : '#475569') + ';border:' + (allSel ? '1.5px solid #0068FF' : '1.5px solid transparent') + ';box-shadow:' + (allSel ? '0 1px 4px rgba(0,104,255,0.18)' : 'none') + ';transition:all 0.15s;">Tất cả ' + allUserIds.length + '</div>';

      for (var em in emojiCounts) {
        var isSel = (selectedEmojiFilter === em);
        html += '<div class="rx-tab-btn" data-emoji="' + em + '" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;cursor:pointer;white-space:nowrap;font-size:13px;font-weight:' + (isSel ? '700' : '600') + ';background:' + (isSel ? '#EBF5FF' : '#F1F5F9') + ';color:' + (isSel ? '#0068FF' : '#475569') + ';border:' + (isSel ? '1.5px solid #0068FF' : '1.5px solid transparent') + ';box-shadow:' + (isSel ? '0 1px 4px rgba(0,104,255,0.18)' : 'none') + ';transition:all 0.15s;">' + renderEmoji(em, 16) + ' ' + emojiCounts[em] + '</div>';
      }
      html += '</div>';

      html += '<div style="height:1px;background:#F1F5F9;margin-bottom:8px;"></div>';

      // Danh sách người thả cảm xúc
      html += '<div style="flex:1;overflow-y:auto;padding:0 16px;max-height:50vh;display:flex;flex-direction:column;gap:6px;">';

      filteredUserIds.forEach(function(uid) {
        var isMe = (currentUserId && uid === currentUserId);
        var rawEm = rawReactions[uid];
        var emoji = normalizeEmoji(rawEm);
        var member = membersMap[uid];

        var displayName = isMe ? 'Bạn' : ((member && member.name) || convName || 'Người dùng');
        var avatarUrl = isMe ? currentUserAvatar : ((member && member.avatar) || convAvatar || '');
        var firstLetter = (displayName && displayName[0] ? displayName[0].toUpperCase() : 'U');

        html += '<div class="rx-user-row" data-uid="' + uid + '" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:14px;background:' + (isMe ? '#F8FAFC' : '#FFFFFF') + ';border:' + (isMe ? '1px solid #E2E8F0' : '1px solid transparent') + ';transition:background 0.15s;' + (isMe ? 'cursor:pointer;' : '') + '">';
        
        // Bên trái: Avatar + Tên người dùng
        html += '<div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">';
        
        // Khối Avatar có badge emoji ở góc
        html += '<div style="position:relative;width:44px;height:44px;flex-shrink:0;">';
        if (avatarUrl) {
          html += '<img src="' + formatAvatarUrl(avatarUrl) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;background:#E2E8F0;display:block;" alt="' + displayName + '" onerror="this.style.display=\'none\';if(this.nextSibling)this.nextSibling.style.display=\'flex\';"/>';
          html += '<div style="display:none;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0068FF,#00A3FF);align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:17px;">' + firstLetter + '</div>';
        } else {
          html += '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0068FF,#00A3FF);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:17px;">' + firstLetter + '</div>';
        }
        // Badge icon cảm xúc tròn ở góc avatar
        html += '<div style="position:absolute;right:-4px;bottom:-3px;background:#ffffff;border-radius:50%;padding:2px;box-shadow:0 1px 4px rgba(0,0,0,0.18);line-height:0;display:flex;align-items:center;justify-content:center;">' + renderEmoji(emoji, 15) + '</div>';
        html += '</div>';

        // Tên & chú thích
        html += '<div style="display:flex;flex-direction:column;min-width:0;flex:1;">';
        html += '<span style="font-size:15px;font-weight:' + (isMe ? '700' : '600') + ';color:#0F172A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + displayName + '</span>';
        if (isMe) {
          html += '<span style="font-size:12px;color:#64748B;margin-top:1px;">Nhấp để gỡ cảm xúc</span>';
        }
        html += '</div>';
        html += '</div>';

        // Bên phải: Nút "Gỡ" (nếu là Bạn) hoặc Icon cảm xúc lớn (nếu là người khác)
        if (isMe) {
          html += '<button class="rx-remove-btn" data-emoji="' + emoji + '" style="border:none;background:#FEE2E2;color:#EF4444;font-size:13px;font-weight:700;padding:7px 15px;border-radius:20px;cursor:pointer;display:flex;align-items:center;gap:5px;flex-shrink:0;box-shadow:0 1px 3px rgba(239,68,68,0.15);transition:all 0.15s;">';
          html += '<span style="font-size:13px;line-height:1;">✕</span> <span>Gỡ</span>';
          html += '</button>';
        } else {
          html += '<div style="flex-shrink:0;padding-left:8px;">' + renderEmoji(emoji, 26) + '</div>';
        }

        html += '</div>';
      });

      html += '</div>';

      sheet.innerHTML = html;

      // Gắn sự kiện tab click
      var tabBtns = sheet.querySelectorAll('.rx-tab-btn');
      tabBtns.forEach(function(btn) {
        btn.onclick = function() {
          var em = this.getAttribute('data-emoji') || null;
          selectedEmojiFilter = em;
          renderContent();
        };
      });

      // Nút đóng
      var closeBtn = sheet.querySelector('#reaction-modal-close-btn');
      if (closeBtn) closeBtn.onclick = closeModal;

      // Nút gỡ cảm xúc hoặc bấm vào dòng của "Bạn"
      var removeBtns = sheet.querySelectorAll('.rx-remove-btn');
      removeBtns.forEach(function(btn) {
        btn.onclick = function(e) {
          e.stopPropagation();
          var emojiToRemove = this.getAttribute('data-emoji') || rawReactions[currentUserId];
          handleRemoveOwnReaction(emojiToRemove);
        };
      });

      var userRows = sheet.querySelectorAll('.rx-user-row');
      userRows.forEach(function(row) {
        var uid = row.getAttribute('data-uid');
        if (uid === currentUserId) {
          row.onclick = function() {
            var emojiToRemove = rawReactions[currentUserId];
            handleRemoveOwnReaction(emojiToRemove);
          };
        }
      });
    }

    function handleRemoveOwnReaction(emoji) {
      if (!currentUserId || !rawReactions[currentUserId]) {
        closeModal();
        return;
      }

      emoji = normalizeEmoji(emoji) || normalizeEmoji(rawReactions[currentUserId]) || '👍';
      delete rawReactions[currentUserId];
      
      // Xóa trong Dart Map của msg
      if (msg && msg.Q && typeof msg.Q.E === 'function') {
        try { msg.Q.E(0, currentUserId); } catch(e) {}
      }

      // Kích hoạt Flutter re-render setState()
      if (chatState && typeof chatState.K === 'function') {
        try {
          chatState.K(new window.A.ax1());
        } catch(e) {}
      }

      // Phát sự kiện Socket.IO nếu kết nối sẵn sàng
      var socketSent = false;
      if (window.$ && window.$.bj && typeof window.$.bj.cn === 'function' && window.$.bj.y) {
        try {
          var t = window.t;
          window.$.bj.cn("react_message", window.A.V(["messageId", msgId, "conversationId", convId, "emoji", emoji], t.N, t.N));
          socketSent = true;
        } catch(e) {}
      }

      // Chỉ gọi HTTP POST dự phòng nếu Socket không khả dụng
      if (!socketSent) {
        try {
          var token = '';
          var tStr = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken');
          if (tStr) {
            try { token = JSON.parse(tStr); } catch(e) { token = tStr; }
          }
          var base = (window.location.origin || 'http://localhost:3000') + '/api';
          fetch(base + '/chat/messages/' + msgId + '/react', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? ('Bearer ' + token) : ''
            },
            body: JSON.stringify({ reaction: emoji })
          }).catch(function(err){ console.error('Lỗi gọi API react:', err); });
        } catch(e) {}
      }

      // Re-render modal với danh sách còn lại, nếu rỗng thì tự đóng
      if (Object.keys(rawReactions).length === 0) {
        closeModal();
      } else {
        renderContent();
      }
    }

    renderContent();

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Kích hoạt animation xuất hiện mượt mà
    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      if (window.innerWidth > 600) {
        sheet.style.transform = 'scale(1)';
      } else {
        sheet.style.transform = 'translateY(0)';
      }
    });
  };
})();
