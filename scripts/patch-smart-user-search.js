const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

let successCount = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log('⏭️ Bỏ qua file không tồn tại:', file);
    return;
  }
  console.log('🔄 Đang xử lý file:', file);
  let content = fs.readFileSync(file, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  let modified = false;

  // 1. Thêm initState l() vào A.GT.prototype để tự động tải tất cả người dùng khi mở màn hình
  const targetProto = 'A.GT.prototype={\n';
  const newProto = 'A.GT.prototype={\nl(){this.Lv();this.vp("");},\n';

  if (!norm.includes('l(){this.Lv();this.vp("");},') && norm.includes(targetProto)) {
    norm = norm.replace(targetProto, newProto);
    console.log('  ✅ 1. Đã thêm initState tự động load tất cả users khi mở màn hình!');
    modified = true;
  } else if (norm.includes('l(){this.Lv();this.vp("");},')) {
    console.log('  ℹ️ 1. initState đã tồn tại.');
  }

  // 2. Cho phép gọi API search khi chuỗi rỗng trong alF
  const targetEmptyCheck = 'while(true)switch(s){case 0:if(a.length===0){s=1\nbreak}s=3\nreturn A.m(A.Ag(a),$async$vp)';
  const newEmptyCheck = 'while(true)switch(s){case 0:s=3\nreturn A.m(A.Ag(a),$async$vp)';

  if (norm.includes(targetEmptyCheck)) {
    norm = norm.replace(targetEmptyCheck, newEmptyCheck);
    console.log('  ✅ 2. Đã gỡ bỏ chặn search chuỗi rỗng (cho phép tải tất cả danh sách người dùng)!');
    modified = true;
  } else if (norm.includes(newEmptyCheck)) {
    console.log('  ℹ️ 2. Gỡ bỏ chặn search chuỗi rỗng đã áp dụng.');
  }

  // 3. Khi ô search rỗng, gọi vp("") để tải lại tất cả users gợi ý thay vì xóa trắng
  const targetU9 = 'if(q.w.length===0){q.K(new A.arp(q))\nreturn}';
  const newU9 = 'if(q.w.length===0){q.K(new A.arq(q));q.vp("");return}';

  if (norm.includes(targetU9)) {
    norm = norm.replace(targetU9, newU9);
    console.log('  ✅ 3. Khi ô tìm kiếm rỗng, tự động tải lại toàn bộ người dùng gợi ý!');
    modified = true;
  } else if (norm.includes(newU9)) {
    console.log('  ℹ️ 3. Tự động tải lại người dùng khi xóa ô tìm kiếm đã áp dụng.');
  }

  if (modified) {
    const finalContent = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
    fs.writeFileSync(file, finalContent, 'utf8');
    console.log('  💾 Đã lưu thay đổi vào:', file);
    successCount++;
  } else {
    console.log('  ℹ️ Không có thay đổi nào cần cập nhật.');
  }
});

console.log(`\n🎉 Hoàn tất vá lỗi! ${successCount} file(s) đã được cập nhật thành công.`);
