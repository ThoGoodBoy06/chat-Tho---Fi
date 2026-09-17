const fs = require('fs');

console.log('🚀 Đang áp dụng giao diện Video hoàn hảo chuẩn 100% Messenger & Zalo...');

const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const perfectVidCode = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
var _vUrl=a.videoUrl||(s&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/videos/")!==-1)?s:"")||a.f||"";
if(_vUrl&&_vUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_vUrl=_be+_vUrl;}
var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);
var _thumbUrl=a.f;
if(_thumbUrl&&_thumbUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_thumbUrl=_be+_thumbUrl;}
if(_thumbUrl&&_thumbUrl.length>0){
var _decImg=A.a9i(B.e8,new A.eY(_thumbUrl,1,d),B.cp);
var _boxDec=new A.ak(d,_decImg,d,A.ag(12),d,d,B.t);
var _playIcon=A.bV(B.aaW,B.f,d,26);
var _btnDec=new A.ak(new A.q(1426063360),d,d,A.ag(22),d,d,B.t);
var _decBtn=A.Bo(_playIcon,_btnDec,B.ej);
var _constrainedBtn=new A.fm(A.hN(44,44),_decBtn,d);
var _playOverlay=new A.eb(B.T,d,d,_constrainedBtn,d);
if(_isSending){
var _sRow=A.b9(A.b([A.bV(B.rw,B.f,d,20),B.aT,A.a2("Đang tải video...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d)],t.p),B.l,B.m,B.G);
_playOverlay=A.a5(d,_sRow,B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(18),d,d,B.t),d,new A.dL(A.ag(7),d,A.ag(13),A.ag(7)),d,d,d,d,d);
}
var _card=A.a5(d,_playOverlay,B.h,d,d,_boxDec,d,240,d,d,d,d,160);
return A.dr(d,A.aP5(A.ag(12),_card),B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}
var _playBtn=A.hO(b?B.f:B.o,d,A.bV(_isSending?B.rw:B.aaW,b?B.o:B.f,d,18),18);
var _title=A.a2(_isSending?"Đang tải video...":"Video đính kèm",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _sub=A.a2(_isSending?"Vui lòng chờ giây lát":"▶ Nhấn để phát video",d,1,B.a9,d,d,A.ay(d,d,b?B.a1:B.cL,d,d,d,d,d,d,d,d,12,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _col=A.bm(A.b([_title,B.cZ,_sub],t.p),B.aS,B.m,B.G);
var _cam=A.bV(new A.ax(62413,!1),b?B.a1:B.cL,d,20);
var _row=A.b9(A.b([_playBtn,B.cV,new A.eT(1,B.bv,_col,d),B.aT,_cam],t.p),B.l,B.m,B.G);
return A.dr(d,_row,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}
`;

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  const start = content.indexOf('var _isVid=');
  const end = content.indexOf('var _sl=(s||', start);

  if (start !== -1 && end !== -1) {
    content = content.slice(0, start) + perfectVidCode + content.slice(end);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`✅ [${jf}] Đã cập nhật giao diện Video hoàn hảo (Video sáng tự nhiên 100%, Nút Play 44px chuẩn form)!`);
  } else {
    console.error(`❌ [${jf}] Không tìm thấy start hoặc end`);
  }
});

console.log('✨ Hoàn tất!');
