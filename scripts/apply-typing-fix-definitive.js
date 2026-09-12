const fs = require('fs');
const path = require('path');

const versionTag = 'v=' + Date.now();
console.log('🚀 Applying definitive typing indicator fix with version:', versionTag);

// 1. Update HTML and bootstrap files with new cache-busting version
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
];

htmlFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let html = fs.readFileSync(f, 'utf8');
  html = html.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?${versionTag}`);
  html = html.replace(/flutter_bootstrap\.js\?v=[^"']+/g, `flutter_bootstrap.js?${versionTag}`);
  fs.writeFileSync(f, html, 'utf8');
  console.log(`✅ Updated cache buster in ${f}`);
});

const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
];

bootstrapFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');
  js = js.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?${versionTag}`);
  fs.writeFileSync(f, js, 'utf8');
  console.log(`✅ Updated cache buster in ${f}`);
});

// 2. Patch main.dart.js
const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let code = fs.readFileSync(f, 'utf8');

  // A. In A.auk.prototype:
  // Completely REMOVE the outside floating container so it NEVER covers any message!
  const aukPattern = /A\.auk\.prototype=\{\r?\n\$3\(a,b,c\)\{[\s\S]*?\$C:"\$3"/;
  if (aukPattern.test(code)) {
    code = code.replace(aukPattern, `A.auk.prototype={
$3(a,b,c){return B.au},
$C:"$3"`);
    console.log(`✅ Neutralized A.auk (floating bar removed) in ${path.basename(f)}`);
  }

  // B. In A.auj.prototype:
  // Add 1 to itemCount if typingUser is present
  const aujTarget = /A\.auj\.prototype=\{\r?\n\$1\(a\)\{var s=this,r=s\.b,q=s\.a[\s\S]*?return A\.rh\(q\.f,new A\.au_\(q,r,B\.b\.a0n\(r\.d,new A\.au0\(r\)\),s\.c,s\.d\),r\.d\.length,B\.lI,B\.a0,!1\)\},\r?\n\$S:588\}/;
  if (aujTarget.test(code)) {
    code = code.replace(aujTarget, `A.auj.prototype={
$1(a){var s=this,r=s.b,q=s.a,tp=r.a3p(),hasTp=tp!=null&&tp.length!==0;
return A.rh(q.f,new A.au_(q,r,B.b.a0n(r.d,new A.au0(r)),s.c,s.d),r.d.length+(hasTp?1:0),B.lI,B.a0,!1)},
$S:588}`);
    console.log(`✅ Patched A.auj (itemCount + 1 when typing) in ${path.basename(f)}`);
  } else {
    console.log(`ℹ️ A.auj pattern already updated or not found in ${path.basename(f)}`);
  }

  // C. In A.au_.prototype.$2:
  // When a0 === f.length, render the typing indicator inside the ListView!
  const au_Target = /A\.au_\.prototype=\{\r?\n\$2\(a,a0\)\{var s,r,q,p,o,n,m,l,k,j,i=this,h=null,g=i\.b,f=g\.d,e=f\[a0\]/;
  if (au_Target.test(code)) {
    code = code.replace(au_Target, `A.au_.prototype={
$2(a,a0){var s,r,q,p,o,n,m,l,k,j,i=this,h=null,g=i.b,f=g.d;
if(a0===f.length){
  var tp=g.a3p();
  if(!tp)return B.au;
  var b=A.ag(18),c=t.p;
  return A.a5(h,A.b9(A.b([A.a5(h,A.b9(A.b([A.a2(A.f(tp)+" \\u0111ang g\\xf5 ",h,h,h,h,h,B.av2,h,h,h),B.cW,B.FC],c),B.l,B.m,B.G),B.h,h,h,new A.ak(B.eg,h,h,b,h,h,B.t),h,h,h,B.fu,h,h,h)],c),B.l,B.m,B.p),B.h,h,h,h,h,h,h,B.lK,h,h,1/0);
}
var e=f[a0]`);
    console.log(`✅ Injected typing item at end of ListView in ${path.basename(f)}`);
  } else {
    console.log(`ℹ️ A.au_ pattern already updated or not found in ${path.basename(f)}`);
  }

  fs.writeFileSync(f, code, 'utf8');
  console.log(`💾 Saved ${f}`);
});
console.log('🎉 All files patched successfully!');
