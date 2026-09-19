const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const searchStr = 'J.Z(m,"data")';
const pos = content.indexOf(searchStr);
console.log('pos:', pos);
if (pos !== -1) {
  console.log(content.slice(Math.max(0, pos - 400), pos + 100));
}
