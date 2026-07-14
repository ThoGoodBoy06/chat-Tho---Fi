const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        const usersCount = await prisma.users.count();
        const convCount = await prisma.conversations.count();
        const msgCount = await prisma.messages.count();
        console.log(`📊 DB STATUS:`);
        console.log(`- Users: ${usersCount}`);
        console.log(`- Conversations: ${convCount}`);
        console.log(`- Messages: ${msgCount}`);
    } catch (err) {
        console.error("❌ Error checking DB:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
