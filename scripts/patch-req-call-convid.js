const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const target = 'if(r!=null)r.cn("request_call",A.V(["callerId",q,"callerName",n,"callerAvatar",m,"calleeId",s,"callType",c?"video":"audio"],t.N,t.T))';
const replacement = 'var _cId=(j&&j.b)||window._currentActiveChatConvId||"";if(r!=null)r.cn("request_call",A.V(["callerId",q,"callerName",n,"callerAvatar",m,"calleeId",s,"callType",c?"video":"audio","conversationId",_cId],t.N,t.T))';

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let js = fs.readFileSync(jf, 'utf8');
  if (js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync(jf, js, 'utf8');
    console.log('✅ Đã thêm conversationId vào request_call trong:', jf);
  } else {
    console.log('ℹ️ Không thấy target hoặc đã thêm trong:', jf);
  }
});
