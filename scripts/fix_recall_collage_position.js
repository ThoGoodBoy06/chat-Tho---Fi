const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu sửa lỗi logic thu hồi ảnh trong Album / Collage...');

// ════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT 4 FILE MAIN.DART.JS
// ════════════════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const newTapClass = `A.aAlbumDeckTap = function aAlbumDeckTap(cluster, index) {
  this.cluster = cluster;
  this.index = typeof index === 'number' ? index : 0;
};
A.aAlbumDeckTap.prototype = {
  $0() {
    try {
      if (!this.cluster || !this.cluster.length) return;
      var curMsg = this.cluster[this.index];
      if (curMsg && curMsg.y) return; // Nếu đã thu hồi thì không mở gallery modal

      var urls = [];
      var targetUrl = "";
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
        if (!m || m.y) continue; // Bỏ qua ảnh đã thu hồi
        var s = m.e || "";
        var f = m.f || "";
        var u = (f && f.length > 0) ? f : s;
        if (!u || u === "[Hình ảnh]" || u === "[Ảnh]") {
          u = (f && f.length > 0) ? f : (m.imageUrl || m.content || "");
        }
        if (typeof u === "string" && u.startsWith("/")) {
          var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
          u = _be + u;
        }
        if (u) {
          if (i === this.index) targetUrl = u;
          urls.push(u);
        }
      }
      var targetIdx = targetUrl ? urls.indexOf(targetUrl) : 0;
      if (targetIdx < 0) targetIdx = 0;
      if (window.openAlbumGalleryModal && urls.length > 0) {
        window.openAlbumGalleryModal(urls, targetIdx);
      } else if (window.openImageModal && urls.length > 0) {
        window.openImageModal(urls[targetIdx] || urls[0]);
      }
    } catch(e) {
      console.error("Tap album error:", e);
    }
  },
  $S: 0
};`;

const newBuildPhotoDeckWidget = `$.buildPhotoDeckWidget = function(cluster, chatState, isMe, ctx, prov) {
  if (!cluster || cluster.length < 2) return null;

  // Nếu TẤT CẢ ảnh trong cụm đều đã bị thu hồi -> trả về null để rơi xuống render 1 bong bóng "Tin nhắn đã được thu hồi" duy nhất
  var allRecalled = cluster.every(function(m) { return m && m.y; });
  if (allRecalled) return null;

  var count = cluster.length;
  var isFwd = cluster && cluster.some(function(m) { return m && (m.isForwarded === true || m.is_forwarded === true); });

  function makeCardImg(msg, w, h) {
    if (!msg) return B.yF;

    // Nếu ảnh này đã bị thu hồi -> hiển thị thẻ placeholder "Đã thu hồi" cố định kích thước chuẩn
    if (msg.y) {
      var recIcon = A.a2("\\u21ba", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4286940801), null, null, null, null, null, null, null, null, 24, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      var recText = A.a2("\\u0110\\xe3 thu h\\u1ed3i", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4286940801), null, null, null, null, null, null, null, null, 12, null, null, null, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      var recBody = A.bm(A.b([recIcon, new A.cv(null, 5, null, null), recText], t.p), B.m, B.m, B.G);
      var recDeco = new A.ak(new A.q(4293980917), null, null, A.ag(22), null, null, B.t);
      return A.a5(null, recBody, B.h, null, null, recDeco, null, w, null, null, null, null, h);
    }

    var s = msg.e || "";
    var f = msg.f || "";
    var raw = (f && f.length > 0) ? f : s;
    if (!raw || raw === "[Hình ảnh]" || raw === "[Ảnh]") {
      raw = (f && f.length > 0) ? f : (msg.imageUrl || msg.content || "");
    }

    var img = null;

    // 1. Data URI (Base64) -> MemoryImage (A.oH) with bytes
    if (typeof raw === "string" && raw.indexOf("data:image") === 0) {
      try {
        var commaIdx = raw.indexOf(",");
        if (commaIdx !== -1) {
          var b64 = raw.substring(commaIdx + 1);
          var bytes = B.kC.ci(b64);
          if (bytes) {
            img = new A.mD(A.aLD(null, null, new A.oH(bytes, 1)), new A.auP(), null, null, B.cp, B.e8, null);
          }
        }
      } catch(e) {
        console.warn("Base64 decode err in photo deck:", e);
      }
    }

    // 2. HTTP/HTTPS or relative URL -> NetworkImage (A.eY)
    if (!img) {
      var url = raw;
      if (typeof url === "string" && url.length > 0) {
        if (url.startsWith("/")) {
          var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
          url = _be + url;
        }
        img = new A.mD(A.aLD(null, null, new A.eY(url, 1, null)), new A.auQ(), null, null, B.cp, B.e8, null);
      } else {
        img = B.yF;
      }
    }

    var cellImg = new A.cv(w, h, img, null);
    var isSending = msg.status === "sending" || (msg.a && (msg.a.indexOf("optimistic-") === 0 || msg.a.indexOf("uploading-") === 0 || msg.a.indexOf("temp_") === 0));

    if (isSending) {
      var _spin = A.bV(B.rw, B.f, null, 26);
      var _shade = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(1879048192), null, null, null, null, null, B.t), null, w, null, null, null, null, h);
      return A.dt(B.aF, A.b([cellImg, _shade], t.p), B.r, B.ap);
    }
    return cellImg;
  }

  function makeShareButton() {
    var shareArrow = A.a2("\\u21aa", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4279244074), null, null, null, null, null, null, null, null, 17, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
    var shareDeco = new A.ak(new A.q(4293980917), null, null, A.ag(17), null, null, B.t);
    var shareBtnInner = A.a5(null, shareArrow, B.h, null, new A.ao(0, 34, 0, 34), shareDeco, null, null, null, null, null, null, null);
    return A.dr(null, shareBtnInner, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumShareTap(cluster), null, null, null, null, null, null, !1, B.ao);
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 1: 2 ẢNH (Bố cục 2 ảnh so le - CỐ ĐỊNH VỊ TRÍ)
  // ══════════════════════════════════════════════════════════════
  if (count === 2) {
    var cW = 175;
    var cH = 175;
    var totalW = 240;
    var totalH = 285;

    // Card 1: Góc trên-trái (top: 0, left: 0) - CỐ ĐỊNH 100%
    var img1 = makeCardImg(cluster[0], cW, cH);
    var clip1 = A.aP5(A.ag(22), img1);
    var secTap1 = (ctx && prov && !cluster[0].y) ? new A.atV(chatState, ctx, cluster[0], prov, isMe) : null;
    var lngPress1 = (ctx && prov && !cluster[0].y) ? new A.atW(chatState, ctx, cluster[0], prov, isMe) : null;
    var tap1 = A.dr(null, clip1, B.M, !1, null, null, null, null, null, null, null, null, secTap1, null, null, null, null, null, null, null, null, null, null, lngPress1, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);
    var pos1 = A.eG(0, tap1, null, null, 0, null, null, null);

    // Card 2: Góc dưới-phải (top: 110, left: 65) - CỐ ĐỊNH 100%
    var img2 = makeCardImg(cluster[1], cW, cH);
    var clip2 = A.aP5(A.ag(22), img2);
    var secTap2 = (ctx && prov && !cluster[1].y) ? new A.atV(chatState, ctx, cluster[1], prov, isMe) : null;
    var lngPress2 = (ctx && prov && !cluster[1].y) ? new A.atW(chatState, ctx, cluster[1], prov, isMe) : null;
    var tap2 = A.dr(null, clip2, B.M, !1, null, null, null, null, null, null, null, null, secTap2, null, null, null, null, null, null, null, null, null, null, lngPress2, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);
    var pos2 = A.eG(110, tap2, null, null, 65, null, null, null);

    var stack2 = new A.cv(totalW, totalH, A.dt(B.aF, A.b([pos1, pos2], t.p), B.r, B.ap), null);
    var shareBtn2 = makeShareButton();
    var rowChildren2 = isMe ? [shareBtn2, new A.cv(10, null, null, null), stack2] : [stack2, new A.cv(10, null, null, null), shareBtn2];
    var middleRow2 = A.b9(A.b(rowChildren2, t.p), isMe ? B.dw : B.l, B.m, B.G);

    if (isFwd) {
      var fwdLabel2 = A.a2("\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4284897131), null, null, null, null, null, null, null, null, 12, null, null, null, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      return A.bm(A.b([fwdLabel2, new A.cv(null, 4, null, null), middleRow2], t.p), isMe ? B.dw : B.aS, B.m, B.G);
    }
    return middleRow2;
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 2: 3 ẢNH (Bố cục 3 ảnh zíc zắc - CỐ ĐỊNH VỊ TRÍ)
  // ══════════════════════════════════════════════════════════════
  if (count === 3) {
    var cW = 170;
    var cH = 170;
    var totalW = 235;
    var totalH = 400;

    // Card 1: Góc trên-phải (top: 0, left: 65) - CỐ ĐỊNH 100%
    var img1_3 = makeCardImg(cluster[0], cW, cH);
    var clip1_3 = A.aP5(A.ag(22), img1_3);
    var secTap1_3 = (ctx && prov && !cluster[0].y) ? new A.atV(chatState, ctx, cluster[0], prov, isMe) : null;
    var lngPress1_3 = (ctx && prov && !cluster[0].y) ? new A.atW(chatState, ctx, cluster[0], prov, isMe) : null;
    var tap1_3 = A.dr(null, clip1_3, B.M, !1, null, null, null, null, null, null, null, null, secTap1_3, null, null, null, null, null, null, null, null, null, null, lngPress1_3, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);
    var pos1_3 = A.eG(0, tap1_3, null, null, 65, null, null, null);

    // Card 2: Ở giữa-trái (top: 115, left: 0) - CỐ ĐỊNH 100%
    var img2_3 = makeCardImg(cluster[1], cW, cH);
    var clip2_3 = A.aP5(A.ag(22), img2_3);
    var secTap2_3 = (ctx && prov && !cluster[1].y) ? new A.atV(chatState, ctx, cluster[1], prov, isMe) : null;
    var lngPress2_3 = (ctx && prov && !cluster[1].y) ? new A.atW(chatState, ctx, cluster[1], prov, isMe) : null;
    var tap2_3 = A.dr(null, clip2_3, B.M, !1, null, null, null, null, null, null, null, null, secTap2_3, null, null, null, null, null, null, null, null, null, null, lngPress2_3, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);
    var pos2_3 = A.eG(115, tap2_3, null, null, 0, null, null, null);

    // Card 3: Góc dưới-phải (top: 230, left: 65) - CỐ ĐỊNH 100%
    var img3_3 = makeCardImg(cluster[2], cW, cH);
    var clip3_3 = A.aP5(A.ag(22), img3_3);
    var secTap3_3 = (ctx && prov && !cluster[2].y) ? new A.atV(chatState, ctx, cluster[2], prov, isMe) : null;
    var lngPress3_3 = (ctx && prov && !cluster[2].y) ? new A.atW(chatState, ctx, cluster[2], prov, isMe) : null;
    var tap3_3 = A.dr(null, clip3_3, B.M, !1, null, null, null, null, null, null, null, null, secTap3_3, null, null, null, null, null, null, null, null, null, null, lngPress3_3, null, new A.aAlbumDeckTap(cluster, 2), null, null, null, null, null, null, !1, B.ao);
    var pos3_3 = A.eG(230, tap3_3, null, null, 65, null, null, null);

    var stack3 = new A.cv(totalW, totalH, A.dt(B.aF, A.b([pos1_3, pos2_3, pos3_3], t.p), B.r, B.ap), null);
    var shareBtn3 = makeShareButton();
    var rowChildren3 = isMe ? [shareBtn3, new A.cv(10, null, null, null), stack3] : [stack3, new A.cv(10, null, null, null), shareBtn3];
    var middleRow3 = A.b9(A.b(rowChildren3, t.p), isMe ? B.dw : B.l, B.m, B.G);

    if (isFwd) {
      var fwdLabel3 = A.a2("\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4284897131), null, null, null, null, null, null, null, null, 12, null, null, null, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      return A.bm(A.b([fwdLabel3, new A.cv(null, 4, null, null), middleRow3], t.p), isMe ? B.dw : B.aS, B.m, B.G);
    }
    return middleRow3;
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 3: TRÊN 4 ẢNH (>= 4) -> ALBUM ẢNH DẠNG CHỒNG THẺ 3D
  // ══════════════════════════════════════════════════════════════
  var cardW = 200;
  var cardH = 260;

  var activeFirst = cluster.find(function(m) { return m && !m.y; }) || cluster[0];
  var activeCount = cluster.filter(function(m) { return m && !m.y; }).length;

  var titleText = (isFwd ? "\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp \\u2022 " : "\\u229e ") + (activeCount > 0 ? activeCount : count) + " \\u1ea3nh";
  var headerTitle = A.a2(titleText, null, 1, B.a9, null, null, A.ay(null, null, new A.q(isFwd ? 4284507000 : 4283124560), null, null, null, null, null, null, null, null, 16, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 6, null, null);

  var stackCards = [];
  var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 8, null, null, null, null, cardH - 8);
  var posBack2 = A.eG(0, backCard2, null, null, 4, null, null, null);
  stackCards.push(posBack2);

  var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 4, null, null, null, null, cardH - 4);
  var posBack1 = A.eG(4, backCard1, null, null, 12, null, null, null);
  stackCards.push(posBack1);

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
  console.log(`\n========================================`);
  console.log(`Đang xử lý: ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  // 1. Sửa hàm _checkImg: KHÔNG loại bỏ ảnh đã thu hồi (bỏ !m||m.y -> chỉ còn !m)
  const oldCheckImg = 'function _checkImg(m){if(!m||m.y)return!1;';
  const newCheckImg = 'function _checkImg(m){if(!m)return!1;';
  if (content.includes(oldCheckImg)) {
    content = content.replace(oldCheckImg, newCheckImg);
    console.log('  [OK] Đã sửa _checkImg để nhận diện cả ảnh đã thu hồi trong cụm.');
  } else if (content.includes(newCheckImg)) {
    console.log('  [Info] _checkImg đã được cập nhật trước đó.');
  } else {
    console.warn('  [WARN] Không tìm thấy oldCheckImg!');
  }

  // 2. Cập nhật lời gọi buildPhotoDeckWidget để truyền cả context (a) và provider (g)
  const oldCall = 'var gridWidget=$.buildPhotoDeckWidget(_cl,i.a,b);';
  const newCall = 'var gridWidget=$.buildPhotoDeckWidget(_cl,i.a,b,a,g);';
  if (content.includes(oldCall)) {
    content = content.replace(oldCall, newCall);
    console.log('  [OK] Đã cập nhật lời gọi sang $.buildPhotoDeckWidget(_cl,i.a,b,a,g);');
  } else if (content.includes(newCall)) {
    console.log('  [Info] Lời gọi buildPhotoDeckWidget đã có a và g.');
  }

  // 3. Cập nhật A.aAlbumDeckTap
  const deckTapPattern = /A\.aAlbumDeckTap\s*=\s*function aAlbumDeckTap\(cluster[\s\S]*?A\.aAlbumDeckTap\.prototype\s*=\s*\{[\s\S]*?\$S:\s*0[\s\S]*?\};/g;
  if (deckTapPattern.test(content)) {
    content = content.replace(deckTapPattern, newTapClass);
    console.log('  [OK] Đã cập nhật A.aAlbumDeckTap');
  }

  // 4. Cập nhật $.buildPhotoDeckWidget
  const deckWidgetPattern = /\$\.buildPhotoDeckWidget\s*=\s*function\(cluster,\s*chatState,\s*isMe[\s\S]*?return A\.bm\(A\.b\(\[headerTitle,\s*headerSpacing,\s*middleRow\],\s*t\.p\),\s*isMe\s*\?\s*B\.dw\s*:\s*B\.aS,\s*B\.m,\s*B\.G\);[\r\n\s]*\};/g;
  if (deckWidgetPattern.test(content)) {
    content = content.replace(deckWidgetPattern, newBuildPhotoDeckWidget);
    console.log('  [OK] Đã thay thế $.buildPhotoDeckWidget với tính năng cố định vị trí khi thu hồi.');
  } else {
    console.warn('  [WARN] Không match được pattern cũ của $.buildPhotoDeckWidget!');
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

  // 1. Sửa _isImageMessage trong Dart: bỏ if (msg.isRecalled) return false;
  const oldDartIsImg = '  bool _isImageMessage(MessageModel msg) {\r\n    if (msg.isRecalled) return false;';
  const oldDartIsImgLF = '  bool _isImageMessage(MessageModel msg) {\n    if (msg.isRecalled) return false;';
  const newDartIsImg = '  bool _isImageMessage(MessageModel msg) {\n    // Giữ nguyên cụm ảnh kể cả khi có ảnh bị thu hồi để vị trí các ảnh còn lại cố định không nhảy dòng';

  if (content.includes(oldDartIsImg)) {
    content = content.replace(oldDartIsImg, newDartIsImg);
    console.log('  [OK] Đã xóa msg.isRecalled check khỏi _isImageMessage (CRLF)');
  } else if (content.includes(oldDartIsImgLF)) {
    content = content.replace(oldDartIsImgLF, newDartIsImg);
    console.log('  [OK] Đã xóa msg.isRecalled check khỏi _isImageMessage (LF)');
  }

  // 2. Sửa _buildPhotoDeckCardImage để hiển thị thẻ "Đã thu hồi"
  const oldCardImgStart = '  Widget _buildPhotoDeckCardImage(MessageModel msg) {';
  const newCardImgImplementation = `  Widget _buildPhotoDeckCardImage(MessageModel msg) {
    if (msg.isRecalled) {
      return Container(
        color: const Color(0xFFE4E6EB),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.replay_rounded, size: 24, color: Color(0xFF8A8D91)),
              const SizedBox(height: 4),
              const Text(
                'Đã thu hồi',
                style: TextStyle(
                  color: Color(0xFF8A8D91),
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      );
    }`;

  if (content.includes(oldCardImgStart) && !content.includes('if (msg.isRecalled) {\n      return Container(\n        color: const Color(0xFFE4E6EB)')) {
    content = content.replace(oldCardImgStart, newCardImgImplementation);
    console.log('  [OK] Đã cập nhật _buildPhotoDeckCardImage hiển thị thẻ Đã thu hồi');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`💾 Đã lưu thành công Dart: ${file}`);
});

console.log('\n🎉 Hoàn tất sửa lỗi logic thu hồi ảnh cố định vị trí!');
