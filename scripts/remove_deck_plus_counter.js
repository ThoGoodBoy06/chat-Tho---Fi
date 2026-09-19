const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Đang tiến hành xóa chữ "+3" và lớp phủ đếm ảnh trong Album...');

// 1. Cập nhật mã nguồn Dart
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');

  // Đổi `buildCard(cluster[2], 2, true)` thành `buildCard(cluster[2], 2, false)`
  if (code.includes('buildCard(cluster[2], 2, true)')) {
    code = code.replace('buildCard(cluster[2], 2, true)', 'buildCard(cluster[2], 2, false)');
    console.log(`✅ [Dart] Đã bỏ cờ showMore: ${path.basename(df)}`);
  }

  // Xóa khối if (showMore) Container(...) nếu có
  const showMorePattern = /if\s*\(showMore\)\s*Container\([\s\S]*?\+\$moreCount[\s\S]*?\),[\r\n\s]*/;
  if (showMorePattern.test(code)) {
    code = code.replace(showMorePattern, '');
    console.log(`✅ [Dart] Đã xóa khối hiển thị +$moreCount: ${path.basename(df)}`);
  }

  fs.writeFileSync(df, code, 'utf8');
});

// 2. Cập nhật 4 file main.dart.js
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  // Thay thế makeFannedCard card3
  const targetCard3 = 'var card3 = makeFannedCard(cluster[2], cW, cH, 20, 2, moreRemaining);';
  const replaceCard3 = 'var card3 = makeFannedCard(cluster[2], cW, cH, 20, 2, 0);';
  if (content.includes(targetCard3)) {
    content = content.replace(targetCard3, replaceCard3);
    console.log(`✅ [JS] Đã đổi card3 không truyền moreRemaining: ${path.basename(jf)}`);
  }

  // Xóa overlay "+" + moreCount trong makeFannedCard
  const targetOverlayPattern = /if\s*\(moreCount\s*&&\s*moreCount\s*>\s*0\)\s*\{[\s\S]*?cardLayers\.push\(moreOverlay\);[\s\S]*?\}/;
  if (targetOverlayPattern.test(content)) {
    content = content.replace(targetOverlayPattern, '/* removed +moreCount overlay */');
    console.log(`✅ [JS] Đã xóa overlay chữ +moreCount trong makeFannedCard: ${path.basename(jf)}`);
  }

  // Kiểm tra cú pháp an toàn với vm.Script
  try {
    new vm.Script(content);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`💾 [PASS] Cú pháp hợp lệ và đã lưu: ${jf}`);
  } catch (err) {
    console.error(`❌ [FAIL] Lỗi cú pháp khi sửa ${jf}:`, err.message);
    process.exit(1);
  }
});

// 3. Cache bust cho index.html
const now = Date.now();
const indexFiles = [
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'public/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/web/index.html'
];
indexFiles.forEach(f => {
  const fullPath = path.join(__dirname, '..', f);
  if (fs.existsSync(fullPath)) {
    let h = fs.readFileSync(fullPath, 'utf8');
    h = h.replace(/main\.dart\.js\?v=[^"']+/g, 'main.dart.js?v=v_nodeck_' + now);
    fs.writeFileSync(fullPath, h, 'utf8');
    console.log(`🔄 [Cache-Bust] Đã cập nhật hash mới cho ${f}`);
  }
});

console.log('\n🎉 ĐÃ HOÀN TẤT XÓA CHỮ "+3" KHỎI ALBUM ẢNH!');
