const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Xử lý yêu cầu trò chuyện với Gemini AI
 * POST /api/ai/chat
 */
exports.chat = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        error: "Câu hỏi (prompt) không được để trống." 
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ Lỗi: GEMINI_API_KEY chưa được cấu hình trong file .env!");
      return res.status(500).json({ 
        success: false, 
        error: "Chưa cấu hình API Key của Gemini trên Server. Vui lòng liên hệ Admin!" 
      });
    }

    // Khởi tạo GoogleGenerativeAI với api key
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Sử dụng model gemini-2.5-flash để phản hồi nhanh nhất
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log(`🤖 Đang gửi yêu cầu tới Gemini AI cho user ${req.user ? req.user.username : 'Unknown'}...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.json({ 
      success: true, 
      text: text 
    });
  } catch (error) {
    console.error("❌ Lỗi gọi Gemini API:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Không thể kết nối đến AI. Vui lòng thử lại sau!", 
      details: error.message 
    });
  }
};
