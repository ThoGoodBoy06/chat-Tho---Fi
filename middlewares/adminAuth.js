const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

const adminAuth = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Không tìm thấy token. Truy cập bị từ chối!" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Truy vấn trực tiếp từ DB để đảm bảo thông tin role và status mới nhất
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, fullName: true, email: true, role: true, isBlocked: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại!" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa." });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Truy cập bị từ chối! Quyền Admin là bắt buộc." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

module.exports = adminAuth;
