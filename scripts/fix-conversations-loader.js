const fs = require('fs');
const path = require('path');

const files = [
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js'
];

for (const p of files) {
  if (!fs.existsSync(p)) continue;
  let content = fs.readFileSync(p, 'utf8');

  // Fix 1: ApiService.getConversations() return list
  // Target: if(t.P.b(m)&&t.j.b(J.Z(m,"data"))){k=t.j.a(J.Z(m,"data"))
  // Replace: if(m!=null&&t.j.b(J.Z(m,"data"))){k=t.j.a(J.Z(m,"data"))
  const target1 = 'if(t.P.b(m)&&t.j.b(J.Z(m,"data"))){k=t.j.a(J.Z(m,"data"))';
  const replace1 = 'if(m!=null&&t.j.b(J.Z(m,"data"))){k=t.j.a(J.Z(m,"data"))';

  if (content.includes(target1)) {
    content = content.replace(target1, replace1);
    console.log(`[${p}] Fix 1 applied: ApiService.getConversations array extraction`);
  } else {
    console.warn(`[${p}] Target 1 not found!`);
  }

  // Fix 2: ConversationModel.fromJson Conversations unnesting
  // Target: c2=c1.b(c0.h(c3,a5))?c1.a(c0.h(c3,a5)):c3
  // Replace: c2=c0.h(c3,a5)!=null?c0.h(c3,a5):c3
  const target2 = 'c2=c1.b(c0.h(c3,a5))?c1.a(c0.h(c3,a5)):c3';
  const replace2 = 'c2=c0.h(c3,a5)!=null?c0.h(c3,a5):c3';

  if (content.includes(target2)) {
    content = content.replace(target2, replace2);
    console.log(`[${p}] Fix 2 applied: ConversationModel.fromJson Conversations extraction`);
  }

  // Fix 3: ConversationModel mapper closure signature from 564 to 2 (accept dynamic object)
  const target3_1 = 'A.a7U.prototype={\r\n$1(a){var s=this.a.a\r\nreturn A.aPa(a,s==null?null:s.a)},\r\n$S:564}';
  const target3_2 = 'A.a7U.prototype={\n$1(a){var s=this.a.a\nreturn A.aPa(a,s==null?null:s.a)},\n$S:564}';
  const replace3 = 'A.a7U.prototype={\r\n$1(a){var s=this.a.a\r\nreturn A.aPa(a,s==null?null:s.a)},\r\n$S:2}';

  if (content.includes(target3_1)) {
    content = content.replace(target3_1, replace3);
    console.log(`[${p}] Fix 3 applied (CRLF): ConversationModel mapper accepts dynamic object`);
  } else if (content.includes(target3_2)) {
    content = content.replace(target3_2, replace3);
    console.log(`[${p}] Fix 3 applied (LF): ConversationModel mapper accepts dynamic object`);
  } else {
    console.warn(`[${p}] Target 3 not found or already applied!`);
  }

  fs.writeFileSync(p, content, 'utf8');
}

console.log("🎉 Done patching conversation loader bugs!");
