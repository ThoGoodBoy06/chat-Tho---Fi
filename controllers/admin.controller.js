const prisma = require("../prisma");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { logAdminAction } = require("../services/audit.service");
const admin = require("../firebaseConfig");
const r2Service = require("../services/r2.service");
const supabaseService = require("../supabase");

// =========================================================================
// 1. ADMIN PROFILE & TỔNG QUAN HỆ THỐNG
// =========================================================================

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin quản trị." });
    }

    res.json({
      success: true,
      data: {
        ...user,
        avatar: `/api/users/${user.id}/avatar`,
      },
    });
  } catch (error) {
    console.error("Lỗi getMe admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thông tin Admin." });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingDeletionUsers,
      onlineUsers,
      totalMessages,
      totalGroups,
      totalReports,
      pendingReports,
    ] = await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: { status: "active", isBlocked: false } }),
      prisma.users.count({ where: { OR: [{ status: "suspended" }, { isBlocked: true }] } }),
      prisma.users.count({ where: { status: "pending_deletion" } }),
      prisma.users.count({ where: { isOnline: true } }),
      prisma.messages.count(),
      prisma.conversations.count({ where: { type: "group" } }),
      prisma.report.count(),
      prisma.report.count({ where: { status: "PENDING" } }),
    ]);

    const io = req.app.get("io");
    const activeSockets = io && io.sockets ? io.sockets.sockets.size : 0;
    const activeCallsCount = global.activeCalls ? Math.floor(global.activeCalls.size / 2) : 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          pendingDeletion: pendingDeletionUsers,
          online: onlineUsers,
        },
        chat: {
          totalMessages,
          totalGroups,
        },
        moderation: {
          totalReports,
          pendingReports,
        },
        operations: {
          activeSockets,
          activeCallsCount,
          serverUptimeSeconds: Math.floor(process.uptime()),
        },
      },
    });
  } catch (error) {
    console.error("Lỗi getStats admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thống kê", error: error.message });
  }
};

// =========================================================================
// 2. USER MANAGEMENT
// =========================================================================

exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search ? req.query.search.trim() : "";
    const roleFilter = req.query.role ? req.query.role.trim().toUpperCase() : "";
    const statusFilter = req.query.status ? req.query.status.trim().toLowerCase() : "";
    const skip = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        { id: { equals: search } },
        { fullName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (roleFilter && ["SUPER_ADMIN", "ADMIN", "MODERATOR", "USER"].includes(roleFilter)) {
      where.role = roleFilter;
    }

    if (statusFilter && ["active", "suspended", "pending_deletion", "deleted"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
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
          status: true,
          isBlocked: true,
          isOnline: true,
          lastActive: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          deletedBy: true,
          _count: {
            select: {
              devices: true,
              Messages: true,
              reportsReceived: true,
            },
          },
        },
      }),
      prisma.users.count({ where }),
    ]);

    const mappedUsers = users.map((u) => ({
      ...u,
      avatar: `/api/users/${u.id}/avatar`,
      deviceCount: u._count.devices,
      messageCount: u._count.Messages,
      reportedCount: u._count.reportsReceived,
    }));

    res.json({
      success: true,
      data: mappedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getUsers admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách người dùng", error: error.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        devices: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            platform: true,
            deviceId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            ConversationMembers: true,
            Messages: true,
            reportsCreated: true,
            reportsReceived: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    delete user.password;

    res.json({
      success: true,
      data: {
        ...user,
        avatar: `/api/users/${user.id}/avatar`,
        coverPhoto: `/api/users/${user.id}/cover`,
      },
    });
  } catch (error) {
    console.error("Lỗi getUserDetails admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thông tin chi tiết người dùng." });
  }
};

// Tạo Invite Link 1 lần
exports.createInviteLink = async (req, res) => {
  try {
    const { email, role = "USER", expiresInHours = 48 } = req.body;
    const adminRole = req.user.role;

    // Không cho phép tạo invite link có quyền cao hơn hoặc bằng bản thân nếu không phải SUPER_ADMIN
    if (role === "SUPER_ADMIN" && adminRole !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền tạo liên kết mời Super Admin." });
    }
    if (role === "ADMIN" && adminRole !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Chỉ Super Admin mới được mời Admin mới." });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invite = await prisma.userInvites.create({
      data: {
        id: uuidv4(),
        email: email ? email.trim().toLowerCase() : null,
        role,
        token,
        createdBy: req.user.id,
        expiresAt,
      },
    });

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_INVITE_CREATE",
      targetType: "USER_INVITE",
      targetId: invite.id,
      details: { email, role, expiresInHours, tokenPreview: token.slice(0, 8) + "..." },
    });

    const inviteUrl = `${req.protocol}://${req.get("host")}/register?invite=${token}`;

    res.json({
      success: true,
      message: "Đã tạo liên kết mời một lần thành công!",
      data: {
        id: invite.id,
        token,
        inviteUrl,
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("Lỗi createInviteLink admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi tạo liên kết mời." });
  }
};

// Sinh Link Đặt lại mật khẩu (Không gửi mật khẩu thô)
exports.generatePasswordResetLink = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    if (user.role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Không thể can thiệp mật khẩu của Super Admin." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

    const resetRecord = await prisma.passwordResets.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_PASSWORD_RESET_LINK_GENERATE",
      targetType: "USER",
      targetId: user.id,
      details: { username: user.username, expiresAt },
    });

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${resetToken}`;

    res.json({
      success: true,
      message: "Đã tạo liên kết đặt lại mật khẩu an toàn.",
      data: {
        resetUrl,
        token: resetToken,
        expiresAt,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Lỗi generatePasswordResetLink admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi tạo link reset mật khẩu." });
  }
};

// Khóa / Mở khóa tài khoản & thu hồi phiên tức thì
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // status: "active" | "suspended"

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ (chỉ chấp nhận active hoặc suspended)." });
    }

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // Không được khóa chính mình
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Bạn không thể tự khóa tài khoản của chính mình!" });
    }

    // Phân quyền: ADMIN/MODERATOR không được can thiệp tài khoản có role ngang hoặc cao hơn
    if (req.user.role !== "SUPER_ADMIN") {
      if (targetUser.role === "SUPER_ADMIN" || targetUser.role === "ADMIN") {
        return res.status(403).json({ success: false, message: "Bạn không có quyền khóa tài khoản Quản trị viên khác." });
      }
    }

    const isBlocked = status === "suspended";

    // Cập nhật trạng thái + tăng tokenVersion để thu hồi JWT trên mọi thiết bị
    const updated = await prisma.users.update({
      where: { id },
      data: {
        status,
        isBlocked,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        isBlocked: true,
        tokenVersion: true,
      },
    });

    // Ngắt kết nối socket của người dùng ngay lập tức
    const io = req.app.get("io");
    if (io && io.userSockets) {
      const socketId = io.userSockets.get(id);
      if (socketId) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.emit("force_logout", {
            reason: isBlocked ? "Tài khoản của bạn đã bị tạm khóa bởi Quản trị viên." : "Trạng thái tài khoản đã thay đổi.",
          });
          targetSocket.disconnect(true);
        }
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: isBlocked ? "USER_SUSPEND" : "USER_ACTIVATE",
      targetType: "USER",
      targetId: id,
      details: { previousStatus: targetUser.status, newStatus: status, reason: reason || "N/A" },
    });

    res.json({
      success: true,
      message: isBlocked ? "Đã khóa tài khoản và thu hồi phiên đăng nhập thành công!" : "Đã mở khóa tài khoản thành công!",
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi updateUserStatus admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật trạng thái người dùng." });
  }
};

// Đổi vai trò (Role)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "USER"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "Vai trò không hợp lệ." });
    }

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    // Chỉ SUPER_ADMIN mới được đổi vai trò sang ADMIN/SUPER_ADMIN hoặc hạ vai trò của ADMIN/SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Chỉ Super Admin mới có quyền thay đổi vai trò quản trị." });
    }

    // Không được hạ Super Admin cuối cùng
    if (targetUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const superAdminCount = await prisma.users.count({
        where: { role: "SUPER_ADMIN", status: "active" },
      });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Không thể hạ vai trò của Super Admin duy nhất trong hệ thống!",
        });
      }
    }

    const updated = await prisma.users.update({
      where: { id },
      data: {
        role,
        tokenVersion: { increment: 1 }, // Thu hồi phiên để làm mới JWT
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_ROLE_CHANGE",
      targetType: "USER",
      targetId: id,
      details: { previousRole: targetUser.role, newRole: role },
    });

    res.json({
      success: true,
      message: `Đã cập nhật vai trò người dùng thành ${role}!`,
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi updateUserRole admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi đổi vai trò người dùng." });
  }
};

// Bắt buộc đăng xuất tất cả thiết bị (Force Logout)
exports.forceLogout = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    await prisma.users.update({
      where: { id },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    const io = req.app.get("io");
    if (io && io.userSockets) {
      const socketId = io.userSockets.get(id);
      if (socketId) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.emit("force_logout", { reason: "Phiên đăng nhập đã bị Quản trị viên kết thúc." });
          targetSocket.disconnect(true);
        }
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_FORCE_LOGOUT",
      targetType: "USER",
      targetId: id,
      details: { username: targetUser.username },
    });

    res.json({ success: true, message: "Đã thu hồi token và bắt buộc đăng xuất người dùng trên toàn bộ thiết bị!" });
  } catch (error) {
    console.error("Lỗi forceLogout admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi thực hiện force logout." });
  }
};

// XÓA BƯỚC 1: Chuyển sang pending_deletion
exports.setPendingDeletion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Bạn không thể tự đưa tài khoản của mình vào danh sách xóa!" });
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Không thể đưa tài khoản Super Admin vào danh sách xóa." });
    }

    const updated = await prisma.users.update({
      where: { id },
      data: {
        status: "pending_deletion",
        isBlocked: true,
        deletedAt: new Date(),
        deletedBy: req.user.username,
        tokenVersion: { increment: 1 },
      },
    });

    // Ngắt kết nối socket ngay lập tức
    const io = req.app.get("io");
    if (io && io.userSockets) {
      const socketId = io.userSockets.get(id);
      if (socketId) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.emit("force_logout", { reason: "Tài khoản của bạn đã được chuyển sang trạng thái chờ xóa." });
          targetSocket.disconnect(true);
        }
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_PENDING_DELETION",
      targetType: "USER",
      targetId: id,
      details: { username: targetUser.username, reason: reason || "N/A" },
    });

    res.json({
      success: true,
      message: "Đã chuyển tài khoản sang trạng thái chờ xóa và vô hiệu hóa toàn bộ quyền truy cập.",
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi setPendingDeletion admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi chuyển trạng thái xóa." });
  }
};

// XÓA BƯỚC 2: Xóa vĩnh viễn & Ẩn danh hóa (CHỈ SUPER_ADMIN)
exports.permanentDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmText } = req.body;

    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Chỉ Super Admin mới có quyền xóa vĩnh viễn tài khoản!" });
    }

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ success: false, message: "Bạn không thể tự xóa tài khoản của chính mình!" });
    }

    // Yêu cầu nhập đúng chuỗi xác nhận: "XÓA VĨNH VIỄN <username>"
    const expectedConfirm = `XÓA VĨNH VIỄN ${targetUser.username}`;
    if (!confirmText || confirmText.trim() !== expectedConfirm) {
      return res.status(400).json({
        success: false,
        message: `Vui lòng nhập chính xác chuỗi xác nhận: "${expectedConfirm}" để tiến hành xóa.`,
      });
    }

    // Ẩn danh hóa dữ liệu người dùng để bảo toàn toàn vẹn hội thoại cho các thành viên khác
    const anonymizedUsername = `deleted_${uuidv4().slice(0, 8)}`;
    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

    await prisma.$transaction(async (tx) => {
      // 1. Xóa các thiết bị đăng ký push FCM
      await tx.userDevices.deleteMany({ where: { userId: id } });

      // 2. Xóa các invite và reset token liên quan
      await tx.passwordResets.deleteMany({ where: { userId: id } });
      await tx.userInvites.deleteMany({ where: { usedBy: id } });

      // 3. Ẩn danh hóa thông tin người dùng trong DB
      await tx.users.update({
        where: { id },
        data: {
          username: anonymizedUsername,
          fullName: "Người dùng đã xóa",
          email: `${anonymizedUsername}@deleted.internal`,
          phone: null,
          avatar: null,
          coverPhoto: null,
          bio: null,
          password: randomHash,
          status: "deleted",
          isBlocked: true,
          deletedAt: new Date(),
          deletedBy: req.user.username,
          tokenVersion: { increment: 100 },
        },
      });
    });

    // Ngắt socket nếu còn sót
    const io = req.app.get("io");
    if (io && io.userSockets) {
      const socketId = io.userSockets.get(id);
      if (socketId) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
          targetSocket.disconnect(true);
        }
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "USER_PERMANENT_DELETE",
      targetType: "USER",
      targetId: id,
      details: { originalUsername: targetUser.username, anonymizedUsername },
    });

    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn và ẩn danh hóa tài khoản "${targetUser.username}" an toàn!`,
    });
  } catch (error) {
    console.error("Lỗi permanentDeleteUser admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xóa vĩnh viễn người dùng." });
  }
};

// =========================================================================
// 3. REPORTS & MODERATION
// =========================================================================

exports.getReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status ? req.query.status.trim().toUpperCase() : "";
    const skip = (page - 1) * limit;

    const where = {};
    if (status && ["PENDING", "RESOLVED", "DISMISSED"].includes(status)) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: { id: true, fullName: true, username: true },
          },
          reportedUser: {
            select: { id: true, fullName: true, username: true, role: true, status: true, isBlocked: true },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getReports admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách báo cáo", error: error.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, suspendUser, reason } = req.body; // status: RESOLVED | DISMISSED | PENDING

    if (!["RESOLVED", "DISMISSED", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái báo cáo không hợp lệ." });
    }

    const existingReport = await prisma.report.findUnique({
      where: { id },
      include: { reportedUser: true },
    });

    if (!existingReport) {
      return res.status(404).json({ success: false, message: "Không tìm thấy báo cáo." });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { status },
    });

    // Nếu chọn đình chỉ luôn người dùng vi phạm
    if (suspendUser && existingReport.reportedUserId) {
      await prisma.users.update({
        where: { id: existingReport.reportedUserId },
        data: {
          status: "suspended",
          isBlocked: true,
          tokenVersion: { increment: 1 },
        },
      });

      const io = req.app.get("io");
      if (io && io.userSockets) {
        const sId = io.userSockets.get(existingReport.reportedUserId);
        if (sId) {
          const s = io.sockets.sockets.get(sId);
          if (s) {
            s.emit("force_logout", { reason: "Tài khoản bị đình chỉ do vi phạm quy tắc cộng đồng." });
            s.disconnect(true);
          }
        }
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "REPORT_STATUS_UPDATE",
      targetType: "REPORT",
      targetId: id,
      details: { status, suspendUser: !!suspendUser, reason: reason || "N/A" },
    });

    res.json({
      success: true,
      message: "Đã cập nhật trạng thái báo cáo thành công!",
      data: updated,
    });
  } catch (error) {
    console.error("Lỗi updateReportStatus admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật báo cáo", error: error.message });
  }
};

// =========================================================================
// 4. NOTIFICATIONS (FCM BROADCAST)
// =========================================================================

exports.previewNotification = async (req, res) => {
  try {
    const { audience = "ALL", targetRole = "USER" } = req.body;

    let userFilter = { status: "active", isBlocked: false };

    if (audience === "ONLINE") {
      userFilter.isOnline = true;
    } else if (audience === "ROLE" && targetRole) {
      userFilter.role = targetRole;
    }

    const [userCount, deviceCount] = await Promise.all([
      prisma.users.count({ where: userFilter }),
      prisma.userDevices.count({
        where: {
          user: userFilter,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        audience,
        targetRole: audience === "ROLE" ? targetRole : null,
        estimatedUsers: userCount,
        estimatedDevices: deviceCount,
      },
    });
  } catch (error) {
    console.error("Lỗi previewNotification admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xem trước thông báo." });
  }
};

exports.broadcastNotification = async (req, res) => {
  try {
    const { title, body, audience = "ALL", targetRole = "USER", data = {} } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập tiêu đề và nội dung thông báo." });
    }

    let userFilter = { status: "active", isBlocked: false };
    if (audience === "ONLINE") {
      userFilter.isOnline = true;
    } else if (audience === "ROLE" && targetRole) {
      userFilter.role = targetRole;
    }

    // Lấy tất cả FCM Token của nhóm người dùng
    const devices = await prisma.userDevices.findMany({
      where: {
        user: userFilter,
      },
      select: { fcmToken: true },
    });

    const tokens = Array.from(new Set(devices.map((d) => d.fcmToken).filter(Boolean)));

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0 && admin && admin.messaging) {
      // Gửi theo từng batch 500 token
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);
        try {
          const response = await admin.messaging().sendEachForMulticast({
            tokens: batchTokens,
            notification: { title, body },
            data: {
              ...data,
              type: "ADMIN_BROADCAST",
              sentAt: new Date().toISOString(),
            },
          });
          successCount += response.successCount;
          failureCount += response.failureCount;
        } catch (fcmErr) {
          console.error("Lỗi gửi batch FCM:", fcmErr.message);
          failureCount += batchTokens.length;
        }
      }
    }

    // Gửi realtime qua Socket.IO cho những người đang mở app
    const io = req.app.get("io");
    if (io) {
      io.emit("admin_broadcast_message", {
        title,
        body,
        sentAt: new Date().toISOString(),
      });
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "BROADCAST_FCM",
      targetType: "NOTIFICATION",
      details: { title, audience, targetRole, totalTokens: tokens.length, successCount, failureCount },
    });

    res.json({
      success: true,
      message: `Đã phát thông báo thành công! (Gửi thành công: ${successCount}, Thất bại: ${failureCount})`,
      data: {
        totalRecipients: tokens.length,
        successCount,
        failureCount,
      },
    });
  } catch (error) {
    console.error("Lỗi broadcastNotification admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi gửi thông báo đẩy." });
  }
};

// =========================================================================
// 5. CALLS CENTER (GIÁM SÁT CUỘC GỌI - ZERO EAVESDROPPING)
// =========================================================================

exports.getActiveCalls = async (req, res) => {
  try {
    const rawActive = global.activeCalls || new Map();
    const callsList = [];
    const seenRooms = new Set();

    // Duyệt qua map activeCalls in-memory
    for (const [userId, callData] of rawActive.entries()) {
      const roomKey = callData.room || [userId, callData.partnerId].sort().join("_");
      if (!seenRooms.has(roomKey)) {
        seenRooms.add(roomKey);
        callsList.push({
          room: roomKey,
          callerId: callData.isCaller ? userId : callData.partnerId,
          calleeId: callData.isCaller ? callData.partnerId : userId,
          callType: callData.callType || "audio",
          status: callData.status || "active",
          startTime: callData.startTime || Date.now(),
          durationSeconds: Math.floor((Date.now() - (callData.startTime || Date.now())) / 1000),
        });
      }
    }

    // Populate tên và thông tin người gọi/người nhận
    const allUserIds = Array.from(new Set(callsList.flatMap((c) => [c.callerId, c.calleeId]).filter(Boolean)));
    const usersMap = new Map();

    if (allUserIds.length > 0) {
      const users = await prisma.users.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, fullName: true, username: true },
      });
      users.forEach((u) => usersMap.set(u.id, u));
    }

    const populated = callsList.map((c) => ({
      ...c,
      callerName: usersMap.get(c.callerId)?.fullName || "Người dùng",
      calleeName: usersMap.get(c.calleeId)?.fullName || "Người dùng",
    }));

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    console.error("Lỗi getActiveCalls admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách cuộc gọi." });
  }
};

exports.getCallStats = async (req, res) => {
  try {
    const [totalMissedCalls, recentCalls] = await Promise.all([
      prisma.messages.count({
        where: { type: "missed_call" },
      }),
      prisma.messages.findMany({
        where: { type: "missed_call" },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          Users: { select: { id: true, fullName: true, username: true } },
        },
      }),
    ]);

    const activeCount = global.activeCalls ? Math.floor(global.activeCalls.size / 2) : 0;

    res.json({
      success: true,
      data: {
        activeCount,
        totalMissedCalls,
        recentCalls: recentCalls.map((c) => ({
          id: c.id,
          callerName: c.Users?.fullName || "Ẩn danh",
          conversationId: c.conversationId,
          content: c.content,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Lỗi getCallStats admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thống kê cuộc gọi." });
  }
};

// =========================================================================
// 6. MEDIA & STORAGE METRICS
// =========================================================================

exports.getMediaStats = async (req, res) => {
  try {
    const [
      totalImages,
      totalVideos,
      totalAudios,
      totalFiles,
      usersWithAvatar,
    ] = await Promise.all([
      prisma.messages.count({ where: { imageUrl: { not: null } } }),
      prisma.messages.count({ where: { videoUrl: { not: null } } }),
      prisma.messages.count({ where: { audioUrl: { not: null } } }),
      prisma.messages.count({ where: { fileUrl: { not: null } } }),
      prisma.users.count({ where: { avatar: { not: null } } }),
    ]);

    // Thống kê ước tính dung lượng dựa trên cấu trúc phân tầng
    // Avatar + Audio: Supabase Storage
    // Video + File lớn: Cloudflare R2
    const isR2Ready = r2Service && r2Service.isConfigured ? r2Service.isConfigured() : false;
    const isSupabaseReady = supabaseService && supabaseService.isConfigured ? supabaseService.isConfigured() : false;

    res.json({
      success: true,
      data: {
        counts: {
          images: totalImages,
          videos: totalVideos,
          audios: totalAudios,
          files: totalFiles,
          avatars: usersWithAvatar,
          total: totalImages + totalVideos + totalAudios + totalFiles + usersWithAvatar,
        },
        storageBackends: {
          supabase: {
            configured: isSupabaseReady,
            primaryFor: "Avatars & Audio Voice (< 1.5MB)",
          },
          cloudflareR2: {
            configured: isR2Ready,
            bucket: process.env.R2_BUCKET_NAME || "tho-fi-media",
            primaryFor: "Videos, Large Attachments & HD Images (>= 1.5MB)",
            egressFee: "0đ (Zero Egress)",
          },
        },
      },
    });
  } catch (error) {
    console.error("Lỗi getMediaStats admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thống kê lưu trữ." });
  }
};

// =========================================================================
// 7. SYSTEM STATUS & CONFIGURATION
// =========================================================================

exports.getSystemHealth = async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const io = req.app.get("io");

    let dbLatencyMs = 0;
    const startDb = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startDb;
    } catch (e) {
      dbLatencyMs = -1;
    }

    res.json({
      success: true,
      data: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round(memUsage.rss / (1024 * 1024)),
          heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
        },
        database: {
          connected: dbLatencyMs >= 0,
          latencyMs: dbLatencyMs,
        },
        socketIO: {
          connectedClients: io && io.sockets ? io.sockets.sockets.size : 0,
          registeredUsers: io && io.userSockets ? io.userSockets.size : 0,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Lỗi getSystemHealth admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy trạng thái hệ thống." });
  }
};

exports.getSystemConfig = async (req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    const configMap = {};
    configs.forEach((c) => {
      configMap[c.key] = c.value;
    });

    const defaultConfig = {
      maintenanceMode: false,
      maintenanceMessage: "Hệ thống đang bảo trì định kỳ. Vui lòng quay lại sau ít phút!",
      allowRegistration: true,
      allowVoiceCalls: true,
      allowVideoCalls: true,
      allowFileUploads: true,
      ...configMap,
    };

    res.json({
      success: true,
      data: defaultConfig,
    });
  } catch (error) {
    console.error("Lỗi getSystemConfig admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy cấu hình hệ thống." });
  }
};

exports.updateSystemConfig = async (req, res) => {
  try {
    const updates = req.body; // e.g. { maintenanceMode: true, allowRegistration: false, ... }
    if (typeof updates !== "object" || Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: "Dữ liệu cấu hình không hợp lệ." });
    }

    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: {
          value,
          updatedBy: req.user.username,
        },
        create: {
          key,
          value,
          updatedBy: req.user.username,
        },
      });
    }

    // Nếu thay đổi maintenance mode, phát socket cho toàn bộ client
    if (typeof updates.maintenanceMode === "boolean") {
      const io = req.app.get("io");
      if (io) {
        io.emit("system_maintenance_status", {
          maintenanceMode: updates.maintenanceMode,
          message: updates.maintenanceMessage || "Hệ thống bảo trì.",
        });
      }
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "SYSTEM_CONFIG_UPDATE",
      targetType: "SYSTEM",
      details: updates,
    });

    res.json({
      success: true,
      message: "Đã cập nhật cấu hình hệ thống thành công!",
      data: updates,
    });
  } catch (error) {
    console.error("Lỗi updateSystemConfig admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật cấu hình hệ thống." });
  }
};

// =========================================================================
// 8. ADMIN AUDIT LOGS
// =========================================================================

exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const actionFilter = req.query.action ? req.query.action.trim() : "";
    const search = req.query.search ? req.query.search.trim() : "";
    const skip = (page - 1) * limit;

    const where = {};
    if (actionFilter) {
      where.action = actionFilter;
    }
    if (search) {
      where.OR = [
        { adminUsername: { contains: search, mode: "insensitive" } },
        { targetType: { contains: search, mode: "insensitive" } },
        { targetId: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getAuditLogs admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy nhật ký quản trị." });
  }
};

// =========================================================================
// 9. CONVERSATIONS & CHAT MODERATION
// =========================================================================

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
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { Messages: true },
        },
      },
    });

    const mapped = conversations.map((conv) => {
      const members = conv.ConversationMembers.map((m) => ({
        id: m.Users?.id,
        fullName: m.Users?.fullName,
        username: m.Users?.username,
        role: m.role,
      }));

      return {
        id: conv.id,
        name: conv.name || (conv.type === "private" ? members.map((m) => m.fullName).join(" - ") : "Nhóm chat"),
        type: conv.type,
        avatar: conv.avatar,
        messageCount: conv._count.Messages,
        createdAt: conv.createdAt,
        members,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error("Lỗi getConversations admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách cuộc trò chuyện", error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const existingMessage = await prisma.messages.findUnique({ where: { id } });
    if (!existingMessage) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn." });
    }

    await prisma.messages.delete({ where: { id } });

    const io = req.app.get("io");
    if (io && existingMessage.conversationId) {
      io.to(existingMessage.conversationId).emit("message_deleted", { messageId: id });
    }

    await logAdminAction({
      req,
      admin: req.user,
      action: "MESSAGE_DELETE",
      targetType: "MESSAGE",
      targetId: id,
      details: { conversationId: existingMessage.conversationId, senderId: existingMessage.senderId },
    });

    res.json({ success: true, message: "Đã xóa tin nhắn vi phạm thành công!" });
  } catch (error) {
    console.error("Lỗi deleteMessage admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xóa tin nhắn", error: error.message });
  }
};

// Lấy lịch sử tin nhắn & hình ảnh của một cuộc hội thoại cụ thể (Kèm rõ Người gửi & Người nhận)
exports.getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params; // conversationId
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [conv, messages, total] = await Promise.all([
      prisma.conversations.findUnique({
        where: { id },
        include: {
          ConversationMembers: {
            include: {
              Users: {
                select: { id: true, fullName: true, username: true, avatar: true },
              },
            },
          },
        },
      }),
      prisma.messages.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          Users: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.messages.count({ where: { conversationId: id } }),
    ]);

    const isDirect = conv?.type === "private";
    const members = conv?.ConversationMembers || [];

    // Đảo ngược từ cũ đến mới theo dòng thời gian
    const sorted = messages.reverse().map((m) => {
      let receiverName = "";
      let receiverUsername = "";
      let receiverId = null;

      if (isDirect) {
        const otherMember = members.find((cm) => cm.userId !== m.senderId)?.Users;
        receiverName = otherMember?.fullName || "Người nhận";
        receiverUsername = otherMember?.username || "N/A";
        receiverId = otherMember?.id || null;
      } else {
        receiverName = conv?.name || "Nhóm trò chuyện";
        receiverUsername = "Group";
      }

      return {
        id: m.id,
        conversationId: m.conversationId,
        conversationType: conv?.type,
        conversationName: conv?.name,
        senderId: m.senderId,
        senderName: m.Users?.fullName || "Hệ thống",
        senderUsername: m.Users?.username || "N/A",
        senderAvatar: m.Users ? `/api/users/${m.Users.id}/avatar` : null,
        receiverId,
        receiverName,
        receiverUsername,
        isDirect,
        type: m.type,
        content: m.content,
        imageUrl: m.imageUrl,
        videoUrl: m.videoUrl,
        audioUrl: m.audioUrl,
        fileUrl: m.fileUrl,
        isRecalled: m.isRecalled,
        createdAt: m.createdAt,
      };
    });

    res.json({
      success: true,
      data: sorted,
      conversation: {
        id: conv?.id,
        name: conv?.name,
        type: conv?.type,
        members: members.map((m) => ({
          id: m.Users?.id,
          fullName: m.Users?.fullName,
          username: m.Users?.username,
          avatar: m.Users ? `/api/users/${m.Users.id}/avatar` : null,
        })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getConversationMessages admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy tin nhắn cuộc hội thoại." });
  }
};

// Lấy thư viện hình ảnh & media tải lên gần đây trong toàn hệ thống (Kèm rõ Người gửi & Người nhận)
exports.getRecentMediaGallery = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 24));
    const type = req.query.type || "all"; // all | image | video | audio
    const skip = (page - 1) * limit;

    const where = {};
    if (type === "image") {
      where.imageUrl = { not: null };
    } else if (type === "video") {
      where.videoUrl = { not: null };
    } else if (type === "audio") {
      where.audioUrl = { not: null };
    } else {
      where.OR = [
        { imageUrl: { not: null } },
        { videoUrl: { not: null } },
        { audioUrl: { not: null } },
      ];
    }

    const [mediaMessages, total] = await Promise.all([
      prisma.messages.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          Users: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          Conversations: {
            include: {
              ConversationMembers: {
                include: {
                  Users: {
                    select: { id: true, fullName: true, username: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.messages.count({ where }),
    ]);

    const mapped = mediaMessages.map((m) => {
      const conv = m.Conversations;
      const isDirect = conv?.type === "private";
      const members = conv?.ConversationMembers || [];
      let receiverName = "";
      let receiverUsername = "";

      if (isDirect) {
        const otherMember = members.find((cm) => cm.userId !== m.senderId)?.Users;
        receiverName = otherMember?.fullName || "Người nhận";
        receiverUsername = otherMember?.username || "N/A";
      } else {
        receiverName = conv?.name || "Nhóm";
        receiverUsername = "Group";
      }

      return {
        id: m.id,
        conversationId: m.conversationId,
        conversationName: conv?.name || (isDirect ? `Chat 1-1 (${m.Users?.fullName} - ${receiverName})` : "Nhóm"),
        senderName: m.Users?.fullName || "Ẩn danh",
        senderUsername: m.Users?.username || "N/A",
        receiverName,
        receiverUsername,
        isDirect,
        type: m.type,
        imageUrl: m.imageUrl,
        videoUrl: m.videoUrl,
        audioUrl: m.audioUrl,
        content: m.content,
        createdAt: m.createdAt,
      };
    });

    res.json({
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getRecentMediaGallery admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy thư viện media." });
  }
};

// Tra cứu trực tiếp: Ai đã gửi tin nhắn / hình ảnh cho Ai
exports.directMessageLookup = async (req, res) => {
  try {
    const { senderId, receiverId, onlyMedia, bidirectional, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 40));
    const skip = (page - 1) * limit;

    const where = {};

    if (onlyMedia === "true" || onlyMedia === "1" || onlyMedia === "image") {
      where.imageUrl = { not: null };
    } else if (onlyMedia === "media") {
      where.OR = [
        { imageUrl: { not: null } },
        { videoUrl: { not: null } },
        { audioUrl: { not: null } },
      ];
    }

    if (search && search.trim()) {
      where.content = { contains: search.trim(), mode: "insensitive" };
    }

    if (senderId && receiverId) {
      // Tìm các cuộc trò chuyện có sự tham gia của cả senderId và receiverId
      const convsWithSender = await prisma.conversationMembers.findMany({
        where: { userId: senderId },
        select: { conversationId: true },
      });
      const convIdsSender = convsWithSender.map((c) => c.conversationId).filter(Boolean);

      const sharedMembers = await prisma.conversationMembers.findMany({
        where: {
          conversationId: { in: convIdsSender },
          userId: receiverId,
        },
        select: { conversationId: true },
      });
      const sharedConvIds = sharedMembers.map((c) => c.conversationId).filter(Boolean);

      if (sharedConvIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          info: "Không có hội thoại chung giữa 2 người dùng này.",
        });
      }

      where.conversationId = { in: sharedConvIds };

      // Nếu không bật bidirectional thì chỉ lấy tin nhắn do senderId gửi
      if (bidirectional !== "true" && bidirectional !== "1") {
        where.senderId = senderId;
      }
    } else if (senderId) {
      where.senderId = senderId;
    } else if (receiverId) {
      // Tìm tất cả hội thoại có receiverId tham gia nhưng không phải do receiverId gửi
      const convs = await prisma.conversationMembers.findMany({
        where: { userId: receiverId },
        select: { conversationId: true },
      });
      const convIds = convs.map((c) => c.conversationId).filter(Boolean);
      where.conversationId = { in: convIds };
      where.senderId = { not: receiverId };
    }

    const [messages, total] = await Promise.all([
      prisma.messages.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          Users: {
            select: { id: true, fullName: true, username: true, avatar: true },
          },
          Conversations: {
            include: {
              ConversationMembers: {
                include: {
                  Users: {
                    select: { id: true, fullName: true, username: true, avatar: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.messages.count({ where }),
    ]);

    const mapped = messages.map((m) => {
      const conv = m.Conversations;
      const isDirect = conv?.type === "private";
      const members = conv?.ConversationMembers || [];
      const receiverMember = members.find((cm) => cm.userId !== m.senderId)?.Users;

      const receiverName = isDirect
        ? receiverMember?.fullName || "Người nhận"
        : conv?.name || "Nhóm";
      const receiverUsername = isDirect ? receiverMember?.username || "N/A" : null;
      const receiverAvatar = isDirect && receiverMember ? `/api/users/${receiverMember.id}/avatar` : null;

      return {
        id: m.id,
        conversationId: m.conversationId,
        conversationType: conv?.type,
        conversationName: conv?.name,
        senderId: m.senderId,
        senderName: m.Users?.fullName || "Hệ thống",
        senderUsername: m.Users?.username || "N/A",
        senderAvatar: m.Users ? `/api/users/${m.Users.id}/avatar` : null,
        receiverId: isDirect ? receiverMember?.id : null,
        receiverName,
        receiverUsername,
        receiverAvatar,
        isDirect,
        type: m.type,
        content: m.content,
        imageUrl: m.imageUrl,
        videoUrl: m.videoUrl,
        audioUrl: m.audioUrl,
        fileUrl: m.fileUrl,
        isRecalled: m.isRecalled,
        createdAt: m.createdAt,
      };
    });

    res.json({
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi directMessageLookup admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi tra cứu tin nhắn.", error: error.message });
  }
};

// Lấy danh sách giản lược toàn bộ người dùng để đổ vào các ô chọn Người gửi / Người nhận
exports.getAllUsersSimple = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      where: { status: { not: "deleted" } },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatar: true,
        role: true,
      },
      orderBy: { fullName: "asc" },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Lỗi getAllUsersSimple admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách người dùng." });
  }
};
