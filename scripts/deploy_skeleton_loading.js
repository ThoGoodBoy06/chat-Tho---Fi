const fs = require('fs');
const vm = require('vm');

const targetFiles = [
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const skeletonHelperCode = `
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
      return A.a5(null, null, null, null, null, deco, null, w, null, null, null, null, h);
    }
    function spaceW(w) { return new A.cv(w, null, null, null); }
    function spaceH(h) { return new A.cv(null, h, null, null); }

    var rows = [];
    if (type === "contacts") {
      for (var i = 0; i < 7; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var nameW = 110 + ((i * 23) % 60);
        var userW = 70 + ((i * 17) % 40);
        var colInfo = A.bm(A.b([
          sBox(nameW, 14, 4, cShimmer, false),
          spaceH(8),
          sBox(userW, 11, 4, cBase, false)
        ], t.p), B.l, B.bw, B.p);
        var btn = sBox(72, 30, 15, cShimmer, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(10), btn];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.m, B.p);
        rows.push(new A.bc(new A.a7(16, 10, 16, 10), row, null));
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
        ], t.p), B.l, B.bw, B.p);
        var timeBox = sBox(36, 10, 4, cBase, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(10), timeBox];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.m, B.p);
        rows.push(new A.bc(new A.a7(16, 12, 16, 12), row, null));
      }
    } else if (type === "requests") {
      for (var i = 0; i < 4; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var nameW = 110 + ((i * 20) % 50);
        var colInfo = A.bm(A.b([
          sBox(nameW, 14, 4, cShimmer, false),
          spaceH(8),
          sBox(75, 11, 4, cBase, false)
        ], t.p), B.l, B.bw, B.p);
        var btn1 = sBox(54, 28, 14, cAccent, false);
        var btn2 = sBox(54, 28, 14, cBase, false);
        var rChildren = [av, spaceW(12), A.dn(colInfo, 1), spaceW(8), btn1, spaceW(6), btn2];
        var row = A.b9(A.b(rChildren, t.p), B.l, B.m, B.p);
        rows.push(new A.bc(new A.a7(16, 10, 16, 10), row, null));
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
      ], t.p), B.l, B.m, B.p);
      rows.push(cover);
      rows.push(spaceH(16));
      rows.push(new A.bc(new A.a7(16, 0, 16, 0), A.bm(A.b([av, spaceH(14), nameBar, spaceH(8), bioBar, spaceH(18), actionBtns], t.p), B.l, B.bw, B.p), null));
    } else {
      for (var i = 0; i < 5; i++) {
        var av = sBox(48, 48, 24, cShimmer, true);
        var colInfo = A.bm(A.b([sBox(140, 14, 4, cShimmer, false), spaceH(8), sBox(200, 12, 4, cBase, false)], t.p), B.l, B.bw, B.p);
        var row = A.b9(A.b([av, spaceW(12), A.dn(colInfo, 1)], t.p), B.l, B.m, B.p);
        rows.push(new A.bc(new A.a7(16, 12, 16, 12), row, null));
      }
    }

    return A.bm(A.b(rows, t.p), B.l, B.bw, B.p);
  } catch (err) {
    console.error("Error in A.aSkList:", err);
    return B.eb;
  }
};
`;

let processed = 0;

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.warn("File not found:", file);
    return;
  }

  let code = fs.readFileSync(file, 'utf8');

  // 1. Inject A.aSkList if not already present
  if (!code.includes('A.aSkList=')) {
    const anchor = '$.getThemeHeaderColor=';
    if (code.includes(anchor)) {
      code = code.replace(anchor, skeletonHelperCode + '\n' + anchor);
      console.log(`[${file}] Injected A.aSkList before ${anchor}`);
    } else {
      console.error(`[${file}] Anchor $.getThemeHeaderColor= not found!`);
      return;
    }
  } else {
    // If already present, replace it with updated version
    const startIdx = code.indexOf('A.aSkList = function');
    const endIdx = code.indexOf('$.getThemeHeaderColor=');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      code = code.substring(0, startIdx) + skeletonHelperCode + '\n' + code.substring(endIdx);
      console.log(`[${file}] Updated existing A.aSkList`);
    }
  }

  // 2. Replace Contacts waiting spinner
  if (code.includes('if(b.a===B.ld)return B.eb')) {
    code = code.replace('if(b.a===B.ld)return B.eb', 'if(b.a===B.ld)return A.aSkList("contacts")');
    console.log(`[${file}] Patched Contacts tab skeleton`);
  }

  // 3. Replace Chat list waiting spinner
  if (code.includes('a0.f?B.eb:')) {
    code = code.replace('a0.f?B.eb:', 'a0.f?A.aSkList("chats",r):');
    console.log(`[${file}] Patched Chat list skeleton`);
  }

  // 4. Replace FriendRequestsScreen waiting spinner
  if (code.includes('if(r.e)s=B.eb')) {
    code = code.replace('if(r.e)s=B.eb', 'if(r.e)s=A.aSkList("requests")');
    console.log(`[${file}] Patched FriendRequestsScreen skeleton`);
  }

  // 5. Replace OtherUserProfileScreen waiting spinner
  if (code.includes(',a6,B.eb,a2,!1')) {
    code = code.replace(',a6,B.eb,a2,!1', ',a6,A.aSkList("profile"),a2,!1');
    console.log(`[${file}] Patched OtherUserProfileScreen skeleton`);
  }

  // 6. Replace Users Search Dialog waiting spinner
  if (code.includes('if(b.a===B.ld)return B.pn')) {
    code = code.replace('if(b.a===B.ld)return B.pn', 'if(b.a===B.ld)return A.aSkList("contacts")');
    console.log(`[${file}] Patched Search Dialog skeleton`);
  }

  // 7. Syntax verification via vm.Script
  try {
    new vm.Script(code);
    console.log(`[${file}] Syntax verification passed!`);
  } catch (err) {
    console.error(`[${file}] Syntax ERROR:`, err.message);
    process.exit(1);
  }

  // Write file
  fs.writeFileSync(file, code, 'utf8');
  console.log(`[${file}] Saved successfully!`);
  processed++;
});

console.log(`Successfully deployed Skeleton Loading to ${processed} bundle files.`);
