const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../controllers/chat.controller.js'),'utf8');
function fixture(member=true,empty=false) {
  const events=[],updates=[];
  const io={to(room){events.push(['room',room]);return this;},emit(name,data){events.push([name,data]);}};
  const context={exports:{},console,prisma:{
    conversationMembers:{findMany:async()=>[{userId:member?'reader':'outsider'},{userId:'sender'}]},
    messages:{findFirst:async()=>empty?null:({id:'latest',createdAt:new Date('2026-01-01T00:00:01Z')}),updateMany:async value=>updates.push(value)}}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('exports.markAsRead ='),source.indexOf('exports.markAsDelivered =')),context);
  let status=200,body;
  const res={status(code){status=code;return this;},json(value){body=value;}};
  return {run:()=>context.exports.markAsRead({user:{id:'reader'},params:{conversationId:'room'},app:{get:()=>io}},res),
    events,updates,status:()=>status,body:()=>body};
}
test('HTTP read fallback broadcasts a bounded read receipt to the sender',async()=>{
  const f=fixture();await f.run();
  assert.equal(f.body().success,true);
  const event=f.events.find(([name])=>name==='messages_read')[1];
  assert.equal(event.readBy,'reader');assert.equal(event.lastReadMessageId,'latest');
  assert.ok(f.events.some(([name,id])=>name==='room'&&id==='sender'));
  assert.equal(f.updates[0].data.isDelivered,true);
  assert.equal(f.updates[0].where.createdAt.lte.toISOString(),'2026-01-01T00:00:01.000Z');
});
test('non-members cannot publish read receipts',async()=>{
  const f=fixture(false);await f.run();assert.equal(f.status(),403);
  assert.equal(f.events.length,0);assert.equal(f.updates.length,0);
});
test('empty history cannot mark a message arriving later as already read',async()=>{
  const f=fixture(true,true);await f.run();
  assert.equal(f.updates.length,0);assert.equal(f.events.length,0);
});
