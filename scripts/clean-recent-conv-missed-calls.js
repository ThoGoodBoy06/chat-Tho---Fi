const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const convId = '09b60691-6512-491f-b5aa-1fbd851abb11';
  const calls = await prisma.messages.findMany({
    where: {
      conversationId: convId,
      type: { in: ['missed_call', 'call', 'video_call'] },
      createdAt: {
        gte: new Date('2026-09-12T19:00:00Z'),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Tìm thấy ${calls.length} cuộc gọi nhỡ lúc 02:01 trong phòng chat ${convId}`);
  // Giữ lại 1 cuộc gọi nhỡ đầu tiên, xóa toàn bộ các cuộc gọi nhỡ bị spam liên tiếp còn lại
  if (calls.length > 1) {
    const toDelete = calls.slice(1);
    const ids = toDelete.map(c => c.id);
    const res = await prisma.messages.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`✅ Đã xóa ${res.count} cuộc gọi nhỡ bị spam liên tiếp! Chỉ giữ lại 1 cuộc gọi nhỡ duy nhất.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
