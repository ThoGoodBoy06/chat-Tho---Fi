const fs = require('fs');
const vm = require('vm');

const files = [
  'public/flutter_bootstrap.js',
  'flutter_frontend/build/web/flutter_bootstrap.js',
  'backend/public/flutter_bootstrap.js',
  'backend/flutter_frontend/build/web/flutter_bootstrap.js'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Look for entrypointUrl:n=`${w}main.dart.js?v=... where closing backtick is missing before ,onEntrypointLoaded
  content = content.replace(/entrypointUrl:n=\`\$\{w\}main\.dart\.js\?v=([^,\`]+),onEntrypointLoaded/g, 'entrypointUrl:n=`${w}main.dart.js?v=$1`,onEntrypointLoaded');
  fs.writeFileSync(f, content, 'utf8');
  new vm.Script(content);
  console.log('✅ Perfectly valid now:', f);
});

// Also fix update_cache_bust.js so it never eats backticks
let updater = fs.readFileSync('scripts/update_cache_bust.js', 'utf8');
updater = updater.replace(/main\\\.dart\\\.js\(\\\?v=\[\^\"\'\\\\s,\)\]\+\)\?/g, 'main\\\\.dart\\\\.js(\\\\?v=[^"\'\\\\s,)\`]+)?');
fs.writeFileSync('scripts/update_cache_bust.js', updater, 'utf8');
console.log('✅ Updated scripts/update_cache_bust.js');
