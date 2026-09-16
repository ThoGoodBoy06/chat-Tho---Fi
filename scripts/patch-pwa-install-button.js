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

// Nút Cài đặt ứng dụng to, nổi bật, thiết kế sang trọng dạng Button full-width viền bo tròn
const prominentInstallCode = 'if(typeof window!=="undefined"&&window.canInstallPwa&&window.canInstallPwa()){' +
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

  // 2. Nâng cấp widget nút Cài đặt ứng dụng sang phiên bản to, nổi bật, chuyên nghiệp
  if (code.includes(oldInstallCode)) {
    code = code.replace(oldInstallCode, prominentInstallCode);
    modified = true;
    console.log(`[${path.basename(filePath)}] ✅ Đã nâng cấp nút Cài đặt ứng dụng to và nổi bật`);
  } else if (!code.includes('var _pwaBtn=')) {
    if (code.includes(targetRichText)) {
      code = code.replace(targetRichText, targetRichText + '\n' + prominentInstallCode);
      modified = true;
      console.log(`[${path.basename(filePath)}] ✅ Đã chèn nút Cài đặt ứng dụng nổi bật`);
    }
  } else {
    console.log(`[${path.basename(filePath)}] ℹ️ Đã có nút Cài đặt nổi bật.`);
  }

  if (modified) {
    fs.writeFileSync(filePath, code, 'utf8');
    successCount++;
    console.log(`[${path.basename(filePath)}] 🎉 Lưu tệp thành công!`);
  }
}

console.log(`Done! Patched ${successCount} files.`);
