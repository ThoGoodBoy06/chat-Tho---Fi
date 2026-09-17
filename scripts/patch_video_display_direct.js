const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu áp dụng bản vá Hiển thị Video trực tiếp trong Bong bóng Chat (Video Player Card)...');

// 1. Cập nhật server.js và backend/server.js với Media Proxy
const serverFiles = ['server.js', 'backend/server.js'];
serverFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  let code = fs.readFileSync(sf, 'utf8');
  if (!code.includes('/api/chat/media-proxy')) {
    const proxyRoute = `
// Proxy đa phương tiện hỗ trợ CORS và Range Requests cho video/audio từ Cloudflare R2
app.get("/api/chat/media-proxy", (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url parameter");
    try {
        const parsed = new URL(targetUrl);
        const https = require("https");
        const http = require("http");
        const client = parsed.protocol === "https:" ? https : http;

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Cache-Control", "public, max-age=86400");

        const headers = {};
        if (req.headers.range) {
            headers.range = req.headers.range;
        }

        const proxyReq = client.get(targetUrl, { headers }, (proxyRes) => {
            res.status(proxyRes.statusCode);
            if (proxyRes.headers["content-type"]) res.setHeader("Content-Type", proxyRes.headers["content-type"]);
            if (proxyRes.headers["content-length"]) res.setHeader("Content-Length", proxyRes.headers["content-length"]);
            if (proxyRes.headers["content-range"]) res.setHeader("Content-Range", proxyRes.headers["content-range"]);
            if (proxyRes.headers["accept-ranges"]) res.setHeader("Accept-Ranges", proxyRes.headers["accept-ranges"]);
            proxyRes.pipe(res);
        });

        proxyReq.on("error", (e) => {
            if (!res.headersSent) res.status(500).send(e.message);
        });
    } catch (e) {
        if (!res.headersSent) res.status(400).send("Invalid url");
    }
});
`;
    const targetMarker = 'app.use(express.urlencoded({ limit: "50mb", extended: true }));';
    if (code.includes(targetMarker)) {
      code = code.replace(targetMarker, targetMarker + '\n' + proxyRoute);
      fs.writeFileSync(sf, code, 'utf8');
      console.log(`✅ Đã thêm /api/chat/media-proxy vào ${sf}`);
    }
  }
});

// 2. Cập nhật webrtc_audio_helper.js với thumbnail extractor
const helperFiles = [
  'public/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js'
];

const helperAdditions = `
  // 9. Hệ thống trích xuất và lưu bộ nhớ đệm Video Thumbnail tự động
  window._videoThumbCache = window._videoThumbCache || {};
  window.extractVideoThumbnail = function (videoUrl, onDone) {
    if (!videoUrl || window._videoThumbCache[videoUrl]) {
      if (onDone) onDone(window._videoThumbCache[videoUrl]);
      return;
    }
    if (window._extractingVideo && window._extractingVideo[videoUrl]) return;
    window._extractingVideo = window._extractingVideo || {};
    window._extractingVideo[videoUrl] = true;

    try {
      var v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      
      var srcUrl = videoUrl;
      if (videoUrl.indexOf('http') === 0 && videoUrl.indexOf(window.location.host) === -1) {
        srcUrl = '/api/chat/media-proxy?url=' + encodeURIComponent(videoUrl);
      }
      v.src = srcUrl;

      var captured = false;
      function doCapture() {
        if (captured) return;
        captured = true;
        try {
          var canvas = document.createElement('canvas');
          canvas.width = v.videoWidth || 320;
          canvas.height = v.videoHeight || 180;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          window._videoThumbCache[videoUrl] = dataUrl;
          if (onDone) onDone(dataUrl);
        } catch (err) {}
        try { v.pause(); v.src = ''; } catch (_) {}
      }

      v.onloadeddata = function () {
        try {
          v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
        } catch (_) {
          doCapture();
        }
      };
      v.onseeked = doCapture;
      setTimeout(function () { if (!captured) doCapture(); }, 2500);
    } catch (_) {}
  };
`;

helperFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let hCode = fs.readFileSync(hf, 'utf8');
  if (!hCode.includes('window.extractVideoThumbnail')) {
    hCode += '\n' + helperAdditions;
    fs.writeFileSync(hf, hCode, 'utf8');
    console.log(`✅ Đã thêm extractVideoThumbnail vào ${hf}`);
  }
});

// 3. Patch main.dart.js across all 4 locations
const jsPaths = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const aaYOldPrefix = 'var _vText=A.a2("▶ Xem video",d,1,B.a9,d,d,A.ay(d,d,b?B.f:B.I,d,d,d,d,d,d,d,d,14.5,d,d,B.N,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);';

jsPaths.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let modified = false;

  // 3A. Nâng cấp bộ hiển thị Video trong aaY:
  // Render Video Player Card trực tiếp (250x155, rounded 14, thumbnail/dark cinematic canvas, nút Play rực rỡ, tag VIDEO)
  const oldAaYPattern = /var _isVid=\(o==="video"\)[\s\S]*?return A\.dr\(d,_vRow,B\.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A\.aVidTap\(_vUrl\),d,d,d,d,d,d,!1,B\.ao\);[\r\n\s]*\}/;
  
  const newAaYBlock = `var _isVid=(o==="video")||(a.videoUrl!=null&&a.videoUrl.length>0)||(s&&typeof s==="string"&&(s.indexOf(".mp4")!==-1||s.indexOf(".mov")!==-1||s.indexOf(".webm")!==-1||s.indexOf("/uploads/video_")!==-1||s.indexOf("/videos/")!==-1));
if(_isVid){
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
var _wmIcon=A.bV(new A.ax(62413,!1),new A.q(369098751),d,80);
_bg=A.a5(d,_wmIcon,B.h,d,d,new A.ak(new A.q(4279244074),d,d,d,d,d,B.t),d,250,155,d,d,d,d);
}
var _shade=A.a5(d,d,d,d,d,new A.ak(new A.q(855638016),d,d,d,d,d,B.t),d,250,155,d,d,d,d);
var _playIcon=A.bV(new A.ax(57399,!1),B.f,d,32);
var _playBtn=A.a5(d,_playIcon,B.h,d,d,new A.ak(new A.q(4279326465),d,d,A.ag(27),d,d,B.t),d,54,54,d,d,d,d);
var _cardStack=A.dt(B.h,A.b([_bg,_shade,_playBtn],t.p),B.r,B.ap);
var _sizedCard=A.a5(d,_cardStack,B.h,d,d,new A.ak(new A.q(4279244074),d,d,A.ag(14),d,d,B.t),d,250,155,new A.ao(240,260,150,165),d,d,d);
var _clippedCard=A.aP5(A.ag(14),_sizedCard);
return A.dr(d,_clippedCard,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.aVidTap(_vUrl),d,d,d,d,d,d,!1,B.ao);
}`;

  if (oldAaYPattern.test(js)) {
    js = js.replace(oldAaYPattern, newAaYBlock);
    modified = true;
    console.log(`  [${p}] Đã nâng cấp video renderer trong aaY thành Video Player Card`);
  }

  // 3B. Cập nhật Bubble Wrapper: Đảm bảo bong bóng video không bị bọc viền xanh hay padding thừa (m = !0)
  const wrapperTarget = 'var _ael=(a.e||"").toLowerCase();if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1)m=!0;';
  const wrapperRepl = 'var _ael=(a.e||"").toLowerCase();var _isVidExt=_ael.indexOf(".mp4")!==-1||_ael.indexOf(".mov")!==-1||_ael.indexOf(".webm")!==-1||_ael.indexOf("/videos/")!==-1||(a.d==="video")||(a.videoUrl!=null&&a.videoUrl.length>0);if(_ael.indexOf(".jpg")!==-1||_ael.indexOf(".jpeg")!==-1||_ael.indexOf(".png")!==-1||_ael.indexOf(".webp")!==-1||_ael.indexOf(".gif")!==-1||_ael.indexOf("/chat-media/")!==-1||_isVidExt)m=!0;';
  if (js.includes(wrapperTarget)) {
    js = js.replace(wrapperTarget, wrapperRepl);
    modified = true;
    console.log(`  [${p}] Đã vá bubble wrapper (m = !0) cho video`);
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`🎉 Đã lưu thành công ${p}`);
  }
});

// 4. Cập nhật chat_screen.dart (Dart sources)
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');
  const targetDart = 'final isPureImage = (msg.type == \'image\' || msg.content.startsWith(\'data:image\') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl);';
  const replDart = 'final isPureImage = (msg.type == \'image\' || msg.content.startsWith(\'data:image\') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl || isVideo);';
  if (code.includes(targetDart)) {
    code = code.replace(targetDart, replDart);
    fs.writeFileSync(df, code, 'utf8');
    console.log(`✅ Đã cập nhật isPureImage trong ${df}`);
  }
});

console.log('🏁 Hoàn tất bản vá video display!');
