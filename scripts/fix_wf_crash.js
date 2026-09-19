const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Sửa lỗi crash NoSuchMethodError trong hàm wf (MessageModel.fromJson)...');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

// Target pattern around wf's replyMessageId and return:
// Trước đây:
// g=d.h(a,"replyMessageId")
// g=g==null?f:J.ai(g)
// if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))
// if(d==null)d=new A.dN(Date.now(),!1)
// else d=new A.dN(d.a,!1)}else d=new A.dN(Date.now(),!1)
// var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);
// if(a && (a.isForwarded === true || a.is_forwarded === true || (d && d.h && (d.h(a,"isForwarded") === true || d.h(a,"is_forwarded") === true)))){
//   _mRes.isForwarded = true;
// }
// return _mRes;},

const oldPattern = /g=d\.h\(a,"replyMessageId"\)[\r\n\s]*g=g==null\?f:J\.ai\(g\)[\r\n\s]*if\(d\.h\(a,e\)!=null\)\{d=A\.a9d\(J\.ai\(d\.h\(a,e\)\)\)[\r\n\s]*if\(d==null\)d=new A\.dN\(Date\.now\(\),!1\)[\r\n\s]*else d=new A\.dN\(d\.a,!1\)\}else d=new A\.dN\(Date\.now\(\),!1\)[\r\n\s]*(?:var _mRes = new A\.k1\(c,i,h,o,n,b,p,l,k,j,g,s,d\);[\s\S]*?return _mRes;\}|return new A\.k1\(c,i,h,o,n,b,p,l,k,j,g,s,d\)\}),/g;

const replacementCode = `g=d.h(a,"replyMessageId")
g=g==null?f:J.ai(g)
var _isFwd=d.h(a,"isForwarded")===true||d.h(a,"is_forwarded")===true||(a&&(a.isForwarded===true||a.is_forwarded===true));
if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))
if(d==null)d=new A.dN(Date.now(),!1)
else d=new A.dN(d.a,!1)}else d=new A.dN(Date.now(),!1)
var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);
if(_isFwd){_mRes.isForwarded=true;}
return _mRes;},`;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, replacementCode);
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [OK] Đã sửa lỗi wf trong: ${file}`);
  } else {
    // Thử regex linh hoạt hơn
    const flexPattern = /if\(d\.h\(a,e\)!=null\)\{d=A\.a9d\(J\.ai\(d\.h\(a,e\)\)\)[\s\S]*?return (?:_mRes|new A\.k1\(c,i,h,o,n,b,p,l,k,j,g,s,d\))\};?,/g;
    const flexReplacement = `var _isFwd=d.h(a,"isForwarded")===true||d.h(a,"is_forwarded")===true||(a&&(a.isForwarded===true||a.is_forwarded===true));
if(d.h(a,e)!=null){d=A.a9d(J.ai(d.h(a,e)))
if(d==null)d=new A.dN(Date.now(),!1)
else d=new A.dN(d.a,!1)}else d=new A.dN(Date.now(),!1)
var _mRes = new A.k1(c,i,h,o,n,b,p,l,k,j,g,s,d);
if(_isFwd){_mRes.isForwarded=true;}
return _mRes;},`;

    if (flexPattern.test(content)) {
      content = content.replace(flexPattern, flexReplacement);
      new vm.Script(content);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  [OK - flex] Đã sửa lỗi wf trong: ${file}`);
    } else {
      console.warn(`  [!] Không khớp pattern trong: ${file}`);
    }
  }
});

console.log('\n🎉 Hoàn tất sửa hàm wf!');
