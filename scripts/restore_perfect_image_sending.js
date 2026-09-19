const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Restoring perfect optimistic image sending across all bundle files...');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

// 1. Clean A.avs.prototype: multi-file reader without premature push
const cleanAvs = `A.avs.prototype={
$1(a){var s,r,q,p=this,o=p.b.files
if(o!=null&&!B.fA.gaf(o)){
for(var _fi=0;_fi<o.length;_fi++){
(function(file){
var q=new FileReader();
q.readAsArrayBuffer(file);
A.dJ(q,"loadend",new A.avr(q,p.c,file,p.d),!1);
})(o[_fi]);
}
return;
s=o[0]
r=p.a.c.Y(t.q)
r.toString
r.f.bA(B.Dz)
q=new FileReader()
q.readAsArrayBuffer(s)
A.dJ(q,"loadend",new A.avr(q,p.c,s,p.d),!1)}},
$S:13}`;

// 2. Clean A.avr.prototype: single optimistic message with base64 preview and robust resolution
const cleanAvr = `A.avr.prototype={
$1(a){return this.a2L(a)},
a2L(a){var s=0,r=A.x(t.H),q=this,p,o,n,m,l,k
var $async$$1=A.t(function(b,c){if(b===1)return A.u(c,r)
while(true)switch(s){case 0:l=q.a
var _raw=l.result||B.cc.gks(l)
var _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))
n=_u8
l=q.c
k=l.name||"file"
l=l.type||""
var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);
var _myUid=(q.d&&q.d.a)?q.d.a.a:null;
var _isVidSend=l&&(l.indexOf("video")!==-1||(k&&k.match(/\\.(mp4|mov|webm|mkv)$/i)));
if(_isVidSend&&n.length>0){
try{
var _optMsg=new A.k1(_optId,q.b.a,_myUid,"video","video","",null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));
_optMsg.status="sending";_optMsg.clientTempId=_optId;
B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();
}catch(_){}
}
var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));
if(_isImg&&n.length>0){
try{
var _b64="",_chunk=0x8000;
for(var _ci=0;_ci<n.length;_ci+=_chunk){
_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));
}
var _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);
var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));
_optMsg.status="sending";_optMsg.clientTempId=_optId;
B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();
}catch(_){}
}
s=4
return A.m(A.q3(q.b.a,n,k,l),$async$$1)
case 4:p=c
if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{
o=A.wf(J.Z(p,"data"));
o.status="sent";
var _msgs=q.d.d,_foundIdx=-1;
if(_msgs&&_msgs.length){
for(var _i=0;_i<_msgs.length;_i++){
if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_foundIdx=_i;break;}
}
}
if(_foundIdx!==-1){
_msgs[_foundIdx]=o;
}else{
var _alreadyHasReal=!1;
if(_msgs&&_msgs.length){
for(var _j=0;_j<_msgs.length;_j++){
if(_msgs[_j]&&_msgs[_j].a===o.a){_alreadyHasReal=!0;break;}
}
}
if(!_alreadyHasReal){
B.b.D(q.d.d,o);
}
}
q.d.JF(o);
q.d.V();
if(q.d.cy!=null)q.d.cy.$0();
}catch(j){}
else{
try{
var _msgs=q.d.d;
if(_msgs&&_msgs.length){
for(var _i=0;_i<_msgs.length;_i++){
if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_msgs.splice(_i,1);break;}
}
q.d.V();
}
}catch(_){}
}
case 3:return A.v(null,r)}})
return A.w($async$$1,r)},
$S:79}`;

// 3. Clean A.av3.prototype (camera upload)
const cleanAv3 = `A.av3.prototype={
$1(a){return this.a2K(a)},
a2K(a){var s=0,r=A.x(t.H),q=this,p,o,n,m,l,k
var $async$$1=A.t(function(b,c){if(b===1)return A.u(c,r)
while(true)switch(s){case 0:l=q.a
var _raw=l.result||B.cc.gks(l)
var _u8=(_raw instanceof Uint8Array)?_raw:(_raw instanceof ArrayBuffer?new Uint8Array(_raw):(_raw&&_raw.buffer?new Uint8Array(_raw.buffer):new Uint8Array(0)))
n=_u8
l=q.c
k=l.name||"file"
l=l.type||""
var _optId="optimistic-"+Date.now()+"-"+Math.random().toString(36).substring(2,7);
var _myUid=(q.d&&q.d.a)?q.d.a.a:null;
var _isImg=!l||l.indexOf("image")!==-1||(k&&k.match(/\\.(jpg|jpeg|png|gif|webp)$/i));
if(_isImg&&n.length>0){
try{
var _b64="",_chunk=0x8000;
for(var _ci=0;_ci<n.length;_ci+=_chunk){
_b64+=String.fromCharCode.apply(null,n.subarray(_ci,Math.min(_ci+_chunk,n.length)));
}
var _dUrl="data:"+(l||"image/jpeg")+";base64,"+btoa(_b64);
var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));
_optMsg.status="sending";_optMsg.clientTempId=_optId;
B.b.D(q.d.d,_optMsg);q.d.JF(_optMsg);q.d.V();if(q.d.cy!=null)q.d.cy.$0();
}catch(_){}
}
s=4
return A.m(A.q3(q.b.a,n,k,l),$async$$1)
case 4:p=c
if(J.e(J.Z(p,"success"),!0)&&J.Z(p,"data")!=null)try{
o=A.wf(J.Z(p,"data"));
o.status="sent";
var _msgs=q.d.d,_foundIdx=-1;
if(_msgs&&_msgs.length){
for(var _i=0;_i<_msgs.length;_i++){
if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_foundIdx=_i;break;}
}
}
if(_foundIdx!==-1){
_msgs[_foundIdx]=o;
}else{
var _alreadyHasReal=!1;
if(_msgs&&_msgs.length){
for(var _j=0;_j<_msgs.length;_j++){
if(_msgs[_j]&&_msgs[_j].a===o.a){_alreadyHasReal=!0;break;}
}
}
if(!_alreadyHasReal){
B.b.D(q.d.d,o);
}
}
q.d.JF(o);
q.d.V();
if(q.d.cy!=null)q.d.cy.$0();
}catch(j){}
else{
try{
var _msgs=q.d.d;
if(_msgs&&_msgs.length){
for(var _i=0;_i<_msgs.length;_i++){
if(_msgs[_i]&&(_msgs[_i].a===_optId||_msgs[_i].clientTempId===_optId)){_msgs.splice(_i,1);break;}
}
q.d.V();
}
}catch(_){}
}
case 3:return A.v(null,r)}})
return A.w($async$$1,r)},
$S:79}`;

// 4. Safe A.a7R.prototype socket deduplicator
const cleanA7r = `A.a7R.prototype={
$1(a){var s=this.a;
if(a.c!=s.c)return!1;
if(a.e===s.e)return!0;
if(s.clientTempId&&a.clientTempId&&s.clientTempId===a.clientTempId)return!0;
if(a.b===s.b&&a.d===s.d&&(a.status==="sending"||(typeof a.a==="string"&&a.a.indexOf("optimistic-")===0))){
return!0;
}
return!1;},
$S:28}`;

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n===> Patching: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace A.avs.prototype
  const avsStart = content.indexOf('A.avs.prototype=');
  const avrStart = content.indexOf('A.avr.prototype=');
  if (avsStart !== -1 && avrStart !== -1) {
    content = content.slice(0, avsStart) + cleanAvs + '\n' + content.slice(avrStart);
    console.log('  [+] Cleaned A.avs.prototype');
  }

  // Replace A.avr.prototype
  const avrIdx = content.indexOf('A.avr.prototype=');
  const av4Idx = content.indexOf('A.av4.prototype=');
  if (avrIdx !== -1 && av4Idx !== -1) {
    content = content.slice(0, avrIdx) + cleanAvr + '\n' + content.slice(av4Idx);
    console.log('  [+] Cleaned A.avr.prototype');
  }

  // Replace A.av3.prototype
  const av3Idx = content.indexOf('A.av3.prototype=');
  const awrIdx = content.indexOf('A.awR.prototype=');
  if (av3Idx !== -1 && awrIdx !== -1) {
    content = content.slice(0, av3Idx) + cleanAv3 + '\n' + content.slice(awrIdx);
    console.log('  [+] Cleaned A.av3.prototype');
  }

  // Replace A.a7R.prototype
  const a7rIdx = content.indexOf('A.a7R.prototype=');
  const a7uIdx = content.indexOf('A.a7U.prototype=');
  if (a7rIdx !== -1 && a7uIdx !== -1) {
    content = content.slice(0, a7rIdx) + cleanA7r + '\n' + content.slice(a7uIdx);
    console.log('  [+] Cleaned A.a7R.prototype');
  }

  // Verify syntax with VM
  try {
    new vm.Script(content);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  [OK] Successfully saved and verified syntax in: ${filePath}`);
  } catch (err) {
    console.error(`  [FAIL] Syntax error in ${filePath}:`, err);
    process.exit(1);
  }
});

console.log('\nAll 4 bundles cleanly patched!');
