const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Khôi phục chuẩn: 2 ảnh so le, 3 ảnh zíc zắc, trên 4 ảnh (>= 4) là Album Chồng Thẻ 3D...');

// ════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT 2 FILE DART
// ════════════════════════════════════════════════════════════════
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

const newFourPlusDart = `  Widget _buildFourPlusPhotoDeck(BuildContext context, List<MessageModel> cluster, bool isMe, List<String> photoUrls) {
    final count = cluster.length;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isFwd = cluster.any((m) => m.isForwarded);
    const cardW = 200.0;
    const cardH = 260.0;

    final activeFirst = cluster.firstWhere((m) => !m.isRecalled, orElse: () => cluster.first);

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, left: 4, right: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.grid_view_rounded,
                size: 18,
                color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
              ),
              const SizedBox(width: 6),
              Text(
                isFwd ? '↪ Đã chuyển tiếp • $count ảnh' : '$count ảnh',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () {
            if (kIsWeb) html.window.callMethod('openAlbumGalleryModal', [photoUrls, 0]);
          },
          child: SizedBox(
            width: cardW + 16,
            height: cardH + 12,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Thẻ bóng thứ 3 phía sau (nếu count >= 3)
                if (count >= 3)
                  Positioned(
                    top: 0,
                    left: 4,
                    child: Container(
                      width: cardW - 8,
                      height: cardH - 8,
                      decoration: BoxDecoration(
                        color: const Color(0xFF2D3748),
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ),
                  ),
                // Thẻ bóng thứ 2 ở giữa (nếu count >= 2)
                if (count >= 2)
                  Positioned(
                    top: 4,
                    left: 12,
                    child: Container(
                      width: cardW - 4,
                      height: cardH - 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFF4A5568),
                        borderRadius: BorderRadius.circular(24),
                      ),
                    ),
                  ),
                // Thẻ ảnh chính phía trước
                Positioned(
                  top: 8,
                  left: 0,
                  child: Container(
                    width: cardW,
                    height: cardH,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _buildPhotoDeckCardImage(activeFirst),
                          Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: Colors.white.withOpacity(0.25), width: 1.2),
                            ),
                          ),
                          if (activeFirst.id.startsWith('optimistic-') || activeFirst.status == 'sending')
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
  }`;

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');

  const targetPattern = /Widget _buildFourPlusPhotoDeck\(BuildContext context, List<MessageModel> cluster, bool isMe, List<String> photoUrls\) \{[\s\S]*?\n  \}/;
  if (targetPattern.test(code)) {
    code = code.replace(targetPattern, newFourPlusDart.trim());
    fs.writeFileSync(df, code, 'utf8');
    console.log(`✅ [Dart] Đã cập nhật _buildFourPlusPhotoDeck trong: ${path.basename(df)}`);
  } else {
    console.warn(`⚠️ [Dart] Không tìm thấy pattern trong: ${path.basename(df)}`);
  }
});

// ════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT 4 FILE JS BUNDLE (MAIN.DART.JS)
// ════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(jf => {
  if (!fs.existsSync(jf)) return;
  let content = fs.readFileSync(jf, 'utf8');

  // Tìm vị trí của $.buildPhotoDeckWidget
  const funcStart = content.indexOf('$.buildPhotoDeckWidget = function(cluster, chatState, isMe, ctx, prov) {');
  if (funcStart === -1) {
    console.warn(`⚠️ [JS] Không tìm thấy $.buildPhotoDeckWidget trong: ${path.basename(jf)}`);
    return;
  }

  // Tìm phần else {...} của branching layout
  // Trong branching hiện tại:
  // if (count === 2) { ... } else if (count === 3) { ... } else { ... }
  const c3Search = '} else if (count === 3) {';
  const c3Idx = content.indexOf(c3Search, funcStart);
  if (c3Idx === -1) {
    console.warn(`⚠️ [JS] Không tìm thấy '} else if (count === 3) {' trong: ${path.basename(jf)}`);
    return;
  }

  const elseSearch = '} else {';
  const elseIdx = content.indexOf(elseSearch, c3Idx);
  if (elseIdx === -1) {
    console.warn(`⚠️ [JS] Không tìm thấy '} else {' sau count === 3 trong: ${path.basename(jf)}`);
    return;
  }

  const endFuncSearch = 'var middleRow = deckStack;\r\n  return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);\r\n};';
  const endFuncSearchLF = 'var middleRow = deckStack;\n  return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);\n};';

  let endFuncIdx = content.indexOf(endFuncSearch, elseIdx);
  let searchLen = endFuncSearch.length;
  if (endFuncIdx === -1) {
    endFuncIdx = content.indexOf(endFuncSearchLF, elseIdx);
    searchLen = endFuncSearchLF.length;
  }

  if (endFuncIdx === -1) {
    // Thử tìm theo return A.bm(A.b([headerTitle, headerSpacing, middleRow]
    const fallbackSearch = 'return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);\n};';
    const fallbackSearchCRLF = 'return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);\r\n};';
    endFuncIdx = content.indexOf(fallbackSearch, elseIdx);
    searchLen = fallbackSearch.length;
    if (endFuncIdx === -1) {
      endFuncIdx = content.indexOf(fallbackSearchCRLF, elseIdx);
      searchLen = fallbackSearchCRLF.length;
    }
  }

  if (endFuncIdx === -1) {
    console.warn(`⚠️ [JS] Không tìm thấy điểm kết thúc hàm trong: ${path.basename(jf)}`);
    return;
  }

  // Khối thay thế cho TRƯỜNG HỢP 3: TRÊN 4 ẢNH (>= 4) -> ALBUM ẢNH DẠNG CHỒNG THẺ 3D
  const newElseBlockAndReturn = `} else {
    // TRÊN 4 ẢNH (>= 4) -> ALBUM ẢNH DẠNG CHỒNG THẺ 3D
    var cardW = 200;
    var cardH = 260;

    var activeFirst = cluster.find(function(m) { return m && !m.y; }) || cluster[0];
    var activeCount = cluster.filter(function(m) { return m && !m.y; }).length;

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

    var deck3D = new A.cv(cardW + 16, cardH + 12, A.dt(B.aF, A.b(stackCards, t.p), B.r, B.ap), null);
    deckStack = A.dr(null, deck3D, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster, 0), null, null, null, null, null, null, !1, B.ao);
  }

  var middleRow = deckStack;
  return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);
};`;

  content = content.substring(0, elseIdx) + newElseBlockAndReturn + content.substring(endFuncIdx + searchLen);

  try {
    new vm.Script(content);
    fs.writeFileSync(jf, content, 'utf8');
    console.log(`💾 [JS PASS] Đã khôi phục Album Chồng Thẻ 3D cho >= 4 ảnh trong: ${path.basename(jf)}`);
  } catch (err) {
    console.error(`❌ [JS FAIL] Lỗi cú pháp khi sửa ${jf}:`, err.message);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════
// 3. CACHE BUST INDEX.HTML
// ════════════════════════════════════════════════════════════════
const now = Date.now();
const indexFiles = [
  'flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html',
  'public/index.html',
  'backend/public/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'backend/flutter_frontend/web/index.html'
];
indexFiles.forEach(f => {
  const fullPath = path.join(__dirname, '..', f);
  if (fs.existsSync(fullPath)) {
    let h = fs.readFileSync(fullPath, 'utf8');
    h = h.replace(/main\.dart\.js\?v=[^"']+/g, 'main.dart.js?v=v_deck3d_' + now);
    fs.writeFileSync(fullPath, h, 'utf8');
    console.log(`🔄 [Cache-Bust] Đã cập nhật hash cho: ${f}`);
  }
});

console.log('\n🎉 ĐÃ HOÀN TẤT: Trên 4 ảnh (>= 4) giờ đây hiển thị chuẩn Album Chồng Thẻ 3D!');
