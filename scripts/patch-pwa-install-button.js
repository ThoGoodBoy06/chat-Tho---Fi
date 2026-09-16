const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

const targetRichText = 'g.push(A.dr(q,A.aLE(q,q,B.c3,q,q,!0,q,A.dj(A.b([A.dj(q,B.Eb,k?"\\u0110\\u0103ng nh\\u1eadp ngay":"T\\u1ea1o t\\xe0i kho\\u1ea3n ngay")],t.VO),B.nP,i),B.bj,q,q,B.a5,B.aM),B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aAD(r),q,q,q,q,q,q,!1,B.ao))';

const oldInstallCode = 'if(typeof window!=="undefined"&&window.canInstallPwa&&window.canInstallPwa()){' +
'g.push(A.cw(q,16,q));' +
'g.push(A.dr(q,A.aLE(q,q,B.c3,q,q,!0,q,A.dj(A.b([A.dj(q,B.Eb,"C\\xe0i \\u0111\\u1eb7t \\u1ee9ng d\\u1ee5ng")],t.VO),B.nP,"\\uD83D\\uDCF2 "),B.bj,q,q,B.a5,B.aM),B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aPwaInstall(),q,q,q,q,q,q,!1,B.ao));' +
'}';

// Nút Cài đặt ứng dụng an toàn, chuẩn xác với Dart2js runtime (không gây crash màn hình đăng nhập)
const safeInstallCode = 'if(typeof window!=="undefined"&&window.canInstallPwa&&window.canInstallPwa()){' +
'g.push(A.cw(q,18,q));' +
'g.push(A.dr(q,A.aLE(q,q,B.c3,q,q,!0,q,A.dj(A.b([A.dj(q,B.Eb,"C\\xC0I \\u0110\\u1eb6T \\u1ee8NG D\\u1ee4NG")],t.VO),B.nP,"\\uD83D\\uDCF2 "),B.bj,q,q,B.a5,B.aM),B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aPwaInstall(),q,q,q,q,q,q,!1,B.ao));' +
'}';

// Code cũ bị lỗi argument Container A.a5
const buggyInstallCode = 'if(typeof window!=="undefined"&&window.canInstallPwa&&window.canInstallPwa()){' +
'g.push(A.cw(q,22,q));' +
'var _pwaBtn=A.a5(q,A.a2("\\uD83D\\uDCF2  C\\xC0I \\u0110\\u1eb6T \\u1ee8NG D\\u1ee4NG",q,q,q,q,q,A.ay(q,q,B.o,q,q,q,q,q,q,q,q,15,q,q,B.fD,q,q,!0,q,0.6,q,q,q,q,q,q),q,q,q),B.h,q,A.I(28,0,104,255),new A.ak(A.I(30,0,104,255),q,A.dx(B.o,1.5),A.ag(14),q,q,B.t),q,1/0,48,q,q,q,q,B.t);' +
'g.push(A.dr(q,_pwaBtn,B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aPwaInstall(),q,q,q,q,q,q,!1,B.ao));' +
'}';

const protoMarker = 'A.aAD.prototype={';
const newProto = 'A.aPwaInstall=function aPwaInstall(){};\nA.aPwaInstall.prototype={\n$0(){if(typeof window!=="undefined"&&window.triggerPwaInstall){window.triggerPwaInstall()}},\n$S:0};\n' + protoMarker;

let successCount = 0;

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] Không tìm thấy tệp: ${filePath}`);
    continue;
  }

  let code = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Thêm prototype aPwaInstall nếu chưa có
  if (!code.includes('A.aPwaInstall=function')) {
    if (code.includes(protoMarker)) {
      code = code.replace(protoMarker, newProto);
      modified = true;
      console.log(`[${path.basename(filePath)}] ✅ Đã chèn A.aPwaInstall prototype`);
    }
  }

  // 2. Gỡ bỏ hoàn toàn nút/chữ cài đặt nhỏ bên trong Card Flutter (để Card luôn gọn đẹp chuẩn như máy tính)
  if (code.includes(safeInstallCode)) {
    code = code.replace(safeInstallCode, '');
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã gỡ bỏ chữ cài đặt thừa bên trong Card`);
  }
  if (code.includes(buggyInstallCode)) {
    code = code.replace(buggyInstallCode, '');
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã gỡ bỏ code buggy bên trong Card`);
  }
  if (code.includes(oldInstallCode)) {
    code = code.replace(oldInstallCode, '');
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã gỡ bỏ oldInstallCode bên trong Card`);
  }

  // 3. Gắn hook kích hoạt thanh cài đặt ĐÚNG LÚC các ô nhập tài khoản & mật khẩu xuất hiện trên màn hình
  const targetTrigger = 'new A.aAB(r),new A.aAC(r)))';
  const hookTrigger = 'new A.aAB(r),new A.aAC(r)));if(typeof window!=="undefined"&&window.showPwaFloatingBarWhenReady){window.showPwaFloatingBarWhenReady()}';

  if (!code.includes(hookTrigger) && code.includes(targetTrigger)) {
    code = code.replace(targetTrigger, hookTrigger);
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã gắn hook hiển thị thanh cài đặt khi ô tài khoản & mật khẩu xuất hiện`);
  }

  // 4. Thay thế icon chat bubble thành logo chính thức public/icon.png ở trên chữ "Chat Tho-Fi"
  const oldLogoTarget = 'k=A.a5(q,A.bV(B.fE,B.f,q,p?32:38),B.h,q,q,new A.ak(q,q,q,g,k,B.ade,B.t),q,h,q,q,q,q,i)';
  const newLogoTarget = 'k=A.aQs("assets/tho_fi_logo_transparent.png",q,B.fB,B.oU,p?72:88,p?72:88)';

  if (code.includes(oldLogoTarget)) {
    code = code.replace(oldLogoTarget, newLogoTarget);
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã thay thế icon bằng logo Chat Tho-Fi ở trên chữ "Chat Tho-Fi"`);
  }

  if (modified) {
    fs.writeFileSync(filePath, code, 'utf8');
    successCount++;
    console.log(`[${path.basename(filePath)}] 🎉 Lưu tệp thành công!`);
  }
}

console.log(`Done! Patched ${successCount} files.`);
