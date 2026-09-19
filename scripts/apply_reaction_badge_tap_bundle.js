const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const reactionTapClass = `
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

const qyRegex = /Qy\(a,b,c\)\{var s,r,q,p,o,n=null[\s\S]*?B\.K,B\.lN,n,n,n\)\},/;

const newQy = `Qy(a,b,c,msgId){var s,r,q,p,o,n=null
if(a.gaf(a))return B.au
s=this.aap(a)
r=s.geK(s).fa(0)
q=A.ag(12)
p=A.b([new A.bZ(0,B.ac,A.I(B.d.ac(25.5),0,0,0),B.cT,4)],t.V)
o=A.ab(r).i("aw<1,bc>")
var badge=A.a5(n,A.b9(A.ae(new A.aw(r,new A.av0(b),o),!0,o.i("aK.E")),B.l,B.m,B.G),B.h,n,n,new A.ak(B.f,n,n,q,p,n,B.t),n,n,B.K,B.lN,n,n,n)
if(msgId!=null&&typeof window!=="undefined"&&window.showReactionDetailsModal){
return A.dr(n,badge,B.M,!1,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,n,new A.aReactionBadgeTap(a,msgId),n,n,n,n,n,n,!1,B.ao)}
return badge},`;

jsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  console.log(`Processing: ${fp}`);
  let code = fs.readFileSync(fp, 'utf8');

  // 1. Thêm A.aReactionBadgeTap
  if (!code.includes('A.aReactionBadgeTap = function')) {
    code = reactionTapClass + '\n' + code;
    console.log(`  -> Đã thêm A.aReactionBadgeTap`);
  }

  // 2. Thay thế hàm Qy
  if (qyRegex.test(code)) {
    code = code.replace(qyRegex, newQy);
    console.log(`  -> Đã nâng cấp Qy hỗ trợ GestureDetector tap`);
  } else if (!code.includes('Qy(a,b,c,msgId)')) {
    console.warn(`  -> KHÔNG TÌM THẤY oldQy, cần kiểm tra lại!`);
  }

  // 3. Cập nhật call sites
  if (code.includes('i.a.Qy(j,10,b)')) {
    code = code.replace('i.a.Qy(j,10,b)', 'i.a.Qy(j,10,b,e.a)');
    console.log(`  -> Đã cập nhật i.a.Qy(j,10,b,e.a)`);
  }

  if (code.includes('n.Qy(j,10,b)')) {
    code = code.replace('n.Qy(j,10,b)', 'n.Qy(j,10,b,e.a)');
    console.log(`  -> Đã cập nhật n.Qy(j,10,b,e.a)`);
  }

  fs.writeFileSync(fp, code, 'utf8');

  try {
    new vm.Script(code);
    console.log(`  -> [PASS] Cú pháp JS 100% hợp lệ`);
  } catch (err) {
    console.error(`  -> [FAIL] Cú pháp JS lỗi:`, err);
  }
});

console.log('✅ Hoàn tất cập nhật phản hồi click huy hiệu cảm xúc!');
