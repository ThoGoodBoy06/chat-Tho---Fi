const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

function applyFix(content, filePath) {
  let modified = false;

  // Helper to replace both CRLF and LF versions
  function replaceBoth(targetCRLF, replacementCRLF, label) {
    const targetLF = targetCRLF.replace(/\r\n/g, '\n');
    const replacementLF = replacementCRLF.replace(/\r\n/g, '\n');

    if (content.includes(targetCRLF)) {
      content = content.split(targetCRLF).join(replacementCRLF);
      modified = true;
      console.log(`  [+] Patched ${label} (CRLF)`);
    } else if (content.includes(targetLF)) {
      content = content.split(targetLF).join(replacementLF);
      modified = true;
      console.log(`  [+] Patched ${label} (LF)`);
    }
  }

  // 1. Guard a2L video push against duplicating
  const oldVidPush = 'var _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));\r\n' +
    'if(_isVidSend&&n.length>0){\r\n' +
    'try{\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"video","video","",null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(_){}\r\n' +
    '}';

  const newVidPush = 'var _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));\r\n' +
    'if(_isVidSend&&n.length>0){\r\n' +
    'try{\r\n' +
    'if(!q.d.d.some(function(_m){return _m&&(_m.a===_optId||_m.clientTempId===_optId);})){\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"video","video","",null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}\r\n' +
    '}catch(_){}\r\n' +
    '}';

  replaceBoth(oldVidPush, newVidPush, 'a2L video deduplication guard');

  // 2. Guard a2L image push against duplicating
  const oldImgPush = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
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

  const newImgPush = 'var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));\r\n' +
    'if(_isImg&&n.length>0){\r\n' +
    'try{\r\n' +
    'if(!q.d.d.some(function(_m){return _m&&(_m.a===_optId||_m.clientTempId===_optId);})){\r\n' +
    'var _fileObj=q.c;\r\n' +
    'var _dUrl=(window.URL&&window.URL.createObjectURL&&_fileObj instanceof Blob)?window.URL.createObjectURL(_fileObj):"";\r\n' +
    'if(!_dUrl){\r\n' +
    'try{var _b=new Blob([n],{type:l||"image/jpeg"});_dUrl=window.URL.createObjectURL(_b);}catch(_){_dUrl="data:"+(l||"image/jpeg")+";base64,";}\r\n' +
    '}\r\n' +
    'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}\r\n' +
    '}catch(_){}\r\n' +
    '}';

  replaceBoth(oldImgPush, newImgPush, 'a2L image deduplication guard');

  // 3. Robust case 4 resolution and orphan cleanup (in both a2L and a2K)
  const oldCase4 = 'case 4:p=c\r\n' +
    'if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\n' +
    'o=A.wf(J.Z(p,"data"));\r\n' +
    'var _msgs=q.d.d,_found=!1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=0;_i<_msgs.length;_i++){\r\n' +
    'if(_msgs[_i]&&_msgs[_i].a===_optId){_msgs[_i]=o;_found=!0;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(!_found)q.d.vZ(o);\r\n' +
    'else q.d.V();\r\n' +
    '}catch(j){}\r\n' +
    'else{\r\n' +
    'try{\r\n' +
    'var _msgs=q.d.d;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=0;_i<_msgs.length;_i++){\r\n' +
    'if(_msgs[_i]&&_msgs[_i].a===_optId){_msgs.splice(_i,1);break;}\r\n' +
    '}\r\n' +
    'q.d.V();\r\n' +
    '}\r\n' +
    '}catch(_){}\r\n' +
    '}';

  const newCase4 = 'case 4:p=c\r\n' +
    'if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\n' +
    'o=A.wf(J.Z(p,"data"));\r\n' +
    'o.status="sent";\r\n' +
    'var _msgs=q.d.d,_replaced=!1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=_msgs.length-1;_i>=0;_i--){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId||_msgs[_i].a===o.a)){\r\n' +
    'if(!_replaced){_msgs[_i]=o;_replaced=!0;}\r\n' +
    'else{_msgs.splice(_i,1);}\r\n' +
    '}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(!_replaced)q.d.vZ(o);\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'var _seenReal=!1;\r\n' +
    'for(var _k=_msgs.length-1;_k>=0;_k--){\r\n' +
    'if(_msgs[_k]&&_msgs[_k].a===o.a){\r\n' +
    'if(!_seenReal){_seenReal=!0;}\r\n' +
    'else{_msgs.splice(_k,1);}\r\n' +
    '}else if(_msgs[_k]&&typeof _msgs[_k].a==="string"&&_msgs[_k].a.indexOf("optimistic-")===0&&_msgs[_k].status==="sending"&&_msgs[_k].b===q.b.a){\r\n' +
    '_msgs.splice(_k,1);\r\n' +
    '}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'q.d.V();\r\n' +
    '}catch(j){}\r\n' +
    'else{\r\n' +
    'try{\r\n' +
    'var _msgs=q.d.d;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=_msgs.length-1;_i>=0;_i--){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_msgs.splice(_i,1);}\r\n' +
    '}\r\n' +
    'q.d.V();\r\n' +
    '}\r\n' +
    '}catch(_){}\r\n' +
    '}';

  replaceBoth(oldCase4, newCase4, 'case 4 resolution and orphan cleanup');

  // 4. Smart Socket.IO deduplication in A.a7R.prototype
  const oldA7R = 'A.a7R.prototype={\r\n' +
    '$1(a){var s\r\n' +
    'if(B.c.bj(a.a,"optimistic-")||B.c.bj(a.a,"rt-")){s=this.a\r\n' +
    's=a.e===s.e&&a.c==s.c}else s=!1\r\n' +
    'return s},\r\n' +
    '$S:28}';

  const newA7R = 'A.a7R.prototype={\r\n' +
    '$1(a){var s=this.a;\r\n' +
    'if(B.c.bj(a.a,"optimistic-")||B.c.bj(a.a,"rt-")||B.c.bj(a.a,"temp_")||(a.status==="sending")){\r\n' +
    'if(a.c!=s.c)return!1;\r\n' +
    'if(a.e===s.e)return!0;\r\n' +
    'if(s.clientTempId&&a.clientTempId&&s.clientTempId===a.clientTempId)return!0;\r\n' +
    'if(a.d===s.d&&a.status==="sending")return!0;\r\n' +
    'return!1;\r\n' +
    '}else return!1;},\r\n' +
    '$S:28}';

  replaceBoth(oldA7R, newA7R, 'A.a7R.prototype socket deduplication');

  return { content, modified };
}

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n===> Fixing duplication & infinite spinning bug in: ${filePath}`);
  const origContent = fs.readFileSync(filePath, 'utf8');
  const result = applyFix(origContent, filePath);
  if (result.modified) {
    fs.writeFileSync(filePath, result.content, 'utf8');
    console.log(`  [OK] Successfully patched and saved: ${filePath}`);
  } else {
    console.log(`  [-] No changes made (already patched or patterns not matched)`);
  }
});

console.log('\nDone applying duplicate & spinning bug fixes!');
