const { PrismaClient } = require("@prisma/client");

// Tự động cấu hình connection_limit=3 cho Neon DB gói Free
// Ép connection_limit=3 trên môi trường phát triển (localhost) để tránh cạn kiệt connection pool của Supabase khi Nodemon restart liên tục
let databaseUrl = process.env.DATABASE_URL || "";
if (databaseUrl.includes("connection_limit=")) {
    databaseUrl = databaseUrl.replace(/connection_limit=\d+/, "connection_limit=15");
} else {
    const separator = databaseUrl.includes("?") ? "&" : "?";
    databaseUrl = `${databaseUrl}${separator}connection_limit=15&pool_timeout=15&connect_timeout=15`;
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

module.exports = prisma;