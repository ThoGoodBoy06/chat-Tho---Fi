const fs = require('fs');

console.log('🎯 Tinh chỉnh nút Play nhỏ gọn, tinh tế chuẩn Messenger & Zalo...');

const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const targetStr = 'var _playOverlay=A.hO(new A.q(1879048192),d,A.bV(B.aaW,B.f,d,28),24);';
const refinedStr = 'var _playOverlay=A.hO(new A.q(1879048192),d,A.bV(B.aaW,B.f,d,20),18);';

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  if (content.includes(targetStr)) {
    content = content.replace(targetStr, refinedStr);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`✅ [${jf}] Đã thu nhỏ nút Play (Icon: 20px, Bán kính: 18px)`);
  } else {
    console.warn(`⚠️ [${jf}] Không tìm thấy targetStr`);
  }
});

console.log('✨ Hoàn tất!');
