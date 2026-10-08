const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../controllers/chat.controller.js'),'utf8');
const start=source.indexOf('exports.changeConversationTheme = async (req, res) => {');
function fixture(member=true){
  const events=[],updates=[],messages=[];
  const conv={id:'room',theme:'classic',conversation_members:[{userId:member?'me':'other'},{userId:'partner'}]};
  const io={to(rooms){this.rooms=rooms;return this;},emit(name,data){events.push({rooms:this.rooms,name,data});}};
  const context={exports:{},console,conversationsCache:new Map(),uuidv4:()=> 'system-id',prisma:{
    conversations:{findUnique:async()=>conv,update:async args=>{updates.push(args);conv.theme=args.data.theme;}},
    users:{findUnique:async()=>({fullName:'Me'})},messages:{create:async args=>{messages.push(args);return {...args.data,Users:{id:'me',fullName:'Me'}};}}
  }};
  vm.runInNewContext(source.slice(start,source.indexOf('\n};',start)+4),context);
  let status=200,body;
  const res={status(n){status=n;return this;},json(x){body=x;return this;}};
  return {events,updates,messages,status:()=>status,body:()=>body,run:theme=>context.exports.changeConversationTheme({params:{conversationId:'room'},body:{theme},user:{id:'me'},app:{get:()=>io}},res)};
}
test('theme reaches all member sessions and creates exactly one system message per actual change',async()=>{
  const f=fixture();await f.run('ocean');assert.equal(f.body().success,true);
  const event=f.events.find(e=>e.name==='conversation_theme_updated');assert.ok(event.rooms.includes('partner'));assert.ok(event.rooms.includes('me'));
  await f.run('ocean');assert.equal(f.updates.length,1);assert.equal(f.messages.length,1);
  await f.run('love');assert.equal(f.messages.length,2);
});
test('non-members cannot write or broadcast chat themes',async()=>{
  const f=fixture(false);await f.run('sunset');assert.equal(f.status(),403);assert.equal(f.updates.length,0);assert.equal(f.events.length,0);
});
test('unknown themes are rejected instead of silently resetting to classic',async()=>{
  const f=fixture();await f.run('unknown');assert.equal(f.status(),400);assert.equal(f.updates.length,0);
});
