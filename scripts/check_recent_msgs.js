const prisma = require('../prisma');
async function run() {
  const msgs = await prisma.messages.findMany({
    where: { OR: [{ type: 'image' }, { content: { contains: 'chat-media' } }] },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, conversationId: true, type: true, content: true, imageUrl: true, createdAt: true }
  });
  console.log(JSON.stringify(msgs, null, 2));
  await prisma.$disconnect();
}
run();
