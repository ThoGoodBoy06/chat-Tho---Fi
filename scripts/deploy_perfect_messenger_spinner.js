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
  console.log(`\n===> Patching: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Replace static Icon in aaY with REAL rotating CircularProgressIndicator
  const oldAaYCenter = 'var _spinIcon=A.bV(B.rw,B.f,d,28);\r\nvar _centerCircle=A.a5(d,_spinIcon,B.h,d,d,new A.ak(new A.q(2013265920),d,d,A.ag(28),d,d,B.t),d,56,d,d,d,d,56);';
  const oldAaYCenterLF = oldAaYCenter.replace(/\r\n/g, '\n');

  // A.mb(strokeWidth, value, backgroundColor, valueColor, ...) -> CircularProgressIndicator
  // A.cv(width, height, child, key) -> SizedBox
  const realAaYSpinner = 'var _spinProgress=new A.cv(28,28,new A.mb(2.6,null,null,B.f,null,null,null,null),null);\r\n' +
    'var _centerCircle=A.a5(d,_spinProgress,B.h,d,d,new A.ak(new A.q(2013265920),d,d,A.ag(28),d,d,B.t),d,56,d,d,d,d,56);';

  if (content.includes(oldAaYCenter)) {
    content = content.replace(oldAaYCenter, realAaYSpinner);
    modified = true;
    console.log('  [+] Replaced static icon with real rotating CircularProgressIndicator in aaY (CRLF)');
  } else if (content.includes(oldAaYCenterLF)) {
    content = content.replace(oldAaYCenterLF, realAaYSpinner.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Replaced static icon with real rotating CircularProgressIndicator in aaY (LF)');
  }

  // 2. Replace static Icon in makeCardImg (collages) with real rotating CircularProgressIndicator
  const oldCollageSpin = 'var _spin = A.bV(B.rw, B.f, null, 26);\r\n      var _centerCircle = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(2013265920), null, null, A.ag(26), null, null, B.t), null, 52, null, null, null, null, 52);';
  const oldCollageSpinLF = oldCollageSpin.replace(/\r\n/g, '\n');

  const realCollageSpinner = 'var _spin = new A.cv(26, 26, new A.mb(2.4, null, null, B.f, null, null, null, null), null);\r\n' +
    '      var _centerCircle = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(2013265920), null, null, A.ag(26), null, null, B.t), null, 52, null, null, null, null, 52);';

  if (content.includes(oldCollageSpin)) {
    content = content.replace(oldCollageSpin, realCollageSpinner);
    modified = true;
    console.log('  [+] Replaced static icon with real rotating CircularProgressIndicator in collages (CRLF)');
  } else if (content.includes(oldCollageSpinLF)) {
    content = content.replace(oldCollageSpinLF, realCollageSpinner.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Replaced static icon with real rotating CircularProgressIndicator in collages (LF)');
  }

  // 3. In A.avs.prototype: Push optimistic message IMMEDIATELY (0ms delay) upon file selection!
  const avsOldBlock = 'A.avs.prototype={\r\n$1(a){var s,r,q,p=this,o=p.b.files\r\n' +
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
  const avsOldBlockLF = avsOldBlock.replace(/\r\n/g, '\n');

  const avsInstantBlock = 'A.avs.prototype={\r\n$1(a){var s,r,q,p=this,o=p.b.files\r\n' +
    'if(o!=null&&!B.fA.gaf(o)){\r\n' +
    'try{var r=p.a.c.Y(t.q);r.toString;r.f.bA(B.Dz);}catch(_){}\r\n' +
    'for(var _fi=0;_fi<o.length;_fi++){\r\n' +
    '(function(file,fidx){\r\n' +
    'var _optId="optimistic-"+Date.now()+"-"+fidx+"-"+Math.random().toString(36).substring(2,6);\r\n' +
    'var _myUid=(p.d&&p.d.a)?p.d.a.a:null;\r\n' +
    'var _blobUrl=(window.URL&&window.URL.createObjectURL&&file instanceof Blob)?window.URL.createObjectURL(file):"";\r\n' +
    'if(_blobUrl&&p.c&&p.d){\r\n' +
    'try{\r\n' +
    'var _optMsg=new A.k1(_optId,p.c.a,_myUid,"image",_blobUrl,_blobUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\r\n' +
    '_optMsg.status="sending";_optMsg.clientTempId=_optId;\r\n' +
    'p.d.vZ(_optMsg);\r\n' +
    '}catch(_){}\r\n' +
    '}\r\n' +
    'var q=new FileReader();q.readAsArrayBuffer(file);\r\n' +
    'var _avrInst=new A.avr(q,p.c,file,p.d);\r\n' +
    '_avrInst._assignedOptId=_optId;\r\n' +
    'A.dJ(q,"loadend",_avrInst,!1);\r\n' +
    '})(o[_fi],_fi);\r\n' +
    '}\r\n' +
    'return;\r\n' +
    's=o[0]';

  if (content.includes(avsOldBlock)) {
    content = content.replace(avsOldBlock, avsInstantBlock);
    modified = true;
    console.log('  [+] Patched A.avs for instant 0ms optimistic message appearance (CRLF)');
  } else if (content.includes(avsOldBlockLF)) {
    content = content.replace(avsOldBlockLF, avsInstantBlock.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('  [+] Patched A.avs for instant 0ms optimistic message appearance (LF)');
  }

  // 4. In A.avr.prototype: Use _assignedOptId so upload replacement matches the instant message
  const avrOptIdOld = 'var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);';
  const avrOptIdNew = 'var _optId=q._assignedOptId||("optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7));';

  if (content.includes(avrOptIdOld)) {
    content = content.replace(avrOptIdOld, avrOptIdNew);
    modified = true;
    console.log('  [+] Synced _optId in A.avr to match instant optimistic message');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [OK] Saved changes to ${filePath}`);
  } else {
    console.log(`  [-] No changes needed for ${filePath}`);
  }
});

console.log('\nDeployment of rotating animation spinner completed!');
