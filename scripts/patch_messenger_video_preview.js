const fs = require('fs');
const path = require('path');

console.log('🚀 Đang áp dụng giao diện Video Preview chuẩn Messenger & Zalo...');

const jsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

// 1. Cập nhật chat_screen.dart
dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');
  let changed = false;

  // Cập nhật isPureImage hỗ trợ cả video có thumbnail
  const targetPure = "final isPureImage = (msg.type == 'image' || msg.content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl);";
  const newPure = "final isPureImage = (msg.type == 'image' || msg.content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl || (isVideo && msg.imageUrl != null && msg.imageUrl!.isNotEmpty));";

  if (code.includes(targetPure)) {
    code = code.replace(targetPure, newPure);
    changed = true;
  }

  // Cập nhật _buildMessageBubbleContent để truyền msg.imageUrl vào _buildVideoBubble
  if (code.includes("_buildVideoBubble(context, videoUrl, isMe)")) {
    code = code.replace(
      "_buildVideoBubble(context, videoUrl, isMe)",
      "_buildVideoBubble(context, videoUrl, isMe, msg.imageUrl)"
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(df, code, 'utf8');
    console.log(`✅ Đã cập nhật ${df}`);
  }
});

// 2. Cập nhật 4 file main.dart.js
jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let js = fs.readFileSync(jf, 'utf8');
  let changed = false;

  // 2A. Cập nhật bubble wrapper để video có thumbnail được đặt isPureImage = true (m = !0, không padding thừa, không nền xanh)
  const oldWrapper = 'var _ael=(a.e||"").toLowerCase();if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1)m=!0;';
  const newWrapper = 'var _ael=(a.e||"").toLowerCase();var _isVidMsg=(a.d==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||_ael.indexOf(".mp4")!==-1||_ael.indexOf(".mov")!==-1||_ael.indexOf(".webm")!==-1||_ael.indexOf("/videos/")!==-1;var _hasThumb=a.f!=null&&a.f.length>0;if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1||(_isVidMsg&&_hasThumb))m=!0;';

  if (js.includes(oldWrapper)) {
    js = js.replace(oldWrapper, newWrapper);
    changed = true;
    console.log(`  [${jf}] Đã cập nhật bubble wrapper (isPureImage cho video có thumb)`);
  }

  // 2B. Cập nhật bộ hiển thị Video trong aaY để ưu tiên render thumbnail ảnh + nút Play bán trong suốt (Messenger / Zalo style)
  const currentVidPattern = /var _isVid=\(o==="video"\)[\s\S]*?return A\.dr\(d,_row,B\.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}/;

  const messengerVidBlock = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
var _vUrl=a.videoUrl||(s&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/videos/")!==-1)?s:"")||a.f||"";
if(_vUrl&&_vUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_vUrl=_be+_vUrl;}
var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);
var _thumbUrl=a.f;
if(_thumbUrl&&_thumbUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_thumbUrl=_be+_thumbUrl;}
if(_thumbUrl&&_thumbUrl.length>0){
var _imgW=new A.mD(A.aLD(d,d,new A.eY(_thumbUrl,1,d)),new A.auQ(),d,d,B.cp,B.e8,d);
var _playOverlay=A.hO(new A.q(1879048192),d,A.bV(B.aaW,B.f,d,28),24);
var _vChildren=[_imgW,_playOverlay];
if(_isSending){
var _shade=A.a5(d,d,d,d,d,new A.ak(new A.q(1879048192),d,d,d,d,d,B.t),d,d,d,d,d,d,d);
var _spinIcon=A.bV(B.rw,B.f,d,20);
var _lbl=A.a2("Đang tải video...",d,1,B.a9,d,d,A.ay(d,d,B.f,d,d,d,d,d,d,d,d,12.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _pill=A.a5(d,A.b9(A.b([_spinIcon,B.aT,_lbl],t.p),B.l,B.m,B.G),B.h,d,d,new A.ak(new A.q(2566914048),d,d,A.ag(18),d,d,B.t),d,new A.dL(A.ag(7),d,A.ag(13),A.ag(7)),d,d,d,d,d);
_vChildren.push(_shade);_vChildren.push(_pill);
}
var _vStack=A.dt(B.h,A.b(_vChildren,t.p),B.r,B.ap);
var _vCard=A.a5(d,_vStack,B.h,d,B.FH,d,d,d,d,d,d,d,d);
return A.dr(d,A.aP5(A.ag(12),_vCard),B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}
var _playBtn=A.hO(b?B.f:B.o,d,A.bV(_isSending?B.rw:B.aaW,b?B.o:B.f,d,18),18);
var _title=A.a2(_isSending?"Đang tải video...":"Video đính kèm",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _sub=A.a2(_isSending?"Vui lòng chờ giây lát":"▶ Nhấn để phát video",d,1,B.a9,d,d,A.ay(d,d,b?B.a1:B.cL,d,d,d,d,d,d,d,d,12,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _col=A.bm(A.b([_title,B.cZ,_sub],t.p),B.aS,B.m,B.G);
var _cam=A.bV(new A.ax(62413,!1),b?B.a1:B.cL,d,20);
var _row=A.b9(A.b([_playBtn,B.cV,new A.eT(1,B.bv,_col,d),B.aT,_cam],t.p),B.l,B.m,B.G);
return A.dr(d,_row,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}`;

  if (currentVidPattern.test(js)) {
    js = js.replace(currentVidPattern, messengerVidBlock);
    changed = true;
    console.log(`  [${jf}] Đã cập nhật aaY thành giao diện Messenger / Zalo video thumbnail`);
  } else {
    console.warn(`  [${jf}] Không tìm thấy currentVidPattern!`);
  }

  if (changed) {
    fs.writeFileSync(jf, js, 'utf8');
    console.log(`  [${jf}] Lưu thành công.`);
  }
});

console.log('✨ Hoàn tất!');
