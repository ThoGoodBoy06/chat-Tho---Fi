const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu sửa triệt để lỗi "Ảnh lỗi" do Cloudflare R2 thiếu CORS trong CanvasKit...');

// ════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT SERVICES/STORAGE.SERVICE.JS (CẢ 2 NƠI)
// ════════════════════════════════════════════════════════════════════════════
const storageFiles = [
  path.join(__dirname, '..', 'services', 'storage.service.js'),
  path.join(__dirname, '..', 'backend', 'services', 'storage.service.js')
];

storageFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Ưu tiên Supabase Storage cho ảnh thường (< 15MB) vì Supabase có sẵn CORS *
  // Chỉ dùng Cloudflare R2 cho video hoặc tệp siêu nặng (>= 15MB) hoặc khi Supabase bị lỗi
  const oldThreshold = 'const LIGHT_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5MB';
  const newThreshold = 'const LIGHT_FILE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15MB (Ảnh thường ưu tiên Supabase có sẵn CORS)';

  if (content.includes(oldThreshold)) {
    content = content.replace(oldThreshold, newThreshold);
  }

  const oldIsHeavy = 'const isHeavy = type === "video" || buffer.length >= LIGHT_FILE_THRESHOLD_BYTES;';
  const newIsHeavy = 'const isHeavy = type === "video" || (type !== "image" && buffer.length >= LIGHT_FILE_THRESHOLD_BYTES);';

  if (content.includes(oldIsHeavy)) {
    content = content.replace(oldIsHeavy, newIsHeavy);
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [OK] Đã cập nhật storage.service.js: ${file}`);
});

// ════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT FLUTTER_FRONTEND API_SERVICE.DART (CẢ 2 NƠI)
// ════════════════════════════════════════════════════════════════════════════
const dartApiFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'services', 'api_service.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'services', 'api_service.dart')
];

dartApiFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  const oldFormat = `  static String formatImageUrl(String? url) {
    if (url == null || url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    final cleanBase = baseUrl.replaceAll('/api', '');
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }`;

  const newFormat = `  static String formatImageUrl(String? url) {
    if (url == null || url.isEmpty) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    // Ảnh lưu trên Cloudflare R2 bắt buộc phải qua media-proxy để có header Access-Control-Allow-Origin: * cho CanvasKit WebGL
    if (url.contains('r2.dev') || url.contains('r2.cloudflarestorage.com')) {
      final cleanBase = baseUrl.replaceAll('/api', '');
      return '$cleanBase/api/chat/media-proxy?url=\${Uri.encodeComponent(url)}';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    final cleanBase = baseUrl.replaceAll('/api', '');
    final cleanPath = url.startsWith('/') ? url : '/$url';
    return '$cleanBase$cleanPath';
  }`;

  if (content.includes(oldFormat)) {
    content = content.replace(oldFormat, newFormat);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [OK] Đã cập nhật formatImageUrl trong Dart: ${file}`);
  } else {
    // Thử match linh hoạt hơn nếu có khác biệt thụt lề
    const formatRegex = /static String formatImageUrl\(String\?\s*url\)\s*\{[\s\S]*?final cleanPath[\s\S]*?return '\$cleanBase\$cleanPath';\s*\}/;
    if (formatRegex.test(content)) {
      content = content.replace(formatRegex, newFormat.trim());
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  [OK] Đã regex-replace formatImageUrl trong Dart: ${file}`);
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CẬP NHẬT 4 FILE MAIN.DART.JS
// ════════════════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang xử lý JS: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // 1. Chuyển hướng URL R2 trong bong bóng ảnh đơn lẻ
  const oldJTarget = 'j=s;if(j&&j.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";j=_be+j;}}';
  const newJTarget = 'j=s;if(j&&j.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1||window.location.origin.indexOf("127.0.0.1")!==-1)?window.location.origin:"https://chat-tho-fi-vn-9s8u.onrender.com";j=_be+j;}if(typeof j==="string"&&(j.indexOf("r2.dev")!==-1||j.indexOf("r2.cloudflarestorage.com")!==-1)){var _be=(window.location.origin.indexOf("localhost")!==-1||window.location.origin.indexOf("127.0.0.1")!==-1)?window.location.origin:"https://chat-tho-fi-vn-9s8u.onrender.com";j=_be+"/api/chat/media-proxy?url="+encodeURIComponent(j);}}';

  if (content.includes(oldJTarget)) {
    content = content.replace(oldJTarget, newJTarget);
    console.log('  [OK] Đã bọc media-proxy cho ảnh đơn lẻ trong main.dart.js');
  }

  // 2. Chuyển hướng URL R2 trong makeCardImg của buildPhotoDeckWidget
  const oldDeckUrl = 'url = _be + url;\n        }';
  const oldDeckUrlCRLF = 'url = _be + url;\r\n        }';
  const newDeckUrl = 'url = _be + url;\n        }\n        if (typeof url === "string" && (url.indexOf("r2.dev") !== -1 || url.indexOf("r2.cloudflarestorage.com") !== -1)) {\n          var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";\n          url = _be + "/api/chat/media-proxy?url=" + encodeURIComponent(url);\n        }';

  if (content.includes(oldDeckUrl)) {
    content = content.replace(oldDeckUrl, newDeckUrl);
    console.log('  [OK] Đã bọc media-proxy cho Album ảnh trong main.dart.js (LF)');
  } else if (content.includes(oldDeckUrlCRLF)) {
    content = content.replace(oldDeckUrlCRLF, newDeckUrl);
    console.log('  [OK] Đã bọc media-proxy cho Album ảnh trong main.dart.js (CRLF)');
  }

  try {
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [SUCCESS] Syntax check hợp lệ 100% cho: ${file}`);
  } catch (err) {
    console.error(`  [ERROR] Lỗi cú pháp khi cập nhật ${file}:`, err);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 4. CẬP NHẬT SERVER.JS & BACKEND/SERVER.JS (CORS OPTIONS CHO MEDIA-PROXY)
// ════════════════════════════════════════════════════════════════════════════
const serverFiles = [
  path.join(__dirname, '..', 'server.js'),
  path.join(__dirname, '..', 'backend', 'server.js')
];

serverFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('app.options("/api/chat/media-proxy"')) {
    const target = 'app.get("/api/chat/media-proxy", (req, res) => {';
    const repl = `app.options("/api/chat/media-proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.sendStatus(204);
});

app.get("/api/chat/media-proxy", (req, res) => {`;
    if (content.includes(target)) {
      content = content.replace(target, repl);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  [OK] Đã thêm OPTIONS handler cho media-proxy: ${file}`);
    }
  }
});

console.log('\n🎉 Hoàn tất sửa lỗi "Ảnh lỗi" do Cloudflare R2 CORS!');
