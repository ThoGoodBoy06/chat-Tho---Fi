const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Keep maxLines: 1 and ellipsis (B.a9) in A.au7.prototype so it never wraps
  const oldAu7 = 'return A.a2(this.a.S9(o,p.gDn()),q,q,q,q,q,B.at8,q,q,q)';
  const newAu7 = 'return A.a2(this.a.S9(o,p.gDn()),q,1,B.a9,q,q,B.at8,q,q,q)';
  if (js.includes(oldAu7)) {
    js = js.replace(oldAu7, newAu7);
  }

  // 2. Restore subtitle font size in B.at8 back to 13.5
  const size12 = 'B.at8=new A.l(!0,B.cL,null,null,null,null,12,';
  const size13_5 = 'B.at8=new A.l(!0,B.cL,null,null,null,null,13.5,';
  if (js.includes(size12)) {
    js = js.replace(size12, size13_5);
    console.log('Restored B.at8 font size to 13.5 in', f);
  }

  // 3. Restore title name font size back to 18
  const size16 = ',16,b,b,B.u,b,b,!0,b,-0.3';
  const size18 = ',18,b,b,B.u,b,b,!0,b,-0.3';
  if (js.includes(size16)) {
    js = js.replace(size16, size18);
    console.log('Restored title font size to 18 in', f);
  }

  // 4. Restore avatar radius back to 22
  const r20 = 'A.b([A.hO(B.o,i,k,20)],m)';
  const r22 = 'A.b([A.hO(B.o,i,k,22)],m)';
  if (js.includes(r20)) {
    js = js.replace(r20, r22);
    console.log('Restored avatar radius to 22 in', f);
  }

  fs.writeFileSync(f, js);
});
