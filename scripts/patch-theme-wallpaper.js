const fs = require('fs');
const path = require('path');

console.log('🖼️ BẮT ĐẦU VÁ HÌNH NỀN CHỦ ĐỀ MESSENGER (THEME WALLPAPER & AMBIENT BACKGROUND)...');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Thêm hàm $.getThemeBgDecoration & $.getThemeHeaderColor
  const bgFunctions = `$.getThemeBgDecoration=function(isDark){
  if(isDark)return null;
  var th=$._currentActiveChatTheme||'classic';
  if(th==='classic'||th==='default')return null;
  if(!$._themeBgDecorations){
    var ti=B.afh?B.afh.$ti:null;
    try{
      $._themeBgDecorations={
        sunset:new A.ak(null,null,null,null,null,new A.eU(B.dp,B.oE,B.aU,A.b([new A.q(4294965942),new A.q(4294963435),new A.q(4294960878)],ti),null,null),B.t),
        ocean:new A.ak(null,null,null,null,null,new A.eU(B.dp,B.oE,B.aU,A.b([new A.q(4293999103),new A.q(4293342462),new A.q(4292751614)],ti),null,null),B.t),
        berry:new A.ak(null,null,null,null,null,new A.eU(B.dp,B.oE,B.aU,A.b([new A.q(4294833400),new A.q(4294508541),new A.q(4294179071)],ti),null,null),B.t),
        emerald:new A.ak(null,null,null,null,null,new A.eU(B.dp,B.oE,B.aU,A.b([new A.q(4293999604),new A.q(4293413616),new A.q(4292757226)],ti),null,null),B.t)
      };
    }catch(e){
      console.warn('Lỗi khởi tạo Theme Background Decoration:',e);
      return null;
    }
  }
  return $._themeBgDecorations[th]||null;
};
$.getThemeHeaderColor=function(isDark,defaultCol){
  if(isDark)return defaultCol;
  var th=$._currentActiveChatTheme||'classic';
  if(th==='classic'||th==='default')return defaultCol;
  if(!$._themeHeaderColors){
    $._themeHeaderColors={
      sunset:new A.q(4294965236),
      ocean:new A.q(4294327039),
      berry:new A.q(4294702843),
      emerald:new A.q(4294327543)
    };
  }
  return $._themeHeaderColors[th]||defaultCol;
};
`;

  if (!js.includes('$.getThemeBgDecoration=')) {
    const marker = '$.getThemeColor=function(){';
    if (js.includes(marker)) {
      js = js.replace(marker, bgFunctions + '\n' + marker);
      console.log('✅ Đã thêm hàm $.getThemeBgDecoration() và $.getThemeHeaderColor()');
    }
  }

  // 2. Tìm trong Qr và áp dụng Background Decoration + Header Color
  const qrStart = js.indexOf('Qr(a0,a1){');
  if (qrStart !== -1) {
    const qrEnd = js.indexOf('Qt(){', qrStart);
    let qrChunk = js.slice(qrStart, qrEnd !== -1 ? qrEnd : qrStart + 35000);
    const originalChunk = qrChunk;

    // A. Thay return A.a5(b,A.bm(i,B.l,B.m,B.p),B.h,q,b,b,b,b,b,b,b,b,b)},
    const returnTarget = 'return A.a5(b,A.bm(i,B.l,B.m,B.p),B.h,q,b,b,b,b,b,b,b,b,b)},';
    const returnReplacement = 'var _bgDec=($.getThemeBgDecoration?$.getThemeBgDecoration(r):null);var _bgCol=_bgDec?null:q;return A.a5(b,A.bm(i,B.l,B.m,B.p),B.h,_bgCol,_bgDec,b,b,b,b,b,b,b,b)},';
    if (qrChunk.includes(returnTarget)) {
      qrChunk = qrChunk.replace(returnTarget, returnReplacement);
      console.log('✅ Đã thay thế Container background thành Theme Wallpaper Gradient!');
    }

    // B. Thay thế màu nền Header
    const hdrTarget = 'new A.ak(p,b,b,b,s,b,B.t),b,56,b,B.qH,b,b,b)';
    const hdrReplacement = 'new A.ak(($.getThemeHeaderColor?$.getThemeHeaderColor(r,p):p),b,b,b,s,b,B.t),b,56,b,B.qH,b,b,b)';
    if (qrChunk.includes(hdrTarget)) {
      qrChunk = qrChunk.replace(hdrTarget, hdrReplacement);
      console.log('✅ Đã áp dụng Theme Header Ambient Tint cho Header!');
    }

    // C. Thay thế màu nền Input Bar
    const inputTarget = 'new A.ak(p,b,new A.dl(new A.aW(i,1,B.z,-1),B.k,B.k,B.k),b,b,b,B.t),b,b,b,B.Lp,b,b,b)';
    const inputReplacement = 'new A.ak(($.getThemeHeaderColor?$.getThemeHeaderColor(r,p):p),b,new A.dl(new A.aW(i,1,B.z,-1),B.k,B.k,B.k),b,b,b,B.t),b,b,b,B.Lp,b,b,b)';
    if (qrChunk.includes(inputTarget)) {
      qrChunk = qrChunk.replace(inputTarget, inputReplacement);
      console.log('✅ Đã áp dụng Theme Input Ambient Tint cho Input Bar!');
    }

    if (qrChunk !== originalChunk) {
      js = js.slice(0, qrStart) + qrChunk + js.slice(qrStart + originalChunk.length);
      console.log('✅ Đã cập nhật thành công toàn bộ giao diện hình nền trong ChatScreen!');
    }
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Hoàn tất vá file: ${filePath}`);
});

// 3. Tăng mã Cache-Busting
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

console.log('\n🌟 ĐÃ HOÀN TẤT VÁ THEME WALLPAPER TOÀN DIỆN!');
