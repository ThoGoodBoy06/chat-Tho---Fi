const prisma = require("../prisma");

const { v4: uuidv4 } = require("uuid");

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const fs = require("fs");
const path = require("path");

// Khởi tạo Firebase Admin (Chỉ chạy 1 lần khi server khởi động)
if (!getApps().length) {
    try {
        const keyPathJson = path.join(__dirname, "../firebase-key.json");
        const keyPathTxt = path.join(__dirname, "../firebase-key");
        let serviceAccount;

        if (fs.existsSync(keyPathJson)) {
            serviceAccount = require(keyPathJson);
        } else if (fs.existsSync(keyPathTxt)) {
            serviceAccount = JSON.parse(fs.readFileSync(keyPathTxt, "utf8"));
        }

        if (serviceAccount) {
            initializeApp({
                credential: cert(serviceAccount),
            });
            console.log("🔥 Firebase Admin khởi tạo thành công!");
        } else {
            console.warn("⚠️ Cảnh báo: Không tìm thấy file firebase-key. Thông báo đẩy sẽ bị tắt.");
        }
    } catch (error) {
        console.error("❌ Lỗi khởi tạo Firebase Admin:", error.message);
    }
}

// 1. Lấy danh sách đoạn chat của user hiện tại

exports.getConversations = async(req, res) => {
    try {
        const userId = req.user.id; // Lấy từ Token thông qua authMiddleware

        const conversations = await prisma.conversationMembers.findMany({
            where: { userId },
            include: {
                Conversations: {
                    include: {
                        ConversationMembers: {
                            include: {
                                Users: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        isOnline: true,
                                        lastActive: true,
                                    },
                                },
                            },
                        },
                        // Lấy 1 tin nhắn mới nhất để hiển thị ở danh sách (giống Zalo)
                        Messages: {
                            where: {
                                NOT: {
                                    deletedBy: {
                                        has: userId,
                                    },
                                },
                            },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                        // Đếm số tin nhắn chưa đọc của người khác gửi bằng tính năng Relation Count của Prisma
                        _count: {
                            select: {
                                Messages: {
                                    where: {
                                        senderId: { not: userId },
                                        isRead: false,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Sắp xếp cuộc trò chuyện có tin nhắn mới nhất lên trên cùng
        conversations.sort((a, b) => {
            const getLatestTime = (member) => {
                const conv = member.Conversations;
                if (!conv) return 0; // Tránh lỗi nếu dữ liệu phòng chat bị rỗng

                // Lấy thời gian của tin nhắn mới nhất nếu có
                if (
                    conv.Messages &&
                    conv.Messages.length > 0 &&
                    conv.Messages[0].createdAt
                ) {
                    return new Date(conv.Messages[0].createdAt).getTime();
                }
                // Nếu không có tin nhắn, lấy thời gian lúc tạo phòng
                return conv.createdAt ? new Date(conv.createdAt).getTime() : 0;
            };

            return getLatestTime(b) - getLatestTime(a);
        });

        // Map avatar sang URL tĩnh mà không cần truy vấn DB lại
        const mappedConversations = conversations.map((item) => {
            if (!item.Conversations) return item;

            const conv = { ...item.Conversations };

            if (conv.ConversationMembers) {
                conv.ConversationMembers.forEach((member) => {
                    if (member.Users) {
                        member.Users.avatar = `/api/users/${member.Users.id}/avatar`;
                    }
                });
            }

            return {
                ...item,
                Conversations: conv,
            };
        });

        res.status(200).json({ success: true, data: mappedConversations });
    } catch (error) {
        console.error("!!! LỖI TẢI DANH SÁCH CUỘC TRÒ CHUYỆN:", error);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};

// 2. Lấy tin nhắn trong 1 đoạn chat (Hỗ trợ phân trang cursor-based)
// Query params:
//   - limit: số lượng tin nhắn tối đa (mặc định 50)
//   - before: ID tin nhắn cũ nhất hiện tại → load thêm tin nhắn CŨ HƠN

exports.getMessages = async(req, res) => {
    try {
        const { conversationId } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Giới hạn tối đa 100
        const before = req.query.before; // ID tin nhắn cursor (optional)

        // Lấy thông tin chủ đề của cuộc hội thoại
        const conversation = await prisma.conversations.findUnique({
            where: { id: conversationId },
            select: { theme: true },
        });
        const theme = conversation ? conversation.theme : "default";

        // Xây dựng điều kiện where
        const whereClause = {
            conversationId,
            NOT: {
                deletedBy: {
                    has: req.user.id,
                },
            },
        };

        // Nếu có cursor "before" → tìm tin nhắn có thời gian tạo TRƯỚC tin nhắn đó
        if (before) {
            const cursorMessage = await prisma.messages.findUnique({
                where: { id: before },
                select: { createdAt: true },
            });

            if (cursorMessage) {
                whereClause.createdAt = { lt: cursorMessage.createdAt };
            }
        }

        // Lấy (limit + 1) để biết có còn tin nhắn cũ hơn hay không
        const messages = await prisma.messages.findMany({
            where: whereClause,
            orderBy: { createdAt: "desc" }, // Mới nhất trước → lấy N tin mới nhất
            take: limit + 1,
            include: {
                Users: {
                    select: { id: true, fullName: true },
                },
            },
        });

        // Kiểm tra có còn trang tiếp không
        const hasMore = messages.length > limit;
        if (hasMore) messages.pop(); // Bỏ phần tử thừa

        // Đảo ngược lại thứ tự: cũ nhất trước, mới nhất sau (để frontend render đúng)
        messages.reverse();

        // Batch-fetch tin nhắn gốc (Parent Messages) để phục vụ tính năng Reply
        const replyIds = messages.map(m => m.replyMessageId).filter(Boolean);
        let parentMap = {};
        if (replyIds.length > 0) {
            try {
                const parents = await prisma.messages.findMany({
                    where: { id: { in: replyIds } },
                    include: {
                        Users: { select: { id: true, fullName: true } }
                    }
                });
                parents.forEach(p => {
                    parentMap[p.id] = {
                        id: p.id,
                        content: p.content,
                        senderId: p.senderId,
                        type: p.type,
                        isRecalled: p.isRecalled || false,
                        senderName: p.Users ? p.Users.fullName : "Người dùng"
                    };
                });
            } catch (err) {
                console.error("Lỗi khi tải thông tin trích dẫn tin nhắn gốc:", err);
            }
        }

        const mappedMessages = messages.map((m) => {
            const mapped = m.Users ? {
                ...m,
                Users: {
                    ...m.Users,
                    avatar: `/api/users/${m.Users.id}/avatar`,
                },
            } : {...m };

            if (m.replyMessageId && parentMap[m.replyMessageId]) {
                mapped.replyMessage = parentMap[m.replyMessageId];
            }
            return mapped;
        });
        // Lấy biệt danh (nicknames) của các thành viên trong cuộc hội thoại
        const membersWithNicknames = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true, nickname: true },
        });
        const nicknames = {};
        membersWithNicknames.forEach((m) => {
            if (m.nickname) nicknames[m.userId] = m.nickname;
        });

        // Kiểm tra trạng thái chặn (blockState) giữa current user và đối phương
        let blockState = { blocked: false, blockerId: null, blockedId: null };
        const otherMember = await prisma.conversationMembers.findFirst({
            where: {
                conversationId,
                userId: { not: req.user.id }
            },
            select: { userId: true }
        });

        if (otherMember) {
            const blockRecord = await prisma.block.findFirst({
                where: {
                    OR: [
                        { blockerId: req.user.id, blockedId: otherMember.userId },
                        { blockerId: otherMember.userId, blockedId: req.user.id }
                    ]
                }
            });
            if (blockRecord) {
                blockState = {
                    blocked: true,
                    blockerId: blockRecord.blockerId,
                    blockedId: blockRecord.blockedId
                };
            }
        }

        res.status(200).json({ success: true, data: mappedMessages, hasMore, theme, nicknames, blockState });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};

// 3. Gửi tin nhắn mới

exports.sendMessage = async(req, res) => {
    try {
        console.log("-----------------------------------------");

        console.log("🚀 CÓ NGƯỜI ĐANG BẤM NÚT GỬI TIN NHẮN...");

        // FIX: Bắt lót an toàn để luôn lấy đúng ID người gửi (không dùng ?. để tránh bị format lỗi)
        const senderId = req.user ? req.user.id || req.user.userId : req.userId;

        const { conversationId } = req.params;

        let { content, replyMessageId, type } = req.body;

        if (!content) {
            return res

                .status(400)

            .json({ message: "Nội dung tin nhắn không được để trống" });
        }

        let finalContent = content;

        // --- TÍCH HỢP SUPABASE STORAGE ---
        // Kiểm tra nếu tin nhắn là ảnh, âm thanh hoặc file chứa chuỗi base64
        if (type === "image" || type === "audio" || type === "file") {
            try {
                const { uploadBase64 } = require("../supabase");
                if (type === "image" && content.startsWith("data:image")) {
                    console.log("📸 Đang tải ảnh lên Supabase Storage...");
                    finalContent = await uploadBase64(content, "image");
                } else if (type === "audio" && content.startsWith("data:audio")) {
                    console.log("🎙️ Đang tải tin nhắn thoại lên Supabase Storage...");
                    finalContent = await uploadBase64(content, "audio");
                } else if (type === "file") {
                    try {
                        const fileData = JSON.parse(content);
                        if (fileData && fileData.base64 && fileData.base64.startsWith("data:")) {
                            console.log(`📁 Đang tải file lên Supabase Storage: ${fileData.fileName}`);
                            const publicUrl = await uploadBase64(fileData.base64, "file", fileData.fileName);

                            // Tạo lại JSON string mới chứa publicUrl thay vì lưu base64 nặng
                            finalContent = JSON.stringify({
                                fileName: fileData.fileName,
                                fileSize: fileData.fileSize,
                                url: publicUrl
                            });
                        }
                    } catch (jsonErr) {
                        console.error("❌ Lỗi parse JSON file payload:", jsonErr);
                    }
                }
            } catch (uploadError) {
                console.error("❌ Lỗi upload media lên Supabase (Sẽ fallback lưu base64 vào DB):", uploadError);
                // Fallback: Giữ nguyên finalContent = content để lưu base64 tránh mất tin nhắn của user
            }
        }

        // Kiểm tra xem 2 người đã chặn nhau chưa
        const conversation = await prisma.conversations.findUnique({
            where: { id: conversationId },
            include: {
                ConversationMembers: true
            }
        });

        if (conversation && conversation.type === "private") {
            const otherMember = conversation.ConversationMembers.find(m => m.userId !== senderId);
            if (otherMember) {
                const isBlocked = await prisma.block.findFirst({
                    where: {
                        OR: [
                            { blockerId: senderId, blockedId: otherMember.userId },
                            { blockerId: otherMember.userId, blockedId: senderId }
                        ]
                    }
                });

                if (isBlocked) {
                    return res.status(403).json({ success: false, message: "Không thể gửi tin nhắn do đã chặn nhau." });
                }
            }
        }

        // 1. Lưu tin nhắn vào Database

        const newMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),

                conversationId,

                senderId,

                content: finalContent,

                type: type || "text",

                replyMessageId: replyMessageId || null,
            },

            include: {
                Users: {
                    select: { id: true, fullName: true },
                },
            },
        });

        // Lấy thông tin tin nhắn gốc nếu đây là tin nhắn trả lời (Reply)
        let parentMessageObj = null;
        if (replyMessageId) {
            try {
                const parent = await prisma.messages.findUnique({
                    where: { id: replyMessageId },
                    include: {
                        Users: { select: { id: true, fullName: true } }
                    }
                });
                if (parent) {
                    parentMessageObj = {
                        id: parent.id,
                        content: parent.content,
                        senderId: parent.senderId,
                        type: parent.type,
                        isRecalled: parent.isRecalled || false,
                        senderName: parent.Users ? parent.Users.fullName : "Người dùng"
                    };
                }
            } catch (err) {
                console.error("Lỗi khi lấy thông tin tin nhắn gốc:", err);
            }
        }

        // Map avatar sang URL tĩnh
        const mappedMessage = {
            ...newMessage,
            Users: newMessage.Users ? {
                ...newMessage.Users,
                avatar: `/api/users/${newMessage.Users.id}/avatar`,
            } : null
        };
        if (parentMessageObj) {
            mappedMessage.replyMessage = parentMessageObj;
        }

        // Trả response ngay sau khi lưu DB xong (không đợi socket/FCM)
        res.status(201).json({ success: true, data: mappedMessage });

        // 2. Lấy danh sách thành viên và phát tin nhắn real-time (sau khi đã respond xong)
        const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            include: {
                Users: { select: { fcmToken: true } }
            }
        });

        // 3. Lấy Socket.IO instance và phát tin nhắn Real-time đến phòng của từng thành viên

        const io = req.app.get("io");

        members.forEach((member) => {
            io.to(member.userId).emit("receive_message", mappedMessage);

            // --- BẮN PUSH NOTIFICATION ---
            // Chỉ gửi cho người nhận (đối phương) và khi họ đã có FCM Token
            if (member.userId !== senderId && member.Users && member.Users.fcmToken) {
                let snippet = mappedMessage.content;
                if (mappedMessage.type === "file") {
                    try {
                        const fileData = JSON.parse(mappedMessage.content);
                        snippet = `[ Tệp tin: ${fileData.fileName} ]`;
                    } catch (e) {
                        snippet = "[ Tệp tin ]";
                    }
                } else if (mappedMessage.type === "audio") {
                    snippet = "[ Tin nhắn thoại ]";
                } else if (snippet.startsWith("data:image") || snippet.match(/\.(jpeg|jpg|gif|png)$/i)) {
                    snippet = "[ Hình ảnh ]";
                }

                const senderAvatar = mappedMessage.Users ? mappedMessage.Users.avatar : null;
                let avatarUrl = "https://chat-tho-fi.onrender.com/icon.png";
                if (senderAvatar) {
                    avatarUrl = senderAvatar.startsWith("http") ?
                        senderAvatar :
                        `https://chat-tho-fi.onrender.com${senderAvatar}`;
                } else {
                    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            newMessage.Users.fullName || "User"
          )}&background=random`;
                }

                const senderMember = members.find((m) => m.userId === senderId);
                const senderDisplayName = (senderMember && senderMember.nickname) || newMessage.Users.fullName || "Tin nhắn mới";

                const payload = {
                    token: member.Users.fcmToken,
                    notification: {
                        title: senderDisplayName,
                        body: snippet,
                        image: avatarUrl,
                    },
                    android: {
                        priority: "high",
                        notification: {
                            channelId: "chat_messages_v3",
                            channel_id: "chat_messages_v3",
                            sound: "amthanhtinnhan",
                            defaultVibrateTimings: true,
                        },
                    },
                    apns: {
                        headers: {
                            "apns-push-type": "alert",
                            "apns-priority": "10",
                        },
                        payload: {
                            aps: {
                                sound: "amthanhtinnhan.mp3",
                                badge: 1,
                                "content-available": 1,
                                "mutable-content": 1,
                            },
                        },
                    },
                    webpush: {
                        headers: {
                            Urgency: "high",
                        },
                        notification: {
                            icon: avatarUrl,
                            badge: "https://chat-tho-fi.onrender.com/icon.png",
                            vibrate: [400, 100, 400, 100, 600],
                            tag: String(conversationId),
                            renotify: true,
                        },
                    },
                    data: {
                        conversationId: String(conversationId),
                        senderId: String(senderId),
                        type: "chat_message",
                    },
                };

                // Gửi ngầm không cần await để tránh làm chậm tốc độ gửi tin nhắn (Chỉ gửi khi Firebase đã khởi tạo)
                if (getApps().length > 0) {
                    getMessaging().send(payload)
                        .then(() => console.log(`📲 Đã bắn Push Notification cho User ${member.userId}`))
                        .catch((err) => console.error(`❌ Lỗi gửi Push Notification:`, err.message));
                }
            }
        });

        console.log("✅ LƯU TIN NHẮN VÀO DATABASE THÀNH CÔNG!");

        console.log("-----------------------------------------");

    } catch (error) {
        // Ghi lại lỗi chi tiết ra Terminal để dễ dàng gỡ lỗi

        console.log("❌ CÓ LỖI XẢY RA KHI LƯU DATABASE:");

        console.error("!!! LỖI GỬI TIN NHẮN:", error.message);

        // **NÂNG CẤP:** Gửi thẳng lỗi chi tiết về cho trình duyệt để hiện lên Alert!

        res

            .status(500)

        .json({ message: `Lỗi từ Server: ${error.message}`, error: error });
    }
};

// 4. Tạo cuộc trò chuyện mới

exports.createConversation = async(req, res) => {
    try {
        const userId = req.user.id;

        const { receiverId } = req.body;

        if (!receiverId) {
            return res

                .status(400)

            .json({ message: "Thiếu ID người nhận (receiverId)" });
        }

        if (userId === receiverId) {
            return res

                .status(400)

            .json({ message: "Không thể tự chat với chính mình" });
        }

        // Kiểm tra xem 2 người đã từng chat với nhau chưa

        const existingConversations = await prisma.conversationMembers.findMany({
            where: { userId },
        });

        const conversationIds = existingConversations.map((c) => c.conversationId);

        const match = await prisma.conversationMembers.findFirst({
            where: {
                conversationId: { in: conversationIds },

                userId: receiverId,
            },
        });

        if (match) {
            // Đã từng chat, trả về phòng chat cũ thay vì tạo mới

            return res

                .status(200)

            .json({ success: true, data: { id: match.conversationId } });
        }

        // Tạo phòng chat và tự động thêm 2 người vào phòng

        const newConversation = await prisma.conversations.create({
            data: {
                id: uuidv4(),

                ConversationMembers: {
                    create: [
                        // Cung cấp ID tường minh cho từng thành viên trong phòng chat

                        { id: uuidv4(), userId: userId },

                        { id: uuidv4(), userId: receiverId },
                    ],
                },
            },
        });

        res.status(201).json({ success: true, data: newConversation });
    } catch (error) {
        // Ghi lại lỗi chi tiết ra Terminal để dễ dàng gỡ lỗi

        console.error("!!! LỖI TẠO CUỘC TRÒ CHUYỆN:", error);

        res

            .status(500)

        .json({ message: "Lỗi tạo cuộc trò chuyện", error: error.message });
    }
};

// 5. Thu hồi tin nhắn

exports.recallMessage = async(req, res) => {
    try {
        const userId = req.user.id;

        const { messageId } = req.params;

        // Kiểm tra xem tin nhắn có tồn tại và có phải của user này gửi không

        const message = await prisma.messages.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
        }

        if (message.senderId !== userId) {
            return res.status(403).json({
                message: "Bạn không có quyền thu hồi tin nhắn của người khác",
            });
        }

        // Cập nhật trạng thái thu hồi vào Database

        const updatedMessage = await prisma.messages.update({
            where: { id: messageId },

            data: { isRecalled: true },
        });

        // Lấy danh sách thành viên trong cuộc trò chuyện để gửi Socket

        const members = await prisma.conversationMembers.findMany({
            where: { conversationId: message.conversationId },
        });

        const io = req.app.get("io");

        members.forEach((member) => {
            io.to(member.userId).emit("message_recalled", {
                messageId: messageId,

                conversationId: message.conversationId,

                data: updatedMessage,
            });
        });

        res.status(200).json({ success: true, data: updatedMessage });
    } catch (error) {
        console.error("!!! LỖI THU HỒI TIN NHẮN:", error);

        res

            .status(500)

        .json({ message: "Lỗi thu hồi tin nhắn", error: error.message });
    }
};

// 5.5 Sửa tin nhắn
exports.editMessage = async(req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { newContent } = req.body;

        if (!newContent || newContent.trim() === "") {
            return res.status(400).json({ message: "Nội dung tin nhắn không được để trống" });
        }

        const message = await prisma.messages.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
        }

        if (message.senderId !== userId) {
            return res.status(403).json({
                message: "Bạn không có quyền chỉnh sửa tin nhắn của người khác",
            });
        }

        if (message.isRecalled) {
            return res.status(400).json({ message: "Không thể chỉnh sửa tin nhắn đã bị thu hồi" });
        }

        const updatedMessage = await prisma.messages.update({
            where: { id: messageId },
            data: {
                content: newContent,
                isEdited: true,
                updatedAt: new Date(),
            },
        });

        const members = await prisma.conversationMembers.findMany({
            where: { conversationId: message.conversationId },
        });

        const io = req.app.get("io");
        members.forEach((member) => {
            io.to(member.userId).emit("message_edited", {
                messageId: messageId,
                conversationId: message.conversationId,
                newContent: newContent,
                data: updatedMessage,
            });
        });

        res.status(200).json({ success: true, data: updatedMessage });
    } catch (error) {
        console.error("!!! LỖI CHỈNH SỬA TIN NHẮN:", error);
        res.status(500).json({ message: "Lỗi chỉnh sửa tin nhắn", error: error.message });
    }
};

// 6. Thả cảm xúc vào tin nhắn

exports.reactToMessage = async(req, res) => {
    try {
        console.log("✅ API /react ĐÃ ĐƯỢC GỌI!"); // Thêm log để kiểm tra

        const userId = req.user.id;

        const { messageId } = req.params;

        const { reaction } = req.body; // reaction là emoji, ví dụ: '👍'

        if (!reaction) {
            return res.status(400).json({ message: "Thiếu icon cảm xúc" });
        }

        const message = await prisma.messages.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
        }

        // Lấy object reactions hiện tại, hoặc tạo mới nếu chưa có

        let currentReactions = message.reactions;

        if (typeof currentReactions === "string") {
            try {
                currentReactions = JSON.parse(currentReactions);
            } catch (e) {}
        }

        currentReactions =
            typeof currentReactions === "object" && currentReactions !== null ?
            currentReactions :
            {};

        // Nếu user đã react icon này rồi -> bỏ react. Ngược lại -> thêm/cập nhật react

        if (currentReactions[userId] === reaction) {
            delete currentReactions[userId];
        } else {
            currentReactions[userId] = reaction;
        }

        // Cập nhật lại DB

        const updatedMessage = await prisma.messages.update({
            where: { id: messageId },

            // Phải chuyển Object thành Chuỗi JSON thì CSDL mới cho phép lưu
            data: { reactions: JSON.stringify(currentReactions) },
        });

        // Lấy danh sách thành viên trong cuộc trò chuyện

        const members = await prisma.conversationMembers.findMany({
            where: { conversationId: message.conversationId },
        });

        const isRemoved = currentReactions[userId] === undefined;

        // Phát tín hiệu socket đến tất cả thành viên trong phòng chat

        const io = req.app.get("io");

        members.forEach((member) => {
            io.to(member.userId).emit("message_reacted", {
                messageId: messageId,

                conversationId: message.conversationId,

                reactions: currentReactions,
                reaction: reaction,
                userId: userId,
                isRemoved: isRemoved,

                data: updatedMessage,
            });
        });

        res.status(200).json({
            success: true,
            reactions: currentReactions,
            data: updatedMessage,
        });
    } catch (error) {
        console.error("!!! LỖI THẢ CẢM XÚC:", error);

        res.status(500).json({ message: "Lỗi thả cảm xúc", error: error.message });
    }
};

/**
 * Hàm gửi Push Notification sử dụng Firebase Admin SDK
 * @param {string} fcmToken - Token FCM của thiết bị nhận
 * @param {string} title - Tiêu đề thông báo
 * @param {string} body - Nội dung thông báo
 * @param {object} customData - Dữ liệu tùy chỉnh gửi kèm
 */
exports.sendPushNotification = async(fcmToken, title, body, customData = null, dataOnly = false) => {
    if (getApps().length === 0) {
        console.warn("⚠️ Firebase Admin chưa được khởi tạo. Không thể gửi thông báo.");
        return;
    }

    const payload = {
        token: fcmToken,
        android: {
            priority: "high",
            notification: {
                channelId: dataOnly ? "incoming_calls_v3" : "chat_messages_v3",
                channel_id: dataOnly ? "incoming_calls_v3" : "chat_messages_v3",
                sound: dataOnly ? "ringtone" : "amthanhtinnhan",
                defaultVibrateTimings: true,
            },
        },
        apns: {
            headers: {
                "apns-push-type": "alert",
                "apns-priority": "10",
            },
            payload: {
                aps: {
                    sound: dataOnly ? "ringtone.mp3" : "amthanhtinnhan.mp3",
                    badge: 1,
                    "content-available": 1,
                    "mutable-content": 1,
                }
            }
        },
        webpush: {
            headers: {
                Urgency: "high"
            }
        },
        data: {
            ...(customData || {}),
            title: title,
            body: body
        }
    };

    if (!dataOnly) {
        payload.notification = {
            title: title,
            body: body,
            image: "https://chat-tho-fi.onrender.com/icon.png"
        };
        payload.webpush.notification = {
            icon: "https://chat-tho-fi.onrender.com/icon.png",
            badge: "https://chat-tho-fi.onrender.com/icon.png",
            vibrate: [1000, 500, 1000, 500, 1000],
            requireInteraction: true
        };
    }

    try {
        const response = await getMessaging().send(payload);
        console.log("📲 Đã gửi Push Notification thành công:", response);
        return response;
    } catch (error) {
        console.error("❌ Lỗi gửi Push Notification qua Firebase Admin:", error.message);
        throw error;
    }
};

// 15. Thay đổi chủ đề cuộc trò chuyện (Chat Theme)
exports.changeConversationTheme = async(req, res) => {
    try {
        const { conversationId } = req.params;
        const { theme } = req.body;
        const userId = req.user.id;

        if (!theme) {
            return res.status(400).json({ success: false, message: "Thiếu tên chủ đề." });
        }

        // 1. Kiểm tra quyền thành viên
        const membership = await prisma.conversationMembers.findFirst({
            where: {
                conversationId,
                userId,
            },
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền thay đổi chủ đề cuộc trò chuyện này.",
            });
        }

        // 2. Cập nhật chủ đề trong database
        await prisma.conversations.update({
            where: { id: conversationId },
            data: { theme },
        });

        // 3. Tạo tin nhắn hệ thống ghi nhận việc đổi chủ đề
        const themeNames = {
            default: "Tho-Fi Classic",
            ocean: "Đại dương",
            sunset: "Hoàng hôn",
            lavender: "Oải hương",
            forest: "Rừng già",
            rose: "Hoa hồng",
            cyberpunk: "Tương lai",
            midnight: "Nửa đêm",
        };
        const themeName = themeNames[theme] || theme;

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { fullName: true },
        });
        const userName = user ? user.fullName : "Người dùng";
        const systemContent = `${userName} đã thay đổi chủ đề cuộc trò chuyện thành ${themeName}.`;

        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId,
                senderId: userId,
                content: systemContent,
                type: "system",
            },
            include: {
                Users: {
                    select: { id: true, fullName: true },
                },
            },
        });

        // Map avatar tĩnh cho systemMessage (nếu có user)
        const mappedSystemMessage = {
            ...systemMessage,
            Users: systemMessage.Users ? {
                ...systemMessage.Users,
                avatar: `/api/users/${systemMessage.Users.id}/avatar`,
            } : null
        };

        // 4. Phát tín hiệu socket tới tất cả thành viên trong phòng chat
        const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true },
        });

        const io = req.app.get("io");
        members.forEach((m) => {
            io.to(m.userId).emit("conversation_theme_changed", {
                conversationId,
                theme,
                systemMessage: mappedSystemMessage,
            });
        });

        res.status(200).json({
            success: true,
            message: "Thay đổi chủ đề cuộc trò chuyện thành công.",
            theme,
            systemMessage: mappedSystemMessage,
        });
    } catch (error) {
        console.error("❌ Lỗi khi thay đổi chủ đề chat:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi thay đổi chủ đề chat.",
            error: error.message,
        });
    }
};

// 14. Xoá cuộc hội thoại (xoá tất cả tin nhắn, thành viên, và phòng chat)
exports.deleteConversation = async(req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        // 1. Kiểm tra quyền sở hữu/thành viên
        const membership = await prisma.conversationMembers.findFirst({
            where: {
                conversationId,
                userId,
            },
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền xoá cuộc hội thoại này.",
            });
        }

        // 2. Lấy danh sách thành viên trước khi xoá để báo hiệu qua socket
        const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true },
        });

        // 3. Xoá trong Transaction
        await prisma.$transaction([
            prisma.messages.deleteMany({ where: { conversationId } }),
            prisma.conversationMembers.deleteMany({ where: { conversationId } }),
            prisma.conversations.delete({ where: { id: conversationId } }),
        ]);

        // 4. Phát tín hiệu socket tới các thành viên để tự động xoá trên giao diện
        const io = req.app.get("io");
        members.forEach((m) => {
            io.to(m.userId).emit("conversation_deleted", { conversationId });
        });

        res.status(200).json({
            success: true,
            message: "Đã xoá cuộc hội thoại thành công.",
        });
    } catch (error) {
        console.error("❌ Lỗi khi xoá cuộc hội thoại:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi xoá cuộc hội thoại.",
            error: error.message,
        });
    }
};

// 10. Đặt / Xóa biệt danh (Nickname) cho thành viên trong cuộc trò chuyện

exports.setNickname = async(req, res) => {
    try {
        const { conversationId } = req.params;
        const { targetUserId, nickname } = req.body;
        const userId = req.user.id;

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: "Thiếu targetUserId." });
        }

        // 1. Kiểm tra quyền thành viên của người thực hiện
        const membership = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId },
        });

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "Bạn không phải thành viên cuộc trò chuyện này.",
            });
        }

        // 2. Tìm bản ghi thành viên của người được đặt biệt danh
        const targetMembership = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId: targetUserId },
        });

        if (!targetMembership) {
            return res.status(404).json({
                success: false,
                message: "Người dùng mục tiêu không phải thành viên cuộc trò chuyện.",
            });
        }

        // 3. Cập nhật biệt danh (nickname = null hoặc "" để xóa)
        const cleanNickname = nickname && nickname.trim() !== "" ? nickname.trim() : null;

        await prisma.conversationMembers.update({
            where: { id: targetMembership.id },
            data: { nickname: cleanNickname },
        });

        // 4. Lấy tên thật của người thực hiện và người được đặt biệt danh
        const [actor, target] = await Promise.all([
            prisma.users.findUnique({ where: { id: userId }, select: { fullName: true } }),
            prisma.users.findUnique({ where: { id: targetUserId }, select: { fullName: true } }),
        ]);

        const actorName = actor ? actor.fullName : "Người dùng";
        const targetName = target ? target.fullName : "Người dùng";

        // 5. Tạo tin nhắn hệ thống
        let systemContent;
        if (cleanNickname) {
            if (targetUserId === userId) {
                systemContent = `${actorName} đã đặt biệt danh của mình là ${cleanNickname}.`;
            } else {
                systemContent = `${actorName} đã đặt biệt danh cho ${targetName} là ${cleanNickname}.`;
            }
        } else {
            if (targetUserId === userId) {
                systemContent = `${actorName} đã xóa biệt danh của mình.`;
            } else {
                systemContent = `${actorName} đã xóa biệt danh của ${targetName}.`;
            }
        }

        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId,
                senderId: userId,
                content: systemContent,
                type: "system",
            },
            include: {
                Users: {
                    select: { id: true, fullName: true },
                },
            },
        });

        const mappedSystemMessage = {
            ...systemMessage,
            Users: systemMessage.Users ?
                {...systemMessage.Users, avatar: `/api/users/${systemMessage.Users.id}/avatar` } :
                null,
        };

        // 6. Phát socket event tới tất cả thành viên
        const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true, nickname: true },
        });

        const io = req.app.get("io");

        // Tạo map nicknames mới
        const nicknames = {};
        members.forEach((m) => {
            if (m.nickname) nicknames[m.userId] = m.nickname;
        });

        members.forEach((m) => {
            io.to(m.userId).emit("nickname_changed", {
                conversationId,
                targetUserId,
                nickname: cleanNickname,
                nicknames,
                systemMessage: mappedSystemMessage,
            });
        });

        res.status(200).json({
            success: true,
            message: cleanNickname ? "Đặt biệt danh thành công." : "Đã xóa biệt danh.",
            nickname: cleanNickname,
            nicknames,
        });
    } catch (error) {
        console.error("❌ Lỗi khi đặt biệt danh:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi đặt biệt danh.",
            error: error.message,
        });
    }
};

// 7. Xóa tin nhắn ở phía tôi (Delete for me)
exports.deleteMessageForMe = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        const message = await prisma.messages.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tin nhắn.",
            });
        }

        // Kiểm tra xem user đã xóa chưa để tránh duplicate trong mảng
        if (!message.deletedBy.includes(userId)) {
            await prisma.messages.update({
                where: { id: messageId },
                data: {
                    deletedBy: {
                        push: userId,
                    },
                },
            });
        }

        res.status(200).json({
            success: true,
            message: "Đã ẩn tin nhắn ở phía bạn.",
        });
    } catch (error) {
        console.error("❌ Lỗi khi xóa tin nhắn ở phía tôi:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi xóa tin nhắn.",
            error: error.message,
        });
    }
};

// ═══════════════════════════════════════════════════════
// 9. GHIM TIN NHẮN (Pin / Unpin Message)
// Tối đa 3 tin nhắn ghim trong mỗi phòng chat
// ═══════════════════════════════════════════════════════

exports.pinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user ? req.user.id : req.userId;

        const message = await prisma.messages.findUnique({ where: { id: messageId } });
        if (!message) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn." });
        }

        // Nếu tin nhắn đang ghim → bỏ ghim
        if (message.isPinned) {
            await prisma.messages.update({
                where: { id: messageId },
                data: { isPinned: false, pinnedAt: null },
            });

            // Phát socket event bỏ ghim
            const io = req.app.get("io");
            if (io) {
                io.to(message.conversationId).emit("message_unpinned", { messageId, conversationId: message.conversationId });
            }

            return res.status(200).json({ success: true, message: "Đã bỏ ghim tin nhắn.", pinned: false });
        }

        // Kiểm tra số lượng tin nhắn đang ghim (tối đa 3)
        const pinnedCount = await prisma.messages.count({
            where: { conversationId: message.conversationId, isPinned: true },
        });

        if (pinnedCount >= 3) {
            return res.status(400).json({ success: false, message: "Chỉ được ghim tối đa 3 tin nhắn trong mỗi đoạn chat." });
        }

        // Ghim tin nhắn
        const updatedMessage = await prisma.messages.update({
            where: { id: messageId },
            data: { isPinned: true, pinnedAt: new Date() },
            include: { Users: { select: { id: true, fullName: true } } },
        });

        // Phát socket event ghim
        const io = req.app.get("io");
        if (io) {
            io.to(message.conversationId).emit("message_pinned", {
                messageId,
                conversationId: message.conversationId,
                content: updatedMessage.content,
                type: updatedMessage.type,
                senderName: updatedMessage.Users ? updatedMessage.Users.fullName : "Người dùng",
                pinnedAt: updatedMessage.pinnedAt,
            });
        }

        return res.status(200).json({ success: true, message: "Đã ghim tin nhắn.", pinned: true });
    } catch (error) {
        console.error("❌ Lỗi khi ghim tin nhắn:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi ghim tin nhắn.", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════
// 10. LẤY DANH SÁCH TIN NHẮN GHIM (Get Pinned Messages)
// ═══════════════════════════════════════════════════════

exports.getPinnedMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const pinnedMessages = await prisma.messages.findMany({
            where: { conversationId, isPinned: true, isRecalled: false },
            orderBy: { pinnedAt: "desc" },
            include: { Users: { select: { id: true, fullName: true } } },
        });

        const mapped = pinnedMessages.map((m) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            senderName: m.Users ? m.Users.fullName : "Người dùng",
            pinnedAt: m.pinnedAt,
            createdAt: m.createdAt,
        }));

        res.status(200).json({ success: true, data: mapped });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách tin nhắn ghim:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════
// 11. TÌM KIẾM TIN NHẮN (Search Messages in Conversation)
// ═══════════════════════════════════════════════════════

exports.searchMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const q = req.query.q || "";
        const userId = req.user ? req.user.id : req.userId;

        if (!q.trim()) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập từ khóa tìm kiếm." });
        }

        const results = await prisma.messages.findMany({
            where: {
                conversationId,
                isRecalled: false,
                type: "text",
                content: { contains: q, mode: "insensitive" },
                NOT: { deletedBy: { has: userId } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { Users: { select: { id: true, fullName: true } } },
        });

        const mapped = results.map((m) => ({
            id: m.id,
            content: m.content,
            senderId: m.senderId,
            senderName: m.Users ? m.Users.fullName : "Người dùng",
            createdAt: m.createdAt,
        }));

        res.status(200).json({ success: true, data: mapped, total: mapped.length });
    } catch (error) {
        console.error("❌ Lỗi khi tìm kiếm tin nhắn:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════
// 12. CHUYỂN TIẾP TIN NHẮN (Forward Message)
// Cho phép forward 1 tin nhắn tới nhiều cuộc hội thoại
// ═══════════════════════════════════════════════════════

exports.forwardMessage = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { messageId, conversationIds } = req.body;

        if (!messageId || !conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin tin nhắn hoặc danh sách hội thoại." });
        }

        // Lấy tin nhắn gốc
        const originalMessage = await prisma.messages.findUnique({ where: { id: messageId } });
        if (!originalMessage) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn gốc." });
        }
        if (originalMessage.isRecalled) {
            return res.status(400).json({ success: false, message: "Không thể chuyển tiếp tin nhắn đã thu hồi." });
        }

        const { v4: uuidv4 } = require("uuid");
        const io = req.app.get("io");
        const forwardedMessages = [];

        for (const convId of conversationIds) {
            const newMsg = await prisma.messages.create({
                data: {
                    id: uuidv4(),
                    conversationId: convId,
                    senderId: userId,
                    content: originalMessage.content,
                    type: originalMessage.type,
                    isForwarded: true, // 🌟 Đánh dấu là tin nhắn chuyển tiếp
                },
                include: { Users: { select: { id: true, fullName: true } } },
            });

            const mapped = {
                ...newMsg,
                Users: newMsg.Users ? { ...newMsg.Users, avatar: `/api/users/${newMsg.Users.id}/avatar` } : null,
            };

            forwardedMessages.push(mapped);

            // Phát socket event đến tất cả thành viên trong phòng nhận
            if (io) {
                const members = await prisma.conversationMembers.findMany({
                    where: { conversationId: convId },
                    select: { userId: true },
                });
                members.forEach((member) => {
                    io.to(member.userId).emit("receive_message", mapped);
                });
            }
        }

        res.status(201).json({ success: true, data: forwardedMessages, message: `Đã chuyển tiếp tin nhắn tới ${conversationIds.length} cuộc hội thoại.` });
    } catch (error) {
        console.error("❌ Lỗi khi chuyển tiếp tin nhắn:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════
// 13. XEM TRƯỚC LIÊN KẾT (Link Preview)
// Cào metadata (og:title, og:image, og:description) từ URL
// ═══════════════════════════════════════════════════════

exports.getLinkPreview = async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ success: false, message: "Thiếu URL." });
        }

        // Fetch HTML content từ URL
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ThoFiBot/1.0)" },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return res.status(400).json({ success: false, message: "Không thể truy cập URL." });
        }

        const html = await response.text();

        // Parse Open Graph và meta tags
        const getMetaContent = (html, property) => {
            // Thử og:property trước
            const ogRegex = new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, "i");
            let match = html.match(ogRegex);
            if (match) return match[1];

            // Thử content trước property (thứ tự thuộc tính đảo ngược)
            const ogRegex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, "i");
            match = html.match(ogRegex2);
            if (match) return match[1];

            // Fallback: meta name
            const nameRegex = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
            match = html.match(nameRegex);
            if (match) return match[1];

            return null;
        };

        // Lấy title từ <title> tag nếu og:title không có
        const titleTagMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

        const preview = {
            title: getMetaContent(html, "title") || (titleTagMatch ? titleTagMatch[1].trim() : ""),
            description: getMetaContent(html, "description") || "",
            image: getMetaContent(html, "image") || "",
            url: url,
            siteName: getMetaContent(html, "site_name") || "",
        };

        res.status(200).json({ success: true, data: preview });
    } catch (error) {
        console.error("❌ Lỗi khi lấy link preview:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

exports.blockUser = async (req, res) => {
    try {
        const blockerId = req.user.id;
        const { targetUserId, action } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: "Thiếu ID người dùng mục tiêu" });
        }

        if (blockerId === targetUserId) {
            return res.status(400).json({ success: false, message: "Không thể tự chặn chính mình" });
        }

        if (action === "block") {
            const existing = await prisma.block.findUnique({
                where: {
                    blockerId_blockedId: { blockerId, blockedId: targetUserId }
                }
            });

            if (!existing) {
                await prisma.block.create({
                    data: {
                        blockerId,
                        blockedId: targetUserId
                    }
                });
            }

            // Find private conversation to add a system message
            const existingConversations = await prisma.conversationMembers.findMany({
                where: { userId: blockerId },
                select: { conversationId: true }
            });
            const conversationIds = existingConversations.map((c) => c.conversationId).filter(Boolean);

            const match = await prisma.conversationMembers.findFirst({
                where: {
                    conversationId: { in: conversationIds },
                    userId: targetUserId,
                },
                include: {
                    Conversations: true
                }
            });

            const blockerUser = await prisma.users.findUnique({
                where: { id: blockerId },
                select: { fullName: true }
            });
            const blockerName = blockerUser ? blockerUser.fullName : "Người dùng";

            let systemMessage = null;
            if (match && match.Conversations && match.Conversations.type === "private") {
                const systemContent = `${blockerName} đã chặn cuộc trò chuyện này.`;
                systemMessage = await prisma.messages.create({
                    data: {
                        id: uuidv4(),
                        conversationId: match.conversationId,
                        senderId: blockerId,
                        content: systemContent,
                        type: "system",
                    }
                });
            }

            // Emit socket event to notify both users
            const io = req.app.get("io");
            if (io) {
                io.to(targetUserId).emit("block_status_changed", {
                    blockerId,
                    blockedId: targetUserId,
                    action: "block"
                });
                io.to(blockerId).emit("block_status_changed", {
                    blockerId,
                    blockedId: targetUserId,
                    action: "block"
                });
                if (systemMessage) {
                    io.to(targetUserId).emit("receive_message", systemMessage);
                    io.to(blockerId).emit("receive_message", systemMessage);
                }
            }

            return res.status(200).json({ success: true, message: "Đã chặn người dùng", systemMessage });
        } else if (action === "unblock") {
            try {
                await prisma.block.delete({
                    where: {
                        blockerId_blockedId: { blockerId, blockedId: targetUserId }
                    }
                });
            } catch (err) {
                // Ignore if not exists
            }

            // Find private conversation to add a system message
            const existingConversations = await prisma.conversationMembers.findMany({
                where: { userId: blockerId },
                select: { conversationId: true }
            });
            const conversationIds = existingConversations.map((c) => c.conversationId).filter(Boolean);

            const match = await prisma.conversationMembers.findFirst({
                where: {
                    conversationId: { in: conversationIds },
                    userId: targetUserId,
                },
                include: {
                    Conversations: true
                }
            });

            const blockerUser = await prisma.users.findUnique({
                where: { id: blockerId },
                select: { fullName: true }
            });
            const blockerName = blockerUser ? blockerUser.fullName : "Người dùng";

            let systemMessage = null;
            if (match && match.Conversations && match.Conversations.type === "private") {
                const systemContent = `${blockerName} đã bỏ chặn cuộc trò chuyện này.`;
                systemMessage = await prisma.messages.create({
                    data: {
                        id: uuidv4(),
                        conversationId: match.conversationId,
                        senderId: blockerId,
                        content: systemContent,
                        type: "system",
                    }
                });
            }

            // Emit socket event to notify both users
            const io = req.app.get("io");
            if (io) {
                io.to(targetUserId).emit("block_status_changed", {
                    blockerId,
                    blockedId: targetUserId,
                    action: "unblock"
                });
                io.to(blockerId).emit("block_status_changed", {
                    blockerId,
                    blockedId: targetUserId,
                    action: "unblock"
                });
                if (systemMessage) {
                    io.to(targetUserId).emit("receive_message", systemMessage);
                    io.to(blockerId).emit("receive_message", systemMessage);
                }
            }

            return res.status(200).json({ success: true, message: "Đã bỏ chặn người dùng", systemMessage });
        } else {
            return res.status(400).json({ success: false, message: "Hành động không hợp lệ" });
        }
    } catch (error) {
        console.error("Lỗi khi xử lý chặn/bỏ chặn:", error);
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};