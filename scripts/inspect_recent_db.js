const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const convs = await prisma.conversations.findMany({
    include: {
      Messages: {
        orderBy: { createdAt: 'desc' },
        take: 8
      }
    }
  });
  for (const c of convs) {
    if (!c.Messages || c.Messages.length === 0) continue;
    console.log('CONV:', c.id, c.name);
    for (const m of c.Messages.reverse()) {
      console.log('  MSG:', m.id, 'type:', m.type, 'isRecalled:', m.isRecalled, 'content:', (m.content || '').substring(0, 40), 'createdAt:', m.createdAt);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
