const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

indexFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let raw = fs.readFileSync(f, 'utf8');
  const isCRLF = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  // Xóa đoạn text thô nằm ngoài script tag
  const badRegex = /<\/script>\s*\/\/\s*\[Call Sync\][\s\S]*?<\/body>/;
  const properCode = `    // [Call Sync] Lắng nghe tín hiệu call_ended từ Service Worker để đóng màn hình gọi ngay lập tức
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && (event.data.type === 'call_ended' || event.data.type === 'CALL_ENDED')) {
          console.log('🔴 [SW Message] Cuộc gọi đã kết thúc -> Đóng toàn bộ chuông và màn hình cuộc gọi!');
          if (window.dismissIncomingCallNow) {
            window.dismissIncomingCallNow();
          }
        }
      });
    }
  </script>
</body>`;

  if (badRegex.test(content)) {
    content = content.replace(badRegex, properCode);
    console.log('✅ Đã đóng gói code vào trong <script>...</script> cho:', f);
  } else {
    console.log('ℹ️ Không thấy đoạn lỗi trong:', f);
  }

  // Update cache buster
  const now = Date.now();
  content = content.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);

  fs.writeFileSync(f, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
});

console.log('🎉 Hoàn tất sửa lỗi hiển thị index.html!');
