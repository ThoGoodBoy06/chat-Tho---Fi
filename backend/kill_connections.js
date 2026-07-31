const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("⚡ Terminating other DB connections to free up pool...");
        const terminated = await prisma.$queryRaw`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE pid <> pg_backend_pid() AND usename = current_user;
        `;
        console.log("✅ Successfully terminated active backends:", terminated);
    } catch (err) {
        console.error("❌ Error terminating backends:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
