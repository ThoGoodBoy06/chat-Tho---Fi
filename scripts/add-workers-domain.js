const fs = require('fs');

const files = [
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js'
];

for (const p of files) {
  if (!fs.existsSync(p)) continue;
  let c = fs.readFileSync(p, 'utf8');

  // Replace socket check
  c = c.replace(
    'n.includes("pages.dev")',
    'n.includes("pages.dev")||n.includes("workers.dev")'
  );

  // Replace api check
  c = c.replace(
    'q.includes("pages.dev")',
    'q.includes("pages.dev")||q.includes("workers.dev")'
  );

  fs.writeFileSync(p, c, 'utf8');
  console.log('✅ Updated', p);
}
console.log('All files updated with workers.dev!');
