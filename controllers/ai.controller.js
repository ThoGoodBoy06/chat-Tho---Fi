const { GoogleGenAI } = require("@google/genai");
const { OpenAI } = require("openai");
const prisma = require("../prisma");

/**
 * ===== Khởi tạo client Gemini & OpenAI =====
 */
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else {
  console.error("❌ Lỗi: GEMINI_API_KEY chưa được cấu hình trong file .env!");
}

// Khởi tạo OpenAI Client cho tính năng "Thanh tra gọt giũa"
const openaiApiKey = process.env.OPENAI_API_KEY;
let openai = null;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
} else {
  console.warn("⚠️ Cảnh báo: OPENAI_API_KEY chưa có, hệ thống sẽ chỉ dùng Gemini.");
}

// Model dùng cho chat 
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || "high";

// ====== System Instruction "Trợ lý AI Tho-Fi" ======
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
2. Trực diện & Rõ ràng: Bỏ qua mọi câu rào trước đón sau dư thừa. Đi thẳng vào trọng tâm.
3. Định dạng Markdown nghiêm ngặt: Bắt buộc sử dụng các thẻ Heading (##, ###) để chia bố cục, sử dụng Bullet points (*) cho danh sách, và Bold (**) cho từ khóa quan trọng. Code block phải có ngôn ngữ rõ ràng.
4. Xưng hô & Thái độ: Xưng "mình" và gọi "bạn". Thái độ tự tin, khiêm tốn, lịch sự. Tôn trọng tuyệt đối nhà sáng lập Tho.
5. Sự thật & Tính chính xác: Nếu không biết hoặc không chắc chắn, hãy thẳng thắn thừa nhận, tuyệt đối không bịa đặt thông tin (hallucination).`;

/**
 * ===== Quản lý phiên chat theo user (lưu trong RAM) =====
 */
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY_TURNS = 30;

function buildChatConfig() {
  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    maxOutputTokens: 2048,
  };
  if (MODEL_NAME && MODEL_NAME.toLowerCase().includes("thinking")) {
    config.thinkingConfig = { thinkingLevel: THINKING_LEVEL };
  }
  return config;
}

async function getOrCreateAiConversation(userId) {
  let conversation = await prisma.conversations.findFirst({
    where: { type: "ai", createdBy: userId },
  });

  if (!conversation) {
    conversation = await prisma.conversations.create({
      data: { type: "ai", createdBy: userId, name: "Trợ lý AI Tho-Fi" },
    });
  }
  return conversation;
}

async function getOrCreateChatSession(userId) {
  const existing = sessions.get(userId);
  if (existing) {
    existing.lastActive = Date.now();
    return existing.chat;
  }

  let history = [];
  try {
    const conversation = await getOrCreateAiConversation(userId);
    const dbMessages = await prisma.messages.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    history = dbMessages.map((msg) => ({
      role: msg.senderId ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
  } catch (err) {
    console.error("⚠️ Không thể tải lịch sử AI từ database:", err);
  }

  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: history,
    config: buildChatConfig(),
  });
  sessions.set(userId, { chat, lastActive: Date.now() });
  return chat;
}

function trimHistoryIfNeeded(userId, chat) {
  const history = chat.getHistory();
  const maxMessages = MAX_HISTORY_TURNS * 2;
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

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActive > SESSION_TTL_MS) sessions.delete(key);
  }
}, 10 * 60 * 1000);

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

// Lấy lịch sử và định dạng lại cho OpenAI
async function getChatMessagesForOpenAi(userId, currentPrompt) {
  const conversation = await getOrCreateAiConversation(userId);
  const dbMessages = await prisma.messages.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  const messages = [
    { role: "system", content: SYSTEM_INSTRUCTION }
  ];

  dbMessages.forEach((msg) => {
    messages.push({
      role: msg.senderId ? "user" : "assistant",
      content: msg.content,
    });
  });

  messages.push({ role: "user", content: currentPrompt });
  return messages;
}

// Gọi OpenAI thường (Dự phòng)
async function callOpenAi(userId, prompt) {
  if (!openai) throw new Error("OpenAI client is not initialized.");

  const messages = await getChatMessagesForOpenAi(userId, prompt);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  console.log(`🤖 Fallback: Đang gọi OpenAI (${model}) cho user ${userId}...`);

  const response = await openai.chat.completions.create({
    model: model,
    messages: messages,
  });

  return response.choices[0]?.message?.content || "";
}

// Gọi OpenAI stream (Dự phòng)
async function callOpenAiStream(userId, prompt, res) {
  if (!openai) throw new Error("OpenAI client is not initialized.");

  const messages = await getChatMessagesForOpenAi(userId, prompt);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  console.log(`🤖 Fallback: Đang gọi OpenAI Stream (${model}) cho user ${userId}...`);

  const stream = await openai.chat.completions.create({
    model: model,
    messages: messages,
    stream: true,
  });

  let fullAiText = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      fullAiText += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }

  return fullAiText;
}

/**
 * GET /api/ai/chat/history
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
    return res.status(500).json({ success: false, error: "Không thể tải lịch sử AI." });
  }
};

/**
 * POST /api/ai/chat
 * Cấu trúc Multi-LLM: Gemini (Draft) -> ChatGPT (Polish) -> Database
 */
exports.chat = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ success: false, error: "Câu hỏi không được để trống." });
    }
    if (prompt.length > 8000) {
      return res.status(400).json({ success: false, error: "Câu hỏi quá dài (tối đa 8000 ký tự)." });
    }
    if (!ai) {
      return res.status(500).json({ success: false, error: "Chưa cấu hình API Key của Gemini!" });
    }

    const userId = resolveUserId(req);
    const conversation = await getOrCreateAiConversation(userId);

    // 1. Lưu DB User Message
    await prisma.messages.create({
      data: { conversationId: conversation.id, senderId: userId, content: prompt.trim() },
    });

    let finalAiText = "";
    let chat = null;

    try {
      chat = await getOrCreateChatSession(userId);
      console.log(`🤖 [BƯỚC 1 - DRAFT] Gemini đang xử lý cho user ${req.user?.username || "Unknown"}...`);
      const response = await callWithRetry(() => chat.sendMessage({ message: prompt.trim() }));
      const geminiDraft = response.text || "";
      finalAiText = geminiDraft;

      // 2. ChatGPT gọt giũa (Nếu có Key)
      if (openai) {
        try {
          console.log(`🧠 [BƯỚC 2 - POLISH] Đẩy sang ChatGPT gọt giũa...`);
          const chatGptResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Bạn là chuyên gia biên tập cấp cao. Nhiệm vụ: Nhận bản nháp từ AI khác, sửa lỗi hành văn cho tự nhiên, cấu trúc lại bằng Markdown (Heading, Bullet points). Tuyệt đối KHÔNG cắt xén dữ liệu hoặc thay đổi sự thật."
              },
              {
                role: "user",
                content: `Câu hỏi gốc: "${prompt}"\n\n--- BẢN NHÁP ---\n${geminiDraft}`
              }
            ],
            temperature: 0.7
          });
          finalAiText = chatGptResponse.choices[0].message.content;
        } catch (openAiError) {
          console.error("⚠️ Lỗi ChatGPT, kích hoạt khiên bất tử dùng bản nháp Gemini:", openAiError.message);
        }
      }
    } catch (geminiError) {
      console.warn("⚠️ Gemini gặp sự cố, thử chuyển sang OpenAI làm dự phòng...", geminiError.message);
      if (openai) {
        try {
          finalAiText = await callOpenAi(userId, prompt.trim());
        } catch (openaiError) {
          console.error("❌ Cả Gemini và OpenAI đều thất bại:", openaiError.message);
          throw geminiError;
        }
      } else {
        throw geminiError;
      }
    }

    // 3. Lưu DB AI Message
    await prisma.messages.create({
      data: { conversationId: conversation.id, senderId: null, content: finalAiText },
    });

    if (chat) {
      trimHistoryIfNeeded(userId, chat);
    }

    return res.json({ success: true, text: finalAiText });
  } catch (error) {
    console.error("❌ Lỗi hệ thống AI:", error);
    const status = error.status || error.code || (error.error && error.error.code);
    let errorMessage = "Hệ thống AI đang bảo trì. Vui lòng thử lại sau!";
    if (status === 429 || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("Quota")) {
      errorMessage = "⚠️ Tài khoản đã hết token rồi!!!";
    }
    return res.status(status === 429 ? 429 : 500).json({ success: false, error: errorMessage });
  }
};

/**
 * POST /api/ai/chat/stream
 * Giữ nguyên Stream bằng Gemini để đảm bảo tốc độ phản hồi real-time.
 */
exports.chatStream = async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ success: false, error: "Câu hỏi không được để trống." });
  }
  if (!ai) {
    return res.status(500).json({ success: false, error: "Chưa cấu hình API Key của Gemini." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const userId = resolveUserId(req);
    const conversation = await getOrCreateAiConversation(userId);

    await prisma.messages.create({
      data: { conversationId: conversation.id, senderId: userId, content: prompt.trim() },
    });

    let fullAiText = "";
    let chat = null;

    try {
      chat = await getOrCreateChatSession(userId);
      const stream = await chat.sendMessageStream({ message: prompt.trim() });

      for await (const chunk of stream) {
        if (chunk.text) {
          fullAiText += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      
      trimHistoryIfNeeded(userId, chat);
    } catch (geminiError) {
      console.warn("⚠️ Gemini stream gặp sự cố, thử chuyển sang OpenAI làm dự phòng...", geminiError.message);
      if (openai) {
        try {
          fullAiText = await callOpenAiStream(userId, prompt.trim(), res);
        } catch (openaiError) {
          console.error("❌ Cả Gemini và OpenAI stream đều thất bại:", openaiError.message);
          throw geminiError;
        }
      } else {
        throw geminiError;
      }
    }

    if (fullAiText.trim() !== "") {
      await prisma.messages.create({
        data: { conversationId: conversation.id, senderId: null, content: fullAiText },
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("❌ Lỗi stream API:", error);
    const status = error.status || error.code || (error.error && error.error.code);
    let errorMessage = "Tài khoản AI có thể đã hết Token, vui lòng thử lại sau!";
    if (status === 429 || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("Quota")) {
      errorMessage = "⚠️ Tài khoản đã hết token rồi!!!";
    }
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
};

/**
 * DELETE /api/ai/chat/history
 */
exports.resetHistory = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    sessions.delete(userId);

    const conversation = await getOrCreateAiConversation(userId);
    await prisma.messages.deleteMany({
      where: { conversationId: conversation.id },
    });

    return res.json({ success: true, message: "Đã xoá lịch sử trò chuyện. Bắt đầu cuộc hội thoại mới!" });
  } catch (error) {
    console.error("❌ Lỗi xoá lịch sử chat AI:", error);
    return res.status(500).json({ success: false, error: "Không thể xoá lịch sử trò chuyện." });
  }
};