const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const tapCode = '\n' +
'A.atTap = function atTap(a, b) {\n' +
'  this.a = a;\n' +
'  this.b = b;\n' +
'};\n' +
'A.atTap.prototype = {\n' +
'  $0: function() {\n' +
'    var state = this.a;\n' +
'    var msgId = this.b.a;\n' +
'    state._tsMsgIds = state._tsMsgIds || new Set();\n' +
'    if (state._tsMsgIds.has(msgId)) {\n' +
'      state._tsMsgIds.delete(msgId);\n' +
'    } else {\n' +
'      state._tsMsgIds.add(msgId);\n' +
'    }\n' +
'    state.K({\n' +
'      $0: function() {},\n' +
'      $S: 0\n' +
'    });\n' +
'  },\n' +
'  $S: 0\n' +
'};\n';

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // Remove from the beginning if it starts with A.atTap
  if (js.trimStart().startsWith('A.atTap = function')) {
    const endMarker = '$S: 0\n};';
    const endIdx = js.indexOf(endMarker) + endMarker.length;
    js = js.substring(endIdx).trimStart();
    console.log('Removed A.atTap from beginning of', f);
  }

  // Append at the end
  if (!js.includes('A.atTap = function')) {
    js = js + tapCode;
    console.log('Appended A.atTap to end of', f);
  }

  fs.writeFileSync(f, js);
});
