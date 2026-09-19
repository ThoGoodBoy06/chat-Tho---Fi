const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🖼️ Khôi phục Album ảnh Chồng Thẻ 3D (Photo Deck) hoàn hảo...');

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
    var s = msg.e || "";
    var j = msg.f || s;
    var r = null;
    if (J.pX(s, "http") || J.pX(s, "/")) {
      r = s;
      if (r && r.startsWith("/")) {
        var _be = (window.location.origin.indexOf("localhost") !== -1 || window.location.origin.indexOf("127.0.0.1") !== -1) ? window.location.origin : "https://chat-tho-fi-vn-9s8u.onrender.com";
        r = _be + r;
      }
    }
    var img;
    if (r != null && r.length !== 0) {
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

const clusterHookReplacement = `var e=f[a0],d=e.c,c=g.a,b=d==(c==null?h:c.a)
function _checkImg(m){if(!m||m.y)return!1;var t=m.d;if(t==="image")return!0;var c=(m.e||"").toLowerCase(),u=m.f||"";if(c.indexOf("data:image")===0||u.length>0)return!0;return c.indexOf(".jpg")!==-1||c.indexOf(".jpeg")!==-1||c.indexOf(".png")!==-1||c.indexOf(".webp")!==-1||c.indexOf(".gif")!==-1||c.indexOf(".jfif")!==-1||c.indexOf(".heic")!==-1||c.indexOf(".heif")!==-1||c.indexOf(".avif")!==-1||c.indexOf(".bmp")!==-1||c.indexOf("/chat-media/")!==-1||c.indexOf("/images/")!==-1;}
if(_checkImg(e)){
  if(window.recordChatImage){window.recordChatImage(e.imageUrl||e.f||e.content||e.e);}
  if(a0>0&&_checkImg(f[a0-1])&&f[a0-1].c===e.c){
    var _tPrev=f[a0-1].as?f[a0-1].as.a:0,_tCur=e.as?e.as.a:0;
    if(Math.abs(_tCur-_tPrev)<60000)return B.au;
  }
  var _cl=[e];
  for(var _ck=a0+1;_ck<f.length;_ck++){
    var _nxt=f[_ck];
    if(_checkImg(_nxt)&&_nxt.c===e.c){
      var _t1=_cl[_cl.length-1].as?_cl[_cl.length-1].as.a:0,_t2=_nxt.as?_nxt.as.a:0;
      if(Math.abs(_t2-_t1)<60000)_cl.push(_nxt);
      else break;
    }else break;
  }
  if(_cl.length>=2){
    try{
      if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30;
      else s=!0;
      var gridWidget=$.buildPhotoDeckWidget(_cl,i.a,b);
      if(gridWidget){
        var p=b?B.ev:B.m;
        var o=A.b([],t.p);
        if(!b){
          var n=i.d.c,m=n!=null,l=h,k=h;
          if(m&&n.length!==0){n.toString;l=new A.eY(n,1,h);}
          if(!m||n.length===0){var ob=i.d.b;k=A.a2(ob.length!==0?ob[0].toUpperCase():"U",h,h,h,h,h,B.DV,h,h,h);}
          B.b.M(o,A.b([A.dr(h,A.hO(B.o,l,k,14),B.M,!1,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,new A.atQ(e,a),h,h,h,h,h,h,!1,B.ao),B.aT],t.p));
        }
        var kList=A.b([gridWidget],t.p);
        var j=e.Q;
        if(j.gbH(j)&&!e.y){var dD=A.dD(j);kList.push(A.eG(-8,A.aK_(new A.hl(i.a.Qy(j,10,b),new A.e0("chat_reactions_"+dD,t.kK)),B.J,h,B.W,B.W,new A.atS()),h,h,h,-4,h,h));}
        var dList=A.b([A.dt(B.aF,kList,B.h,B.ap)],t.p);
        if(b){
          var _lastSent=a0+_cl.length-1===i.c;
          B.b.M(dList,A.b([B.cZ,i.a.aaZ(_cl[_cl.length-1],i.d,_lastSent)],t.p));
        }
        if(i.a._tsMsgIds&&i.a._tsMsgIds.has(e.a)){
          var _ms=e.as?e.as.a:Date.now(),_v=new Date(_ms+252e5),_now=new Date(Date.now()+252e5);
          var _isToday=_v.getUTCFullYear()===_now.getUTCFullYear()&&_v.getUTCMonth()===_now.getUTCMonth()&&_v.getUTCDate()===_now.getUTCDate();
          var _hh=String(_v.getUTCHours()).padStart(2,"0"),_mm=String(_v.getUTCMinutes()).padStart(2,"0");
          var _timeStr=_hh+":"+_mm;
          if(!_isToday){_timeStr=String(_v.getUTCDate()).padStart(2,"0")+"/"+String(_v.getUTCMonth()+1).padStart(2,"0")+"/"+_v.getUTCFullYear()+", "+_hh+":"+_mm;}
          dList.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h));
        }
        var mAlign=b?B.dw:B.aS;
        o.push(new A.eT(1,B.bv,A.dr(h,A.bm(dList,mAlign,B.m,B.p),B.M,!1,h,new A.atT(g,e),new A.atU(i.a,a),h,h,h,h,h,new A.atV(i.a,a,e,g,b),h,h,h,h,h,h,h,h,h,h,new A.atW(i.a,a,e,g,b),h,new A.atTap(i.a,e),h,h,h,h,h,h,!1,B.ao),h));
        var cList=A.b([],t.p);
        if(s){
          var pt=e.as;
          cList.push(new A.bc(B.el,A.cn(A.a2((function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})(pt),h,h,h,h,h,B.Ec,h,h,h),h,h),h));
        }
        cList.push(new A.bc(B.lB,new A.Kp(A.b9(o,B.dw,p,B.p),new A.atX(g,e),h),h));
        return A.bm(cList,B.l,B.m,B.p);
      }
    }catch(_err){
      console.error("Album grid render error, falling back to normal message:",_err);
    }
  }
}
if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,e.as.a-f[a0-1].as.a).a,6e7)>30`;

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Cập nhật definitions
  if (content.includes('$.buildPhotoDeckWidget')) {
    content = content.replace(/\nA\.aAlbumDeckTap[\s\S]*?\$\.buildPhotoDeckWidget[\s\S]*?return A\.bm\(A\.b\(\[headerTitle,[\s\S]*?B\.G\);\n\};/g, '');
  }
  content = content.replace('$.applyThemeColor=function', newDeckHelpers + '\r\n$.applyThemeColor=function');

  // 2. Chèn clusterHook vào A.au_.prototype.$2
  // Nếu đã có _cl.length>=2, thay thế cả block
  const existingClusterPattern = /var e=f\[a0\],d=e\.c,c=g\.a,b=d==\(c==null\?h:c\.a\)[\r\n\s]*function _checkImg[\s\S]*?if\(a0!==0\)s=a0>0&&B\.e\.bf\(A\.cA\(0,e\.as\.a-f\[a0-1\]\.as\.a\)\.a,6e7\)>30/g;
  const normalTargetPattern = /var e=f\[a0\],d=e\.c,c=g\.a,b=d==\(c==null\?h:c\.a\)[\r\n\s]*if\(a0!==0\)s=a0>0&&B\.e\.bf\(A\.cA\(0,e\.as\.a-f\[a0-1\]\.as\.a\)\.a,6e7\)>30/g;

  if (existingClusterPattern.test(content)) {
    content = content.replace(existingClusterPattern, clusterHookReplacement);
    console.log(`  [OK] Đã cập nhật lại clusterHook trong ${path.basename(filePath)}`);
  } else if (normalTargetPattern.test(content)) {
    content = content.replace(normalTargetPattern, clusterHookReplacement);
    console.log(`  [OK] Đã chèn clusterHook mới vào ${path.basename(filePath)}`);
  } else {
    console.warn(`  [!] Không tìm thấy pattern trong ${path.basename(filePath)}`);
  }

  // Validate syntax
  new vm.Script(content);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`💾 Đã lưu và xác thực cú pháp JS thành công: ${filePath}`);
});

console.log('\n🎉 Hoàn tất khôi phục Album 3D Stacked Card!');
