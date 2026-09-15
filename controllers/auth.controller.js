const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
const { v4: uuidv4 } = require("uuid");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role || "USER",
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Token có hạn 7 ngày
  );
};

exports.generateToken = generateToken;

exports.register = async (req, res) => {
  try {
    const { username, fullName, password, inviteToken } = req.body;

    if (!username || !fullName || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    // 1. Kiểm tra xem user đã tồn tại chưa
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } }
        ]
      },
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username đã tồn tại!" });
    }

    let assignedRole = "USER";
    let validInvite = null;

    // 2. Nếu có inviteToken, kiểm tra tính hợp lệ
    if (inviteToken) {
      validInvite = await prisma.userInvites.findUnique({
        where: { token: inviteToken }
      });

      if (!validInvite) {
        return res.status(400).json({ success: false, message: "Mã mời (Invite Token) không hợp lệ." });
      }

      if (validInvite.usedAt) {
        return res.status(400).json({ success: false, message: "Mã mời này đã được sử dụng trước đó." });
      }

      if (new Date(validInvite.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, message: "Mã mời này đã hết hạn sử dụng." });
      }

      if (validInvite.role) {
        assignedRole = validInvite.role;
      }
    }

    // 3. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Tạo user mới trong transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.users.create({
        data: {
          id: uuidv4(),
          username,
          fullName,
          password: hashedPassword,
          email: validInvite?.email || `${username}@zalo.clone`,
          phone: `+84-${username}`,
          role: assignedRole,
          status: "active",
          tokenVersion: 0,
          isBlocked: false,
        },
      });

      if (validInvite) {
        await tx.userInvites.update({
          where: { id: validInvite.id },
          data: {
            usedAt: new Date(),
            usedBy: createdUser.id
          }
        });
      }

      return createdUser;
    });

    // Map avatar và coverPhoto sang URL tĩnh để trả về cho client
    const mappedUser = {
      ...newUser,
      avatar: `/api/users/${newUser.id}/avatar`,
      coverPhoto: `/api/users/${newUser.id}/cover`,
    };
    delete mappedUser.password;
    const token = generateToken(newUser);
    res.status(201).json({ success: true, data: mappedUser, token });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ success: false, message: "Tên đăng nhập đã tồn tại, vui lòng chọn tên khác!" });
    }
    console.error("!!! LỖI ĐĂNG KÝ:", error);
    res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!" });
    }

    const cleanIdentifier = identifier.trim();
    console.log(`🔑 [LOGIN] Đang thử đăng nhập với tài khoản: "${cleanIdentifier}"`);

    // 1. Tìm user
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: cleanIdentifier, mode: "insensitive" } },
          { email: { equals: cleanIdentifier, mode: "insensitive" } },
          { phone: { equals: cleanIdentifier } }
        ]
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        password: true,
        bio: true,
        role: true,
        status: true,
        tokenVersion: true,
        isBlocked: true,
        isOnline: true,
        lastActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      console.log(`⚠️ [LOGIN FAILED] Tài khoản "${cleanIdentifier}" không tồn tại trong database`);
      return res.status(404).json({ success: false, message: "Tài khoản không tồn tại!" });
    }

    // Chặn tài khoản bị khóa
    if (user.isBlocked || user.status === "suspended") {
      console.log(`⚠️ [LOGIN FAILED] Tài khoản "${cleanIdentifier}" đã bị khóa`);
      return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên!" });
    }

    // Chặn tài khoản chờ xóa hoặc đã xóa
    if (user.status === "pending_deletion" || user.status === "deleted") {
      console.log(`⚠️ [LOGIN FAILED] Tài khoản "${cleanIdentifier}" trong trạng thái: ${user.status}`);
      return res.status(403).json({ success: false, message: "Tài khoản này không còn hoạt động hoặc đang chờ xóa." });
    }

    // 2. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
      console.log(`⚠️ [LOGIN FAILED] Mật khẩu không chính xác cho tài khoản "${cleanIdentifier}"`);
      return res.status(400).json({ success: false, message: "Mật khẩu không chính xác!" });
    }

    console.log(`✅ [LOGIN SUCCESS] Đăng nhập thành công cho: "${user.username}" (${user.fullName}) - Role: ${user.role}`);

    const mappedUser = {
      ...user,
      avatar: `/api/users/${user.id}/avatar`,
      coverPhoto: `/api/users/${user.id}/cover`,
    };
    delete mappedUser.password;

    const token = generateToken(user);
    res.status(200).json({ success: true, data: mappedUser, token });
  } catch (error) {
    console.error("!!! LỖI ĐĂNG NHẬP:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi đăng nhập", error: error.message });
  }
};

// Đặt lại mật khẩu bằng token một lần
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp mã token và mật khẩu mới (tối thiểu 6 ký tự).",
      });
    }

    const resetRecord = await prisma.passwordResets.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: "Mã đặt lại mật khẩu không hợp lệ." });
    }

    if (resetRecord.usedAt) {
      return res.status(400).json({ success: false, message: "Mã đặt lại mật khẩu này đã được sử dụng." });
    }

    if (new Date(resetRecord.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "Mã đặt lại mật khẩu đã hết hạn." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.users.update({
        where: { id: resetRecord.userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 }, // Thu hồi toàn bộ phiên cũ
        },
      }),
      prisma.passwordResets.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Toàn bộ phiên đăng nhập cũ đã được thu hồi an toàn.",
    });
  } catch (err) {
    console.error("Lỗi resetPasswordWithToken:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi đặt lại mật khẩu." });
  }
};
