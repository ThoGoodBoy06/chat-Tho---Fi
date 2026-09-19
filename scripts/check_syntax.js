const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');

const idx1 = content.indexOf('var _optId="optimistic-');
console.log('idx1:', idx1);
if (idx1 !== -1) {
  console.log('--- a2L ---');
  console.log(content.substring(idx1 - 100, idx1 + 800));
}

const idx2 = content.indexOf('var _centerCircle=');
console.log('idx2:', idx2);
if (idx2 !== -1) {
  console.log('--- aaY ---');
  console.log(content.substring(idx2 - 150, idx2 + 300));
}

// Check syntax of entire main.dart.js!
try {
  // Use vm.Script to check syntax
  const vm = require('vm');
  new vm.Script(content);
  console.log('SUCCESS: public/main.dart.js has NO syntax errors!');
} catch (e) {
  console.error('SYNTAX ERROR in public/main.dart.js:', e.message);
  console.error(e.stack);
}
