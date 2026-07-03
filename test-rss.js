/**
 * Script test RSS feeds
 * Chạy: node test-rss.js
 */

async function testRSSFeeds() {
    const FEEDS = [
        { url: "https://vnexpress.net/rss/the-gioi.rss", category: "World" },
        { url: "https://vnexpress.net/rss/thoi-su.rss", category: "Vietnam" },
        { url: "https://vnexpress.net/rss/cong-nghe.rss", category: "Tech_AI" },
        { url: "https://tinhte.vn/rss", category: "Tech_AI" },
        { url: "https://laodong.vn/rss/cong-nghe.rss", category: "Tech_AI" },
        { url: "https://dantri.com.vn/rss/cong-nghe.rss", category: "Tech_AI" }
    ];

    console.log("🧪 Kiểm tra RSS feeds...\n");

    for (const feed of FEEDS) {
        try {
            console.log(`⏳ Đang test: ${feed.category} - ${feed.url}`);
            const response = await fetch(feed.url);

            if (response.ok) {
                const xmlText = await response.text();
                const itemCount = (xmlText.match(/<item>/g) || []).length;
                console.log(`   ✅ OK - ${itemCount} bài viết\n`);
            } else {
                console.log(`   ❌ Lỗi HTTP ${response.status}\n`);
            }
        } catch (error) {
            console.log(`   ❌ Lỗi: ${error.message}\n`);
        }
    }

    console.log("✨ Kiểm tra xong!");
    console.log("\n👉 Bây giờ hãy chạy: node server.js");
    process.exit(0);
}

testRSSFeeds();