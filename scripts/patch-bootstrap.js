const fs = require('fs');

const bFiles = [
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'public/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

bFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let code = fs.readFileSync(f, 'utf8');
  if (code.includes('useColorEmoji')) {
    console.log('Already in', f);
    return;
  }
  const target = 'canvasKitBaseUrl: "canvaskit/"';
  if (code.includes(target)) {
    code = code.replace(target, target + ',\n    useColorEmoji: true');
    fs.writeFileSync(f, code);
    console.log('Updated', f);
  } else {
    console.log('Target not found in', f);
  }
});
