const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const targetOriginal = 'o.push(new A.eT(1,B.bv,A.dr(h,A.bm(d,m,B.m,B.p),B.M,!1,h,new A.atT(g,e),new A.atU(n,a),h,h,h,h,h,new A.atV(n,a,e,g,b),h,h,h,h,h,h,h,h,h,h,new A.atW(n,a,e,g,b),h,h,h,h,h,h,h,h,!1,B.ao),h))';

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // Remove A.atTap definition at the end
  const tapMarker = 'A.atTap = function';
  if (js.includes(tapMarker)) {
    const idx = js.indexOf(tapMarker);
    js = js.substring(0, idx).trimEnd() + '\n';
    console.log('Removed A.atTap from', f);
  }

  // Restore the original o.push line without broken atTap or broken d.push
  const brokenTarget = 'if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){';
  if (js.includes(brokenTarget)) {
    const startIdx = js.indexOf(brokenTarget);
    const endMarker = 'return A.bm(c,B.l,B.m,B.p)}';
    const endIdx = js.indexOf(endMarker, startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
      // Find where c.push(new A.bc(B.lB is
      const cPushIdx = js.indexOf('c.push(new A.bc(B.lB', startIdx);
      if (cPushIdx !== -1) {
        js = js.substring(0, startIdx) + targetOriginal + '\n' + js.substring(cPushIdx);
        console.log('Restored original o.push in', f);
      }
    }
  }

  fs.writeFileSync(f, js);
});
