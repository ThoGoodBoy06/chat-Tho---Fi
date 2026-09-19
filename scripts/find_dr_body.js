const fs = require('fs');
const content = fs.readFileSync('public/main.dart.js', 'utf8');
const idx = content.indexOf('dr(a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,a0,a1,a2,a3,a4,a5,a6,a7,a8,a9,b0,b1,b2,b3,b4){');
console.log(content.slice(idx, idx + 800));
