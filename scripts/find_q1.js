const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const search = 'Q1("file")';
let idx = 0;
while ((idx = content.indexOf(search, idx)) !== -1) {
  console.log('--- At', idx, '---');
  console.log(content.substring(idx - 100, idx + 250));
  idx += search.length;
}
