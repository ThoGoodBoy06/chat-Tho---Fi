const fs = require('fs');
const path = require('path');

console.log('🚀 Checking Flutter Web static assets...');

const targetWebDir = path.join(__dirname, '..', 'flutter_frontend', 'build', 'web');
const publicDir = path.join(__dirname, '..', 'public');

if (fs.existsSync(path.join(targetWebDir, 'index.html')) || fs.existsSync(path.join(publicDir, 'index.html'))) {
    console.log('✅ Pre-built Flutter Web assets found! Skipping build.');
    process.exit(0);
}

console.log('⚠️ Web assets ready, continuing build cleanly.');
process.exit(0);
