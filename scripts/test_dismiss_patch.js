const fs = require('fs');
const vm = require('vm');

const targetSnippet = `return A.hq(d,B.F,A.dt(B.aF,A.b([c,new A.eb(r,d,d,new A.bc(B.L_,A.xn(A.bm(A.b([n,B.hn,k,B.jT,A.a5(d,A.bm(i,B.l,B.m,B.G),B.h,d,d,new A.ak(B.f,d,d,j,o,d,B.t),d,d,d,d,d,d,220)],g),q,B.m,B.G),d,B.M,d,d,B.a0),d),d)],g),B.r,B.ap),d,!1)}`;

const replacementSnippet = `var _pop=new A.awq(a);
var _align=new A.eb(r,d,d,new A.bc(B.L_,A.xn(A.bm(A.b([n,B.hn,k,B.jT,A.a5(d,A.bm(i,B.l,B.m,B.G),B.h,d,d,new A.ak(B.f,d,d,j,o,d,B.t),d,d,d,d,d,d,220)],g),q,B.m,B.G),d,B.M,d,d,B.a0),d),d);
var _alignWrapped=A.dr(d,_align,B.db,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,_pop,d,d,d,d,d,d,!1,B.ao);
var _stack=A.dt(B.aF,A.b([c,_alignWrapped],g),B.r,B.ap);
var _stackWrapped=A.dr(d,_stack,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,_pop,d,d,d,d,d,d,!1,B.ao);
return A.hq(d,B.F,_stackWrapped,d,!1);
}`;

const file = 'public/main.dart.js';
let content = fs.readFileSync(file, 'utf8');

console.log('Found target in public/main.dart.js?', content.includes(targetSnippet));
if (content.includes(targetSnippet)) {
  const newContent = content.replace(targetSnippet, replacementSnippet);
  console.log('Validating syntax...');
  new vm.Script(newContent);
  console.log('✅ Syntax valid 100%!');
}
