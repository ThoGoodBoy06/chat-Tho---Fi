const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping non-existent file: ${filePath}`);
    return;
  }
  console.log(`\n========================================`);
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Enable multiple = true in file picker input
  const oldAcceptCRLF = 's=A.Q1("file")\r\ns.accept="image/*,video/*"\r\ns.click()';
  const oldAcceptLF = 's=A.Q1("file")\ns.accept="image/*,video/*"\ns.click()';
  const newAcceptCRLF = 's=A.Q1("file")\r\ns.accept="image/*,video/*"\r\ns.multiple=true\r\ns.click()';

  if (content.includes(oldAcceptCRLF)) {
    content = content.replace(oldAcceptCRLF, newAcceptCRLF);
    modified = true;
    console.log(`  [OK] Added s.multiple=true (CRLF)`);
  } else if (content.includes(oldAcceptLF)) {
    content = content.replace(oldAcceptLF, newAcceptCRLF.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [OK] Added s.multiple=true (LF)`);
  }

  // 2. Loop through all files in A.avs
  const oldAvsCRLF = 'if(o!=null&&!B.fA.gaf(o)){s=o[0]\r\nr=p.a.c.Y(t.q)\r\nr.toString\r\nr.f.bA(B.Dz)\r\nq=new FileReader()\r\nq.readAsArrayBuffer(s)\r\nA.dJ(q,"loadend",new A.avr(q,p.c,s,p.d),!1)}';
  const oldAvsLF = 'if(o!=null&&!B.fA.gaf(o)){s=o[0]\nr=p.a.c.Y(t.q)\nr.toString\nr.f.bA(B.Dz)\nq=new FileReader()\nq.readAsArrayBuffer(s)\nA.dJ(q,"loadend",new A.avr(q,p.c,s,p.d),!1)}';

  const newAvsCRLF = 'if(o!=null&&!B.fA.gaf(o)){\r\n' +
    '  r=p.a.c.Y(t.q)\r\n  r.toString\r\n  r.f.bA(B.Dz)\r\n' +
    '  for(var _fi=0;_fi<o.length;_fi++){\r\n' +
    '    (function(sFile){\r\n' +
    '      var q=new FileReader();\r\n' +
    '      q.readAsArrayBuffer(sFile);\r\n' +
    '      A.dJ(q,"loadend",new A.avr(q,p.c,sFile,p.d),!1);\r\n' +
    '    })(o[_fi]);\r\n' +
    '  }\r\n' +
    '}';

  if (content.includes(oldAvsCRLF)) {
    content = content.replace(oldAvsCRLF, newAvsCRLF);
    modified = true;
    console.log(`  [OK] Patched A.avs multi-file FileReader loop (CRLF)`);
  } else if (content.includes(oldAvsLF)) {
    content = content.replace(oldAvsLF, newAvsCRLF.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [OK] Patched A.avs multi-file FileReader loop (LF)`);
  }

  // 3. Unique optimistic ID in A.avr.prototype.a2L
  const oldOptIdCRLF = 'var _optId="optimistic-"+Date.now();\r\n';
  const oldOptIdLF = 'var _optId="optimistic-"+Date.now();\n';
  const newOptIdCRLF = 'var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);\r\n';

  if (content.includes(oldOptIdCRLF)) {
    content = content.replace(oldOptIdCRLF, newOptIdCRLF);
    modified = true;
    console.log(`  [OK] Added unique randomized suffix to optimistic ID (CRLF)`);
  } else if (content.includes(oldOptIdLF)) {
    content = content.replace(oldOptIdLF, newOptIdCRLF.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [OK] Added unique randomized suffix to optimistic ID (LF)`);
  }

  // 4. Inject A.aAlbumPhotoTap and $.buildPhotoGridWidget helpers
  if (!content.includes('$.buildPhotoGridWidget')) {
    const helpers = `
A.aAlbumPhotoTap = function aAlbumPhotoTap(a) { this.a = a; };
A.aAlbumPhotoTap.prototype = {
  $0() {
    if (this.a && window.openImageModal) {
      window.openImageModal(this.a);
    }
  },
  $S: 0
};

$.buildPhotoGridWidget = function(cluster, totalWidth) {
  totalWidth = totalWidth || 280;
  var gap = 3;
  var hGap = new A.cv(gap, null, null, null);
  var vGap = new A.cv(null, gap, null, null);
  var count = cluster.length;

  function makeCell(msg, w, h, extra) {
    var s = msg.e || "";
    var j = msg.f || s;
    var r = null;
    if (J.pX(s, "data:image")) {
      try {
        var q = B.b.ga5(J.a5C(s, ","));
        r = B.kC.ci(q);
      } catch (err) {}
    } else if (J.pX(s, "http") || J.pX(s, "/")) {
      j = s;
      if (j && j.startsWith("/")) {
        var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
        j = _be + j;
      }
    }

    var img;
    if (r != null) {
      img = new A.mD(A.aLD(null, null, new A.oH(r, 1)), new A.auP(), null, null, B.cp, B.e8, null);
    } else if (j != null && j.length !== 0) {
      img = new A.mD(A.aLD(null, null, new A.eY(j, 1, null)), new A.auQ(), null, null, B.cp, B.e8, null);
    } else {
      img = B.yF;
    }

    var cellImg = new A.cv(w, h, img, null);
    var isSending = msg.status === "sending" || (msg.a && (msg.a.indexOf("optimistic-") === 0 || msg.a.indexOf("uploading-") === 0 || msg.a.indexOf("temp_") === 0));
    var stackList = [cellImg];

    if (isSending) {
      var _spin = A.bV(B.rw, B.f, null, 22);
      var _shade = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(1879048192), null, null, null, null, null, B.t), null, w, null, null, null, null, h);
      stackList.push(_shade);
    } else if (extra && extra > 0) {
      var _txt = A.a2("+" + extra, null, 1, B.a9, null, null, A.ay(null, null, B.f, null, null, null, null, null, null, null, null, 24, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      var _overlay = A.a5(null, _txt, B.h, null, null, new A.ak(new A.q(2566914048), null, null, null, null, null, B.t), null, w, null, null, null, null, h);
      stackList.push(_overlay);
    }

    var cellContent = stackList.length > 1 ? A.dt(B.h, A.b(stackList, t.p), B.r, B.ap) : cellImg;
    var targetUrl = (r != null ? s : j) || "";
    var tapObj = new A.aAlbumPhotoTap(targetUrl);
    return A.dr(null, cellContent, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, tapObj, null, null, null, null, null, null, !1, B.ao);
  }

  var collage;
  if (count === 2) {
    var cellW = (totalWidth - gap) / 2;
    var cellH = cellW * 1.25;
    var row = A.b9(A.b([makeCell(cluster[0], cellW, cellH), hGap, makeCell(cluster[1], cellW, cellH)], t.p), B.l, B.m, B.G);
    collage = row;
  } else if (count === 3) {
    var leftW = (totalWidth - gap) * 0.58;
    var rightW = (totalWidth - gap) * 0.42;
    var totalH = totalWidth * 0.85;
    var subH = (totalH - gap) / 2;
    var rightCol = A.bm(A.b([makeCell(cluster[1], rightW, subH), vGap, makeCell(cluster[2], rightW, subH)], t.p), B.l, B.m, B.G);
    var row = A.b9(A.b([makeCell(cluster[0], leftW, totalH), hGap, rightCol], t.p), B.l, B.m, B.G);
    collage = row;
  } else {
    var cellW = (totalWidth - gap) / 2;
    var cellH = cellW;
    var extra = count > 4 ? count - 3 : 0;
    var row1 = A.b9(A.b([makeCell(cluster[0], cellW, cellH), hGap, makeCell(cluster[1], cellW, cellH)], t.p), B.l, B.m, B.G);
    var row2 = A.b9(A.b([makeCell(cluster[2], cellW, cellH), hGap, makeCell(cluster[3], cellW, cellH, extra)], t.p), B.l, B.m, B.G);
    var col = A.bm(A.b([row1, vGap, row2], t.p), B.l, B.m, B.G);
    collage = col;
  }

  return A.aP5(A.ag(16), collage);
};
`;
    content = content.replace('$.applyThemeColor=function', helpers + '\r\n$.applyThemeColor=function');
    modified = true;
    console.log(`  [OK] Injected A.aAlbumPhotoTap and $.buildPhotoGridWidget`);
  }

  // 5. Hook up Album Grid Clustering in A.au_.prototype.$2
  const auTargetCRLF = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\r\nif(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';
  const auTargetLF = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\nif(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';

  const clusterHook = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\r\n' +
    'function _checkImg(m){if(!m||m.y)return!1;var t=m.d;if(t==="image")return!0;var c=(m.e||"").toLowerCase(),u=m.f||"";if(c.indexOf("data:image")===0||u.length>0)return!0;return c.indexOf(".jpg")!==-1||c.indexOf(".jpeg")!==-1||c.indexOf(".png")!==-1||c.indexOf(".webp")!==-1||c.indexOf(".gif")!==-1||c.indexOf(".jfif")!==-1||c.indexOf(".heic")!==-1||c.indexOf(".heif")!==-1||c.indexOf(".avif")!==-1||c.indexOf(".bmp")!==-1||c.indexOf("/chat-media/")!==-1||c.indexOf("/images/")!==-1;}\r\n' +
    'if(_checkImg(e)){\r\n' +
    '  if(a0>0&&_checkImg(f[a0-1])&&f[a0-1].c===e.c){\r\n' +
    '    var _tPrev=f[a0-1].as?f[a0-1].as.a:0,_tCur=e.as?e.as.a:0;\r\n' +
    '    if(Math.abs(_tCur-_tPrev)<60000)return B.au;\r\n' +
    '  }\r\n' +
    '  var _cl=[e];\r\n' +
    '  for(var _ck=a0+1;_ck<f.length;_ck++){\r\n' +
    '    var _nxt=f[_ck];\r\n' +
    '    if(_checkImg(_nxt)&&_nxt.c===e.c){\r\n' +
    '      var _t1=_cl[_cl.length-1].as?_cl[_cl.length-1].as.a:0,_t2=_nxt.as?_nxt.as.a:0;\r\n' +
    '      if(Math.abs(_t2-_t1)<60000)_cl.push(_nxt);\r\n' +
    '      else break;\r\n' +
    '    }else break;\r\n' +
    '  }\r\n' +
    '  if(_cl.length>=2){\r\n' +
    '    try{\r\n' +
    '      if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30;\r\n' +
    '      else s=!0;\r\n' +
    '      var gridWidget=$.buildPhotoGridWidget(_cl,280);\r\n' +
    '      var p=b?B.ev:B.m;\r\n' +
    '      var o=A.b([],t.p);\r\n' +
    '      if(!b){\r\n' +
    '        var n=i.d.c,m=n!=null,l=h,k=h;\r\n' +
    '        if(m&&n.length!==0){n.toString;l=new A.eY(n,1,h);}\r\n' +
    '        if(!m||n.length===0){var ob=i.d.b;k=A.a2(ob.length!==0?ob[0].toUpperCase():"U",h,h,h,h,h,B.DV,h,h,h);}\r\n' +
    '        B.b.M(o,A.b([A.dr(h,A.hO(B.o,l,k,14),B.M,!1,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,new A.atQ(e,a),h,h,h,h,h,h,!1,B.ao),B.aT],t.p));\r\n' +
    '      }\r\n' +
    '      var kList=A.b([gridWidget],t.p);\r\n' +
    '      var j=e.Q;\r\n' +
    '      if(j.gbH(j)&&!e.y){var dD=A.dD(j);kList.push(A.eG(-8,A.aK_(new A.hl(i.a.Qy(j,10,b),new A.e0("chat_reactions_"+dD,t.kK)),B.J,h,B.W,B.W,new A.atS()),h,h,h,-4,h,h));}\r\n' +
    '      var dList=A.b([A.dt(B.aF,kList,B.h,B.ap)],t.p);\r\n' +
    '      if(b){\r\n' +
    '        var _lastSent=a0+_cl.length-1===i.c;\r\n' +
    '        B.b.M(dList,A.b([B.cZ,i.a.aaZ(_cl[_cl.length-1],i.d,_lastSent)],t.p));\r\n' +
    '      }\r\n' +
    '      if(i.a._tsMsgIds&&i.a._tsMsgIds.has(e.a)){\r\n' +
    '        var _ms=e.as?e.as.a:Date.now(),_v=new Date(_ms+252e5),_now=new Date(Date.now()+252e5);\r\n' +
    '        var _isToday=_v.getUTCFullYear()===_now.getUTCFullYear()&&_v.getUTCMonth()===_now.getUTCMonth()&&_v.getUTCDate()===_now.getUTCDate();\r\n' +
    '        var _hh=String(_v.getUTCHours()).padStart(2,"0"),_mm=String(_v.getUTCMinutes()).padStart(2,"0");\r\n' +
    '        var _timeStr=_hh+":"+_mm;\r\n' +
    '        if(!_isToday){_timeStr=String(_v.getUTCDate()).padStart(2,"0")+"/"+String(_v.getUTCMonth()+1).padStart(2,"0")+"/"+_v.getUTCFullYear()+", "+_hh+":"+_mm;}\r\n' +
    '        dList.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h));\r\n' +
    '      }\r\n' +
    '      var mAlign=b?B.dw:B.aS;\r\n' +
    '      o.push(new A.eT(1,B.bv,A.dr(h,A.bm(dList,mAlign,B.m,B.p),B.M,!1,h,new A.atT(g,e),new A.atU(i.a,a),h,h,h,h,h,new A.atV(i.a,a,e,g,b),h,h,h,h,h,h,h,h,h,h,new A.atW(i.a,a,e,g,b),h,new A.atTap(i.a,e),h,h,h,h,h,h,!1,B.ao),h));\r\n' +
    '      var cList=A.b([],t.p);\r\n' +
    '      if(s){\r\n' +
    '        var pt=e.as;\r\n' +
    '        cList.push(new A.bc(B.el,A.cn(A.a2((function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})(pt),h,h,h,h,h,B.Ec,h,h,h),h,h),h));\r\n' +
    '      }\r\n' +
    '      cList.push(new A.bc(B.lB,new A.Kp(A.b9(o,B.dw,p,B.p),new A.atX(g,e),h),h));\r\n' +
    '      return A.bm(cList,B.l,B.m,B.p);\r\n' +
    '    }catch(_err){console.error("Album grid render error:",_err);}\r\n' +
    '  }\r\n' +
    '}\r\n' +
    'if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';

  if (content.includes(auTargetCRLF)) {
    content = content.replace(auTargetCRLF, clusterHook);
    modified = true;
    console.log(`  [OK] Injected Album Grid clustering into A.au_.prototype.$2 (CRLF)`);
  } else if (content.includes(auTargetLF)) {
    content = content.replace(auTargetLF, clusterHook.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [OK] Injected Album Grid clustering into A.au_.prototype.$2 (LF)`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 Successfully updated: ${filePath}`);
  } else {
    console.log(`⚠️ No modifications applied (patterns may already be patched or not found)`);
  }
});

console.log(`\n🎉 Photo Grid & Album Deployment Completed!`);
