const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. In ChatMessage.fromJson: ensure createdAt is converted to local timezone (isUtc = false)
  const oldParse = 'if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))\r\nif(d==null)d=new A.dN(Date.now(),!1)}else d=new A.dN(Date.now(),!1)';
  const oldParseLf = 'if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))\nif(d==null)d=new A.dN(Date.now(),!1)}else d=new A.dN(Date.now(),!1)';
  const newParse = 'if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))\r\nif(d==null)d=new A.dN(Date.now(),!1)\r\nelse d=new A.dN(d.a,!1)}else d=new A.dN(Date.now(),!1)';
  const newParseLf = 'if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))\nif(d==null)d=new A.dN(Date.now(),!1)\nelse d=new A.dN(d.a,!1)}else d=new A.dN(Date.now(),!1)';

  if (js.includes(oldParse)) {
    js = js.replace(oldParse, newParse);
    console.log('Patched ChatMessage.fromJson (CRLF) in', f);
  } else if (js.includes(oldParseLf)) {
    js = js.replace(oldParseLf, newParseLf);
    console.log('Patched ChatMessage.fromJson (LF) in', f);
  } else if (js.includes('new A.dN(d.a,!1)')) {
    console.log('ChatMessage.fromJson already has new A.dN(d.a,!1) in', f);
  } else {
    console.log('ChatMessage.fromJson pattern not matched in', f);
  }

  // 2. In middle separator formatting: ensure local time is passed to DateFormat
  // Position around A.Og("HH:mm").nx(c)
  const oldSepC = 'A.Og("HH:mm").nx(c)';
  const newSepC = 'A.Og("HH:mm").nx(new A.dN(c.a,!1))';
  if (js.includes(oldSepC)) {
    js = js.replaceAll(oldSepC, newSepC);
    console.log('Patched A.Og("HH:mm").nx(c) in', f);
  }

  // Position around A.Og("HH:mm").nx(p)
  const oldSepP = 'A.Og("HH:mm").nx(p)';
  const newSepP = 'A.Og("HH:mm").nx(new A.dN(p.a,!1))';
  if (js.includes(oldSepP)) {
    js = js.replaceAll(oldSepP, newSepP);
    console.log('Patched A.Og("HH:mm").nx(p) in', f);
  }

  // Position for call messages: A.Og("HH:mm").nx(a.as)
  const oldSepCall = 'A.Og("HH:mm").nx(a.as)';
  const newSepCall = 'A.Og("HH:mm").nx(new A.dN(a.as.a,!1))';
  if (js.includes(oldSepCall)) {
    js = js.replaceAll(oldSepCall, newSepCall);
    console.log('Patched A.Og("HH:mm").nx(a.as) in', f);
  }

  fs.writeFileSync(f, js);
});
