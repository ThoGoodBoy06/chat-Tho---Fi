const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu khắc phục triệt để lỗi rò rỉ ảnh giữa các cuộc trò chuyện (Cat/Pig bug)...');

// ════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT 6 FILE WEBRTC_AUDIO_HELPER.JS
// ════════════════════════════════════════════════════════════════════════════
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

const newGalleryModule = `// =========================================================================
// BỘ TRÌNH CHIẾU GALLERY VUỐT CHUẨN NATIVE MOBILE (CSS SCROLL SNAP + HARDWARE GPU)
// =========================================================================
(function () {
  window._chatImagesByConv = window._chatImagesByConv || {};
  window._currentConvId = null;
  window._chatImagesCache = [];

  window.clearChatImagesCache = function (convId) {
    if (convId) {
      window._currentConvId = convId;
      window._chatImagesByConv[convId] = [];
    } else {
      window._currentConvId = null;
      window._chatImagesByConv = {};
    }
    window._chatImagesCache = [];
  };

  window.recordChatImage = function (url, convId) {
    if (!url || typeof url !== 'string') return;
    var full = url;
    if (!full.startsWith('http://') && !full.startsWith('https://') && !full.startsWith('blob:') && !full.startsWith('data:')) {
      var origin = window.location.origin;
      var be = (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) ? origin : 'https://chat-tho-fi-vn-9s8u.onrender.com';
      full = be + (full.startsWith('/') ? '' : '/') + full;
    }

    if (convId) {
      if (window._currentConvId && window._currentConvId !== convId) {
        // Chuyển sang cuộc trò chuyện khác: reset bộ nhớ đệm hiển thị để ảnh không bao giờ bị lẫn lộn!
        window._chatImagesCache = [];
      }
      window._currentConvId = convId;
      if (!window._chatImagesByConv[convId]) {
        window._chatImagesByConv[convId] = [];
      }
      if (window._chatImagesByConv[convId].indexOf(full) === -1) {
        window._chatImagesByConv[convId].push(full);
      }
      window._chatImagesCache = window._chatImagesByConv[convId];
    } else {
      if (!window._chatImagesCache) window._chatImagesCache = [];
      if (window._chatImagesCache.indexOf(full) === -1) {
        window._chatImagesCache.push(full);
      }
    }
  };

  window.openAlbumGalleryModal = function (photoList, initialIndex) {
    if (!photoList) photoList = [];
    try {
      var existingModal = document.getElementById('globalAlbumGalleryModal');
      if (existingModal) existingModal.remove();

      var list = [];
      var seen = {};

      function addUrl(u) {
        if (!u || typeof u !== 'string') return;
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

      for (var i = 0; i < photoList.length; i++) {
        var item = photoList[i];
        var raw = typeof item === 'string' ? item : (item && (item.url || item.imageUrl || item.f || item.content || item.e) ? (item.url || item.imageUrl || item.f || item.content || item.e) : '');
        addUrl(raw);
      }

      // NGUYÊN TẮC CÁCH LY PHÒNG CHAT:
      // Nếu chỉ có 1 ảnh truyền vào:
      if (list.length <= 1) {
        var single = list[0];
        // Chỉ mở rộng danh sách nếu tìm thấy chính xác ảnh 'single' trong kho ảnh của ĐÚNG phòng chat hiện tại (_currentConvId)
        var currentCache = (window._currentConvId && window._chatImagesByConv[window._currentConvId]) ? window._chatImagesByConv[window._currentConvId] : window._chatImagesCache;
        if (currentCache && currentCache.length > 1 && single) {
          function getCleanKey(u) {
            if (!u || typeof u !== 'string') return '';
            var s = u.split('?')[0].split('#')[0];
            var idx = s.lastIndexOf('/');
            return idx !== -1 ? s.substring(idx + 1) : s;
          }
          var singleKey = getCleanKey(single);
          var foundIdx = -1;
          for (var k = 0; k < currentCache.length; k++) {
            if (currentCache[k] === single || getCleanKey(currentCache[k]) === singleKey) {
              foundIdx = k;
              break;
            }
          }
          if (foundIdx !== -1) {
            list = currentCache.slice();
            initialIndex = foundIdx;
          } else {
            // Không tìm thấy trong kho ảnh của phòng hiện tại -> giữ nguyên đúng 1 ảnh duy nhất được bấm!
            list = [single];
            initialIndex = 0;
          }
        }
      }

      if (!list.length) return;

      var currentIndex = typeof initialIndex === 'number' ? Math.max(0, Math.min(initialIndex, list.length - 1)) : 0;

      // Đảm bảo style CSS Scroll Snap
      var snapStyle = document.getElementById('gallerySnapStyle');
      if (!snapStyle) {
        snapStyle = document.createElement('style');
        snapStyle.id = 'gallerySnapStyle';
        snapStyle.textContent = 
          '#galleryTrack::-webkit-scrollbar{display:none;}' +
          '#galleryTrack{-ms-overflow-style:none;scrollbar-width:none;}' +
          '.gallery-slide{flex:0 0 100vw;width:100vw;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:8px 12px;user-select:none;-webkit-user-select:none;}' +
          '.gallery-slide img{max-width:96vw;max-height:75vh;object-fit:contain;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,0.85);user-select:none;-webkit-user-select:none;pointer-events:none;-webkit-user-drag:none;display:block;}' +
          '@media (min-width: 768px) {.gallery-slide img{max-width:88vw;max-height:80vh;}}';
        document.head.appendChild(snapStyle);
      }

      var modal = document.createElement('div');
      modal.id = 'globalAlbumGalleryModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,9,0.98);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10px 12px;box-sizing:border-box;user-select:none;-webkit-user-select:none;overflow:hidden;';

      // --- Header: Counter + Nút Lưu + Nút Đóng ---
      var header = document.createElement('div');
      header.id = 'galleryHeader';
      header.style.cssText = 'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;z-index:100;padding:4px 4px;';

      var counterPill = document.createElement('div');
      counterPill.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;padding:6px 15px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      counterPill.innerHTML = '<span>⊞</span> <span id="galleryCounterText">' + (currentIndex + 1) + ' / ' + list.length + '</span>';

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
      closeBtn.onclick = function (e) {
        e.stopPropagation();
        modal.remove();
      };

      actionsDiv.appendChild(dlBtn);
      actionsDiv.appendChild(closeBtn);
      header.appendChild(counterPill);
      header.appendChild(actionsDiv);
      modal.appendChild(header);

      // --- Body: Container cuộn Track CSS Scroll Snap ---
      var track = document.createElement('div');
      track.id = 'galleryTrack';
      track.style.cssText = 'flex:1;width:100vw;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scroll-behavior:auto;touch-action:pan-x pan-y pinch-zoom;align-items:center;';

      for (var j = 0; j < list.length; j++) {
        var slide = document.createElement('div');
        slide.className = 'gallery-slide';
        var img = document.createElement('img');
        img.src = list[j];
        img.loading = 'eager';
        slide.appendChild(img);
        track.appendChild(slide);
      }
      modal.appendChild(track);

      // Nút điều hướng Desktop (Trái / Phải)
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = 'position:absolute;left:18px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:28px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);';
      prevBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        }
      };

      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = 'position:absolute;right:18px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:28px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);';
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        }
      };

      if (window.innerWidth >= 768 && list.length > 1) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
      }
      modal.appendChild(prevBtn);
      modal.appendChild(nextBtn);

      function updateCounter() {
        var txt = document.getElementById('galleryCounterText');
        if (txt) txt.textContent = (currentIndex + 1) + ' / ' + list.length;
        if (prevBtn) prevBtn.style.opacity = currentIndex > 0 ? '1' : '0.3';
        if (nextBtn) nextBtn.style.opacity = currentIndex < list.length - 1 ? '1' : '0.3';
      }

      function updateScrollPos(smooth) {
        var w = window.innerWidth;
        if (track) {
          track.scrollTo({ left: currentIndex * w, behavior: smooth ? 'smooth' : 'instant' });
        }
        updateCounter();
      }

      var scrollTimer = null;
      track.addEventListener('scroll', function () {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          var w = window.innerWidth;
          var newIdx = Math.round(track.scrollLeft / w);
          if (newIdx !== currentIndex && newIdx >= 0 && newIdx < list.length) {
            currentIndex = newIdx;
            updateCounter();
          }
        }, 30);
      }, { passive: true });

      var startX = 0, startY = 0, isDragging = false;
      modal.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches.length === 1) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          isDragging = true;
        }
      }, { passive: true });

      modal.addEventListener('touchend', function (e) {
        if (!isDragging) return;
        isDragging = false;
        if (e.changedTouches && e.changedTouches.length === 1) {
          var dy = e.changedTouches[0].clientY - startY;
          var dx = Math.abs(e.changedTouches[0].clientX - startX);
          if (dy > 120 && dx < 60) {
            modal.remove();
          }
        }
      }, { passive: true });

      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target === track) {
          modal.remove();
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

  // Đồng bộ hoàn toàn window.openImageModal sang window.openAlbumGalleryModal
  window.openImageModal = function (imageUrl) {
    if (!imageUrl) return;
    window.openAlbumGalleryModal([imageUrl], 0);
  };
})();`;

helperFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang cập nhật webrtc_audio_helper.js: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // Thay thế module gallery cũ
  const galleryPattern = /\/\/\s*={10,}[\r\n\s]*\/\/\s*BỘ TRÌNH CHIẾU GALLERY VUỐT CHUẨN NATIVE MOBILE[\s\S]*?window\.openImageModal\s*=\s*function\s*\(imageUrl\)[\s\S]*?\};\s*\}\)\(\);/;
  if (galleryPattern.test(content)) {
    content = content.replace(galleryPattern, newGalleryModule);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [OK] Đã thay thế thành công Gallery Module chuẩn cô lập phòng chat!`);
  } else {
    console.warn(`  [WARN] Không khớp galleryPattern trong ${file}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT 4 FILE MAIN.DART.JS
// ════════════════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang xử lý JS: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // Cập nhật recordChatImage: truyền kèm e.b (conversationId) và chỉ ghi nhận ảnh CHƯA bị thu hồi (!e.y)
  const oldRecPattern = /if\(window\.recordChatImage\)\{window\.recordChatImage\([^)]*\);\}/g;
  const newRec = 'if(!e.y&&window.recordChatImage){window.recordChatImage(e.imageUrl||e.f||e.content||e.e,e.b);}';

  if (oldRecPattern.test(content)) {
    content = content.replace(oldRecPattern, newRec);
    console.log('  [OK] Đã cập nhật recordChatImage truyền kèm conversationId và bỏ qua ảnh đã thu hồi.');
  }

  try {
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [SUCCESS] Syntax check hợp lệ 100% cho: ${file}`);
  } catch (err) {
    console.error(`  [ERROR] Lỗi cú pháp khi cập nhật ${file}:`, err);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CẬP NHẬT CHAT_PROVIDER.DART (CẢ 2 NƠI)
// ════════════════════════════════════════════════════════════════════════════
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'providers', 'chat_provider.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'providers', 'chat_provider.dart')
];

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang cập nhật Dart: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // Trong selectConversation: thêm html.window.callMethod('clearChatImagesCache', [conv.id]);
  const selectConvStart = '  Future<void> selectConversation(ConversationModel conv) async {\r\n    selectedConversation = conv;';
  const selectConvStartLF = '  Future<void> selectConversation(ConversationModel conv) async {\n    selectedConversation = conv;';
  
  const replTarget = `  Future<void> selectConversation(ConversationModel conv) async {
    if (kIsWeb) {
      try {
        html.window.callMethod('clearChatImagesCache', [conv.id]);
      } catch (_) {}
    }
    selectedConversation = conv;`;

  if (content.includes(selectConvStart) && !content.includes("clearChatImagesCache', [conv.id]")) {
    content = content.replace(selectConvStart, replTarget);
    console.log('  [OK] Đã gắn clearChatImagesCache vào selectConversation (CRLF)');
  } else if (content.includes(selectConvStartLF) && !content.includes("clearChatImagesCache', [conv.id]")) {
    content = content.replace(selectConvStartLF, replTarget);
    console.log('  [OK] Đã gắn clearChatImagesCache vào selectConversation (LF)');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`💾 Đã lưu thành công Dart: ${file}`);
});

console.log('\n🎉 Hoàn tất khắc phục lỗi hiển thị ảnh khác phòng chat!');
