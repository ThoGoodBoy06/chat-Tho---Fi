const fs = require('fs');

const files = [
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js'
];

for (const p of files) {
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Fix 1: ApiService.getMessages() safe parsing without t.P.a Map<String, dynamic> cast error
  const target1 = 'if(o.b===200){q=t.P.a(B.R.e1(0,A.f5(A.f4(o.e)).ce(0,o.w),null))';
  const replace1 = 'if(o.b===200){q=B.R.e1(0,A.f5(A.f4(o.e)).ce(0,o.w),null)';

  if (content.includes(target1)) {
    content = content.replace(target1, replace1);
    console.log(`[${p}] Fix 1 applied: getMessages safe JSON decode`);
  } else {
    console.warn(`[${p}] Target 1 not found!`);
  }

  // Fix 2: chat_provider selectConversation rawData safe extraction without t.kc.a List cast error
  const target2 = 'd=t.kc.a(J.Z(m,"data"))';
  const replace2 = 'd=(m!=null?J.Z(m,"data"):null)';

  if (content.includes(target2)) {
    content = content.replace(target2, replace2);
    console.log(`[${p}] Fix 2 applied: selectConversation data array extraction`);
  } else {
    console.warn(`[${p}] Target 2 not found!`);
  }

  // Fix 3: MessageModel mapper closure without strict argument type error
  const regex3 = /\$1\(a\)\{return A\.wf\(a\)\},\r?\n\$S:565\}/;
  if (regex3.test(content)) {
    content = content.replace(regex3, '$1(a){return A.wf(a)},\r\n$S:2}');
    console.log(`[${p}] Fix 3 applied: MessageModel mapper accepts dynamic object`);
  } else {
    console.warn(`[${p}] Target 3 not found!`);
  }

  fs.writeFileSync(p, content, 'utf8');
}

console.log("🎉 Done patching getMessages bundle!");
