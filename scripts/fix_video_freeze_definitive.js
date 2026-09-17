const fs = require('fs');

console.log('🚀 Bắt đầu sửa dứt điểm lỗi đơ app khi lướt đến tin nhắn video...');

const jsPaths = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsPaths.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let modified = false;

  // Thay thế block _isVid trong aaY bằng phiên bản siêu nhẹ, chuẩn 100% theo pattern của Image
  // Tuyệt đối không gọi DOM/network trong hàm build, dùng B.FH chuẩn constraints Flutter
  const oldVidPattern = /var _isVid=\(o==="video"\)[\s\S]*?return A\.dr\(d,_vRow,B\.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}[\r\n\s]*\}/;

  const lightweightVidBlock = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
try{
var _vUrl=a.videoUrl||a.f||s||"";
if(_vUrl&&_vUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_vUrl=_be+_vUrl;}
var _vThumb=(window._videoThumbCache&&window._videoThumbCache[_vUrl])||a.f||"";
var _vBg=null;
if(_vThumb&&typeof _vThumb==="string"&&_vThumb.length>10){
if(J.pX(_vThumb,e)){
try{var _b64=B.b.ga5(J.a5C(_vThumb,",")),_u8=B.kC.ci(_b64);_vBg=new A.mD(A.aLD(d,d,new A.oH(_u8,1)),new A.auP(),d,d,B.cp,B.e8,d);}catch(_){}
}else if(J.pX(_vThumb,"http")||J.pX(_vThumb,"/")){
_vBg=new A.mD(A.aLD(d,d,new A.eY(_vThumb,1,d)),new A.auQ(),d,d,B.cp,B.e8,d);
}
}
if(!_vBg){
var _vmIcon=A.bV(new A.ax(62413,!1),new A.q(536870911),d,54);
_vBg=A.a5(d,_vmIcon,B.h,d,d,new A.ak(new A.q(4279244074),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
}
var _vShade=A.a5(d,d,d,d,d,new A.ak(new A.q(855638016),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);
var _centerWidget;
if(_isSending){
var _spinIcon=A.bV(B.rw,B.f,d,20);
var _lbl=A.a2("Đang tải video...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _pillRow=A.b9(A.b([_spinIcon,B.aT,_lbl],t.p),B.l,B.m,B.G);
_centerWidget=A.a5(d,_pillRow,B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(16),d,d,B.t),d,d,d,d,d,d,d);
}else{
var _playIcon=A.bV(new A.ax(57399,!1),B.f,d,28);
_centerWidget=A.a5(d,_playIcon,B.h,d,d,new A.ak(new A.q(4279326465),d,d,A.ag(24),d,d,B.t),d,d,d,d,d,d,d);
}
var _stack=A.dt(B.h,A.b([_vBg,_vShade,_centerWidget],t.p),B.r,B.ap);
var _card=A.a5(d,_stack,B.h,d,B.FH,d,d,d,d,d,d,d,d);
return A.dr(d,A.aP5(A.ag(14),_card),B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}catch(err){
var _vUrl=a.videoUrl||a.f||s||"";
var _vIcon=A.bV(B.aaN,b?B.f:B.a1,d,22);
var _vText=A.a2("▶ Xem video",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _vRow=A.b9(A.b([_vIcon,B.aT,new A.eT(1,B.bv,_vText,d)],t.p),B.l,B.m,B.G);
return A.dr(d,_vRow,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}
}`;

  if (oldVidPattern.test(js)) {
    js = js.replace(oldVidPattern, lightweightVidBlock);
    modified = true;
    console.log(`  [${p}] Đã vá aaY sang lightweightVidBlock không bị đơ`);
  } else {
    // Thử regex linh hoạt hơn nếu trước đó có định dạng khác
    const flexPattern = /var _isVid=\(o==="video"\)[\s\S]*?new A\.aVidTap\(_vUrl\)[\s\S]*?B\.ao\);[\r\n\s]*\}/;
    if (flexPattern.test(js)) {
      js = js.replace(flexPattern, lightweightVidBlock);
      modified = true;
      console.log(`  [${p}] Đã vá aaY (flexPattern)`);
    }
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Đã lưu ${p}`);
  }
});

console.log('🏁 Hoàn thành vá dứt điểm freeze!');
