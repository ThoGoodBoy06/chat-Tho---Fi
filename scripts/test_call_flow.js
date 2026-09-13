const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';

async function testCallFlow() {
  console.log('Testing call flow via Socket.IO...');
  
  // Minh Khang (efe1bee5-f9df-46ce-83b6-50127a2334bd)
  // Thanh Tho (9b21bd4e-657d-471d-b71d-147d9eacf64b)
  const callerId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
  const calleeId = '9b21bd4e-657d-471d-b71d-147d9eacf64b';
  const convId = '09b60691-6512-491f-b5aa-1fbd851abb11';

  const socketA = io(SERVER, { transports: ['websocket'] });
  const socketB = io(SERVER, { transports: ['websocket'] });

  await new Promise(r => socketA.on('connect', r));
  await new Promise(r => socketB.on('connect', r));

  console.log('Sockets connected!');
  socketA.emit('user_connected', callerId);
  socketB.emit('user_connected', calleeId);

  await new Promise(r => setTimeout(r, 500));

  let incomingReceived = null;
  socketB.on('incoming_call', (data) => {
    console.log('📞 [Callee B] Received incoming_call:', data);
    incomingReceived = data;
  });

  let callEndedReceived = null;
  socketB.on('call_ended', (data) => {
    console.log('🔴 [Callee B] Received call_ended:', data);
    callEndedReceived = data;
  });

  let callerCallEndedReceived = null;
  socketA.on('call_ended', (data) => {
    console.log('🔴 [Caller A] Received call_ended:', data);
    callerCallEndedReceived = data;
  });

  console.log('Step 1: Caller A calls Callee B...');
  socketA.emit('request_call', {
    callerId: callerId,
    callerName: 'Minh Khang',
    callerAvatar: '',
    calleeId: calleeId,
    callType: 'audio',
    conversationId: convId
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log('Step 2: Caller A ends call early...');
  socketA.emit('end_call', {
    connectedUserId: calleeId,
    conversationId: convId
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log('Result:');
  console.log('Incoming call received by Callee B:', !!incomingReceived);
  console.log('Call ended received by Callee B:', !!callEndedReceived);
  console.log('Call ended received by Caller A:', !!callerCallEndedReceived);

  socketA.disconnect();
  socketB.disconnect();
  process.exit(0);
}

testCallFlow().catch(console.error);
