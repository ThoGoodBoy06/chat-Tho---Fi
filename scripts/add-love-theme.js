const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const htmlFiles = [
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'web', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
];

const jsFiles = [
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

console.log('--- 1. Cập nhật các file index.html ---');
htmlFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Thêm { id: 'love', name: 'Tình yêu (Love)', color1: '#FF3377', color2: '#FF6584' }
  const targetTheme = "{ id: 'emerald', name: 'Ngọc bích (Emerald)', color1: '#11998E', color2: '#38EF7D' }";
  const replacementTheme = "{ id: 'emerald', name: 'Ngọc bích (Emerald)', color1: '#11998E', color2: '#38EF7D' },\n    { id: 'love', name: 'Tình yêu (Love)', color1: '#FF3377', color2: '#FF6584' }";

  if (content.includes(targetTheme) && !content.includes("'love'")) {
    content = content.replace(targetTheme, replacementTheme);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Đã thêm theme Tình yêu vào:', file);
  } else if (content.includes("'love'")) {
    console.log('ℹ️ Đã tồn tại love theme trong:', file);
  } else {
    console.warn('⚠️ Không tìm thấy targetTheme trong:', file);
  }
});

console.log('\n--- 2. Cập nhật các file main.dart.js ---');
jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  let modified = false;

  // 1. _themeColors
  const targetCol = "emerald: new A.q(4279343502)";
  const repCol = "emerald: new A.q(4279343502),\n      love: new A.q(4294914935)";
  if (content.includes(targetCol) && !content.includes("love: new A.q(4294914935)")) {
    content = content.replace(targetCol, repCol);
    modified = true;
  }

  // 2. _themeGradients
  const targetGrad = "emerald: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4279343502), new A.q(4281929597)], ti), null, null)";
  const repGrad = "emerald: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4279343502), new A.q(4281929597)], ti), null, null),\n        love: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4294914935), new A.q(4294927748)], ti), null, null)";
  if (content.includes(targetGrad) && !content.includes("love: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4294914935)")) {
    content = content.replace(targetGrad, repGrad);
    modified = true;
  }

  // 3. _themeBgDecorations
  const targetBg = "emerald: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4293327342), new A.q(4291949792), new A.q(4290572499)], ti), null, null), B.t)";
  const repBg = "emerald: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4293327342), new A.q(4291949792), new A.q(4290572499)], ti), null, null), B.t),\n        love: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4294963445), new A.q(4294962416), new A.q(4294961132)], ti), null, null), B.t)";
  if (content.includes(targetBg) && !content.includes("love: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4294963445)")) {
    content = content.replace(targetBg, repBg);
    modified = true;
  }

  // 4. _themeHeaderColors
  const targetHdr = "emerald: new A.q(4293327342)";
  const repHdr = "emerald: new A.q(4293327342),\n      love: new A.q(4294964728)";
  if (content.includes(targetHdr) && !content.includes("love: new A.q(4294964728)")) {
    content = content.replace(targetHdr, repHdr);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Đã cập nhật love theme cho JS:', file);
  } else {
    console.log('ℹ️ Không có thay đổi cho:', file);
  }
});

console.log('\n🎉 Hoàn thành cấu hình chủ đề Tình yêu (Love)!');
