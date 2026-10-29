const {test}=require('node:test'),assert=require('assert/strict');
const {createIceConfigResolver}=require('../services/webrtc-config');
test('provider credentials are coalesced and API key stays server-side',async()=>{
 let requests=0;const env={METERED_TURN_DOMAIN:'fixture.metered.live',METERED_TURN_API_KEY:'test-private'};
 const resolve=createIceConfigResolver({env,fetchImpl:async()=>{requests++;await new Promise(r=>setImmediate(r));return new Response(JSON.stringify([{urls:'turns:relay.example:443',username:'u',credential:'p'}]))}});
 const [one,two]=await Promise.all([resolve('a'),resolve('b')]);assert.equal(requests,1);assert(one.relayConfigured&&two.relayConfigured);assert(!JSON.stringify(one).includes('test-private'));await resolve('c');assert.equal(requests,1);
});
test('no credentials or failed provider cannot report configured TURN',async()=>{
 const no=await createIceConfigResolver({env:{}})('u');assert.equal(no.relayConfigured,false);
 const down=await createIceConfigResolver({env:{METERED_TURN_DOMAIN:'fixture.metered.live',METERED_TURN_API_KEY:'secret'},fetchImpl:async()=>new Response('{}',{status:403})})('u');assert.equal(down.relayConfigured,false);
 let fetched=false;await createIceConfigResolver({env:{METERED_TURN_DOMAIN:'127.0.0.1',METERED_TURN_API_KEY:'secret'},fetchImpl:()=>{fetched=true}})('u');assert.equal(fetched,false);
});
