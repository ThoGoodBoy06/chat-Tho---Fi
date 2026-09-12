const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. In Qr(a0, a1) (_buildChatWindow):
  // Reset _tsMsgIds and c.Q (_showEmojiPicker = false) when exiting or opening a room
  const oldQrStart = 'Qr(a0,a1){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c=this,b=null,a=a0.c\r\nif(a==null)return c.Qt()';
  const oldQrStartLf = 'Qr(a0,a1){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c=this,b=null,a=a0.c\nif(a==null)return c.Qt()';
  
  const newQrStart = 'Qr(a0,a1){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c=this,b=null,a=a0.c\r\n' +
    'if(a==null){c._activeChatConvId=null;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1;return c.Qt()}\r\n' +
    'if(c._activeChatConvId!==a.a){c._activeChatConvId=a.a;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1}\r\n';
    
  const newQrStartLf = 'Qr(a0,a1){var s,r,q,p,o,n,m,l,k,j,i,h,g,f,e,d,c=this,b=null,a=a0.c\n' +
    'if(a==null){c._activeChatConvId=null;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1;return c.Qt()}\n' +
    'if(c._activeChatConvId!==a.a){c._activeChatConvId=a.a;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1}\n';

  if (js.includes(oldQrStart)) {
    js = js.replace(oldQrStart, newQrStart);
    console.log('Patched Qr (CRLF) in', f);
  } else if (js.includes(oldQrStartLf)) {
    js = js.replace(oldQrStartLf, newQrStartLf);
    console.log('Patched Qr (LF) in', f);
  } else if (js.includes('c._activeChatConvId!==a.a')) {
    console.log('Qr already patched in', f);
  } else {
    console.log('oldQrStart not found in', f);
  }

  fs.writeFileSync(f, js);
});
