const fs = require('fs');
const path = require('path');

const TIMESTAMP = Date.now();
console.log(`🚀 V13 - Fix polling function scope (window._startCallStatusPolling)`);

// ==============================================================================
// Fix trong cả 3 main.dart.js: đổi function _startCallStatusPolling -> window._startCallStatusPolling
// và update tất cả nơi gọi nó
// ==============================================================================
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

for (const jf of jsFiles) {
  if (!fs.existsSync(jf)) continue;
  let js = fs.readFileSync(jf, 'utf8');
  
  // Đổi function declaration thành window assignment
  if (js.includes('function _startCallStatusPolling(callerId, calleeId)')) {
    js = js.replace(
      'function _startCallStatusPolling(callerId, calleeId)',
      'window._startCallStatusPolling = function _startCallStatusPolling(callerId, calleeId)'
    );
    console.log(`  ✅ Đã đổi sang window._startCallStatusPolling trong ${jf}`);
  }
  
  // Đổi các chỗ kiểm tra typeof và gọi hàm
  js = js.replace(
    /if\(typeof _startCallStatusPolling===\"function\"\)_startCallStatusPolling\(([^)]+)\)/g,
    'if(window._startCallStatusPolling)window._startCallStatusPolling($1)'
  );
  
  fs.writeFileSync(jf, js, 'utf8');
  console.log(`  ✅ Đã cập nhật ${jf}`);
}

// ==============================================================================
// Fix trong index.html: Cập nhật timestamp cache-buster
// ==============================================================================
const indexFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

for (const inf of indexFiles) {
  if (!fs.existsSync(inf)) continue;
  let html = fs.readFileSync(inf, 'utf8');
  html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${TIMESTAMP}`);
  html = html.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);
  fs.writeFileSync(inf, html, 'utf8');
  console.log(`  ✅ Cập nhật timestamp v=${TIMESTAMP} trong ${inf}`);
}

// ==============================================================================
// Fix bootstrap files
// ==============================================================================
const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

for (const bf of bootstrapFiles) {
  if (!fs.existsSync(bf)) continue;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/main\.dart\.js\?v=\d+/g, `main.dart.js?v=${TIMESTAMP}`);
  fs.writeFileSync(bf, bs, 'utf8');
  console.log(`  ✅ Bootstrap v=${TIMESTAMP} trong ${bf}`);
}

console.log(`\n🎉 V13 ÁP DỤNG THÀNH CÔNG!`);
