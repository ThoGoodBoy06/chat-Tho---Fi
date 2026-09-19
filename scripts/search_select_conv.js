const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const pos = 2347206;
console.log(content.slice(pos - 700, pos + 400));
