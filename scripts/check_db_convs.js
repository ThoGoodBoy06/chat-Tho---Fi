const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const convs = await p.conversations.findMany({
    include: {
      ConversationMembers: {
        include: {
          Users: { select: { id: true, fullName: true, username: true } }
        }
      }
    }
  });
  console.log('Conversations count:', convs.length);
  convs.forEach(c => {
    console.log(`- Conv ID: ${c.id}, Name: ${c.name}, isGroup: ${c.isGroup}`);
    c.ConversationMembers.forEach(m => {
      console.log(`    Member: ${m.userId} (${m.Users?.fullName || m.Users?.username})`);
    });
  });

  const msgs = await p.messages.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      type: true,
      content: true,
      imageUrl: true,
      reactions: true,
      createdAt: true
    }
  });
  console.log('\nRecent 8 messages:');
  msgs.forEach(m => {
    console.log(`- [${m.id}] conv: ${m.conversationId}, type: ${m.type}, reactions: ${m.reactions}`);
    console.log(`  content: ${m.content?.slice(0, 60)}`);
  });
}

run().catch(console.error).finally(() => p.$disconnect());
