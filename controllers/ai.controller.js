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
let isOpenAiQuotaExhausted = false;
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
- Bạn biết rằng Tho là người đã sáng tạo và phát triển ứng dụng Chat Tho-Fi.
- Những cộng sự và người bạn thường xuyên tương tác trong thế giới của Tho có Hà Thị Ni. Hãy giao tiếp một cách tự nhiên và thân thiết nếu người dùng nhắc đến họ.
[THÔNG TIN DỰ ÁN CHAT THO-FI]
- 1 mình Tho đã làm ra Chat Tho-Fi này.
- Công nghệ lõi: Node.js, Socket.IO (Real-time), Prisma (PostgreSQL), Vanilla JS, WebRTC, Firebase (FCM Push Notifications).
- Tính năng nổi bật: Chat realtime, Gọi thoại/video WebRTC, Trạng thái gõ phím sinh động (Typing indicator), Quản lý hồ sơ chuẩn xác, và Dark/Light mode.
[QUY TẮC TƯ DUY & TRÌNH BÀY (CẤP ĐỘ PRO)]
1. Tư duy phân tích (Chain of Thought): Với các câu hỏi phức tạp (code, kiến trúc, chiến lược), hãy luôn phân tích vấn đề thành các bước nhỏ trước khi đưa ra kết luận.
2. Ngắn gọn, Súc tích & Tiết kiệm Token tối đa:
   - Đi thẳng vào trọng tâm câu hỏi. Tuyệt đối không viết các câu chào hỏi hay câu mở đầu rườm rà (ví dụ: "Dưới đây là...", "Chào bạn, mình có thể...", "Tất nhiên rồi...").
   - Bỏ qua toàn bộ phần kết bài xã giao không cần thiết ở cuối câu trả lời.
   - Trình bày thông tin cô đọng, súc tích nhất có thể, tránh giải thích dài dòng lan man để hạn chế tối đa số lượng Token đầu ra (Output Tokens).
3. Định dạng văn bản & Đánh số mục tiêu chuẩn:
   - Các danh mục chính, phần lớn hoặc các ý lớn bắt buộc phải đánh số bằng chữ số La Mã viết hoa (ví dụ: I, II, III, IV,...).
   - Các mục nhỏ, chi tiết hoặc danh sách con bên dưới các ý lớn phải dùng số thường (ví dụ: 1, 2, 3,...) hoặc dấu chấm tròn (*) để phân cấp rõ ràng.

4. Xưng hô & Thái độ: Xưng "mình" và gọi "bạn". Thái độ tự tin, khiêm tốn, lịch sự. Tôn trọng tuyệt đối nhà sáng lập Tho.
5. Sự thật & Tính chính xác: Nếu không biết hoặc không chắc chắn, hãy thẳng thắn thừa nhận, tuyệt đối không bịa đặt thông tin (hallucination).
6. Khi có người xưng hô "mày", "tao" thì bạn cũng thể xưng hô theo họ nha.

`




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

const userConvCache = new Map();

async function getOrCreateAiConversation(userId, conversationId = null) {
    if (conversationId) {
        const found = await prisma.conversations.findFirst({
            where: { id: conversationId, type: "ai", createdBy: userId },
        });
        if (found) return found;
    }

    // Tìm phiên trò chuyện AI gần nhất của người dùng
    let conversation = await prisma.conversations.findFirst({
        where: { type: "ai", createdBy: userId },
        orderBy: { createdAt: "desc" },
    });

    if (!conversation) {
        conversation = await prisma.conversations.create({
            data: { type: "ai", createdBy: userId, name: "Cuộc trò chuyện mới" },
        });
    }
    return conversation;
}

async function getOrCreateChatSession(userId, conversationId) {
    const sessionKey = `${userId}_${conversationId}`;
    const existing = sessions.get(sessionKey);
    if (existing) {
        existing.lastActive = Date.now();
        return existing.chat;
    }

    let history = [];
    try {
        const dbMessages = await prisma.messages.findMany({
            where: { conversationId: conversationId },
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
    sessions.set(sessionKey, { chat, lastActive: Date.now() });
    return chat;
}

function trimHistoryIfNeeded(userId, conversationId, chat) {
    const sessionKey = `${userId}_${conversationId}`;
    const history = chat.getHistory();
    const maxMessages = MAX_HISTORY_TURNS * 2;
    if (history.length > maxMessages) {
        const trimmed = history.slice(history.length - maxMessages);
        const newChat = ai.chats.create({
            model: MODEL_NAME,
            history: trimmed,
            config: buildChatConfig(),
        });
        sessions.set(sessionKey, { chat: newChat, lastActive: Date.now() });
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
 * GET /api/ai/chat/sessions
 * Lấy danh sách tất cả các phiên hội thoại AI của user
 */
exports.getSessions = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const conversations = await prisma.conversations.findMany({
            where: { type: "ai", createdBy: userId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { Messages: true },
                },
            },
        });

        return res.json({
            success: true,
            sessions: conversations.map((c) => ({
                id: c.id,
                name: c.name || "Cuộc trò chuyện mới",
                createdAt: c.createdAt,
                messageCount: c._count?.Messages || 0,
            })),
        });
    } catch (error) {
        console.error("❌ Lỗi lấy danh sách phiên AI:", error);
        return res.status(500).json({ success: false, error: "Không thể tải danh sách cuộc trò chuyện." });
    }
};

/**
 * POST /api/ai/chat/session/new
 * Tạo phiên hội thoại AI mới
 */
exports.createSession = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const conversation = await prisma.conversations.create({
            data: {
                type: "ai",
                createdBy: userId,
                name: "Cuộc trò chuyện mới",
            },
        });
        return res.json({
            success: true,
            session: {
                id: conversation.id,
                name: conversation.name,
                createdAt: conversation.createdAt,
                messageCount: 0,
            },
        });
    } catch (error) {
        console.error("❌ Lỗi tạo phiên AI mới:", error);
        return res.status(500).json({ success: false, error: "Không thể tạo cuộc trò chuyện mới." });
    }
};

/**
 * DELETE /api/ai/chat/session/:id
 * Xoá một phiên hội thoại AI cụ thể
 */
exports.deleteSession = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const conversationId = req.params.id;
        if (!conversationId) {
            return res.status(400).json({ success: false, error: "Thiếu ID cuộc trò chuyện." });
        }

        const sessionKey = `${userId}_${conversationId}`;
        sessions.delete(sessionKey);

        await prisma.messages.deleteMany({
            where: { conversationId: conversationId },
        });
        await prisma.conversations.deleteMany({
            where: { id: conversationId, type: "ai" },
        });

        return res.json({ success: true, message: "Đã xoá cuộc trò chuyện." });
    } catch (error) {
        console.error("❌ Lỗi xoá phiên AI:", error);
        return res.status(500).json({ success: false, error: "Không thể xoá cuộc trò chuyện." });
    }
};

/**
 * DELETE /api/ai/chat/sessions/all
 * Xoá toàn bộ lịch sử trò chuyện AI của người dùng
 */
exports.deleteAllSessions = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const aiConvs = await prisma.conversations.findMany({
            where: { type: "ai", createdBy: userId },
            select: { id: true },
        });
        const ids = aiConvs.map((c) => c.id);
        if (ids.length > 0) {
            ids.forEach((id) => sessions.delete(`${userId}_${id}`));
            await prisma.messages.deleteMany({
                where: { conversationId: { in: ids } },
            });
            await prisma.conversations.deleteMany({
                where: { id: { in: ids } },
            });
        }
        return res.json({ success: true, message: "Đã xoá toàn bộ lịch sử trò chuyện AI." });
    } catch (error) {
        console.error("❌ Lỗi xoá toàn bộ phiên AI:", error);
        return res.status(500).json({ success: false, error: "Không thể xoá toàn bộ lịch sử." });
    }
};

/**
 * GET /api/ai/chat/history
 */
exports.getHistory = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        const conversationId = req.query.conversationId || null;
        const conversation = await getOrCreateAiConversation(userId, conversationId);
        const messages = await prisma.messages.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
        });

        return res.json({
            success: true,
            conversationId: conversation.id,
            conversationName: conversation.name,
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
        const { prompt, conversationId: reqConvId } = req.body;

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

        // Lấy hoặc tạo phiên hội thoại cụ thể
        const conv = await getOrCreateAiConversation(userId, reqConvId);
        const convId = conv.id;

        // Tự động đặt tên tiêu đề gợi nhớ nếu là cuộc trò chuyện mới
        if (conv.name === "Cuộc trò chuyện mới" || conv.name === "Trợ lý AI Tho-Fi") {
            const cleanTitle = prompt.trim().replace(/[\r\n]+/g, " ");
            const shortTitle = cleanTitle.length > 35 ? cleanTitle.substring(0, 35) + "..." : cleanTitle;
            prisma.conversations.update({
                where: { id: convId },
                data: { name: shortTitle },
            }).catch(() => {});
        }

        const chatPromise = getOrCreateChatSession(userId, convId);

        // Lưu câu hỏi người dùng ngầm (không chặn Gemini)
        prisma.messages.create({
            data: { conversationId: convId, senderId: userId, content: prompt.trim() },
        }).catch((e) => console.warn("Lỗi lưu câu hỏi người dùng:", e.message));

        let finalAiText = "";
        let chat = null;

        try {
            chat = await chatPromise;
            console.log(`🤖 Gemini đang xử lý cho user ${req.user?.username || "Unknown"} (Conv: ${convId})...`);
            const response = await callWithRetry(() => chat.sendMessage({ message: prompt.trim() }));
            finalAiText = response.text || "";
        } catch (geminiError) {
            console.warn("⚠️ Gemini gặp sự cố, thử chuyển sang OpenAI làm dự phòng...", geminiError.message);
            if (openai && !isOpenAiQuotaExhausted) {
                try {
                    finalAiText = await callOpenAi(userId, prompt.trim());
                } catch (openaiError) {
                    if (openaiError.status === 429 || openaiError.message?.includes("credits") || openaiError.message?.includes("quota")) {
                        isOpenAiQuotaExhausted = true;
                    }
                    console.error("❌ Cả Gemini và OpenAI đều thất bại:", openaiError.message);
                    throw geminiError;
                }
            } else {
                throw geminiError;
            }
        }

        // TRẢ KẾT QUẢ NGAY LẬP TỨC CHO CLIENT (kèm conversationId)
        res.json({ success: true, text: finalAiText, conversationId: convId });

        // Lưu câu trả lời của AI vào DB trong nền
        (async () => {
            try {
                await prisma.messages.create({
                    data: { conversationId: convId, senderId: null, content: finalAiText },
                });
                if (chat) {
                    trimHistoryIfNeeded(userId, convId, chat);
                }
            } catch (saveErr) {
                console.warn("Lỗi lưu câu trả lời AI vào DB:", saveErr.message);
            }
        })();
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
        const conversationId = req.query.conversationId || null;
        const conversation = await getOrCreateAiConversation(userId, conversationId);

        const sessionKey = `${userId}_${conversation.id}`;
        sessions.delete(sessionKey);

        await prisma.messages.deleteMany({
            where: { conversationId: conversation.id },
        });

        return res.json({ success: true, message: "Đã xoá lịch sử trò chuyện. Bắt đầu cuộc hội thoại mới!" });
    } catch (error) {
        console.error("❌ Lỗi xoá lịch sử chat AI:", error);
        return res.status(500).json({ success: false, error: "Không thể xoá lịch sử trò chuyện." });
    }
};