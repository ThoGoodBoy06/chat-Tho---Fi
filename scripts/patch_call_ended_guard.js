const fs = require('fs');
const path = require('path');

console.log('🚀 [PATCH CALL_ENDED GUARD] Bắt đầu vá A.ao2 trong main.dart.js để bảo vệ Caller Screen...');

const files = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const replacementAo2 = `A.ao2.prototype={
$1(a){
A.bQ("🔴 Socket call_ended: "+A.f(a));
try{
  if(t.f.b(a))$.aNP().D(0,A.cI(a,t.N,t.z));
  else $.aNP().D(0,a||A.D(t.N,t.z));
}catch(_){try{$.aNP().D(0,null);}catch(__){}}
var endedCallerId="";
var endedTargetId="";
try{
  if(a){
    endedCallerId=a.callerId||(a.get&&a.get('callerId'))||(a.d&&a.d.callerId)||"";
    endedTargetId=a.targetId||(a.get&&a.get('targetId'))||(a.d&&a.d.targetId)||"";
  }
}catch(_){}
var curPartner=window._currentCallPartnerId||"";
if(curPartner&&endedCallerId&&endedTargetId){
  if(endedCallerId!==curPartner&&endedTargetId!==curPartner){
    console.log("ℹ️ [A.ao2] Bỏ qua call_ended không thuộc partner hiện tại ("+curPartner+"): caller="+endedCallerId+", target="+endedTargetId);
    return;
  }
}
if(window.dismissIncomingCallNow){
  try{window.dismissIncomingCallNow();}catch(e){console.warn("Lỗi dismissIncomingCallNow:",e);}
}
},
$S:2}`;

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  const startMarker = 'A.ao2.prototype={';
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) {
    console.warn('⚠️ Không tìm thấy startMarker trong:', f);
    return;
  }
  const endMarker = '$S:2}';
  const endIdx = content.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    console.warn('⚠️ Không tìm thấy endMarker trong:', f);
    return;
  }

  const existingBlock = content.slice(startIdx, endIdx + endMarker.length);
  if (existingBlock.includes('Bỏ qua call_ended không thuộc partner hiện tại')) {
    console.log('ℹ️ Đã có bản vá A.ao2 trong:', f);
    return;
  }

  content = content.slice(0, startIdx) + replacementAo2 + content.slice(endIdx + endMarker.length);
  fs.writeFileSync(f, content, 'utf8');
  console.log('✅ Đã vá A.ao2 thành công cho:', f);
});

console.log('🎉 Hoàn tất vá A.ao2!');
