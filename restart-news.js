#!/usr/bin/env node

/**
 * RESTART SERVER VÀ LOAD TIN TỨC MỚI
 * Tự động làm sạch và khởi động lại
 */

const { execSync } = require('child_process');
const path = require('path');

console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔄 RESTART & LOAD TIN TỨC MỚI                           ║
╚════════════════════════════════════════════════════════════╝
`);

try {
    // Bước 1: Kill process cũ
    console.log("1️⃣  Đóng server process cũ...");
    try {
        execSync('npx kill-port 3000', { stdio: 'pipe' });
        console.log("   ✅ Đã tắt port 3000\n");
    } catch (e) {
        console.log("   (Port không chạy, tiếp tục...)\n");
    }

    // Bước 2: Xóa database
    console.log("2️⃣  Xóa database cũ...");
    execSync('node cleanup-all-news.js', { stdio: 'inherit' });
    console.log();

    // Bước 3: Thông báo
    console.log("3️⃣  ✨ Sẵn sàng khởi động server mới!");
    console.log("   Chạy: node server.js\n");

    console.log(`╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  Bây giờ hãy chạy: node server.js                         ║`);
    console.log(`║  Chờ xem RSS feeds load (chọn 5 phút đầu)                 ║`);
    console.log(`║  Rồi clear cache browser (Ctrl+Shift+Delete)              ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);

    process.exit(0);

} catch (error) {
    console.error("\n❌ Lỗi:", error.message);
    console.log("\n💡 Thử cách thủ công:");
    console.log("   1. Đóng terminal (Ctrl+C)");
    console.log("   2. Chạy: npx kill-port 3000");
    console.log("   3. Chạy: node cleanup-all-news.js");
    console.log("   4. Chạy: node server.js");
    process.exit(1);
}