const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  // 1. Lưu window._incomingCallContext và timer trong A.avh.prototype
  const targetAvh = '$3(a,b,c){var s,r,q,p,o,n,m=this,l=null,k=m.c,j=m.d,i=m.a\ni.a=A.c_(B.cO,new A.avd(k,j,a))';
  const newAvh = '$3(a,b,c){var s,r,q,p,o,n,m=this,l=null,k=m.c,j=m.d,i=m.a\nwindow._incomingCallContext=a;window._incomingCallTimer=i;\ni.a=A.c_(B.cO,new A.avd(k,j,a))';

  if (norm.includes(targetAvh)) {
    norm = norm.replace(targetAvh, newAvh);
    console.log('✅ 1. Đã lưu _incomingCallContext trong A.avh cho:', file);
  } else if (norm.includes('window._incomingCallContext=a;')) {
    console.log('ℹ️ 1. Đã có _incomingCallContext trong:', file);
  } else {
    console.warn('⚠️ 1. Không tìm thấy targetAvh trong:', file);
  }

  // 2. Lưu window._activeCallContext trong A.aw4.prototype
  const targetAw4 = 'A.aw4.prototype={\n$3(a,b,c){var s=this\nreturn new A.ty(new A.aw_(s.a,s.b,s.c,s.d,s.e,s.f,s.r,s.w,a,s.x),null)},';
  const newAw4 = 'A.aw4.prototype={\n$3(a,b,c){var s=this;window._activeCallContext=a;\nreturn new A.ty(new A.aw_(s.a,s.b,s.c,s.d,s.e,s.f,s.r,s.w,a,s.x),null)},';

  if (norm.includes(targetAw4)) {
    norm = norm.replace(targetAw4, newAw4);
    console.log('✅ 2. Đã lưu _activeCallContext trong A.aw4 cho:', file);
  } else if (norm.includes('window._activeCallContext=a;')) {
    console.log('ℹ️ 2. Đã có _activeCallContext trong:', file);
  } else {
    console.warn('⚠️ 2. Không tìm thấy targetAw4 trong:', file);
  }

  // 3. Nâng cấp A.ao2.prototype để đóng ngay lập tức cả incoming dialog và active call khi nhận call_ended
  const targetAo2 = 'A.ao2.prototype={\n$1(a){A.bQ("\\ud83d\\udd34 Socket call_ended")\n$.aNP().D(0,null)},';
  const newAo2 = `A.ao2.prototype={
$1(a){A.bQ("\\ud83d\\udd34 Socket call_ended");
$.aNP().D(0,null);
if(window._incomingCallContext){
  try{
    if(window._incomingCallTimer&&window._incomingCallTimer.a)window._incomingCallTimer.a.ai(0);
    A.b1(window._incomingCallContext,!1).dN(0);
    A.bQ("🔴 [Auto-Close] Đã đóng màn hình cuộc gọi đến ngay khi nhận call_ended!");
  }catch(e){console.warn("Lỗi đóng incoming dialog:",e);}
  window._incomingCallContext=null;window._incomingCallTimer=null;
}
if(window._activeCallContext){
  try{A.b1(window._activeCallContext,!1).dN(0);}catch(_){}
  window._activeCallContext=null;
}
var _ra=document.getElementById("remoteAudioPlayer");
if(_ra){try{_ra.pause();_ra.srcObject=null;}catch(_){}}
var _lv=document.getElementById("localVideoPlayer");
if(_lv){try{_lv.pause();_lv.srcObject=null;_lv.remove();}catch(_){}}
var _rv=document.getElementById("remoteVideoPlayer");
if(_rv){try{_rv.pause();_rv.srcObject=null;_rv.remove();}catch(_){}}
},`;

  if (norm.includes(targetAo2)) {
    norm = norm.replace(targetAo2, newAo2);
    console.log('✅ 3. Đã nâng cấp A.ao2 đóng dialog ngay khi có call_ended cho:', file);
  } else if (norm.includes('Auto-Close')) {
    console.log('ℹ️ 3. A.ao2 đã có Auto-Close trong:', file);
  } else {
    console.warn('⚠️ 3. Không tìm thấy targetAo2 trong:', file);
  }

  // 4. Xóa cờ khi bấm Từ chối (A.ave)
  const targetAve = 'A.ave.prototype={\n$0(){var s,r=this,q=r.a.a\nif(q!=null)q.ai(0)';
  const newAve = 'A.ave.prototype={\n$0(){var s,r=this,q=r.a.a\nwindow._incomingCallContext=null;window._incomingCallTimer=null;\nif(q!=null)q.ai(0)';

  if (norm.includes(targetAve)) {
    norm = norm.replace(targetAve, newAve);
    console.log('✅ 4. Đã reset cờ khi bấm Từ chối cho:', file);
  }

  // 5. Xóa cờ khi bấm Trả lời (A.avf)
  const targetAvf = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nif(p!=null)p.ai(0)';
  const newAvf = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nwindow._incomingCallContext=null;window._incomingCallTimer=null;\nif(p!=null)p.ai(0)';

  if (norm.includes(targetAvf)) {
    norm = norm.replace(targetAvf, newAvf);
    console.log('✅ 5. Đã reset cờ khi bấm Trả lời cho:', file);
  }

  // 6. Xóa cờ khi hết 30s tự từ chối (A.avd)
  const targetAvd = 'A.avd.prototype={\n$0(){var s,r=$.bj';
  const newAvd = 'A.avd.prototype={\n$0(){var s,r=$.bj\nwindow._incomingCallContext=null;window._incomingCallTimer=null;';

  if (norm.includes(targetAvd)) {
    norm = norm.replace(targetAvd, newAvd);
    console.log('✅ 6. Đã reset cờ khi autoReject cho:', file);
  }

  const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
  fs.writeFileSync(file, result, 'utf8');
  console.log('🎉 Đã ghi tệp thành công:', file);
});

console.log('\n--- Đồng bộ sang index.html cache buster ---');
const indexFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
];

indexFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const now = Date.now();
  html = html.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
  fs.writeFileSync(file, html, 'utf8');
  console.log('✅ Đã cập nhật version cache buster cho:', file);
});

console.log('\n🌟 Đã hoàn tất vá toàn bộ bản build Web!');
