const fs = require('fs');

console.log('🚀 Bắt đầu patch giao diện xem trước trong Menu chức năng (Context Menu)...');

const target = 'h=A.b([A.a5(d,A.a2(l.e,d,d,d,d,d,A.ay(d,d,s?B.f:B.I,d,d,d,d,d,d,d,d,15,d,d,d,d,d,!0,d,d,d,d,d,d,d,d),d,d,d),B.h,d,new A.ao(0,k.a.a*0.72,0,1/0),new A.ak(j,d,d,i,h,d,B.t),d,d,d,B.qA,d,d,d)],g)';

const replacement = 'var _lel=(l.e||"").toLowerCase();var _isImgCtx=(l.d==="image")||(l.f!=null&&l.f.length!==0)||_lel.indexOf(".jpg")!==-1||_lel.indexOf(".jpeg")!==-1||_lel.indexOf(".png")!==-1||_lel.indexOf(".webp")!==-1||_lel.indexOf(".gif")!==-1||_lel.indexOf("/chat-media/")!==-1;\r\nvar _ctxBody=_isImgCtx?e.a.aaY(l,s):A.a2(l.e,d,d,d,d,d,A.ay(d,d,s?B.f:B.I,d,d,d,d,d,d,d,d,15,d,d,d,d,d,!0,d,d,d,d,d,d,d,d),d,d,d);\r\nvar _ctxPad=_isImgCtx?B.K:B.qA;\r\nvar _ctxBg=_isImgCtx?B.F:j;\r\nh=A.b([A.a5(d,_ctxBody,B.h,d,new A.ao(0,k.a.a*0.72,0,1/0),new A.ak(_ctxBg,d,d,i,h,d,B.t),d,d,d,_ctxPad,d,d,d)],g)';

const jsPaths = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js',
  'backend/public/main.dart.js'
];

jsPaths.forEach(p => {
  if (fs.existsSync(p)) {
    let js = fs.readFileSync(p, 'utf8');
    if (js.includes(target)) {
      js = js.replace(target, replacement);
      fs.writeFileSync(p, js, 'utf8');
      console.log(`✅ [${p}] Đã patch thành công Context Menu hiển thị ảnh!`);
    } else {
      console.log(`⚠️ [${p}] Không tìm thấy target hoặc đã được patch.`);
    }
  }
});

console.log('🏁 Hoàn tất patch Context Menu!');
