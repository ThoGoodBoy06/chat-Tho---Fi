const fs = require('fs');

const jsFiles = [
  'flutter_frontend/build/web/main.dart.js',
  'public/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const tapClassCode = `
A.atTap = function atTap(a, b) {
  this.a = a;
  this.b = b;
};
A.atTap.prototype = {
  $0: function() {
    var state = this.a;
    var msgId = this.b.a;
    state._tsMsgIds = state._tsMsgIds || new Set();
    if (state._tsMsgIds.has(msgId)) {
      state._tsMsgIds.delete(msgId);
    } else {
      state._tsMsgIds.add(msgId);
    }
    state.K({
      $0: function() {},
      $S: 0
    });
  },
  $S: 0
};
`;

const targetDr = 'new A.atW(n,a,e,g,b),h,h,h,h,h,h,h,h,!1,B.ao';
const replacementDr = 'new A.atW(n,a,e,g,b),h,new A.atTap(n,e),h,h,h,h,h,h,!1,B.ao';

const targetPush = 'o.push(new A.eT(1,B.bv,A.dr(h,A.bm(d,m,B.m,B.p)';
const timeWidgetCode = `
if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){
  var _ms=e.as?e.as.a:Date.now();
  var _d=new Date(_ms);
  var _now=new Date();
  var _isToday=_d.getFullYear()===_now.getFullYear()&&_d.getMonth()===_now.getMonth()&&_d.getDate()===_now.getDate();
  var _hh=String(_d.getHours()).padStart(2,'0');
  var _mm=String(_d.getMinutes()).padStart(2,'0');
  var _timeStr=_hh+':'+_mm;
  if(!_isToday){
    var _dd=String(_d.getDate()).padStart(2,'0');
    var _mo=String(_d.getMonth()+1).padStart(2,'0');
    var _yy=_d.getFullYear();
    _timeStr=_hh+':'+_mm+', '+_dd+'/'+_mo+'/'+_yy;
  }
  d.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h));
}
`;

jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');

  // 1. Add A.atTap class definition if not present
  if (!js.includes('A.atTap = function')) {
    js = tapClassCode + js;
    console.log('Prepended A.atTap definition to', f);
  }

  // 2. Add onTap handler to A.dr call
  if (js.includes(targetDr)) {
    js = js.replace(targetDr, replacementDr);
    console.log('Replaced targetDr in', f);
  } else if (js.includes(replacementDr)) {
    console.log('targetDr already replaced in', f);
  } else {
    console.log('targetDr NOT found in', f);
  }

  // 3. Add timestamp widget insertion before o.push
  if (js.includes(targetPush) && !js.includes('n._tsMsgIds.has(e.a)')) {
    js = js.replace(targetPush, timeWidgetCode + targetPush);
    console.log('Added timeWidgetCode before o.push in', f);
  } else if (js.includes('n._tsMsgIds.has(e.a)')) {
    console.log('timeWidgetCode already present in', f);
  } else {
    console.log('targetPush NOT found in', f);
  }

  fs.writeFileSync(f, js);
});
