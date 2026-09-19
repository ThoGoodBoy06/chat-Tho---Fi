const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔧 Bắt đầu sửa triệt để lỗi "Ảnh lỗi" trên Chồng Thẻ Album 3D...');

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
    try {
      if (!this.cluster || !this.cluster.length) return;
      var urls = [];
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
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
      if (window.openAlbumGalleryModal) {
        window.openAlbumGalleryModal(urls, 0);
      } else if (window.openImageModal && urls.length > 0) {
        window.openImageModal(urls[0]);
      }
    } catch(e) {
      console.error("Tap album error:", e);
    }
  },
  $S: 0
};

A.aAlbumShareTap = function aAlbumShareTap(cluster) {
  this.cluster = cluster;
};
A.aAlbumShareTap.prototype = {
  $0() {
    try {
      if (!this.cluster || !this.cluster.length) return;
      var msgIds = [];
      var urls = [];
      for (var i = 0; i < this.cluster.length; i++) {
        var m = this.cluster[i];
        if (m.a) msgIds.push(m.a);
        else if (m.id) msgIds.push(m.id);
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
      if (window.openForwardModal) {
        window.openForwardModal({ messageIds: msgIds, urls: urls, cluster: this.cluster });
      } else if (window.openAlbumGalleryModal) {
        window.openAlbumGalleryModal(urls, 0);
      }
    } catch(e) {
      console.error("Album share tap error:", e);
    }
  },
  $S: 0
};

$.buildPhotoDeckWidget = function(cluster, chatState, isMe) {
  if (!cluster || cluster.length < 2) return null;

  var count = cluster.length;
  var cardW = 200;
  var cardH = 260;

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

  // 1. Tiêu đề "⊞ N ảnh" hoặc "↪ Đã chuyển tiếp • N ảnh"
  var isFwd = cluster && cluster.some(function(m) { return m && (m.isForwarded === true || m.is_forwarded === true); });
  var titleText = (isFwd ? "\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp \\u2022 " : "\\u229e ") + count + " \\u1ea3nh";
  var headerTitle = A.a2(titleText, null, 1, B.a9, null, null, A.ay(null, null, new A.q(isFwd ? 4284507000 : 4283124560), null, null, null, null, null, null, null, null, 16, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var headerSpacing = new A.cv(null, 6, null, null);

  // 2. Chồng Thẻ Ảnh 3D (Stacked Cards)
  var stackCards = [];

  // Lớp thẻ thứ 3 (phía sau nhất nếu count >= 3)
  if (count >= 3) {
    var backCard2 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4281743665), null, null, A.ag(24), null, null, B.t), null, cardW - 8, null, null, null, null, cardH - 8);
    var pos2 = A.eG(0, backCard2, null, null, 4, null, null, null);
    stackCards.push(pos2);
  }

  // Lớp thẻ thứ 2 (ở giữa nếu count >= 2)
  if (count >= 2) {
    var backCard1 = A.a5(null, null, B.h, null, null, new A.ak(new A.q(4283782245), null, null, A.ag(24), null, null, B.t), null, cardW - 4, null, null, null, null, cardH - 4);
    var pos1 = A.eG(4, backCard1, null, null, 12, null, null, null);
    stackCards.push(pos1);
  }

  // Lớp thẻ thứ 1 (Mặt trước - Ảnh đầu tiên)
  var frontImg = makeCardImg(cluster[0], cardW, cardH);
  var frontClipped = A.aP5(A.ag(24), frontImg);
  var posFront = A.eG(8, frontClipped, null, null, 0, null, null, null);
  stackCards.push(posFront);

  var deckStack = new A.cv(cardW + 16, cardH + 12, A.dt(B.aF, A.b(stackCards, t.p), B.r, B.ap), null);
  var deckWithTap = A.dr(null, deckStack, B.M, !1, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, new A.aAlbumDeckTap(cluster), null, null, null, null, null, null, !1, B.ao);

  // 3. Nút tròn chuyển tiếp (Circular Forward Button với mũi tên cong ↪)
  var shareArrow = A.a2("\\u21aa", null, 1, B.a9, null, null, A.ay(null, null, new A.q(4279244074), null, null, null, null, null, null, null, null, 20, null, null, B.N, null, null, !0, null, null, null, null, null, null, null, null), null, null, null);
  var shareBtnInner = A.a5(null, shareArrow, B.h, null, null, new A.ak(new A.q(4293125611), null, null, A.ag(20), null, null, B.t), null, 40, null, null, null, null, 40);
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
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Thay thế block A.aAlbumDeckTap -> $.buildPhotoDeckWidget
  const existingDeckBlock = /\nA\.aAlbumDeckTap[\s\S]*?\$\.buildPhotoDeckWidget[\s\S]*?return A\.bm\(A\.b\(\[headerTitle,[\s\S]*?B\.G\);\n\};/g;
  if (existingDeckBlock.test(content)) {
    content = content.replace(existingDeckBlock, '');
  }

  content = content.replace('$.applyThemeColor=function', newDeckHelpers + '\r\n$.applyThemeColor=function');

  // 2. Đảm bảo wf(a) lưu cờ isForwarded
  const wfPattern = /return new A\.k1\(c,i,h,o,n,b,p,l,k,j,g,s,d\)\},/g;
  const newWfReturn = `var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);
if(a && (a.isForwarded === true || a.is_forwarded === true || (d && d.h && (d.h(a,"isForwarded") === true || d.h(a,"is_forwarded") === true)))){
  _mRes.isForwarded = true;
}
return _mRes;},`;
  if (content.includes('return new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d)},')) {
    content = content.replace(wfPattern, newWfReturn);
  }

  // Validate syntax
  new vm.Script(content);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`💾 Đã sửa và xác thực cú pháp JS thành công: ${filePath}`);
});

console.log('\n🎉 Hoàn tất sửa lỗi Ảnh lỗi trên 3D Photo Deck!');
