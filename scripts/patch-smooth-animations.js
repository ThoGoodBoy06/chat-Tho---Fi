const fs = require('fs');
const path = require('path');

const timestamp = Date.now();
console.log(`🚀 Starting smooth animation patching with version: ${timestamp}`);

const dirs = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }
  console.log(`Processing directory: ${dir}`);

  // 1. Patch main.dart.js
  const mainJsPath = path.join(dir, 'main.dart.js');
  if (fs.existsSync(mainJsPath)) {
    let content = fs.readFileSync(mainJsPath, 'utf8');

    // 1a. Smooth dialog scale & fade animation (0.88 -> 1.0 with Apple fluid curve B.qc and cubic fade B.JK)
    // Old: $4(a,b,c,d){return A.Fa(new A.dO(b,!1,d,null),A.ci(B.dx,b,null))}
    const oldAwyRegex = /\$4\(a,b,c,d\)\{return A\.Fa\(new A\.dO\(b,!1,d,null\),A\.ci\(B\.dx,b,null\)\)\}/;
    const newAwy = '$4(a,b,c,d){return A.Fa(new A.dO(A.ci(B.JK,b,null),!1,d,null),new A.aN(A.ci(B.qc,b,null),new A.aG(0.88,1,t.Y),t.Y.i("aN<aH.T>")))}';
    if (oldAwyRegex.test(content)) {
      content = content.replace(oldAwyRegex, newAwy);
      console.log(`  ✓ Patched A.awy.prototype.$4 with smooth 0.88->1.0 fluid curve in ${mainJsPath}`);
    } else if (content.includes(newAwy)) {
      console.log(`  ✓ A.awy.prototype.$4 already patched in ${mainJsPath}`);
    } else {
      console.log(`  ⚠️ Could not find A.awy.prototype.$4 pattern in ${mainJsPath}`);
    }

    // 1b. Dialog transition duration: from 220ms (B.qq) to 250ms (B.ek)
    const oldVk = 'new A.awy(),B.qq,t.X)';
    const newVk = 'new A.awy(),B.ek,t.X)';
    if (content.includes(oldVk)) {
      content = content.replace(oldVk, newVk);
      console.log(`  ✓ Patched dialog transition duration to 250ms (B.ek) in ${mainJsPath}`);
    } else if (content.includes(newVk)) {
      console.log(`  ✓ Dialog transition duration already set to 250ms in ${mainJsPath}`);
    }

    // 1c. Emoji bounce animation in _SpringEmojiPickerItemState (A.a1W.prototype.az)
    // Old: q.e=new A.aN(A.ci(B.p3,s,p),new A.aG(1,1.5,r),r.i("aN<aH.T>"))
    // New: q.e=new A.aN(A.ci(B.qc,s,p),new A.aG(1,1.30,r),r.i("aN<aH.T>"))
    const oldEmojiCurve = 'q.e=new A.aN(A.ci(B.p3,s,p),new A.aG(1,1.5,r),r.i("aN<aH.T>"))';
    const newEmojiCurve = 'q.e=new A.aN(A.ci(B.qc,s,p),new A.aG(1,1.30,r),r.i("aN<aH.T>"))';
    if (content.includes(oldEmojiCurve)) {
      content = content.replace(oldEmojiCurve, newEmojiCurve);
      console.log(`  ✓ Patched emoji spring animation curve & scale to 1.30 in ${mainJsPath}`);
    } else if (content.includes(newEmojiCurve)) {
      console.log(`  ✓ Emoji spring animation already patched in ${mainJsPath}`);
    }

    // 1d. Emoji controller duration: from 220ms (B.qq) to 200ms (B.J)
    const oldEmojiDur = 's=A.bR(p,B.qq,p,p,q)';
    const newEmojiDur = 's=A.bR(p,B.J,p,p,q)';
    if (content.includes(oldEmojiDur)) {
      content = content.replace(oldEmojiDur, newEmojiDur);
      console.log(`  ✓ Patched emoji duration to 200ms in ${mainJsPath}`);
    }

    fs.writeFileSync(mainJsPath, content, 'utf8');
  }

  // 2. Update flutter_bootstrap.js
  const bootstrapPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootstrapPath)) {
    let content = fs.readFileSync(bootstrapPath, 'utf8');
    content = content.replace(/"mainJsPath"\s*:\s*"main\.dart\.js(?:\?v=[^"]*)?"/g, `"mainJsPath":"main.dart.js?v=${timestamp}"`);
    fs.writeFileSync(bootstrapPath, content, 'utf8');
    console.log(`  ✓ Updated ${bootstrapPath}`);
  }

  // 3. Update index.html
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    content = content.replace(/flutter_bootstrap\.js(?:\?v=\d+)?/g, `flutter_bootstrap.js?v=${timestamp}`);
    content = content.replace(/main\.dart\.js(?:\?v=\d+)?/g, `main.dart.js?v=${timestamp}`);
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`  ✓ Updated ${indexPath}`);
  }
});

console.log('✅ Smooth animation patching completed successfully!');
