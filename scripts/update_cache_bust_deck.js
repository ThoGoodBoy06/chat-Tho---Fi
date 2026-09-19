const fs = require('fs');
const now = Date.now();
const indexFiles = [
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'public/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/web/index.html'
];
indexFiles.forEach(f => {
  if (fs.existsSync(f)) {
    let h = fs.readFileSync(f, 'utf8');
    h = h.replace(/main\.dart\.js\?v=[^"']+/g, 'main.dart.js?v=v_deck_' + now);
    fs.writeFileSync(f, h, 'utf8');
    console.log('Updated cache bust in', f);
  }
});
