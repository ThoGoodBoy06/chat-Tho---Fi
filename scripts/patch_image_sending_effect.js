const fs = require('fs');

console.log('🚀 Bắt đầu áp dụng hiệu ứng Đang gửi ảnh (Optimistic Preview + Loading Overlay)...');

const jsPaths = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsPaths.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let modified = false;

  // 1. Patch a2L and a2K (generate optimistic image preview before upload, replace after)
  const a2OldPatternCRLF = 'case 0:l=q.a\r\nvar _raw=l.result||B.cc.gks(l)\r\nvar _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))\r\nn=_u8\r\nl=q.c\r\nk=l.name||"file"\r\nl=l.type||""\r\ns=4\r\nreturn A.m(A.q3(q.b.a,n,k,l),$async$1)\r\ncase 4:p=c\r\nif(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{o=A.wf(J.Z(p,"data"))\r\nq.d.vZ(o)}catch(j){}case 3:return A.v(null,r)';

  const a2NewPatternCRLF = 'case 0:l=q.a\r\nvar _raw=l.result||B.cc.gks(l)\r\nvar _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))\r\nn=_u8\r\nl=q.c\r\nk=l.name||"file"\r\nl=l.type||""\r\nvar _optId="optimistic-"+Date.now();\r\nvar _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\nif(_isImg&&n.length>0){\r\ntry{\r\nvar _b64="",_chunk=0x8000;\r\nfor(var _ci=0;_ci<n.length;_ci+=_chunk){\r\n_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));\r\n}\r\nvar _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);\r\nvar _optMsg=A.wf({id:_optId,conversationId:q.b.a,content:_dUrl,imageUrl:_dUrl,type:"image",createdAt:new Date().toISOString()});\r\nq.d.vZ(_optMsg);\r\n}catch(_){}\r\n}\r\ns=4\r\nreturn A.m(A.q3(q.b.a,n,k,l),$async$$1)\r\ncase 4:p=c\r\nif(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\no=A.wf(J.Z(p,"data"));\r\nvar _msgs=q.d.d,_found=!1;\r\nif(_msgs&&_msgs.length){\r\nfor(var _i=0;_i<_msgs.length;_i++){\r\nif(_msgs[_i]&&_msgs[_i].a===_optId){_msgs[_i]=o;_found=!0;break;}\r\n}\r\n}\r\nif(!_found)q.d.vZ(o);\r\nelse q.d.V();\r\n}catch(j){}\r\nelse{\r\ntry{\r\nvar _msgs=q.d.d;\r\nif(_msgs&&_msgs.length){\r\nfor(var _i=0;_i<_msgs.length;_i++){\r\nif(_msgs[_i]&&_msgs[_i].a===_optId){_msgs.splice(_i,1);break;}\r\n}\r\nq.d.V();\r\n}\r\n}catch(_){}\r\n}\r\ncase 3:return A.v(null,r)';

  const a2OldPatternLF = a2OldPatternCRLF.replace(/\r\n/g, '\n');
  const a2NewPatternLF = a2NewPatternCRLF.replace(/\r\n/g, '\n');

  let a2Count = 0;
  while (js.includes(a2OldPatternCRLF)) {
    js = js.replace(a2OldPatternCRLF, () => a2NewPatternCRLF);
    a2Count++;
    modified = true;
  }
  while (js.includes(a2OldPatternLF)) {
    js = js.replace(a2OldPatternLF, () => a2NewPatternLF);
    a2Count++;
    modified = true;
  }
  if (a2Count > 0) {
    console.log(`  [${p}] Patched ${a2Count} upload handlers with instant optimistic preview & replacement`);
  }

  // 2. Check if aaY already patched
  if (!js.includes('_isSending')) {
    const aaYOldTarget = 'if(r!=null)o=c.a=new A.mD(A.aLD(d,d,new A.oH(r,1)),new A.auP(),d,d,B.cp,B.e8,d)\r\nelse if(j!=null&&j.length!==0){h=new A.mD(A.aLD(d,d,new A.eY(j,1,d)),new A.auQ(),d,d,B.cp,B.e8,d)\r\nc.a=h\r\no=h}else{c.a=B.yF\r\no=B.yF}return A.dr(d,A.aP5(A.ag(12),A.a5(d,o,B.h,d,B.FH,d,d,d,d,d,d,d,d))';

    const aaYNewTarget = 'if(r!=null)o=c.a=new A.mD(A.aLD(d,d,new A.oH(r,1)),new A.auP(),d,d,B.cp,B.e8,d)\r\nelse if(j!=null&&j.length!==0){h=new A.mD(A.aLD(d,d,new A.eY(j,1,d)),new A.auQ(),d,d,B.cp,B.e8,d)\r\nc.a=h\r\no=h}else{c.a=B.yF\r\no=B.yF}\r\nvar _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);\r\nif(_isSending){\r\nvar _shade=A.a5(d,d,d,d,d,new A.ak(new A.q(1879048192),d,d,d,d,d,B.t),d,d,d,d,d,d,d);\r\nvar _spinIcon=A.bV(B.rw,B.f,d,20);\r\nvar _lbl=A.a2("Đang gửi...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);\r\nvar _pillContent=A.b9(A.b([_spinIcon,B.aT,_lbl],t.p),B.l,B.m,B.G);\r\nvar _pill=A.a5(d,_pillContent,B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(18),d,d,B.t),d,new A.dL(A.ag(7),d,A.ag(13),A.ag(7)),d,d,d,d,d);\r\no=A.dt(B.h,A.b([o,_shade,_pill],t.p),B.r,B.ap);\r\n}\r\nreturn A.dr(d,A.aP5(A.ag(12),A.a5(d,o,B.h,d,B.FH,d,d,d,d,d,d,d,d))';

    const aaYOldTargetLF = aaYOldTarget.replace(/\r\n/g, '\n');
    const aaYNewTargetLF = aaYNewTarget.replace(/\r\n/g, '\n');

    if (js.includes(aaYOldTarget)) {
      js = js.replace(aaYOldTarget, () => aaYNewTarget);
      modified = true;
      console.log(`  [${p}] Patched aaY (CRLF) with visual loading overlay and sending indicator`);
    } else if (js.includes(aaYOldTargetLF)) {
      js = js.replace(aaYOldTargetLF, () => aaYNewTargetLF);
      modified = true;
      console.log(`  [${p}] Patched aaY (LF) with visual loading overlay and sending indicator`);
    }
  } else {
    console.log(`  [${p}] aaY already has _isSending overlay logic`);
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Saved ${p} successfully!`);
  }
});

// Also sync to backend/public/main.dart.js
fs.copyFileSync('public/main.dart.js', 'backend/public/main.dart.js');
console.log('✅ Synced public/main.dart.js to backend/public/main.dart.js');

// Update cache bust version in all 6 index.html files
const indexHtmlPaths = [
  'public/index.html',
  'flutter_frontend/web/index.html',
  'flutter_frontend/build/web/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

const newVersion = '20260917_sendload_' + Date.now();
indexHtmlPaths.forEach(p => {
  if (fs.existsSync(p)) {
    let html = fs.readFileSync(p, 'utf8');
    html = html.replace(/webrtc_audio_helper\.js(\?v=[^"']*)?/g, 'webrtc_audio_helper.js?v=' + newVersion);
    html = html.replace(/main\.dart\.js(\?v=[^"']*)?/g, 'main.dart.js?v=' + newVersion);
    fs.writeFileSync(p, html, 'utf8');
  }
});
console.log('✅ Updated cache bust version to ' + newVersion);

console.log('🏁 Hoàn tất patch hiệu ứng đang gửi ảnh!');
