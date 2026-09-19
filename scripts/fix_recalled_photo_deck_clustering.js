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

  // 1. Filter out recalled messages from cluster in buildPhotoDeckWidget
  const searchDeck = `$.buildPhotoDeckWidget = function(cluster, chatState, isMe, ctx, prov) {\n  if (!cluster || cluster.length < 2) return null;\n\n  // Nếu TẤT CẢ ảnh trong cụm đều đã bị thu hồi -> trả về null để rơi xuống render 1 bong bóng "Tin nhắn đã được thu hồi" duy nhất\n  var allRecalled = cluster.every(function(m) { return m && m.y; });\n  if (allRecalled) return null;`;
  const replDeck = `$.buildPhotoDeckWidget = function(cluster, chatState, isMe, ctx, prov) {\n  if (!cluster || !cluster.length) return null;\n  cluster = cluster.filter(function(m) { return m && !m.y && !m.isRecalled; });\n  if (cluster.length < 2) return null;`;

  if (content.includes(searchDeck)) {
    content = safeReplace(content, searchDeck, replDeck);
    console.log('  -> Patched buildPhotoDeckWidget to filter recalled messages (LF)');
    patchCount++;
  } else {
    // Check CRLF
    const searchDeckCRLF = searchDeck.split('\n').join('\r\n');
    const replDeckCRLF = replDeck.split('\n').join('\r\n');
    if (content.includes(searchDeckCRLF)) {
      content = safeReplace(content, searchDeckCRLF, replDeckCRLF);
      console.log('  -> Patched buildPhotoDeckWidget to filter recalled messages (CRLF)');
      patchCount++;
    }
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
