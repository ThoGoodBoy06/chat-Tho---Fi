const prisma = require("../prisma");
const { v4: uuidv4 } = require("uuid");
const { sendPushNotification } = require("../controllers/chat.controller");

const jwt = require("jsonwebtoken");

module.exports = (io) => {
  // Biến này để lưu trữ id người dùng và socket id của họ (để biết gửi tin nhắn cho ai)
  const userSockets = new Map();
  // Gắn map vào instance 'io' để các route handler có thể truy cập
  io.userSockets = userSockets;

  io.on("connection", async (socket) => {
    console.log("⚡ Một thiết bị vừa kết nối với Socket: " + socket.id);

    // Tự động xác thực qua token nếu được truyền trong handshake
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey_chat_tho_fi");
        const userId = decoded.id || decoded.userId;
        if (userId) {
          userSockets.set(userId, socket.id);
          socket.userId = userId;
          socket.join(userId);

          const conversations = await prisma.conversationMembers.findMany({
            where: { userId },
            select: { conversationId: true },
          });
          conversations.forEach((conv) => {
            socket.join(conv.conversationId);
          });

          await prisma.users.update({
            where: { id: userId },
            data: { isOnline: true },
          }).catch(() => {});

          io.emit("user_status_changed", { userId, isOnline: true });
          console.log(`👤 Socket ${socket.id} tự động xác thực User ${userId} qua Token.`);
        }
      } catch (e) {
        console.warn(`⚠️ Socket ${socket.id} token validation warning:`, e.message);
      }
    }

    // Lắng nghe khi client yêu cầu tham gia phòng trò chuyện (như khi được thêm vào nhóm)
    socket.on("join_conversation", (conversationId) => {
        socket.join(conversationId);
        console.log(`📡 Socket ${socket.id} đã vào phòng: ${conversationId}`);
    });

    // Alias: join_room (cho Flutter Web client)
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
        console.log(`📡 Socket ${socket.id} đã join_room: ${roomId}`);
    });

    // 1. Lắng nghe khi người dùng đăng nhập app thành công
    socket.on("user_connected", async (userId) => {
      try {
        userSockets.set(userId, socket.id);
        socket.userId = userId;

        // Đưa user vào một "phòng" có tên là ID của họ để dễ dàng gửi tin nhắn cá nhân
        socket.join(userId);

        // Tự động join vào các phòng chat mà user này là thành viên
        const conversations = await prisma.conversationMembers.findMany({
          where: { userId },
          select: { conversationId: true },
        });
        conversations.forEach((conv) => {
          socket.join(conv.conversationId);
        });

        // Lấy danh sách lời mời kết bạn đang chờ và gửi cho client
        try {
          const pendingRequests = await prisma.friendRequests.findMany({
            where: { receiverId: userId, status: "PENDING" },
            include: {
              requester: {
                select: { id: true, fullName: true },
              },
            },
          });

          // Map avatar sang URL tĩnh
          const mappedPending = pendingRequests.map(r => {
            if (r.requester) {
              r.requester.avatar = `/api/users/${r.requester.id}/avatar`;
            }
            return r;
          });

          socket.emit("initial_friend_requests", mappedPending);
        } catch (e) {
          console.error("Lỗi khi lấy danh sách lời mời kết bạn:", e);
        }

        // Cập nhật trạng thái "Đang Online" vào Database
        await prisma.users.update({
          where: { id: userId },
          data: { isOnline: true },
        }).catch((e) => console.warn("Lỗi update isOnline (soft fail):", e.message));

        // Báo cho mọi người khác biết user này vừa online (cả 2 dạng sự kiện để tương thích)
        io.emit("user_status_changed", { userId, isOnline: true });
        io.emit("user_status_change", { userId, isOnline: true });
        console.log(`👤 User ${userId} đã kết nối.`);
      } catch (err) {
        console.error("❌ Lỗi trong sự kiện user_connected:", err);
      }
    });

    // 1b. Lắng nghe khi người dùng chuyển ứng dụng chạy ngầm (go_offline)
    socket.on("go_offline", async () => {
      if (!socket.userId) return;
      try {
        const lastActiveTime = new Date();
        await prisma.users.update({
          where: { id: socket.userId },
          data: { isOnline: false, lastActive: lastActiveTime },
        });

        const payload = {
          userId: socket.userId,
          isOnline: false,
          lastActive: lastActiveTime.toISOString()
        };
        io.emit("user_status_changed", payload);
        io.emit("user_status_change", payload);
        console.log(`👤 User ${socket.userId} chạy ngầm (Offline).`);
      } catch (e) {
        console.error("Lỗi khi cập nhật trạng thái offline chạy ngầm:", e);
      }
    });

    // 1c. Lắng nghe khi người dùng mở lại app (go_online)
    socket.on("go_online", async () => {
      if (!socket.userId) return;
      try {
        await prisma.users.update({
          where: { id: socket.userId },
          data: { isOnline: true },
        });

        io.emit("user_status_changed", { userId: socket.userId, isOnline: true });
        io.emit("user_status_change", { userId: socket.userId, isOnline: true });
        console.log(`👤 User ${socket.userId} mở lại app (Online).`);
      } catch (e) {
        console.error("Lỗi khi cập nhật trạng thái online mở lại app:", e);
      }
    });

    // 2. Lắng nghe khi người dùng tắt app hoặc mất mạng
    socket.on("disconnect", async () => {
      console.log("🔴 Một thiết bị vừa ngắt kết nối: " + socket.id);
      if (socket.userId) {
        // Chỉ xóa khỏi map nếu socket.id đang ngắt kết nối là socket đang lưu trữ trong map
        if (userSockets.get(socket.userId) === socket.id) {
          userSockets.delete(socket.userId);
        }

        // Kiểm tra xem người dùng này còn bất kỳ socket kết nối nào khác không (thông qua room của họ)
        const userRoom = io.sockets.adapter.rooms.get(socket.userId);
        const hasRemainingSockets = userRoom && userRoom.size > 0;

        // Chỉ cập nhật DB offline nếu người dùng không còn kết nối nào khác
        if (!hasRemainingSockets) {
          try {
            const lastActiveTime = new Date();
            await prisma.users.update({
              where: { id: socket.userId },
              data: { isOnline: false, lastActive: lastActiveTime },
            });

            // Báo cho mọi người biết user này đã offline
            const payload = {
              userId: socket.userId,
              isOnline: false,
              lastActive: lastActiveTime.toISOString()
            };
            io.emit("user_status_changed", payload);
            io.emit("user_status_change", payload);
          } catch (e) {
            console.error("Lỗi khi cập nhật trạng thái offline:", e);
          }
        }
      }
    });

    // 3. Lắng nghe trạng thái Đang gõ... (Typing indicator)
    socket.on("change_nickname", async (data) => {
      if (!data) return;
      const { conversationId, userId, nickname } = data;
      if (!conversationId || !userId) return;

      try {
        const nickToSet = (nickname && nickname.trim().length > 0) ? nickname.trim() : null;
        const member = await prisma.conversationMembers.findFirst({
          where: { conversationId, userId },
        });

        if (member) {
          await prisma.conversationMembers.update({
            where: { id: member.id },
            data: { nickname: nickToSet },
          });
        }

        const payload = { conversationId, userId, nickname: nickToSet };
        io.to(conversationId).emit("nickname_changed", payload);
        console.log(`🏷️ User ${userId} đổi biệt danh trong room ${conversationId}: ${nickToSet}`);
      } catch (e) {
        console.error("Lỗi socket change_nickname:", e);
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

        const unreadMessages = await prisma.messages.findMany({
          where: {
            conversationId,
            NOT: { senderId: readerId },
            NOT: { isRead: true },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, senderId: true },
        });

        if (unreadMessages.length === 0) return;
        if (unreadMessages.length === 0) {
          return; // Không có tin nhắn mới nào để cập nhật
        }

        const lastReadBySender = new Map();
        unreadMessages.forEach((message) => {
          if (message.senderId) {
            lastReadBySender.set(message.senderId, message.id);
          }
        });

        const readAt = new Date().toISOString();
        lastReadBySender.forEach((lastReadMessageId, senderId) => {
          console.log(
            `-> Phát tín hiệu Đã xem tin nhắn ${lastReadMessageId} về cho User ${senderId}`,
          );
          io.to(senderId).emit("messages_read", {
            conversationId,
            readBy: readerId,
            lastReadMessageId,
            readAt,
          });
        });

        await prisma.messages.updateMany({
          where: {
            conversationId,
            senderId: { not: readerId },
            id: { in: unreadMessages.map((m) => m.id) },
          },
          data: { isRead: true, isDelivered: true },
        });
        console.log(
          `✅ Đã lưu trạng thái isRead: true cho ${unreadMessages.length} tin nhắn vào DB!`,
        );

        // ── TỰ HỦY TIN NHẮN ──
        // Tìm các tin nhắn vừa đọc có selfDestructDuration → gán expiresAt
        try {
          const selfDestructMsgs = await prisma.messages.findMany({
            where: {
              id: { in: unreadMessages.map((m) => m.id) },
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
    socket.on("end_call", ({ connectedUserId }) => {
      if (connectedUserId) {
        io.to(connectedUserId).emit("call_ended");
      }
      if (socket.userId) {
        io.to(socket.userId).emit("call_ended");
      }
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
  });
};
