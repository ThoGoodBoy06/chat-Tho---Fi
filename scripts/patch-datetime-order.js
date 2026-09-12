const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // Change order from HH:mm, dd/MM/yyyy to dd/MM/yyyy, HH:mm
  const oldOrder = '_timeStr=_hh+":"+_mm+", "+_dd+"/"+_mo+"/"+_yy';
  const newOrder = '_timeStr=_dd+"/"+_mo+"/"+_yy+", "+_hh+":"+_mm';

  if (js.includes(oldOrder)) {
    js = js.replaceAll(oldOrder, newOrder);
    console.log('Updated date-time order to dd/MM/yyyy, HH:mm in', f);
  } else if (js.includes(newOrder)) {
    console.log('Order already dd/MM/yyyy, HH:mm in', f);
  } else {
    console.log('oldOrder not found in', f);
  }

  fs.writeFileSync(f, js);
});
