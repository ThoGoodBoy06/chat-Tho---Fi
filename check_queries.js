const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        const activeQueries = await prisma.$queryRaw`
            SELECT pid, state, query
            FROM pg_stat_activity
            WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
        `;
        console.log("🔥 ACTIVE QUERIES:");
        console.log(JSON.stringify(activeQueries, null, 2));
    } catch (err) {
        console.error("❌ Error checking active queries:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
