const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Đang kiểm tra các tin nhắn hệ thống bị trùng lặp trong database...');
  const sysMessages = await prisma.messages.findMany({
    where: { type: 'system' },
    orderBy: { createdAt: 'asc' },
  });

  let deletedCount = 0;
  for (let i = 0; i < sysMessages.length; i++) {
    for (let j = i + 1; j < sysMessages.length; j++) {
      const m1 = sysMessages[i];
      const m2 = sysMessages[j];
      if (m1.conversationId === m2.conversationId && m1.content === m2.content) {
        const timeDiff = Math.abs(new Date(m2.createdAt).getTime() - new Date(m1.createdAt).getTime());
        if (timeDiff <= 5000) {
          try {
            await prisma.messages.delete({ where: { id: m2.id } });
            deletedCount++;
            console.log(`🗑️ Đã xóa tin nhắn trùng lặp ID ${m2.id}`);
          } catch (_) {}
        }
      }
    }
  }

  console.log(`✅ Đã dọn dẹp ${deletedCount} tin nhắn hệ thống bị trùng lặp trong database!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
