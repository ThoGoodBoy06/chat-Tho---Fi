const fs = require('fs');
const path = require('path');

console.log('🎨 BẮT ĐẦU NÂNG CẤP TOÀN BỘ ICON & NÚT BẤM THEO CHỦ ĐỀ CHAT...');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Thêm hàm $.getThemeColor() ngay cạnh $.getThemeGradient
  const themeColorDef = `$.getThemeColor=function(){
  var th = $._currentActiveChatTheme || 'classic';
  if (!$._themeColors) {
    $._themeColors = {
      classic: new A.q(4278216959),
      default: new A.q(4278216959),
      sunset: new A.q(4294922543),
      ocean: new A.q(4278236379),
      berry: new A.q(4293476439),
      emerald: new A.q(4279343502)
    };
  }
  var col = $._themeColors[th] || $._themeColors.classic;
  if (typeof B !== 'undefined' && B.o) { B.o.a = col.a; }
  return col;
};
`;

  if (!js.includes('$.getThemeColor=')) {
    const marker = '$.getThemeGradient=function(){';
    if (js.includes(marker)) {
      js = js.replace(marker, themeColorDef + '\n' + marker);
      console.log('✅ Đã thêm hàm $.getThemeColor()');
    }
  }

  // 2. Tìm khối Qr(a0,a1) và thay thế các icon tĩnh B.* thành icon động theo $.getThemeColor()
  const qrStart = js.indexOf('Qr(a0,a1){');
  if (qrStart !== -1) {
    const qrEnd = js.indexOf('Qt(){', qrStart);
    let qrChunk = js.slice(qrStart, qrEnd !== -1 ? qrEnd : qrStart + 35000);
    const originalChunk = qrChunk;

    // A. Back button (B.acr)
    qrChunk = qrChunk.replace('B.acr', 'new A.aJ(B.aaF,30,$.getThemeColor(),null,null)');

    // B. Header buttons: Call (B.acf), Video (B.abH), Info (B.aco)
    qrChunk = qrChunk.replace('B.acf', 'new A.aJ(B.iD,24,$.getThemeColor(),null,null)');
    qrChunk = qrChunk.replace('B.abH', 'new A.aJ(B.dH,26,$.getThemeColor(),null,null)');
    qrChunk = qrChunk.replace('B.aco', 'new A.aJ(B.aai,24,$.getThemeColor(),null,null)');

    // C. Avatar fallback header icon
    qrChunk = qrChunk.replace('A.hO(B.o,i,k,22)', 'A.hO($.getThemeColor(),i,k,22)');

    // D. Input bar: Plus button (B.ac3)
    qrChunk = qrChunk.replace('B.ac3', 'new A.aJ(B.aav,28,$.getThemeColor(),null,null)');

    // E. Input bar: Emoji button (B.abm)
    qrChunk = qrChunk.replace('B.abm', 'new A.aJ(B.aaZ,22,$.getThemeColor(),null,null)');

    // F. Input bar: Send / Like button
    qrChunk = qrChunk.replace('A.bV(c.x?B.m9:B.ab1,B.o,b,26)', 'A.bV(c.x?B.m9:B.ab1,$.getThemeColor(),b,26)');

    // G. Attachment menu icons: Camera (B.acs), Gallery (B.ac0), Mic (B.abN)
    qrChunk = qrChunk.replace('B.acs', 'new A.aJ(B.iy,24,$.getThemeColor(),null,null)');
    qrChunk = qrChunk.replace('B.ac0', 'new A.aJ(B.aaL,24,$.getThemeColor(),null,null)');
    qrChunk = qrChunk.replace('B.abN', 'new A.aJ(B.rD,24,$.getThemeColor(),null,null)');

    // H. Audio icon
    qrChunk = qrChunk.replace('j=s?B.o:B.f', 'j=s?$.getThemeColor():B.f');

    if (qrChunk !== originalChunk) {
      js = js.slice(0, qrStart) + qrChunk + js.slice(qrStart + originalChunk.length);
      console.log('✅ Đã chuyển đổi toàn bộ Icon trong ChatScreen sang Dynamic Theme Color!');
    }
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Hoàn tất file: ${filePath}`);
});

// 3. Tăng mã Cache-Busting trong HTML & Bootstrap
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  html = html.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(hf, html, 'utf8');
  console.log(`✅ Cập nhật timestamp trong: ${hf}`);
});

const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(bf, bs, 'utf8');
  console.log(`✅ Cập nhật timestamp trong: ${bf}`);
});

console.log('\n🌟 ĐÃ HOÀN TẤT NÂNG CẤP TOÀN BỘ THEME ICON!');
