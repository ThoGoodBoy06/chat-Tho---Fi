const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] File not found: ${filePath}`);
    return;
  }
  console.log(`\n===> Patching duplicate image & backward-search fix in: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let patchCount = 0;

  function replaceBoth(targetCRLF, replacementCRLF, label) {
    const targetLF = targetCRLF.replace(/\r\n/g, '\n');
    const replacementLF = replacementCRLF.replace(/\r\n/g, '\n');

    if (content.includes(targetCRLF)) {
      content = content.split(targetCRLF).join(replacementCRLF);
      patchCount++;
      console.log(`  [+] Patched ${label} (CRLF)`);
    } else if (content.includes(targetLF)) {
      content = content.split(targetLF).join(replacementLF);
      patchCount++;
      console.log(`  [+] Patched ${label} (LF)`);
    } else {
      console.log(`  [-] Pattern not found for ${label}`);
    }
  }

  // 1. In q3: Add clientTempId (param e) to multipart request fields
  const oldQ3Sig = 'q3(a,b,c,d){var s=0,r=A.x(t.P),q,p,o,n,m,l,k\r\n' +
    'var $async$q3=A.t(function(e,f){';
  const newQ3Sig = 'q3(a,b,c,d,_optCId){var s=0,r=A.x(t.P),q,p,o,n,m,l,k\r\n' +
    'var $async$q3=A.t(function(e,f){';
  replaceBoth(oldQ3Sig, newQ3Sig, 'q3 signature with _optCId');

  const oldQ3Fields = 'l.x.n(0,"mimeType",d)\r\nk=A';
  const newQ3Fields = 'l.x.n(0,"mimeType",d)\r\nif(_optCId)l.x.n(0,"clientTempId",_optCId)\r\nk=A';
  replaceBoth(oldQ3Fields, newQ3Fields, 'q3 clientTempId form field');

  // 2. In a2L and a2K: Pass _optId to A.q3
  const oldQ3Call = 'return A.m(A.q3(q.b.a,n,k,l),$async$$1)';
  const newQ3Call = 'return A.m(A.q3(q.b.a,n,k,l,_optId),$async$$1)';
  if (content.includes(oldQ3Call)) {
    content = content.split(oldQ3Call).join(newQ3Call);
    patchCount++;
    console.log('  [+] Patched A.q3 calls with _optId');
  }

  // 3. In case 4 (both in a2L and a2K): Search backwards and cleanly replace optimistic bubble
  const oldCase4 = 'case 4:p=c\r\n' +
    'if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\n' +
    'o=A.wf(J.Z(p,"data"));\r\n' +
    'o.status="sent";\r\n' +
    'var _msgs=q.d.d,_foundIdx=-1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=0;_i<_msgs.length;_i++){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_foundIdx=_i;break;} \r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(_foundIdx!==-1){\r\n' +
    '_msgs[_foundIdx]=o;\r\n' +
    '}else{\r\n' +
    'var _alreadyHasReal=!1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _j=0;_j<_msgs.length;_j++){\r\n' +
    'if(_msgs[_j]&&_msgs[_j].a===o.a){_alreadyHasReal=!0;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(!_alreadyHasReal){\r\n' +
    'B.b.D(q.d.d,o);\r\n' +
    '}\r\n' +
    '}\r\n' +
    'q.d.JF(o);\r\n' +
    'q.d.V();\r\n' +
    'if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(j){}';

  const oldCase4Alt = 'case 4:p=c\r\n' +
    'if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\n' +
    'o=A.wf(J.Z(p,"data"));\r\n' +
    'o.status="sent";\r\n' +
    'var _msgs=q.d.d,_foundIdx=-1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=0;_i<_msgs.length;_i++){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_foundIdx=_i;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(_foundIdx!==-1){\r\n' +
    '_msgs[_foundIdx]=o;\r\n' +
    '}else{\r\n' +
    'var _alreadyHasReal=!1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _j=0;_j<_msgs.length;_j++){\r\n' +
    'if(_msgs[_j]&&_msgs[_j].a===o.a){_alreadyHasReal=!0;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(!_alreadyHasReal){\r\n' +
    'B.b.D(q.d.d,o);\r\n' +
    '}\r\n' +
    '}\r\n' +
    'q.d.JF(o);\r\n' +
    'q.d.V();\r\n' +
    'if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(j){}';

  const newCase4 = 'case 4:p=c\r\n' +
    'if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{\r\n' +
    'o=A.wf(J.Z(p,"data"));\r\n' +
    'o.status="sent";\r\n' +
    'if(o.clientTempId==null&&_optId)o.clientTempId=_optId;\r\n' +
    'var _msgs=q.d.d,_foundIdx=-1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _i=_msgs.length-1;_i>=0;_i--){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId||_msgs[_i].a===o.a)){_foundIdx=_i;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(_foundIdx!==-1){\r\n' +
    '_msgs[_foundIdx]=o;\r\n' +
    '}else{\r\n' +
    'var _alreadyHasReal=!1;\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _j=_msgs.length-1;_j>=0;_j--){\r\n' +
    'if(_msgs[_j]&&_msgs[_j].a===o.a){_alreadyHasReal=!0;break;}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(!_alreadyHasReal){\r\n' +
    'B.b.D(q.d.d,o);\r\n' +
    '}\r\n' +
    '}\r\n' +
    'if(_msgs&&_msgs.length){\r\n' +
    'for(var _k=_msgs.length-1;_k>=0;_k--){\r\n' +
    'if(_msgs[_k]&&_k!==_foundIdx&&(_msgs[_k].a===_optId||_msgs[_k].clientTempId===_optId)){\r\n' +
    '_msgs.splice(_k,1);\r\n' +
    '}\r\n' +
    '}\r\n' +
    '}\r\n' +
    'q.d.JF(o);\r\n' +
    'q.d.V();\r\n' +
    'if(q.d.cy!=null)q.d.cy.$0();\r\n' +
    '}catch(j){}';

  replaceBoth(oldCase4, newCase4, 'case 4 backward resolution');
  replaceBoth(oldCase4Alt, newCase4, 'case 4 backward resolution alt');

  // Also patch error cleanup loop in case 4 else
  const oldCase4Else = 'for(var _i=0;_i<_msgs.length;_i++){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_msgs.splice(_i,1);break;}\r\n' +
    '}';
  const newCase4Else = 'for(var _i=_msgs.length-1;_i>=0;_i--){\r\n' +
    'if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_msgs.splice(_i,1);break;}\r\n' +
    '}';
  replaceBoth(oldCase4Else, newCase4Else, 'case 4 else error cleanup backwards');

  // 4. In vZ(a): Use backward search (a0n = lastIndexWhere) instead of forward search (h3 = indexWhere)
  const oldVzBody = 'r=B.b.h3(p.d,new A.a7Q(a))\r\n' +
    'o=p.d\r\n' +
    'if(r!==-1)o[r]=a\r\n' +
    'else{q=B.b.h3(o,new A.a7R(a))\r\n' +
    'o=p.d\r\n' +
    'if(q!==-1)o[q]=a\r\n' +
    'else B.b.D(o,a)}p.V()';

  const newVzBody = 'r=B.b.a0n(p.d,new A.a7Q(a))\r\n' +
    'o=p.d\r\n' +
    'if(r!==-1)o[r]=a\r\n' +
    'else{q=B.b.a0n(o,new A.a7R(a))\r\n' +
    'o=p.d\r\n' +
    'if(q!==-1)o[q]=a\r\n' +
    'else B.b.D(o,a)}p.V()';

  replaceBoth(oldVzBody, newVzBody, 'vZ backward search (a0n = lastIndexWhere)');

  // 5. In A.a7R.prototype.$1: Exact deduplication logic
  const oldA7R = 'A.a7R.prototype={\r\n' +
    '$1(a){var s=this.a;\r\n' +
    'if(a.c!=s.c)return!1;\r\n' +
    'if(a.e===s.e)return!0;\r\n' +
    'if(s.clientTempId&&a.clientTempId&&s.clientTempId===a.clientTempId)return!0;\r\n' +
    'if(a.b===s.b&&a.d===s.d&&(a.status==="sending"||(typeof a.a==="string"&&a.a.indexOf("optimistic-")===0))){\r\n' +
    'return!0;\r\n' +
    '}\r\n' +
    'return!1;},\r\n' +
    '$S:28}';

  const newA7R = 'A.a7R.prototype={\r\n' +
    '$1(a){var s=this.a;\r\n' +
    'if(s.clientTempId&&a.clientTempId&&s.clientTempId===a.clientTempId)return!0;\r\n' +
    'if(a.c!=s.c)return!1;\r\n' +
    'if(a.b!=s.b)return!1;\r\n' +
    'if(a.e===s.e)return!0;\r\n' +
    'if(a.d===s.d&&(a.status==="sending"||(typeof a.a==="string"&&a.a.indexOf("optimistic-")===0))){\r\n' +
    'return!0;\r\n' +
    '}\r\n' +
    'return!1;},\r\n' +
    '$S:28}';

  replaceBoth(oldA7R, newA7R, 'A.a7R deduplication predicate');

  // 6. In A.wf: Map clientTempId if present in JSON
  const oldWfRes = 'var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);\r\n' +
    'if(_isFwd){_mRes.isForwarded=true;}\r\n' +
    'return _mRes;';
  const newWfRes = 'var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);\r\n' +
    'if(_isFwd){_mRes.isForwarded=true;}\r\n' +
    'var _ctid=d.h(a,"clientTempId")||(a&&a.clientTempId);\r\n' +
    'if(_ctid){_mRes.clientTempId=J.ai(_ctid);}\r\n' +
    'return _mRes;';
  replaceBoth(oldWfRes, newWfRes, 'A.wf clientTempId mapping');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[DONE] ${filePath} patched with ${patchCount} replacements.`);

  // Verify syntax with Node VM
  try {
    new vm.Script(content);
    console.log(`[PASS] Syntax check passed for: ${filePath}`);
  } catch (err) {
    console.error(`[FAIL] Syntax error in ${filePath}:`, err.message);
    process.exit(1);
  }
}

targetFiles.forEach(patchFile);
console.log('\nAll files processed successfully!');
