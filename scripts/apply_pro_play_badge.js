const fs = require('fs');

console.log('🌟 Đang áp dụng nút Play nổi bật chuẩn Messenger (Vòng tròn kính mờ 38px + viền trắng 1.2px + icon trắng)...');

// 1. Cập nhật chat_screen.dart
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');

  const oldChild = `child: CircleAvatar(
              radius: 18,
              backgroundColor: Colors.black.withOpacity(0.55),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
            ),`;

  const newChild = `child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.45),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withOpacity(0.85), width: 1.2),
              ),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
            ),`;

  if (code.includes(oldChild)) {
    code = code.replace(oldChild, newChild);
    fs.writeFileSync(df, code, 'utf8');
    console.log(`✅ [${df}] Đã cập nhật nút Play viền trắng nổi bật trong Dart`);
  }
});

// 2. Cập nhật 4 file main.dart.js
const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const targetPattern = /var _playOverlay=A\.bV\(B\.aaW,B\.f,d,28\);/;
const proPlayOverlay = 'var _playOverlay=A.a5(d,A.bV(B.aaW,B.f,d,20),B.T,d,d,new A.ak(new A.q(1610612736),d,A.dx(B.f,1.2),A.ag(19),d,d,B.t),d,38,d,d,d,d,38);';

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  if (targetPattern.test(content)) {
    content = content.replace(targetPattern, proPlayOverlay);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`✅ [${jf}] Đã cập nhật nút Play nổi bật (38px, viền trắng 1.2px, kính mờ, icon 20px)`);
  } else {
    // Nếu trước đó đang dùng pattern khác
    const altPattern = /var _playOverlay=[\s\S]*?;(?=\r?\n\s*if\(_isSending\))/;
    if (altPattern.test(content)) {
      content = content.replace(altPattern, proPlayOverlay);
      fs.writeFileSync(jf, content, 'utf8');
      console.log(`✅ [${jf}] Đã cập nhật altPattern nút Play nổi bật`);
    } else {
      console.warn(`⚠️ [${jf}] Không tìm thấy pattern để thay thế`);
    }
  }
});

console.log('✨ Xong!');
