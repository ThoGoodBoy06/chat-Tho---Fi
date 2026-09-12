const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.messages.findMany({
    where: {
      type: { in: ['missed_call', 'call', 'video_call'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      Users: { select: { id: true, fullName: true } },
    },
  });

  console.log(`Tìm thấy ${msgs.length} tin nhắn cuộc gọi gần nhất:`);
  msgs.forEach((m) => {
    console.log(`[${m.createdAt.toISOString()}] ID: ${m.id} | Conv: ${m.conversationId} | Type: ${m.type} | Sender: ${m.Users?.fullName} (${m.senderId}) | Content: "${m.content}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
