const { GoogleGenAI } = require("@google/genai");
const prisma = require("../prisma");

/**
 * ===== Khởi tạo client Gemini =====
 * Lưu ý: SDK cũ "@google/generative-ai" đã bị Google EOL (31/08/2025).
 * Phải dùng SDK mới "@google/genai".
 */
const apiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.error("❌ Lỗi: GEMINI_API_KEY chưa được cấu hình trong file .env!");
}

// Model dùng cho chat - có thể đổi qua .env, không cần sửa code
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// Mức độ "suy nghĩ sâu" của model: minimal | low | medium | high
// "high" thông minh hơn nhưng chậm/tốn hơn. "medium" là cân bằng tốt cho chat thường ngày.
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "high";

// ====== System Instruction "Trợ lý AI Tho-Fi" (giữ nguyên từ bản gốc) ======
const SYSTEM_INSTRUCTION = `Bạn là "Trợ lý AI Tho-Fi" - một trí tuệ nhân tạo bậc cao được tích hợp độc quyền trong ứng dụng Chat Tho-Fi.
Người sáng lập hệ sinh thái này là Tho. Bạn đóng vai trò như một chuyên gia cấp cao, có khả năng suy luận logic sâu sắc, giải quyết vấn đề phức tạp và thấu hiểu ngữ cảnh nội bộ.
[HỆ SINH THÁI & NGỮ CẢNH NỘI BỘ]
- Bạn biết rằng Tho không chỉ tạo ra Chat Tho-Fi mà còn đang phát triển "Hang's Garden" - một nền tảng web thương mại điện tử với giao diện Cyberpunk chuyên về cây cảnh.
- Những cộng sự và người bạn thường xuyên tương tác trong thế giới của Tho gồm có Quý và Hà Thị Ni. Hãy giao tiếp một cách tự nhiên và thân thiết nếu người dùng nhắc đến họ.
[THÔNG TIN DỰ ÁN CHAT THO-FI]
- Công nghệ lõi: Node.js, Socket.IO (Real-time), Prisma (PostgreSQL), Vanilla JS, WebRTC, Firebase (FCM Push Notifications).
- Tính năng nổi bật: Chat realtime, Gọi thoại/video WebRTC, Trạng thái gõ phím sinh động (Typing indicator), Quản lý hồ sơ chuẩn xác, và Dark/Light mode.
[QUY TẮC TƯ DUY & TRÌNH BÀY (CẤP ĐỘ PRO)]
1. Tư duy phân tích (Chain of Thought): Với các câu hỏi phức tạp (code, kiến trúc, chiến lược), hãy luôn phân tích vấn đề thành các bước nhỏ trước khi đưa ra kết luận.
2. Trực diện & Rõ ràng: Bỏ qua mọi câu rào trước đón sau dư thừa (VD: "Tuyệt vời, tôi sẽ giúp bạn...", "Dưới đây là..."). Đi thẳng vào trọng tâm.
3. Định dạng Markdown nghiêm ngặt: Bắt buộc sử dụng các thẻ Heading (##, ###) để chia bố cục, sử dụng Bullet points (*) cho danh sách, và Bold (**) cho từ khóa quan trọng. Code block phải có ngôn ngữ rõ ràng.
4. Xưng hô & Thái độ: Xưng "mình" và gọi "bạn". Thái độ tự tin, khiêm tốn, lịch sự. Tôn trọng tuyệt đối nhà sáng lập Tho.
5. Sự thật & Tính chính xác: Nếu không biết hoặc không chắc chắn, hãy thẳng thắn thừa nhận, tuyệt đối không bịa đặt thông tin (hallucination).`;

/**
 * ===== Quản lý phiên chat theo user (lưu trong RAM) =====
 * Mỗi user có 1 "Chat session" riêng, session này tự lưu lịch sử hội thoại
 * bên trong nó -> AI sẽ NHỚ những gì đã nói trước đó trong cùng phiên.
 *
 * Hạn chế: mất hết khi restart server. Nếu muốn lưu vĩnh viễn, lưu
 * chat.getHistory() vào DB (Prisma) sau mỗi lượt và truyền lại vào
 * `history` khi tạo lại session lúc server khởi động lại.
 */
const sessions = new Map(); // userId -> { chat, lastActive }
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 phút không hoạt động -> dọn session
const MAX_HISTORY_TURNS = 30; // số lượt hỏi-đáp tối đa giữ trong ngữ cảnh

function buildChatConfig() {
  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: THINKING_LEVEL },
  };
}

// Tìm hoặc tạo cuộc hội thoại AI dành riêng cho User trong DB (không có thành viên khác, type='ai')
async function getOrCreateAiConversation(userId) {
  let conversation = await prisma.conversations.findFirst({
    where: {
      type: "ai",
      createdBy: userId,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversations.create({
      data: {
        type: "ai",
        createdBy: userId,
        name: "Trợ lý AI Tho-Fi",
      },
    });
  }
  return conversation;
}

// Lấy hoặc khởi tạo phiên chat với Gemini, tự động nạp lịch sử từ DB
async function getOrCreateChatSession(userId) {
  const existing = sessions.get(userId);
  if (existing) {
    existing.lastActive = Date.now();
    return existing.chat;
  }

  // Tải lịch sử chat từ DB để nạp làm ngữ cảnh cho Gemini
  let history = [];
  try {
    const conversation = await getOrCreateAiConversation(userId);
    const dbMessages = await prisma.messages.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 40, // Lấy tối đa 40 tin nhắn gần nhất để tránh tràn Token
    });

    history = dbMessages.map((msg) => ({
      role: msg.senderId ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
  } catch (err) {
    console.error("⚠️ Không thể tải lịch sử AI từ database để làm ngữ cảnh:", err);
  }

  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: history,
    config: buildChatConfig(),
  });
  sessions.set(userId, { chat, lastActive: Date.now() });
  return chat;
}

// Cắt lịch sử nếu quá dài để tránh tốn token / chi phí leo thang theo thời gian
function trimHistoryIfNeeded(userId, chat) {
  const history = chat.getHistory();
  const maxMessages = MAX_HISTORY_TURNS * 2; // user + model mỗi lượt
  if (history.length > maxMessages) {
    const trimmed = history.slice(history.length - maxMessages);
    const newChat = ai.chats.create({
      model: MODEL_NAME,
      history: trimmed,
      config: buildChatConfig(),
    });
    sessions.set(userId, { chat: newChat, lastActive: Date.now() });
  }
}

// Dọn các session không hoạt động để tránh phình RAM
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(key);
  }
}, 10 * 60 * 1000);

// Gọi API có retry khi gặp lỗi tạm thời (quá tải / rate limit)
async function callWithRetry(fn, retries = 2, delayMs = 800) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.code;
      const isRetryable = status === 429 || status === 503 || status === 500;
      if (!isRetryable || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
}

function resolveUserId(req) {
  return req.user?.id || req.user?.username || "guest";
}

/**
 * GET /api/ai/chat/history
 * Lấy toàn bộ lịch sử hội thoại của user hiện tại từ Database
 */
exports.getHistory = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const conversation = await getOrCreateAiConversation(userId);
    const messages = await prisma.messages.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      success: true,
      messages: messages.map((msg) => ({
        role: msg.senderId ? "user" : "model",
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử AI từ database:", error);
    return res.status(500).json({
      success: false,
      error: "Không thể tải lịch sử cuộc trò chuyện AI.",
    });
  }
};

/**
 * POST /api/ai/chat
 * Trò chuyện có NHỚ NGỮ CẢNH (multi-turn), trả về 1 lần (không stream).
 */
exports.chat = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Câu hỏi (prompt) không được để trống.",
      });
    }
    if (prompt.length > 8000) {
      return res.status(400).json({
        success: false,
        error: "Câu hỏi quá dài, vui lòng rút ngắn lại (tối đa 8000 ký tự).",
      });
    }
    if (!ai) {
      return res.status(500).json({
        success: false,
        error: "Chưa cấu hình API Key của Gemini trên Server. Vui lòng liên hệ Admin!",
      });
    }

    const userId = resolveUserId(req);
    const conversation = await getOrCreateAiConversation(userId);

    // 1. Lưu tin nhắn của User vào Database
    await prisma.messages.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content: prompt.trim(),
      },
    });

    const chat = await getOrCreateChatSession(userId);

    console.log(`🤖 [${MODEL_NAME}] Đang xử lý yêu cầu cho user ${req.user?.username || "Unknown"}...`);

    const response = await callWithRetry(() =>
      chat.sendMessage({ message: prompt.trim() })
    );

    const aiText = response.text || "";

    // 2. Lưu tin nhắn phản hồi của AI vào Database
    await prisma.messages.create({
      data: {
        conversationId: conversation.id,
        senderId: null, // senderId = null là AI gửi
        content: aiText,
      },
    });

    trimHistoryIfNeeded(userId, chat);

    return res.json({ success: true, text: aiText });
  } catch (error) {
    console.error("❌ Lỗi gọi Gemini API:", error);
    return res.status(500).json({
      success: false,
      error: "Không thể kết nối đến AI. Vui lòng thử lại sau!",
      details: error.message,
    });
  }
};

/**
 * POST /api/ai/chat/stream
 * Trả lời theo từng khúc (Server-Sent Events) -> hiệu ứng "đang gõ chữ"
 * giống Claude/Gemini thật. Frontend dùng fetch + ReadableStream để đọc.
 */
exports.chatStream = async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ success: false, error: "Câu hỏi (prompt) không được để trống." });
  }
  if (!ai) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình API Key của Gemini trên Server." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const userId = resolveUserId(req);
    const conversation = await getOrCreateAiConversation(userId);

    // 1. Lưu tin nhắn của User vào Database
    await prisma.messages.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content: prompt.trim(),
      },
    });

    const chat = await getOrCreateChatSession(userId);

    const stream = await chat.sendMessageStream({ message: prompt.trim() });

    let fullAiText = "";
    for await (const chunk of stream) {
      if (chunk.text) {
        fullAiText += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    // 2. Lưu tin nhắn phản hồi của AI vào Database khi stream kết thúc
    if (fullAiText.trim() !== "") {
      await prisma.messages.create({
        data: {
          conversationId: conversation.id,
          senderId: null, // senderId = null đại diện cho AI
          content: fullAiText,
        },
      });
    }

    trimHistoryIfNeeded(userId, chat);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("❌ Lỗi stream Gemini API:", error);
    res.write(`data: ${JSON.stringify({ error: "Không thể kết nối đến AI. Vui lòng thử lại sau!" })}\n\n`);
    res.end();
  }
};

/**
 * DELETE /api/ai/chat/history
 * Xoá "bộ nhớ" hội thoại của user hiện tại -> bắt đầu cuộc trò chuyện mới.
 */
exports.resetHistory = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    sessions.delete(userId);

    const conversation = await getOrCreateAiConversation(userId);
    // Xoá tất cả tin nhắn AI của user trong DB
    await prisma.messages.deleteMany({
      where: { conversationId: conversation.id },
    });

    return res.json({ success: true, message: "Đã xoá lịch sử trò chuyện. Bắt đầu cuộc hội thoại mới!" });
  } catch (error) {
    console.error("❌ Lỗi xoá lịch sử chat AI:", error);
    return res.status(500).json({ success: false, error: "Không thể xoá lịch sử trò chuyện." });
  }
};