const fs = require('fs');
const files = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  console.log(f);
  console.log('  has sending check in _checkImg:', content.includes('m.status==="sending"'));
  console.log('  has try/catch in aaY:', content.includes('catch(errAaY)'));
  console.log('  has try/catch in atR:', content.includes('catch(errAtR)'));
  console.log('  has try/catch in au_:', content.includes('catch(errTop)'));
});
