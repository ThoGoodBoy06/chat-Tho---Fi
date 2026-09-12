const fs = require('fs');
const path = require('path');

const timestamp = Date.now();
console.log(`🚀 Starting avatar URL patch with version: ${timestamp}`);

// 1. Patch chat_screen.dart
const chatScreenPath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');
if (fs.existsSync(chatScreenPath)) {
  let s = fs.readFileSync(chatScreenPath, 'utf8');
  if (s.includes('image: NetworkImage(conv.avatar!),')) {
    s = s.replace('image: NetworkImage(conv.avatar!),', 'image: NetworkImage(ApiService.formatImageUrl(conv.avatar!)),');
    fs.writeFileSync(chatScreenPath, s, 'utf8');
    console.log('  ✓ Patched chat_screen.dart line 1456');
  }
}

// 2. Patch main.dart.js across directories
const dirs = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const mainJsPath = path.join(dir, 'main.dart.js');
  if (fs.existsSync(mainJsPath)) {
    let content = fs.readFileSync(mainJsPath, 'utf8');

    // Patch NetworkImage constructor (A.eY)
    const eYRegex = /eY:function eY\(a,b,c\)\{this\.a=a[\r\n]+this\.b=b[\r\n]+this\.c=c\}/;
    const replacement = 'eY:function eY(a,b,c){if(typeof a==="string"&&!a.startsWith("http://")&&!a.startsWith("https://")&&!a.startsWith("data:")&&!a.startsWith("blob:")){try{var _b=A.da().replace(/\\/api\\/?$/,"");a=_b+(a.startsWith("/")?a:"/"+a)}catch(e){}}this.a=a\r\nthis.b=b\r\nthis.c=c}';

    if (eYRegex.test(content)) {
      content = content.replace(eYRegex, replacement);
      console.log(`  ✓ Patched A.eY (NetworkImage) in ${mainJsPath}`);
    } else if (content.includes('var _b=A.da()')) {
      console.log(`  ✓ A.eY already patched in ${mainJsPath}`);
    } else {
      console.log(`  ⚠️ Could not find A.eY constructor in ${mainJsPath}`);
    }

    fs.writeFileSync(mainJsPath, content, 'utf8');
  }

  // Update flutter_bootstrap.js version
  const bootstrapPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootstrapPath)) {
    let b = fs.readFileSync(bootstrapPath, 'utf8');
    b = b.replace(/"mainJsPath"\s*:\s*"main\.dart\.js(?:\?v=[^"]*)?"/g, `"mainJsPath":"main.dart.js?v=${timestamp}"`);
    fs.writeFileSync(bootstrapPath, b, 'utf8');
    console.log(`  ✓ Updated ${bootstrapPath}`);
  }

  // Update index.html version
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let h = fs.readFileSync(indexPath, 'utf8');
    h = h.replace(/flutter_bootstrap\.js(?:\?v=\d+)?/g, `flutter_bootstrap.js?v=${timestamp}`);
    h = h.replace(/main\.dart\.js(?:\?v=\d+)?/g, `main.dart.js?v=${timestamp}`);
    fs.writeFileSync(indexPath, h, 'utf8');
    console.log(`  ✓ Updated ${indexPath}`);
  }
});

console.log('✅ Avatar URL patch completed successfully!');
