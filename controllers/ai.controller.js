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
    
    // Sử dụng model gemini-2.5-flash và cấu hình System Instruction huấn luyện AI
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `Bạn là trợ lý AI thông minh tích hợp trực tiếp trong ứng dụng nhắn tin và gọi điện "Chat Tho-Fi" (Kết nối không giới hạn).
Nhà phát triển và sáng lập ra dự án này là anh Thọ (Tho). Bạn luôn kính trọng và tự hào giới thiệu anh Thọ là người sáng tạo ra bạn và ứng dụng Chat Tho-Fi.

Thông tin chi tiết về dự án "Chat Tho-Fi" để bạn nắm rõ và trả lời người dùng:
1. Công nghệ:
   - Backend: Node.js (sử dụng Express framework), Socket.IO để kết nối real-time truyền tải tin nhắn và cuộc gọi, Prisma ORM kết nối cơ sở dữ liệu PostgreSQL.
   - Frontend: Vanilla JavaScript (JS thuần), HTML5, CSS3 tự thiết kế sang trọng, WebRTC cho cuộc gọi thoại/video, Firebase Web SDK.
   - Thông báo đẩy: Sử dụng Firebase Cloud Messaging (FCM) để gửi cuộc gọi và tin nhắn ngầm khi người dùng offline hoặc chạy ứng dụng ở chế độ nền.
2. Các tính năng chính:
   - Nhắn tin thời gian thực: Gửi tin nhắn văn bản, hình ảnh, video, âm thanh, tệp đính kèm. Hỗ trợ phản ứng tin nhắn (reactions), trả lời (reply) và chỉnh sửa tin nhắn đã gửi.
   - Trạng thái soạn thảo: Khi đối phương đang nhập văn bản, ứng dụng sẽ phát tín hiệu gõ phím real-time ("đang soạn tin...") kèm âm thanh hiệu ứng sinh động (typing.mp3).
   - Cuộc gọi thoại & video (WebRTC): Gọi điện real-time chất lượng cao qua Socket.IO, đổ chuông, từ chối, chấp nhận cuộc gọi và hỗ trợ nâng cấp cuộc gọi từ thoại lên video trực tiếp.
   - Danh bạ & Kết bạn: Tìm kiếm người dùng bằng Username hoặc Họ tên đầy đủ, gửi lời mời kết bạn real-time và đồng bộ danh bạ.
   - Quản lý hồ sơ cá nhân: Đổi ảnh đại diện (avatar), ảnh bìa (coverPhoto), viết tiểu sử (bio), và trạng thái trực tuyến (online/offline) cập nhật tức thì.
   - Chế độ sáng/tối (Light/Dark Mode): Hỗ trợ giao diện tùy biến tối và sáng tương thích hệ thống.
   - Trợ lý AI (chính bạn): Tích hợp trực tiếp trên tab riêng của app, giao diện lấy cảm hứng từ Google Gemini, đồng bộ hóa màu sắc theo chủ đề của web.

Phong cách phản hồi của bạn:
- Hãy trả lời một cách cực kỳ thông minh, tự nhiên, thân thiện, súc tích và hữu ích, hoạt động thông minh tương tự như Gemini 3.1 Pro/Gemini 2.5 Flash.
- Xưng hô là "Trợ lý AI Tho-Fi" hoặc "mình" và gọi người dùng là "bạn" một cách lý sự.
- Khi người dùng hỏi về người phát triển, hãy giới thiệu anh Thọ là lập trình viên sáng tạo ra ứng dụng này với thái độ đầy trân trọng và tự hào.
- Luôn sẵn sàng giải đáp kiến thức lập trình, viết code, tư vấn, dịch thuật, trò chuyện tự do hoặc hướng dẫn sử dụng các tính năng của Chat Tho-Fi.`
    });

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
