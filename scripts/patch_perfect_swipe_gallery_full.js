const fs = require('fs');
const path = require('path');
const vm = require('vm');

const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
];

const galleryCode = `
// =========================================================================
// BỘ TRÌNH CHIẾU GALLERY VUỐT CHUẨN NATIVE MOBILE & DESKTOP (CSS SCROLL SNAP + MOUSE DRAG)
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
    if (!url || typeof url !== 'string' || url.length > 2000) return;
    var full = url;
    if (!full.startsWith('http://') && !full.startsWith('https://') && !full.startsWith('blob:') && !full.startsWith('data:')) {
      var origin = window.location.origin;
      var be = (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) ? origin : 'https://chat-tho-fi-vn-9s8u.onrender.com';
      full = be + (full.startsWith('/') ? '' : '/') + full;
    }

    if (convId) {
      if (window._currentConvId && window._currentConvId !== convId) {
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

  function getImagesFromActiveConversation() {
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (!prov) {
        var state = window._activeChatScreenState || (window.$ && window.$._activeChatScreenState);
        if (state) {
          for (var k in state) {
            if (state[k] && state[k].d && Array.isArray(state[k].d)) {
              prov = state[k];
              break;
            }
          }
        }
      }
      var imgs = [];
      if (prov && prov.d && Array.isArray(prov.d)) {
        for (var i = 0; i < prov.d.length; i++) {
          var m = prov.d[i];
          if (!m || m.y || m.isRecalled) continue;
          var raw = m.f || m.imageUrl || m.e || m.content;
          if (!raw || typeof raw !== 'string') continue;
          var low = raw.toLowerCase();
          var isImg = m.d === 'image' || m.type === 'image' ||
                      low.indexOf('data:image') === 0 ||
                      low.indexOf('/chat-media/') !== -1 ||
                      low.indexOf('.jpg') !== -1 || low.indexOf('.jpeg') !== -1 ||
                      low.indexOf('.png') !== -1 || low.indexOf('.webp') !== -1;
          if (isImg && raw !== '[Hình ảnh]' && raw !== '[Ảnh]') {
            var full = raw;
            if (!full.startsWith('http://') && !full.startsWith('https://') && !full.startsWith('blob:') && !full.startsWith('data:')) {
              var origin = window.location.origin;
              var be = (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) ? origin : 'https://chat-tho-fi-vn-9s8u.onrender.com';
              full = be + (full.startsWith('/') ? '' : '/') + full;
            }
            if (imgs.indexOf(full) === -1) {
              imgs.push(full);
            }
          }
        }
      }
      return imgs;
    } catch(e) {
      console.warn('getImagesFromActiveConversation err:', e);
      return [];
    }
  }

  function getCleanKey(u) {
    if (!u || typeof u !== 'string') return '';
    var s = u.split('?')[0].split('#')[0];
    var idx = s.lastIndexOf('/');
    return idx !== -1 ? s.substring(idx + 1) : s;
  }

  window.openAlbumGalleryModal = function (photoList, initialIndex) {
    if (!photoList) photoList = [];
    try {
      var existingModal = document.getElementById('globalAlbumGalleryModal');
      if (existingModal) existingModal.remove();

      var list = [];
      var seen = {};

      function addUrl(u) {
        if (!u || typeof u !== 'string' || (u.startsWith('data:') && u.length > 5000)) return;
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

      // NGUYÊN TẮC: Nếu chỉ có 1 ảnh truyền vào, lấy toàn bộ danh sách ảnh trong cuộc trò chuyện hiện tại để vuốt trái/phải!
      if (list.length <= 1) {
        var single = list[0];
        var singleKey = getCleanKey(single);
        var convImages = getImagesFromActiveConversation();
        if (convImages && convImages.length > 1) {
          var foundIdx = -1;
          for (var k = 0; k < convImages.length; k++) {
            if (convImages[k] === single || getCleanKey(convImages[k]) === singleKey) {
              foundIdx = k;
              break;
            }
          }
          if (foundIdx !== -1) {
            list = convImages;
            initialIndex = foundIdx;
          } else if (single) {
            convImages.push(single);
            list = convImages;
            initialIndex = convImages.length - 1;
          }
        } else {
          var currentCache = (window._currentConvId && window._chatImagesByConv[window._currentConvId]) ? window._chatImagesByConv[window._currentConvId] : window._chatImagesCache;
          if (currentCache && currentCache.length > 1 && single) {
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
            }
          }
        }
      }

      if (!list.length) return;

      var currentIndex = typeof initialIndex === 'number' ? Math.max(0, Math.min(initialIndex, list.length - 1)) : 0;

      var snapStyle = document.getElementById('gallerySnapStyle');
      if (!snapStyle) {
        snapStyle = document.createElement('style');
        snapStyle.id = 'gallerySnapStyle';
        snapStyle.textContent = 
          '#galleryTrack::-webkit-scrollbar{display:none;}' +
          '#galleryTrack{-ms-overflow-style:none;scrollbar-width:none;}' +
          '.gallery-slide{flex:0 0 100vw;width:100vw;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:8px 12px;user-select:none;-webkit-user-select:none;cursor:grab;}' +
          '.gallery-slide img{max-width:96vw;max-height:75vh;object-fit:contain;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,0.85);user-select:none;-webkit-user-select:none;pointer-events:none;-webkit-user-drag:none;display:block;}' +
          '@media (min-width: 768px) {.gallery-slide img{max-width:88vw;max-height:80vh;}}';
        document.head.appendChild(snapStyle);
      }

      var modal = document.createElement('div');
      modal.id = 'globalAlbumGalleryModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(4,6,9,0.98);backdrop-filter:blur(25px);-webkit-backdrop-filter:blur(25px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:10px 12px;box-sizing:border-box;user-select:none;-webkit-user-select:none;overflow:hidden;';

      // Header: Counter + Nút Lưu + Nút Đóng
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

      // Nút điều hướng (Trái / Phải) - Luôn hiển thị khi có > 1 ảnh
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = 'position:absolute;left:18px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:28px;cursor:pointer;display:' + (list.length > 1 ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);';
      prevBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        }
      };

      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = 'position:absolute;right:18px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:28px;cursor:pointer;display:' + (list.length > 1 ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);';
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        }
      };

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

      // Hỗ trợ kéo chuột trái/phải trên máy tính (Desktop Mouse Drag)
      var isMouseDown = false, startMouseX = 0, scrollStart = 0, hasDragged = false;
      track.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        isMouseDown = true;
        hasDragged = false;
        startMouseX = e.clientX;
        scrollStart = track.scrollLeft;
        track.style.scrollBehavior = 'auto';
        track.style.cursor = 'grabbing';
      });

      var onMouseMove = function (e) {
        if (!isMouseDown) return;
        var dx = e.clientX - startMouseX;
        if (Math.abs(dx) > 5) hasDragged = true;
        track.scrollLeft = scrollStart - dx;
      };

      var onMouseUp = function (e) {
        if (!isMouseDown) return;
        isMouseDown = false;
        track.style.cursor = '';
        if (hasDragged) {
          var w = window.innerWidth;
          var snapIdx = Math.round(track.scrollLeft / w);
          currentIndex = Math.max(0, Math.min(snapIdx, list.length - 1));
          updateScrollPos(true);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);

      // Cuộn chuột ngang (Wheel)
      track.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          track.scrollLeft += e.deltaY;
          if (scrollTimer) clearTimeout(scrollTimer);
          scrollTimer = setTimeout(function () {
            var w = window.innerWidth;
            var newIdx = Math.round(track.scrollLeft / w);
            if (newIdx !== currentIndex && newIdx >= 0 && newIdx < list.length) {
              currentIndex = newIdx;
              updateCounter();
            }
          }, 30);
        }
      }, { passive: false });

      // Phím mũi tên Trái / Phải & Escape
      var keyHandler = function (e) {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        } else if (e.key === 'ArrowRight' && currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        } else if (e.key === 'Escape') {
          cleanupAndClose();
        }
      };
      window.addEventListener('keydown', keyHandler);

      function cleanupAndClose() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('keydown', keyHandler);
        modal.remove();
      }

      // Vuốt chạm trên Mobile
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
            cleanupAndClose();
          }
        }
      }, { passive: true });

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
    window.openAlbumGalleryModal([imageUrl], 0);
  };
})();
`;

helperFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log('[SKIP] ' + file);
    return;
  }
  console.log('[UPDATING] ' + file);
  let content = fs.readFileSync(file, 'utf8');

  // Tìm đoạn code bắt đầu từ BỘ TRÌNH CHIẾU GALLERY đến hết window.openImageModal
  const galleryPattern = /\/\/\s*={10,}[\r\n\s]*\/\/\s*BỘ TRÌNH CHIẾU GALLERY[\s\S]*?window\.openImageModal\s*=\s*function\s*\(imageUrl\)[^}]*?\};\s*\}\)\(\);/g;

  if (galleryPattern.test(content)) {
    content = content.replace(galleryPattern, galleryCode.trim());
    console.log('  -> Replaced gallery block successfully');
  } else {
    // Fallback: thay từ "// BỘ TRÌNH CHIẾU GALLERY" đến cuối file
    const idx = content.indexOf('// BỘ TRÌNH CHIẾU GALLERY');
    if (idx !== -1) {
      // Tìm điểm kết thúc
      content = content.substring(0, idx) + galleryCode.trim() + '\n';
      console.log('  -> Replaced from idx successfully');
    } else {
      console.log('  -> Appending gallery code');
      content += '\n' + galleryCode.trim() + '\n';
    }
  }

  // Syntax check
  try {
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log('[SUCCESS] ' + file + ' updated and valid.');
  } catch (err) {
    console.error('[ERROR] Syntax error in ' + file, err);
    process.exit(1);
  }
});
