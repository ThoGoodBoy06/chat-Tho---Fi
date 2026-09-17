const fs = require('fs');
const vm = require('vm');

const newVer = 'v_media_' + Date.now();
const bootstrapFiles = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/public/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

const htmlFiles = [
  'public/index.html',
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/web/index.html',
  'backend/flutter_frontend/build/web/index.html'
];

// 1. Update flutter_bootstrap.js safely preserving backticks
bootstrapFiles.forEach(fpath => {
  if (fs.existsSync(fpath)) {
    let content = fs.readFileSync(fpath, 'utf8');
    // Ensure backtick before comma
    content = content.replace(/entrypointUrl:n=\`\$\{w\}main\.dart\.js(\?v=[^\`,\"]+)?\`?/g, 'entrypointUrl:n=`${w}main.dart.js?v=' + newVer + '`');
    content = content.replace(/mainJsPath:\??"main\.dart\.js(\?v=[^\`,\"]+)?"/g, 'mainJsPath:"main.dart.js?v=' + newVer + '"');
    content = content.replace(/"main\.dart\.js(\?v=[^\`,\"]+)?"/g, '"main.dart.js?v=' + newVer + '"');
    fs.writeFileSync(fpath, content, 'utf8');
    new vm.Script(content);
    console.log('✅ Safely updated & validated bootstrap:', fpath);
  }
});

// 2. Update index.html
htmlFiles.forEach(fpath => {
  if (fs.existsSync(fpath)) {
    let content = fs.readFileSync(fpath, 'utf8');
    content = content.replace(/flutter_bootstrap\.js(\?v=[^"'\s>]+)?/g, 'flutter_bootstrap.js?v=' + newVer);
    content = content.replace(/main\.dart\.js(\?v=[^"'\s>]+)?/g, 'main.dart.js?v=' + newVer);
    fs.writeFileSync(fpath, content, 'utf8');
    console.log('✅ Updated HTML:', fpath);
  }
});
