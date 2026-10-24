const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../sockets/socketHandler.js'),'utf8');
function fixture(){
 const events=[],timers=new Map();let sequence=0,connect;
 const rooms=new Map();
 const io={sockets:{adapter:{rooms}},on(name,fn){if(name==='connection')connect=fn;},emit(){},to(room){return {emit:(name,data)=>events.push({room,name,data})};}};
 const prisma={block:{findFirst:async()=>null},conversationMembers:{findMany:async()=>[]},friendRequests:{findMany:async()=>[]},users:{findUnique:async()=>null}};
 const globals={};
 const sandbox={module:{exports:{}},global:globals,process:{env:{}},console:{log(){},warn(){},error(){}},setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},require(name){
  if(name==='../prisma')return prisma;
  if(name==='uuid')return {v4:()=> 'test'};
  if(name==='jsonwebtoken')return {};
  if(name==='../controllers/chat.controller')return {sendPushNotification:async()=>{},clearConversationMessagesCache(){}};
  if(name==='../services/call-disconnect-grace')return require('../services/call-disconnect-grace');
  throw Error('Unexpected dependency '+name);
 }};
 vm.runInNewContext(source,sandbox);sandbox.module.exports(io);
 async function socket(id,user){const handlers={};const socket={id,handshake:{auth:{},query:{}},on(name,fn){handlers[name]=fn;},emit(name,data){events.push({room:id,name,data});},join(room){const members=rooms.get(room)||new Set();members.add(id);rooms.set(room,members);},to:io.to};await connect(socket);handlers.user_connected(user);return {socket,handlers,disconnect(){rooms.get(user)?.delete(id);handlers.disconnect();}};}
 function seed(){globals.activeCalls.set('a',{partnerId:'b',conversationId:'room',isAccepted:true,socketId:'a1'});globals.activeCalls.set('b',{partnerId:'a',conversationId:'room',isAccepted:true,socketId:'b1'});}
 return {socket,seed,events,timers,prisma,globals,calls:globals.activeCalls,expire(){for(const [id,t]of [...timers]){timers.delete(id);t.fn();}}};
}
test('temporary mobile disconnect retains an accepted call and reconnect cancels expiry',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');f.seed();a.disconnect();
 assert.equal(f.events.length,0);assert(f.calls.has('a'));assert.equal([...f.timers.values()][0].delay,15000);
 await f.socket('a2','a');f.expire();assert(f.calls.has('a'));assert(f.calls.has('b'));assert.equal(f.calls.get('a').socketId,'a2');assert.equal(f.events.length,0);
});
test('a genuinely lost connection ends only after the grace period',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');f.seed();a.disconnect();assert.equal(f.events.length,0);
 f.expire();assert.equal(f.calls.size,0);assert.equal(f.events.filter(e=>e.name==='call_ended').length,1);assert.equal(f.events[0].room,'b');
});
test('an old disconnect timer cannot terminate a replacement call',async()=>{
 const f=fixture(),a=await f.socket('a1','a');f.seed();a.disconnect();f.calls.set('a',{partnerId:'c',socketId:'a3'});f.expire();assert.equal(f.calls.get('a').partnerId,'c');assert.equal(f.events.length,0);
});
test('disconnecting another tab does not terminate the active call',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('a2','a');f.seed();a.disconnect();f.expire();assert(f.calls.has('a'));assert.equal(f.events.length,0);
});

test('a third caller gets busy without changing the existing pair',async()=>{
 const f=fixture();await f.socket('a1','a');await f.socket('b1','b');const c=await f.socket('c1','c');f.seed();
 await c.handlers.request_call({callerId:'c',calleeId:'b',conversationId:'other'});
 assert.equal(f.calls.get('a').partnerId,'b');assert.equal(f.calls.get('b').partnerId,'a');
 assert(f.events.some(e=>e.room==='c1'&&e.name==='call_rejected'&&e.data.reason==='busy'));
});
test('a duplicate request does not reject or replace the accepted call',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');f.seed();const original=f.calls.get('a');
 await a.handlers.request_call({callerId:'a',calleeId:'b',conversationId:'room'});
 assert.equal(f.calls.get('a'),original);assert.equal(f.events.length,0);
});

test('simultaneous callers cannot overwrite the pair reserved after async checks',async()=>{
 const f=fixture(),a=await f.socket('a1','a'),c=await f.socket('c1','c');await f.socket('b1','b');
 await Promise.all([a.handlers.request_call({callerId:'a',calleeId:'b'}),c.handlers.request_call({callerId:'c',calleeId:'b'})]);
 const partner=f.calls.get('b').partnerId;
 assert(['a','c'].includes(partner));assert.equal(f.calls.get(partner).partnerId,'b');assert.equal(f.calls.size,2);
 assert.equal(f.events.filter(e=>e.name==='incoming_call').length,1);
 assert.equal(f.events.filter(e=>e.name==='call_rejected').length,1);
});
test('stale end, reject and accept events cannot alter the current call',async()=>{
 const f=fixture(),a=await f.socket('a1','a'),b=await f.socket('b1','b');f.seed();f.calls.get('a').callId='current';f.calls.get('b').callId='current';
 await a.handlers.end_call({connectedUserId:'b',callId:'old'});
 await b.handlers.reject_call({callerId:'a',callId:'old'});
 await b.handlers.accept_call({callerId:'a',callId:'old'});
 assert.equal(f.calls.size,2);assert.equal(f.calls.get('a').callId,'current');assert.equal(f.events.length,0);
});
test('a current SDP is tagged and stale SDP is not relayed',async()=>{
 const f=fixture(),a=await f.socket('a1','a');f.seed();f.calls.get('a').callId='current';
 a.handlers.webrtc_signal({connectedUserId:'b',callId:'old',signal:{type:'offer'}});assert.equal(f.events.length,0);
 a.handlers.webrtc_signal({connectedUserId:'b',callId:'current',signal:{type:'offer'}});assert.equal(f.events[0].data.callId,'current');
});
test('cancellation during a database check cannot revive a ghost call',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');
 let finish;f.prisma.block.findFirst=()=>new Promise(r=>{finish=r;});
 const request=a.handlers.request_call({callerId:'a',calleeId:'b',callId:'cancelled'});
 assert.equal(f.calls.size,2);
 await a.handlers.end_call({connectedUserId:'b',callId:'cancelled'});
 finish(null);await request;
 assert.equal(f.calls.size,0);assert(!f.events.some(e=>e.name==='incoming_call'));
});
test('push token lookup does not delay ringing or acceptance acknowledgement',async()=>{
 const f=fixture(),a=await f.socket('a1','a'),b=await f.socket('b1','b');
 let finish;f.prisma.users.findUnique=()=>new Promise(r=>{finish=r;});
 await a.handlers.request_call({callerId:'a',calleeId:'b',callId:'fast-answer'});
 assert(f.events.some(e=>e.name==='incoming_call'));
 let ack;await b.handlers.accept_call({callerId:'a',callId:'fast-answer'},data=>{ack=data;});
 assert.equal(ack.ok,true);assert(f.calls.get('b').isAccepted);finish(null);
});
test('an expired accept is acknowledged and another tab cannot reject an answered call',async()=>{
 const f=fixture();const b=await f.socket('b1','b');let ack;
 await b.handlers.accept_call({callerId:'a',callId:'missing'},data=>{ack=data;});assert.equal(ack.reason,'expired');
 f.seed();f.calls.get('a').callId='current';f.calls.get('b').callId='current';
 const other=await f.socket('b2','b');
 await other.handlers.reject_call({callerId:'a',callId:'current'});
 await other.handlers.accept_call({callerId:'a',callId:'current'},data=>{ack=data;});
 assert.equal(ack.reason,'answered_elsewhere');assert.equal(f.calls.size,2);
});
test('SDP is retained during a mobile disconnect and replayed once on reconnect',async()=>{
 const f=fixture(),a=await f.socket('a1','a'),b=await f.socket('b1','b');f.seed();
 f.calls.get('a').callId='current';f.calls.get('b').callId='current';b.disconnect();
 a.handlers.webrtc_signal({connectedUserId:'b',callId:'current',signal:{type:'offer',sdp:'test'}});
 await f.socket('b2','b');
 assert.equal(f.events.filter(e=>e.room==='b2'&&e.name==='webrtc_signal').length,1);
 await f.socket('b3','b');assert.equal(f.events.filter(e=>e.room==='b3'&&e.name==='webrtc_signal').length,0);
});
test('late asynchronous hangup cleanup does not delete a replacement session',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');f.seed();
 let finish;f.prisma.users.findUnique=()=>new Promise(r=>{finish=r;});
 const ending=a.handlers.end_call({connectedUserId:'b'});
 f.calls.set('a',{partnerId:'c',callId:'new'});f.calls.set('c',{partnerId:'a',callId:'new'});
 finish(null);await ending;assert.equal(f.calls.get('a').callId,'new');assert.equal(f.calls.get('c').callId,'new');
});
test('mobile reconnect while the block check is pending preserves the reserved call',async()=>{
 const f=fixture(),a=await f.socket('a1','a');await f.socket('b1','b');
 let finish;f.prisma.block.findFirst=()=>new Promise(r=>{finish=r;});
 const request=a.handlers.request_call({callerId:'a',calleeId:'b',callId:'reconnect'});
 a.disconnect();await f.socket('a2','a');finish(null);await request;
 assert(f.events.some(e=>e.name==='incoming_call'));assert.equal(f.calls.get('a').socketId,'a2');
 assert.equal(f.calls.get('b').ready,true);
});
