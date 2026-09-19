const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const idx = content.indexOf('A.awq.prototype={');
console.log(content.slice(idx, idx + 200));
