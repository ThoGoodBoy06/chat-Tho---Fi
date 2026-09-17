const fs = require('fs');

console.log('🚀 Bắt đầu sửa lỗi Grey Box khi gửi video và tối ưu hóa Video Player Card...');

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

  // 1. Thay thế block _isVid trong aaY bằng phiên bản 100% chuẩn type Dart2js
  // Đảm bảo không bao giờ truyền số vào tham số 8 & 9 của A.a5, có try-catch fallback tuyệt đối
  const oldVidBlockRegex = /var _isVid=\(o==="video"\)[\s\S]*?return A\.dr\(d,_clippedCard,B\.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}/;

  const safeVidBlock = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
try{
var _vUrl=a.videoUrl||a.f||s||"";
if(_vUrl&&_vUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_vUrl=_be+_vUrl;}
var _vThumb=(window._videoThumbCache&&window._videoThumbCache[_vUrl])||a.f||"";
if(!_vThumb&&window.extractVideoThumbnail)window.extractVideoThumbnail(_vUrl);
var _bg=null;
if(_vThumb&&typeof _vThumb==="string"&&_vThumb.length>10){
if(J.pX(_vThumb,e)){
try{var _b64=B.b.ga5(J.a5C(_vThumb,",")),_u8=B.kC.ci(_b64);_bg=new A.mD(A.aLD(d,d,new A.oH(_u8,1)),new A.auP(),d,d,B.cp,B.e8,d);}catch(_){}
}else if(J.pX(_vThumb,"http")||J.pX(_vThumb,"/")){
_bg=new A.mD(A.aLD(d,d,new A.eY(_vThumb,1,d)),new A.auQ(),d,d,B.cp,B.e8,d);
}
}
if(!_bg){
var _wmIcon=A.bV(new A.ax(62413,!1),new A.q(369098751),d,72);
_bg=A.a5(d,_wmIcon,B.h,d,new A.ao(240,240,160,160),new A.ak(new A.q(4279244074),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
}
var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);
var _cardStack;
if(_isSending){
var _shade=A.a5(d,d,d,d,new A.ao(240,240,160,160),new A.ak(new A.q(1879048192),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
var _spinIcon=A.bV(B.rw,B.f,d,22);
var _lbl=A.a2("Đang tải video...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _pillContent=A.b9(A.b([_spinIcon,B.aT,_lbl],t.p),B.l,B.m,B.G);
var _sendPill=A.a5(d,_pillContent,B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(18),d,d,B.t),d,d,d,d,d,d,d);
_cardStack=A.dt(B.h,A.b([_bg,_shade,_sendPill],t.p),B.r,B.ap);
}else{
var _shade=A.a5(d,d,d,d,new A.ao(240,240,160,160),new A.ak(new A.q(855638016),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
var _playIcon=A.bV(new A.ax(57399,!1),B.f,d,30);
var _playBtn=A.a5(d,_playIcon,B.h,d,new A.ao(50,50,50,50),new A.ak(new A.q(4279326465),d,d,A.ag(25),d,d,B.t),d,d,d,d,d,d,d);
_cardStack=A.dt(B.h,A.b([_bg,_shade,_playBtn],t.p),B.r,B.ap);
}
var _sizedCard=A.a5(d,_cardStack,B.h,d,new A.ao(240,240,160,160),new A.ak(new A.q(4279244074),d,d,A.ag(14),d,d,B.t),d,d,d,d,d,d,d);
var _clippedCard=A.aP5(A.ag(14),_sizedCard);
return A.dr(d,_clippedCard,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}catch(err){
var _vUrl=a.videoUrl||a.f||s||"";
var _vIcon=A.bV(B.aaN,b?B.f:B.a1,d,22);
var _vText=A.a2("▶ Xem video",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _vRow=A.b9(A.b([_vIcon,B.aT,new A.eT(1,B.bv,_vText,d)],t.p),B.l,B.m,B.G);
return A.dr(d,_vRow,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}
}`;

  if (oldVidBlockRegex.test(js)) {
    js = js.replace(oldVidBlockRegex, safeVidBlock);
    modified = true;
    console.log(`  [${p}] Đã cập nhật safeVidBlock trong aaY`);
  }

  // 2. Thêm optimistic message rendering khi gửi video trong a2L
  const targetA2L = 'var _optId="optimistic-"+Date.now();\nvar _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));';
  const targetA2LCRLF = 'var _optId="optimistic-"+Date.now();\r\nvar _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));';
  
  const replA2L = `var _optId="optimistic-"+Date.now();
var _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));
if(_isVidSend&&n.length>0){
try{
var _optMsg=A.wf({id:_optId,conversationId:q.b.a,content:"video",videoUrl:"",type:"video",createdAt:new Date().toISOString()});
q.d.vZ(_optMsg);
}catch(_){}
}
var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));`;

  if (js.includes(targetA2L)) {
    js = js.replace(targetA2L, replA2L);
    modified = true;
    console.log(`  [${p}] Đã thêm optimistic video sending trong a2L (LF)`);
  } else if (js.includes(targetA2LCRLF)) {
    js = js.replace(targetA2LCRLF, replA2L.replace(/\n/g, '\r\n'));
    modified = true;
    console.log(`  [${p}] Đã thêm optimistic video sending trong a2L (CRLF)`);
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Đã lưu thành công ${p}`);
  }
});

console.log('🏁 Hoàn tất bản vá crash!');
