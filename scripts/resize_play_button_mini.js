const fs = require('fs');

console.log('🎯 Thu nhỏ nút Play về kích thước mini siêu chuẩn Messenger / Zalo (Đường kính 24px, Icon 13px)...');

const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  // Tìm _playOverlay bất kể kích thước hiện tại
  const pattern = /var _playOverlay=A\.hO\(new A\.q\(1879048192\),d,A\.bV\(B\.aaW,B\.f,d,\d+\),\d+\);/;
  const newOverlay = 'var _playOverlay=A.hO(new A.q(1879048192),d,A.bV(B.aaW,B.f,d,13),12);';

  if (pattern.test(content)) {
    content = content.replace(pattern, newOverlay);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`✅ [${jf}] Đã cập nhật nút Play mini (Bán kính 12px, Icon 13px)`);
  } else {
    console.warn(`⚠️ [${jf}] Không tìm thấy pattern`);
  }
});

console.log('✨ Xong!');
