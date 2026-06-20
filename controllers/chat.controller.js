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

exports.getConversations = async (req, res) => {
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

                    avatar: true,

                    isOnline: true,
                  },
                },
              },
            },

            // Lấy 1 tin nhắn mới nhất để hiển thị ở danh sách (giống Zalo)

            Messages: {
              orderBy: { createdAt: "desc" },

              take: 1,
            },

            // NÂNG CẤP: Đếm số lượng tin nhắn chưa đọc của đối phương gửi
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

    // NÂNG CẤP: Sắp xếp cuộc trò chuyện có tin nhắn mới nhất lên trên cùng
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

    // Map avatar sang URL tĩnh để giảm tải RAM cho JSON response
    const mappedConversations = conversations.map((item) => {
      if (item.Conversations && item.Conversations.ConversationMembers) {
        item.Conversations.ConversationMembers.forEach((member) => {
          if (member.Users) {
            member.Users.avatar = member.Users.avatar
              ? `/api/users/${member.Users.id}/avatar`
              : null;
          }
        });
      }
      return item;
    });

    res.status(200).json({ success: true, data: mappedConversations });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 2. Lấy nội dung toàn bộ tin nhắn trong 1 đoạn chat

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await prisma.messages.findMany({
      where: { conversationId },

      orderBy: { createdAt: "asc" }, // Cũ nhất xếp trước, mới nhất xếp sau

      include: {
        Users: {
          select: { id: true, fullName: true, avatar: true },
        },
      },
    });

    const mappedMessages = messages.map((m) => {
      if (m.Users) {
        return {
          ...m,
          Users: {
            ...m.Users,
            avatar: m.Users.avatar ? `/api/users/${m.Users.id}/avatar` : null,
          },
        };
      }
      return m;
    });

    res.status(200).json({ success: true, data: mappedMessages });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 3. Gửi tin nhắn mới

exports.sendMessage = async (req, res) => {
  try {
    console.log("-----------------------------------------");

    console.log("🚀 CÓ NGƯỜI ĐANG BẤM NÚT GỬI TIN NHẮN...");

    // FIX: Bắt lót an toàn để luôn lấy đúng ID người gửi (không dùng ?. để tránh bị format lỗi)
    const senderId = req.user ? req.user.id || req.user.userId : req.userId;

    const { conversationId } = req.params;

    const { content, replyMessageId, type } = req.body;

    if (!content) {
      return res

        .status(400)

        .json({ message: "Nội dung tin nhắn không được để trống" });
    }

    // 1. Lưu tin nhắn vào Database

    const newMessage = await prisma.messages.create({
      data: {
        id: uuidv4(),

        conversationId,

        senderId,

        content,

        type: type || "text",

        replyMessageId: replyMessageId || null,
      },

      include: {
        Users: {
          select: { id: true, fullName: true, avatar: true },
        },
      },
    });

    // Map avatar sang URL tĩnh
    const mappedMessage = {
      ...newMessage,
      Users: newMessage.Users ? {
        ...newMessage.Users,
        avatar: newMessage.Users.avatar ? `/api/users/${newMessage.Users.id}/avatar` : null,
      } : null
    };

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
          avatarUrl = senderAvatar.startsWith("http")
            ? senderAvatar
            : `https://chat-tho-fi.onrender.com${senderAvatar}`;
        } else {
          avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            newMessage.Users.fullName || "User"
          )}&background=random`;
        }

        const payload = {
          token: member.Users.fcmToken,
          notification: {
            title: newMessage.Users.fullName || "Tin nhắn mới",
            body: snippet,
            image: avatarUrl,
          },
          android: {
            priority: "high",
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
          webpush: {
            notification: {
              icon: avatarUrl,
              badge: "https://chat-tho-fi.onrender.com/icon.png",
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

exports.createConversation = async (req, res) => {
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

exports.recallMessage = async (req, res) => {
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

// 6. Thả cảm xúc vào tin nhắn

exports.reactToMessage = async (req, res) => {
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
      typeof currentReactions === "object" && currentReactions !== null
        ? currentReactions
        : {};

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

    // Phát tín hiệu socket đến tất cả thành viên trong phòng chat

    const io = req.app.get("io");

    members.forEach((member) => {
      io.to(member.userId).emit("message_reacted", {
        messageId: messageId,

        conversationId: message.conversationId,

        reactions: currentReactions,

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
