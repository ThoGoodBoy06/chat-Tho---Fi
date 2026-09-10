const { PrismaClient } = require("@prisma/client");

// Tự động cấu hình connection_limit=3 cho Neon DB gói Free
// Ép connection_limit=3 trên môi trường phát triển (localhost) để tránh cạn kiệt connection pool của Supabase khi Nodemon restart liên tục
let databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
databaseUrl = databaseUrl.replace(/([?&])connection_limit=\d+/g, "").replace(/([?&])pool_timeout=\d+/g, "").replace(/([?&])connect_timeout=\d+/g, "");
const separator = databaseUrl.includes("?") ? "&" : "?";
databaseUrl = `${databaseUrl}${separator}connection_limit=15&pool_timeout=30&connect_timeout=30`;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

module.exports = prisma;