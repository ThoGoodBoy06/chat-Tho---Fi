const fs = require('fs');
const path = require('path');

const tag = 'v_fix_' + Date.now();
const files = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/main\.dart\.js\?v=[a-zA-Z0-9_\-]+/g, 'main.dart.js?v=' + tag);
    c = c.replace(/webrtc_audio_helper\.js\?v=[a-zA-Z0-9_\-]+/g, 'webrtc_audio_helper.js?v=' + tag);
    fs.writeFileSync(f, c, 'utf8');
    console.log('Cache bust updated:', f);
  }
});
console.log('Done, tag is:', tag);
