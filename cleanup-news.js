/**
 * Script để xóa tin tức cũ tiếng Anh từ database
 * Chạy: node cleanup-news.js
 */

const prisma = require("./prisma");

async function cleanupOldNews() {
    try {
        console.log("🧹 Đang xóa tin tức cũ tiếng Anh...");

        // Xóa tin từ TechCrunch
        const techcrunchDeleted = await prisma.news.deleteMany({
            where: {
                link: {
                    contains: "techcrunch.com"
                }
            }
        });
        console.log(`✅ Xóa ${techcrunchDeleted.count} tin từ TechCrunch`);

        // Xóa tin từ Hacker News
        const hackerNewsDeleted = await prisma.news.deleteMany({
            where: {
                link: {
                    contains: "news.ycombinator.com"
                }
            }
        });
        console.log(`✅ Xóa ${hackerNewsDeleted.count} tin từ Hacker News`);

        // Lấy số lượng tin tức còn lại
        const remainingNews = await prisma.news.count();
        console.log(`📊 Tổng tin tức còn lại: ${remainingNews}`);

        console.log("✨ Xong! Bây giờ hãy restart server để load RSS mới.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Lỗi khi xóa tin tức:", error);
        process.exit(1);
    }
}

cleanupOldNews();