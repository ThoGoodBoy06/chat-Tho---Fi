const fs = require('fs');
const path = require('path');

console.log('💬 CẬP NHẬT HIỂN THỊ TIN NHẮN HỆ THỐNG ĐỔI CHỦ ĐỀ CHO CẢ 2 BÊN...');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const targetPattern = 'else c=h+" \\u0111\\xe3 x\\xf3a bi\\u1ec7t danh c\\u1ee7a "+g+"."}}return A.a5(e,A.cn(A.a2(c,e,e,e,e,e,B.au0,B.be,e,e),e,e),B.h,e,e,e,e,e,B.La,e,e,e,e)},';
const replacementPattern = 'else c=h+" \\u0111\\xe3 x\\xf3a bi\\u1ec7t danh c\\u1ee7a "+g+"."}}if(a.c&&a1&&a.c===a1.a&&c&&c.indexOf("\\u0111\\xe3 \\u0111\\u1ed5i ch\\u1ee7 \\u0111\\u1ec1 \\u0111o\\u1ea1n chat th\\xe0nh")!==-1){c="B\\u1ea1n "+c.substring(c.indexOf("\\u0111\\xe3 \\u0111\\u1ed5i ch\\u1ee7 \\u0111\\u1ec1 \\u0111o\\u1ea1n chat th\\xe0nh"));}return A.a5(e,A.cn(A.a2(c,e,e,e,e,e,B.au0,B.be,e,e),e,e),B.h,e,e,e,e,e,B.La,e,e,e,e)},';

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý JS: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  if (js.includes(targetPattern) && !js.includes('c="B\\u1ea1n "+c.substring')) {
    js = js.replace(targetPattern, replacementPattern);
    fs.writeFileSync(filePath, js, 'utf8');
    console.log('✅ Đã chèn logic hiển thị tin nhắn hệ thống (Bạn / Tên đối phương)');
  } else {
    console.log('ℹ️ Đã tồn tại hoặc không tìm thấy targetPattern');
  }
});

// Nâng cache timestamp
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

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

console.log('\n🎉 HOÀN TẤT CẬP NHẬT THÔNG BÁO HỆ THỐNG ĐỔI CHỦ ĐỀ!');
