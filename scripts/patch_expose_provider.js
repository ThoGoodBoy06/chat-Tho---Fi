const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('$._activeChatProvider=a0;')) {
    console.log(`[ALREADY] ${file}`);
    return;
  }
  content = content.replace(
    '$._currentActiveChatConvId=a.a;\r\n$._activeChatScreenState=c;',
    '$._currentActiveChatConvId=a.a;\r\n$._activeChatScreenState=c;\r\n$._activeChatProvider=a0;\r\nwindow._activeChatProvider=a0;'
  );
  content = content.replace(
    '$._currentActiveChatConvId=a.a;\n$._activeChatScreenState=c;',
    '$._currentActiveChatConvId=a.a;\n$._activeChatScreenState=c;\n$._activeChatProvider=a0;\nwindow._activeChatProvider=a0;'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log(`[PATCHED] ${file}`);
  new vm.Script(content);
  console.log(`[PASS] Syntax check passed`);
});
