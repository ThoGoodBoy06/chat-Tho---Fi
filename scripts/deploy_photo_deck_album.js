const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu triển khai Album ảnh dạng Chồng Thẻ 3D (Photo Deck) & Gallery Vuốt Trái/Phải...');

// 1. Cập nhật các tệp JS bundle
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const newDeckHelpers = `
A.aAlbumDeckTap = function aAlbumDeckTap(cluster) {
  this.cluster = cluster;
};
A.aAlbumDeckTap.prototype = {
  $0() {
    if (!this.cluster || !this.cluster.length) return;
    var urls = [];
    for (var i = 0; i < this.cluster.length; i++) {
      var m = this.cluster[i];
      var s = m.e || "";
      var j = m.f || s;
      if (J.pX(s, "http") || J.pX(s, "/")) {
        j = s;
        if (j && j.startsWith("/")) {
          var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
          j = _be + j;
        }
      }
      urls.push(j || s);
    }
    if (window.openAlbumGalleryModal) {
      window.openAlbumGalleryModal(urls, 0);
    } else if (window.openImageModal && urls.length > 0) {
      window.openImageModal(urls[0]);
    }
  },
  $S: 0
};

A.aAlbumShareTap = function aAlbumShareTap(cluster) {
  this.cluster = cluster;
};
A.aAlbumShareTap.prototype = {
  $0() {
    if (!this.cluster || !this.cluster.length) return;
    var urls = [];
    for (var i = 0; i < this.cluster.length; i++) {
      var m = this.cluster[i];
      var s = m.e || "";
      var j = m.f || s;
      if (J.pX(s, "http") || J.pX(s, "/")) {
        j = s;
        if (j && j.startsWith("/")) {
          var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
          j = _be + j;
        }
      }
      urls.push(j || s);
    }
    if (window.openAlbumGalleryModal) {
      window.openAlbumGalleryModal(urls, 0);
    }
  },
  $S: 0
};

$.buildPhotoDeckWidget = function(cluster, chatState, isMe) {
  var count = cluster.length;
  var cardW = 240;
  var cardH = 240;

  function makeCardImg(msg, w, h) {
    var s = msg.e || "";
    var j = msg.f || s;
    var r = null;
    if (J.pX(s, "data:image")) {
      try {
        var q = B.b.ga5(J.a5C(s, ","));
        r = B.kC.ci(q);
      } catch (err) {}
    } else if (J.pX(s, "http") || J.pX(s, "/")) {
      j = s;
      if (j && j.startsWith("/")) {
        var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
        j = _be + j;
      }
    }

    var img;
    if (r != null) {
      img = new A.mD(A.aLD(null, null, new A.oH(r, 1)), new A.auP(), null, null, B.cp, B.e8, null);
    } else if (j != null && j.length !== 0) {
      img = new A.mD(A.aLD(null, null, new A.eY(j, 1, null)), new A.auQ(), null, null, B.cp, B.e8, null);
    } else {
      img = B.yF;
    }

    var cellImg = new A.cv(w, h, img, null);
    var isSending = msg.status === "sending" || (msg.a && (msg.a.indexOf("optimistic-") === 0 || msg.a.indexOf("uploading-") === 0 || msg.a.indexOf("temp_") === 0));

    if (isSending) {
      var _spin = A.bV(B.rw, B.f, null, 26);
      var _shade = A.a5(null, _spin, B.h, null, null, new A.ak(new A.q(1879048192), null, null, null, null, null, B.t), null, w, null, null, null, null, h);
      return A.dt(B.h, A.b([cellImg, _shade], t.p), B.r, B.ap);
    }
    return cellImg;
  }

  // 1. Tiêu đề "⊞ N ảnh"
  var headerTitle = A.a2("⊞ " + count + " ảnh", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4283124560), null, null, null, null, null, null, null, null, 17.5, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 7, null, null);

  // 2. Chồng Thẻ Ảnh 3D (Stacked Cards)
  var stackCards = [];

  // Lớp thẻ thứ 3 (phía sau nhất nếu count >= 3)
  if (count >= 3) {
    var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 6, null, null, null, null, cardH - 6);
    var pos2 = A.eG(2, backCard2, null, null, 3, null, null, null);
    stackCards.push(pos2);
  }

  // Lớp thẻ thứ 2 (ở giữa nếu count >= 2)
  if (count >= 2) {
    var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 3, null, null, null, null, cardH - 3);
    var pos1 = A.eG(6, backCard1, null, null, 12, null, null, null);
    stackCards.push(pos1);
  }

  // Lớp thẻ thứ 1 (Mặt trước - Ảnh đầu tiên)
  var frontImg = makeCardImg(cluster[0], cardW, cardH);
  var frontClipped = A.aP5(A.ag(24), frontImg);
  var posFront = A.eG(10, frontClipped, null, null, 0, null, null, null);
  stackCards.push(posFront);

  var deckStack = A.a5(null, A.dt(B.h, A.b(stackCards, t.p), B.r, B.ap), B.h, null, null, null, null, cardW + 16, null, null, null, null, cardH + 12);
  var deckWithTap = A.dr(null, deckStack, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster), null, null, null, null, null, null, !1, B.ao);

  // 3. Nút tròn chuyển tiếp (Circular Forward Button với mũi tên cong ↪)
  var shareArrow = A.a2("↪", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4279244074), null, null, null, null, null, null, null, null, 20, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var shareBtnInner = A.a5(null, shareArrow, B.h, null, null, new A.ak(new A.q(4293125611), null, null, A.ag(21), null, null, B.t), null, 42, null, null, null, null, 42);
  var shareBtn = A.dr(null, shareBtnInner, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumShareTap(cluster), null, null, null, null, null, null, !1, B.ao);

  var middleRow;
  if (isMe) {
    middleRow = A.b9(A.b([shareBtn, new A.cv(12, null, null, null), deckWithTap], t.p), B.dw, B.m, B.G);
  } else {
    middleRow = A.b9(A.b([deckWithTap, new A.cv(12, null, null, null), shareBtn], t.p), B.l, B.m, B.G);
  }

  return A.bm(A.b([headerTitle, headerSpacing, middleRow], t.p), isMe ? B.dw : B.aS, B.m, B.G);
};
`;

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n========================================`);
  console.log(`Đang xử lý: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Thay thế các helper cũ nếu có
  if (content.includes('$.buildPhotoDeckWidget')) {
    console.log('  [Info] $.buildPhotoDeckWidget đã tồn tại, tiến hành cập nhật...');
    content = content.replace(/\nA\.aAlbumPhotoTap[\s\S]*?\$\.buildPhotoDeckWidget[\s\S]*?return A\.bm\(A\.b\(\[headerTitle[\s\S]*?B\.G\);\n\};/g, '');
  } else if (content.includes('$.buildPhotoGridWidget')) {
    content = content.replace(/\nA\.aAlbumPhotoTap[\s\S]*?\$\.buildPhotoGridWidget[\s\S]*?return A\.aP5\(A\.ag\(16\), collage\);\n\};/g, '');
  }

  content = content.replace('$.applyThemeColor=function', newDeckHelpers + '\r\n$.applyThemeColor=function');
  console.log('  [OK] Đã chèn A.aAlbumDeckTap, A.aAlbumShareTap và $.buildPhotoDeckWidget');

  // Cập nhật lời gọi trong A.au_.prototype.$2
  const oldCall = 'var gridWidget=$.buildPhotoGridWidget(_cl,280);';
  const newCall = 'var gridWidget=$.buildPhotoDeckWidget(_cl,i.a,b);';

  if (content.includes(oldCall)) {
    content = content.replace(oldCall, newCall);
    console.log('  [OK] Đã chuyển đổi lời gọi sang $.buildPhotoDeckWidget');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`💾 Đã lưu thành công: ${filePath}`);
});

console.log('\n🎉 Đã hoàn tất cài đặt Album Chồng Thẻ & Gallery vuốt ngang!');
