const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu triển khai giải pháp Vuốt Ảnh Mobile hoàn hảo (100% Native CSS Scroll-Snap)...');

// 1. Cập nhật webrtc_audio_helper.js: Thay thế cả openImageModal và openAlbumGalleryModal
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js')
];

const unifiedGalleryScript = `
// =========================================================================
// BỘ TRÌNH CHIẾU GALLERY VUỐT CHUẨN NATIVE MOBILE (CSS SCROLL SNAP + HARDWARE GPU)
// =========================================================================
(function () {
  window._chatImagesCache = window._chatImagesCache || [];

  window.recordChatImage = function (url) {
    if (!url || typeof url !== 'string') return;
    var full = url;
    if (!full.startsWith('http://') && !full.startsWith('https://') && !full.startsWith('blob:') && !full.startsWith('data:')) {
      var origin = window.location.origin;
      var be = (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1) ? origin : 'https://chat-tho-fi-vn-9s8u.onrender.com';
      full = be + (full.startsWith('/') ? '' : '/') + full;
    }
    if (window._chatImagesCache.indexOf(full) === -1) {
      window._chatImagesCache.push(full);
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

      // Nếu chỉ có 1 ảnh truyền vào, tự động mở rộng với kho ảnh cuộc trò chuyện
      if (list.length <= 1 && window._chatImagesCache && window._chatImagesCache.length > 1) {
        var single = list[0];
        list = window._chatImagesCache.slice();
        if (single) {
          var foundIdx = list.indexOf(single);
          if (foundIdx !== -1) initialIndex = foundIdx;
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
        if (window.downloadMediaDirectly) {
          window.downloadMediaDirectly(curUrl, 'album_anh_' + (currentIndex + 1) + '_' + Date.now() + '.jpg', 'image');
        }
      };

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'background:rgba(255,255,255,0.24);color:#fff;border:none;border-radius:50%;width:38px;height:38px;font-size:18px;font-family:sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
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

      // --- Main Container: Track CSS Scroll Snap ---
      var mainContainer = document.createElement('div');
      mainContainer.style.cssText = 'position:relative;width:100vw;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;margin:4px 0;';

      var track = document.createElement('div');
      track.id = 'galleryTrack';
      track.style.cssText = 'width:100vw;height:100%;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none;touch-action:pan-x;cursor:grab;';

      list.forEach(function (url) {
        var slide = document.createElement('div');
        slide.className = 'gallery-slide';
        var img = document.createElement('img');
        img.src = url;
        slide.appendChild(img);
        track.appendChild(slide);
      });

      // Nút Next / Prev cho máy tính
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;backdrop-filter:blur(8px);';
      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;backdrop-filter:blur(8px);';

      prevBtn.onclick = function (e) {
        e.stopPropagation();
        var target = Math.max(0, currentIndex - 1);
        track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
      };
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        var target = Math.min(list.length - 1, currentIndex + 1);
        track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
      };

      mainContainer.appendChild(prevBtn);
      mainContainer.appendChild(nextBtn);
      mainContainer.appendChild(track);
      modal.appendChild(mainContainer);

      // --- Dải Thumbnail Dưới Đáy ---
      var thumbStrip = document.createElement('div');
      thumbStrip.id = 'galleryThumbs';
      thumbStrip.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:7px;max-width:96vw;overflow-x:auto;padding:6px 0;z-index:10;scrollbar-width:none;-ms-overflow-style:none;';

      var thumbEls = [];
      list.forEach(function (url, idx) {
        var t = document.createElement('div');
        t.style.cssText = 'width:40px;height:40px;border-radius:8px;overflow:hidden;cursor:pointer;transition:all 0.2s;border:2px solid ' + (idx === currentIndex ? '#0068FF' : 'transparent') + ';opacity:' + (idx === currentIndex ? '1' : '0.45') + ';flex-shrink:0;';
        var tImg = document.createElement('img');
        tImg.src = url;
        tImg.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;';
        t.appendChild(tImg);
        t.onclick = function (e) {
          e.stopPropagation();
          track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
        };
        thumbEls.push(t);
        thumbStrip.appendChild(t);
      });
      modal.appendChild(thumbStrip);

      // --- Cập nhật Chỉ Số Khi Cuộn ---
      function onScrollUpdate() {
        var w = track.clientWidth || window.innerWidth;
        if (!w) return;
        var page = Math.round(track.scrollLeft / w);
        if (page >= 0 && page < list.length && page !== currentIndex) {
          currentIndex = page;
          var textEl = document.getElementById('galleryCounterText');
          if (textEl) textEl.textContent = (currentIndex + 1) + ' / ' + list.length;

          thumbEls.forEach(function (t, idx) {
            t.style.borderColor = (idx === currentIndex ? '#0068FF' : 'transparent');
            t.style.opacity = (idx === currentIndex ? '1' : '0.45');
            t.style.transform = (idx === currentIndex ? 'scale(1.12)' : 'scale(1)');
          });

          if (thumbEls[currentIndex]) {
            thumbEls[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }

      track.addEventListener('scroll', onScrollUpdate, { passive: true });

      // Kéo chuột cho máy tính
      var isMouseDown = false, startMouseX = 0, startScrollLeft = 0;
      track.addEventListener('mousedown', function (e) {
        if (e.target === prevBtn || e.target === nextBtn) return;
        isMouseDown = true;
        startMouseX = e.pageX;
        startScrollLeft = track.scrollLeft;
        track.style.scrollBehavior = 'auto';
        track.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', function (e) {
        if (!isMouseDown) return;
        var delta = e.pageX - startMouseX;
        track.scrollLeft = startScrollLeft - delta * 1.1;
      });

      window.addEventListener('mouseup', function (e) {
        if (!isMouseDown) return;
        isMouseDown = false;
        track.style.scrollBehavior = 'smooth';
        track.style.cursor = 'grab';
        var w = track.clientWidth || window.innerWidth;
        var targetPage = Math.round(track.scrollLeft / w);
        track.scrollTo({ left: targetPage * w, behavior: 'smooth' });
      });

      var keyListener = function (e) {
        var w = track.clientWidth || window.innerWidth;
        if (e.key === 'Escape') closeHandler();
        else if (e.key === 'ArrowLeft') track.scrollTo({ left: Math.max(0, currentIndex - 1) * w, behavior: 'smooth' });
        else if (e.key === 'ArrowRight') track.scrollTo({ left: Math.min(list.length - 1, currentIndex + 1) * w, behavior: 'smooth' });
      };
      document.addEventListener('keydown', keyListener);

      document.body.appendChild(modal);

      requestAnimationFrame(function () {
        var w = track.clientWidth || window.innerWidth;
        if (currentIndex > 0 && w) {
          track.scrollLeft = currentIndex * w;
        }
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
})();
`;

helperFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  console.log(`Đang cập nhật: ${p}`);
  let code = fs.readFileSync(p, 'utf8');

  // Xóa bỏ hàm openImageModal và openAlbumGalleryModal cũ
  const marker = '// =========================================================================\n// BỘ TRÌNH CHIẾU GALLERY';
  const idx = code.indexOf(marker);
  if (idx !== -1) {
    code = code.substring(0, idx);
  } else {
    const oldOpen = code.indexOf('window.openImageModal = function');
    if (oldOpen !== -1) {
      code = code.substring(0, oldOpen);
    }
  }

  code = code.trimEnd() + '\n\n' + unifiedGalleryScript.trim() + '\n';
  fs.writeFileSync(p, code, 'utf8');
  console.log(`✅ Đã cập nhật xong ${path.basename(p)}`);
});

// 2. Cập nhật main.dart.js để tự động cache ảnh trong hội thoại
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jp => {
  if (!fs.existsSync(jp)) return;
  console.log(`Cập nhật JS Bundle: ${jp}`);
  let js = fs.readFileSync(jp, 'utf8');

  // Đăng ký ảnh vào cache khi duyệt qua tin nhắn ảnh
  const oldImgMarker = 'if(_checkImg(e)){';
  const newImgMarker = 'if(_checkImg(e)){if(window.recordChatImage){window.recordChatImage(e.imageUrl||e.f||e.content||e.e);}';

  if (js.includes(oldImgMarker) && !js.includes('window.recordChatImage')) {
    js = js.replace(oldImgMarker, newImgMarker);
  }

  fs.writeFileSync(jp, js, 'utf8');
  console.log(`✅ Đã tích hợp recordChatImage trong ${path.basename(jp)}`);
});

console.log('\n🎉 Đã hoàn tất nâng cấp Vuốt Ảnh Mobile chuẩn 100%!');
