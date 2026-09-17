const fs = require('fs');

console.log('🚀 Đang xử lý triệt để: Xóa bỏ vòng tròn đen thừa, chuẩn hóa nút Play Messenger...');

// 1. Thêm đoạn script tự động dọn sạch Service Worker cũ và CacheStorage vào tất cả file index.html
const htmlFiles = [
  'public/index.html',
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const swClearSnippet = `<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    for (var i = 0; i < regs.length; i++) regs[i].unregister();
  });
}
if ('caches' in window) {
  caches.keys().then(function(keys) {
    for (var i = 0; i < keys.length; i++) caches.delete(keys[i]);
  });
}
</script>`;

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  if (!html.includes('serviceWorker.getRegistrations')) {
    html = html.replace('<head>', '<head>\n  ' + swClearSnippet);
    fs.writeFileSync(hf, html, 'utf8');
    console.log(`✅ [${hf}] Đã thêm script xóa sạch cache và ServiceWorker cũ`);
  }
});

// 2. Cập nhật main.dart.js:
// Thay thế _playOverlay để KHÔNG CÒN vòng tròn đen to xung quanh.
// Chỉ hiển thị icon Play màu trắng tinh tế, sắc nét chuẩn Messenger!
const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  // Thay thế _playOverlay: Không dùng CircleAvatar có nền đen nữa
  content = content.replace(
    /var _playOverlay=A\.hO\(new A\.q\(\d+\),d,A\.bV\(B\.aaW,B\.f,d,\d+\),\d+\);/g,
    'var _playOverlay=A.bV(B.aaW,B.f,d,28);'
  );

  // Đảm bảo _card có Alignment.center (B.T)
  content = content.replace(
    'var _card=A.a5(d,_playOverlay,B.h,d,d,_boxDec,d,240,d,d,d,d,160);',
    'var _card=A.a5(d,_playOverlay,B.T,d,d,_boxDec,d,240,d,d,d,d,160);'
  );

  fs.writeFileSync(jf, content, 'utf8');
  console.log(`✅ [${jf}] Đã cập nhật nút Play (chỉ icon trắng chuẩn Messenger, bỏ hoàn toàn vòng tròn đen)`);
});

console.log('✨ Hoàn tất!');
