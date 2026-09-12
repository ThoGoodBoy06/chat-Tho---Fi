const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Đang kiểm tra các cuộc gọi nhỡ bị spam trong database...');
  const calls = await prisma.messages.findMany({
    where: {
      type: { in: ['missed_call', 'call', 'video_call'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  let deletedCount = 0;
  for (let i = 0; i < calls.length; i++) {
    for (let j = i + 1; j < calls.length; j++) {
      const c1 = calls[i];
      const c2 = calls[j];
      if (c1.conversationId === c2.conversationId) {
        const timeDiff = Math.abs(new Date(c2.createdAt).getTime() - new Date(c1.createdAt).getTime());
        // Nếu 2 cuộc gọi nhỡ trong cùng 1 phòng chat cách nhau dưới 15 giây
        if (timeDiff <= 15000) {
          try {
            await prisma.messages.delete({ where: { id: c2.id } });
            deletedCount++;
            console.log(`🗑️ Đã xóa cuộc gọi nhỡ spam ID: ${c2.id} (cách lần trước ${(timeDiff/1000).toFixed(2)}s)`);
          } catch (_) {}
        }
      }
    }
  }

  console.log(`✅ Đã dọn dẹp ${deletedCount} cuộc gọi nhỡ bị spam trong database!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
