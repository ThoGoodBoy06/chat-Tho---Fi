const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu cập nhật tính năng Nhấn Giữ (Press & Hold) thả cảm xúc tin nhắn & hình ảnh...');

// ══════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT WEBRTC_AUDIO_HELPER.JS:
//    - XÓA nút khoanh tròn "❤️ Thả cảm xúc" khỏi thanh công cụ Gallery
//    - THÊM cơ chế Nhấn Giữ (Long-press / Touch & Hold / Mouse hold >= 380ms) trên ảnh
//      để hiển thị thanh emoji nổi chuẩn Messenger / Zalo
// ══════════════════════════════════════════════════════════════════════════════

const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

helperFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  // Tìm và thay thế phần cũ có galleryReactBtn
  const oldRegex = /\/\/\s*Thanh thả cảm xúc nhanh trên thanh công cụ Gallery[\s\S]*?actionsDiv\.appendChild\(reactBtn\);[\s\S]*?modal\.appendChild\(emojiBar\);/g;

  // Đoạn mã mới: Xóa nút reactBtn, tạo emojiBar nổi hỗ trợ nhấn giữ (Long-press)
  const newGalleryReactionCode = `
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
      });`;

  if (oldRegex.test(code)) {
    code = code.replace(oldRegex, newGalleryReactionCode);
    console.log(`  [webrtc_audio_helper] Đã xóa nút khoanh tròn & thêm bảng cảm xúc nhấn giữ: ${fp}`);
  }

  // Thêm sự kiện bắt Nhấn Giữ (Press and Hold) trên Track / Ảnh trong Gallery
  const trackAnchor = "modal.appendChild(track);";
  const pressHoldCode = `modal.appendChild(track);

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
      })();`;

  if (code.includes(trackAnchor) && !code.includes('Bắt cử chỉ NHẤN GIỮ')) {
    code = code.replace(trackAnchor, pressHoldCode);
    console.log(`  [webrtc_audio_helper] Đã gắn sự kiện nhấn giữ vào track ảnh: ${fp}`);
  }

  fs.writeFileSync(fp, code, 'utf8');
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT MAIN.DART.JS (Cả 4 bản):
//    - Sửa A.aImgLongPress để lấy đúng BuildContext: this.state.c
//    - Cập nhật window._activeChatScreenState và window._activeChatContext
// ══════════════════════════════════════════════════════════════════════════════

const mainJsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

mainJsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  // A. Cập nhật A.aImgLongPress
  const oldImgLongPress = `A.aImgLongPress = function aImgLongPress(state, msg, isMe) {
  this.state = state;
  this.msg = msg;
  this.isMe = isMe;
};
A.aImgLongPress.prototype = {
  $0: function() {
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (this.state && typeof this.state.VK === 'function') {
        var ctx = this.state.d || this.state.cx || (window.$ && window.$._activeChatContext);
        this.state.VK(ctx, this.msg, prov, this.isMe);
      }
    } catch(e) { console.warn("aImgLongPress error:", e); }
  },
  $1: function(details) {
    this.$0();
  },
  $S: 31
};`;

  const newImgLongPress = `A.aImgLongPress = function aImgLongPress(state, msg, isMe) {
  this.state = state;
  this.msg = msg;
  this.isMe = isMe;
};
A.aImgLongPress.prototype = {
  $0: function() {
    try {
      var state = this.state || (window.$ && window.$._activeChatScreenState);
      var ctx = (state && state.c) || (window.$ && window.$._activeChatContext);
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (state && typeof state.VK === 'function' && ctx && this.msg) {
        state.VK(ctx, this.msg, prov, this.isMe);
        return;
      }
    } catch(e) { console.warn("aImgLongPress error:", e); }
  },
  $1: function(details) {
    this.$0();
  },
  $S: 31
};`;

  if (code.includes('this.state.d || this.state.cx')) {
    code = code.replace(oldImgLongPress, newImgLongPress);
    console.log(`  [main.dart.js] Đã cập nhật aImgLongPress với ctx chuẩn: ${fp}`);
  }

  // B. Đảm bảo window._activeChatScreenState và window._activeChatContext được cập nhật khi vào chat
  if (code.includes('$._activeChatScreenState=c;') && !code.includes('window._activeChatScreenState=c;')) {
    code = code.replace(
      '$._activeChatScreenState=c;',
      '$._activeChatScreenState=c;window._activeChatScreenState=c;if(c&&c.c)window._activeChatContext=c.c;'
    );
    console.log(`  [main.dart.js] Đã thêm window._activeChatScreenState & context: ${fp}`);
  }

  // C. Kiểm tra cú pháp VM
  try {
    new vm.Script(code.slice(0, 300000));
    console.log(`  [Syntax] Header VM script check PASS: ${fp}`);
  } catch (err) {
    console.error(`  [ERROR] Syntax error in ${fp}:`, err);
  }

  fs.writeFileSync(fp, code, 'utf8');
});

console.log('✅ Hoàn tất áp dụng!');
