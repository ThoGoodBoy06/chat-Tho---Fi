const fs = require('fs');

const files = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const emojiMapCode = 'var _m={"❤️":"2764-fe0f.png","\\u2764\\ufe0f":"2764-fe0f.png","\\u2764":"2764-fe0f.png","😆":"1f606.png","\\ud83d\\ude06":"1f606.png","😮":"1f62e.png","\\ud83d\\ude2e":"1f62e.png","😢":"1f622.png","\\ud83d\\ude22":"1f622.png","😡":"1f621.png","\\ud83d\\ude21":"1f621.png","👍":"1f44d.png","\\ud83d\\udc4d":"1f44d.png"};';

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let js = fs.readFileSync(file, 'utf8');

  // 1. Patch H(a) in a1W (Emoji Picker item)
  const oldH = 'new A.bc(B.Li,A.a2(s.a.c,s.f,r,r,r,r,B.aug,r,r,r),r)';
  const newH = 'new A.bc(B.Li,(function(){' + emojiMapCode + 'var _f=_m[s.a.c];return _f?new A.mD(A.aLD(r,r,new A.An("assets/emojis/"+_f,r,r)),r,32,32,r,B.oU,s.f):A.a2(s.a.c,s.f,r,r,r,r,B.aug,r,r,r)})(),r)';

  if (js.includes(oldH)) {
    js = js.replace(oldH, newH);
    console.log('Patched H(a) in', file);
  } else {
    console.log('Could not find oldH in', file);
  }

  // 2. Patch av0.$1(a) (Reaction badge under message)
  const oldBadge = 'q=A.b([A.a2(a.a,s,s,s,s,s,A.ay(s,s,s,s,s,s,s,s,s,s,s,r+2,s,s,s,s,s,!0,s,s,s,s,s,s,s,s),s,s,s)],t.p)';
  const newBadge = 'q=A.b([(function(){' + emojiMapCode + 'var _f=_m[a.a];return _f?new A.mD(A.aLD(s,s,new A.An("assets/emojis/"+_f,s,s)),s,r+6,r+6,s,B.oU,s):A.a2(a.a,s,s,s,s,s,A.ay(s,s,s,s,s,s,s,s,s,s,s,r+2,s,s,s,s,s,!0,s,s,s,s,s,s,s,s),s,s,s)})()],t.p)';

  if (js.includes(oldBadge)) {
    js = js.replace(oldBadge, newBadge);
    console.log('Patched badge in', file);
  } else {
    console.log('Could not find oldBadge in', file);
  }

  // 3. Patch ayy.$1(a) (Flying emoji fireworks animation)
  const oldFlying = 'A.a2(p.a.d,k,k,k,k,k,A.ay(k,k,k,k,B.j,k,k,k,k,k,k,n,k,k,k,k,k,!0,k,k,k,k,k,k,k,k),k,k,k)';
  const newFlying = '(function(){' + emojiMapCode + 'var _f=_m[p.a.d];return _f?new A.mD(A.aLD(k,k,new A.An("assets/emojis/"+_f,k,k)),k,n,n,k,B.oU,k):A.a2(p.a.d,k,k,k,k,k,A.ay(k,k,k,k,B.j,k,k,k,k,k,k,n,k,k,k,k,k,!0,k,k,k,k,k,k,k,k),k,k,k)})()';

  if (js.includes(oldFlying)) {
    js = js.replace(oldFlying, newFlying);
    console.log('Patched flying emoji in', file);
  } else {
    console.log('Could not find oldFlying in', file);
  }

  fs.writeFileSync(file, js);
  console.log('Successfully wrote', file);
});
