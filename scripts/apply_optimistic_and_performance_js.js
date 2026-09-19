const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Patch aaZ(a,b,c) to handle error retry and sending indicator
  const oldAaZPattern = 'aaZ(a,b,c){var s,r,q,p,o,n,m=null,l={}\r\nif(!c)return B.au\r\nif(!a.w)';
  const oldAaZPatternLF = 'aaZ(a,b,c){var s,r,q,p,o,n,m=null,l={}\nif(!c)return B.au\nif(!a.w)';

  const newAaZ = 'aaZ(a,b,c){var s,r,q,p,o,n,m=null,l={}\r\n' +
    'if(a.status==="error"){return A.a5(m,A.bV(B.iA,B.f,m,10),B.h,m,m,new A.ak(new A.q(4293204277),m,m,m,m,m,B.a8),m,14,B.i6,m,m,m,14)}\r\n' +
    'if(a.status==="sending"||(a.a&&(a.a.indexOf("temp_")===0||a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0))){return A.a5(m,A.bV(B.rw,B.aC,m,10),B.h,m,m,new A.ak(m,m,A.dx(B.aC,1.2),m,m,m,B.a8),m,14,B.i6,m,m,m,14)}\r\n' +
    'if(!c)return B.au\r\nif(!a.w)';

  if (content.includes(oldAaZPattern)) {
    content = content.replace(oldAaZPattern, newAaZ);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched aaZ (CRLF) with error & sending indicators`);
  } else if (content.includes(oldAaZPatternLF)) {
    content = content.replace(oldAaZPatternLF, newAaZ.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched aaZ (LF) with error & sending indicators`);
  }

  // 2. Patch sendMessage optimistic creation, clientTempId, and 8s timeout
  const oldSendPattern = 'l="optimistic-"+Date.now()\r\nf=n.c.a\r\ne=n.a\r\ne=e==null?null:e.a\r\nd=new A.k1(l,f,e,a2,a4,null,null,!1,!1,!1,m,B.akQ,new A.dN(Date.now(),!1))\r\nB.b.D(n.d,d)\r\nn.JF(d)\r\nn.V()';
  const oldSendPatternLF = 'l="optimistic-"+Date.now()\nf=n.c.a\ne=n.a\ne=e==null?null:e.a\nd=new A.k1(l,f,e,a2,a4,null,null,!1,!1,!1,m,B.akQ,new A.dN(Date.now(),!1))\nB.b.D(n.d,d)\nn.JF(d)\nn.V()';

  const newSend = 'l="temp_"+Date.now()\r\nf=n.c.a\r\ne=n.a\r\ne=e==null?null:e.a\r\nd=new A.k1(l,f,e,a2,a4,null,null,!1,!1,!1,m,B.akQ,new A.dN(Date.now(),!1))\r\nd.status="sending";d.clientTempId=l;\r\n(function(msg,prov){setTimeout(function(){if(msg&&msg.status==="sending"){msg.status="error";prov.V();}},8000);})(d,n);\r\nB.b.D(n.d,d)\r\nn.JF(d)\r\nn.V()';

  if (content.includes(oldSendPattern)) {
    content = content.replace(oldSendPattern, newSend);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched sendMessage optimistic creation (CRLF)`);
  } else if (content.includes(oldSendPatternLF)) {
    content = content.replace(oldSendPatternLF, newSend.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched sendMessage optimistic creation (LF)`);
  }

  // 3. Ensure send_message socket emit transmits clientTempId
  const oldEmitPattern = '"tempId",l,"senderId",a';
  const newEmitPattern = '"tempId",l,"clientTempId",l,"senderId",a';
  if (content.includes(oldEmitPattern)) {
    content = content.replace(oldEmitPattern, newEmitPattern);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched socket emit with clientTempId`);
  }

  // 4. In case 7 (success) and case 4 (error), update status and clientTempId
  const oldCase7 = 'if(j!=null){i=A.wf(j)\r\nh=B.b.h3(n.d,new A.a80(l))\r\nif(!J.e(h,-1))n.d[h]=i\r\nelse if(!B.b.iY(n.d,new A.a81(i)))B.b.D(n.d,i)\r\nn.JF(i)\r\nn.V()}';
  const oldCase7LF = 'if(j!=null){i=A.wf(j)\nh=B.b.h3(n.d,new A.a80(l))\nif(!J.e(h,-1))n.d[h]=i\nelse if(!B.b.iY(n.d,new A.a81(i)))B.b.D(n.d,i)\nn.JF(i)\nn.V()}';

  const newCase7 = 'if(j!=null){i=A.wf(j);i.status="sent";i.clientTempId=l;\r\nh=B.b.h3(n.d,new A.a80(l));\r\nif(h===-1){for(var _di=0;_di<n.d.length;_di++){if(n.d[_di]&&(n.d[_di].a===l||n.d[_di].clientTempId===l)){h=_di;break;}}}\r\nif(!J.e(h,-1))n.d[h]=i;\r\nelse if(!B.b.iY(n.d,new A.a81(i)))B.b.D(n.d,i);\r\nn.JF(i);\r\nn.V()}';

  if (content.includes(oldCase7)) {
    content = content.replace(oldCase7, newCase7);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched case 7 ack resolution (CRLF)`);
  } else if (content.includes(oldCase7LF)) {
    content = content.replace(oldCase7LF, newCase7.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched case 7 ack resolution (LF)`);
  }

  // 5. In case 4 (error handling)
  const oldCase4 = 'case 4:p=3\r\na3=o\r\ng=A.a0(a3)\r\nA.bE().$1("Error sending message: "+A.f(g))\r\ns=6';
  const oldCase4LF = 'case 4:p=3\na3=o\ng=A.a0(a3)\nA.bE().$1("Error sending message: "+A.f(g))\ns=6';

  const newCase4 = 'case 4:p=3\r\na3=o\r\ng=A.a0(a3)\r\nA.bE().$1("Error sending message: "+A.f(g))\r\nfor(var _di=0;_di<n.d.length;_di++){if(n.d[_di]&&(n.d[_di].a===l||n.d[_di].clientTempId===l)&&n.d[_di].status==="sending"){n.d[_di].status="error";n.V();break;}}\r\ns=6';

  if (content.includes(oldCase4)) {
    content = content.replace(oldCase4, newCase4);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched case 4 error transition (CRLF)`);
  } else if (content.includes(oldCase4LF)) {
    content = content.replace(oldCase4LF, newCase4.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched case 4 error transition (LF)`);
  }

  // 6. Deduplication patch in A.a7R.prototype
  const oldDedup = 'if(B.c.bj(a.a,"optimistic-")||B.c.bj(a.a,"rt-")){s=this.a';
  const newDedup = 'if(B.c.bj(a.a,"optimistic-")||B.c.bj(a.a,"rt-")||B.c.bj(a.a,"temp_")||(this.a&&this.a.clientTempId&&a.clientTempId===this.a.clientTempId)){s=this.a';
  if (content.includes(oldDedup)) {
    content = content.replace(oldDedup, newDedup);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Patched deduplication with temp_ & clientTempId`);
  }

  // 7. _isSending check in video/image preview
  const oldIsSending = 'var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);';
  const newIsSending = 'var _isSending=a.status==="sending"||(a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0||a.a.indexOf("temp_")===0));';
  while (content.includes(oldIsSending)) {
    content = content.replace(oldIsSending, newIsSending);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 Saved changes to ${filePath}`);
  }
});

console.log('🎉 Done patching JS bundles for Optimistic UI & CanvasKit Performance!');
