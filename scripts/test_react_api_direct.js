const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

async function reactViaHttp(messageId, reaction) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ reaction });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/chat/messages/${encodeURIComponent(messageId)}/react`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const targetImgMsgId = 'c10d92ba-ae8a-497c-9d76-e3b1a5bb28a2';
  console.log(`[TEST 1] Gọi API /react với icon ❤️ vào tin nhắn ảnh ${targetImgMsgId}...`);
  const res1 = await reactViaHttp(targetImgMsgId, '❤️');
  console.log('API response 1:', JSON.stringify(res1));

  let dbMsg = await p.messages.findUnique({ where: { id: targetImgMsgId }, select: { id: true, reactions: true } });
  console.log('DB message reactions sau khi thả ❤️:', dbMsg.reactions);

  console.log(`\n[TEST 2] Gọi API /react đổi sang icon 😆...`);
  const res2 = await reactViaHttp(targetImgMsgId, '😆');
  console.log('API response 2:', JSON.stringify(res2));

  dbMsg = await p.messages.findUnique({ where: { id: targetImgMsgId }, select: { id: true, reactions: true } });
  console.log('DB message reactions sau khi đổi 😆:', dbMsg.reactions);

  console.log(`\n[TEST 3] Gọi API /react với tin nhắn text thông thường (6d29a7aa-9ade-46c3-bd26-9298b26dfc44)...`);
  const textMsgId = '6d29a7aa-9ade-46c3-bd26-9298b26dfc44';
  const res3 = await reactViaHttp(textMsgId, '👍');
  console.log('API response 3:', JSON.stringify(res3));

  dbMsg = await p.messages.findUnique({ where: { id: textMsgId }, select: { id: true, reactions: true } });
  console.log('DB text message reactions:', dbMsg.reactions);
}

run().catch(console.error).finally(() => p.$disconnect());
