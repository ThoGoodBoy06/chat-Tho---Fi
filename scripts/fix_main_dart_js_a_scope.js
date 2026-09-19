const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const reactionTapDefinition = `
A.aReactionBadgeTap = function aReactionBadgeTap(reactions, msgId) {
  this.reactions = reactions;
  this.msgId = msgId;
};
A.aReactionBadgeTap.prototype = {
  $0: function() {
    try {
      if (typeof window !== "undefined" && window.showReactionDetailsModal) {
        window.showReactionDetailsModal(this.reactions, this.msgId);
      }
    } catch (err) {
      console.warn("Lỗi mở modal chi tiết cảm xúc:", err);
    }
  },
  $S: 0
};
`;

jsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  console.log(`Fixing: ${fp}`);
  let code = fs.readFileSync(fp, 'utf8');

  // 1. Gỡ bỏ phần bị chèn nhầm ở đầu file trước (function dartProgram()
  const badTopRegex = /^[\s\S]*?A\.aReactionBadgeTap[\s\S]*?\$S:\s*0\s*[\r\n\};]+\s*(?=\(function dartProgram)/;
  if (badTopRegex.test(code)) {
    code = code.replace(badTopRegex, '');
    console.log(`  -> Đã gỡ bỏ đoạn mã nằm ngoài dartProgram`);
  }

  // Nếu vẫn còn ở đầu file:
  if (code.startsWith('A.aReactionBadgeTap') || code.indexOf('A.aReactionBadgeTap') < code.indexOf('(function dartProgram')) {
    const dartProgIdx = code.indexOf('(function dartProgram');
    if (dartProgIdx !== -1) {
      code = code.substring(dartProgIdx);
      console.log(`  -> Cắt bỏ phần đầu lỗi trước (function dartProgram`);
    }
  }

  // 2. Chèn A.aReactionBadgeTap vào ngay sau A.atTap.prototype (nơi A đã tồn tại và nằm trong scope)
  const targetAnchor = 'A.atTap.prototype=';
  if (code.includes(targetAnchor) && !code.includes('A.aReactionBadgeTap.prototype')) {
    code = code.replace(targetAnchor, reactionTapDefinition + '\n' + targetAnchor);
    console.log(`  -> Đã gắn A.aReactionBadgeTap vào đúng scope bên trong dartProgram!`);
  }

  fs.writeFileSync(fp, code, 'utf8');

  // Kiểm tra cú pháp trong VM
  try {
    new vm.Script(code);
    console.log(`  -> [PASS] Cú pháp JS hợp lệ 100%!`);
  } catch (err) {
    console.error(`  -> [FAIL] Cú pháp JS:`, err.message);
  }
});

console.log('✅ Hoàn tất sửa scope cho main.dart.js!');
