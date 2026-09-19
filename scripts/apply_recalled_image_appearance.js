const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu áp dụng giao diện "Ảnh đã thu hồi" chuẩn như thu hồi tin nhắn...');

// ════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT 4 FILE MAIN.DART.JS
// ════════════════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const globalImgHelpers = `
$.checkImgMessage = function(m) {
  if (!m) return !1;
  var t = m.d;
  if (t === "image") return !0;
  var c = (m.e || "").toLowerCase(), u = m.f || "";
  if (c.indexOf("data:image") === 0 || u.length > 0) return !0;
  return c.indexOf(".jpg") !== -1 || c.indexOf(".jpeg") !== -1 || c.indexOf(".png") !== -1 ||
         c.indexOf(".webp") !== -1 || c.indexOf(".gif") !== -1 || c.indexOf(".jfif") !== -1 ||
         c.indexOf(".heic") !== -1 || c.indexOf(".heif") !== -1 || c.indexOf(".avif") !== -1 ||
         c.indexOf(".bmp") !== -1 || c.indexOf("/chat-media/") !== -1 || c.indexOf("/images/") !== -1;
};
$.getRecalledImageWidget = function() {
  return new A.ap("\\u1ea2nh \\u0111\\xe3 thu h\\u1ed3i", null, B.DX, null, null, null, null, null, null, null, null);
};
`;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang xử lý: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // 1. Thêm $.checkImgMessage và $.getRecalledImageWidget nếu chưa có
  if (!content.includes('$.checkImgMessage = function')) {
    content = content.replace('$.buildPhotoDeckWidget = function', globalImgHelpers + '\r\n$.buildPhotoDeckWidget = function');
    console.log('  [OK] Đã chèn $.checkImgMessage và $.getRecalledImageWidget');
  }

  // 2. Cập nhật thẻ placeholder trong buildPhotoDeckWidget: hiển thị "Ảnh đã thu hồi" với viền chuẩn và kiểu chữ B.DX
  const oldCardPlaceholder = /if\s*\(msg\.y\)\s*\{[\s\S]*?var recIcon\s*=\s*A\.a2[\s\S]*?return A\.a5\(null,\s*recBody,\s*B\.h,\s*null,\s*null,\s*recDeco,\s*null,\s*w,\s*null,\s*null,\s*null,\s*null,\s*h\);[\r\n\s]*\}/;
  const newCardPlaceholder = `if (msg.y) {
      var recText = A.a2("\\u1ea2nh \\u0111\\xe3 thu h\\u1ed3i", null, 1, B.a9, null, null, B.DX, null, null, null);
      var recDeco = new A.ak(new A.q(4294507004), null, A.dx(B.ee, 1), A.ag(22), null, null, B.t);
      return A.a5(null, recText, B.h, null, null, recDeco, null, w, null, null, null, null, h);
    }`;

  if (oldCardPlaceholder.test(content)) {
    content = content.replace(oldCardPlaceholder, newCardPlaceholder);
    console.log('  [OK] Đã cập nhật thẻ placeholder thành viền xám 1px + chữ "Ảnh đã thu hồi" trong buildPhotoDeckWidget');
  }

  // 3. Cập nhật trong bong bóng tin nhắn đơn lẻ: if(q)a=B.axz -> nếu là ảnh thì a = $.getRecalledImageWidget()
  const oldSingleBubble = 'if(q)a=B.axz';
  const newSingleBubble = 'if(q){var _isImg=(typeof $.checkImgMessage==="function")?$.checkImgMessage(a):!1;a=_isImg?$.getRecalledImageWidget():B.axz;}';
  if (content.includes(oldSingleBubble)) {
    content = content.replace(oldSingleBubble, newSingleBubble);
    console.log('  [OK] Đã cập nhật bong bóng tin nhắn đơn lẻ hiển thị "Ảnh đã thu hồi"');
  }

  // 4. Cập nhật trong aaY: if(a.y)return B.axj -> nếu là ảnh thì return $.getRecalledImageWidget()
  const oldAaY = 'if(a.y)return B.axj';
  const newAaY = 'if(a.y){var _isImg=(typeof $.checkImgMessage==="function")?$.checkImgMessage(a):!1;return _isImg?$.getRecalledImageWidget():B.axj;}';
  if (content.includes(oldAaY)) {
    content = content.replace(oldAaY, newAaY);
    console.log('  [OK] Đã cập nhật aaY hiển thị "Ảnh đã thu hồi"');
  }

  // Kiểm tra cú pháp VM
  try {
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [SUCCESS] Syntax check hợp lệ 100% cho: ${file}`);
  } catch (err) {
    console.error(`  [ERROR] Lỗi cú pháp khi cập nhật ${file}:`, err);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT CHAT_SCREEN.DART (CẢ 2 NƠI)
// ════════════════════════════════════════════════════════════════════════════
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n========================================`);
  console.log(`Đang cập nhật Dart: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // 1. Cập nhật _buildPhotoDeckCardImage
  const oldDeckCard = /Widget _buildPhotoDeckCardImage\(MessageModel msg\)\s*\{[\s\S]*?if\s*\(msg\.isRecalled\)\s*\{[\s\S]*?\}\s*final content = msg\.content;/;
  const newDeckCard = `Widget _buildPhotoDeckCardImage(MessageModel msg) {
    if (msg.isRecalled) {
      return Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9).withOpacity(0.6),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFCBD5E1), width: 1),
        ),
        child: const Center(
          child: Text(
            'Ảnh đã thu hồi',
            style: TextStyle(
              color: Color(0xFF8A8D91),
              fontSize: 14,
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
      );
    }
    final content = msg.content;`;

  if (oldDeckCard.test(content)) {
    content = content.replace(oldDeckCard, newDeckCard);
    console.log('  [OK] Đã cập nhật _buildPhotoDeckCardImage trong Dart');
  }

  // 2. Cập nhật bong bóng tin nhắn: 'Tin nhắn đã bị thu hồi' -> check _isImageMessage
  const oldBubbleText1 = "child: msg.isRecalled\n                                                        ? const Text(\n                                                            'Tin nhắn đã bị thu hồi',";
  const oldBubbleText1CRLF = "child: msg.isRecalled\r\n                                                        ? const Text(\r\n                                                            'Tin nhắn đã bị thu hồi',";
  const newBubbleText1 = "child: msg.isRecalled\n                                                        ? Text(\n                                                            _isImageMessage(msg) ? 'Ảnh đã thu hồi' : 'Tin nhắn đã bị thu hồi',";

  if (content.includes(oldBubbleText1)) {
    content = content.replace(oldBubbleText1, newBubbleText1);
    console.log('  [OK] Đã thay thế oldBubbleText1 (LF)');
  } else if (content.includes(oldBubbleText1CRLF)) {
    content = content.replace(oldBubbleText1CRLF, newBubbleText1);
    console.log('  [OK] Đã thay thế oldBubbleText1 (CRLF)');
  }

  // 3. Cập nhật _buildMessageBubbleContent: 'Tin nhắn đã được thu hồi'
  const oldBubbleText2 = "if (msg.isRecalled) {\n      return const Text(\n        'Tin nhắn đã được thu hồi',";
  const oldBubbleText2CRLF = "if (msg.isRecalled) {\r\n      return const Text(\r\n        'Tin nhắn đã được thu hồi',";
  const newBubbleText2 = "if (msg.isRecalled) {\n      return Text(\n        _isImageMessage(msg) ? 'Ảnh đã thu hồi' : 'Tin nhắn đã được thu hồi',";

  if (content.includes(oldBubbleText2)) {
    content = content.replace(oldBubbleText2, newBubbleText2);
    console.log('  [OK] Đã thay thế oldBubbleText2 (LF)');
  } else if (content.includes(oldBubbleText2CRLF)) {
    content = content.replace(oldBubbleText2CRLF, newBubbleText2);
    console.log('  [OK] Đã thay thế oldBubbleText2 (CRLF)');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`💾 Đã lưu thành công Dart: ${file}`);
});

console.log('\n🎉 Hoàn tất áp dụng giao diện "Ảnh đã thu hồi"!');
