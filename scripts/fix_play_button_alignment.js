const fs = require('fs');

console.log('🎯 Sửa triệt để vòng tròn nút Play: Dùng B.T (Alignment.center) để CircleAvatar chuẩn 30px (không bị kéo giãn 160px)...');

const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  // 1. Cập nhật _playOverlay: Bán kính 15px (đường kính 30px), icon 16px, nền đen mờ 33% (0x55000000 = 1426063360)
  content = content.replace(
    /var _playOverlay=A\.hO\(new A\.q\(\d+\),d,A\.bV\(B\.aaW,B\.f,d,\d+\),\d+\);/g,
    'var _playOverlay=A.hO(new A.q(1426063360),d,A.bV(B.aaW,B.f,d,16),15);'
  );

  // 2. Cực kỳ quan trọng: Trong _card = A.a5, đổi alignment từ B.h (Clip.none - không có align, gây kéo dãn) sang B.T (Alignment.center)
  content = content.replace(
    'var _card=A.a5(d,_playOverlay,B.h,d,d,_boxDec,d,240,d,d,d,d,160);',
    'var _card=A.a5(d,_playOverlay,B.T,d,d,_boxDec,d,240,d,d,d,d,160);'
  );

  fs.writeFileSync(jf, content, 'utf8');
  console.log(`✅ [${jf}] Đã cập nhật B.T và _playOverlay chuẩn 30px`);
});

console.log('✨ Xong!');
