const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping: ${file}`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. Patch deduplication to also recognize rt- prefix
  const targetPattern = /if\s*\(\s*B\.c\.bj\(a\.a,\s*"optimistic-"\)\s*\)\s*\{\s*s=this\.a/g;
  if (targetPattern.test(content)) {
    content = content.replace(targetPattern, 'if(B.c.bj(a.a,"optimistic-")||B.c.bj(a.a,"rt-")){s=this.a');
    modified = true;
    console.log(`[dedup] Patched optimistic/rt- deduplication in ${path.basename(file)}`);
  } else if (content.includes('rt-')) {
    console.log(`[dedup] Already contains rt- in ${path.basename(file)}`);
  } else {
    console.log(`[dedup] Target pattern not found in ${path.basename(file)}`);
  }

  // 2. Also ensure send_message transmits receiverId if available
  // In sendMessage: f.cn("send_message",A.V(["conversationId",e,"content",a4,"type",a2,"tempId",l,"senderId",a,"senderName",c,"replyMessageId",m],t.N,t.T))
  const sendTarget = /"replyMessageId",m\],t\.N,t\.T\)/g;
  if (sendTarget.test(content)) {
    // If n.c (conversation) has targetUserId (often field in n.c)
    // Keep it safe or check if needed
    console.log(`[send_message] found sendTarget in ${path.basename(file)}`);
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Saved ${file}`);
  }
});
