const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js')
];

const galleryFunctionCode = `
  // 12. BỘ TRÌNH CHIẾU ALBUM TOÀN MÀN HÌNH VUỐT TRÁI/PHẢI (Swipe Left/Right Gallery Viewer)
  window.openAlbumGalleryModal = function (photoList, initialIndex) {
    if (!photoList || !photoList.length) return;
    try {
      var existingModal = document.getElementById('globalAlbumGalleryModal');
      if (existingModal) existingModal.remove();

      var list = [];
      for (var i = 0; i < photoList.length; i++) {
        var item = photoList[i];
        var u = typeof item === 'string' ? item : (item && (item.url || item.e || item.f) ? (item.url || item.f || item.e) : '');
        if (u) {
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
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(8,10,14,0.96);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:16px 20px;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:none;';

      // --- Header: Counter + Download + Close ---
      var header = document.createElement('div');
      header.style.cssText = 'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;z-index:100;padding-top:4px;';

      var counterPill = document.createElement('div');
      counterPill.style.cssText = 'background:rgba(255,255,255,0.15);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;padding:7px 16px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      counterPill.innerHTML = '<span>⊞</span> <span id="galleryCounterText">' + (currentIndex + 1) + ' / ' + list.length + '</span>';

      var actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'display:flex;align-items:center;gap:12px;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu ảnh vào máy';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.85);color:#fff;border:none;border-radius:24px;padding:8px 18px;font-size:13.5px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onmouseover = function () { dlBtn.style.background = '#0052cc'; dlBtn.style.transform = 'scale(1.04)'; };
      dlBtn.onmouseout = function () { dlBtn.style.background = 'rgba(0,104,255,0.85)'; dlBtn.style.transform = 'scale(1)'; };
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        var curUrl = list[currentIndex];
        if (window.downloadMediaDirectly) {
          window.downloadMediaDirectly(curUrl, 'album_anh_' + (currentIndex + 1) + '_' + Date.now() + '.jpg', 'image');
        }
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;border:none;border-radius:50%;width:38px;height:38px;font-size:18px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
      closeBtn.onmouseover = function () { closeBtn.style.background = '#EF4444'; closeBtn.style.transform = 'scale(1.08)'; };
      closeBtn.onmouseout = function () { closeBtn.style.background = 'rgba(255,255,255,0.18)'; closeBtn.style.transform = 'scale(1)'; };

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
      mainArea.style.cssText = 'position:relative;width:100%;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:10px 0;';

      var imgEl = document.createElement('img');
      imgEl.src = list[currentIndex];
      imgEl.style.cssText = 'max-width:92vw;max-height:78vh;object-fit:contain;border-radius:14px;box-shadow:0 25px 60px rgba(0,0,0,0.85);transition:transform 0.22s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.22s ease;display:block;pointer-events:none;';
      mainArea.appendChild(imgEl);

      // Arrow Nav Buttons
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.cssText = 'position:absolute;left:16px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.16);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:20;backdrop-filter:blur(8px);';
      prevBtn.onmouseover = function () { prevBtn.style.background = 'rgba(255,255,255,0.3)'; prevBtn.style.transform = 'translateY(-50%) scale(1.1)'; };
      prevBtn.onmouseout = function () { prevBtn.style.background = 'rgba(255,255,255,0.16)'; prevBtn.style.transform = 'translateY(-50%) scale(1)'; };

      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.16);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:20;backdrop-filter:blur(8px);';
      nextBtn.onmouseover = function () { nextBtn.style.background = 'rgba(255,255,255,0.3)'; nextBtn.style.transform = 'translateY(-50%) scale(1.1)'; };
      nextBtn.onmouseout = function () { nextBtn.style.background = 'rgba(255,255,255,0.16)'; nextBtn.style.transform = 'translateY(-50%) scale(1)'; };

      mainArea.appendChild(prevBtn);
      mainArea.appendChild(nextBtn);
      modal.appendChild(mainArea);

      // --- Bottom Thumbnail Strip ---
      var thumbStrip = document.createElement('div');
      thumbStrip.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;max-width:90vw;overflow-x:auto;padding:8px 0;z-index:10;';

      var thumbEls = [];
      list.forEach(function (url, idx) {
        var t = document.createElement('div');
        t.style.cssText = 'width:42px;height:42px;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;border:2px solid ' + (idx === currentIndex ? '#0068FF' : 'transparent') + ';opacity:' + (idx === currentIndex ? '1' : '0.5') + ';flex-shrink:0;';
        var tImg = document.createElement('img');
        tImg.src = url;
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

        // Slide animation
        var offset = direction === 'next' ? '30px' : (direction === 'prev' ? '-30px' : '0px');
        imgEl.style.transform = 'translateX(' + offset + ') scale(0.95)';
        imgEl.style.opacity = '0.3';

        setTimeout(function () {
          imgEl.src = list[currentIndex];
          imgEl.style.transform = 'translateX(0px) scale(1)';
          imgEl.style.opacity = '1';
        }, 80);

        thumbEls.forEach(function (t, idx) {
          t.style.borderColor = (idx === currentIndex ? '#0068FF' : 'transparent');
          t.style.opacity = (idx === currentIndex ? '1' : '0.5');
          t.style.transform = (idx === currentIndex ? 'scale(1.1)' : 'scale(1)');
        });

        // Preload next/prev images in background
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

      // --- Touch & Mouse Swipe / Drag Gestures ---
      var startX = 0, startY = 0, distX = 0, distY = 0, isDragging = false;

      function onStart(x, y) {
        startX = x;
        startY = y;
        distX = 0;
        distY = 0;
        isDragging = true;
      }

      function onMove(x, y) {
        if (!isDragging) return;
        distX = x - startX;
        distY = y - startY;
        // Subtle drag follow
        if (Math.abs(distX) > Math.abs(distY)) {
          imgEl.style.transform = 'translateX(' + (distX * 0.4) + 'px)';
        }
      }

      function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        if (Math.abs(distX) > 45 && Math.abs(distX) > Math.abs(distY)) {
          if (distX < 0) {
            goTo(currentIndex + 1, 'next');
          } else {
            goTo(currentIndex - 1, 'prev');
          }
        } else if (distY > 90) {
          closeHandler(); // Swipe down to dismiss
        } else {
          imgEl.style.transform = 'translateX(0px) scale(1)';
        }
      }

      // Touch events
      mainArea.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      mainArea.addEventListener('touchmove', function (e) {
        if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      mainArea.addEventListener('touchend', function () {
        onEnd();
      }, { passive: true });

      // Mouse drag events
      mainArea.addEventListener('mousedown', function (e) {
        if (e.target === prevBtn || e.target === nextBtn) return;
        onStart(e.clientX, e.clientY);
      });

      window.addEventListener('mousemove', function (e) {
        if (isDragging) onMove(e.clientX, e.clientY);
      });

      window.addEventListener('mouseup', function () {
        if (isDragging) onEnd();
      });

      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target === mainArea) closeHandler();
      });

      document.body.appendChild(modal);
      updateView();
    } catch (err) {
      console.error('Lỗi khi mở Album Gallery Modal:', err);
    }
  };
`;

targetFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  console.log(`Processing: ${p}`);
  let code = fs.readFileSync(p, 'utf8');

  // Replace existing window.openAlbumGalleryModal if present or append
  if (code.includes('window.openAlbumGalleryModal = function')) {
    code = code.replace(/\/\/ 12\. BỘ TRÌNH CHIẾU ALBUM[\s\S]*?window\.openAlbumGalleryModal = function[\s\S]*?};\n/g, '');
  }

  code += '\n' + galleryFunctionCode;
  fs.writeFileSync(p, code, 'utf8');
  console.log(`✅ Đã thêm window.openAlbumGalleryModal vào ${p}`);
});

console.log('🎉 Hoàn tất cập nhật Album Gallery Modal!');
