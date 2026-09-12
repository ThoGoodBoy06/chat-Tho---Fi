const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Patch B.atR (DefaultEmojiTextStyle used in EmojiPicker)
  const oldAtR = 'B.atR=new A.l(!0,null,null,null,B.aim,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)';
  const newAtR = 'B.atR=new A.l(!0,null,null,null,B.aim,null,null,null,null,null,null,null,null,"Noto Color Emoji",null,null,null,null,null,null,null,null,null,null,null,null)';

  if (js.includes(oldAtR)) {
    js = js.replace(oldAtR, newAtR);
    console.log('Patched B.atR in', f);
  } else {
    console.log('oldAtR not found in', f);
  }

  // 2. Patch useColorEmoji in gLR()
  const idx = js.indexOf('r=this.b=A.b1E(new A.anh(this),A.b([A.a8("Noto Sans"');
  if (idx !== -1) {
    const before = js.substring(idx - 30, idx);
    if (before.includes('s=s===!0')) {
      js = js.substring(0, idx - 30) + before.replace('s=s===!0', 's=!0') + js.substring(idx);
      console.log('Patched gLR useColorEmoji in', f);
    }
  }

  fs.writeFileSync(f, js);
});
