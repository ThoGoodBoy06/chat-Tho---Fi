const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const pos = 2346500;
console.log(content.slice(pos - 400, pos + 200));
