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

  // Change 60000ms threshold to 2500ms so separate sends NEVER cluster into a deck
  const oldPrevCheck = 'if(Math.abs(_tCur-_tPrev)<60000)return B.au;';
  const newPrevCheck = 'if(Math.abs(_tCur-_tPrev)<=2500)return B.au;';

  const oldNextCheck = 'if(Math.abs(_t2-_t1)<60000)_cl.push(_nxt);';
  const newNextCheck = 'if(Math.abs(_t2-_t1)<=2500)_cl.push(_nxt);';

  if (content.includes(oldPrevCheck)) {
    content = safeReplace(content, oldPrevCheck, newPrevCheck);
    console.log('  -> Updated previous message clustering threshold (60s -> 2.5s)');
    patchCount++;
  }

  if (content.includes(oldNextCheck)) {
    content = safeReplace(content, oldNextCheck, newNextCheck);
    console.log('  -> Updated next message clustering threshold (60s -> 2.5s)');
    patchCount++;
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
