const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔄 Bắt đầu đồng bộ triệt để webrtc_audio_helper.js và xóa cache...');

const srcFile = path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js');
const srcContent = fs.readFileSync(srcFile, 'utf8');

// Kiểm tra cú pháp file nguồn
new vm.Script(srcContent);
console.log('✅ File nguồn public/webrtc_audio_helper.js có cú pháp 100% hợp lệ.');

const destFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js')
];

destFiles.forEach(f => {
  if (fs.existsSync(path.dirname(f))) {
    fs.writeFileSync(f, srcContent, 'utf8');
    console.log(`✅ Đã sao chép webrtc_audio_helper.js sang: ${f}`);
  }
});

// Cập nhật query param phiên bản cache bust cho webrtc_audio_helper.js trên TẤT CẢ các file HTML
const newVersion = 'v_swipe_snap_' + Date.now();
const htmlFiles = [
  'public/index.html',
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

htmlFiles.forEach(hf => {
  const fullPath = path.join(__dirname, '..', hf);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    // Thay thế query param cho webrtc_audio_helper.js
    content = content.replace(/webrtc_audio_helper\.js(\?v=[^"'\s>]+)?/g, 'webrtc_audio_helper.js?v=' + newVersion);
    // Thay thế query param cho main.dart.js và bootstrap
    content = content.replace(/flutter_bootstrap\.js(\?v=[^"'\s>]+)?/g, 'flutter_bootstrap.js?v=' + newVersion);
    content = content.replace(/main\.dart\.js(\?v=[^"'\s>]+)?/g, 'main.dart.js?v=' + newVersion);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Đã cập nhật version ${newVersion} trên: ${hf}`);
  }
});

// Cập nhật bootstrap files
const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/public/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

bootstrapFiles.forEach(bf => {
  const fullPath = path.join(__dirname, '..', bf);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/entrypointUrl:n=\`\$\{w\}main\.dart\.js(\?v=[^\`,\"]+)?\`?/g, 'entrypointUrl:n=`${w}main.dart.js?v=' + newVersion + '`');
    content = content.replace(/mainJsPath:\??"main\.dart\.js(\?v=[^\`,\"]+)?"/g, 'mainJsPath:"main.dart.js?v=' + newVersion + '"');
    content = content.replace(/"main\.dart\.js(\?v=[^\`,\"]+)?"/g, '"main.dart.js?v=' + newVersion + '"');
    fs.writeFileSync(fullPath, content, 'utf8');
    new vm.Script(content);
    console.log(`✅ Đã cập nhật bootstrap: ${bf}`);
  }
});

console.log('\n🎉 Hoàn tất đồng bộ toàn bộ file và làm mới cache!');
