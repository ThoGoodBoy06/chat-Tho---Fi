const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');

// Let's find where a2L is in public/main.dart.js
const idx = content.indexOf('a2L(a){');
console.log('a2L snippet:');
console.log(content.substring(idx, idx + 800));
