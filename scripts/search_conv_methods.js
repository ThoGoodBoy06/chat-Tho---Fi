const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const pos = 663872;
console.log(content.slice(pos, pos + 2500));
