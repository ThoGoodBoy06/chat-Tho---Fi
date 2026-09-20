const fs = require('fs');
const vm = require('vm');

const targetFiles = [
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const fullSkeletonHelper = `
A.aSkList = function(type, isDark) {
  try {
    var d = isDark != null ? isDark : (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('flutter.is_dark_mode') === 'true');
    var cBase = d ? new A.q(4280166715) : new A.q(4294047225);
    var cShimmer = d ? new A.q(4281549141) : new A.q(4293059824);
    var cAccent = d ? new A.q(4282865001) : new A.q(4291548641);

    function sBox(w, h, r, col, isCircle) {
      var shape = isCircle ? B.a8 : B.t;
      var radius = isCircle ? null : A.ag(r || 6);
      var deco = new A.ak(col || cShimmer, null, null, radius, null, null, shape);
      var inner = A.a5(null, null, null, null, null, deco, null, w, null, null, null, null, h);
      return new A.cv(w, h, inner, null);
    }
    function spaceW(w) { return new A.cv(w, null, null, null); }
    function spaceH(h) { return new A.cv(null, h, null, null); }

    var rows = [];

    // Message bubbles skeleton for chat room!
    if (type === "messages") {
      var myCol = d ? new A.q(4280436853) : new A.q(4292274175); // Soft blue bubble
      var avCol = d ? new A.q(4281549141) : new A.q(4291548641);

      function leftRow(w, h, hasAv) {
        var items = [];
        if (hasAv) {
          items.push(sBox(32, 32, 16, avCol, true));
          items.push(spaceW(8));
        } else {
          items.push(spaceW(40));
        }
        items.push(sBox(w, h, 18, cShimmer, false));
        var row = A.b9(A.b(items, t.p), B.dw, B.m, B.p);
        return new A.bc(new A.a7(16, 5, 16, 5), new A.cv(null, h + 10, row, null), null);
      }

      function rightRow(w, h) {
        var bubble = sBox(w, h, 18, myCol, false);
        var row = A.b9(A.b([bubble], t.p), B.dw, B.ev, B.p);
        return new A.bc(new A.a7(16, 5, 16, 5), new A.cv(null, h + 10, row, null), null);
      }

      rows.push(leftRow(180, 38, true));
      rows.push(leftRow(240, 52, false));
      rows.push(rightRow(160, 38));
      rows.push(rightRow(210, 44));
      rows.push(leftRow(150, 38, true));
      rows.push(rightRow(190, 38));
      rows.push(leftRow(220, 42, true));

      return A.bm(A.b(rows, t.p), B.m, B.l, B.G);
    } else if (type === "contacts") {
      for (var i = 0; i < 7; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var nameW = 110 + ((i * 23) % 60);
        var userW = 70 + ((i * 17) % 40);
        var colInfo = A.bm(A.b([
          sBox(nameW, 14, 4, cShimmer, false),
          spaceH(8),
          sBox(userW, 11, 4, cBase, false)
        ], t.p), B.m, B.l, B.G);
        var btn = sBox(72, 30, 15, cShimmer, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(10), btn];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.l, B.p);
        var rowContainer = new A.cv(null, 68, row, null);
        rows.push(new A.bc(new A.a7(16, 6, 16, 6), rowContainer, null));
      }
    } else if (type === "chats") {
      for (var i = 0; i < 7; i++) {
        var av = sBox(52, 52, 26, cShimmer, true);
        var nameW = 120 + ((i * 29) % 70);
        var msgW = 180 + ((i * 37) % 90);
        var colInfo = A.bm(A.b([
          sBox(nameW, 15, 4, cShimmer, false),
          spaceH(8),
          sBox(msgW, 12, 4, cBase, false)
        ], t.p), B.m, B.l, B.G);
        var timeBox = sBox(36, 10, 4, cBase, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(10), timeBox];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.l, B.p);
        var rowContainer = new A.cv(null, 72, row, null);
        rows.push(new A.bc(new A.a7(16, 6, 16, 6), rowContainer, null));
      }
    } else if (type === "requests") {
      for (var i = 0; i < 4; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var nameW = 110 + ((i * 20) % 50);
        var colInfo = A.bm(A.b([
          sBox(nameW, 14, 4, cShimmer, false),
          spaceH(8),
          sBox(75, 11, 4, cBase, false)
        ], t.p), B.m, B.l, B.G);
        var btn1 = sBox(54, 28, 14, cAccent, false);
        var btn2 = sBox(54, 28, 14, cBase, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(8), btn1, spaceW(6), btn2];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.l, B.p);
        var rowContainer = new A.cv(null, 68, row, null);
        rows.push(new A.bc(new A.a7(16, 6, 16, 6), rowContainer, null));
      }
    } else if (type === "profile") {
      var cover = sBox(450, 180, 0, cBase, false);
      var av = sBox(88, 88, 44, cShimmer, true);
      var nameBar = sBox(160, 20, 6, cShimmer, false);
      var bioBar = sBox(220, 14, 4, cBase, false);
      var actionBtns = A.b9(A.b([
        sBox(90, 36, 18, cShimmer, false),
        spaceW(12),
        sBox(90, 36, 18, cShimmer, false),
        spaceW(12),
        sBox(90, 36, 18, cBase, false)
      ], t.p), B.l, B.l, B.p);
      rows.push(cover);
      rows.push(spaceH(16));
      rows.push(new A.bc(new A.a7(16, 0, 16, 0), A.bm(A.b([av, spaceH(14), nameBar, spaceH(8), bioBar, spaceH(18), actionBtns], t.p), B.m, B.l, B.G), null));
    } else {
      for (var i = 0; i < 5; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var colInfo = A.bm(A.b([sBox(140, 14, 4, cShimmer, false), spaceH(8), sBox(200, 12, 4, cBase, false)], t.p), B.m, B.l, B.G);
        var row = A.b9(A.b([av, spaceW(12), A.dn(colInfo, 1)], t.p), B.l, B.l, B.p);
        rows.push(new A.bc(new A.a7(16, 6, 16, 6), new A.cv(null, 68, row, null), null));
      }
    }

    return A.bm(A.b(rows, t.p), B.m, B.l, B.G);
  } catch (err) {
    console.error("Error in A.aSkList:", err);
    return B.eb;
  }
};
`;

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;

  let code = fs.readFileSync(file, 'utf8');

  // 1. Update A.aSkList with "messages" skeleton
  const startIdx = code.indexOf('A.aSkList = function');
  const endIdx = code.indexOf('$.getThemeHeaderColor=');
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    code = code.substring(0, startIdx) + fullSkeletonHelper + '\n' + code.substring(endIdx);
    console.log(`[${file}] Injected full A.aSkList with message bubbles`);
  }

  // 2. In chat room, replace B.eb with A.aSkList("messages", r):
  // l=A.dn(a0.f?B.eb:new A.dL(new A.auj(c,a0,a,r),b),1)
  const pattern = 'l=A.dn(a0.f?B.eb:new A.dL(new A.auj(c,a0,a,r),b),1)';
  const replacement = 'l=A.dn(a0.f?A.aSkList("messages",r):new A.dL(new A.auj(c,a0,a,r),b),1)';
  if (code.includes(pattern)) {
    code = code.replace(pattern, replacement);
    console.log(`[${file}] Connected Skeleton Loading to chat room messages!`);
  }

  // Validate syntax
  try {
    new vm.Script(code);
    console.log(`[${file}] Syntax valid!`);
  } catch (err) {
    console.error(`[${file}] Syntax ERROR:`, err.message);
    process.exit(1);
  }

  fs.writeFileSync(file, code, 'utf8');
  console.log(`[${file}] Saved!`);
});

console.log('Done deployment.');
