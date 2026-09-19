const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js')
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n===> Patching: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Enable multiple file selection on file input
  if (content.includes('s.accept="image/*,video/*"')) {
    content = content.replace('s.accept="image/*,video/*"', 's.accept="image/*,video/*";s.multiple=true');
    modified = true;
    console.log('  [+] Enabled s.multiple=true in file picker');
  }

  // 2. Patch A.avs.prototype to handle multiple files
  const avsOldPattern = 'A.avs.prototype={\r\n$1(a){var s,r,q,p=this,o=p.b.files\r\nif(o!=null&&!B.fA.gaf(o)){s=o[0]';
  const avsOldPatternLF = 'A.avs.prototype={\n$1(a){var s,r,q,p=this,o=p.b.files\nif(o!=null&&!B.fA.gaf(o)){s=o[0]';

  const avsNew = 'A.avs.prototype={\r\n$1(a){var s,r,q,p=this,o=p.b.files\r\n' +
    'if(o!=null&&!B.fA.gaf(o)){\r\n' +
    'for(var _fi=0;_fi<o.length;_fi++){\r\n' +
    '(function(file){\r\n' +
    'var r=p.a.c.Y(t.q);r.toString;r.f.bA(B.Dz);\r\n' +
    'var q=new FileReader();q.readAsArrayBuffer(file);\r\n' +
    'A.dJ(q,"loadend",new A.avr(q,p.c,file,p.d),!1);\r\n' +
    '})(o[_fi]);\r\n' +
    '}\r\n' +
    'return;\r\n' +
    's=o[0]';

  if (content.includes(avsOldPattern)) {
    content = content.replace(avsOldPattern, avsNew);
    modified = true;
    console.log('  [+] Patched A.avs.prototype (CRLF) for multi-file support');
  } else if (content.includes(avsOldPatternLF)) {
    content = content.replace(avsOldPatternLF, avsNew.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched A.avs.prototype (LF) for multi-file support');
  }

  // 3. Patch A.avr.prototype (a2L) for Optimistic UI creation and resolution
  // Find the exact image optimistic block in a2L
  const imgOptSearch = 'var _optId="optimistic-"+Date.now();\r\nvar _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));\r\nif(_isVidSend&&n.length>0){\r\ntry{\r\nvar _optMsg=A.wf({id:_optId,conversationId:q.b.a,content:"video",videoUrl:"",type:"video",createdAt:new Date().toISOString()});\r\nq.d.vZ(_optMsg);\r\n}catch(_){}\r\n}\r\nvar _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\nif(_isImg&&n.length>0){\r\ntry{\r\nvar _b64="",_chunk=0x8000;\r\nfor(var _ci=0;_ci<n.length;_ci+=_chunk){\r\n_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));\r\n}\r\nvar _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);\r\nvar _optMsg=A.wf({id:_optId,conversationId:q.b.a,content:_dUrl,imageUrl:_dUrl,type:"image",createdAt:new Date().toISOString()});\r\nq.d.vZ(_optMsg);\r\n}catch(_){}\r\n}';
  const imgOptSearchLF = imgOptSearch.replace(/\r\n/g, '\n');

  const imgOptReplacement = 'var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);\r\n' +
    'var _myUid=(q.d&&q.d.a)?q.d.a.a:null;\r\n' +
    'var _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));\r\n' +
    'if(_isVidSend&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"video","video","",null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}\r\n' +
    'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
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

  if (content.includes(imgOptSearch)) {
    content = content.replace(imgOptSearch, imgOptReplacement);
    modified = true;
    console.log('  [+] Patched A.avr.prototype optimistic creation (CRLF)');
  } else if (content.includes(imgOptSearchLF)) {
    content = content.replace(imgOptSearchLF, imgOptReplacement.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched A.avr.prototype optimistic creation (LF)');
  }

  // 4. Patch A.av3.prototype (camera capture)
  const av3Search = 'var _optId="optimistic-"+Date.now();\r\nvar _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\nif(_isImg&&n.length>0){\r\ntry{\r\nvar _b64="",_chunk=0x8000;\r\nfor(var _ci=0;_ci<n.length;_ci+=_chunk){\r\n_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));\r\n}\r\nvar _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);\r\nvar _optMsg=A.wf({id:_optId,conversationId:q.b.a,content:_dUrl,imageUrl:_dUrl,type:"image",createdAt:new Date().toISOString()});\r\nq.d.vZ(_optMsg);\r\n}catch(_){}\r\n}';
  const av3SearchLF = av3Search.replace(/\r\n/g, '\n');

  const av3Replacement = 'var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);\r\n' +
    'var _myUid=(q.d&&q.d.a)?q.d.a.a:null;\r\n' +
    'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
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

  if (content.includes(av3Search)) {
    content = content.replace(av3Search, av3Replacement);
    modified = true;
    console.log('  [+] Patched A.av3.prototype camera optimistic creation (CRLF)');
  } else if (content.includes(av3SearchLF)) {
    content = content.replace(av3SearchLF, av3Replacement.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched A.av3.prototype camera optimistic creation (LF)');
  }

  // 5. Patch single image overlay in aaY to Messenger central dark circle + white spinner
  const oldAaYOverlay = 'var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);\r\nif(_isSending){\r\nvar _shade=A.a5(d,d,d,d,d,new A.ak(new A.q(1879048192),d,d,d,d,d,B.t),d,d,d,d,d,d,d);\r\nvar _spinIcon=A.bV(B.rw,B.f,d,20);\r\nvar _lbl=A.a2("Đang gửi...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);\r\nvar _pillContent=A.b9(A.b([_spinIcon,B.aT,_lbl],t.p),B.l,B.m,B.G);\r\nvar _pill=A.a5(d,_pillContent,B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(18),d,d,B.t),d,new A.dL(A.ag(7),d,A.ag(13),A.ag(7)),d,d,d,d,d);\r\no=A.dt(B.h,A.b([o,_shade,_pill],t.p),B.r,B.ap);\r\n}';
  const oldAaYOverlayLF = oldAaYOverlay.replace(/\r\n/g, '\n');

  // Messenger-style: Center disc 56x56 px with dark circle 0x78000000 (alpha 0.47) and white circular spinner 28px
  const newAaYOverlay = 'var _isSending=a.status==="sending"||(a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0||a.a.indexOf("temp_")===0));\r\n' +
    'if(_isSending){\r\n' +
    'var _shade=A.a5(d,d,d,d,d,new A.ak(new A.q(805306368),d,d,d,d,d,B.t),d,d,d,d,d,d,d);\r\n' +
    'var _spinIcon=A.bV(B.rw,B.f,d,28);\r\n' +
    'var _centerCircle=A.a5(d,_spinIcon,B.h,d,d,new A.ak(new A.q(2013265920),d,d,A.ag(28),d,d,B.t),d,56,d,d,d,d,56);\r\n' +
    'o=A.dt(B.h,A.b([o,_shade,_centerCircle],t.p),B.r,B.ap);\r\n' +
    '}';

  if (content.includes(oldAaYOverlay)) {
    content = content.replace(oldAaYOverlay, newAaYOverlay);
    modified = true;
    console.log('  [+] Patched aaY sending overlay to Messenger dark circle (CRLF)');
  } else if (content.includes(oldAaYOverlayLF)) {
    content = content.replace(oldAaYOverlayLF, newAaYOverlay.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched aaY sending overlay to Messenger dark circle (LF)');
  }

  // 6. Patch makeCardImg in collage layouts to also use central dark circle
  const oldCollageSending = 'if (isSending) {\n      var _spin = A.bV(B.rw, B.f, null, 26);\n      var _shade = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(1879048192), null, null, null, null, null, B.t), null, w, null, null, null, null, h);\n      return A.dt(B.aF, A.b([cellImg, _shade], t.p), B.r, B.ap);\n    }';
  const oldCollageSendingCRLF = oldCollageSending.replace(/\n/g, '\r\n');

  const newCollageSending = 'if (isSending) {\r\n' +
    '      var _spin = A.bV(B.rw, B.f, null, 26);\r\n' +
    '      var _centerCircle = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(2013265920), null, null, A.ag(26), null, null, B.t), null, 52, null, null, null, null, 52);\r\n' +
    '      var _shade = A.a5(null, _centerCircle, B.h, null, null, new A.ak(new A.q(805306368), null, null, null, null, null, B.t), null, w, null, null, null, null, h);\r\n' +
    '      return A.dt(B.aF, A.b([cellImg, _shade], t.p), B.r, B.ap);\r\n' +
    '    }';

  if (content.includes(oldCollageSending)) {
    content = content.replace(oldCollageSending, newCollageSending.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched makeCardImg collage sending overlay (LF)');
  } else if (content.includes(oldCollageSendingCRLF)) {
    content = content.replace(oldCollageSendingCRLF, newCollageSending);
    modified = true;
    console.log('  [+] Patched makeCardImg collage sending overlay (CRLF)');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [OK] Saved changes to ${filePath}`);
  } else {
    console.log(`  [-] No changes needed for ${filePath}`);
  }
});

console.log('\nFinished patching Messenger Optimistic UI!');
