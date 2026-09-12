const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dirs = [
  path.join(ROOT, 'public'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web')
];

const now = Date.now();
console.log('Timestamp mới:', now);

dirs.forEach(dir => {
  const mainJsPath = path.join(dir, 'main.dart.js');
  if (!fs.existsSync(mainJsPath)) return;

  let content = fs.readFileSync(mainJsPath, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  // 1. Vá trong agj: Lưu cờ window._incomingCallShowing = true
  const targetAgj = 'o=this.c\no.toString\nwindow._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';
  const newAgj = 'o=this.c\no.toString\nwindow._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';

  if (norm.includes(targetAgj)) {
    norm = norm.replace(targetAgj, newAgj);
    console.log('✅ 1. Đã cập nhật _incomingCallShowing trong agj cho:', dir);
  } else if (norm.includes('window._incomingCallShowing=true;')) {
    console.log('ℹ️ 1. agj đã có _incomingCallShowing=true trong:', dir);
  }

  // 2. Reset cờ trong A.ave (Từ chối)
  const targetAve = 'window._incomingCallContext=null;window._incomingCallTimer=null;';
  const newAve = 'window._incomingCallShowing=false;window._incomingCallContext=null;window._incomingCallTimer=null;window._incomingNav=null;';
  if (norm.includes(targetAve)) {
    norm = norm.replace(targetAve, newAve);
    console.log('✅ 2. Đã cập nhật reset cờ trong A.ave cho:', dir);
  }

  // 3. Reset cờ trong A.avf (Trả lời)
  const targetAvf = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nwindow._incomingCallContext=null;window._incomingCallTimer=null;';
  const newAvf = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nwindow._incomingCallShowing=false;window._incomingCallContext=null;window._incomingCallTimer=null;window._incomingNav=null;';
  if (norm.includes(targetAvf)) {
    norm = norm.replace(targetAvf, newAvf);
    console.log('✅ 3. Đã cập nhật reset cờ trong A.avf cho:', dir);
  }

  // 4. Reset cờ trong A.avd (Auto reject 30s)
  const targetAvd = 'A.avd.prototype={\n$0(){var s,r=$.bj\nwindow._incomingCallContext=null;window._incomingCallTimer=null;';
  const newAvd = 'A.avd.prototype={\n$0(){var s,r=$.bj\nwindow._incomingCallShowing=false;window._incomingCallContext=null;window._incomingCallTimer=null;window._incomingNav=null;';
  if (norm.includes(targetAvd)) {
    norm = norm.replace(targetAvd, newAvd);
    console.log('✅ 4. Đã cập nhật reset cờ trong A.avd cho:', dir);
  }

  // 5. Chuẩn hóa A.ao2.$1: KHÔNG BAO GIỜ GỌI POP 2 LẦN
  const oldAo2Start = norm.indexOf('A.ao2.prototype={\n$1(a){');
  const oldAo2End = norm.indexOf('},\n$S:2}\nA.ao3.prototype=') + 2;
  const oldAo2 = norm.substring(oldAo2Start, oldAo2End);

  const cleanAo2 = `A.ao2.prototype={
$1(a){
A.bQ("🔴 Socket call_ended: Bắt đầu xử lý...");
// 1. Nếu đang hiển thị cuộc gọi đến (chưa nghe máy), đóng DUY NHẤT 1 lần
if(window._incomingCallShowing){
  window._incomingCallShowing=false;
  try{
    if(window._incomingCallTimer&&window._incomingCallTimer.a)window._incomingCallTimer.a.ai(0);
    if(window._incomingCallTimerHolder&&window._incomingCallTimerHolder.a)window._incomingCallTimerHolder.a.ai(0);
  }catch(_){}
  try{
    if(window._incomingCallContext&&A.b1(window._incomingCallContext,!1).rB()){
      A.b1(window._incomingCallContext,!1).dN(0);
      A.bQ("🔴 [Auto-Close] Đã đóng incoming dialog thành công!");
    }else if(window._incomingNav&&window._incomingNav.rB()){
      window._incomingNav.dN(0);
      A.bQ("🔴 [Auto-Close] Đã đóng incoming qua _incomingNav thành công!");
    }
  }catch(e){console.warn("Lỗi đóng incoming dialog:",e);}
  window._incomingNav=null;
  window._incomingCallContext=null;
  window._incomingCallTimer=null;
  window._incomingCallTimerHolder=null;
}else{
  // 2. Nếu đang trong cuộc gọi (Active call), kích hoạt Dart stream để A.avD tự đóng an toàn (duy nhất 1 pop)
  $.aNP().D(0,null);
}
// 3. Tắt âm thanh chuông và dọn thẻ video
try{
  var _media=document.querySelectorAll("audio, video");
  for(var _i=0;_i<_media.length;_i++){
    try{_media[_i].pause();_media[_i].currentTime=0;_media[_i].srcObject=null;}catch(_){}
    if(_media[_i].id==="localVideoPlayer"||_media[_i].id==="remoteVideoPlayer"){
      try{_media[_i].remove();}catch(_){}
    }
  }
}catch(_){}
},`;

  if (oldAo2 && oldAo2.includes('A.ao2.prototype=')) {
    norm = norm.replace(oldAo2, cleanAo2);
    console.log('✅ 5. Đã tinh chỉnh A.ao2 CHỐNG MÀN HÌNH TRẮNG cho:', dir);
  } else {
    console.warn('⚠️ 5. Không tìm thấy oldAo2 trong:', dir);
  }

  const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
  fs.writeFileSync(mainJsPath, result, 'utf8');
  console.log('🎉 Đã ghi main.dart.js thành công cho:', dir);

  // 6. Cập nhật flutter_bootstrap.js
  const bootPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootPath)) {
    let bootContent = fs.readFileSync(bootPath, 'utf8');
    bootContent = bootContent.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    fs.writeFileSync(bootPath, bootContent, 'utf8');
    console.log('✅ 6. Đã cập nhật cache buster trong flutter_bootstrap.js cho:', dir);
  }

  // 7. Cập nhật index.html
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    indexContent = indexContent.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    indexContent = indexContent.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log('✅ 7. Đã cập nhật cache buster trong index.html cho:', dir);
  }
});

console.log('\n🌟 Hoàn tất tinh chỉnh chống màn hình trắng!');
