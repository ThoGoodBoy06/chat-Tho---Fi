const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🎯 Điều chỉnh Trình Xem Gallery theo đúng chính xác ý người dùng:');
console.log('   - Ảnh Album: Chỉ hiển thị đúng các ảnh thuộc Album đó (ví dụ 1/2, 2/2, 1/3...), kéo/vuốt mượt mà');
console.log('   - Ảnh riêng lẻ: Chỉ hiển thị 1 ảnh đơn (1/1), TUYỆT ĐỐI không gộp các ảnh riêng lẻ khác vào Album!');

const now = Date.now();

// 1. Cập nhật cache-bust trong index.html
const indexFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'index.html'),
];

indexFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/webrtc_audio_helper\.js\?v=[^"']+/g, `webrtc_audio_helper.js?v=v_album_fix_${now}`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ Đã cập nhật cache-bust: ${path.relative(path.join(__dirname, '..'), file)}`);
});

// 2. Dọn dẹp code trong main.dart.js để không gộp bừa bãi ảnh
const mainDartFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

mainDartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Gỡ bỏ đoạn gộp toàn bộ ảnh cuộc trò chuyện nếu có
  if (content.includes('window._activeConvImages=_extImgs;')) {
    content = content.replace(/window\._activeChatProvider=a0;[\s\S]*?window\._activeConvImages=_extImgs;[\s\S]*?\}catch\(_errExtract\)\{\}/g, 'window._activeChatProvider=a0;');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Đã dọn dẹp main.dart.js: ${path.relative(path.join(__dirname, '..'), file)}`);
    try {
      new vm.Script(content);
      console.log(`   [PASS] Syntax main.dart.js hợp lệ`);
    } catch (e) {
      console.error(`   [FAIL] Lỗi syntax:`, e.message);
    }
  }
});

// 3. Chuẩn hóa webrtc_audio_helper.js
const galleryCode = `
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
`;

// 4. Cập nhật toàn bộ 6 file webrtc_audio_helper.js
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
];

helperFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  const startIdx = code.indexOf('// =========================================================================\n// BỘ TRÌNH CHIẾU GALLERY');
  const altStartIdx = code.indexOf('// =========================================================================\r\n// BỘ TRÌNH CHIẾU GALLERY');
  
  if (startIdx !== -1) {
    code = code.substring(0, startIdx).trim();
  } else if (altStartIdx !== -1) {
    code = code.substring(0, altStartIdx).trim();
  } else {
    const altIdx = code.indexOf('window.openAlbumGalleryModal = function');
    if (altIdx !== -1) {
      const commentIdx = code.lastIndexOf('//', altIdx);
      if (commentIdx !== -1 && commentIdx > altIdx - 200) {
        code = code.substring(0, commentIdx).trim();
      } else {
        code = code.substring(0, altIdx).trim();
      }
    }
  }

  code = code + '\n\n' + galleryCode.trim() + '\n';
  fs.writeFileSync(file, code, 'utf8');
  console.log(`✅ Đã cập nhật webrtc_audio_helper.js: ${path.relative(path.join(__dirname, '..'), file)}`);

  try {
    new vm.Script(code);
    console.log(`   [PASS] Syntax webrtc_audio_helper.js hợp lệ`);
  } catch (err) {
    console.error(`   [FAIL] Lỗi syntax:`, err.message);
  }
});

console.log('🎉 Hoàn tất phân tách rạch ròi: Ảnh riêng lẻ (1/1) vs Ảnh Album (1/N có kéo vuốt)!');
