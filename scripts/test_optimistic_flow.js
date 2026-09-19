// Test A.a7R logic for both orders:
// Scenario A: Socket arrives first, then HTTP
// Scenario B: HTTP arrives first, then Socket

const myUid = 'user-1';
const convId = 'conv-1';

const cleanA7r = {
  check(a, currentTarget) {
    var s = currentTarget;
    if (a.c != s.c) return false;
    if (a.e === s.e) return true;
    if (s.clientTempId && a.clientTempId && s.clientTempId === a.clientTempId) return true;
    if (a.b === s.b && a.d === s.d && (a.status === 'sending' || (typeof a.a === 'string' && a.a.indexOf('optimistic-') === 0))) {
      return true;
    }
    return false;
  }
};

console.log('--- SCENARIO A: Socket arrives first, then HTTP ---');
{
  const messages = [];
  const optId = 'optimistic-1';
  messages.push({
    a: optId,
    b: convId,
    c: myUid,
    d: 'image',
    e: 'data:image/jpeg;base64,abc',
    status: 'sending',
    clientTempId: optId
  });

  const realMsg = {
    a: 'uuid-1',
    b: convId,
    c: myUid,
    d: 'image',
    e: 'https://storage/photo1.jpg',
    status: 'sent'
  };

  // Socket arrives
  const idx = messages.findIndex(m => cleanA7r.check(m, realMsg));
  if (idx !== -1) messages[idx] = realMsg;
  else messages.push(realMsg);

  // HTTP arrives
  let fIdx = messages.findIndex(m => m && (m.a === optId || m.clientTempId === optId));
  if (fIdx !== -1) messages[fIdx] = realMsg;
  else if (!messages.some(m => m && m.a === realMsg.a)) messages.push(realMsg);

  console.log('Result A count:', messages.length, 'status:', messages[0].status);
  if (messages.length !== 1 || messages[0].a !== 'uuid-1' || messages[0].status !== 'sent') {
    throw new Error('Scenario A failed');
  }
}

console.log('--- SCENARIO B: HTTP arrives first, then Socket ---');
{
  const messages = [];
  const optId = 'optimistic-2';
  messages.push({
    a: optId,
    b: convId,
    c: myUid,
    d: 'image',
    e: 'data:image/jpeg;base64,abc',
    status: 'sending',
    clientTempId: optId
  });

  const realMsg = {
    a: 'uuid-2',
    b: convId,
    c: myUid,
    d: 'image',
    e: 'https://storage/photo2.jpg',
    status: 'sent'
  };

  // HTTP arrives first
  let fIdx = messages.findIndex(m => m && (m.a === optId || m.clientTempId === optId));
  if (fIdx !== -1) messages[fIdx] = realMsg;
  else if (!messages.some(m => m && m.a === realMsg.a)) messages.push(realMsg);

  // Socket arrives second
  // In vZ: it checks a7Q (id === id) first!
  const byId = messages.findIndex(m => m.a === realMsg.a);
  if (byId !== -1) {
    messages[byId] = realMsg;
  } else {
    const idx = messages.findIndex(m => cleanA7r.check(m, realMsg));
    if (idx !== -1) messages[idx] = realMsg;
    else messages.push(realMsg);
  }

  console.log('Result B count:', messages.length, 'status:', messages[0].status);
  if (messages.length !== 1 || messages[0].a !== 'uuid-2' || messages[0].status !== 'sent') {
    throw new Error('Scenario B failed');
  }
}

console.log('🎉 ALL SCENARIOS PASSED PERFECTLY!');
