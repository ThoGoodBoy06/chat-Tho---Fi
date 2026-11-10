const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('flutter_frontend/web/index.html','utf8');
const extract=id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1].replaceAll('__APP_BUILD_VERSION__','1111111111111111');
function harness(){const events={},deleted=[],banners=[],scripts=[],reloads=[];let offline=false;
 const keys=[{url:'https://app.test/main.dart.js'},{url:'https://app.test/index.html'},{url:'https://app.test/assets/avatar.png'}];
 const cache={keys:async()=>keys,delete:async r=>deleted.push(r.url)};
 const sandbox={URL,AbortController,console,Date,Promise,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>{},
 location:{href:'https://app.test/',replace:url=>reloads.push(url)},navigator:{onLine:true},
 document:{hidden:false,getElementById:id=>banners.find(b=>b.id===id),createElement:()=>({style:{}}),
 body:{appendChild:el=>{if(el.src){scripts.push(el.src);el.onload();}else banners.push(el);}},addEventListener:(name,fn)=>events[name]=fn},
 caches:{keys:async()=>['chat-thofi-assets-old','private-chat-cache'],open:async()=>cache},
 fetch:async()=>{if(offline)throw Error('Offline');return {ok:true,json:async()=>({version:'2222222222222222'})};}};
 sandbox.window={...sandbox,addEventListener:(name,fn)=>events[name]=fn};return {sandbox,events,deleted,banners,reloads,setOffline:()=>offline=true};}
(async()=>{
 const h=harness();vm.runInNewContext(extract('app-update-manager'),h.sandbox);await h.events.pageshow();
 assert.equal(h.banners.length,1);await h.banners[0].onclick();assert.equal(h.reloads.length,1);
 assert(h.reloads[0].includes('2222222222222222'));assert.deepEqual(h.deleted,['https://app.test/main.dart.js','https://app.test/index.html']);
 const o=harness();vm.runInNewContext(extract('app-update-manager'),o.sandbox);await o.events.pageshow();o.setOffline();await o.banners[0].onclick();assert.equal(o.deleted.length,0);assert.equal(o.reloads.length,0);assert.equal(o.banners[0].disabled,false);
 const slow=harness();slow.sandbox.setTimeout=setTimeout;slow.sandbox.clearTimeout=clearTimeout;
 slow.sandbox.fetch=(_,options)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve({ok:true,json:async()=>({version:'1111111111111111'})}),1100);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('aborted'));});});
 const done=vm.runInNewContext(extract('app-code-loader'),slow.sandbox);await done;assert(slow.deleted.includes('https://app.test/main.dart.js'));
 console.log('Passed: update banner, scoped code refresh, offline retry, slow-network stale-code cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
