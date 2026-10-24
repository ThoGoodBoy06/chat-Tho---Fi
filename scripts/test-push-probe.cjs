const test=require('node:test'),assert=require('node:assert/strict');
const {createPushProbeService,installPushProbeRoutes}=require('../services/push_probe.service');
function fixture(send=async()=>({successCount:1})) {
 let time=100000,task;const sent=[];
 const service=createPushProbeService({send:async(...args)=>{sent.push(args);return send(...args);},receiptUrl:'https://api.test/api/users/push-receipt',
  now:()=>time,schedule:(fn,ms)=>{assert.equal(ms,15000);task=fn;}});
 return {service,sent,run:async()=>{time+=15000;await task();},advance:()=>{time+=600001;}};
}
test('test is delayed and targets only the authenticated installation',async()=>{
 const f=fixture(),p=f.service.start('owner','phone');
 assert.equal(f.sent.length,0);assert.equal(p.phase,'scheduled');assert(!('key' in p));
 assert.equal(f.service.start('owner','phone').testId,p.testId);
 await f.run();assert.equal(f.service.status('owner',p.testId).phase,'accepted');
 assert.equal(f.sent[0][0],'owner');assert.deepEqual(f.sent[0][5],{deviceId:'phone'});
 assert.equal(f.service.status('other',p.testId),null);
});
test('Firebase acceptance is distinct from worker receipt and OS display request',async()=>{
 const f=fixture(),p=f.service.start('owner','phone');await f.run();
 const data=f.sent[0][3];
 assert.equal(f.service.receive({testId:p.testId,key:'0'.repeat(48),notificationRequested:true}),false);
 assert.equal(f.service.receive({testId:p.testId,key:'é'.repeat(48),notificationRequested:true}),false);
 assert.equal(f.service.receive({testId:p.testId,key:data.pushProbeKey,notificationRequested:true}),true);
 const status=f.service.status('owner',p.testId);assert.equal(status.phase,'worker_received');assert.equal(status.notificationRequested,true);
 assert(!JSON.stringify(status).includes(data.pushProbeKey));
});
test('worker can report display denied and expired receipts cannot change status',async()=>{
 const f=fixture(),p=f.service.start('owner','phone');await f.run();const key=f.sent[0][3].pushProbeKey;
 f.service.receive({testId:p.testId,key,notificationRequested:false});
 assert.equal(f.service.status('owner',p.testId).notificationRequested,false);
 f.advance();assert.equal(f.service.receive({testId:p.testId,key}),false);assert.equal(f.service.status('owner',p.testId),null);
});
test('push failures are explicit, without claiming delivery',async()=>{
 for(const send of [async()=>({successCount:0}),async()=>{throw Error('FCM failure');}]) {
 const f=fixture(send),p=f.service.start('owner','phone');await f.run();assert.equal(f.service.status('owner',p.testId).phase,'send_failed');}
});
test('a fast receipt arriving before Firebase response is not overwritten',async()=>{
 let f;f=fixture(async(...args)=>{
  const d=args[3];f.service.receive({testId:d.pushProbeId,key:d.pushProbeKey,notificationRequested:true});return {successCount:1};
 });const p=f.service.start('owner','phone');await f.run();assert.equal(f.service.status('owner',p.testId).phase,'worker_received');
});
test('diagnostic routes reject unauthenticated requests and unregistered devices',async()=>{
 const routes=new Map();installPushProbeRoutes({post:(p,fn)=>routes.set(p,fn)},{jwt:{verify:()=>({id:'owner'})},prisma:{userDevices:{findMany:async()=>[]}},send:async()=>{},receiptUrl:'https://api.test/api/users/push-receipt'});
 let status,body;const res={status(n){status=n;return this;},json(b){body=b;},setHeader(){}};
 const start=routes.get('/api/users/test-push-background');
 await start({headers:{},body:{deviceId:'phone'}},res);assert.equal(status,401);
 await start({headers:{authorization:'Bearer value'},body:{deviceId:'phone'}},res);assert.equal(status,409);assert.equal(body.success,false);
 routes.get('/api/users/push-receipt')({body:{testId:'unknown',key:'0'.repeat(48)}},res);assert.equal(status,403);
});
