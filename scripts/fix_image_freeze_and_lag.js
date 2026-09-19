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
  console.log(`\n===> Optimizing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. In A.avr (normal file picker) - Use URL.createObjectURL for 0ms, 0-CPU instant preview
  const avrPattern = /var _isImg=!l\|\|l\.indexOf\("image"\)!==-1\|\|\(k&&k\.match\(\/\\\.\(jpg\|jpeg\|png\|gif\|webp\)\$\/i\)\);[\s\S]*?B\.b\.D\(q\.d\.d,_optMsg\);q\.d\.JF\(_optMsg\);q\.d\.V\(\);if\(q\.d\.cy!=null\)q\.d\.cy\.\$0\(\);[\s\S]*?\}catch\(_\)\{\}[\s\S]*?\}/;

  // Find the exact code block in a2L
  const oldAvrOpt = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
    'if(_isImg&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _b64="",_chunk=0x8000;\r\n' +
    'for(var _ci=0;_ci<n.length;_ci+=_chunk){\r\n' +
    '_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));\r\n' +
    '}\r\n' +
    'var _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}';
  const oldAvrOptLF = oldAvrOpt.replace(/\r\n/g, '\n');

  const fastAvrOpt = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
    'if(_isImg&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _fileObj=q.c;\r\n' +
    'var _dUrl=(window.URL&&window.URL.createObjectURL&&_fileObj instanceof Blob)?window.URL.createObjectURL(_fileObj):"";\r\n' +
    'if(!_dUrl){\r\n' +
    'try{var _b=new Blob([n],{type:l||"image/jpeg"});_dUrl=window.URL.createObjectURL(_b);}catch(_){_dUrl="data:"+(l||"image/jpeg")+";base64,";}\r\n' +
    '}\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}';

  if (content.includes(oldAvrOpt)) {
    content = content.replace(oldAvrOpt, fastAvrOpt);
    modified = true;
    console.log('  [+] Replaced slow base64 with instant Blob URL in A.avr (CRLF)');
  } else if (content.includes(oldAvrOptLF)) {
    content = content.replace(oldAvrOptLF, fastAvrOpt.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Replaced slow base64 with instant Blob URL in A.avr (LF)');
  }

  // 2. In A.av3 (camera capture) - Use URL.createObjectURL for 0ms instant preview
  const oldAv3Opt = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
    'if(_isImg&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _b64="",_chunk=0x8000;\r\n' +
    'for(var _ci=0;_ci<n.length;_ci+=_chunk){\r\n' +
    '_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));\r\n' +
    '}\r\n' +
    'var _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}';
  const oldAv3OptLF = oldAv3Opt.replace(/\r\n/g, '\n');

  const fastAv3Opt = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
    'if(_isImg&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _fileObj=q.c;\r\n' +
    'var _dUrl=(window.URL&&window.URL.createObjectURL&&_fileObj instanceof Blob)?window.URL.createObjectURL(_fileObj):"";\r\n' +
    'if(!_dUrl){\r\n' +
    'try{var _b=new Blob([n],{type:l||"image/jpeg"});_dUrl=window.URL.createObjectURL(_b);}catch(_){_dUrl="data:"+(l||"image/jpeg")+";base64,";}\r\n' +
    '}\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}';

  if (content.includes(oldAv3Opt)) {
    content = content.replace(oldAv3Opt, fastAv3Opt);
    modified = true;
    console.log('  [+] Replaced slow base64 with instant Blob URL in A.av3 (CRLF)');
  } else if (content.includes(oldAv3OptLF)) {
    content = content.replace(oldAv3OptLF, fastAv3Opt.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Replaced slow base64 with instant Blob URL in A.av3 (LF)');
  }

  // 3. In aaY - Native blob: rendering and base64 decode caching
  const oldB64DecodePattern = 'if(J.pX(s,e))try{q=B.b.ga5(J.a5C(s,","))\r\nr=B.kC.ci(q)}catch(i){p=A.a0(i)\r\nA.bE().$1("Base64 decode error: "+A.f(p))}else if(J.pX(s,"http")||J.pX(s,"/")){';
  const oldB64DecodePatternLF = oldB64DecodePattern.replace(/\r\n/g, '\n');

  const fastB64Decode = 'if(typeof s==="string"&&s.startsWith("blob:")){j=s;r=null;}\r\n' +
    'else if(J.pX(s,e)){\r\n' +
    'if(!window._b64Cache)window._b64Cache={};\r\n' +
    'if(window._b64Cache[s]){r=window._b64Cache[s];}\r\n' +
    'else{try{q=B.b.ga5(J.a5C(s,","));r=window._b64Cache[s]=B.kC.ci(q);}catch(i){r=null;}}\r\n' +
    '}else if(J.pX(s,"http")||J.pX(s,"/")){';

  if (content.includes(oldB64DecodePattern)) {
    content = content.replace(oldB64DecodePattern, fastB64Decode);
    modified = true;
    console.log('  [+] Patched aaY with native blob support & base64 caching (CRLF)');
  } else if (content.includes(oldB64DecodePatternLF)) {
    content = content.replace(oldB64DecodePatternLF, fastB64Decode.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched aaY with native blob support & base64 caching (LF)');
  }

  // 4. In A.auR - Don\'t open gallery if image is currently sending
  const oldAuR = 'A.auR.prototype={\r\n$0(){var _u=(this.a&&(this.a.url||this.a.u))||null;if(_u&&window.openImageModal){window.openImageModal(_u);return;}var s=this.b,r=s.c\r\nr.toString\r\nA.pW(new A.auO(this.a,s),r,t.z)},\r\n$S:0}';
  const oldAuRLF = oldAuR.replace(/\r\n/g, '\n');

  const safeAuR = 'A.auR.prototype={\r\n$0(){' +
    'if(this.a&&(this.a.status==="sending"||(this.a.a&&this.a.a.indexOf("optimistic-")===0)))return;\r\n' +
    'var _u=(this.a&&(this.a.url||this.a.u))||null;if(_u&&window.openImageModal){window.openImageModal(_u);return;}var s=this.b,r=s.c\r\nr.toString\r\nA.pW(new A.auO(this.a,s),r,t.z)},\r\n$S:0}';

  if (content.includes(oldAuR)) {
    content = content.replace(oldAuR, safeAuR);
    modified = true;
    console.log('  [+] Guarded A.auR against tap while sending (CRLF)');
  } else if (content.includes(oldAuRLF)) {
    content = content.replace(oldAuRLF, safeAuR.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Guarded A.auR against tap while sending (LF)');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [OK] Saved performance optimizations to ${filePath}`);
  } else {
    console.log(`  [-] No changes needed for ${filePath}`);
  }
});

// Also optimize public/webrtc_audio_helper.js: ignore long base64 strings in recordChatImage
const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

helperFiles.forEach(hPath => {
  if (!fs.existsSync(hPath)) return;
  let code = fs.readFileSync(hPath, 'utf8');
  let hMod = false;

  const oldRec = 'window.recordChatImage = function (url, convId) {\r\n    if (!url || typeof url !== \'string\') return;';
  const oldRecLF = 'window.recordChatImage = function (url, convId) {\n    if (!url || typeof url !== \'string\') return;';
  const fastRec = 'window.recordChatImage = function (url, convId) {\r\n    if (!url || typeof url !== \'string\' || url.length > 2000) return;';

  if (code.includes(oldRec)) {
    code = code.replace(oldRec, fastRec);
    hMod = true;
  } else if (code.includes(oldRecLF)) {
    code = code.replace(oldRecLF, fastRec.replace(/\r\n/g, '\n'));
    hMod = true;
  }

  // Also in addUrl inside openAlbumGalleryModal, ignore giant base64 strings
  const oldAddUrl = 'function addUrl(u) {\r\n        if (!u || typeof u !== \'string\') return;';
  const oldAddUrlLF = 'function addUrl(u) {\n        if (!u || typeof u !== \'string\') return;';
  const fastAddUrl = 'function addUrl(u) {\r\n        if (!u || typeof u !== \'string\' || (u.startsWith(\'data:\') && u.length > 5000)) return;';

  if (code.includes(oldAddUrl)) {
    code = code.replace(oldAddUrl, fastAddUrl);
    hMod = true;
  } else if (code.includes(oldAddUrlLF)) {
    code = code.replace(oldAddUrlLF, fastAddUrl.replace(/\r\n/g, '\n'));
    hMod = true;
  }

  if (hMod) {
    fs.writeFileSync(hPath, code, 'utf8');
    console.log(`  [OK] Guarded gallery against large base64 strings in ${hPath}`);
  }
});

console.log('\nAll performance patches successfully applied!');
