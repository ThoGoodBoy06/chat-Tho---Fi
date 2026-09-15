const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

const authMiddleware = async (req, res, next) => {
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

    // Kiểm tra trạng thái tài khoản và tokenVersion mới nhất từ database
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        tokenVersion: true,
        isBlocked: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Tài khoản không tồn tại." });
    }

    if (user.isBlocked || user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.",
      });
    }

    if (user.status === "pending_deletion" || user.status === "deleted") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này đang chờ xóa hoặc đã bị hủy.",
      });
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại!",
      });
    }

    req.user = {
      ...decoded,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

module.exports = authMiddleware;
