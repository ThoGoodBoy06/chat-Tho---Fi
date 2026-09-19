const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const targetRegex = /atV:function atV\(a,b,c,d,e\)\{var _=this\s*_\.a=a\s*_\.b=b\s*_\.c=c\s*_\.d=d\s*_\.e=e\},/;

const replacement = `atV:function atV(a,b,c,d,e){var _=this
_.a=a
_.b=b
_.c=c
_.d=d
_.e=e
window._openLastContextMenu=function(){try{a.VK(b,c,d,e);}catch(err){console.warn('openLastContextMenu err:',err);}};
},`;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Đã gắn _openLastContextMenu vào:', file);
  } else if (code.includes('window._openLastContextMenu=')) {
    console.log('ℹ️ Đã có _openLastContextMenu trong:', file);
  } else {
    console.warn('⚠️ Không khớp targetRegex trong:', file);
  }

  try {
    new vm.Script(code);
    console.log('  [Syntax OK] vm.Script pass:', file);
  } catch (err) {
    console.error('❌ Lỗi cú pháp trong:', file, err);
    process.exit(1);
  }
});
