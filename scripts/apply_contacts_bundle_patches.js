const fs = require('fs');
const vm = require('vm');

const targetBundles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

targetBundles.forEach(bundlePath => {
  if (!fs.existsSync(bundlePath)) {
    console.log('Skipping non-existent:', bundlePath);
    return;
  }
  let code = fs.readFileSync(bundlePath, 'utf8');

  // 1. Tab 1 switch in A.auX.prototype.$0 (bottom nav bar)
  const auXRegex = /A\.auX\.prototype\s*=\s*\{\r?\n\$0\(\)\{var s=this\.a,r=this\.b\r?\ns\.K\(new A\.auW\(s,r\)\)\r?\nif\(r===1\)s\.kE\(\)\},\r?\n\$S:0\}/;
  const newAuX = `A.auX.prototype={\r\n$0(){var s=this.a,r=this.b\r\ns.K(new A.auW(s,r))\r\nif(r===1){s.kE();s.k2=A.nX();}},\r\n$S:0}`;
  if (auXRegex.test(code)) {
    code = code.replace(auXRegex, newAuX);
    console.log('✅ Patched auX (tab 1 tap refresh) in', bundlePath);
  }

  // 2. Returning from friend requests in auG.prototype.$0 should also refresh contacts
  const auGRegex = /case 2:o\.kE\(\)\r?\nreturn A\.v\(null,r\)\}\}\)/;
  const newAuGCase2 = `case 2:o.kE();o.k2=A.nX();\r\nreturn A.v(null,r)}})`;
  if (auGRegex.test(code)) {
    code = code.replace(auGRegex, newAuGCase2);
    console.log('✅ Patched auG (friend requests return refresh) in', bundlePath);
  }

  // 3. Avatar support in A.auy.prototype.$2 (no letters covering face)
  const avatarRegex = /p=J\.e\(f\.h\(g,"isOnline"\),!0\)\|\|J\.e\(f\.h\(g,"status"\),"online"\)\r?\nf=j\.a\r?\ne=f\.Hy\(s\)\r?\no=t\.p\r?\nvar _av=.*?\r?\nvar _avW=.*?\r?\ne=A\.b\(\[A\.a5\(i,_avW.*?\r?\n/s;

  const newAvatarPart = `p=J.e(f.h(g,"isOnline"),!0)||J.e(f.h(g,"status"),"online")\r\nf=j.a\r\ne=f.Hy(s)\r\no=t.p\r\nvar _av=null;\r\ntry{if(g&&typeof g==="object"&&g.avatar)_av=g.avatar;}catch(_e){}\r\nif(!_av&&q&&q.length>0)_av="/api/users/"+q+"/avatar";\r\nvar _avW=_av?A.hO(B.eg,new A.eY(_av,1,i),i,24):A.cn(A.a2(f.HC(s),i,i,i,i,i,B.avy,i,i,i),i,i);\r\ne=A.b([A.a5(i,_avW,B.h,i,i,new A.ak(i,i,i,i,i,e,B.a8),i,48,i,i,i,i,48)],o)\r\n`;

  if (avatarRegex.test(code)) {
    code = code.replace(avatarRegex, newAvatarPart);
    console.log('✅ Patched auy avatar support (clean without initials on photo) in', bundlePath);
  }

  // 4. Header (+) button in aaT(a) - keep original single row to ensure rock-solid rendering
  const oldHeaderRowPattern = /var _addBtn=.*?\r?\nm=A\.b9\(A\.b\(\[A\.b9\(A\.b\(\[B\.abF,B\.aT,A\.a2\("Danh B\\u1ea1".*?\r?\n/s;
  const originalHeaderRow = `m=A.b9(A.b([B.abF,B.aT,A.a2("Danh B\\u1ea1",c,c,c,c,c,A.ay(c,c,p,c,c,c,c,c,c,c,c,20,c,c,B.u,c,c,!0,c,c,c,c,c,c,c,c),c,c,c)],b),B.l,B.m,B.p)`;

  if (oldHeaderRowPattern.test(code)) {
    code = code.replace(oldHeaderRowPattern, originalHeaderRow + '\r\n');
    console.log('✅ Restored clean header row in', bundlePath);
  }

  // Syntax validation with vm.Script
  try {
    new vm.Script(code);
    fs.writeFileSync(bundlePath, code, 'utf8');
    console.log('🎉 Syntax check PASSED & saved:', bundlePath);
  } catch (err) {
    console.error('❌ Syntax error in', bundlePath, err);
    process.exit(1);
  }
});

console.log('All bundles patched successfully!');
