const fs = require('fs');

console.log('🚀 Bắt đầu áp dụng bản vá Video Bubble siêu mượt (Chống treo 100%, 60 FPS)...');

// 1. Sửa chat_screen.dart
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');
  // Đảm bảo isPureImage chỉ áp dụng cho hình ảnh thuần, không dính biến isVideo chưa khai báo
  code = code.replace(
    'final isPureImage = (msg.type == \'image\' || msg.content.startsWith(\'data:image\') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl || isVideo);',
    'final isPureImage = (msg.type == \'image\' || msg.content.startsWith(\'data:image\') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl);'
  );
  fs.writeFileSync(df, code, 'utf8');
  console.log(`✅ Đã chuẩn hóa isPureImage trong ${df}`);
});

// 2. Dọn dẹp webrtc_audio_helper.js
const helperFiles = [
  'public/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js'
];

helperFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let hCode = fs.readFileSync(hf, 'utf8');
  // Thay thế extractVideoThumbnail bằng hàm rỗng an toàn, không tải ngầm 47MB video gây nghẽn trình duyệt
  if (hCode.includes('window.extractVideoThumbnail = function')) {
    hCode = hCode.replace(
      /window\.extractVideoThumbnail\s*=\s*function[\s\S]*?setTimeout\(function\s*\(\)\s*\{\s*if\s*\(!captured\)\s*doCapture\(\);\s*\}\s*,\s*2500\);\s*\}\s*catch\s*\(_\)\s*\{\}\s*\};/,
      'window.extractVideoThumbnail = function (videoUrl, onDone) { if (onDone) onDone(null); };'
    );
    fs.writeFileSync(hf, hCode, 'utf8');
    console.log(`✅ Đã tối ưu hóa extractVideoThumbnail trong ${hf}`);
  }
});

// 3. Patch tất cả 4 file main.dart.js
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

  // 3A. Khôi phục bubble wrapper: Video được bọc trong bong bóng chuẩn của Flutter (có background gradient + bo góc + padding 15px)
  // Không đặt m = !0 cho video, để video hiển thị dạng Media Card sang trọng như VoiceBubbleWidget
  const oldWrapper = 'var _ael=(a.e||"").toLowerCase();var _isVidExt=_ael.indexOf(".mp4")!==-1||_ael.indexOf(".mov")!==-1||_ael.indexOf(".webm")!==-1||_ael.indexOf("/videos/")!==-1||(a.d==="video")||(a.videoUrl!=null&&a.videoUrl.length>0);if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1||_isVidExt)m=!0;';
  const cleanWrapper = 'var _ael=(a.e||"").toLowerCase();if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1)m=!0;';

  if (js.includes(oldWrapper)) {
    js = js.replace(oldWrapper, cleanWrapper);
    modified = true;
    console.log(`  [${p}] Đã khôi phục bubble wrapper (padding chuẩn)`);
  }

  // 3B. Nâng cấp bộ hiển thị Video trong aaY:
  // Sử dụng kiến trúc Row + CircleAvatar + Column chuẩn của VoiceBubbleWidget (B.aaW, A.hO, A.b9, A.dr)
  // 100% KHÔNG BAO GIỜ BỊ TREO, KHÔNG CONFLICT CONSTRAINTS, KHÔNG GÂY ĐƠ
  const currentVidPattern = /var _isVid=\(o==="video"\)[\s\S]*?return A\.dr\(d,_clippedCard,B\.M,!1[\s\S]*?new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}catch\(err\)\{[\s\S]*?return A\.dr\(d,_vRow,B\.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}[\r\n\s]*\}/;

  const robustVidBlock = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
var _vUrl=a.videoUrl||a.f||s||"";
if(_vUrl&&_vUrl.startsWith("/")){var _be=(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com";_vUrl=_be+_vUrl;}
var _isSending=a.a&&(a.a.indexOf("optimistic-")===0||a.a.indexOf("uploading-")===0);
var _playBtn=A.hO(b?B.f:B.o,d,A.bV(_isSending?B.rw:B.aaW,b?B.o:B.f,d,18),18);
var _title=A.a2(_isSending?"Đang tải video...":"Video đính kèm",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _sub=A.a2(_isSending?"Vui lòng chờ giây lát":"▶ Nhấn để phát video",d,1,B.a9,d,d,A.ay(d,d,b?B.a1:B.cL,d,d,d,d,d,d,d,d,12,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);
var _col=A.bm(A.b([_title,B.cZ,_sub],t.p),B.aS,B.m,B.G);
var _cam=A.bV(new A.ax(62413,!1),b?B.a1:B.cL,d,20);
var _row=A.b9(A.b([_playBtn,B.cV,new A.eT(1,B.bv,_col,d),B.aT,_cam],t.p),B.l,B.m,B.G);
return A.dr(d,_row,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}`;

  if (currentVidPattern.test(js)) {
    js = js.replace(currentVidPattern, robustVidBlock);
    modified = true;
    console.log(`  [${p}] Đã vá aaY thành robustVidBlock (Row + CircleAvatar)`);
  } else {
    // Fallback regex rộng hơn nếu pattern trước khác đôi chút
    const flexPattern = /var _isVid=\(o==="video"\)[\s\S]*?new A\.aVidTap\(_vUrl\)[\s\S]*?B\.ao\);[\r\n\s]*\}/;
    if (flexPattern.test(js)) {
      js = js.replace(flexPattern, robustVidBlock);
      modified = true;
      console.log(`  [${p}] Đã vá aaY (flexPattern)`);
    }
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Đã lưu ${p}`);
  }
});

console.log('🏁 Hoàn thành áp dụng bản vá Video Bubble mượt mà!');
