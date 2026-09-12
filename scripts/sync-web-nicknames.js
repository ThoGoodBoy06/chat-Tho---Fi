const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

console.log('--- 1. Đồng bộ socket conversation_nicknames_updated vào main.dart.js ---');
jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  const target = 'if(a0!=null)a0.c6(0,"nickname_changed",new A.anR())';
  const replacement = 'if(a0!=null)a0.c6(0,"nickname_changed",new A.anR());if(a0!=null)a0.c6(0,"conversation_nicknames_updated",new A.anR())';

  if (content.includes(target) && !content.includes('"conversation_nicknames_updated",new A.anR()')) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Đã thêm listener conversation_nicknames_updated vào:', file);
  } else if (content.includes('"conversation_nicknames_updated",new A.anR()')) {
    console.log('ℹ️ Đã tồn tại listener trong:', file);
  } else {
    console.warn('⚠️ Không tìm thấy target trong:', file);
  }
});

console.log('\n--- 2. Đồng bộ các tệp giữa flutter_frontend/build/web, public, backend ---');
const srcDir = path.join(ROOT, 'flutter_frontend', 'build', 'web');
const publicDir = path.join(ROOT, 'public');
const backendWebDir = path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web');

['main.dart.js', 'index.html', 'version.json'].forEach(f => {
  const srcFile = path.join(srcDir, f);
  if (fs.existsSync(srcFile)) {
    const pubFile = path.join(publicDir, f);
    const bkFile = path.join(backendWebDir, f);
    fs.copyFileSync(srcFile, pubFile);
    fs.copyFileSync(srcFile, bkFile);
    console.log(`✅ Đã copy ${f} sang public và backend web`);
  }
});

console.log('\n🎉 Hoàn tất đồng bộ các bản build Web!');
