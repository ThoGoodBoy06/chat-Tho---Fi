const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'smart-search-bar.js');
const code = fs.readFileSync(src, 'utf8');

// Copy sang public và backend
fs.writeFileSync(path.join(__dirname, '..', 'public', 'smart-search-bar.js'), code, 'utf8');
const backendTarget = path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'smart-search-bar.js');
if (fs.existsSync(path.dirname(backendTarget))) {
  fs.writeFileSync(backendTarget, code, 'utf8');
}

const htmlFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('smart-search-bar.js')) {
    html = html.replace('</body>', '  <script defer src="/smart-search-bar.js"></script>\n</body>');
    fs.writeFileSync(file, html, 'utf8');
    console.log('✅ Đã nhúng smart-search-bar.js vào:', file);
  } else {
    console.log('ℹ️ Đã có trong:', file);
  }
});
console.log('🎉 Hoàn tất nhúng script smart-search-bar.js!');
