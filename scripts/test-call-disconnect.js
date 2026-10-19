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
 return {socket,seed,events,timers,calls:globals.activeCalls,expire(){for(const [id,t]of [...timers]){timers.delete(id);t.fn();}}};
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
