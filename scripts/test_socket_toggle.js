const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const jwt = require('jsonwebtoken');

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
const token = jwt.sign({ userId, id: userId }, "supersecretkey_chat_tho_fi");

async function run() {
  const socket = io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket']
  });

  await new Promise((resolve) => socket.on('connect', resolve));
  socket.emit('user_connected', userId);
  console.log('Socket đã kết nối và đăng ký user_connected thành công:', socket.id);

  const testMsg = await p.messages.findFirst({
    where: { conversationId: '09b60691-6512-491f-b5aa-1fbd851abb11' },
    select: { id: true, conversationId: true, reactions: true }
  });

  socket.emit('join_conversation', testMsg.conversationId);
  await new Promise(r => setTimeout(r, 400));

  function emitReact(emoji, isRemoved) {
    return new Promise((resolve) => {
      const handler = (payload) => {
        if (payload.messageId === testMsg.id) {
          socket.off('message_reacted', handler);
          resolve(payload);
        }
      };
      socket.on('message_reacted', handler);
      socket.emit('react_message', {
        messageId: testMsg.id,
        conversationId: testMsg.conversationId,
        emoji,
        isRemoved
      });
    });
  }

  console.log('\n--- Socket TEST 1: Thả 👍 lần 1 ---');
  let res = await emitReact('👍', false);
  console.log('Socket payload 1 reactions:', JSON.stringify(res.reactions));
  console.log('isRemoved:', res.isRemoved);

  console.log('\n--- Socket TEST 2: Thả 👍 lần 2 (Hủy cảm xúc) ---');
  res = await emitReact('👍', true);
  console.log('Socket payload 2 reactions:', JSON.stringify(res.reactions));
  console.log('isRemoved:', res.isRemoved);

  console.log('\n--- Socket TEST 3: Thả lại 👍 không kèm isRemoved (tự động toggle) ---');
  res = await emitReact('👍', false);
  console.log('Socket payload 3 reactions:', JSON.stringify(res.reactions));

  console.log('\n--- Socket TEST 4: Thả tiếp 👍 không kèm isRemoved (tự động toggle off) ---');
  res = await emitReact('👍', true);
  console.log('Socket payload 4 reactions:', JSON.stringify(res.reactions));
  console.log('isRemoved:', res.isRemoved);

  socket.disconnect();
}

run().catch(console.error).finally(() => p.$disconnect());
