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

module.exports = {
  getLatestNews,
};
