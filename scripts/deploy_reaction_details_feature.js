const fs = require('fs');
const path = require('path');
const vm = require('vm');

const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

const reactionDetailsModalCode = `
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
    loadingDiv.innerHTML = '<div style=\"width:18px;height:18px;border:2px solid #CBD5E1;border-top-color:#0084FF;border-radius:50%;animation:spin 0.8s linear infinite;\"></div> Đang tải cảm xúc...';
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
        emptyDiv.innerHTML = '<div style=\"font-size:32px;margin-bottom:6px;\">💭</div>Không còn cảm xúc nào';
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
          avatarImg.style.cssText = 'width:44px;height:44px;border-radius:50%;background-image:url(\"' + item.avatar + '\");background-size:cover;background-position:center;border:1px solid #E2E8F0;';
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
`;

helperFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  // Nếu đã có window.showReactionDetailsModal thì thay thế
  if (code.includes('window.showReactionDetailsModal = function')) {
    code = code.replace(
      /\/\/ ═+\r?\n\s*\/\/ MODAL CHI TIẾT NGƯỜI THẢ CẢM XÚC[\s\S]*?window\.showReactionDetailsModal = function[\s\S]*?\n  \};/,
      reactionDetailsModalCode.trim()
    );
  } else {
    // Thêm vào sau window.reactToMessage
    const targetAnchor = "window.reactToMessage = function";
    if (code.includes(targetAnchor)) {
      code = code.replace(targetAnchor, reactionDetailsModalCode + '\n  ' + targetAnchor);
    } else {
      code = reactionDetailsModalCode + '\n' + code;
    }
  }

  fs.writeFileSync(fp, code, 'utf8');
  console.log(`[PASS] Đã gắn window.showReactionDetailsModal vào: ${fp}`);

  try {
    new vm.Script(code);
    console.log(`  -> Cú pháp JS 100% PASS`);
  } catch (err) {
    console.error(`  -> LỖI CÚ PHÁP:`, err);
  }
});
