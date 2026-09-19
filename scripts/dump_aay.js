const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const idx = content.indexOf('_sl=');
console.log(content.substring(idx, idx + 1500));
