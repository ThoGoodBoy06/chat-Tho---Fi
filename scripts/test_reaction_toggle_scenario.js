const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd'; // Minh Khang
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

async function sendReact(msgId, reaction, action = null, isRemoved = null) {
  return new Promise((resolve, reject) => {
    const bodyObj = { reaction };
    if (action !== null) bodyObj.action = action;
    if (isRemoved !== null) bodyObj.isRemoved = isRemoved;

    const postData = JSON.stringify(bodyObj);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/chat/messages/${encodeURIComponent(msgId)}/react`,
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
  const testMsg = await p.messages.findFirst({
    where: { conversationId: '09b60691-6512-491f-b5aa-1fbd851abb11' },
    select: { id: true, content: true, reactions: true }
  });

  console.log('Tin nhắn thử nghiệm:', testMsg.id);
  console.log('Trạng thái cảm xúc ban đầu:', testMsg.reactions);

  // BƯỚC 1: Thả icon Like (👍) lần 1 -> Phải hiện icon Like
  console.log('\n--- BƯỚC 1: Thả icon 👍 lần 1 ---');
  const res1 = await sendReact(testMsg.id, '👍');
  console.log('Kết quả BƯỚC 1 reactions:', JSON.stringify(res1.reactions));
  const hasLike1 = res1.reactions && res1.reactions[userId] === '👍';
  console.log('✅ Có icon 👍 không?:', hasLike1);

  // BƯỚC 2: Thả icon Like (👍) lần 2 -> Phải HỦY cảm xúc (xóa icon like)
  console.log('\n--- BƯỚC 2: Thả icon 👍 lần 2 (Đúng icon cũ để hủy) ---');
  const res2 = await sendReact(testMsg.id, '👍');
  console.log('Kết quả BƯỚC 2 reactions:', JSON.stringify(res2.reactions));
  const isRemoved2 = !res2.reactions || res2.reactions[userId] === undefined;
  console.log('✅ Đã hủy thành công icon 👍 chưa?:', isRemoved2);

  // BƯỚC 3: Thả icon Tim (❤️) -> Phải hiện icon Tim
  console.log('\n--- BƯỚC 3: Thả icon ❤️ ---');
  const res3 = await sendReact(testMsg.id, '❤️');
  console.log('Kết quả BƯỚC 3 reactions:', JSON.stringify(res3.reactions));
  const hasHeart3 = res3.reactions && res3.reactions[userId] === '❤️';
  console.log('✅ Có icon ❤️ không?:', hasHeart3);

  // BƯỚC 4: Đổi sang icon Like (👍) trong khi đang thả Tim -> Phải chuyển sang icon Like
  console.log('\n--- BƯỚC 4: Đang có ❤️, thả sang icon 👍 ---');
  const res4 = await sendReact(testMsg.id, '👍');
  console.log('Kết quả BƯỚC 4 reactions:', JSON.stringify(res4.reactions));
  const switchedToLike = res4.reactions && res4.reactions[userId] === '👍';
  console.log('✅ Đã đổi từ ❤️ sang 👍 chưa?:', switchedToLike);

  // BƯỚC 5: Thả icon Like (👍) lại một lần nữa -> Phải HỦY cảm xúc hoàn toàn
  console.log('\n--- BƯỚC 5: Thả lại 👍 để HỦY ---');
  const res5 = await sendReact(testMsg.id, '👍');
  console.log('Kết quả BƯỚC 5 reactions:', JSON.stringify(res5.reactions));
  const isRemoved5 = !res5.reactions || res5.reactions[userId] === undefined;
  console.log('✅ Đã hủy hoàn toàn chưa?:', isRemoved5);

  if (hasLike1 && isRemoved2 && hasHeart3 && switchedToLike && isRemoved5) {
    console.log('\n🎉 TẤT CẢ 5 BƯỚC KIỂM TRA ĐỀU CHÍNH XÁC 100% THEO ĐÚNG LOGIC CỦA BẠN!');
  } else {
    console.error('\n❌ Có bước kiểm tra chưa đạt yêu cầu!');
  }
}

run().catch(console.error).finally(() => p.$disconnect());
