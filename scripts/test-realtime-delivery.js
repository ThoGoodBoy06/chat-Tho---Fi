const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../controllers/chat.controller.js'),'utf8');
function harness(member=true) {
  let releaseDevices;
  const events=[], steps=[];
  const devices=new Promise(resolve=>releaseDevices=resolve);
  const context={exports:{}, console:{log(){},error(){}}, uuidv4:()=> 'saved-id',
    clearConversationMessagesCache(){}, getApps:()=>[], BASE_HOST_URL:'https://backend.test', FRONTEND_URL:'https://frontend.test',
    prisma:{conversations:{findUnique:async()=>({type:'private',ConversationMembers:[{userId:member?'sender':'outsider'},{userId:'recipient'}]})},
      block:{findFirst:async()=>null},
      messages:{create:async({data})=>{steps.push('save');return {...data,createdAt:new Date(),Users:{id:'sender',fullName:'Sender'}};},
        updateMany:async()=>steps.push('read'),findUnique:async()=>null},
      conversationMembers:{findMany:()=>{steps.push('devices');return devices;}}}};
  const broadcast={to(room){events.push(['room',room]);return this;},emit(name,data){events.push([name,data]);steps.push('emit');}};
  const io={to(room){events.push(['room',room]);return broadcast;}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('exports.sendMessage ='), source.indexOf('exports.createConversation =')),context);
  let status,body;
  const res={headersSent:false,status(value){status=value;return this;},json(value){body=value;this.headersSent=true;steps.push('response');}};
  const req={user:{id:'sender'},params:{conversationId:'room'},body:{content:'Hello',type:'text',clientTempId:'optimistic-1'},app:{get:()=>io}};
  return {run:()=>context.exports.sendMessage(req,res),releaseDevices,events,steps,status:()=>status,body:()=>body};
}
test('saved message reaches recipient before any slow push-token lookup completes, exactly once',async()=>{
  const h=harness(); const pending=h.run();
  await new Promise(resolve=>setImmediate(resolve));
  const deliveries=h.events.filter(([name])=>name==='receive_message');
  assert.equal(deliveries.length,1,'Must deliver while device query remains unresolved');
  assert.equal(deliveries[0][1].clientTempId,'optimistic-1');
  assert.ok(h.events.some(([name,id])=>name==='room'&&id==='recipient'));
  assert.ok(h.steps.indexOf('emit')<h.steps.indexOf('devices'));
  assert.ok(h.steps.indexOf('emit')<h.steps.indexOf('read'));
  h.releaseDevices([]);await pending;
  assert.equal(h.events.filter(([name])=>name==='receive_message').length,1);
});
test('non-members receive no optimistic or saved broadcast from the REST send path',async()=>{
  const h=harness(false);await h.run();
  assert.equal(h.status(),403);
  assert.equal(h.events.length,0);
  assert.ok(!h.steps.includes('save'));
});
test('two separate websocket clients receive relay without waiting for the REST save', async t => {
  const {Server}=require('socket.io'), {io:connect}=require('socket.io-client');
  const server=require('node:http').createServer();
  const io=new Server(server);
  const relay=fs.readFileSync(require('node:path').join(__dirname,'../sockets/socketHandler.js'),'utf8');
  const relayStart=relay.indexOf('    socket.on("send_message"');
  const fragment=relay.slice(relayStart,relay.indexOf('    socket.on("typing"',relayStart));
  io.on('connection', socket=>{
    socket.userId=socket.handshake.auth.user;
    socket.join(socket.userId);
    const context={socket,io,console:{log(){},error(){}},clearConversationMessagesCache(){},
      prisma:{conversationMembers:{findMany:()=>{throw Error('Unexpected database dependency in relay');}}}};
    vm.createContext(context);vm.runInContext(fragment,context);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const sender=connect(url,{auth:{user:'sender'},transports:['websocket'],forceNew:true});
  const recipient=connect(url,{auth:{user:'recipient'},transports:['websocket'],forceNew:true});
  t.after(async()=>{sender.disconnect();recipient.disconnect();await new Promise(resolve=>io.close(resolve));});
  await Promise.all([sender,recipient].map(socket=>new Promise((resolve,reject)=>{
    socket.on('connect',resolve);socket.on('connect_error',reject);
  })));
  const started=performance.now();
  const received=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Realtime relay timed out')),2000);
    recipient.once('receive_message',message=>{clearTimeout(timeout);resolve(message);});
  });
  sender.emit('send_message',{conversationId:'room',tempId:'optimistic-websocket',content:'Instant test',type:'text',receiverId:'recipient'});
  const message=await received;
  assert.equal(message.content,'Instant test');
  assert.equal(message.clientTempId,'optimistic-websocket');
  assert.equal(message.senderId,'sender');
  t.diagnostic('Local two-client relay: '+(performance.now()-started).toFixed(1)+' ms; no production latency assertion.');
});
