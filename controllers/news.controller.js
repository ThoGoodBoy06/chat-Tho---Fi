const prisma = require("../prisma");

const getLatestNews = async (req, res) => {
  try {
    const news = await prisma.news.findMany({
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
    });
    return res.status(200).json({ success: true, data: news });
  } catch (error) {
    console.error("Lỗi khi lấy tin tức:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy tin tức." });
  }
};

const getNewsContent = async (req, res) => {
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
    const response = await fetch(newsItem.link);
    const htmlText = await response.text();

    // Tìm kiếm nội dung bài viết trong thẻ article của VNExpress
    // VNExpress sử dụng class "fck_detail" cho nội dung bài viết chính
    const articleMatch = htmlText.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/);
    let fullContent = "";

    if (articleMatch) {
      fullContent = articleMatch[1];
      
      // Dọn dẹp các quảng cáo, widget, script trong bài viết
      fullContent = fullContent.replace(/<script[\s\S]*?<\/script>/gi, "");
      fullContent = fullContent.replace(/<style[\s\S]*?<\/style>/gi, "");
      fullContent = fullContent.replace(/<div[^>]*class="[^"]*box-embed-video[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
      fullContent = fullContent.replace(/<div[^>]*class="[^"]*insert-link-box[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
      fullContent = fullContent.replace(/<table[^>]*class="[^"]*tplCaption[^"]*"[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
        // Giữ lại ảnh và chú thích ảnh gọn gàng hơn
        return `<div class="article-image-box" style="margin: 16px 0; text-align: center; background: var(--msg-receiver-bg); padding: 10px; border-radius: 12px;">${tableContent}</div>`;
      });
      fullContent = fullContent.trim();
    }

    // Nếu cào thất bại, fallback về phần mô tả ngắn
    if (!fullContent || fullContent.length < 100) {
      // Thử tìm theo thẻ paragraph chính Normal
      const paragraphs = [];
      const pRegex = /<p[^>]*class="Normal"[^>]*>([\s\S]*?)<\/p>/g;
      let pMatch;
      while ((pMatch = pRegex.exec(htmlText)) !== null) {
        paragraphs.push(`<p>${pMatch[1].replace(/<[^>]*>?/gm, "").trim()}</p>`);
      }
      if (paragraphs.length > 0) {
        fullContent = paragraphs.join("\n");
      } else {
        fullContent = `<p>${newsItem.content}</p><p style="font-style: italic; color: var(--text-light); margin-top: 20px;">(Xem bài viết đầy đủ tại đường dẫn: <a href="${newsItem.link}" target="_blank">${newsItem.link}</a>)</p>`;
      }
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
