const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

function safeReplace(str, search, replacement) {
  if (!str.includes(search)) return str;
  return str.split(search).join(replacement);
}

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] Not found: ${filePath}`);
    return;
  }
  console.log(`[PATCHING] ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let patchCount = 0;

  // In aaY: Look up window._recentUploadedBytes before falling back to network fetch
  const searchCRLF = 'c.a=null\r\nc.msg=a;c.msgId=a.a;c.status=a.status;';
  const replCRLF = 'if(!r&&window._recentUploadedBytes&&(window._recentUploadedBytes[j]||window._recentUploadedBytes[s]||(a&&window._recentUploadedBytes[a.a]))){r=window._recentUploadedBytes[j]||window._recentUploadedBytes[s]||window._recentUploadedBytes[a.a];}\r\nc.a=null\r\nc.msg=a;c.msgId=a.a;c.status=a.status;';

  const searchLF = 'c.a=null\nc.msg=a;c.msgId=a.a;c.status=a.status;';
  const replLF = 'if(!r&&window._recentUploadedBytes&&(window._recentUploadedBytes[j]||window._recentUploadedBytes[s]||(a&&window._recentUploadedBytes[a.a]))){r=window._recentUploadedBytes[j]||window._recentUploadedBytes[s]||window._recentUploadedBytes[a.a];}\nc.a=null\nc.msg=a;c.msgId=a.a;c.status=a.status;';

  if (content.includes(searchCRLF)) {
    content = safeReplace(content, searchCRLF, replCRLF);
    console.log('  -> Added seamless in-memory byte lookup in aaY (CRLF)');
    patchCount++;
  } else if (content.includes(searchLF)) {
    content = safeReplace(content, searchLF, replLF);
    console.log('  -> Added seamless in-memory byte lookup in aaY (LF)');
    patchCount++;
  } else {
    console.log('  -> aaY lookup already patched or not matched');
  }

  // Syntax check
  try {
    new vm.Script(content);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SUCCESS] ${filePath}: Applied ${patchCount} patches. VM syntax valid.`);
  } catch (err) {
    console.error(`[ERROR] Syntax error in ${filePath}:`, err.message);
    process.exit(1);
  }
});
