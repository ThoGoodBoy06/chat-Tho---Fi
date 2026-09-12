const fs = require('fs');
const path = require('path');

console.log('🔧 FIX LỖI THỨ TỰ THAM SỐ CONTAINER TRONG MAIN.DART.JS...');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const oldStr = 'var _bgDec=($.getThemeBgDecoration?$.getThemeBgDecoration(r):null);var _bgCol=_bgDec?null:q;return A.a5(b,A.bm(i,B.l,B.m,B.p),B.h,_bgCol,_bgDec,b,b,b,b,b,b,b,b)},';
const newStr = 'var _bgDec=null;try{_bgDec=($.getThemeBgDecoration?$.getThemeBgDecoration(r):null)}catch(e){_bgDec=null}var _bgCol=_bgDec?b:q;return A.a5(b,A.bm(i,B.l,B.m,B.p),B.h,_bgCol,b,_bgDec,b,b,b,b,b,b,b)},';

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let js = fs.readFileSync(filePath, 'utf8');

  if (js.includes(oldStr)) {
    js = js.replace(oldStr, newStr);
    fs.writeFileSync(filePath, js, 'utf8');
    console.log(`✅ Đã sửa chuẩn xác tham số A.a5 (decoration ở vị trí thứ 6) trong: ${filePath}`);
  } else {
    console.log(`⚠️ Không tìm thấy oldStr trong: ${filePath}`);
  }
});

// Nâng mã timestamp cache-busting mới
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  html = html.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(hf, html, 'utf8');
  console.log(`✅ Cập nhật timestamp trong: ${hf}`);
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
  console.log(`✅ Cập nhật timestamp trong: ${bf}`);
});

console.log('\n🌟 ĐÃ HOÀN TẤT BẢN SỬA LỖI THAM SỐ CONTAINER!');
