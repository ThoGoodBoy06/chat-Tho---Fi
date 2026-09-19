const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu áp dụng giao diện bố cục 2 ảnh, 3 ảnh chuẩn Messenger và Album 3D cho >= 4 ảnh...');

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
      var urls = [];
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
        if (!m) continue;
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
        if (u) urls.push(u);
      }
      var targetIdx = (this.index >= 0 && this.index < urls.length) ? this.index : 0;
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

const newBuildPhotoDeckWidget = `$.buildPhotoDeckWidget = function(cluster, chatState, isMe) {
  if (!cluster || cluster.length < 2) return null;

  var count = cluster.length;
  var isFwd = cluster && cluster.some(function(m) { return m && (m.isForwarded === true || m.is_forwarded === true); });

  function makeCardImg(msg, w, h) {
    if (!msg) return B.yF;
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
    var shareArrow = A.a2("\u21aa", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4279244074), null, null, null, null, null, null, null, null, 17, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
    var shareDeco = new A.ak(new A.q(4293980917), null, null, A.ag(17), null, null, B.t);
    var shareBtnInner = A.a5(null, shareArrow, B.h, null, new A.ao(0, 34, 0, 34), shareDeco, null, null, null, null, null, null, null);
    return A.dr(null, shareBtnInner, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumShareTap(cluster), null, null, null, null, null, null, !1, B.ao);
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 1: 2 ẢNH (Bố cục 2 ảnh so le - Giống ảnh mẫu bên trái)
  // ══════════════════════════════════════════════════════════════
  if (count === 2) {
    var cW = 175;
    var cH = 175;
    var totalW = 240;
    var totalH = 285;

    // Card 1: Góc trên-trái (top: 0, left: 0)
    var img1 = makeCardImg(cluster[0], cW, cH);
    var clip1 = A.aP5(A.ag(22), img1);
    var tap1 = A.dr(null, clip1, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);
    var pos1 = A.eG(0, tap1, null, null, 0, null, null, null);

    // Card 2: Góc dưới-phải (top: 110, left: 65) - đè lên card 1
    var img2 = makeCardImg(cluster[1], cW, cH);
    var clip2 = A.aP5(A.ag(22), img2);
    var tap2 = A.dr(null, clip2, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);
    var pos2 = A.eG(110, tap2, null, null, 65, null, null, null);

    var stack2 = new A.cv(totalW, totalH, A.dt(B.aF, A.b([pos1, pos2], t.p), B.r, B.ap), null);
    var shareBtn2 = makeShareButton();
    var rowChildren2 = isMe ? [shareBtn2, new A.cv(10, null, null, null), stack2] : [stack2, new A.cv(10, null, null, null), shareBtn2];
    var middleRow2 = A.b9(A.b(rowChildren2, t.p), isMe ? B.dw : B.l, B.m, B.G);

    if (isFwd) {
      var fwdLabel2 = A.a2("\u21aa \u0110\xe3 chuy\u1ec3n ti\u1ebfp", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4284897131), null, null, null, null, null, null, null, null, 12, null, null, null, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      return A.bm(A.b([fwdLabel2, new A.cv(null, 4, null, null), middleRow2], t.p), isMe ? B.dw : B.aS, B.m, B.G);
    }
    return middleRow2;
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 2: 3 ẢNH (Bố cục 3 ảnh zíc zắc - Giống ảnh mẫu bên phải)
  // ══════════════════════════════════════════════════════════════
  if (count === 3) {
    var cW = 170;
    var cH = 170;
    var totalW = 235;
    var totalH = 400;

    // Card 1: Góc trên-phải (top: 0, left: 65)
    var img1_3 = makeCardImg(cluster[0], cW, cH);
    var clip1_3 = A.aP5(A.ag(22), img1_3);
    var tap1_3 = A.dr(null, clip1_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);
    var pos1_3 = A.eG(0, tap1_3, null, null, 65, null, null, null);

    // Card 2: Ở giữa-trái (top: 115, left: 0) - đè lên card 1
    var img2_3 = makeCardImg(cluster[1], cW, cH);
    var clip2_3 = A.aP5(A.ag(22), img2_3);
    var tap2_3 = A.dr(null, clip2_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 1), null, null, null, null, null, null, !1, B.ao);
    var pos2_3 = A.eG(115, tap2_3, null, null, 0, null, null, null);

    // Card 3: Góc dưới-phải (top: 230, left: 65) - đè lên card 2
    var img3_3 = makeCardImg(cluster[2], cW, cH);
    var clip3_3 = A.aP5(A.ag(22), img3_3);
    var tap3_3 = A.dr(null, clip3_3, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 2), null, null, null, null, null, null, !1, B.ao);
    var pos3_3 = A.eG(230, tap3_3, null, null, 65, null, null, null);

    var stack3 = new A.cv(totalW, totalH, A.dt(B.aF, A.b([pos1_3, pos2_3, pos3_3], t.p), B.r, B.ap), null);
    var shareBtn3 = makeShareButton();
    var rowChildren3 = isMe ? [shareBtn3, new A.cv(10, null, null, null), stack3] : [stack3, new A.cv(10, null, null, null), shareBtn3];
    var middleRow3 = A.b9(A.b(rowChildren3, t.p), isMe ? B.dw : B.l, B.m, B.G);

    if (isFwd) {
      var fwdLabel3 = A.a2("\u21aa \u0110\xe3 chuy\u1ec3n ti\u1ebfp", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4284897131), null, null, null, null, null, null, null, null, 12, null, null, null, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
      return A.bm(A.b([fwdLabel3, new A.cv(null, 4, null, null), middleRow3], t.p), isMe ? B.dw : B.aS, B.m, B.G);
    }
    return middleRow3;
  }

  // ══════════════════════════════════════════════════════════════
  // TRƯỜNG HỢP 3: TRÊN 4 ẢNH (>= 4) -> ALBUM ẢNH DẠNG CHỒNG THẺ 3D
  // ══════════════════════════════════════════════════════════════
  var cardW = 200;
  var cardH = 260;

  // 1. Tiêu đề "⊞ N ảnh" hoặc "↪ Đã chuyển tiếp • N ảnh"
  var titleText = (isFwd ? "\u21aa \u0110\xe3 chuy\u1ec3n ti\u1ebfp \u2022 " : "\u229e ") + count + " \u1ea3nh";
  var headerTitle = A.a2(titleText, null, 1, B.a9, null, null, A.ay(null, null, new A.q(isFwd ? 4284507000 : 4283124560), null, null, null, null, null, null, null, null, 16, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 6, null, null);

  // 2. Chồng Thẻ Ảnh 3D (Stacked Cards)
  var stackCards = [];
  var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 8, null, null, null, null, cardH - 8);
  var posBack2 = A.eG(0, backCard2, null, null, 4, null, null, null);
  stackCards.push(posBack2);

  var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 4, null, null, null, null, cardH - 4);
  var posBack1 = A.eG(4, backCard1, null, null, 12, null, null, null);
  stackCards.push(posBack1);

  var frontImg = makeCardImg(cluster[0], cardW, cardH);
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

  // Cập nhật A.aAlbumDeckTap
  const deckTapPattern = /A\.aAlbumDeckTap\s*=\s*function aAlbumDeckTap\(cluster[\s\S]*?A\.aAlbumDeckTap\.prototype\s*=\s*\{[\s\S]*?\$S:\s*0[\s\S]*?\};/g;
  if (deckTapPattern.test(content)) {
    content = content.replace(deckTapPattern, newTapClass);
  }

  // Cập nhật $.buildPhotoDeckWidget
  const deckWidgetPattern = /\$\.buildPhotoDeckWidget\s*=\s*function\(cluster,\s*chatState,\s*isMe\)[\s\S]*?return A\.bm\(A\.b\(\[headerTitle,\s*headerSpacing,\s*middleRow\],\s*t\.p\),\s*isMe\s*\?\s*B\.dw\s*:\s*B\.aS,\s*B\.m,\s*B\.G\);[\r\n\s]*\};/g;
  if (deckWidgetPattern.test(content)) {
    content = content.replace(deckWidgetPattern, newBuildPhotoDeckWidget);
    console.log(`  [OK] Đã thay thế $.buildPhotoDeckWidget trong: ${file}`);
  } else {
    console.warn(`  [WARN] Không match được pattern cũ của $.buildPhotoDeckWidget trong: ${file}`);
  }

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

const dartAlbumImplementation = `  Widget _buildCollageShareButton(BuildContext context, List<MessageModel> cluster) {
    return GestureDetector(
      onTap: () {
        if (kIsWeb) {
          final msgIds = cluster.map((m) => m.id).toList();
          final urls = cluster.map((m) => ApiService.formatImageUrl(m.imageUrl ?? m.content)).where((u) => u.isNotEmpty).toList();
          html.window.callMethod('openForwardModal', [
            {
              'messageIds': msgIds,
              'urls': urls,
            }
          ]);
        }
      },
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: const Color(0xFFE4E6EB).withOpacity(0.85),
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.shortcut_rounded,
          size: 18,
          color: Color(0xFF0F172A),
        ),
      ),
    );
  }

  Widget _buildTwoPhotoCollage(BuildContext context, List<MessageModel> cluster, bool isMe, List<String> photoUrls) {
    final cardW = 175.0;
    final cardH = 175.0;
    final totalW = 240.0;
    final totalH = 285.0;
    final isFwd = cluster.any((m) => m.isForwarded);

    final content = SizedBox(
      width: totalW,
      height: totalH,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Card 1: Top-Left (x: 0, y: 0)
          Positioned(
            left: 0,
            top: 0,
            child: GestureDetector(
              onTap: () {
                if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 0]);
              },
              child: Container(
                width: cardW,
                height: cardH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 10, offset: const Offset(0, 3)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: _buildPhotoDeckCardImage(cluster[0]),
                ),
              ),
            ),
          ),
          // Card 2: Bottom-Right (x: 65, y: 110) - overlaps Card 1
          Positioned(
            left: 65,
            top: 110,
            child: GestureDetector(
              onTap: () {
                if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 1]);
              },
              child: Container(
                width: cardW,
                height: cardH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 14, offset: const Offset(0, 5)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: _buildPhotoDeckCardImage(cluster[1]),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    final shareBtn = _buildCollageShareButton(context, cluster);

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        if (isFwd)
          Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 4, right: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shortcut_rounded, size: 14, color: const Color(0xFF65676B)),
                const SizedBox(width: 4),
                Text('Đã chuyển tiếp', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: const Color(0xFF65676B))),
              ],
            ),
          ),
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (isMe) ...[
              shareBtn,
              const SizedBox(width: 10),
            ],
            content,
            if (!isMe) ...[
              const SizedBox(width: 10),
              shareBtn,
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildThreePhotoCollage(BuildContext context, List<MessageModel> cluster, bool isMe, List<String> photoUrls) {
    final cardW = 170.0;
    final cardH = 170.0;
    final totalW = 235.0;
    final totalH = 400.0;
    final isFwd = cluster.any((m) => m.isForwarded);

    final content = SizedBox(
      width: totalW,
      height: totalH,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Card 1: Top-Right (x: 65, y: 0)
          Positioned(
            left: 65,
            top: 0,
            child: GestureDetector(
              onTap: () {
                if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 0]);
              },
              child: Container(
                width: cardW,
                height: cardH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 10, offset: const Offset(0, 3)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: _buildPhotoDeckCardImage(cluster[0]),
                ),
              ),
            ),
          ),
          // Card 2: Middle-Left (x: 0, y: 115) - overlaps Card 1
          Positioned(
            left: 0,
            top: 115,
            child: GestureDetector(
              onTap: () {
                if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 1]);
              },
              child: Container(
                width: cardW,
                height: cardH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 12, offset: const Offset(0, 4)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: _buildPhotoDeckCardImage(cluster[1]),
                ),
              ),
            ),
          ),
          // Card 3: Bottom-Right (x: 65, y: 230) - overlaps Card 2
          Positioned(
            left: 65,
            top: 230,
            child: GestureDetector(
              onTap: () {
                if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 2]);
              },
              child: Container(
                width: cardW,
                height: cardH,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 14, offset: const Offset(0, 5)),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: _buildPhotoDeckCardImage(cluster[2]),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    final shareBtn = _buildCollageShareButton(context, cluster);

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        if (isFwd)
          Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 4, right: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shortcut_rounded, size: 14, color: const Color(0xFF65676B)),
                const SizedBox(width: 4),
                Text('Đã chuyển tiếp', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: const Color(0xFF65676B))),
              ],
            ),
          ),
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (isMe) ...[
              shareBtn,
              const SizedBox(width: 10),
            ],
            content,
            if (!isMe) ...[
              const SizedBox(width: 10),
              shareBtn,
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildFourPlusPhotoDeck(BuildContext context, List<MessageModel> cluster, bool isMe, List<String> photoUrls) {
    final count = cluster.length;
    final cardW = 200.0;
    final cardH = 260.0;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isFwd = cluster.any((m) => m.isForwarded);

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        // 1. Tiêu đề: Icon 4 ô vuông (⊞) + Text "N ảnh"
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4, right: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.grid_view_rounded,
                size: 20,
                color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
              ),
              const SizedBox(width: 6),
              Text(
                isFwd ? '↪ Đã chuyển tiếp • $count ảnh' : '$count ảnh',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),

        // 2. Chồng Thẻ Ảnh 3D
        GestureDetector(
          onTap: () {
            if (kIsWeb) {
              try {
                html.window.callMethod('openAlbumGalleryModal', [photoUrls, 0]);
                return;
              } catch (_) {}
            }
          },
          child: SizedBox(
            width: cardW + 16,
            height: cardH + 12,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Transform.translate(
                  offset: const Offset(-5, -6),
                  child: Container(
                    width: cardW - 8,
                    height: cardH - 8,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2D3748),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.12),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                  ),
                ),
                Transform.translate(
                  offset: const Offset(6, -3),
                  child: Container(
                    width: cardW - 4,
                    height: cardH - 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF4A5568),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.14),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, 4),
                  child: Container(
                    width: cardW,
                    height: cardH,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.20),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _buildPhotoDeckCardImage(cluster[0]),
                          if (cluster[0].id.startsWith('optimistic-') || cluster[0].status == 'sending')
                            Container(
                              color: Colors.black.withOpacity(0.4),
                              child: const Center(
                                child: SizedBox(
                                  width: 28,
                                  height: 28,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhotoDeckAlbum(BuildContext context, List<MessageModel> cluster, bool isMe) {
    final count = cluster.length;
    final photoUrls = cluster.map((m) {
      if (m.content.startsWith('data:image')) return m.content;
      return m.imageUrl != null && m.imageUrl!.isNotEmpty ? ApiService.formatImageUrl(m.imageUrl!) : ApiService.formatImageUrl(m.content);
    }).toList();

    if (count == 2) {
      return _buildTwoPhotoCollage(context, cluster, isMe, photoUrls);
    } else if (count == 3) {
      return _buildThreePhotoCollage(context, cluster, isMe, photoUrls);
    } else {
      return _buildFourPlusPhotoDeck(context, cluster, isMe, photoUrls);
    }
  }`;

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Thay thế từ Widget _buildPhotoDeckAlbum đến hết hàm _buildPhotoDeckAlbum (hoặc _buildDeckShareButton)
  const oldBuildDeckPattern = /Widget _buildPhotoDeckAlbum\(BuildContext context,\s*List<MessageModel> cluster,\s*bool isMe\)[\s\S]*?Widget _buildDeckShareButton\(BuildContext context,\s*MessageModel msg\)[\s\S]*?\}\s*\}\s*\}/g;
  
  // Nếu pattern trên quá rộng, match riêng từng phần
  const exactDeckStart = '  Widget _buildPhotoDeckAlbum(BuildContext context, List<MessageModel> cluster, bool isMe) {';
  const exactDeckEnd = '  Widget _buildPhotoDeckCardImage(MessageModel msg) {';

  const startIdx = content.indexOf(exactDeckStart);
  if (startIdx !== -1) {
    // Tìm điểm kết thúc của khối _buildPhotoDeckAlbum và _buildDeckShareButton
    const nextFnIdx = content.indexOf('  Widget _buildMessageBubbleContent(', startIdx);
    if (nextFnIdx !== -1) {
      content = content.substring(0, startIdx) + dartAlbumImplementation + '\n\n' + content.substring(nextFnIdx);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  [OK] Đã cập nhật giao diện 2 ảnh, 3 ảnh và Chồng thẻ 3D trong file Dart: ${file}`);
    }
  }
});

console.log('✅ Hoàn tất cập nhật!');
