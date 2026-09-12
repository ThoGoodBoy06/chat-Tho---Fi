const fs = require('fs');
const path = require('path');

console.log('🌐 CẬP NHẬT BACKEND RENDER URL CHO CLOUDFLARE PAGES (PAGES.DEV)...');

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');

  // Thay thế gọi API tương đối thành gọi đúng Render backend khi chạy trên Cloudflare Pages
  const oldFetchPattern = "fetch('/api/chat/conversations/' + convId + '/theme'";
  const newFetchCode = "var backendUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://chat-tho-fi-vn-9s8u.onrender.com';\n        fetch(backendUrl + '/api/chat/conversations/' + convId + '/theme'";

  if (html.includes(oldFetchPattern)) {
    html = html.replace(oldFetchPattern, newFetchCode);
    console.log(`✅ Đã cập nhật backendUrl trong: ${hf}`);
  } else {
    console.log(`ℹ️ Không tìm thấy oldFetchPattern hoặc đã cập nhật: ${hf}`);
  }

  fs.writeFileSync(hf, html, 'utf8');
});

// Nâng cache timestamp
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  html = html.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(hf, html, 'utf8');
});

const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(bf, bs, 'utf8');
});

console.log('\n🎉 HOÀN TẤT CẬP NHẬT BACKEND RENDER CHO CLOUDFLARE PAGES!');
