const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const targetPattern = 'h=[B.iY,B.iW,B.iS,B.iX,B.iU,B.iT,B.iV][B.e.br(Math.abs(B.c.gv(g)),7)]\no=t.p\nh=A.b([A.a5(l,A.cn(A.a2(j.aak(g),l,l,l,l,l,B.jY,l,l,l),l,l),B.h,l,l,new A.ak(l,l,l,l,l,h,B.a8),l,48,l,l,l,l,48)],o)';

const replacement = `h=[B.iY,B.iW,B.iS,B.iX,B.iU,B.iT,B.iV][B.e.br(Math.abs(B.c.gv(g)),7)]
o=t.p
var _avt=i.h(0,"avatar")
var _hasAvt=_avt!=null&&_avt!=="null"&&_avt.length!==0
var _avtWidget=_hasAvt?A.a5(l,l,B.h,l,l,new A.ak(B.o,A.a9i(B.e8,new A.eY(_avt,1,l),l),l,l,l,l,B.a8),l,48,l,l,l,l,48):A.a5(l,A.cn(A.a2(j.aak(g),l,l,l,l,l,B.jY,l,l,l),l,l),B.h,l,l,new A.ak(l,l,l,l,l,h,B.a8),l,48,l,l,l,l,48)
h=A.b([_avtWidget],o)`;

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log('🔄 Đang xử lý file:', file);
  let content = fs.readFileSync(file, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  if (norm.includes(targetPattern)) {
    norm = norm.replace(targetPattern, replacement);
    const finalContent = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
    fs.writeFileSync(file, finalContent, 'utf8');
    console.log('  ✅ Đã áp dụng hiển thị ảnh đại diện thật khi user có avatar!');
  } else if (norm.includes('var _avt=i.h(0,"avatar")')) {
    console.log('  ℹ️ Đã có logic hiển thị avatar.');
  } else {
    console.warn('  ⚠️ Không tìm thấy targetPattern trong:', file);
  }
});

console.log('🎉 Hoàn tất patch avatar thực tế cho Web bundle!');
