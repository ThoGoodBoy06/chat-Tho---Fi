const prisma = require("../prisma");

const getLatestNews = async(req, res) => {
    try {
        // Lấy song song tin tức của từng danh mục để tránh việc danh mục này đè mất danh mục kia
        const [worldNews, vietnamNews, techAiNews] = await Promise.all([
            prisma.news.findMany({
                where: { category: "World" },
                take: 50,
                orderBy: { createdAt: "desc" },
            }),
            prisma.news.findMany({
                where: { category: "Vietnam" },
                take: 50,
                orderBy: { createdAt: "desc" },
            }),
            prisma.news.findMany({
                where: { category: "Tech_AI" },
                take: 80, // Ưu tiên lấy nhiều tin Công nghệ & AI hơn cho người dùng học IT
                orderBy: { createdAt: "desc" },
            }),
        ]);

        // Gộp chung và sắp xếp lại theo thời gian giảm dần
        const allNews = [...worldNews, ...vietnamNews, ...techAiNews].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return res.status(200).json({ success: true, data: allNews });
    } catch (error) {
        console.error("Lỗi khi lấy tin tức:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy tin tức." });
    }
};

// Hàm trích xuất nội dung bài viết từ HTML dựa trên domain
function extractArticleContent(url, htmlText) {
    let fullContent = "";

    if (url.includes("vnexpress.net")) {
        const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
        if (articleMatch) fullContent = articleMatch[1];
    } else if (url.includes("tinhte.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*xfBody[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) fullContent = contentMatch[1];
    } else if (url.includes("laodong.vn")) {
        const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
        if (articleMatch) {
            fullContent = articleMatch[1];
        } else {
            const contentMatch = htmlText.match(/<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (contentMatch) fullContent = contentMatch[1];
        }
    } else if (url.includes("dantri.com.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("vietnamnet.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*maincontent[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("genk.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*knc-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("cafef.vn") || url.includes("cafebiz.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("thanhnien.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*detail__content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("tuoitre.vn")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*detail-cmain[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else if (url.includes("baomoi.com")) {
        const contentMatch = htmlText.match(/<div[^>]*class="[^"]*bm_B[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (contentMatch) {
            fullContent = contentMatch[1];
        } else {
            const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
            if (articleMatch) fullContent = articleMatch[1];
        }
    } else {
        // Fallback: tìm article tag
        const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
        if (articleMatch) fullContent = articleMatch[1];
    }

    return fullContent;
}

// Hàm dọn dẹp nội dung HTML
function cleanupFullContent(fullContent) {
    fullContent = fullContent.replace(/<script[\s\S]*?<\/script>/gi, "");
    fullContent = fullContent.replace(/<style[\s\S]*?<\/style>/gi, "");
    fullContent = fullContent.replace(/<div[^>]*class="[^"]*box-embed-video[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    fullContent = fullContent.replace(/<div[^>]*class="[^"]*insert-link-box[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    fullContent = fullContent.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

    // Xử lý Lazy Loading
    fullContent = fullContent.replace(/<img([^>]+)>/gi, (imgTag, attributes) => {
        let realSrc = "";
        const dataSrcMatch = attributes.match(/data-src=["']([^"']+)["']/i);
        if (dataSrcMatch) {
            realSrc = dataSrcMatch[1];
        } else {
            const dataOrigMatch = attributes.match(/data-original=["']([^"']+)["']/i);
            if (dataOrigMatch) {
                realSrc = dataOrigMatch[1];
            }
        }
        if (realSrc) {
            let newAttributes = attributes.replace(/src=["']([^"']*?)["']/i, `src="${realSrc}"`);
            if (!newAttributes.includes("src=")) {
                newAttributes = ` src="${realSrc}"` + newAttributes;
            }
            return `<img${newAttributes}>`;
        }
        return imgTag;
    });

    // Xóa inline style
    fullContent = fullContent.replace(/\sstyle=["']([^"']*?)["']/gi, "");
    return fullContent.trim();
}

const getNewsContent = async(req, res) => {
    const { id } = req.params;
    try {
        const newsItem = await prisma.news.findUnique({
            where: { id }
        });

        if (!newsItem) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tin tức." });
        }

        // Nếu đã có nội dung chi tiết lưu trong DB thì trả về ngay
        if (newsItem.fullContent) {
            return res.status(200).json({ success: true, data: newsItem.fullContent });
        }

        // Nếu chưa có link, trả về mô tả ngắn (đã clean HTML)
        if (!newsItem.link) {
            const cleanContent = (newsItem.content || "").replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").trim();
            return res.status(200).json({ success: true, data: `<p>${cleanContent || newsItem.title}</p>` });
        }

        console.log(`🌐 [Scraper] Đang cào nội dung chi tiết từ: ${newsItem.link}`);
        let fullContent = "";
        let actualUrl = newsItem.link;

        try {
            // Nếu là link Google News, follow redirect để lấy URL bài báo thật
            if (actualUrl.includes("news.google.com")) {
                try {
                    const redirectRes = await fetch(actualUrl, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        },
                        redirect: "follow",
                        signal: AbortSignal.timeout(10000)
                    });
                    // Lấy URL thật sau khi redirect
                    if (redirectRes.url && !redirectRes.url.includes("news.google.com") && !redirectRes.url.includes("consent.google.com")) {
                        actualUrl = redirectRes.url;
                        console.log(`🔗 [Scraper] Google News redirect → ${actualUrl}`);
                    }
                    const htmlText = await redirectRes.text();
                    fullContent = extractArticleContent(actualUrl, htmlText);
                } catch (redirectErr) {
                    console.error(`⚠️ Lỗi redirect Google News:`, redirectErr.message);
                }
            } else {
                // Fetch trực tiếp cho các nguồn bình thường
                const response = await fetch(actualUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    signal: AbortSignal.timeout(10000)
                });
                const htmlText = await response.text();
                fullContent = extractArticleContent(actualUrl, htmlText);
            }

            // Dọn dẹp nội dung
            if (fullContent && fullContent.length > 100) {
                fullContent = cleanupFullContent(fullContent);
            }
        } catch (fetchError) {
            console.error(`❌ Lỗi khi tải URL bài viết ${newsItem.link}:`, fetchError.message);
        }

        // Nếu cào thất bại, fallback về mô tả ngắn + nút đọc bài gốc
        if (!fullContent || fullContent.length < 100) {
            // QUAN TRỌNG: Clean HTML thô khỏi content trước khi hiển thị
            const cleanContent = (newsItem.content || "")
                .replace(/<a[\s\S]*?<\/a>/g, "")
                .replace(/<[^>]*>?/gm, "")
                .replace(/&nbsp;/g, " ")
                .trim();

            let hostName = "Trang gốc";
            try {
                const urlObj = new URL(actualUrl);
                hostName = urlObj.hostname.replace("www.", "");
            } catch (e) {}

            const displayContent = cleanContent || newsItem.title;

            fullContent = `
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: var(--text-dark);">${displayContent}</p>
        <div style="text-align: center; margin: 30px auto; padding: 24px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color); max-width: 480px;">
          <i class="fas fa-external-link-alt" style="font-size: 28px; color: var(--primary-color); margin-bottom: 12px;"></i>
          <p style="font-size: 13.5px; color: var(--text-light); margin-bottom: 16px; line-height: 1.5;">
            Bài viết chi tiết được đăng tải trên <strong>${hostName}</strong>. Vui lòng bấm nút bên dưới để đọc bài viết gốc với định dạng đầy đủ nhất.
          </p>
          <a href="${actualUrl}" target="_blank" style="display: inline-block; padding: 10px 24px; background: var(--primary-color); color: white; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 6px rgba(0, 104, 255, 0.15); font-size: 14px; transition: transform 0.2s ease;">
            Đọc bài viết gốc trên ${hostName}
          </a>
        </div>
      `;
        }

        // Lưu lại vào DB để lần sau tải nhanh hơn + cập nhật link thật
        const updateData = { fullContent };
        if (actualUrl !== newsItem.link) {
            updateData.link = actualUrl;
        }
        await prisma.news.update({
            where: { id },
            data: updateData
        });

        return res.status(200).json({ success: true, data: fullContent });
    } catch (error) {
        console.error("Lỗi khi cào nội dung tin tức:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy nội dung chi tiết." });
    }
};

module.exports = {
    getLatestNews,
    getNewsContent,
};