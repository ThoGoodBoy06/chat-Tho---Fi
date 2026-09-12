const prisma = require("../prisma");
const { v4: uuidv4 } = require("uuid");
const { sendPushNotification } = require("../controllers/chat.controller");

const jwt = require("jsonwebtoken");

module.exports = (io) => {
  // Biến này để lưu trữ id người dùng và socket id của họ (để biết gửi tin nhắn cho ai)
  const userSockets = new Map();
  // Gắn map vào instance 'io' để các route handler có thể truy cập
  io.userSockets = userSockets;

  // Cache để tránh gọi DB update isOnline liên tục trong thời gian ngắn (Debounce 60 giây)
  const lastOnlineUpdateMap = new Map();
  // Lưu các cặp cuộc gọi đang diễn ra để tự động tắt cả 2 bên nếu 1 bên cúp máy hoặc mất mạng
  const activeCalls = new Map();

  async function handleUserConnect(socket, userId) {
    if (!userId) return;
    // Nếu socket này đã được thiết lập cho user này rồi thì không chạy lại để tránh loop
    if (socket.userId === userId && userSockets.get(userId) === socket.id) {
      return;
    }
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(userId);

    // Chạy song song không block: Lấy conversations & pending friend requests
    Promise.all([
      prisma.conversationMembers.findMany({
        where: { userId },
        select: { conversationId: true },
      }).catch(() => []),
      prisma.friendRequests.findMany({
        where: { receiverId: userId, status: "PENDING" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          requester: {
            select: { id: true, fullName: true },
          },
        },
      }).catch(() => []),
    ]).then(([conversations, pendingRequests]) => {
      conversations.forEach((conv) => {
        socket.join(conv.conversationId);
      });

      if (pendingRequests && pendingRequests.length > 0) {
        const mappedPending = pendingRequests.map((r) => {
          if (r.requester) {
            r.requester.avatar = `/api/users/${r.requester.id}/avatar`;
          }
          return r;
        });
        socket.emit("initial_friend_requests", mappedPending);
      }
    }).catch(() => {});

    // Báo trạng thái online cho mọi người ngay lập tức
    io.emit("user_status_changed", { userId, isOnline: true });
  }

  io.on("connection", async (socket) => {
    console.log("⚡ Một thiết bị vừa kết nối với Socket: " + socket.id);

    // Tự động xác thực qua token nếu được truyền trong handshake
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey_chat_tho_fi");
        const userId = decoded.id || decoded.userId;
        if (userId) {
          handleUserConnect(socket, userId);
        }
      } catch (e) {}
    }

    // 1. Lắng nghe khi người dùng đăng nhập app thành công
    socket.on("user_connected", (userId) => {
      handleUserConnect(socket, userId);
    });

    // Lắng nghe khi client yêu cầu tham gia phòng trò chuyện (như khi được thêm vào nhóm)
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    // Alias: join_room (cho Flutter Web client)
    socket.on("join_room", (roomId) => {
      socket.join(roomId);
    });

    // 1b. Lắng nghe khi người dùng chuyển ứng dụng chạy ngầm (go_offline)
    socket.on("go_offline", () => {
      if (!socket.userId) return;
      const lastActiveTime = new Date();
      const payload = {
        userId: socket.userId,
        isOnline: false,
        lastActive: lastActiveTime.toISOString()
      };
      io.emit("user_status_changed", payload);
      io.emit("user_status_change", payload);
      console.log(`👤 User ${socket.userId} chạy ngầm (Offline).`);
    });

    // 1c. Lắng nghe khi người dùng mở lại app (go_online)
    socket.on("go_online", () => {
      if (!socket.userId) return;
      io.emit("user_status_changed", { userId: socket.userId, isOnline: true });
      io.emit("user_status_change", { userId: socket.userId, isOnline: true });
      console.log(`👤 User ${socket.userId} mở lại app (Online).`);
    });

    // 2. Lắng nghe khi người dùng tắt app hoặc mất mạng
    socket.on("disconnect", () => {
      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);
      if (socket.userId) {
        // Chỉ xóa khỏi map nếu socket.id đang ngắt kết nối là socket đang lưu trữ trong map
        if (userSockets.get(socket.userId) === socket.id) {
          userSockets.delete(socket.userId);
        }

        // Kiểm tra xem người dùng này còn bất kỳ socket kết nối nào khác không (thông qua room của họ)
        const userRoom = io.sockets.adapter.rooms.get(socket.userId);
        const hasRemainingSockets = userRoom && userRoom.size > 0;

        // Báo cho mọi người biết ngay lập tức (In-Memory, siêu tốc 0ms)
        if (!hasRemainingSockets) {
          const lastActiveTime = new Date();
          const payload = {
            userId: socket.userId,
            isOnline: false,
            lastActive: lastActiveTime.toISOString()
          };
          io.emit("user_status_changed", payload);
          io.emit("user_status_change", payload);
        }
      }
    });

    // 3. Lắng nghe đổi biệt danh (Nicknames)
    const handleUpdateNickname = async (data) => {
      if (!data) return;
      let d = data;
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch (e) {}
      }
      const conversationId = d.conversationId || d.conversation_id;
      const targetUserId = d.targetUserId || d.userId;
      const rawNick = d.newNickname !== undefined ? d.newNickname : d.nickname;
      if (!conversationId || !targetUserId) return;

      try {
        const actorId = socket.userId || d.actorId || d.senderId;
        const nickToSet = (rawNick && typeof rawNick === "string" && rawNick.trim().length > 0) ? rawNick.trim() : null;

        // 1. Cập nhật ConversationMembers
        const targetMember = await prisma.conversationMembers.findFirst({
          where: { conversationId, userId: targetUserId },
        });
        if (targetMember) {
          await prisma.conversationMembers.update({
            where: { id: targetMember.id },
            data: { nickname: nickToSet },
          });
        }

        // 2. Cập nhật Conversations.nicknames (JSON)
        const conv = await prisma.conversations.findUnique({
          where: { id: conversationId },
          select: { nicknames: true },
        });
        let nicknames = {};
        if (conv && conv.nicknames) {
          try {
            nicknames = (typeof conv.nicknames === "string") ? JSON.parse(conv.nicknames) : conv.nicknames;
          } catch (_) { nicknames = {}; }
        }
        if (nickToSet) {
          nicknames[targetUserId] = nickToSet;
        } else {
          delete nicknames[targetUserId];
        }
        await prisma.conversations.update({
          where: { id: conversationId },
          data: { nicknames: nicknames },
        });

        // 3. Xóa cache danh sách chat
        try {
          const chatCtrl = require("../controllers/chat.controller");
          if (chatCtrl.conversationsCache) chatCtrl.conversationsCache.clear();
        } catch (e) {}

        // 4. Kiểm tra chống tạo trùng lặp tin nhắn hệ thống (nếu vừa tạo trong 4 giây qua)
        let mappedSystemMessage = null;
        let isNewSysMsg = false;
        const recentSysMsg = await prisma.messages.findFirst({
          where: {
            conversationId,
            type: "system",
            content: { contains: targetUserId },
            createdAt: { gte: new Date(Date.now() - 4000) },
          },
          include: {
            Users: { select: { id: true, fullName: true } },
          },
        });

        if (recentSysMsg) {
          mappedSystemMessage = {
            ...recentSysMsg,
            Users: recentSysMsg.Users
              ? { ...recentSysMsg.Users, avatar: `/api/users/${recentSysMsg.Users.id}/avatar` }
              : null,
          };
        } else {
          const [actorUser, targetUser] = await Promise.all([
            actorId ? prisma.users.findUnique({ where: { id: actorId }, select: { fullName: true } }) : null,
            prisma.users.findUnique({ where: { id: targetUserId }, select: { fullName: true } }),
          ]);
          const actorName = actorUser ? actorUser.fullName : "Người dùng";
          const targetName = targetUser ? targetUser.fullName : "Người dùng";

          let systemText;
          if (actorId === targetUserId) {
            systemText = nickToSet
              ? `${actorName} đã tự đặt biệt danh của mình là "${nickToSet}".`
              : `${actorName} đã xóa biệt danh của mình.`;
          } else {
            systemText = nickToSet
              ? `${actorName} đã đặt biệt danh cho ${targetName} là "${nickToSet}".`
              : `${actorName} đã xóa biệt danh của ${targetName}.`;
          }

          const systemPayload = {
            action: "change_nickname",
            actorId,
            targetId: targetUserId,
            nickname: nickToSet,
            text: systemText,
          };
          const systemContent = JSON.stringify(systemPayload);

          const systemMessage = await prisma.messages.create({
            data: {
              id: uuidv4(),
              conversationId,
              senderId: actorId,
              content: systemContent,
              type: "system",
            },
            include: {
              Users: { select: { id: true, fullName: true } },
            },
          });

          mappedSystemMessage = {
            ...systemMessage,
            Users: systemMessage.Users
              ? { ...systemMessage.Users, avatar: `/api/users/${systemMessage.Users.id}/avatar` }
              : null,
          };
          isNewSysMsg = true;
        }

        const payload = {
          conversationId,
          targetUserId,
          userId: targetUserId,
          newNickname: nickToSet,
          nickname: nickToSet,
          nicknames,
          systemMessage: mappedSystemMessage,
        };

        // Broadcast tới room cuộc trò chuyện
        io.to(conversationId).emit("conversation_nicknames_updated", payload);
        io.to(conversationId).emit("nickname_changed", payload);
        if (isNewSysMsg && mappedSystemMessage) {
          io.to(conversationId).emit("receive_message", mappedSystemMessage);
        }

        // Đồng thời broadcast tới room cá nhân của từng thành viên
        prisma.conversationMembers.findMany({
          where: { conversationId },
          select: { userId: true },
        }).then((members) => {
          members.forEach((m) => {
            if (m.userId) {
              io.to(m.userId).emit("conversation_nicknames_updated", payload);
              io.to(m.userId).emit("nickname_changed", payload);
              if (isNewSysMsg && mappedSystemMessage) {
                io.to(m.userId).emit("receive_message", mappedSystemMessage);
              }
            }
          });
        }).catch(() => {});

        console.log(`🏷️ User ${actorId} đặt biệt danh cho ${targetUserId} trong room ${conversationId}: ${nickToSet}`);
      } catch (e) {
        console.error("Lỗi socket update_nickname:", e);
      }
    };

    socket.on("change_nickname", handleUpdateNickname);
    socket.on("update_nickname", handleUpdateNickname);

    // 3b. Lắng nghe đổi chủ đề phòng chat (update_conversation_theme)
    socket.on("update_conversation_theme", async (data) => {
      if (!data) return;
      let d = data;
      if (typeof d === "string") {
        try { d = JSON.parse(d); } catch (e) {}
      }
      const conversationId = d.conversationId || d.conversation_id;
      const theme = d.theme;
      if (!conversationId || !theme) return;

      const validThemes = ['classic', 'sunset', 'ocean', 'berry', 'emerald', 'love', 'default'];
      const themeToSet = validThemes.includes(theme) ? theme : 'classic';

      try {
        await prisma.conversations.update({
          where: { id: conversationId },
          data: { theme: themeToSet },
        });

        // Xóa cache danh sách chat
        try {
          const chatCtrl = require("../controllers/chat.controller");
          if (chatCtrl.conversationsCache) chatCtrl.conversationsCache.clear();
        } catch (e) {}

        io.to(conversationId).emit("conversation_theme_updated", {
          conversationId,
          theme: themeToSet,
        });
        console.log(`🎨 Phòng chat ${conversationId} đã đổi chủ đề sang: ${themeToSet}`);

        // Gửi tin nhắn hệ thống giống Messenger thông báo cho cả 2 bên
        try {
          const themeLabels = {
            classic: "Mặc định (Classic)",
            default: "Mặc định (Classic)",
            sunset: "Hoàng hôn (Sunset)",
            ocean: "Đại dương (Ocean)",
            berry: "Quả mọng (Berry)",
            emerald: "Ngọc bích (Emerald)",
            love: "Tình yêu (Love)"
          };
          const themeLabel = themeLabels[themeToSet] || themeToSet;

          let actorName = "Người dùng";
          const actorId = socket.userId || d.userId;
          if (actorId) {
            const u = await prisma.users.findUnique({ where: { id: actorId }, select: { fullName: true } });
            if (u && u.fullName) actorName = u.fullName;
          }

          const systemContent = `${actorName} đã đổi chủ đề đoạn chat thành ${themeLabel}.`;
          const sysMsg = await prisma.messages.create({
            data: {
              id: uuidv4(),
              conversationId,
              senderId: actorId || null,
              content: systemContent,
              type: "system",
            },
            include: {
              Users: { select: { id: true, fullName: true } },
            },
          });

          const mappedSysMsg = {
            ...sysMsg,
            Users: sysMsg.Users ? { ...sysMsg.Users, avatar: `/api/users/${sysMsg.Users.id}/avatar` } : null,
          };
          io.to(conversationId).emit("receive_message", mappedSysMsg);
        } catch (sysErr) {
          console.error("Lỗi tạo systemMessage cho theme:", sysErr.message);
        }
      } catch (err) {
        console.error("❌ Lỗi socket update_conversation_theme:", err.message);
      }
    });

    // ⚡ PHÁT TIN NHẮN TỨC THÌ QUA SOCKET (<20ms) — Không chờ REST API/DB
    // Client gửi send_message → Server relay ngay cho tất cả thành viên trong phòng chat
    // REST API sẽ chạy song song để lưu DB + gửi FCM Push (không block tin nhắn real-time)
    socket.on("send_message", (data) => {
      try {
        if (!data || !data.conversationId) return;
        const { conversationId, content, type, tempId, senderId, senderName, replyMessageId, receiverId, memberIds } = data;
        const uid = senderId || socket.userId;

        // Tạo payload tin nhắn tạm (optimistic) để phát cho đối phương ngay lập tức
        const realtimePayload = {
          id: tempId || `rt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conversationId,
          senderId: uid,
          content,
          type: type || "text",
          replyMessageId: replyMessageId || null,
          isRead: false,
          isDelivered: true,
          isRecalled: false,
          createdAt: new Date().toISOString(),
          _isSocketRelay: true, // Đánh dấu đây là tin nhắn relay qua socket (chưa lưu DB)
        };

        // Phát tới TẤT CẢ các client trong phòng chat TRỪ người gửi
        let broadcast = socket.to(conversationId);
        if (receiverId && receiverId !== uid) {
          broadcast = broadcast.to(receiverId);
        }
        if (Array.isArray(memberIds)) {
          memberIds.forEach((mid) => {
            if (mid && mid !== uid) broadcast = broadcast.to(mid);
          });
        }
        broadcast.emit("receive_message", realtimePayload);

        console.log(`⚡ [Socket Relay] Tin nhắn từ ${uid} → phòng ${conversationId} / receiver ${receiverId || 'all'} (${content?.substring(0, 30)}...)`);

        // Fallback an toàn: Nếu không có receiverId và phòng chưa có đủ socket
        if (!receiverId && (!memberIds || memberIds.length === 0)) {
          const room = io.sockets.adapter.rooms.get(conversationId);
          if (!room || room.size <= 1) {
            prisma.conversationMembers.findMany({
              where: { conversationId, userId: { not: uid } },
              select: { userId: true },
            }).then((otherMembers) => {
              otherMembers.forEach((m) => {
                socket.to(m.userId).emit("receive_message", realtimePayload);
              });
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Lỗi socket send_message relay:", err.message);
      }
    });

    socket.on("typing", async (payload) => {
      if (!payload) return;
      const { conversationId, userId, nickname, senderId, senderName } = payload;
      const uid = userId || senderId || socket.userId;
      const name = nickname || senderName || "Người dùng";

      if (conversationId) {
        socket.to(conversationId).emit("user_typing", {
          conversationId,
          userId: uid,
          nickname: name,
        });
        socket.to(conversationId).emit("typing", {
          conversationId,
          userId: uid,
          senderId: uid,
          senderName: name,
        });
      } else if (payload.receiverId) {
        const isBlocked = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: socket.userId, blockedId: payload.receiverId },
              { blockerId: payload.receiverId, blockedId: socket.userId }
            ]
          }
        });
        if (isBlocked) return;

        socket.to(payload.receiverId).emit("user_typing", {
          userId: uid,
          nickname: name,
        });
        socket.to(payload.receiverId).emit("typing", { 
          senderId: uid,
          senderName: name 
        });
      }
    });

    // 4. Lắng nghe trạng thái Dừng gõ... (Stop typing indicator)
    socket.on("stop_typing", (payload) => {
      if (!payload) return;
      const { conversationId, userId, receiverId } = payload;
      const uid = userId || socket.userId;

      if (conversationId) {
        socket.to(conversationId).emit("stop_typing", {
          conversationId,
          userId: uid,
        });
        socket.to(conversationId).emit("user_stop_typing", {
          conversationId,
          userId: uid,
        });
      } else if (receiverId) {
        socket.to(receiverId).emit("stop_typing", {
          userId: uid,
        });
      }
    });

    socket.on("stop-typing", (payload) => {
      if (!payload) return;
      const { conversationId, userId, receiverId } = payload;
      const uid = userId || socket.userId;

      if (conversationId) {
        socket.to(conversationId).emit("stop_typing", {
          conversationId,
          userId: uid,
        });
      } else if (receiverId) {
        socket.to(receiverId).emit("stop-typing", { senderId: uid });
      }
    });

    // 4.4 Lắng nghe sự kiện Đã nhận tin nhắn (Delivered)
    socket.on("mark_as_delivered", async ({ messageId, conversationId }) => {
      try {
        if (!messageId) return;
        const msg = await prisma.messages.findUnique({
          where: { id: messageId },
          select: { id: true, senderId: true, conversationId: true, isDelivered: true },
        });
        if (!msg) return;

        if (!msg.isDelivered) {
          await prisma.messages.update({
            where: { id: messageId },
            data: { isDelivered: true },
          });
        }

        const targetConvId = conversationId || msg.conversationId;
        if (msg.senderId) {
          io.to(msg.senderId).emit("message_delivered", {
            messageId,
            conversationId: targetConvId,
          });
        }
        if (targetConvId) {
          io.to(targetConvId).emit("message_delivered", {
            messageId,
            conversationId: targetConvId,
          });
        }
      } catch (err) {
        console.error("Lỗi khi xử lý mark_as_delivered:", err.message);
      }
    });

    // 4.5.1 Lắng nghe sự kiện Đã xem 1 tin nhắn cụ thể (mark_as_read)
    socket.on("mark_as_read", async ({ messageId, conversationId }) => {
      try {
        if (!messageId && !conversationId) return;
        const readerId = socket.userId;

        if (messageId) {
          const msg = await prisma.messages.findUnique({
            where: { id: messageId },
            select: { id: true, senderId: true, conversationId: true },
          });
          if (msg) {
            await prisma.messages.update({
              where: { id: messageId },
              data: { isRead: true, isDelivered: true },
            });
            const targetConvId = conversationId || msg.conversationId;
            if (msg.senderId) {
              io.to(msg.senderId).emit("message_read", {
                messageId,
                conversationId: targetConvId,
                readBy: readerId,
              });
              io.to(msg.senderId).emit("messages_read", {
                conversationId: targetConvId,
                readBy: readerId,
                lastReadMessageId: messageId,
              });
            }
          }
        }
      } catch (err) {
        console.error("Lỗi khi xử lý mark_as_read:", err.message);
      }
    });

    // 4.5 Lắng nghe sự kiện Đã xem tin nhắn
    socket.on("mark_messages_read", async ({ conversationId, userId }) => {
      try {
        const readerId = socket.userId || userId;
        if (!conversationId || !readerId) return;

        console.log(
          `👀 User ${readerId} đang đánh dấu Đã xem phòng chat: ${conversationId}`,
        );

        // 1. Tìm tin nhắn mới nhất do người khác gửi trong cuộc trò chuyện này
        const lastMsgFromOther = await prisma.messages.findFirst({
          where: {
            conversationId,
            NOT: { senderId: readerId },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, senderId: true },
        });

        // 2. Cập nhật tất cả tin nhắn do người khác gửi sang isRead: true
        await prisma.messages.updateMany({
          where: {
            conversationId,
            senderId: { not: readerId },
            isRead: false,
          },
          data: { isRead: true, isDelivered: true },
        });

        // 3. Bắn tín hiệu socket real-time về cho người gửi và toàn bộ phòng chat
        const readAt = new Date().toISOString();
        const lastReadMessageId = lastMsgFromOther ? lastMsgFromOther.id : null;

        const payload = {
          conversationId,
          readBy: readerId,
          lastReadMessageId,
          readAt,
        };

        if (lastMsgFromOther && lastMsgFromOther.senderId) {
          io.to(lastMsgFromOther.senderId).emit("messages_read", payload);
        }
        io.to(conversationId).emit("messages_read", payload);

        console.log(
          `✅ Đã phát tín hiệu Đã xem cho phòng ${conversationId}!`,
        );

        // ── TỰ HỦY TIN NHẮN ──
        // Tìm các tin nhắn vừa đọc có selfDestructDuration → gán expiresAt
        try {
          const selfDestructMsgs = await prisma.messages.findMany({
            where: {
              conversationId,
              senderId: { not: readerId },
              selfDestructDuration: { not: null },
              expiresAt: null,
            },
            select: { id: true, selfDestructDuration: true, conversationId: true },
          });

          for (const sdMsg of selfDestructMsgs) {
            const expiresAt = new Date(Date.now() + sdMsg.selfDestructDuration * 1000);
            await prisma.messages.update({
              where: { id: sdMsg.id },
              data: { expiresAt },
            });

            // Đặt timer tự hủy sau khi hết giờ
            setTimeout(async () => {
              try {
                await prisma.messages.update({
                  where: { id: sdMsg.id },
                  data: { isRecalled: true, content: "Tin nhắn tự hủy" },
                });
                // Phát socket event cho cả 2 phía
                io.to(sdMsg.conversationId).emit("message_self_destructed", {
                  messageId: sdMsg.id,
                  conversationId: sdMsg.conversationId,
                });
                console.log(`💥 Tin nhắn tự hủy: ${sdMsg.id}`);
              } catch (err) {
                console.error("Lỗi tự hủy tin nhắn:", err);
              }
            }, sdMsg.selfDestructDuration * 1000);
          }
        } catch (sdError) {
          console.error("Lỗi xử lý tin nhắn tự hủy:", sdError);
        }
      } catch (error) {
        console.error("Lỗi cập nhật trạng thái đã xem:", error);
      }
    });

    // 5. User A gửi yêu cầu gọi (request_call) cho User B
    socket.on(
      "request_call",
      async ({ callerId, callerName, calleeId, callType, callerAvatar }) => {
        // Kiểm tra chặn trước khi kết nối cuộc gọi
        const isBlocked = await prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: callerId, blockedId: calleeId },
                    { blockerId: calleeId, blockedId: callerId }
                ]
            }
        });

        if (isBlocked) {
            socket.emit("call_rejected", { reason: "blocked" });
            console.log(`🚫 Cuộc gọi bị chặn giữa ${callerId} và ${calleeId} do chặn nhau`);
            return;
        }

        // Kiểm tra trạng thái online thời gian thực của callee qua room Socket.IO
        const calleeRoom = io.sockets.adapter.rooms.get(calleeId);
        const isCalleeOnline = calleeRoom && calleeRoom.size > 0;

        let hasFcmToken = false;
        // Bắn Push Notification cuộc gọi chạy ngầm (để khi tắt máy/thoát màn hình chính vẫn nhận được)
        try {
          const calleeUser = await prisma.users.findUnique({
            where: { id: calleeId },
            select: { fcmToken: true },
          });

          if (calleeUser && calleeUser.fcmToken) {
            hasFcmToken = true;
            const callTitle = `${callerName} đang gọi cho bạn...`;
            const callBody = `Cuộc gọi ${callType === "video" ? "Video" : "Thoại"} đến. Nhấn để trả lời.`;
            const customData = {
              type: "incoming_call",
              callerId: String(callerId),
              callerName: String(callerName),
              callType: String(callType),
              callerAvatar: String(callerAvatar || ""),
              t: String(Date.now()) // 🌟 Thêm timestamp để kiểm tra quá hạn ở client
            };
            
            try {
              await sendPushNotification(calleeUser.fcmToken, callTitle, callBody, customData, true);
              console.log(`📲 Đã bắn Push cuộc gọi đến thành công cho User ${calleeId}`);
            } catch (pushErr) {
              console.error("❌ Lỗi bắn Push cuộc gọi:", pushErr.message);
              hasFcmToken = false; // Đánh dấu không có Token hợp lệ để lập tức trả offline
              
              // Xóa token hết hạn/lỗi khỏi database để tránh spam push vô ích
              if (pushErr.code === "messaging/registration-token-not-registered" || 
                  pushErr.message.includes("not registered") ||
                  pushErr.message.includes("registration token")) {
                await prisma.users.update({
                  where: { id: calleeId },
                  data: { fcmToken: null }
                });
                console.log(`🗑️ Đã xóa FCM Token lỗi của user ${calleeId}`);
              }
            }
          }
        } catch (dbErr) {
          console.error("Lỗi truy vấn FCM Token khi gọi điện:", dbErr.message);
        }

        if (isCalleeOnline) {
          console.log(`📞 ${callerName} đang gọi cho ${calleeId}`);
          activeCalls.set(callerId, { partnerId: calleeId });
          activeCalls.set(calleeId, { partnerId: callerId });
          // Chuyển tiếp cuộc gọi đến (incoming_call) cho User B (qua room)
          io.to(calleeId).emit("incoming_call", {
            callerId,
            callerName,
            callerAvatar,
            callType,
          });
        } else if (hasFcmToken) {
          console.log(`📞 ${callerName} đang gọi qua Push cho ${calleeId} (tạm thời offline socket)`);
          // Không bắn call_rejected về cho Caller, cho phép đổ chuông chờ người nhận bấm push notification để vào app.
        } else {
          // Trả trực tiếp phản hồi từ chối do offline về cho caller (do không kết nối socket và không có FCM token/FCM hỏng)
          socket.emit("call_rejected", { reason: "offline" });
        }
      },
    );

    // 6. User B từ chối cuộc gọi
    socket.on("reject_call", async ({ callerId, callType }) => {
      activeCalls.delete(callerId);
      activeCalls.delete(socket.userId);
      io.to(callerId).emit("call_rejected", { reason: "rejected" });

      // Xử lý tạo tin nhắn "Cuộc gọi nhỡ" hệ thống
      try {
        const conversations = await prisma.conversationMembers.findMany({
          where: { userId: socket.userId },
        });
        const callerConversations = await prisma.conversationMembers.findMany({
          where: { userId: callerId },
        });
        const commonConv = conversations.find((c) =>
          callerConversations.some(
            (cc) => cc.conversationId === c.conversationId,
          ),
        );

        if (commonConv) {
          // Chặn spam cuộc gọi nhỡ: nếu trong vòng 15 giây qua đã có cuộc gọi nhỡ giữa 2 người thì bỏ qua không tạo trùng
          const recentMissedCall = await prisma.messages.findFirst({
            where: {
              conversationId: commonConv.conversationId,
              type: "missed_call",
              senderId: callerId,
              createdAt: { gte: new Date(Date.now() - 15000) },
            },
          });

          if (recentMissedCall) {
            console.log(`⚠️ Đã có cuộc gọi nhỡ trong 15s qua cho room ${commonConv.conversationId}, bỏ qua tạo trùng lặp`);
            return;
          }

          const contentText =
            callType === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi nhỡ";
          const missedCallMsg = await prisma.messages.create({
            data: {
              id: uuidv4(),
              conversationId: commonConv.conversationId,
              senderId: callerId, // Người gọi sẽ là người để lại cuộc gọi nhỡ
              content: contentText,
              type: "missed_call",
            },
            include: {
              Users: { select: { id: true, fullName: true } },
            },
          });

          // Map avatar sang URL tĩnh
          const mappedMissedCallMsg = {
            ...missedCallMsg,
            Users: missedCallMsg.Users ? {
              ...missedCallMsg.Users,
              avatar: `/api/users/${missedCallMsg.Users.id}/avatar`
            } : null
          };

          io.to(socket.userId).emit("receive_message", mappedMissedCallMsg);
          io.to(callerId).emit("receive_message", mappedMissedCallMsg);
        }
      } catch (error) {
        console.error("Lỗi tạo cuộc gọi nhỡ:", error);
      }
    });

    // 7. User B chấp nhận cuộc gọi
    socket.on("accept_call", async ({ callerId }) => {
      activeCalls.set(socket.userId, { partnerId: callerId });
      activeCalls.set(callerId, { partnerId: socket.userId });
      try {
        // Lấy thông tin của người vừa chấp nhận cuộc gọi (callee) từ DB
        const callee = await prisma.users.findUnique({
          where: { id: socket.userId },
          select: { id: true, fullName: true },
        });

        const mappedCallee = callee ? {
          ...callee,
          avatar: `/api/users/${callee.id}/avatar`
        } : null;

        // Gửi sự kiện chấp nhận kèm thông tin của callee về cho caller (qua room)
        io.to(callerId).emit("call_accepted", {
          calleeInfo: mappedCallee,
        });
      } catch (error) {
        console.error("Lỗi lấy thông tin người nhận cuộc gọi:", error);
        io.to(callerId).emit("call_accepted", { calleeInfo: null });
      }
    });

    // 8. Chuyển tiếp tín hiệu WebRTC (Offer, Answer, ICE Candidate)
    socket.on("webrtc_signal", ({ connectedUserId, signal }) => {
      io.to(connectedUserId).emit("webrtc_signal", {
        signal,
        senderId: socket.userId,
      });
    });

    // 9. Kết thúc cuộc gọi (gửi thông báo cho cả 2 phía để tự động đóng màn hình)
    socket.on("end_call", async (data = {}) => {
      const activeInfo = activeCalls.get(socket.userId);
      const targetId = data.connectedUserId || data.to || data.targetUserId || data.userId || activeInfo?.partnerId;
      const conversationId = data.conversationId || activeInfo?.conversationId;
      console.log(`🔴 [end_call] Tắt cuộc gọi từ user ${socket.userId} -> partner ${targetId}, room ${conversationId}`);

      if (targetId) {
        io.to(targetId).emit("call_ended");
        const targetSocketId = userSockets.get(targetId);
        if (targetSocketId && targetSocketId !== targetId) {
          io.to(targetSocketId).emit("call_ended");
        }
        activeCalls.delete(targetId);

        // Huỷ thông báo chuông cuộc gọi đến trên FCM nếu có
        try {
          const targetUser = await prisma.users.findUnique({
            where: { id: targetId },
            select: { fcmToken: true }
          });
          if (targetUser && targetUser.fcmToken) {
            sendPushNotification(targetUser.fcmToken, "Cuộc gọi đã kết thúc", "", {
              type: "call_ended",
              callerId: String(socket.userId || ""),
              t: String(Date.now())
            }, true).catch(() => {});
          }
        } catch (_) {}
      }
      activeCalls.delete(socket.userId);
    });

    // 10. Nâng cấp từ Voice lên Video
    socket.on("did_upgrade_to_video", ({ to }) => {
      io.to(to).emit("did_upgrade_to_video");
    });

    // --- LOGIC KẾT BẠN (FRIEND REQUEST) ---

    // 11. User A gửi lời mời kết bạn cho User B
    socket.on("send_friend_request", async ({ receiverId }) => {
      const senderId = socket.userId;
      if (!senderId || !receiverId || senderId === receiverId) return;

      try {
        // Kiểm tra xem đã có mối quan hệ nào chưa (bạn bè, đã gửi, đã nhận)
        const existingFriendship = await prisma.friendRequests.findFirst({
          where: {
            OR: [
              { requesterId: senderId, receiverId: receiverId },
              { requesterId: receiverId, receiverId: senderId },
            ],
          },
        });

        if (existingFriendship) {
          socket.emit("friend_request_failed", {
            message: "Đã gửi lời mời hoặc đã là bạn bè.",
          });
          return;
        }

        // Tạo lời mời mới trong DB
        const newRequest = await prisma.friendRequests.create({
          data: {
            requesterId: senderId,
            receiverId: receiverId,
            status: "PENDING",
          },
          include: {
            requester: {
              select: { id: true, fullName: true },
            },
          },
        });

        const mappedRequest = {
          ...newRequest,
          requester: newRequest.requester ? {
            ...newRequest.requester,
            avatar: `/api/users/${newRequest.requester.id}/avatar`
          } : null
        };

        // Gửi thông báo real-time cho người nhận (qua room)
        io.to(receiverId).emit("new_friend_request", mappedRequest);

        socket.emit("friend_request_sent", { receiverId });
      } catch (error) {
        console.error("Lỗi khi gửi lời mời kết bạn:", error);
        socket.emit("friend_request_failed", { message: "Lỗi hệ thống." });
      }
    });

    // 12. User B chấp nhận lời mời của User A
    socket.on("accept_friend_request", async ({ requestId }) => {
      const receiverId = socket.userId;
      try {
        const request = await prisma.friendRequests.findUnique({
          where: { id: requestId },
        });

        if (!request || request.receiverId !== receiverId) return;

        const friendship = await prisma.friendRequests.update({
          where: { id: requestId },
          data: { status: "ACCEPTED" },
          include: {
            requester: { select: { id: true, fullName: true } },
            receiver: { select: { id: true, fullName: true } },
          },
        });

        // Tạo bản ghi thông báo hệ thống
        const notification = await prisma.notifications.create({
          data: {
            userId: friendship.requesterId, // Gửi cho người đã yêu cầu kết bạn
            senderId: receiverId, // Người vừa bấm chấp nhận
            type: "FRIEND_ACCEPTED",
            content: "đã chấp nhận lời mời kết bạn của bạn",
          },
          include: {
            Sender: { select: { id: true, fullName: true } },
          },
        });

        // Map avatar của requester, receiver, notification sender sang URL tĩnh
        const mappedRequester = friendship.requester ? {
          ...friendship.requester,
          avatar: `/api/users/${friendship.requester.id}/avatar`
        } : null;

        const mappedReceiver = friendship.receiver ? {
          ...friendship.receiver,
          avatar: `/api/users/${friendship.receiver.id}/avatar`
        } : null;

        const mappedNotification = {
          ...notification,
          Sender: notification.Sender ? {
            ...notification.Sender,
            avatar: `/api/users/${notification.Sender.id}/avatar`
          } : null
        };

        // Phát sự kiện real-time qua room của requester
        io.to(friendship.requesterId).emit(
          "friend_request_accepted",
          mappedReceiver,
        );
        io.to(friendship.requesterId).emit(
          "new_global_notification",
          mappedNotification,
        );

        socket.emit("you_accepted_friend_request", mappedRequester);
      } catch (error) {
        console.error("Lỗi khi chấp nhận lời mời:", error);
      }
    });

    // 13. User B từ chối lời mời của User A
    socket.on("reject_friend_request", async ({ requestId }) => {
      const receiverId = socket.userId;
      try {
        const request = await prisma.friendRequests.findUnique({
          where: { id: requestId },
        });

        if (!request || request.receiverId !== receiverId) return;

        await prisma.friendRequests.delete({
          where: { id: requestId },
        });

        // Phát sự kiện từ chối qua room của requester
        io.to(request.requesterId).emit("friend_request_rejected", {
          userId: receiverId,
        });
      } catch (error) {
        console.error("Lỗi khi từ chối lời mời:", error);
      }
    });

    // 13.5 User A hoặc User B xóa bạn bè
    socket.on("unfriend_user", ({ friendId }) => {
      const userId = socket.userId;
      if (!userId || !friendId) return;
      io.to(friendId).emit("user_unfriended", { userId });
      io.to(friendId).emit("unfriended", { unfriendedBy: userId });
      console.log(`❌ Socket unfriend_user: User ${userId} unfriended ${friendId}`);
    });

    // ══════════════════════════════════════════════════════
    // 14. GHIM TIN NHẮN QUA SOCKET (Pin/Unpin Message)
    // ══════════════════════════════════════════════════════
    socket.on("pin_message", async ({ messageId, conversationId }) => {
      try {
        const userId = socket.userId;
        if (!messageId || !conversationId || !userId) return;

        const message = await prisma.messages.findUnique({ where: { id: messageId } });
        if (!message) return;

        if (message.isPinned) {
          // Bỏ ghim
          await prisma.messages.update({
            where: { id: messageId },
            data: { isPinned: false, pinnedAt: null },
          });
          io.to(conversationId).emit("message_unpinned", { messageId, conversationId });
          console.log(`📌 Bỏ ghim tin nhắn: ${messageId}`);
        } else {
          // Kiểm tra tối đa 3 tin ghim
          const pinnedCount = await prisma.messages.count({
            where: { conversationId, isPinned: true },
          });
          if (pinnedCount >= 3) {
            socket.emit("pin_error", { message: "Chỉ được ghim tối đa 3 tin nhắn." });
            return;
          }

          const updated = await prisma.messages.update({
            where: { id: messageId },
            data: { isPinned: true, pinnedAt: new Date() },
            include: { Users: { select: { id: true, fullName: true } } },
          });

          io.to(conversationId).emit("message_pinned", {
            messageId,
            conversationId,
            content: updated.content,
            type: updated.type,
            senderName: updated.Users ? updated.Users.fullName : "Người dùng",
            pinnedAt: updated.pinnedAt,
          });
          console.log(`📌 Ghim tin nhắn: ${messageId}`);
        }
      } catch (error) {
        console.error("Lỗi khi ghim/bỏ ghim tin nhắn:", error);
      }
    });

    // ══════════════════════════════════════════════════════
    // 15. THẢ CẢM XÚC TIN NHẮN QUA SOCKET (React Message)
    // ══════════════════════════════════════════════════════
    socket.on("react_message", async (data) => {
      try {
        const userId = socket.userId;
        const { messageId, conversationId, emoji } = data || {};
        if (!messageId || !emoji || !userId) return;

        const message = await prisma.messages.findUnique({
          where: { id: messageId },
        });
        if (!message) return;

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

        const isRemoved = currentReactions[userId] === emoji;
        if (isRemoved) {
          delete currentReactions[userId];
        } else {
          currentReactions[userId] = emoji;
        }

        const updatedMessage = await prisma.messages.update({
          where: { id: messageId },
          data: { reactions: JSON.stringify(currentReactions) },
        });

        const targetConvId = conversationId || message.conversationId;

        // Phát tín hiệu tới tất cả client trong phòng chat
        io.to(targetConvId).emit("message_reacted", {
          messageId: messageId,
          conversationId: targetConvId,
          reactions: currentReactions,
          reaction: emoji,
          userId: userId,
          isRemoved: isRemoved,
          data: updatedMessage,
        });

        console.log(`❤️ User ${userId} đã thả cảm xúc '${emoji}' vào tin nhắn: ${messageId}`);
      } catch (error) {
        console.error("Lỗi khi thả cảm xúc qua socket:", error);
      }
    });

    // ══════════════════════════════════════════════════════
    // 16. THU HỒI TIN NHẮN QUA SOCKET (Recall Message)
    // ══════════════════════════════════════════════════════
    socket.on("recall_message", (data) => {
      try {
        const { messageId, conversationId } = data || {};
        if (!messageId) return;

        const targetConvId = conversationId;
        if (targetConvId) {
          io.to(targetConvId).emit("message_recalled", {
            messageId,
            conversationId: targetConvId,
          });
        }
        console.log(`🔄 Socket recall_message broadcasted for message: ${messageId}`);
      } catch (error) {
        console.error("Lỗi khi xử lý recall_message qua socket:", error);
      }
    });
  });
};
