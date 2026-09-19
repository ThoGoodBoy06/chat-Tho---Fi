const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const idx = content.indexOf(',dr(a,');
console.log('Index ,dr(a,:', idx);
if (idx !== -1) {
  console.log(content.slice(idx, idx + 300));
} else {
  // Find where dr is defined
  const m = content.match(/dr\s*:\s*function[^(]*\([^)]*\)/);
  if (m) console.log(m[0]);
  const m2 = content.match(/dr\s*\([^)]*\)\s*\{/);
  if (m2) console.log(m2[0]);
}
