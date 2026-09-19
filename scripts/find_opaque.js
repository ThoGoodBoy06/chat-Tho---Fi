const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const idx = content.indexOf('"opaque"');
console.log('Index opaque:', idx);
if (idx !== -1) {
  console.log(content.slice(Math.max(0, idx - 100), idx + 100));
}
