const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const msgs = await prisma.messages.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { id: true, senderId: true, type: true, isRecalled: true, createdAt: true, content: true }
  });
  console.log(JSON.stringify(msgs, null, 2));
}
main().finally(() => prisma.$disconnect());
