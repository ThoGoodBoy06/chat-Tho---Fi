const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Update the tap-to-toggle timestamp logic to use strict Vietnam timezone (+7 hours / 25200000 ms)
  const oldTapSnippet = 'if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){';
  const tapStart = js.indexOf(oldTapSnippet);
  if (tapStart !== -1) {
    const tapEnd = js.indexOf('o.push(new A.eT(1,B.bv,A.dr', tapStart);
    if (tapEnd !== -1) {
      const newTapCode = 'if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){\r\n' +
        '  var _ms=e.as?e.as.a:Date.now()\r\n' +
        '  var _v=new Date(_ms+252e5)\r\n' +
        '  var _now=new Date(Date.now()+252e5)\r\n' +
        '  var _isToday=_v.getUTCFullYear()===_now.getUTCFullYear()&&_v.getUTCMonth()===_now.getUTCMonth()&&_v.getUTCDate()===_now.getUTCDate()\r\n' +
        '  var _hh=String(_v.getUTCHours()).padStart(2,"0")\r\n' +
        '  var _mm=String(_v.getUTCMinutes()).padStart(2,"0")\r\n' +
        '  var _timeStr=_hh+":"+_mm\r\n' +
        '  if(!_isToday){\r\n' +
        '    var _dd=String(_v.getUTCDate()).padStart(2,"0")\r\n' +
        '    var _mo=String(_v.getUTCMonth()+1).padStart(2,"0")\r\n' +
        '    var _yy=_v.getUTCFullYear()\r\n' +
        '    _timeStr=_dd+"/"+_mo+"/"+_yy+", "+_hh+":"+_mm\r\n' +
        '  }\r\n' +
        '  d.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h))\r\n' +
        '}\r\n';
      js = js.slice(0, tapStart) + newTapCode + js.slice(tapEnd);
      console.log('Updated tap timestamp with Vietnam timezone in', f);
    }
  }

  // 2. Update middle separator timestamps to use strict Vietnam timezone (+7h)
  const vnTimeFn = '(function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})';
  
  // Replace in call messages:
  js = js.replaceAll('A.Og("HH:mm").nx(new A.dN(a.as.a,!1))', vnTimeFn + '(a.as)');
  js = js.replaceAll('A.Og("HH:mm").nx(a.as)', vnTimeFn + '(a.as)');

  // Replace in c:
  js = js.replaceAll('A.Og("HH:mm").nx(new A.dN(c.a,!1))', vnTimeFn + '(c)');
  js = js.replaceAll('A.Og("HH:mm").nx(c)', vnTimeFn + '(c)');

  // Replace in p:
  js = js.replaceAll('A.Og("HH:mm").nx(new A.dN(p.a,!1))', vnTimeFn + '(p)');
  js = js.replaceAll('A.Og("HH:mm").nx(p)', vnTimeFn + '(p)');

  fs.writeFileSync(f, js);
  console.log('Patched middle separators with Vietnam timezone in', f);
});
