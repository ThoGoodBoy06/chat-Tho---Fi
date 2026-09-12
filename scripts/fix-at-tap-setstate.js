const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // Replace s.aoW() with if(s.c)s.K(new A.ax1()) in A.atTap.prototype
  const oldProto = 's.aoW()},\r\n$S:0}';
  const oldProtoLf = 's.aoW()},\n$S:0}';
  const newProto = 'if(s.c)s.K(new A.ax1())},\r\n$S:0}';

  if (js.includes(oldProto)) {
    js = js.replace(oldProto, newProto);
    console.log('Fixed A.atTap.prototype (CRLF) in', f);
  } else if (js.includes(oldProtoLf)) {
    js = js.replace(oldProtoLf, 'if(s.c)s.K(new A.ax1())},\n$S:0}');
    console.log('Fixed A.atTap.prototype (LF) in', f);
  } else {
    // Check if atTap exists
    const idx = js.indexOf('A.atTap.prototype=');
    if (idx !== -1) {
      console.log('atTap snippet in', f, ':', js.slice(idx, idx + 180));
    } else {
      console.log('A.atTap.prototype not found in', f);
    }
  }

  fs.writeFileSync(f, js);
});
