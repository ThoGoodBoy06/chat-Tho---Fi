const fs = require('fs');
const path = require('path');

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

  // 1. Fix all $async$1 -> $async$$1
  if (content.includes('$async$1')) {
    const count = content.split('$async$1').length - 1;
    content = safeReplace(content, '$async$1', '$async$$1');
    console.log(`  -> Restored $async$$1 (${count} occurrences)`);
    patchCount += count;
  }

  // 2. Fix Stack Alignment crash in aaY
  const badDt1 = 'o=A.dt(B.h,A.b([o,_centerCircle],t.p),B.r,B.ap);';
  const goodDt1 = 'o=A.dt(B.aF,A.b([o,_centerCircle],t.p),B.r,B.ap);';
  if (content.includes(badDt1)) {
    content = safeReplace(content, badDt1, goodDt1);
    console.log('  -> Fixed aaY Stack Alignment (B.h -> B.aF)');
    patchCount++;
  }

  // 3. Fix Stack Alignment crash in buildPhotoDeckWidget
  const badDt2 = 'return A.dt(B.h, A.b([cellImg, _centerCircle], t.p), B.r, B.ap);';
  const goodDt2 = 'return A.dt(B.aF, A.b([cellImg, _centerCircle], t.p), B.r, B.ap);';
  if (content.includes(badDt2)) {
    content = safeReplace(content, badDt2, goodDt2);
    console.log('  -> Fixed buildPhotoDeckWidget Stack Alignment (B.h -> B.aF)');
    patchCount++;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[DONE] ${filePath}: Applied ${patchCount} adjustments.`);
});
