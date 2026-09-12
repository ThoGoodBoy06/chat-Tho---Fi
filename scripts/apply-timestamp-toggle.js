const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Add atTap:function constructor right before atT:function
  if (!js.includes('atTap:function')) {
    const atTDef = 'atT:function atT(a,b){this.a=a';
    if (js.includes(atTDef)) {
      js = js.replace(atTDef, 'atTap:function atTap(a,b){this.a=a\r\nthis.b=b},\r\n' + atTDef);
      console.log('Added atTap constructor in', f);
    } else {
      console.log('atTDef not found in', f);
    }
  }

  // 2. Add A.atTap.prototype right before A.atT.prototype
  if (!js.includes('A.atTap.prototype')) {
    const atTProto = 'A.atT.prototype={';
    const atTapProto = 'A.atTap.prototype={\r\n$0(){var s=this.a,m=this.b.a\r\ns._tsMsgIds=s._tsMsgIds||new Set()\r\nif(s._tsMsgIds.has(m))s._tsMsgIds.delete(m)\r\nelse s._tsMsgIds.add(m)\r\ns.aoW()},\r\n$S:0}\r\n';
    if (js.includes(atTProto)) {
      js = js.replace(atTProto, atTapProto + atTProto);
      console.log('Added A.atTap.prototype in', f);
    } else {
      console.log('atTProto not found in', f);
    }
  }

  // 3. Connect onTap in A.dr call
  const oldDr = 'new A.atW(n,a,e,g,b),h,h,h,h,h,h,h,h,!1,B.ao';
  const newDr = 'new A.atW(n,a,e,g,b),h,new A.atTap(n,e),h,h,h,h,h,h,!1,B.ao';
  if (js.includes(oldDr)) {
    js = js.replace(oldDr, newDr);
    console.log('Connected onTap in A.dr in', f);
  } else if (js.includes(newDr)) {
    console.log('onTap already connected in', f);
  } else {
    console.log('oldDr not found in', f);
  }

  // 4. Add timestamp display in message bubble column
  const targetPush = 'o.push(new A.eT(1,B.bv,A.dr(h,A.bm(d,m,B.m,B.p)';
  const tsCode = 'if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){\r\n' +
    '  var _ms=e.as?e.as.a:Date.now()\r\n' +
    '  var _d=new Date(_ms)\r\n' +
    '  var _now=new Date()\r\n' +
    '  var _isToday=_d.getFullYear()===_now.getFullYear()&&_d.getMonth()===_now.getMonth()&&_d.getDate()===_now.getDate()\r\n' +
    '  var _hh=String(_d.getHours()).padStart(2,"0")\r\n' +
    '  var _mm=String(_d.getMinutes()).padStart(2,"0")\r\n' +
    '  var _timeStr=_hh+":"+_mm\r\n' +
    '  if(!_isToday){\r\n' +
    '    var _dd=String(_d.getDate()).padStart(2,"0")\r\n' +
    '    var _mo=String(_d.getMonth()+1).padStart(2,"0")\r\n' +
    '    var _yy=_d.getFullYear()\r\n' +
    '    _timeStr=_hh+":"+_mm+", "+_dd+"/"+_mo+"/"+_yy\r\n' +
    '  }\r\n' +
    '  d.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h))\r\n' +
    '}\r\n';

  if (js.includes(targetPush) && !js.includes('n._tsMsgIds&&n._tsMsgIds.has(e.a)')) {
    js = js.replace(targetPush, tsCode + targetPush);
    console.log('Added timestamp widget logic in', f);
  } else if (js.includes('n._tsMsgIds&&n._tsMsgIds.has(e.a)')) {
    console.log('Timestamp widget logic already present in', f);
  } else {
    console.log('targetPush not found in', f);
  }

  fs.writeFileSync(f, js);
});
