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

  // 1. Enable multiple file selection in file input creation
  const oldAcceptStr = 's=A.Q1("file")\r\ns.accept="image/*,video/*"\r\ns.click()';
  const oldAcceptStrLF = 's=A.Q1("file")\ns.accept="image/*,video/*"\ns.click()';
  const newAcceptStr = 's=A.Q1("file")\r\ns.accept="image/*,video/*"\r\ns.multiple=true\r\ns.click()';

  if (content.includes(oldAcceptStr)) {
    content = content.replace(oldAcceptStr, newAcceptStr);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Enabled multiple=true on file input`);
  } else if (content.includes(oldAcceptStrLF)) {
    content = content.replace(oldAcceptStrLF, newAcceptStr.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Enabled multiple=true on file input (LF)`);
  }

  // 2. Loop through all files in A.avs.prototype
  const oldAvsLoop = 'if(o!=null&&!B.fA.gaf(o)){s=o[0]\r\nr=p.a.c.Y(t.q)\r\nr.toString\r\nr.f.bA(B.Dz)\r\nq=new FileReader()\r\nq.readAsArrayBuffer(s)\r\nA.dJ(q,"loadend",new A.avr(q,p.c,s,p.d),!1)}';
  const oldAvsLoopLF = 'if(o!=null&&!B.fA.gaf(o)){s=o[0]\nr=p.a.c.Y(t.q)\nr.toString\nr.f.bA(B.Dz)\nq=new FileReader()\nq.readAsArrayBuffer(s)\nA.dJ(q,"loadend",new A.avr(q,p.c,s,p.d),!1)}';

  const newAvsLoop = 'if(o!=null&&!B.fA.gaf(o)){\r\n' +
    '  for(var _fi=0;_fi<o.length;_fi++){\r\n' +
    '    (function(sFile){\r\n' +
    '      var q=new FileReader();\r\n' +
    '      q.readAsArrayBuffer(sFile);\r\n' +
    '      A.dJ(q,"loadend",new A.avr(q,p.c,sFile,p.d),!1);\r\n' +
    '    })(o[_fi]);\r\n' +
    '  }\r\n' +
    '}';

  if (content.includes(oldAvsLoop)) {
    content = content.replace(oldAvsLoop, newAvsLoop);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Updated A.avs to process multiple files in parallel`);
  } else if (content.includes(oldAvsLoopLF)) {
    content = content.replace(oldAvsLoopLF, newAvsLoop.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Updated A.avs to process multiple files in parallel (LF)`);
  }

  // 3. Add $.buildPhotoGridCluster helper if not already defined
  if (!content.includes('$.buildPhotoGridCluster')) {
    const gridHelper = `
$.buildPhotoGridCluster = function(cluster, isMe, conv, parentItemBuilder, chatState, firstMsg) {
  var count = cluster.length;
  var totalWidth = 310;
  var gap = 3;
  var rad = A.ag(14);
  var cellWidth = (totalWidth - gap) / 2;
  var cellHeight = cellWidth * 0.95;

  function makeCell(msg, w, h, extra) {
    var rawBubble = parentItemBuilder.a.aaY(msg, isMe);
    var styledCell = A.a5(null, rawBubble, B.h, null, null, new A.ak(null, null, null, rad), null, w, null, null, null, null, h);
    if (extra && extra > 0) {
      var overlay = A.a5(null, A.a2("+" + extra, null, 1, B.a9, null, null, A.ay(null, null, B.f, null, null, null, null, null, null, null, null, 24, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null), B.h, null, new A.q(2566914048), new A.ak(null, null, null, rad), null, w, null, null, null, null, h);
      return A.dt(B.h, A.b([styledCell, overlay], t.p), B.r, B.ap);
    }
    return styledCell;
  }

  var gridWidget;
  if (count === 2) {
    gridWidget = A.b9(A.b([makeCell(cluster[0], cellWidth, cellHeight * 1.2), B.aT, makeCell(cluster[1], cellWidth, cellHeight * 1.2)], t.p), B.l, B.m, B.p);
  } else if (count === 3) {
    var leftW = (totalWidth - gap) * 0.58;
    var rightW = (totalWidth - gap) * 0.42;
    var subH = (cellHeight * 2 - gap) / 2;
    var rightCol = A.bm(A.b([makeCell(cluster[1], rightW, subH), B.cW, makeCell(cluster[2], rightW, subH)], t.p), B.l, B.m, B.p);
    gridWidget = A.b9(A.b([makeCell(cluster[0], leftW, cellHeight * 2), B.aT, rightCol], t.p), B.l, B.m, B.p);
  } else {
    var extraCount = count > 4 ? count - 3 : 0;
    var row1 = A.b9(A.b([makeCell(cluster[0], cellWidth, cellHeight), B.aT, makeCell(cluster[1], cellWidth, cellHeight)], t.p), B.l, B.m, B.p);
    var row2 = A.b9(A.b([makeCell(cluster[2], cellWidth, cellHeight), B.aT, makeCell(cluster[3], cellWidth, cellHeight, extraCount)], t.p), B.l, B.m, B.p);
    gridWidget = A.bm(A.b([row1, B.cW, row2], t.p), B.l, B.m, B.p);
  }

  var bubbleCol = [gridWidget];
  var lastMsg = cluster[cluster.length - 1];
  if (isMe) {
    bubbleCol.push(B.cZ);
    bubbleCol.push(chatState.aaZ(lastMsg, conv, !0));
  }

  var bubbleContent = A.bm(A.b(bubbleCol, t.p), isMe ? B.dw : B.aS, B.m, B.G);

  var outerRow = [];
  if (!isMe) {
    var avUrl = conv ? conv.c : null;
    var avWidget = avUrl && avUrl.length > 0 ? new A.eY(avUrl, 1, null) : null;
    var avInit = conv && conv.b && conv.b.length > 0 ? conv.b[0].toUpperCase() : "U";
    var avText = avWidget ? null : A.a2(avInit, null, null, null, null, null, B.DV, null, null, null);
    outerRow.push(A.dr(null, A.hO(B.o, avWidget, avText, 14), B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, !1, B.ao));
    outerRow.push(B.aT);
  }
  outerRow.push(new A.eT(1, B.bv, bubbleContent, null));

  var mainRow = A.b9(A.b(outerRow, t.p), B.dw, isMe ? B.ev : B.m, t.p);
  return new A.bc(B.lB, mainRow, null);
};
`;
    content = content.replace('$.applyThemeColor=function', gridHelper + '\r\n$.applyThemeColor=function');
    modified = true;
    console.log(`  [${path.basename(filePath)}] Added $.buildPhotoGridCluster helper`);
  }

  // 4. Inject clustering check into A.au_.prototype.$2
  const auTarget = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\r\nif(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';
  const auTargetLF = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\nif(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';

  const newClusterCheck = 'var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)\r\n' +
    'function _checkImg(m){if(!m||m.z)return!1;var t=m.d;if(t==="image")return!0;var c=(m.e||"").toLowerCase(),u=m.f||"";if(c.indexOf("data:image")===0||u.length>0)return!0;return c.indexOf(".jpg")!==-1||c.indexOf(".jpeg")!==-1||c.indexOf(".png")!==-1||c.indexOf(".webp")!==-1||c.indexOf(".gif")!==-1||c.indexOf("/chat-media/")!==-1;}\r\n' +
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
    '    try{return $.buildPhotoGridCluster(_cl,b,i.d,i,i.a,e);}catch(_err){console.error("Album grid error:",_err);}\r\n' +
    '  }\r\n' +
    '}\r\n' +
    'if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30';

  if (content.includes(auTarget)) {
    content = content.replace(auTarget, newClusterCheck);
    modified = true;
    console.log(`  [${path.basename(filePath)}] Injected Photo Grid Album clustering in A.au_ (CRLF)`);
  } else if (content.includes(auTargetLF)) {
    content = content.replace(auTargetLF, newClusterCheck.replace(/\r\n/g, '\n'));
    modified = true;
    console.log(`  [${path.basename(filePath)}] Injected Photo Grid Album clustering in A.au_ (LF)`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 Saved changes to ${filePath}`);
  }
});

console.log('🎉 Done updating Photo Grid & Album feature in JS bundles!');
