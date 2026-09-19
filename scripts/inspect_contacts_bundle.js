const fs = require('fs');

const code = fs.readFileSync('public/main.dart.js', 'utf8');

// 1. Find aaT
const aaTIdx = code.indexOf('aaT(a){');
console.log('aaTIdx:', aaTIdx);
if (aaTIdx !== -1) {
  console.log('--- aaT snippet ---');
  console.log(code.slice(aaTIdx, aaTIdx + 1200));
}

// 2. Find A.auy.prototype.$2
const auyIdx = code.indexOf('A.auy.prototype={');
console.log('auyIdx:', auyIdx);
if (auyIdx !== -1) {
  console.log('--- auy snippet ---');
  console.log(code.slice(auyIdx, auyIdx + 1400));
}

// 3. Find A.auI.prototype.$2 (empty state)
const auIIdx = code.indexOf('auI.prototype={');
console.log('auIIdx:', auIIdx);
if (auIIdx !== -1) {
  console.log('--- auI snippet ---');
  console.log(code.slice(auIIdx, auIIdx + 700));
}
