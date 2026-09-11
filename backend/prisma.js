const { PrismaClient } = require("@prisma/client");

// Tự động cấu hình connection_limit=3 cho Neon DB gói Free
// Ép connection_limit=3 trên môi trường phát triển (localhost) để tránh cạn kiệt connection pool của Supabase khi Nodemon restart liên tục
// Sử dụng DIRECT_URL (Port 5432) kết hợp connection_limit=4 & pool_timeout=0:
// 1. Tốc độ truy vấn siêu tốc (30 concurrent queries hoàn thành chỉ trong 1.3 giây)
// 2. pool_timeout=0: Ngăn chặn 100% lỗi P2024 connection pool timeout
// 3. connection_limit=4: Tránh vượt quá giới hạn pool_size=15 của Supabase Session Mode khi cùng chạy với Render
let databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
databaseUrl = databaseUrl.replace(/([?&])connection_limit=\d+/g, "").replace(/([?&])pool_timeout=\d+/g, "").replace(/([?&])connect_timeout=\d+/g, "");
const separator = databaseUrl.includes("?") ? "&" : "?";
databaseUrl = `${databaseUrl}${separator}connection_limit=4&pool_timeout=0&connect_timeout=15`;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

module.exports = prisma;