const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Đang xóa nút chuyển tiếp tròn cạnh Album 3D...');

// 1. CẬP NHẬT 4 FILE MAIN.DART.JS
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const oldMiddleRowRegex = /var middleRow;[\r\n\s]*if\s*\(isMe\)\s*\{[\r\n\s]*middleRow\s*=\s*A\.b9\(A\.b\(\[shareBtn,\s*new A\.cv\(12,\s*null,\s*null,\s*null\),\s*deckWithTap\],\s*t\.p\),\s*B\.dw,\s*B\.m,\s*B\.G\);[\r\n\s]*\}\s*else\s*\{[\r\n\s]*middleRow\s*=\s*A\.b9\(A\.b\(\[deckWithTap,\s*new A\.cv\(12,\s*null,\s*null,\s*null\),\s*shareBtn\],\s*t\.p\),\s*B\.l,\s*B\.m,\s*B\.G\);[\r\n\s]*\}/g;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  if (oldMiddleRowRegex.test(content)) {
    content = content.replace(oldMiddleRowRegex, 'var middleRow = deckWithTap;');
    try {
      new vm.Script(content);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  [OK] Đã xóa nút shareBtn khỏi Album 3D trong: ${file}`);
    } catch (err) {
      console.error(`  [ERROR] Lỗi cú pháp khi cập nhật ${file}:`, err);
      process.exit(1);
    }
  } else {
    console.log(`  [SKIP/ALREADY DONE] Không tìm thấy đoạn code cũ trong: ${file}`);
  }
});

// 2. CẬP NHẬT 2 FILE CHAT_SCREEN.DART
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Xóa nút _buildDeckShareButton bên trái (isMe)
  const isMeSharePattern = /if\s*\(isMe\)\s*\.\.\.\[[\r\n\s]*_buildDeckShareButton\(context,\s*cluster\.first\),[\r\n\s]*const SizedBox\(width:\s*12\),[\r\n\s]*\],?/g;
  content = content.replace(isMeSharePattern, '');

  // Xóa nút _buildDeckShareButton bên phải (!isMe)
  const notIsMeSharePattern = /if\s*\(!isMe\)\s*\.\.\.\[[\r\n\s]*const SizedBox\(width:\s*12\),[\r\n\s]*_buildDeckShareButton\(context,\s*cluster\.first\),[\r\n\s]*\],?/g;
  content = content.replace(notIsMeSharePattern, '');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`  [OK] Đã gỡ nút share tròn trong file Dart: ${file}`);
});

console.log('✅ Hoàn tất xóa nút tròn chuyển tiếp cạnh Album 3D!');
