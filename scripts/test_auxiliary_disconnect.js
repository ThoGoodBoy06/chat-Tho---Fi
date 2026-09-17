const io = require('socket.io-client');
require('dotenv').config();

const socketHandler = require('../backend/sockets/socketHandler');
const http = require('http');
const { Server } = require('socket.io');

async function runTest() {
  console.log('🧪 BẮT ĐẦU TEST BẢO VỆ CUỘC GỌI KHI CÓ AUXILIARY SOCKET DISCONNECT...');

  const server = http.createServer();
  const socketIo = new Server(server, { cors: { origin: '*' } });
  socketHandler(socketIo);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER = `http://localhost:${port}`;
  console.log(`📡 Test server running on port ${port}`);

  const callerId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
  const calleeId = '9b21bd4e-657d-471d-b71d-147d9eacf64b';
  const convId = '09b60691-6512-491f-b5aa-1fbd851abb11';

  // 1. Caller A kết nối
  const socketCaller = io(SERVER, { transports: ['websocket'] });
  await new Promise((r) => socketCaller.on('connect', r));
  socketCaller.emit('user_connected', callerId);

  // 2. Callee B kết nối Socket 1 (Main tab)
  const socketCallee1 = io(SERVER, { transports: ['websocket'] });
  await new Promise((r) => socketCallee1.on('connect', r));
  socketCallee1.emit('user_connected', calleeId);

  // 3. Callee B kết nối Socket 2 (Auxiliary tab / previous session)
  const socketCallee2 = io(SERVER, { transports: ['websocket'] });
  await new Promise((r) => socketCallee2.on('connect', r));
  socketCallee2.emit('user_connected', calleeId);

  await new Promise((r) => setTimeout(r, 1200));

  let callerReceivedCallEnded = false;
  socketCaller.on('call_ended', (d) => {
    console.log('🔴 Caller nhận call_ended:', d);
    callerReceivedCallEnded = true;
  });

  let callee1Incoming = false;
  socketCallee1.on('incoming_call', (d) => {
    console.log('📞 Callee Socket 1 nhận incoming_call!');
    callee1Incoming = true;
  });

  // 4. Caller A bắt đầu gọi cho Callee B
  console.log('👉 Caller A gọi cho Callee B...');
  socketCaller.emit('request_call', {
    callerId,
    callerName: 'Caller A',
    callerAvatar: '',
    calleeId,
    callType: 'audio',
    conversationId: convId
  });

  await new Promise((r) => setTimeout(r, 800));

  if (!callee1Incoming) {
    throw new Error('❌ Callee không nhận được incoming_call!');
  }

  // 5. Ngắt kết nối socketCallee2 (tab phụ của Callee đóng hoặc mạng chập chờn)
  console.log('👉 Ngắt kết nối socketCallee2 (auxiliary socket của Callee)...');
  socketCallee2.disconnect();

  await new Promise((r) => setTimeout(r, 800));

  // Kiểm tra xem Caller A có bị ngắt oan không
  if (callerReceivedCallEnded) {
    console.error('❌ THẤT BẠI: Caller A bị tắt màn hình oan vì tab phụ của Callee ngắt kết nối!');
    process.exit(1);
  } else {
    console.log('✅ XUẤT SẮC: Caller A KHÔNG bị ngắt, cuộc gọi vẫn duy trì nguyên vẹn vì Callee vẫn còn Socket 1 online!');
  }

  // 6. Bây giờ đóng nốt Socket 1 của Callee -> Cuộc gọi phải kết thúc đàng hoàng
  console.log('👉 Đóng nốt Socket 1 của Callee (Callee hoàn toàn offline)...');
  socketCallee1.disconnect();

  await new Promise((r) => setTimeout(r, 800));

  if (callerReceivedCallEnded) {
    console.log('✅ XUẤT SẮC: Khi Callee ngắt toàn bộ kết nối, Caller nhận được call_ended chính xác!');
  } else {
    console.error('❌ Lỗi: Khi Callee ngắt hết kết nối, Caller không nhận được call_ended!');
    process.exit(1);
  }

  socketCaller.disconnect();
  server.close();
  console.log('🎉 TẤT CẢ CÁC BƯỚC TEST ĐÃ VƯỢT QUA 100%!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
