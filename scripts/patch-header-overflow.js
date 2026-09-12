const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Add maxLines: 1 and TextOverflow.ellipsis (B.a9) to status text in A.au7.prototype
  const oldAu7 = 'return A.a2(this.a.S9(o,p.gDn()),q,q,q,q,q,B.at8,q,q,q)';
  const newAu7 = 'return A.a2(this.a.S9(o,p.gDn()),q,1,B.a9,q,q,B.at8,q,q,q)';
  if (js.includes(oldAu7)) {
    js = js.replace(oldAu7, newAu7);
    console.log('Fixed A.au7.prototype in', f);
  } else if (js.includes(newAu7)) {
    console.log('A.au7.prototype already patched in', f);
  } else {
    console.log('oldAu7 not found in', f);
  }

  // 2. Adjust subtitle font size in B.at8 from 13.5 to 12
  const oldAt8 = 'B.at8=new A.l(!0,B.cL,null,null,null,null,13.5,';
  const newAt8 = 'B.at8=new A.l(!0,B.cL,null,null,null,null,12,';
  if (js.includes(oldAt8)) {
    js = js.replace(oldAt8, newAt8);
    console.log('Adjusted B.at8 font size in', f);
  } else if (js.includes(newAt8)) {
    console.log('B.at8 font size already 12 in', f);
  } else {
    console.log('oldAt8 not found in', f);
  }

  // 3. Adjust title name font size in header from 18 to 16
  const oldTitleFont = ',18,b,b,B.u,b,b,!0,b,-0.3';
  const newTitleFont = ',16,b,b,B.u,b,b,!0,b,-0.3';
  if (js.includes(oldTitleFont)) {
    js = js.replace(oldTitleFont, newTitleFont);
    console.log('Adjusted title font size in', f);
  }

  // 4. Adjust avatar radius in header from 22 to 20
  const oldAvatarRadius = 'A.b([A.hO(B.o,i,k,22)],m)';
  const newAvatarRadius = 'A.b([A.hO(B.o,i,k,20)],m)';
  if (js.includes(oldAvatarRadius)) {
    js = js.replace(oldAvatarRadius, newAvatarRadius);
    console.log('Adjusted avatar radius in', f);
  }

  fs.writeFileSync(f, js);
});
