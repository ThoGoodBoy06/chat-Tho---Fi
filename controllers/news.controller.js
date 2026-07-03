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

        // Nếu chưa có, tiến hành cào từ đường dẫn gốc
        if (!newsItem.link) {
            return res.status(200).json({ success: true, data: `<p>${newsItem.content}</p>` });
        }

        console.log(`🌐 [Scraper] Đang cào nội dung chi tiết từ: ${newsItem.link}`);
        let fullContent = "";

        try {
            const response = await fetch(newsItem.link, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            const htmlText = await response.text();

            if (newsItem.link.includes("vnexpress.net")) {
                // VNExpress sử dụng class "fck_detail"
                const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
                if (articleMatch) {
                    fullContent = articleMatch[1];
                }
            } else if (newsItem.link.includes("tinhte.vn")) {
                // Tinh tế sử dụng class "xfBody"
                const contentMatch = htmlText.match(/<div[^>]*class="[^"]*xfBody[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                if (contentMatch) {
                    fullContent = contentMatch[1];
                }
            } else if (newsItem.link.includes("laodong.vn")) {
                // Lao Động sử dụng class "fck_detail"
                const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
                if (articleMatch) {
                    fullContent = articleMatch[1];
                } else {
                    // Fallback cho Lao Động
                    const contentMatch = htmlText.match(/<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                    if (contentMatch) {
                        fullContent = contentMatch[1];
                    }
                }
            } else if (newsItem.link.includes("dantri.com.vn")) {
                // Dân Trí sử dụng div với class chứa "content"
                const contentMatch = htmlText.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                if (contentMatch) {
                    fullContent = contentMatch[1];
                } else {
                    // Fallback tìm thẻ article chung
                    const articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
                    if (articleMatch) {
                        fullContent = articleMatch[1];
                    }
                }
            } else {
                // Fallback cho các trang khác: tìm article hoặc div chứa nội dung
                let articleMatch = htmlText.match(/<article[^>]*>([\s\S]*?)<\/article>/);
                if (articleMatch) {
                    fullContent = articleMatch[1];
                }
            }

            if (fullContent && fullContent.length > 100) {
                // Dọn dẹp các quảng cáo, widget, script trong bài viết
                fullContent = fullContent.replace(/<script[\s\S]*?<\/script>/gi, "");
                fullContent = fullContent.replace(/<style[\s\S]*?<\/style>/gi, "");
                fullContent = fullContent.replace(/<div[^>]*class="[^"]*box-embed-video[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
                fullContent = fullContent.replace(/<div[^>]*class="[^"]*insert-link-box[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
                fullContent = fullContent.replace(/<iframe[\s\S]*?<\/iframe>/gi, ""); // loại bỏ iframe quảng cáo/video lỗi

                // Xử lý Lazy Loading: thay thế src bằng data-src hoặc data-original
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
                        let newAttributes = attributes.replace(/src=["']([^"']*)["']/i, `src="${realSrc}"`);
                        if (!newAttributes.includes("src=")) {
                            newAttributes = ` src="${realSrc}"` + newAttributes;
                        }
                        return `<img${newAttributes}>`;
                    }
                    return imgTag;
                });

                // Strip all inline style attributes from the parsed HTML to resolve aspect-ratio positioning bugs
                fullContent = fullContent.replace(/\sstyle=["']([^"']*)["']/gi, "");
                fullContent = fullContent.trim();
            }
        } catch (fetchError) {
            console.error(`❌ Lỗi khi tải URL bài viết ${newsItem.link}:`, fetchError.message);
        }

        // Nếu cào thất bại hoặc bài viết quá ngắn, fallback về phần mô tả ngắn và cung cấp nút đọc bài gốc
        if (!fullContent || fullContent.length < 100) {
            let hostName = "Trang gốc";
            try {
                const urlObj = new URL(newsItem.link);
                hostName = urlObj.hostname.replace("www.", "");
            } catch (e) {}

            fullContent = `
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: var(--text-dark);">${newsItem.content}</p>
        <div style="text-align: center; margin: 30px auto; padding: 24px; background: var(--bg-light); border-radius: 12px; border: 1px solid var(--border-color); max-width: 480px;">
          <i class="fas fa-external-link-alt" style="font-size: 28px; color: var(--primary-color); margin-bottom: 12px;"></i>
          <p style="font-size: 13.5px; color: var(--text-light); margin-bottom: 16px; line-height: 1.5;">
            Bài viết chi tiết được đăng tải trên <strong>${hostName}</strong>. Vui lòng bấm nút bên dưới để đọc bài viết gốc với định dạng đầy đủ nhất.
          </p>
          <a href="${newsItem.link}" target="_blank" style="display: inline-block; padding: 10px 24px; background: var(--primary-color); color: white; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 6px rgba(0, 104, 255, 0.15); font-size: 14px; transition: transform 0.2s ease;">
            Đọc bài viết gốc trên ${hostName}
          </a>
        </div>
      `;
        }

        // Lưu lại vào DB để lần sau tải nhanh hơn
        await prisma.news.update({
            where: { id },
            data: { fullContent }
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