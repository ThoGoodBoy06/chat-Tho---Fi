const {randomBytes, timingSafeEqual} = require('node:crypto');

// Short-lived, device-scoped diagnostic state. No message bodies, FCM tokens or
// subscriptions are retained. A server restart makes the probe explicitly expire.
function createPushProbeService({send, receiptUrl, now = Date.now, schedule = setTimeout}) {
  const probes = new Map();
  function prune() {for (const [id,p] of probes) if (p.expiresAt < now()) probes.delete(id);}
  function status(userId, id) {
    prune(); const p=probes.get(id);
    if (!p || p.userId!==userId) return null;
    return {testId:id, phase:p.phase, sendAt:p.sendAt, receivedAt:p.receivedAt || null,
      notificationRequested:p.notificationRequested ?? null, expiresAt:p.expiresAt};
  }
  function start(userId, deviceId) {
    prune();
    for (const [id,p] of probes) if(p.userId===userId && p.deviceId===deviceId && p.phase==='scheduled') return status(userId,id);
    if (probes.size>=500) throw Error('Có quá nhiều lượt thử. Hãy thử lại sau.');
    const id=randomBytes(18).toString('hex'), key=randomBytes(24).toString('hex');
    const p={userId,deviceId,key,phase:'scheduled',sendAt:now()+15000,expiresAt:now()+600000};
    probes.set(id,p);
    schedule(async()=>{
      if(probes.get(id)!==p || p.expiresAt<now()) return;
      p.phase='sending';
      try {
        const result=await send(userId,'Chat Tho-Fi — thử thông báo nền',
          'Thông báo này được gửi khi bạn đã khóa màn hình hoặc đóng app.',
          {type:'test_notification',pushProbeId:id,pushProbeKey:key,pushProbeUrl:receiptUrl},false,{deviceId});
        if(!p.receivedAt) p.phase=result?.successCount>0?'accepted':'send_failed';
      } catch (_) {if(!p.receivedAt) p.phase='send_failed';}
    },15000);
    return status(userId,id);
  }
  function receive({testId,key,notificationRequested}) {
    prune(); const p=probes.get(testId);
    if(!p || typeof key!=='string' || !/^[a-f0-9]{48}$/.test(key) ||
      !timingSafeEqual(Buffer.from(key),Buffer.from(p.key))) return false;
    if(p.receivedAt) return true;
    p.receivedAt=now(); p.notificationRequested=notificationRequested===true;
    p.phase='worker_received'; return true;
  }
  return {start,status,receive};
}

function installPushProbeRoutes(app,{jwt,prisma,send,receiptUrl}) {
  const probes=createPushProbeService({send,receiptUrl});
  function owner(req) {
    const value=req.headers.authorization;
    if(!value?.startsWith('Bearer ')) throw Error('Unauthorized');
    const user=jwt.verify(value.slice(7),process.env.JWT_SECRET);
    if(!user.id) throw Error('Unauthorized'); return user.id;
  }
  app.post('/api/users/test-push-background',async(req,res)=>{
    let userId;try{userId=owner(req);}catch(_){return res.status(401).json({success:false,message:'Bạn cần đăng nhập lại.'});}
    const deviceId=req.body?.deviceId;
    if(typeof deviceId!=='string' || !deviceId || deviceId.length>200) return res.status(400).json({success:false,message:'Thiếu mã thiết bị.'});
    try {
      const devices=await prisma.userDevices.findMany({where:{userId,deviceId},select:{id:true},take:1});
      if(!devices.length) return res.status(409).json({success:false,message:'Thiết bị này chưa đăng ký. Bấm Bật/Làm mới đăng ký thông báo trước.'});
      res.json({success:true,...probes.start(userId,deviceId)});
    }catch(_){res.status(503).json({success:false,message:'Chưa tạo được lượt thử thông báo nền.'});}
  });
  app.post('/api/users/test-push-background/status',(req,res)=>{
    let userId;try{userId=owner(req);}catch(_){return res.status(401).json({success:false,message:'Bạn cần đăng nhập lại.'});}
    const result=probes.status(userId,req.body?.testId);
    if(!result)return res.status(404).json({success:false,message:'Lượt thử đã hết hạn hoặc máy chủ vừa khởi động lại. Hãy tạo lượt thử mới.'});
    res.setHeader('Cache-Control','no-store');res.json({success:true,...result});
  });
  app.post('/api/users/push-receipt',(req,res)=>{
    if(!probes.receive(req.body || {}))return res.status(403).json({success:false});
    res.setHeader('Cache-Control','no-store');res.json({success:true});
  });
}
module.exports={createPushProbeService,installPushProbeRoutes};
