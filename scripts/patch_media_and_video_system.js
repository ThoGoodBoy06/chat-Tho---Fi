const fs = require('fs');

console.log('🚀 Bắt đầu patch chính xác với hỗ trợ cả CRLF và LF...');

const jsPaths = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsPaths.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let modified = false;

  // A. Add A.aVidTap closure class if not present
  if (!js.includes('A.aVidTap=')) {
    const tapDef = 'A.aVidTap=function aVidTap(a){this.a=a};\r\nA.aVidTap.prototype={$0(){if(window.openVideoModal)window.openVideoModal(this.a);else window.open(this.a,"_blank")},$S:0};\r\n';
    const target = 'A.auR.prototype={';
    if (js.includes(target)) {
      js = js.replace(target, tapDef + target);
      modified = true;
      console.log(`  [${p}] Added A.aVidTap closure class`);
    }
  }

  // B. Patch alV file picker accept
  const alVMatches = [
    's.accept="image/*"\r\ns.click()\r\nA.dJ(s,"change",new A.avs(this,s,r,a),!1)',
    's.accept="image/*"\ns.click()\nA.dJ(s,"change",new A.avs(this,s,r,a),!1)'
  ];
  for (const target of alVMatches) {
    if (js.includes(target)) {
      const repl = target.replace('s.accept="image/*"', 's.accept="image/*,video/*"');
      js = js.replace(target, repl);
      modified = true;
      console.log(`  [${p}] Patched alV file input accept="image/*,video/*"`);
      break;
    }
  }

  // C & D. Patch a2L and a2K (FileReader Uint8Array safe extraction)
  const a2PatternCRLF = 'case 0:l=q.a\r\nk=t.F\r\ns=k.b(B.cc.gks(l))?2:3\r\nbreak\r\ncase 2:n=k.a(B.cc.gks(l))\r\nl=q.c\r\nk=l.name\r\nk.toString\r\nl=l.type\r\nl.toString\r\ns=4\r\nreturn A.m(A.q3(q.b.a,n,k,l),$async$$1)';
  const a2ReplCRLF = 'case 0:l=q.a\r\nvar _raw=l.result||B.cc.gks(l)\r\nvar _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))\r\nn=_u8\r\nl=q.c\r\nk=l.name||"file"\r\nl=l.type||""\r\ns=4\r\nreturn A.m(A.q3(q.b.a,n,k,l),$async$$1)';

  const a2PatternLF = 'case 0:l=q.a\nk=t.F\ns=k.b(B.cc.gks(l))?2:3\nbreak\ncase 2:n=k.a(B.cc.gks(l))\nl=q.c\nk=l.name\nk.toString\nl=l.type\nl.toString\ns=4\nreturn A.m(A.q3(q.b.a,n,k,l),$async$$1)';
  const a2ReplLF = 'case 0:l=q.a\nvar _raw=l.result||B.cc.gks(l)\nvar _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))\nn=_u8\nl=q.c\nk=l.name||"file"\nl=l.type||""\ns=4\nreturn A.m(A.q3(q.b.a,n,k,l),$async$$1)';

  let a2Count = 0;
  while (js.includes(a2PatternCRLF)) {
    js = js.replace(a2PatternCRLF, a2ReplCRLF);
    a2Count++;
    modified = true;
  }
  while (js.includes(a2PatternLF)) {
    js = js.replace(a2PatternLF, a2ReplLF);
    a2Count++;
    modified = true;
  }
  if (a2Count > 0) {
    console.log(`  [${p}] Patched ${a2Count} FileReader safe extraction handlers (a2L, a2K)`);
  }

  // E. Patch aaY(a, b) to render video messages with interactive modal trigger
  const aaYPatternCRLF = 'aaY(a,b){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e="data:image",d=null,c={}\r\nif(a.y)return B.axj\r\ns=a.e\r\no=a.d\r\nif(o!=="image")if(!J.pX(s,e)){n=a.f\r\nn=n!=null&&n.length!==0\r\nm=n}else m=!0\r\nelse m=!0\r\nl=o==="audio"||J.pX(s,"data:audio")\r\nk=o==="missed_call"||o==="call"';
  const aaYReplCRLF = 'aaY(a,b){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e="data:image",d=null,c={}\r\nif(a.y)return B.axj\r\ns=a.e\r\no=a.d\r\nvar _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1));\r\nif(_isVid){\r\nvar _vUrl=a.videoUrl||a.f||s||"";\r\nvar _vIcon=A.bV(B.aaN,b?B.f:B.a1,d,22);\r\nvar _vText=A.a2("▶ Xem video",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);\r\nvar _vRow=A.b9(A.b([_vIcon,B.aT,new A.eT(1,B.bv,_vText,d)],t.p),B.l,B.m,B.G);\r\nreturn A.dr(d,_vRow,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);\r\n}\r\nif(o!=="image")if(!J.pX(s,e)){n=a.f\r\nn=n!=null&&n.length!==0\r\nm=n}else m=!0\r\nelse m=!0\r\nl=o==="audio"||J.pX(s,"data:audio")\r\nk=o==="missed_call"||o==="call"';

  const aaYPatternLF = 'aaY(a,b){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e="data:image",d=null,c={}\nif(a.y)return B.axj\ns=a.e\no=a.d\nif(o!=="image")if(!J.pX(s,e)){n=a.f\nn=n!=null&&n.length!==0\nm=n}else m=!0\nelse m=!0\nl=o==="audio"||J.pX(s,"data:audio")\nk=o==="missed_call"||o==="call"';
  const aaYReplLF = 'aaY(a,b){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e="data:image",d=null,c={}\nif(a.y)return B.axj\ns=a.e\no=a.d\nvar _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1));\nif(_isVid){\nvar _vUrl=a.videoUrl||a.f||s||"";\nvar _vIcon=A.bV(B.aaN,b?B.f:B.a1,d,22);\nvar _vText=A.a2("▶ Xem video",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);\nvar _vRow=A.b9(A.b([_vIcon,B.aT,new A.eT(1,B.bv,_vText,d)],t.p),B.l,B.m,B.G);\nreturn A.dr(d,_vRow,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);\n}\nif(o!=="image")if(!J.pX(s,e)){n=a.f\nn=n!=null&&n.length!==0\nm=n}else m=!0\nelse m=!0\nl=o==="audio"||J.pX(s,"data:audio")\nk=o==="missed_call"||o==="call"';

  if (js.includes(aaYPatternCRLF)) {
    js = js.replace(aaYPatternCRLF, aaYReplCRLF);
    modified = true;
    console.log(`  [${p}] Patched aaY (CRLF) for video messages and interactive player`);
  } else if (js.includes(aaYPatternLF)) {
    js = js.replace(aaYPatternLF, aaYReplLF);
    modified = true;
    console.log(`  [${p}] Patched aaY (LF) for video messages and interactive player`);
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Saved ${p} successfully!`);
  }
});

// Also copy patched public/main.dart.js to backend/public/main.dart.js
fs.copyFileSync('public/main.dart.js', 'backend/public/main.dart.js');
console.log('✅ Synced public/main.dart.js to backend/public/main.dart.js');

console.log('🏁 Hoàn thành patch toàn bộ!');
