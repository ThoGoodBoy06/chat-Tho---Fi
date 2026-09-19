const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Khôi phục Chồng Thẻ Ảnh 3D (3D Stacked Card Album) cho TẤT CẢ các Album...');

// 1. Cập nhật 2 file chat_screen.dart
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
];

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  const oldBranchPattern = /Widget _buildPhotoDeckAlbum\(BuildContext context, List<MessageModel> cluster, bool isMe\) \{[\s\S]*?if \(count == 2\) \{[\s\S]*?return _buildTwoPhotoCollage\(context, cluster, isMe, photoUrls\);[\s\S]*?\} else if \(count == 3\) \{[\s\S]*?return _buildThreePhotoCollage\(context, cluster, isMe, photoUrls\);[\s\S]*?\} else \{[\s\S]*?return _buildFourPlusPhotoDeck\(context, cluster, isMe, photoUrls\);[\s\S]*?\}[\s\S]*?\}/;

  const newDeckImplementation = `Widget _buildPhotoDeckAlbum(BuildContext context, List<MessageModel> cluster, bool isMe) {
    final count = cluster.length;
    final photoUrls = cluster.map((m) {
      if (m.content.startsWith('data:image')) return m.content;
      return m.imageUrl != null && m.imageUrl!.isNotEmpty ? ApiService.formatImageUrl(m.imageUrl!) : ApiService.formatImageUrl(m.content);
    }).toList();

    // Toàn bộ Album (>= 2 ảnh) đều hiển thị theo kiểu Chồng Thẻ Ảnh 3D
    return _buildFourPlusPhotoDeck(context, cluster, isMe, photoUrls);
  }`;

  if (oldBranchPattern.test(code)) {
    code = code.replace(oldBranchPattern, newDeckImplementation);
    fs.writeFileSync(file, code, 'utf8');
    console.log(`✅ Đã cập nhật Album 3D trong: ${path.relative(path.join(__dirname, '..'), file)}`);
  } else {
    console.log(`⚡ Pattern không khớp hoặc đã là Album 3D trong: ${path.relative(path.join(__dirname, '..'), file)}`);
  }
});

// 2. Cập nhật 4 file main.dart.js
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const new3DDeckTail = `var cardW = 200;
  var cardH = 260;

  var activeFirst = cluster.find(function(m) { return m && !m.y; }) || cluster[0];
  var activeCount = cluster.filter(function(m) { return m && !m.y; }).length;

  var titleText = (isFwd ? "\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp \\u2022 " : "\\u229e ") + (activeCount > 0 ? activeCount : count) + " \\u1ea3nh";
  var headerTitle = A.a2(titleText, null, 1, B.a9, null, null, A.ay(null, null, new A.q(isFwd ? 4284507000 : 4283124560), null, null, null, null, null, null, null, null, 16, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 6, null, null);

  var stackCards = [];
  if (count >= 3) {
    var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 8, null, null, null, null, cardH - 8);
    var posBack2 = A.eG(0, backCard2, null, null, 4, null, null, null);
    stackCards.push(posBack2);
  }

  if (count >= 2) {
    var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 4, null, null, null, null, cardH - 4);
    var posBack1 = A.eG(4, backCard1, null, null, 12, null, null, null);
    stackCards.push(posBack1);
  }

  var frontImg = makeCardImg(activeFirst, cardW, cardH);
  var frontClipped = A.aP5(A.ag(24), frontImg);
  var posFront = A.eG(8, frontClipped, null, null, 0, null, null, null);
  stackCards.push(posFront);

  var deckStack = new A.cv(cardW + 16, cardH + 12, A.dt(B.aF, A.b(stackCards, t.p), B.r, B.ap), null);
  var deckWithTap = A.dr(null, deckStack, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);

  var middleRow = deckWithTap;
  return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);
};`;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  const deckFuncIdx = content.indexOf('$.buildPhotoDeckWidget = function');
  if (deckFuncIdx === -1) {
    console.warn(`[SKIP] Không tìm thấy $.buildPhotoDeckWidget trong ${file}`);
    return;
  }

  const c2Idx = content.indexOf('if (count === 2)', deckFuncIdx);
  const endSearch = 'return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);';
  const endIdx = content.indexOf(endSearch, deckFuncIdx);

  if (c2Idx !== -1 && endIdx !== -1 && c2Idx < endIdx) {
    let cutStart = content.lastIndexOf('function makeShareButton()', c2Idx);
    if (cutStart === -1 || cutStart < deckFuncIdx) cutStart = c2Idx;

    let cutEnd = content.indexOf('};', endIdx) + 2;

    content = content.substring(0, cutStart) + new3DDeckTail + content.substring(cutEnd);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Đã khôi phục Chồng Thẻ Ảnh 3D trong: ${path.relative(path.join(__dirname, '..'), file)}`);

    try {
      new vm.Script(content);
      console.log(`   [PASS] Syntax main.dart.js hợp lệ`);
    } catch (e) {
      console.error(`   [FAIL] Lỗi syntax:`, e.message);
      process.exit(1);
    }
  } else {
    console.log(`⚡ File đã ở định dạng Chồng Thẻ 3D: ${path.relative(path.join(__dirname, '..'), file)}`);
  }
});

console.log('🎉 Hoàn tất khôi phục Album 3D cho toàn bộ Album!');
