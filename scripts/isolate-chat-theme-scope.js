const fs = require('fs');
const path = require('path');

console.log('🎯 KHU BIỆT PHẠM VI CHỦ ĐỀ: CHỈ ÁP DỤNG BÊN TRONG PHÒNG CHAT, KHÔNG ẢNH HƯỞNG BÊN NGOÀI...');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Phục hồi B.o.a = 4278216959 và loại bỏ hoàn toàn việc gán đè B.o.a = col
  const oldApplyTheme = `$.applyThemeColor=function(th){
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
};`;

  const newApplyTheme = `$.applyThemeColor=function(th){
  // B.o là màu chủ đạo toàn app (0xFF0068FF), tuyệt đối giữ nguyên không can thiệp
  if (typeof B !== 'undefined' && B.o) { B.o.a = 4278216959; }
};`;

  if (js.includes(oldApplyTheme)) {
    js = js.replace(oldApplyTheme, newApplyTheme);
    console.log('✅ Đã loại bỏ biến đổi B.o trong $.applyThemeColor');
  }

  // 2. Loại bỏ việc gán B.o.a = col.a trong $.getThemeColor
  const oldGetThemeColor = `$.getThemeColor=function(){
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
};`;

  const newGetThemeColor = `$.getThemeColor=function(){
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
  // Giữ nguyên B.o là màu mặc định của toàn ứng dụng (0xFF0068FF)
  if (typeof B !== 'undefined' && B.o) { B.o.a = 4278216959; }
  return $._themeColors[th] || $._themeColors.classic;
};`;

  if (js.includes(oldGetThemeColor)) {
    js = js.replace(oldGetThemeColor, newGetThemeColor);
    console.log('✅ Đã loại bỏ biến đổi B.o trong $.getThemeColor');
  }

  // 3. Reset theme về 'classic' khi rời phòng chat (khi a == null trong Qr)
  const oldQrExit = `if(a==null){c._activeChatConvId=null;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1;return c.Qt()}`;
  const newQrExit = `if(a==null){c._activeChatConvId=null;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1;$._currentActiveChatConvId=null;$._currentActiveChatTheme='classic';return c.Qt()}`;
  if (js.includes(oldQrExit)) {
    js = js.replace(oldQrExit, newQrExit);
    console.log('✅ Đã reset $._currentActiveChatTheme về classic khi ra ngoài phòng chat');
  }

  fs.writeFileSync(filePath, js, 'utf8');
});

// 4. Nâng timestamp cache-busting mới
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

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

console.log('\n🎉 HOÀN TẤT CÔ LẬP THEME: CHỈ ÁP DỤNG TRONG PHÒNG CHAT!');
