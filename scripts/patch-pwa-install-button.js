const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

const targetRichText = 'g.push(A.dr(q,A.aLE(q,q,B.c3,q,q,!0,q,A.dj(A.b([A.dj(q,B.Eb,k?"\\u0110\\u0103ng nh\\u1eadp ngay":"T\\u1ea1o t\\xe0i kho\\u1ea3n ngay")],t.VO),B.nP,i),B.bj,q,q,B.a5,B.aM),B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aAD(r),q,q,q,q,q,q,!1,B.ao))';

const installWidgetCode = targetRichText + '\n' +
'if(typeof window!=="undefined"&&window.canInstallPwa&&window.canInstallPwa()){' +
'g.push(A.cw(q,16,q));' +
'g.push(A.dr(q,A.aLE(q,q,B.c3,q,q,!0,q,A.dj(A.b([A.dj(q,B.Eb,"C\\xe0i \\u0111\\u1eb7t \\u1ee9ng d\\u1ee5ng")],t.VO),B.nP,"\\uD83D\\uDCF2 "),B.bj,q,q,B.a5,B.aM),B.M,!1,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,q,new A.aPwaInstall(),q,q,q,q,q,q,!1,B.ao));' +
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
    } else {
      console.warn(`[${path.basename(filePath)}] ⚠️ Không tìm thấy protoMarker`);
    }
  }

  // 2. Chèn widget nút Cài đặt ứng dụng vào màn hình đăng nhập
  if (!code.includes('new A.aPwaInstall()')) {
    if (code.includes(targetRichText)) {
      code = code.replace(targetRichText, installWidgetCode);
      modified = true;
      console.log(`[${path.basename(filePath)}] ✅ Đã chèn widget Cài đặt ứng dụng vào màn hình đăng nhập`);
    } else {
      console.warn(`[${path.basename(filePath)}] ⚠️ Không tìm thấy targetRichText`);
    }
  } else {
    console.log(`[${path.basename(filePath)}] ℹ️ Đã có widget Cài đặt ứng dụng từ trước.`);
  }

  if (modified) {
    fs.writeFileSync(filePath, code, 'utf8');
    successCount++;
    console.log(`[${path.basename(filePath)}] 🎉 Lưu tệp thành công!`);
  }
}

console.log(`Done! Patched ${successCount} files.`);
