const fs = require('fs');
const path = require('path');

console.log('🚀 Đang kiểm tra và vá main.dart.js chuẩn xác...');

const files = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');

  // Regex khớp A.aEp.prototype={\r\n$0(){var s=this.a.Y(t.q)
  const regex = /A\.aEp\.prototype\s*=\s*\{\s*\$0\(\)\s*\{\s*var s=this\.a\.Y\(t\.q\)/;

  if (regex.test(content)) {
    content = content.replace(regex, () => {
      return 'A.aEp.prototype={\n$0(){if(typeof window.showNotificationModal==="function"){window.showNotificationModal();return}\nvar s=this.a.Y(t.q)';
    });
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Đã vá an toàn và chuẩn xác cho: ${relPath}`);
  } else if (content.includes('typeof window.showNotificationModal==="function"')) {
    console.log(`ℹ️ ${relPath} đã có hook showNotificationModal`);
  } else {
    console.warn(`⚠️ Không tìm thấy target pattern trong: ${relPath}`);
  }
});
