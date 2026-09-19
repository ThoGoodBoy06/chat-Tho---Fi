const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n===> Resizing spinner in: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. In aaY (single images): resize 56x56 -> 40x40, spinner 28x28 -> 20x20, stroke 2.6 -> 2.0
  const oldAaY = 'var _spinProgress=new A.cv(28,28,new A.mb(2.6,null,null,B.f,null,null,null,null),null);\r\nvar _centerCircle=A.a5(d,_spinProgress,B.h,d,d,new A.ak(new A.q(2013265920),d,d,A.ag(28),d,d,B.t),d,56,d,d,d,d,56);';
  const oldAaYLF = oldAaY.replace(/\r\n/g, '\n');

  const newAaY = 'var _spinProgress=new A.cv(20,20,new A.mb(2.0,null,null,B.f,null,null,null,null),null);\r\nvar _centerCircle=A.a5(d,_spinProgress,B.h,d,d,new A.ak(new A.q(2013265920),d,d,A.ag(20),d,d,B.t),d,40,d,d,d,d,40);';

  if (content.includes(oldAaY)) {
    content = content.replace(oldAaY, newAaY);
    modified = true;
    console.log('  [+] Resized aaY spinner to standard 40px (CRLF)');
  } else if (content.includes(oldAaYLF)) {
    content = content.replace(oldAaYLF, newAaY.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Resized aaY spinner to standard 40px (LF)');
  }

  // 2. In makeCardImg (collages/albums): resize 52x52 -> 36x36, spinner 26x26 -> 18x18, stroke 2.4 -> 1.8
  const oldCollage = 'var _spin = new A.cv(26, 26, new A.mb(2.4, null, null, B.f, null, null, null, null), null);\r\n      var _centerCircle = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(2013265920), null, null, A.ag(26), null, null, B.t), null, 52, null, null, null, null, 52);';
  const oldCollageLF = oldCollage.replace(/\r\n/g, '\n');

  const newCollage = 'var _spin = new A.cv(18, 18, new A.mb(1.8, null, null, B.f, null, null, null, null), null);\r\n      var _centerCircle = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(2013265920), null, null, A.ag(18), null, null, B.t), null, 36, null, null, null, null, 36);';

  if (content.includes(oldCollage)) {
    content = content.replace(oldCollage, newCollage);
    modified = true;
    console.log('  [+] Resized collage spinner to standard 36px (CRLF)');
  } else if (content.includes(oldCollageLF)) {
    content = content.replace(oldCollageLF, newCollage.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Resized collage spinner to standard 36px (LF)');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [OK] Saved resized spinner to ${filePath}`);
  } else {
    console.log(`  [-] No changes needed for ${filePath}`);
  }
});

console.log('\nFinished resizing spinners to standard Messenger proportions!');
