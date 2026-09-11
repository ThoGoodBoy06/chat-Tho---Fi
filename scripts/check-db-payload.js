require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.users.findMany({
    select: { id: true, username: true, avatar: true, coverPhoto: true }
  });
  console.log("=== USERS PAYLOAD CHECK ===");
  for (const u of users) {
    const aLen = u.avatar ? u.avatar.length : 0;
    const cLen = u.coverPhoto ? u.coverPhoto.length : 0;
    console.log(`User: ${u.username} | avatar: ${aLen} chars | cover: ${cLen} chars | avatar starts: ${(u.avatar || "").slice(0, 30)}`);
  }

  const messages = await prisma.messages.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, imageUrl: true, videoUrl: true, fileUrl: true }
  });
  console.log("\n=== RECENT MESSAGES PAYLOAD CHECK ===");
  for (const m of messages) {
    const imgLen = m.imageUrl ? m.imageUrl.length : 0;
    const vidLen = m.videoUrl ? m.videoUrl.length : 0;
    console.log(`Msg ${m.id} (${m.type}) | imgLen: ${imgLen} | vidLen: ${vidLen} | imgStarts: ${(m.imageUrl || "").slice(0, 35)}`);
  }

  await prisma.$disconnect();
}
check();
