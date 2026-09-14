const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const intactBootstrap = cp.execSync('git show HEAD~1:flutter_frontend/build/web/flutter_bootstrap.js').toString();

const v = Date.now();
// Cleanly replace ONLY the version in _flutter.buildConfig
const cleanBootstrap = intactBootstrap.replace('main.dart.js?v=1789318398100', `main.dart.js?v=${v}`);

const targets = [
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'flutter_frontend/web/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js',
  'public/flutter_bootstrap.js'
];

for (const rel of targets) {
  const p = path.resolve(__dirname, '..', rel);
  if (fs.existsSync(p)) {
    fs.writeFileSync(p, cleanBootstrap, 'utf8');
    cp.execSync(`node --check "${p}"`);
    console.log('✅ Fixed & Validated:', rel);
  }
}

// Also update index.html preload link to match
const indexTargets = [
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'public/index.html'
];

for (const rel of indexTargets) {
  const p = path.resolve(__dirname, '..', rel);
  if (fs.existsSync(p)) {
    let html = fs.readFileSync(p, 'utf8');
    html = html.replace(/flutter_bootstrap\.js\?v=\d+/g, `flutter_bootstrap.js?v=${v}`);
    fs.writeFileSync(p, html, 'utf8');
    console.log('✅ Updated index.html bootstrap version in:', rel);
  }
}

console.log('All bootstrap files repaired and verified successfully!');
