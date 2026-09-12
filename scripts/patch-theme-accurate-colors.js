const fs = require('fs');
const path = require('path');

console.log('🌊 CẬP NHẬT CHUẨN XÁC MÀU SẮC THEO ĐÚNG TÊN CHỦ ĐỀ...');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

// Định nghĩa mã màu chuẩn 100% theo tên chủ đề
// 1. Đại dương (Ocean): Xanh biển tươi mát, xanh cyan, xanh sâu thẳm
// 2. Hoàng hôn (Sunset): Cam hoàng hôn ấm áp, đỏ san hô rực rỡ
// 3. Quả mọng (Berry): Tím hồng quả mọng, mận chín
// 4. Ngọc bích (Emerald): Xanh ngọc lục bảo, bạc hà thanh mát
// 5. Mặc định (Classic): Xanh Messenger tiêu chuẩn

const themeDefs = `
$.applyThemeColor=function(th){
  var colors={
    classic: 4278216959,
    default: 4278216959,
    sunset: 4294922543,   // #FF512F Cam hoàng hôn
    ocean: 4278223792,    // #0083B0 Xanh đại dương
    berry: 4293476439,    // #E94057 Hồng tím quả mọng
    emerald: 4279343502   // #11998E Xanh ngọc bích
  };
  var col = colors[th] || colors.classic;
  if (typeof B !== 'undefined' && B.o) { B.o.a = col; }
};

$.getThemeColor=function(){
  var th = $._currentActiveChatTheme || 'classic';
  if (!$._themeColors) {
    $._themeColors = {
      classic: new A.q(4278216959),
      default: new A.q(4278216959),
      sunset: new A.q(4294922543),   // #FF512F Cam hoàng hôn
      ocean: new A.q(4278223792),    // #0083B0 Xanh đại dương đích thực
      berry: new A.q(4293476439),    // #E94057 Hồng quả mọng
      emerald: new A.q(4279343502)   // #11998E Xanh ngọc bích
    };
  }
  var col = $._themeColors[th] || $._themeColors.classic;
  if (typeof B !== 'undefined' && B.o) { B.o.a = col.a; }
  return col;
};

$.getThemeGradient=function(){
  var th = $._currentActiveChatTheme || 'classic';
  if (!$._themeGradients) {
    try {
      var ti = B.afh ? B.afh.$ti : null;
      $._themeGradients = {
        classic: B.add,
        sunset: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4294922543), new A.q(4292674678)], ti), null, null), // #FF512F -> #DD2476
        ocean: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4278236379), new A.q(4278223792)], ti), null, null),  // #00B4DB -> #0083B0 (Xanh đại dương)
        berry: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4287243143), new A.q(4293476439)], ti), null, null),  // #8A2387 -> #E94057 (Tím hồng)
        emerald: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4279343502), new A.q(4281929597)], ti), null, null) // #11998E -> #38EF7D (Xanh ngọc)
      };
    } catch(e) {
      console.warn('Fallback theme gradient error:', e);
      return B.add;
    }
  }
  return ($._themeGradients && $._themeGradients[th]) ? $._themeGradients[th] : B.add;
};

$.getThemeBgDecoration=function(isDark){
  if (isDark) return null;
  var th = $._currentActiveChatTheme || 'classic';
  if (th === 'classic' || th === 'default') return null;
  if (!$._themeBgDecorations) {
    var ti = B.afh ? B.afh.$ti : null;
    try {
      $._themeBgDecorations = {
        // Hoàng hôn: Tông kem hoàng hôn -> hồng đào nhẹ
        sunset: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4294964718), new A.q(4294960353), new A.q(4294955484)], ti), null, null), B.t),
        // Đại dương: Tông xanh nước biển trong suốt, xanh biển nhạt dịu mát (KHÔNG BỊ TÍM!)
        ocean: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4293326847), new A.q(4292145404), new A.q(4290963963)], ti), null, null), B.t),
        // Quả mọng: Tông tím hồng lavender phấn
        berry: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4294832888), new A.q(4294764531), new A.q(4294299902)], ti), null, null), B.t),
        // Ngọc bích: Tông xanh mint ngọc bích tươi mát
        emerald: new A.ak(null, null, null, null, null, new A.eU(B.dp, B.oE, B.aU, A.b([new A.q(4293327342), new A.q(4291949792), new A.q(4290572499)], ti), null, null), B.t)
      };
    } catch(e) {
      console.warn('Lỗi khởi tạo Theme Background Decoration:', e);
      return null;
    }
  }
  return $._themeBgDecorations[th] || null;
};

$.getThemeHeaderColor=function(isDark, defaultCol){
  if (isDark) return defaultCol;
  var th = $._currentActiveChatTheme || 'classic';
  if (th === 'classic' || th === 'default') return defaultCol;
  if (!$._themeHeaderColors) {
    $._themeHeaderColors = {
      sunset: new A.q(4294964718),   // #FFF5EE Kem ấm
      ocean: new A.q(4293982719),    // #F0F9FF Xanh biển băng nhẹ
      berry: new A.q(4294832888),    // #FDF2F8 Hồng phấn
      emerald: new A.q(4293327342)   // #E6F9EE Xanh mint nhẹ
    };
  }
  return $._themeHeaderColors[th] || defaultCol;
};
`;

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // Thay thế toàn bộ khối định nghĩa theme functions
  const startMarker = '$.getThemeBgDecoration=function(isDark){';
  const endMarker = 'return ($._themeGradients && $._themeGradients[th]) ? $._themeGradients[th] : B.add;\n};';
  
  const sIdx = js.indexOf(startMarker);
  const eIdx = js.indexOf(endMarker);
  if (sIdx !== -1 && eIdx !== -1) {
    js = js.slice(0, sIdx) + themeDefs.trim() + '\n' + js.slice(eIdx + endMarker.length);
    console.log('✅ Đã thay thế toàn bộ định nghĩa màu sắc chuẩn xác!');
  }

  // Cập nhật Qr để không bị đè theme khi setState
  const qrTarget = 'if(a.theme)$._convThemes[a.a]=a.theme;\n$._currentActiveChatTheme=$._convThemes[a.a]||\'classic\';';
  const qrReplacement = 'if(a.theme&&!$._convThemes[a.a])$._convThemes[a.a]=a.theme;\n$._currentActiveChatTheme=$._convThemes[a.a]||a.theme||\'classic\';';
  if (js.includes(qrTarget)) {
    js = js.replace(qrTarget, qrReplacement);
    console.log('✅ Đã cập nhật Qr bảo toàn theme được chọn!');
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Vá xong: ${filePath}`);
});

// Cập nhật modal index.html để check đúng theme đang mở
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');

  // Sửa lấy currentTheme chính xác
  const targetCurrent = "var currentTheme = (window.$ && window.$._currentActiveChatTheme) || 'classic';";
  const replacementCurrent = "var currentTheme = (window.$ && window.$._convThemes && window.$._convThemes[convId]) || (window.$ && window.$._currentActiveChatTheme) || 'classic';";
  if (html.includes(targetCurrent)) {
    html = html.replace(targetCurrent, replacementCurrent);
    console.log(`✅ Đã sửa nhận diện currentTheme trong: ${hf}`);
  }

  fs.writeFileSync(hf, html, 'utf8');
});

// Nâng mã timestamp
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  html = html.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(hf, html, 'utf8');
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
});

console.log('\n🌟 ĐÃ HOÀN TẤT CẬP NHẬT MÀU SẮC CHUẨN XÁC TUYỆT ĐỐI!');
