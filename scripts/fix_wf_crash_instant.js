const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] Not found: ${filePath}`);
    return;
  }
  console.log(`\n===> Fixing A.wf crash in: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  const oldBadPattern = 'var _ctid=d.h(a,"clientTempId")||(a&&a.clientTempId);\r\n' +
    'if(_ctid){_mRes.clientTempId=J.ai(_ctid);}';

  const oldBadPatternLF = 'var _ctid=d.h(a,"clientTempId")||(a&&a.clientTempId);\n' +
    'if(_ctid){_mRes.clientTempId=J.ai(_ctid);}';

  const safeReplacement = 'var _ctid=(a&&a.clientTempId)?a.clientTempId:null;\r\n' +
    'if(_ctid){_mRes.clientTempId=_ctid;}';

  const safeReplacementLF = 'var _ctid=(a&&a.clientTempId)?a.clientTempId:null;\n' +
    'if(_ctid){_mRes.clientTempId=_ctid;}';

  let patched = false;
  if (content.includes(oldBadPattern)) {
    content = content.split(oldBadPattern).join(safeReplacement);
    patched = true;
    console.log('  [+] Fixed A.wf crash (CRLF)');
  } else if (content.includes(oldBadPatternLF)) {
    content = content.split(oldBadPatternLF).join(safeReplacementLF);
    patched = true;
    console.log('  [+] Fixed A.wf crash (LF)');
  } else {
    console.log('  [-] Pattern not found, checking with substring...');
    const searchStr = 'var _ctid=d.h(a,"clientTempId")';
    if (content.includes(searchStr)) {
      console.log('  [!] Found searchStr!');
    }
  }

  if (patched) {
    fs.writeFileSync(filePath, content, 'utf8');
    // Verify syntax
    try {
      new vm.Script(content);
      console.log(`[PASS] Syntax check passed for: ${filePath}`);
    } catch (e) {
      console.error(`[FAIL] Syntax error in ${filePath}:`, e.message);
      process.exit(1);
    }
  }
});

console.log('\nDone fixing A.wf crash!');
