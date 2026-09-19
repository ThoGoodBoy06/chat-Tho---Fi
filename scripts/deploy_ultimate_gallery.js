const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu triển khai Bộ Trình Chiếu Gallery Vuốt/Kéo Hoàn Hảo (Touch + Mouse Drag + Thumbnails)...');

const now = Date.now();

// 1. Cập nhật Cache Busting trong các file index.html
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
  html = html.replace(/webrtc_audio_helper\.js\?v=[^"']+/g, `webrtc_audio_helper.js?v=v_gallery_${now}`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ Đã cập nhật cache-bust cho: ${path.relative(path.join(__dirname, '..'), file)}`);
});

// 2. Patch main.dart.js để tự động gom 100% ảnh khi ChatScreen render
const mainDartFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

const extractImagesSnippet = `
window._activeChatProvider=a0;
try{
  if(a0&&a0.d){
    var _extImgs=[];
    for(var _mi=0;_mi<a0.d.length;_mi++){
      var _mm=a0.d[_mi];
      if(!_mm||_mm.y||_mm.isRecalled)continue;
      var _mr=_mm.f||_mm.imageUrl||_mm.e||_mm.content;
      if(!_mr||typeof _mr!=='string')continue;
      var _mlow=_mr.toLowerCase();
      var _isI=_mm.d==='image'||_mm.type==='image'||_mlow.indexOf('data:image')===0||_mlow.indexOf('/chat-media/')!==-1||_mlow.indexOf('.jpg')!==-1||_mlow.indexOf('.png')!==-1||_mlow.indexOf('.jpeg')!==-1||_mlow.indexOf('.webp')!==-1||_mlow.indexOf('.jfif')!==-1||_mlow.indexOf('.gif')!==-1;
      if(_isI&&_mr!=='[Hình ảnh]'&&_mr!=='[Ảnh]'){
        var _mfull=_mr;
        if(!_mfull.startsWith('http://')&&!_mfull.startsWith('https://')&&!_mfull.startsWith('blob:')&&!_mfull.startsWith('data:')){
          var _morig=window.location.origin;
          var _mbe=(_morig.indexOf('localhost')!==-1||_morig.indexOf('127.0.0.1')!==-1)?_morig:'https://chat-tho-fi-vn-9s8u.onrender.com';
          _mfull=_mbe+(_mfull.startsWith('/')?'':'/')+_mfull;
        }
        if(_extImgs.indexOf(_mfull)===-1)_extImgs.push(_mfull);
      }
    }
    window._activeConvImages=_extImgs;
    if(a&&a.a){
      window._chatImagesByConv=window._chatImagesByConv||{};
      window._chatImagesByConv[a.a]=_extImgs;
      window._currentConvId=a.a;
    }
  }
}catch(_errExtract){}
`;

mainDartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Đảm bảo trích xuất ảnh toàn cuộc trò chuyện vào window._activeConvImages
  if (!content.includes('window._activeConvImages=_extImgs;')) {
    content = content.replace(
      'window._activeChatProvider=a0;',
      extractImagesSnippet
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Đã patch trích xuất ảnh toàn diện trong: ${path.relative(path.join(__dirname, '..'), file)}`);
    try {
      new vm.Script(content);
      console.log(`   [PASS] Syntax main.dart.js hợp lệ`);
    } catch(err) {
      console.error(`   [FAIL] Lỗi cú pháp main.dart.js:`, err.message);
    }
  } else {
    console.log(`⚡ main.dart.js đã có code trích xuất ảnh: ${path.relative(path.join(__dirname, '..'), file)}`);
  }
});

// 3. Chuẩn bị code hoàn hảo cho webrtc_audio_helper.js
const galleryCode = `
// =========================================================================
// BỘ TRÌNH CHIẾU GALLERY ĐỈNH CAO: TOUCH SWIPE + DESKTOP MOUSE DRAG + THUMBNAIL STRIP
// =========================================================================
(function () {
  window._chatImagesByConv = window._chatImagesByConv || {};
  window._currentConvId = null;
  window._chatImagesCache = [];
  window._activeConvImages = window._activeConvImages || [];

  window.clearChatImagesCache = function (convId) {
    if (convId) {
      window._currentConvId = convId;
      window._chatImagesByConv[convId] = [];
    } else {
      window._currentConvId = null;
      window._chatImagesByConv = {};
    }
    window._chatImagesCache = [];
    window._activeConvImages = [];
  };

  window.recordChatImage = function (url, convId) {
    if (!url || typeof url !== 'string' || url.length > 5000) return;
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
      // 1. Kiểm tra cache trực tiếp từ main.dart.js
      if (window._activeConvImages && window._activeConvImages.length > 0) {
        return window._activeConvImages.slice();
      }

      // 2. Kiểm tra theo convId
      var curConv = window._currentConvId || window._currentActiveChatConvId;
      if (curConv && window._chatImagesByConv[curConv] && window._chatImagesByConv[curConv].length > 0) {
        return window._chatImagesByConv[curConv].slice();
      }

      // 3. Quét từ Provider
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
                      low.indexOf('.png') !== -1 || low.indexOf('.webp') !== -1 ||
                      low.indexOf('.jfif') !== -1 || low.indexOf('.gif') !== -1;
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

      // 4. Quét fallback từ DOM
      if (imgs.length === 0) {
        var domImgs = document.querySelectorAll('img');
        domImgs.forEach(function (di) {
          var s = di.src || '';
          if (s.includes('/chat-media/') || s.includes('uploads/')) {
            if (imgs.indexOf(s) === -1) imgs.push(s);
          }
        });
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

      // NGUYÊN TẮC: Luôn lấy toàn bộ ảnh của cuộc trò chuyện để có thể kéo/vuốt sang trái & phải!
      var single = list[0] || '';
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
      } else if (list.length <= 1) {
        var currentCache = window._chatImagesCache || [];
        if (currentCache.length > 1) {
          var fIdx = -1;
          for (var c = 0; c < currentCache.length; c++) {
            if (currentCache[c] === single || getCleanKey(currentCache[c]) === singleKey) {
              fIdx = c;
              break;
            }
          }
          if (fIdx !== -1) {
            list = currentCache.slice();
            initialIndex = fIdx;
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
          '.gallery-slide{flex:0 0 100vw;width:100vw;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:8px 12px;user-select:none;-webkit-user-select:none;cursor:grab;touch-action:pan-y;}' +
          '.gallery-slide img{max-width:96vw;max-height:72vh;object-fit:contain;border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,0.85);user-select:none;-webkit-user-select:none;pointer-events:none;-webkit-user-drag:none;display:block;}' +
          '@media (min-width: 768px) {.gallery-slide img{max-width:88vw;max-height:76vh;}}' +
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
      track.style.cssText = 'flex:1;width:100vw;display:flex;flex-direction:row;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;align-items:center;cursor:grab;';

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

      // Nút điều hướng (Trái / Phải)
      var prevBtn = document.createElement('button');
      prevBtn.innerHTML = '‹';
      prevBtn.style.cssText = 'position:absolute;left:18px;top:48%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:32px;cursor:pointer;display:' + (list.length > 1 ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      prevBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        }
      };

      var nextBtn = document.createElement('button');
      nextBtn.innerHTML = '›';
      nextBtn.style.cssText = 'position:absolute;right:18px;top:48%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:32px;cursor:pointer;display:' + (list.length > 1 ? 'flex' : 'none') + ';align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      nextBtn.onclick = function (e) {
        e.stopPropagation();
        if (currentIndex < list.length - 1) {
          currentIndex++;
          updateScrollPos(true);
        }
      };

      modal.appendChild(prevBtn);
      modal.appendChild(nextBtn);

      // Thumbnail Strip (Thanh ảnh xem trước ở đáy)
      var thumbStrip = document.createElement('div');
      thumbStrip.id = 'galleryThumbs';
      thumbStrip.style.cssText = 'display:' + (list.length > 1 ? 'flex' : 'none') + ';align-items:center;gap:8px;max-width:94vw;overflow-x:auto;padding:8px 12px;z-index:100;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box;';
      var thumbEls = [];

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
        }, 40);
      }, { passive: true });

      // =========================================================================
      // KÉO CHUỘT DESKTOP SIÊU MƯỢT (Tắt scroll-snap trong lúc kéo để không bị giật/khóa)
      // =========================================================================
      var isMouseDown = false, startMouseX = 0, scrollStart = 0, hasDragged = false;
      track.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        isMouseDown = true;
        hasDragged = false;
        startMouseX = e.clientX;
        scrollStart = track.scrollLeft;
        track.style.scrollSnapType = 'none'; // VÔ CÙNG QUAN TRỌNG: tắt snap để chuột kéo tự do không bị snap cưỡng bức kéo lại
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
        track.style.scrollSnapType = 'x mandatory'; // Bật lại snap sau khi thả chuột
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

      // =========================================================================
      // VUỐT CẢM ỨNG MOBILE SIÊU NHẠY (Touch Swipe Fallback)
      // =========================================================================
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

      // Cuộn con lăn chuột ngang (Wheel)
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

      // Phím điều hướng
      var keyListener = function (e) {
        if (e.key === 'Escape') cleanupAndClose();
        else if (e.key === 'ArrowLeft' && currentIndex > 0) {
          currentIndex--;
          updateScrollPos(true);
        } else if (e.key === 'ArrowRight' && currentIndex < list.length - 1) {
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

  window.openImageModal = function (imageUrl, convId) {
    if (!imageUrl) return;
    if (convId) window._currentConvId = convId;
    window.openAlbumGalleryModal([imageUrl], 0);
  };
})();
`;

// 4. Áp dụng vào toàn bộ 6 file webrtc_audio_helper.js
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

  // Gỡ bỏ gallery cũ nếu có
  const startIdx = code.indexOf('// =========================================================================\n// BỘ TRÌNH CHIẾU GALLERY');
  const altStartIdx = code.indexOf('// =========================================================================\r\n// BỘ TRÌNH CHIẾU GALLERY');
  
  if (startIdx !== -1) {
    code = code.substring(0, startIdx).trim();
  } else if (altStartIdx !== -1) {
    code = code.substring(0, altStartIdx).trim();
  } else {
    // Tìm openAlbumGalleryModal cũ
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
    console.log(`   [PASS] Kiểm tra cú pháp hợp lệ`);
  } catch (err) {
    console.error(`   [FAIL] Lỗi cú pháp:`, err.message);
  }
});

console.log('🎉 Hoàn tất triển khai toàn diện!');
