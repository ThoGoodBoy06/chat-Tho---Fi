const fs = require('fs');

console.log('🚀 Bắt đầu cập nhật tính năng Tải & Lưu ảnh, video thẳng vào máy...');

const jsPaths = [
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsPaths.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let modified = false;

  // 1. Lưu URL ảnh vào closure object c (c.url = j)
  const imgClosureMatches = [
    // CRLF
    {
      target: 'c.a=h\r\no=h}else{c.a=B.yF',
      repl: 'c.a=h\r\nc.url=j;\r\no=h}else{c.a=B.yF'
    },
    // LF
    {
      target: 'c.a=h\no=h}else{c.a=B.yF',
      repl: 'c.a=h\nc.url=j;\no=h}else{c.a=B.yF'
    },
    // If base64
    {
      target: 'if(r!=null)o=c.a=new A.mD(A.aLD(d,d,new A.oH(r,1)),new A.auP(),d,d,B.cp,B.e8,d)',
      repl: 'if(r!=null){c.url=s;o=c.a=new A.mD(A.aLD(d,d,new A.oH(r,1)),new A.auP(),d,d,B.cp,B.e8,d);}'
    }
  ];

  for (const m of imgClosureMatches) {
    if (js.includes(m.target)) {
      js = js.replace(m.target, m.repl);
      modified = true;
      console.log(`  [${p}] Đã gắn URL ảnh vào image closure c.url`);
    }
  }

  // 2. Patch A.auR.prototype để khi bấm vào ảnh thì mở window.openImageModal
  const auRMatches = [
    // CRLF
    {
      target: 'A.auR.prototype={\r\n$0(){var s=this.b,r=s.c\r\nr.toString\r\nA.pW(new A.auO(this.a,s),r,t.z)},\r\n$S:0}',
      repl: 'A.auR.prototype={\r\n$0(){var _u=(this.a&&(this.a.url||this.a.u))||null;if(_u&&window.openImageModal){window.openImageModal(_u);return;}var s=this.b,r=s.c\r\nr.toString\r\nA.pW(new A.auO(this.a,s),r,t.z)},\r\n$S:0}'
    },
    // LF
    {
      target: 'A.auR.prototype={\n$0(){var s=this.b,r=s.c\nr.toString\nA.pW(new A.auO(this.a,s),r,t.z)},\n$S:0}',
      repl: 'A.auR.prototype={\n$0(){var _u=(this.a&&(this.a.url||this.a.u))||null;if(_u&&window.openImageModal){window.openImageModal(_u);return;}var s=this.b,r=s.c\nr.toString\nA.pW(new A.auO(this.a,s),r,t.z)},\n$S:0}'
    }
  ];

  for (const m of auRMatches) {
    if (js.includes(m.target)) {
      js = js.replace(m.target, m.repl);
      modified = true;
      console.log(`  [${p}] Đã patch A.auR.prototype để mở popup xem ảnh & lưu ảnh trực tiếp`);
    }
  }

  // 3. Patch A.awu.prototype (Context Menu "Sao chép") để hỗ trợ tải trực tiếp khi chọn tin nhắn media
  const awuMatches = [
    // CRLF
    {
      target: 'A.awu.prototype={\r\n$0(){var s,r=this.a\r\nA.b1(r,!1).bO(0,null)\r\ns=window.navigator.clipboard',
      repl: 'A.awu.prototype={\r\n$0(){var s,r=this.a\r\nA.b1(r,!1).bO(0,null)\r\nvar _u=this.b.videoUrl||this.b.f||this.b.e||"";var _isM=(this.b.d==="image"||this.b.d==="video"||_u.indexOf(".jpg")!==-1||_u.indexOf(".png")!==-1||_u.indexOf(".mp4")!==-1||_u.indexOf(".webm")!==-1||_u.indexOf("/chat-media/")!==-1);if(_isM&&window.downloadMediaDirectly){window.downloadMediaDirectly(_u);}\r\ns=window.navigator.clipboard'
    },
    // LF
    {
      target: 'A.awu.prototype={\n$0(){var s,r=this.a\nA.b1(r,!1).bO(0,null)\ns=window.navigator.clipboard',
      repl: 'A.awu.prototype={\n$0(){var s,r=this.a\nA.b1(r,!1).bO(0,null)\nvar _u=this.b.videoUrl||this.b.f||this.b.e||"";var _isM=(this.b.d==="image"||this.b.d==="video"||_u.indexOf(".jpg")!==-1||_u.indexOf(".png")!==-1||_u.indexOf(".mp4")!==-1||_u.indexOf(".webm")!==-1||_u.indexOf("/chat-media/")!==-1);if(_isM&&window.downloadMediaDirectly){window.downloadMediaDirectly(_u);}\ns=window.navigator.clipboard'
    }
  ];

  for (const m of awuMatches) {
    if (js.includes(m.target)) {
      js = js.replace(m.target, m.repl);
      modified = true;
      console.log(`  [${p}] Đã patch A.awu.prototype để tải media trực tiếp từ context menu`);
    }
  }

  if (modified) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`✅ Lưu file [${p}] thành công!`);
  } else {
    console.log(`ℹ️ [${p}] File đã được patch hoặc không tìm thấy chuỗi mẫu.`);
  }
});

console.log('🎉 Hoàn tất cập nhật các tệp JS!');
