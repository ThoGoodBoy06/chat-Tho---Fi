const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

function patchMainDartJs(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] Not found: ${filePath}`);
    return;
  }
  console.log(`\n========================================`);
  console.log(`🚀 Patching bulletproof chat render: ${filePath}`);
  console.log(`========================================`);

  let content = fs.readFileSync(filePath, 'utf8');
  let patchCount = 0;

  // 0. PATCH A.c7.prototype to include gbH and gaf (empty Map interface)
  const c7Pattern = 'A.c7.prototype={';
  const c7Replacement = 'A.c7.prototype={gbH(a){return!1},gaf(a){return!0},';
  if (content.includes(c7Pattern) && !content.includes(c7Replacement)) {
    content = content.replace(c7Pattern, c7Replacement);
    patchCount++;
    console.log('  [+] Patched A.c7.prototype with safe gbH and gaf methods');
  }

  // 1. PATCH aaZ (Status indicator) with try/catch and null guards
  const aaZStart = content.indexOf('aaZ(a,b,c){');
  if (aaZStart !== -1) {
    const isCRLF = content.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';
    const aaZEnd = content.indexOf(',' + newline + 'Qr(a0,a1){', aaZStart);
    if (aaZEnd !== -1) {
      const newAaZ = `aaZ(a,b,c){try{var s,r,q,p,o,n,m=null,l={}
if(!c||!a)return B.au
if(!a.w)if(a.x)return A.a5(m,B.Hz,B.h,m,m,B.oT,m,14,B.i6,m,m,m,14)
else return A.a5(m,B.HB,B.h,m,m,new A.ak(m,m,A.dx(B.aC,1.2),m,m,m,B.a8),m,14,B.i6,m,m,m,14)
if(!b)return B.au
s=b.c
r=b.w
q=b.x
p=q?q.length:0
if(p!==0){o=B.b.nw(q,new A.auT(a),new A.auU(b))
if(r==null)r=o.a
if(s==null||s.length===0)s=o.r}if((s==null||s.length===0)&&r!=null&&r.length!==0)s="/api/users/"+A.f(r)+"/avatar"
l.a=null
if(s!=null&&s.length!==0){if(J.pX(s,"http"))n=s
else{q=A.da()
n=A.e1(q,"/api","")+s}q=A.b([new A.bZ(0,B.ac,A.I(38,0,0,0),B.cT,3)],t.V)
l.a=A.a5(m,A.hO(B.eg,new A.eY(n,1,m),m,8),B.h,m,m,new A.ak(m,m,m,m,q,m,B.a8),m,16,B.i6,m,m,m,16)}else{q=b.b
l.a=A.a5(m,A.hO(B.o,m,A.a2(q&&q.length!==0?q[0].toUpperCase():"U",m,m,m,m,m,B.avz,m,m,m),8),B.h,m,m,m,m,16,B.i6,m,m,m,16)}return new A.dL(new A.auV(l,a),m)}catch(_errAaZ){return B.au}}`;

      content = content.slice(0, aaZStart) + newAaZ + content.slice(aaZEnd);
      patchCount++;
      console.log('  [+] Patched aaZ with safety wrapper');
    }
  }

  // 2. PATCH aaY (Message content widget) with try/catch
  const aaYStart = content.indexOf('aaY(a,b){');
  if (aaYStart !== -1) {
    const isCRLF = content.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';
    const aaYEnd = content.indexOf(',' + newline + 'agj(a){', aaYStart);
    if (aaYEnd !== -1) {
      let origAaYBody = content.slice(aaYStart + 9, aaYEnd).trim();
      if (origAaYBody.endsWith('}')) {
        origAaYBody = origAaYBody.slice(0, -1);
      }
      const newAaY = `aaY(a,b){try{` + origAaYBody + `}catch(errAaY){console.error("aaY error:",errAaY);return B.yF;}}`;
      content = content.slice(0, aaYStart) + newAaY + content.slice(aaYEnd);
      patchCount++;
      console.log('  [+] Patched aaY with try/catch');
    }
  }

  // 3. PATCH A.au_.prototype (Sliver list itemBuilder $2) with COMPLETE BULLETPROOF GUARDS
  const auStart = content.indexOf('A.au_.prototype={');
  if (auStart !== -1) {
    const isCRLF = content.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';
    const auEnd = content.indexOf('A.atX.prototype={', auStart);
    if (auEnd !== -1) {
      const newAuPrototype = `A.au_.prototype={
$2(a,a0){
  try{
    var s,r,q,p,o,n,m,l={},k,j,i=this,h=null,g=i.b,f=g.d;
    if(!f||a0>=f.length+1)return B.au;
    if(a0===f.length){
      var tp=g.a3p();
      if(!tp)return B.au;
      var b=A.ag(18),c=t.p;
      return A.a5(h,A.b9(A.b([A.a5(h,A.b9(A.b([A.a2(A.f(tp)+" \\u0111ang g\\xf5 ",h,h,h,h,h,B.av2,h,h,h),B.cW,B.FC],c),B.l,B.m,B.G),B.h,h,h,new A.ak(B.eg,h,h,b,h,h,B.t),h,h,h,B.fu,h,h,h)],c),B.l,B.m,B.p),B.h,h,h,h,h,h,h,B.lK,h,h,1/0);
    }
    var e=f[a0];
    if(!e)return B.au;
    var d=e.c,c=g.a,b=d==(c==null?h:c.a);
    function _checkImg(m){
      if(!m)return!1;
      if(m.status==="sending"||(m.a&&(typeof m.a==="string")&&(m.a.indexOf("optimistic-")===0||m.a.indexOf("uploading-")===0||m.a.indexOf("temp_")===0)))return!1;
      var t=m.d;if(t==="image")return!0;
      var c=(m.e||"").toLowerCase(),u=m.f||"";
      if(c.indexOf("data:image")===0||u.length>0)return!0;
      return c.indexOf(".jpg")!==-1||c.indexOf(".jpeg")!==-1||c.indexOf(".png")!==-1||c.indexOf(".webp")!==-1||c.indexOf(".gif")!==-1||c.indexOf(".jfif")!==-1||c.indexOf(".heic")!==-1||c.indexOf(".heif")!==-1||c.indexOf(".avif")!==-1||c.indexOf(".bmp")!==-1||c.indexOf("/chat-media/")!==-1||c.indexOf("/images/")!==-1;
    }
    if(_checkImg(e)){
      try{
        if(!e.y&&window.recordChatImage){window.recordChatImage(e.imageUrl||e.f||e.content||e.e,e.b);}
        if(a0>0&&f[a0-1]&&_checkImg(f[a0-1])&&f[a0-1].c===e.c){
          var _tPrev=(f[a0-1].as&&typeof f[a0-1].as.a==="number")?f[a0-1].as.a:0;
          var _tCur=(e.as&&typeof e.as.a==="number")?e.as.a:0;
          if(Math.abs(_tCur-_tPrev)<60000)return B.au;
        }
        var _cl=[e];
        for(var _ck=a0+1;_ck<f.length;_ck++){
          var _nxt=f[_ck];
          if(_nxt&&_checkImg(_nxt)&&_nxt.c===e.c){
            var _t1=(_cl[_cl.length-1].as&&typeof _cl[_cl.length-1].as.a==="number")?_cl[_cl.length-1].as.a:0;
            var _t2=(_nxt.as&&typeof _nxt.as.a==="number")?_nxt.as.a:0;
            if(Math.abs(_t2-_t1)<60000)_cl.push(_nxt);
            else break;
          }else break;
        }
        if(_cl.length>=2){
          var _tCurSafe=(e.as&&typeof e.as.a==="number")?e.as.a:Date.now();
          var _tPrevSafe=(a0>0&&f[a0-1]&&f[a0-1].as&&typeof f[a0-1].as.a==="number")?f[a0-1].as.a:_tCurSafe;
          if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,_tCurSafe-_tPrevSafe).a,6e7)>30;
          else s=!0;
          var gridWidget=null;
          try{gridWidget=$.buildPhotoDeckWidget(_cl,i.a,b,a,g);}catch(_err){gridWidget=null;}
          if(gridWidget){
            var p=b?B.ev:B.m;
            var o=A.b([],t.p);
            if(!b){
              var n=i.d.c,m=n!=null,l=h,k=h;
              if(m&&n.length!==0){n.toString;l=new A.eY(n,1,h);}
              if(!m||n.length===0){var ob=i.d.b;k=A.a2(ob.length!==0?ob[0].toUpperCase():"U",h,h,h,h,h,B.DV,h,h,h);}
              B.b.M(o,A.b([A.dr(h,A.hO(B.o,l,k,14),B.M,!1,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,new A.atQ(e,a),h,h,h,h,h,h,!1,B.ao),B.aT],t.p));
            }
            var kList=A.b([gridWidget],t.p);
            var j=e.Q;
            if(j&&typeof j.gbH==="function"&&j.gbH(j)&&!e.y){var dD=A.dD(j);kList.push(A.eG(-8,A.aK_(new A.hl(i.a.Qy(j,10,b),new A.e0("chat_reactions_"+dD,t.kK)),B.J,h,B.W,B.W,new A.atS()),h,h,h,-4,h,h));}
            var dList=A.b([A.dt(B.aF,kList,B.h,B.ap)],t.p);
            if(b){
              try{
                var _lastSent=a0+_cl.length-1===i.c;
                B.b.M(dList,A.b([B.cZ,i.a.aaZ(_cl[_cl.length-1],i.d,_lastSent)],t.p));
              }catch(_e){}
            }
            if(i.a._tsMsgIds&&i.a._tsMsgIds.has(e.a)){
              var _ms=(e.as&&typeof e.as.a==="number")?e.as.a:Date.now(),_v=new Date(_ms+252e5),_now=new Date(Date.now()+252e5);
              var _isToday=_v.getUTCFullYear()===_now.getUTCFullYear()&&_v.getUTCMonth()===_now.getUTCMonth()&&_v.getUTCDate()===_now.getUTCDate();
              var _hh=String(_v.getUTCHours()).padStart(2,"0"),_mm=String(_v.getUTCMinutes()).padStart(2,"0");
              var _timeStr=_hh+":"+_mm;
              if(!_isToday){_timeStr=String(_v.getUTCDate()).padStart(2,"0")+"/"+String(_v.getUTCMonth()+1).padStart(2,"0")+"/"+_v.getUTCFullYear()+", "+_hh+":"+_mm;}
              dList.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h));
            }
            var mAlign=b?B.dw:B.aS;
            o.push(new A.eT(1,B.bv,A.dr(h,A.bm(dList,mAlign,B.m,B.p),B.M,!1,h,new A.atT(g,e),new A.atU(i.a,a),h,h,h,h,h,new A.atV(i.a,a,e,g,b),h,h,h,h,h,h,h,h,h,h,new A.atW(i.a,a,e,g,b),h,new A.atTap(i.a,e),h,h,h,h,h,h,!1,B.ao),h));
            var cList=A.b([],t.p);
            if(s){
              var pt=e.as;
              cList.push(new A.bc(B.el,A.cn(A.a2((function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})(pt),h,h,h,h,h,B.Ec,h,h,h),h,h),h));
            }
            cList.push(new A.bc(B.lB,new A.Kp(A.b9(o,B.dw,p,B.p),new A.atX(g,e),h),h));
            return A.bm(cList,B.l,B.m,B.p);
          }
        }
      }catch(_errCl){
        console.error("Album clustering error, falling back:",_errCl);
      }
    }
    var _tCurSafe=(e.as&&typeof e.as.a==="number")?e.as.a:Date.now();
    var _tPrevSafe=(a0>0&&f[a0-1]&&f[a0-1].as&&typeof f[a0-1].as.a==="number")?f[a0-1].as.a:_tCurSafe;
    if(a0!==0)s=a0>0&&B.e.bf(A.cA(0,_tCurSafe-_tPrevSafe).a,6e7)>30;
    else s=!0;
    f=e.d;
    if(f==="system")return i.a.aba(e,i.d,c);
    r=(e.e&&typeof e.e==="string")?e.e.toLowerCase():"";
    d=!e.y;
    if(d)q=f==="call"||f==="missed_call"||f==="video_call"||B.c.p(r,"cu\\u1ed9c g\\u1ecdi")||B.c.p(r,"cuoc goi");
    else q=!1;
    if(q){
      f=t.p;
      d=A.b([],f);
      if(s){
        c=e.as;
        d.push(new A.bc(B.el,A.cn(A.a2((function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})(c),h,h,h,h,h,B.Ec,h,h,h),h,h),h));
      }
      c=b?B.ev:B.m;
      p=A.b([],f);
      if(!b){
        o=i.d;n=o.c;m=n!=null;
        if(m&&n.length!==0){n.toString;l=new A.eY(n,1,h);}else l=h;
        if(!m||n.length===0){o=o.b;o=A.a2(o.length!==0?o[0].toUpperCase():"U",h,h,h,h,h,B.DV,h,h,h);}else o=h;
        B.b.M(p,A.b([A.hO(B.o,l,o,14),B.aT],f));
      }
      p.push(new A.eT(1,B.bv,i.a.aaS(e,b,g),h));
      d.push(new A.bc(B.lB,A.b9(p,B.dw,c,B.p),h));
      return A.bm(d,B.l,B.m,B.p);
    }
    f=t.p;
    c=A.b([],f);
    if(s){
      p=e.as;
      c.push(new A.bc(B.el,A.cn(A.a2((function(_o){var _v=new Date((_o?_o.a:Date.now())+252e5);return String(_v.getUTCHours()).padStart(2,"0")+":"+String(_v.getUTCMinutes()).padStart(2,"0")})(p),h,h,h,h,h,B.Ec,h,h,h),h,h),h));
    }
    p=b?B.ev:B.m;
    o=A.b([],f);
    if(!b){
      n=i.d;m=n.c;l=m!=null;
      if(l&&m.length!==0){m.toString;k=new A.eY(m,1,h);}else k=h;
      if(!l||m.length===0){n=n.b;n=A.a2(n.length!==0?n[0].toUpperCase():"U",h,h,h,h,h,B.DV,h,h,h);}else n=h;
      B.b.M(o,A.b([A.dr(h,A.hO(B.o,k,n,14),B.M,!1,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,h,new A.atQ(e,a),h,h,h,h,h,h,!1,B.ao),B.aT],f));
    }
    n=i.a;
    m=b?B.dw:B.aS;
    l=i.d;
    k=A.b([new A.dL(new A.atR(n,e,b,i.e,g,l),h)],f);
    j=e.Q;
    if(j&&typeof j.gbH==="function"&&j.gbH(j)&&d){
      d=A.dD(j);
      k.push(A.eG(-8,A.aK_(new A.hl(n.Qy(j,10,b),new A.e0("chat_reactions_"+d,t.kK)),B.J,h,B.W,B.W,new A.atS()),h,h,h,-4,h,h));
    }
    d=A.b([A.dt(B.aF,k,B.h,B.ap)],f);
    if(b){
      try{
        B.b.M(d,A.b([B.cZ,n.aaZ(e,l,a0===i.c)],f));
      }catch(_ez){}
    }
    if(n._tsMsgIds&&n._tsMsgIds.has(e.a)){
      var _ms=(e.as&&typeof e.as.a==="number")?e.as.a:Date.now();
      var _v=new Date(_ms+252e5);
      var _now=new Date(Date.now()+252e5);
      var _isToday=_v.getUTCFullYear()===_now.getUTCFullYear()&&_v.getUTCMonth()===_now.getUTCMonth()&&_v.getUTCDate()===_now.getUTCDate();
      var _hh=String(_v.getUTCHours()).padStart(2,"0");
      var _mm=String(_v.getUTCMinutes()).padStart(2,"0");
      var _timeStr=_hh+":"+_mm;
      if(!_isToday){
        var _dd=String(_v.getUTCDate()).padStart(2,"0");
        var _mo=String(_v.getUTCMonth()+1).padStart(2,"0");
        var _yy=_v.getUTCFullYear();
        _timeStr=_dd+"/"+_mo+"/"+_yy+", "+_hh+":"+_mm;
      }
      d.push(new A.bc(B.i6,A.a2(_timeStr,h,h,h,h,h,B.Ec,h,h,h),h));
    }
    o.push(new A.eT(1,B.bv,A.dr(h,A.bm(d,m,B.m,B.p),B.M,!1,h,new A.atT(g,e),new A.atU(n,a),h,h,h,h,h,new A.atV(n,a,e,g,b),h,h,h,h,h,h,h,h,h,h,new A.atW(n,a,e,g,b),h,new A.atTap(n,e),h,h,h,h,h,h,!1,B.ao),h));
    c.push(new A.bc(B.lB,new A.Kp(A.b9(o,B.dw,p,B.p),new A.atX(g,e),h),h));
    return A.bm(c,B.l,B.m,B.p);
  }catch(errTop){
    console.error("🔥 [FATAL CHAT ITEM RENDER PREVENTED at index " + a0 + "]:", errTop);
    return B.au;
  }
},
$S:91}` + newline;

      content = content.slice(0, auStart) + newAuPrototype + content.slice(auEnd);
      patchCount++;
      console.log('  [+] Patched A.au_.prototype with bulletproof error boundaries and guards');
    }
  }

  // 4. PATCH A.atR.prototype ($1 message bubble Builder) with try/catch
  const atRStart = content.indexOf('A.atR.prototype={');
  if (atRStart !== -1) {
    const isCRLF = content.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';
    const atREnd = content.indexOf('A.atO.prototype={', atRStart);
    if (atREnd !== -1) {
      const origAtR = content.slice(atRStart, atREnd);
      const funcStart = origAtR.indexOf('$1(a1){');
      if (funcStart !== -1) {
        const atRInnerBody = origAtR.slice(funcStart + 7, origAtR.lastIndexOf('},'));
        const newAtR = `A.atR.prototype={
$1(a1){
  try{
    ${atRInnerBody}
  }catch(errAtR){
    console.error("🔥 [atR bubble render error]:", errAtR);
    return B.au;
  }
},
$S:108}` + newline;
        content = content.slice(0, atRStart) + newAtR + content.slice(atREnd);
        patchCount++;
        console.log('  [+] Patched A.atR.prototype with try/catch');
      }
    }
  }

  // 5. PATCH Optimistic Message creation in A.avr.a2L and A.av3.a2K
  // Ensure _optMsg has all complete fields
  const optMsgOldPatternLF = 'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\n_optMsg.status="sending";_optMsg.clientTempId=_optId;';
  const optMsgSafeReplacementLF = 'var _optMsg=new A.k1(_optId,q.b.a,_myUid,"image",_dUrl,_dUrl,null,false,false,false,null,B.akQ,new A.dN(Date.now(),!1));\n_optMsg.status="sending";_optMsg.clientTempId=_optId;_optMsg.isForwarded=false;_optMsg.isRecalled=false;_optMsg.reactions=B.akQ;_optMsg.imageUrl=_dUrl;_optMsg.content=_dUrl;';

  const optMsgOldPatternCRLF = optMsgOldPatternLF.replace(/\n/g, '\r\n');
  const optMsgSafeReplacementCRLF = optMsgSafeReplacementLF.replace(/\n/g, '\r\n');

  if (content.includes(optMsgOldPatternCRLF)) {
    content = content.split(optMsgOldPatternCRLF).join(optMsgSafeReplacementCRLF);
    patchCount++;
    console.log('  [+] Patched _optMsg complete property initialization (CRLF)');
  }
  if (content.includes(optMsgOldPatternLF)) {
    content = content.split(optMsgOldPatternLF).join(optMsgSafeReplacementLF);
    patchCount++;
    console.log('  [+] Patched _optMsg complete property initialization (LF)');
  }

  // 6. Save and verify syntax
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[SAVED] ${filePath} (${patchCount} patches applied).`);

  try {
    new vm.Script(content);
    console.log(`[PASS] Syntax check passed for: ${filePath}`);
  } catch (err) {
    console.error(`[FAIL] Syntax error in ${filePath}:`, err.message);
    process.exit(1);
  }
}

targetFiles.forEach(patchMainDartJs);
console.log('\n✅ Tất cả 4 file main.dart.js đã được vá chống biến mất tin nhắn tuyệt đối!');
