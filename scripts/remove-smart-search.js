const fs = require('fs');
const path = require('path');

const htmlFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const targetTag = '<script defer src="/smart-search-bar.js"></script>';
  if (html.includes(targetTag)) {
    html = html.split(targetTag).join('');
    fs.writeFileSync(file, html, 'utf8');
    console.log('✅ Đã gỡ bỏ thẻ script khỏi:', file);
  }
});
console.log('🎉 Hoàn tất gỡ bỏ thanh gợi ý!');
