const prisma = require("../prisma");

// 1. Thống kê tổng quan (Overview Stats)
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, onlineUsers, totalMessages, totalGroups] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { isOnline: true } }),
      prisma.messages.count(),
      prisma.conversations.count({ where: { type: "group" } })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        onlineUsers,
        totalMessages,
        totalGroups
      }
    });
  } catch (error) {
    console.error("Lỗi getStats admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thống kê", error: error.message });
  }
};

// 2. Danh sách người dùng (User Management with Search & Pagination)
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search ? req.query.search.trim() : "";
    const skip = (page - 1) * limit;

    const whereCondition = search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } }
          ]
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isBlocked: true,
          isOnline: true,
          lastActive: true,
          createdAt: true
        }
      }),
      prisma.users.count({ where: whereCondition })
    ]);

    const mappedUsers = users.map((u) => ({
      ...u,
      avatar: `/api/users/${u.id}/avatar`
    }));

    res.json({
      success: true,
      data: mappedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Lỗi getUsers admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách người dùng", error: error.message });
  }
};

// 3. Khóa/Mở khóa hoặc Đổi Role người dùng
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, role } = req.body;

    const existingUser = await prisma.users.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const updateData = {};
    if (typeof isBlocked === "boolean") {
      updateData.isBlocked = isBlocked;
    }
    if (role && ["USER", "ADMIN"].includes(role.toUpperCase())) {
      updateData.role = role.toUpperCase();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "Không có dữ liệu thay đổi hợp lệ." });
    }

    const updatedUser = await prisma.users.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isBlocked: true
      }
    });

    res.json({
      success: true,
      message: "Cập nhật trạng thái người dùng thành công!",
      data: updatedUser
    });
  } catch (error) {
    console.error("Lỗi updateUserStatus admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật trạng thái người dùng", error: error.message });
  }
};

// 4. Danh sách các cuộc trò chuyện (Conversations Monitoring)
exports.getConversations = async (req, res) => {
  try {
    const conversations = await prisma.conversations.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        ConversationMembers: {
          include: {
            Users: {
              select: {
                id: true,
                fullName: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: { Messages: true }
        }
      }
    });

    const mapped = conversations.map((conv) => {
      const members = conv.ConversationMembers.map((m) => ({
        id: m.Users?.id,
        fullName: m.Users?.fullName,
        username: m.Users?.username,
        role: m.role
      }));

      return {
        id: conv.id,
        name: conv.name || (conv.type === "private" ? members.map(m => m.fullName).join(" - ") : "Nhóm chat"),
        type: conv.type,
        avatar: conv.avatar,
        messageCount: conv._count.Messages,
        createdAt: conv.createdAt,
        members
      };
    });

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error("Lỗi getConversations admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách cuộc trò chuyện", error: error.message });
  }
};

// 5. Chi tiết lịch sử tin nhắn trong cuộc trò chuyện (Audit Log)
exports.getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params; // conversationId
    const messages = await prisma.messages.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      include: {
        Users: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    const mapped = messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.Users ? m.Users.fullName : "Hệ thống",
      type: m.type,
      content: m.content,
      imageUrl: m.imageUrl,
      audioUrl: m.audioUrl,
      isRecalled: m.isRecalled,
      createdAt: m.createdAt
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error("Lỗi getConversationMessages admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy lịch sử tin nhắn", error: error.message });
  }
};

// 6. Xóa / Thu hồi tin nhắn vi phạm
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const existingMessage = await prisma.messages.findUnique({ where: { id } });
    if (!existingMessage) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn." });
    }

    // Xóa cứng tin nhắn khỏi database để đảm bảo an toàn & tuân thủ audit
    await prisma.messages.delete({
      where: { id }
    });

    // Phát socket cho các thành viên trong cuộc trò chuyện (nếu có io)
    const io = req.app.get("io");
    if (io && existingMessage.conversationId) {
      io.to(existingMessage.conversationId).emit("message_deleted", { messageId: id });
    }

    res.json({ success: true, message: "Đã xóa tin nhắn vi phạm thành công!" });
  } catch (error) {
    console.error("Lỗi deleteMessage admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xóa tin nhắn", error: error.message });
  }
};

// 7. Lấy danh sách Báo cáo / Khiếu nại (Reports)
exports.getReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: { id: true, fullName: true, username: true }
        },
        reportedUser: {
          select: { id: true, fullName: true, username: true, isBlocked: true }
        }
      }
    });

    res.json({ success: true, data: reports });
  } catch (error) {
    console.error("Lỗi getReports admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách báo cáo", error: error.message });
  }
};

// 8. Cập nhật trạng thái Báo cáo / Khiếu nại
exports.updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // RESOLVED / DISMISSED / PENDING

    const updated = await prisma.report.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, message: "Đã cập nhật trạng thái báo cáo!", data: updated });
  } catch (error) {
    console.error("Lỗi updateReportStatus admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật báo cáo", error: error.message });
  }
};
