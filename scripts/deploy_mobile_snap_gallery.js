const fs = require('fs');
const path = require('path');

console.log('📱 Bắt đầu triển khai Bộ Trình Chiếu CSS Scroll Snap Gallery tối ưu 100% cho Điện Thoại Mobile...');

const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js')
];

const mobileSnapGalleryCode = `
  // 12. BỘ TRÌNH CHIẾU GALLERY VUỐT CHUẨN NATIVE CHO ĐIỆN THOẠI (Hardware-Accelerated Mobile Scroll-Snap Gallery)
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

      // Đảm bảo có thẻ style cho CSS Scroll Snap mượt mà
      var snapStyle = document.getElementById('gallerySnapStyle');
      if (!snapStyle) {
        snapStyle = document.createElement('style');
        snapStyle.id = 'gallerySnapStyle';
        snapStyle.textContent = 
          '#galleryTrack::-webkit-scrollbar{display:none;}' +
          '.gallery-slide{flex:0 0 100vw;width:100vw;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:10px 14px;}' +
          '.gallery-slide img{max-width:96vw;max-height:76vh;object-fit:contain;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,0.85);user-select:none;-webkit-user-select:none;display:block;}' +
          '@media (min-width: 768px) {.gallery-slide img{max-width:88vw;max-height:80vh;}}';
        document.head.appendChild(snapStyle);
      }

      var modal = document.createElement('div');
      modal.id = 'globalAlbumGalleryModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,7,10,0.97);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);z-index:99999999;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px 14px;box-sizing:border-box;user-select:none;-webkit-user-select:none;overflow:hidden;';

      // --- 1. Header: Chỉ số + Nút Tải + Nút Đóng ---
      var header = document.createElement('div');
      header.id = 'galleryHeader';
      header.style.cssText = 'width:100%;max-width:1200px;display:flex;align-items:center;justify-content:space-between;z-index:100;padding-top:4px;';

      var counterPill = document.createElement('div');
      counterPill.style.cssText = 'background:rgba(255,255,255,0.16);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;padding:7px 16px;border-radius:20px;display:inline-flex;align-items:center;gap:7px;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      counterPill.innerHTML = '<span>⊞</span> <span id="galleryCounterText">' + (currentIndex + 1) + ' / ' + list.length + '</span>';

      var actionsDiv = document.createElement('div');
      actionsDiv.id = 'galleryActions';
      actionsDiv.style.cssText = 'display:flex;align-items:center;gap:10px;';

      var dlBtn = document.createElement('button');
      dlBtn.innerHTML = '⬇ Lưu ảnh';
      dlBtn.style.cssText = 'background:rgba(0,104,255,0.88);color:#fff;border:none;border-radius:22px;padding:8px 16px;font-size:13.5px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;box-shadow:0 4px 14px rgba(0,104,255,0.4);';
      dlBtn.onclick = function (e) {
        e.stopPropagation();
        var curUrl = list[currentIndex];
        if (window.downloadMediaDirectly) {
          window.downloadMediaDirectly(curUrl, 'album_anh_' + (currentIndex + 1) + '_' + Date.now() + '.jpg', 'image');
        }
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.22);color:#fff;border:none;border-radius:50%;width:38px;height:38px;font-size:18px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
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

      // --- 2. Track trượt CSS Scroll Snap (Hoạt động 100% trên mọi điện thoại & máy tính) ---
      var mainContainer = document.createElement('div');
      mainContainer.style.cssText = 'position:relative;width:100vw;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:6px 0;';

      var track = document.createElement('div');
      track.id = 'galleryTrack';
      track.style.cssText = 'width:100vw;height:100%;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none;cursor:grab;';

      // Tạo các slide cho từng ảnh
      list.forEach(function (url, idx) {
        var slide = document.createElement('div');
        slide.className = 'gallery-slide';
        var img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        slide.appendChild(img);
        track.appendChild(slide);
      });

      // Nút chuyển ảnh cho Desktop / Tablet
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.cssText = 'position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.18);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;backdrop-filter:blur(8px);';
      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.18);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;backdrop-filter:blur(8px);';

      prevBtn.onclick = function (e) {
        e.stopPropagation();
        var targetIdx = Math.max(0, currentIndex - 1);
        track.scrollTo({ left: targetIdx * track.clientWidth, behavior: 'smooth' });
      };
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        var targetIdx = Math.min(list.length - 1, currentIndex + 1);
        track.scrollTo({ left: targetIdx * track.clientWidth, behavior: 'smooth' });
      };

      mainContainer.appendChild(prevBtn);
      mainContainer.appendChild(nextBtn);
      mainContainer.appendChild(track);
      modal.appendChild(mainContainer);

      // --- 3. Dải Thumbnail dưới đáy ---
      var thumbStrip = document.createElement('div');
      thumbStrip.id = 'galleryThumbs';
      thumbStrip.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:7px;max-width:94vw;overflow-x:auto;padding:6px 0;z-index:10;scrollbar-width:none;';

      var thumbEls = [];
      list.forEach(function (url, idx) {
        var t = document.createElement('div');
        t.style.cssText = 'width:40px;height:40px;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;border:2px solid ' + (idx === currentIndex ? '#0068FF' : 'transparent') + ';opacity:' + (idx === currentIndex ? '1' : '0.45') + ';flex-shrink:0;';
        var tImg = document.createElement('img');
        tImg.src = url;
        tImg.draggable = false;
        tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        t.appendChild(tImg);
        t.onclick = function (e) {
          e.stopPropagation();
          track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
        };
        thumbEls.push(t);
        thumbStrip.appendChild(t);
      });
      modal.appendChild(thumbStrip);

      // --- 4. Đồng bộ Scroll & Cập nhật Chỉ số Ảnh theo thời gian thực ---
      var scrollTimeout = null;
      function onTrackScroll() {
        var width = track.clientWidth || window.innerWidth;
        var page = Math.round(track.scrollLeft / width);
        if (page >= 0 && page < list.length && page !== currentIndex) {
          currentIndex = page;
          var textEl = document.getElementById('galleryCounterText');
          if (textEl) textEl.textContent = (currentIndex + 1) + ' / ' + list.length;

          thumbEls.forEach(function (t, idx) {
            t.style.borderColor = (idx === currentIndex ? '#0068FF' : 'transparent');
            t.style.opacity = (idx === currentIndex ? '1' : '0.45');
            t.style.transform = (idx === currentIndex ? 'scale(1.12)' : 'scale(1)');
          });

          // Cuộn dải thumbnail tương ứng
          if (thumbEls[currentIndex]) {
            thumbEls[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }

      track.addEventListener('scroll', onTrackScroll, { passive: true });

      // --- 5. Hỗ trợ Kéo Chuột trên Máy Tính (Mouse Dragging for PC) ---
      var isMouseDown = false, startMouseX = 0, startScrollLeft = 0, hasDragged = false;
      track.addEventListener('mousedown', function (e) {
        if (e.target === prevBtn || e.target === nextBtn) return;
        isMouseDown = true;
        hasDragged = false;
        startMouseX = e.pageX;
        startScrollLeft = track.scrollLeft;
        track.style.scrollBehavior = 'auto';
        track.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', function (e) {
        if (!isMouseDown) return;
        var delta = e.pageX - startMouseX;
        if (Math.abs(delta) > 5) hasDragged = true;
        track.scrollLeft = startScrollLeft - delta * 1.1;
      });

      window.addEventListener('mouseup', function (e) {
        if (!isMouseDown) return;
        isMouseDown = false;
        track.style.scrollBehavior = 'smooth';
        track.style.cursor = 'grab';
        var width = track.clientWidth || window.innerWidth;
        var targetPage = Math.round(track.scrollLeft / width);
        track.scrollTo({ left: targetPage * width, behavior: 'smooth' });
      });

      // Phím tắt bàn phím
      var keyListener = function (e) {
        var width = track.clientWidth || window.innerWidth;
        if (e.key === 'Escape') closeHandler();
        else if (e.key === 'ArrowLeft') track.scrollTo({ left: Math.max(0, currentIndex - 1) * width, behavior: 'smooth' });
        else if (e.key === 'ArrowRight') track.scrollTo({ left: Math.min(list.length - 1, currentIndex + 1) * width, behavior: 'smooth' });
      };
      document.addEventListener('keydown', keyListener);

      document.body.appendChild(modal);

      // Đặt vị trí ảnh ban đầu sau khi chèn vào DOM
      requestAnimationFrame(function () {
        var width = track.clientWidth || window.innerWidth;
        if (currentIndex > 0) {
          track.scrollLeft = currentIndex * width;
        }
      });
    } catch (err) {
      console.error('Lỗi khi mở Album Gallery Modal:', err);
    }
  };
`;

helperFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  console.log(`Đang cập nhật: ${p}`);
  let code = fs.readFileSync(p, 'utf8');

  // Thay thế hàm cũ bằng hàm CSS Scroll Snap tối ưu mobile
  const marker = '// 12. BỘ TRÌNH CHIẾU';
  const idx = code.indexOf(marker);
  if (idx !== -1) {
    code = code.substring(0, idx);
  } else {
    // Nếu có window.openAlbumGalleryModal
    const altIdx = code.indexOf('window.openAlbumGalleryModal = function');
    if (altIdx !== -1) {
      code = code.substring(0, altIdx);
    }
  }

  code = code.trimEnd() + '\n\n' + mobileSnapGalleryCode.trim() + '\n';
  fs.writeFileSync(p, code, 'utf8');
  console.log(`✅ Đã cập nhật CSS Scroll Snap Gallery cho ${path.basename(p)}`);
});

console.log('\n🎉 Đã hoàn tất cài đặt Native Mobile Scroll-Snap Gallery!');
