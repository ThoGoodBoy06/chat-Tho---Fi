const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu nâng cấp Bộ Trình Chiếu Gallery vuốt kéo cảm ứng mượt mà (Touch/Pointer Swipe)...');

// 1. Cập nhật webrtc_audio_helper.js
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js')
];

const galleryCode = `
  // 12. BỘ TRÌNH CHIẾU GALLERY VUỐT TRÁI/PHẢI CHUẨN XỊN (Universal Pointer & Touch Swipe Gallery)
  window.openAlbumGalleryModal = function (photoList, initialIndex) {
    if (!photoList || !photoList.length) return;
    try {
      var existingModal = document.getElementById('globalAlbumGalleryModal');
      if (existingModal) existingModal.remove();

      var list = [];
      for (var i = 0; i < photoList.length; i++) {
        var item = photoList[i];
        var u = typeof item === 'string' ? item : (item && (item.url || item.imageUrl || item.f || item.content || item.e) ? (item.url || item.imageUrl || item.f || item.content || item.e) : '');
        if (u && typeof u === 'string') {
          if (!u.startsWith('http://') && !u.startsWith('https://') && !u.startsWith('blob:') && !u.startsWith('data:')) {
            var origin = window.location.origin;
            if (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) {
              u = origin + (u.startsWith('/') ? '' : '/') + u;
            } else {
              u = 'https://chat-tho-fi-vn-9s8u.onrender.com' + (u.startsWith('/') ? '' : '/') + u;
            }
          }
          list.push(u);
        }
      }

      if (!list.length) return;

      var currentIndex = typeof initialIndex === 'number' ? Math.max(0, Math.min(initialIndex, list.length - 1)) : 0;

      var modal = document.createElement('div');
      modal.id = 'globalAlbumGalleryModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,14,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:16px 20px;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:none;';

      // --- Header: Counter + Download + Close ---
      var header = document.createElement('div');
      header.id = 'galleryHeader';
      header.style.cssText = 'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;z-index:100;padding-top:4px;';

      var counterPill = document.createElement('div');
      counterPill.style.cssText = 'background:rgba(255,255,255,0.16);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;padding:7px 16px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      counterPill.innerHTML = '<span>⊞</span> <span id="galleryCounterText">' + (currentIndex + 1) + ' / ' + list.length + '</span>';

      var actionsDiv = document.createElement('div');
      actionsDiv.id = 'galleryActions';
      actionsDiv.style.cssText = 'display:flex;align-items:center;gap:12px;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu ảnh vào máy';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.88);color:#fff;border:none;border-radius:24px;padding:8px 18px;font-size:13.5px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onmouseover = function () { dlBtn.style.background = '#0052cc'; dlBtn.style.transform = 'scale(1.04)'; };
      dlBtn.onmouseout = function () { dlBtn.style.background = 'rgba(0,104,255,0.88)'; dlBtn.style.transform = 'scale(1)'; };
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        var curUrl = list[currentIndex];
        if (window.downloadMediaDirectly) {
          window.downloadMediaDirectly(curUrl, 'album_anh_' + (currentIndex + 1) + '_' + Date.now() + '.jpg', 'image');
        }
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:50%;width:38px;height:38px;font-size:18px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
      closeBtn.onmouseover = function () { closeBtn.style.background = '#EF4444'; closeBtn.style.transform = 'scale(1.08)'; };
      closeBtn.onmouseout = function () { closeBtn.style.background = 'rgba(255,255,255,0.2)'; closeBtn.style.transform = 'scale(1)'; };

      var closeHandler = function () {
        modal.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.97)';
        setTimeout(function () {
          modal.remove();
          document.removeEventListener('keydown', keyListener);
        }, 200);
      };
      closeBtn.onclick = closeHandler;

      actionsDiv.appendChild(dlBtn);
      actionsDiv.appendChild(closeBtn);
      header.appendChild(counterPill);
      header.appendChild(actionsDiv);
      modal.appendChild(header);

      // --- Main View Area with Slide Track ---
      var mainArea = document.createElement('div');
      mainArea.id = 'galleryMainArea';
      mainArea.style.cssText = 'position:relative;width:100%;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:10px 0;touch-action:none;cursor:grab;';

      var imgEl = document.createElement('img');
      imgEl.src = list[currentIndex];
      imgEl.draggable = false;
      imgEl.style.cssText = 'max-width:92vw;max-height:78vh;object-fit:contain;border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.85);transition:transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.24s ease;display:block;cursor:grab;-webkit-user-drag:none;user-drag:none;';
      mainArea.appendChild(imgEl);

      // Arrow Nav Buttons
      var prevBtn = document.createElement('button');
      prevBtn.className = 'gallery-nav-btn';
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.cssText = 'position:absolute;left:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.18);color:#fff;border:none;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:20;backdrop-filter:blur(8px);';
      prevBtn.onmouseover = function () { prevBtn.style.background = 'rgba(255,255,255,0.35)'; prevBtn.style.transform = 'translateY(-50%) scale(1.1)'; };
      prevBtn.onmouseout = function () { prevBtn.style.background = 'rgba(255,255,255,0.18)'; prevBtn.style.transform = 'translateY(-50%) scale(1)'; };

      var nextBtn = document.createElement('button');
      nextBtn.className = 'gallery-nav-btn';
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.18);color:#fff;border:none;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:20;backdrop-filter:blur(8px);';
      nextBtn.onmouseover = function () { nextBtn.style.background = 'rgba(255,255,255,0.35)'; nextBtn.style.transform = 'translateY(-50%) scale(1.1)'; };
      nextBtn.onmouseout = function () { nextBtn.style.background = 'rgba(255,255,255,0.18)'; nextBtn.style.transform = 'translateY(-50%) scale(1)'; };

      mainArea.appendChild(prevBtn);
      mainArea.appendChild(nextBtn);
      modal.appendChild(mainArea);

      // --- Bottom Thumbnail Strip ---
      var thumbStrip = document.createElement('div');
      thumbStrip.id = 'galleryThumbs';
      thumbStrip.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;max-width:90vw;overflow-x:auto;padding:8px 0;z-index:10;';

      var thumbEls = [];
      list.forEach(function (url, idx) {
        var t = document.createElement('div');
        t.style.cssText = 'width:42px;height:42px;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;border:2px solid ' + (idx === currentIndex ? '#0068FF' : 'transparent') + ';opacity:' + (idx === currentIndex ? '1' : '0.45') + ';flex-shrink:0;';
        var tImg = document.createElement('img');
        tImg.src = url;
        tImg.draggable = false;
        tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        t.appendChild(tImg);
        t.onclick = function (e) {
          e.stopPropagation();
          goTo(idx);
        };
        thumbEls.push(t);
        thumbStrip.appendChild(t);
      });
      modal.appendChild(thumbStrip);

      // --- Navigation Logic ---
      function updateView(direction) {
        var textEl = document.getElementById('galleryCounterText');
        if (textEl) textEl.textContent = (currentIndex + 1) + ' / ' + list.length;

        var offset = direction === 'next' ? '40px' : (direction === 'prev' ? '-40px' : '0px');
        imgEl.style.transition = 'none';
        imgEl.style.transform = 'translateX(' + offset + ') scale(0.95)';
        imgEl.style.opacity = '0.3';

        // Force reflow
        void imgEl.offsetWidth;

        imgEl.src = list[currentIndex];
        imgEl.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.24s ease';
        imgEl.style.transform = 'translateX(0px) scale(1)';
        imgEl.style.opacity = '1';

        thumbEls.forEach(function (t, idx) {
          t.style.borderColor = (idx === currentIndex ? '#0068FF' : 'transparent');
          t.style.opacity = (idx === currentIndex ? '1' : '0.45');
          t.style.transform = (idx === currentIndex ? 'scale(1.12)' : 'scale(1)');
        });

        if (currentIndex + 1 < list.length) { new Image().src = list[currentIndex + 1]; }
        if (currentIndex - 1 >= 0) { new Image().src = list[currentIndex - 1]; }
      }

      function goTo(newIdx, dir) {
        if (newIdx < 0) newIdx = list.length - 1;
        if (newIdx >= list.length) newIdx = 0;
        currentIndex = newIdx;
        updateView(dir);
      }

      prevBtn.onclick = function (e) { e.stopPropagation(); goTo(currentIndex - 1, 'prev'); };
      nextBtn.onclick = function (e) { e.stopPropagation(); goTo(currentIndex + 1, 'next'); };

      // Keyboard listener
      var keyListener = function (e) {
        if (e.key === 'Escape') closeHandler();
        else if (e.key === 'ArrowLeft') goTo(currentIndex - 1, 'prev');
        else if (e.key === 'ArrowRight') goTo(currentIndex + 1, 'next');
      };
      document.addEventListener('keydown', keyListener);

      // --- UNIVERSAL POINTER SWIPE / DRAG (Mouse, Touch, Pen) ---
      var startX = 0, startY = 0, distX = 0, distY = 0;
      var isDragging = false;
      var hasMoved = false;

      function onPointerStart(e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target === prevBtn || e.target === nextBtn || e.target === dlBtn || e.target === closeBtn) return;
        if (e.target && e.target.closest && (e.target.closest('#galleryActions') || e.target.closest('#galleryThumbs') || e.target.closest('.gallery-nav-btn'))) return;

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        distX = 0;
        distY = 0;

        imgEl.style.transition = 'none';
        imgEl.style.cursor = 'grabbing';
        mainArea.style.cursor = 'grabbing';

        try {
          if (mainArea.setPointerCapture && e.pointerId !== undefined) {
            mainArea.setPointerCapture(e.pointerId);
          }
        } catch (_) {}

        if (e.preventDefault && e.type !== 'touchstart') {
          e.preventDefault();
        }
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        distX = e.clientX - startX;
        distY = e.clientY - startY;

        if (Math.abs(distX) > 5 || Math.abs(distY) > 5) {
          hasMoved = true;
        }

        if (Math.abs(distX) >= Math.abs(distY)) {
          // Direct 1:1 smooth follow
          var opacity = 1 - Math.min(0.45, Math.abs(distX) / 1000);
          imgEl.style.transform = 'translateX(' + distX + 'px) scale(' + (1 - Math.abs(distX) / 3000) + ')';
          imgEl.style.opacity = opacity;
        } else if (distY > 0) {
          imgEl.style.transform = 'translateY(' + distY + 'px) scale(' + (1 - distY / 1500) + ')';
          imgEl.style.opacity = 1 - Math.min(0.6, distY / 500);
        }

        if (e.preventDefault) e.preventDefault();
      }

      function onPointerEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        imgEl.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.24s ease';
        imgEl.style.cursor = 'grab';
        mainArea.style.cursor = 'grab';

        try {
          if (mainArea.releasePointerCapture && e.pointerId !== undefined) {
            mainArea.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        // Drag past 35px triggers slide!
        if (Math.abs(distX) > 35 && Math.abs(distX) > Math.abs(distY)) {
          if (distX < 0) {
            goTo(currentIndex + 1, 'next');
          } else {
            goTo(currentIndex - 1, 'prev');
          }
        } else if (distY > 90 && Math.abs(distY) > Math.abs(distX)) {
          closeHandler();
        } else {
          imgEl.style.transform = 'translateX(0px) scale(1)';
          imgEl.style.opacity = '1';
        }
      }

      // Pointer Events (Unified modern standard)
      if (window.PointerEvent) {
        mainArea.addEventListener('pointerdown', onPointerStart);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerEnd);
        window.addEventListener('pointercancel', onPointerEnd);
      } else {
        // Fallback for older browsers
        mainArea.addEventListener('touchstart', function (e) {
          if (e.touches.length === 1) onPointerStart(e.touches[0]);
        }, { passive: false });
        window.addEventListener('touchmove', function (e) {
          if (isDragging && e.touches.length === 1) onPointerMove(e.touches[0]);
        }, { passive: false });
        window.addEventListener('touchend', onPointerEnd);

        mainArea.addEventListener('mousedown', onPointerStart);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerEnd);
      }

      modal.addEventListener('click', function (e) {
        if (!hasMoved && (e.target === modal || e.target === mainArea)) {
          closeHandler();
        }
      });

      document.body.appendChild(modal);
      updateView();
    } catch (err) {
      console.error('Lỗi khi mở Album Gallery Modal:', err);
    }
  };
`;

helperFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  console.log(`Processing: ${p}`);
  let code = fs.readFileSync(p, 'utf8');

  // Replace existing openAlbumGalleryModal
  if (code.includes('window.openAlbumGalleryModal = function')) {
    code = code.replace(/\/\/ 12\. BỘ TRÌNH CHIẾU[\s\S]*?window\.openAlbumGalleryModal = function[\s\S]*?document\.body\.appendChild\(modal\);[\s\S]*?updateView\(\);[\s\S]*?\}[\s\S]*?catch \(err\)[\s\S]*?\}[\s\S]*?\};/g, '');
  }

  code += '\n' + galleryCode;
  fs.writeFileSync(p, code, 'utf8');
  console.log(`✅ Đã cập nhật Pointer/Touch Swipe Gallery cho ${path.basename(p)}`);
});

// 2. Cập nhật A.aAlbumDeckTap trong cả 4 file main.dart.js để truyền đầy đủ mảng URL
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const newDeckTap = `A.aAlbumDeckTap = function aAlbumDeckTap(cluster) {
  this.cluster = cluster;
};
A.aAlbumDeckTap.prototype = {
  $0() {
    try {
      if (!this.cluster || !this.cluster.length) return;
      var urls = [];
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
        var u = (m && (m.imageUrl || m.f || m.content || m.e)) || "";
        if (u && typeof u === "string") {
          if (u.startsWith("/")) {
            var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
            u = _be + u;
          }
          urls.push(u);
        }
      }
      if (window.openAlbumGalleryModal) {
        window.openAlbumGalleryModal(urls, 0);
      } else if (window.openImageModal && urls.length > 0) {
        window.openImageModal(urls[0]);
      }
    } catch(e) {
      console.error("Tap album error:", e);
    }
  },
  $S: 0
};`;

jsFiles.forEach(jp => {
  if (!fs.existsSync(jp)) return;
  console.log(`Processing: ${jp}`);
  let js = fs.readFileSync(jp, 'utf8');

  const oldTapRegex = /A\.aAlbumDeckTap = function aAlbumDeckTap\(cluster\)[\s\S]*?\$S: 0\s*\};/;
  if (oldTapRegex.test(js)) {
    js = js.replace(oldTapRegex, newDeckTap);
    fs.writeFileSync(jp, js, 'utf8');
    console.log(`✅ Đã cập nhật A.aAlbumDeckTap trong ${path.basename(jp)}`);
  }
});

console.log('\n🎉 Hoàn tất vá lỗi vuốt/kéo gallery!');
