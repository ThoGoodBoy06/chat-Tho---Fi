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

  // Find A.auy.prototype.$2
  // Match from 'p=J.e(f.h(g,"isOnline"),!0)||J.e(f.h(g,"status"),"online")' up to 'e=A.b([_avW],o)' or 'e=A.b([A.a5('
  const targetPattern = /p=J\.e\(f\.h\(g,"isOnline"\),!0\)\|\|J\.e\(f\.h\(g,"status"\),"online"\)\r?\nf=j\.a[\s\S]*?e=A\.b\(\[(?:_avW|A\.a5\([^\]]*?\))\],o\)/;

  const safeReplacement = `p=J.e(f.h(g,"isOnline"),!0)||J.e(f.h(g,"status"),"online")\r
var _av=null;\r
try{_av=f.h(g,"avatar");if(!_av)_av=f.h(g,"avatarUrl");}catch(_e){}\r
var _hasAv=_av!=null&&_av!=="null"&&_av.length>0;\r
f=j.a\r
e=f.Hy(s)\r
o=t.p\r
var _fallbackWidget=A.a5(i,A.cn(A.a2(f.HC(s),i,i,i,i,i,B.avy,i,i,i),i,i),B.h,i,i,new A.ak(i,i,i,i,i,e,B.a8),i,48,i,i,i,i,48);\r
var _avW=_fallbackWidget;\r
if(_hasAv&&_av){\r
  try{\r
    _avW=A.a5(i,i,B.h,i,i,new A.ak(B.o,A.a9i(B.e8,new A.eY(_av,1,i),i),i,i,i,i,B.a8),i,48,i,i,i,i,48);\r
  }catch(_err){\r
    _avW=_fallbackWidget;\r
  }\r
}\r
e=A.b([_avW],o)`;

  if (targetPattern.test(code)) {
    code = code.replace(targetPattern, safeReplacement);
    console.log('✅ Safely patched auy avatar in', bundlePath);
  } else {
    console.error('❌ Pattern not matched in', bundlePath);
  }

  try {
    new vm.Script(code);
    fs.writeFileSync(bundlePath, code, 'utf8');
    console.log('🎉 Syntax check PASSED & saved:', bundlePath);
  } catch (err) {
    console.error('❌ Syntax error in', bundlePath, err);
    process.exit(1);
  }
});

console.log('Done.');
