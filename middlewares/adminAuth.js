const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

/**
 * Middleware xác thực Admin và kiểm tra tokenVersion / trạng thái hoạt động
 */
const adminAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Không tìm thấy token. Truy cập bị từ chối!" });
  }

  let token = authHeader.substring(7).trim();
  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1).trim();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Truy vấn trực tiếp từ DB để đảm bảo thông tin role, status và tokenVersion mới nhất
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
        isBlocked: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại!" });
    }

    // 1. Kiểm tra trạng thái khóa tài khoản
    if (user.isBlocked || user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.",
      });
    }

    // 2. Kiểm tra trạng thái xóa tài khoản
    if (user.status === "pending_deletion" || user.status === "deleted") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đang trong trạng thái chờ xóa hoặc đã bị hủy.",
      });
    }

    // 3. Kiểm tra thu hồi phiên (Instant token revocation qua tokenVersion)
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Phiên làm việc đã bị thu hồi. Vui lòng đăng nhập lại!",
      });
    }

    // 4. Kiểm tra quyền Admin tối thiểu (SUPER_ADMIN, ADMIN hoặc MODERATOR)
    const validAdminRoles = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];
    if (!validAdminRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Truy cập bị từ chối! Yêu cầu quyền Quản trị viên.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

/**
 * Middleware phân quyền chi tiết (RBAC)
 * SUPER_ADMIN luôn có quyền tối thượng, kế tiếp là các role được liệt kê
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Yêu cầu đăng nhập." });
    }

    const userRole = req.user.role;
    if (userRole === "SUPER_ADMIN" || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Truy cập bị từ chối! Thao tác này yêu cầu quyền: ${allowedRoles.join(" hoặc ")} (Vai trò hiện tại của bạn: ${userRole}).`,
    });
  };
};

module.exports = adminAuth;
module.exports.adminAuth = adminAuth;
module.exports.requireRole = requireRole;
