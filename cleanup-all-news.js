/**
 * Script để xóa toàn bộ tin tức trong database
 * Chạy: node cleanup-all-news.js
 */

const prisma = require("./prisma");

async function cleanupAllNews() {
    try {
        console.log("🧹 Đang xóa toàn bộ tin tức...");

        // Xóa tất cả tin tức
        const deleted = await prisma.news.deleteMany({});
        console.log(`✅ Xóa ${deleted.count} tin tức từ database`);

        console.log("\n✨ Xong! Database đã trống.");
        console.log("👉 Bây giờ hãy restart server: node server.js");
        console.log("   Server sẽ tự động load RSS feeds mới (toàn tiếng Việt)");

        process.exit(0);
    } catch (error) {
        console.error("❌ Lỗi khi xóa tin tức:", error);
        process.exit(1);
    }
}

cleanupAllNews();