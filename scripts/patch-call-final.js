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

  // 1. Đảm bảo agj lưu window._incomingCallShowing = true và window._incomingNav = A.b1(o, !0)
  const targetAgjOld = 'o=this.c\no.toString\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';
  const targetAgjWithNav = 'o=this.c\no.toString\nwindow._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';
  const newAgj = 'o=this.c\no.toString\nwindow._incomingCallShowing=true;window._incomingNav=A.b1(o,!0);window._incomingCallTimerHolder=p;\nA.aNr(B.HV,!1,"IncomingCall",o,new A.avh(p,this,m,r,r==="video",s),q,B.J,t.X)';

  if (norm.includes(targetAgjWithNav)) {
    norm = norm.replace(targetAgjWithNav, newAgj);
    console.log('✅ 1. Đã cập nhật agj cho:', dir);
  } else if (norm.includes(targetAgjOld)) {
    norm = norm.replace(targetAgjOld, newAgj);
    console.log('✅ 1. Đã vá agj cho:', dir);
  } else if (norm.includes('window._incomingCallShowing=true;window._incomingNav=')) {
    console.log('ℹ️ 1. agj đã chuẩn xác trong:', dir);
  }

  // 2. Đảm bảo A.avh.$3 lưu window._incomingCallShowing = true và window._incomingCallContext = a
  const targetAvhSearch = 'A.avh.prototype={\n$3(a,b,c){var s,r,q,p,o,n,m=this,l=null,k=m.c,j=m.d,i=m.a\n';
  const newAvhStart = 'A.avh.prototype={\n$3(a,b,c){var s,r,q,p,o,n,m=this,l=null,k=m.c,j=m.d,i=m.a\nwindow._incomingCallShowing=true;window._incomingCallContext=a;window._incomingCallTimer=i;window._incomingRejectAction=new A.ave(i,k,j,a);\n';

  if (norm.includes(targetAvhSearch)) {
    // Tìm đến dòng i.a=A.c_(B.cO
    const avhBlockEnd = norm.indexOf('i.a=A.c_(B.cO,new A.avd(k,j,a))', norm.indexOf(targetAvhSearch));
    if (avhBlockEnd !== -1) {
      const avhBlockStart = norm.indexOf(targetAvhSearch);
      norm = norm.substring(0, avhBlockStart) + newAvhStart + norm.substring(avhBlockEnd);
      console.log('✅ 2. Đã cập nhật A.avh cho:', dir);
    }
  }

  // 3. Chuẩn hóa A.ao2.$1: Pop Root Navigator (!0) và luôn phát $.aNP().D(0,null)
  const oldAo2Start = norm.indexOf('A.ao2.prototype={\n$1(a){');
  const oldAo2End = norm.indexOf('},\n$S:2}\nA.ao3.prototype=') + 2;

  if (oldAo2Start !== -1 && oldAo2End !== -1) {
    const oldAo2 = norm.substring(oldAo2Start, oldAo2End);

    const cleanAo2 = `A.ao2.prototype={
$1(a){
A.bQ("🔴 Socket call_ended: Bắt đầu xử lý...");
$.aNP().D(0,null);
if(window._incomingCallShowing || window._incomingCallContext || window._incomingNav){
  window._incomingCallShowing=false;
  try{
    if(window._incomingCallTimer&&window._incomingCallTimer.a)window._incomingCallTimer.a.ai(0);
    if(window._incomingCallTimerHolder&&window._incomingCallTimerHolder.a)window._incomingCallTimerHolder.a.ai(0);
  }catch(_){}
  var _closed=false;
  try{
    if(window._incomingNav){
      window._incomingNav.dN(0);
      _closed=true;
      A.bQ("🔴 [Auto-Close] Đã đóng incoming dialog qua _incomingNav (Root Navigator)!");
    }
  }catch(e){console.warn("Lỗi _incomingNav:",e);}
  if(!_closed){
    try{
      if(window._incomingCallContext){
        A.b1(window._incomingCallContext,!0).dN(0);
        _closed=true;
        A.bQ("🔴 [Auto-Close] Đã đóng incoming dialog qua _incomingCallContext (!0)!");
      }
    }catch(e){console.warn("Lỗi _incomingCallContext root:",e);}
  }
  if(!_closed){
    try{
      if(window._incomingCallContext){
        A.b1(window._incomingCallContext,!1).dN(0);
        A.bQ("🔴 [Auto-Close] Đã đóng incoming dialog qua _incomingCallContext (!1)!");
      }
    }catch(e){console.warn("Lỗi _incomingCallContext local:",e);}
  }
  window._incomingNav=null;
  window._incomingCallContext=null;
  window._incomingCallTimer=null;
  window._incomingCallTimerHolder=null;
  window._incomingRejectAction=null;
}
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

    norm = norm.replace(oldAo2, cleanAo2);
    console.log('✅ 3. Đã nâng cấp A.ao2 hoàn hảo cho:', dir);
  } else {
    console.warn('⚠️ Không tìm thấy khối A.ao2 trong:', dir);
  }

  const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
  fs.writeFileSync(mainJsPath, result, 'utf8');
  console.log('🎉 Đã ghi main.dart.js thành công cho:', dir);

  // 4. Cập nhật flutter_bootstrap.js
  const bootPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootPath)) {
    let bootContent = fs.readFileSync(bootPath, 'utf8');
    bootContent = bootContent.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    fs.writeFileSync(bootPath, bootContent, 'utf8');
    console.log('✅ Đã cập nhật cache buster trong flutter_bootstrap.js cho:', dir);
  }

  // 5. Cập nhật index.html
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    indexContent = indexContent.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    indexContent = indexContent.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
    fs.writeFileSync(indexPath, indexContent, 'utf8');
    console.log('✅ Đã cập nhật cache buster trong index.html cho:', dir);
  }
});

console.log('\n🌟 Hoàn tất toàn bộ cập nhật hoàn hảo!');
