const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping non-existent file: ${file}`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. Remove s.kT(!1) from avk.prototype (friend request listener)
  const avkTarget = /r\.vu\(\)\r?\n\s*try\{r=r\.c\r?\n\s*r\.toString\r?\n\s*s=A\.c3\(r,!1,t\.c\)\r?\n\s*s\.kT\(!1\)\}catch\(p\)\{\}/g;
  if (avkTarget.test(content)) {
    content = content.replace(avkTarget, 'r.vu()/* no redundant fetchConversations */');
    modified = true;
    console.log(`[1] Patched avk.prototype in ${path.basename(file)}`);
  } else {
    console.log(`[1] avkTarget pattern not matched directly in ${path.basename(file)}`);
  }

  // 2. Remove A.tw(h.a) from case 7 in atD (kT) to stop SocketService.connect ping-pong loop
  const twTarget = /case 7:h=n\.a\r?\n\s*if\(h!=null&&h\.a\.length!==0\)A\.tw\(h\.a\)\r?\n\s*s=9/g;
  if (twTarget.test(content)) {
    content = content.replace(twTarget, 'case 7:h=n.a\r\ns=9');
    modified = true;
    console.log(`[2] Removed A.tw(h.a) from case 7 in ${path.basename(file)}`);
  } else {
    console.log(`[2] twTarget pattern not matched directly in ${path.basename(file)}`);
  }

  // 3. Add debounce guard to atD
  const atdTarget = /atD\(a\)\{var s=0,r=A\.x\(t\.H\),q=1,p,o=\[\],n=this,m,l,k,j,i,h,g,f/g;
  if (atdTarget.test(content)) {
    content = content.replace(atdTarget, 'atD(a){var _now=Date.now();if(this._isFetching||(this._lastFetch&&_now-this._lastFetch<2500))return A.v(null,A.x(t.H));this._lastFetch=_now;this._isFetching=true;var s=0,r=A.x(t.H),q=1,p,o=[],n=this,m,l,k,j,i,h,g,f');
    modified = true;
    console.log(`[3] Added debounce to atD in ${path.basename(file)}`);
  } else {
    console.log(`[3] atdTarget pattern not matched directly in ${path.basename(file)}`);
  }

  // 4. Release _isFetching in finally of atD
  const finallyTarget = /case 4:q=1\r?\n\s*n\.e=!1\r?\n\s*n\.V\(\)/g;
  if (finallyTarget.test(content)) {
    content = content.replace(finallyTarget, 'case 4:q=1\r\nn._isFetching=false\r\nn.e=!1\r\nn.V()');
    modified = true;
    console.log(`[4] Added _isFetching=false in finally of ${path.basename(file)}`);
  } else {
    console.log(`[4] finallyTarget pattern not matched directly in ${path.basename(file)}`);
  }

  // 5. Ensure conversations list n.b NEVER vanishes if previously loaded
  const parseTarget = /var _parsed=A\.ae\(h,!0,h\.\$ti\.i\("aK\.E"\)\);if\(_parsed\.length!==0\|\|n\.b\.length===0\)n\.b=_parsed;/g;
  if (parseTarget.test(content)) {
    content = content.replace(parseTarget, 'var _parsed=A.ae(h,!0,h.$ti.i("aK.E"));if(_parsed&&_parsed.length>0){n.b=_parsed;}else if(n.b.length===0){n.b=[];}');
    modified = true;
    console.log(`[5] Protected n.b against empty overwrite in ${path.basename(file)}`);
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Successfully saved patched ${file}`);
  }
});
