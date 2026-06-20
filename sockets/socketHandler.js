const prisma = require("../prisma");
const { v4: uuidv4 } = require("uuid");

module.exports = (io) => {
  // Biến này để lưu trữ id người dùng và socket id của họ (để biết gửi tin nhắn cho ai)
  const userSockets = new Map();
  // Gắn map vào instance 'io' để các route handler có thể truy cập
  io.userSockets = userSockets;

  io.on("connection", (socket) => {
    console.log("⚡ Một thiết bị vừa kết nối với Socket: " + socket.id);

    // 1. Lắng nghe khi người dùng đăng nhập app thành công
    socket.on("user_connected", async (userId) => {
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
      });

      // Báo cho mọi người khác biết user này vừa online
      io.emit("user_status_changed", { userId, isOnline: true });
      console.log(`👤 User ${userId} đã kết nối.`);
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
            await prisma.users.update({
              where: { id: socket.userId },
              data: { isOnline: false, lastSeen: new Date() },
            });

            // Báo cho mọi người biết user này đã offline
            io.emit("user_status_changed", {
              userId: socket.userId,
              isOnline: false,
            });
          } catch (e) {
            console.error("Lỗi khi cập nhật trạng thái offline:", e);
          }
        }
      }
    });

    // 3. Lắng nghe trạng thái Đang gõ...
    socket.on("typing", async ({ conversationId, senderId, senderName }) => {
      // Tìm những người trong cuộc trò chuyện này để phát tín hiệu
      const members = await prisma.conversationMembers.findMany({
        where: { conversationId },
      });
      members.forEach((m) => {
        if (m.userId !== senderId) {
          io.to(m.userId).emit("typing", { conversationId, senderName });
        }
      });
    });

    // 4. Lắng nghe trạng thái Dừng gõ
    socket.on("stop_typing", async ({ conversationId, senderId }) => {
      const members = await prisma.conversationMembers.findMany({
        where: { conversationId },
      });
      members.forEach((m) => {
        if (m.userId !== senderId) {
          io.to(m.userId).emit("stop_typing", { conversationId });
        }
      });
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
            senderId: { not: readerId },
            isRead: false,
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
            id: { in: unreadMessages.map((m) => m.id) }, // Cập nhật đích danh các ID vừa tìm được
          },
          data: { isRead: true },
        });
        console.log(
          `✅ Đã lưu trạng thái isRead: true cho ${unreadMessages.length} tin nhắn vào DB!`,
        );
      } catch (error) {
        console.error("Lỗi cập nhật trạng thái đã xem:", error);
      }
    });

    // 5. User A gửi yêu cầu gọi (request_call) cho User B
    socket.on(
      "request_call",
      ({ callerId, callerName, calleeId, callType, callerAvatar }) => {
        // Kiểm tra trạng thái online thời gian thực của callee qua room Socket.IO
        const calleeRoom = io.sockets.adapter.rooms.get(calleeId);
        const isCalleeOnline = calleeRoom && calleeRoom.size > 0;

        if (isCalleeOnline) {
          console.log(`📞 ${callerName} đang gọi cho ${calleeId}`);
          // Chuyển tiếp cuộc gọi đến (incoming_call) cho User B (qua room)
          io.to(calleeId).emit("incoming_call", {
            callerId,
            callerName,
            callerAvatar,
            callType,
          });
        } else {
          // Trả trực tiếp phản hồi từ chối do offline về cho caller
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

    // 9. Kết thúc cuộc gọi
    socket.on("end_call", ({ connectedUserId }) => {
      io.to(connectedUserId).emit("call_ended");
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
  });
};
