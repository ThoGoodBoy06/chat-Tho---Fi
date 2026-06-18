const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { v4: uuidv4 } = require("uuid");

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }, // Token có hạn 7 ngày
  );
};

exports.register = async (req, res) => {
  try {
    const { username, fullName, password } = req.body;

    // 1. Kiểm tra xem user đã tồn tại chưa
    const existingUser = await prisma.users.findFirst({
      where: { username },
    });
    if (existingUser) {
      return res.status(400).json({ message: "Username đã tồn tại!" });
    }

    // 2. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Tạo user mới
    const user = await prisma.users.create({
      data: {
        id: uuidv4(),
        username,
        fullName,
        password: hashedPassword,
        email: `${username}@zalo.clone`, // Tự động tạo email ảo để vượt qua vòng bảo vệ DB
        phone: `+84-${username}`, // Tự động tạo SĐT ảo để vượt qua vòng bảo vệ DB
      },
    });

    // 4. Trả về kết quả kèm Token
    const token = generateToken(user);
    res.status(201).json({ success: true, data: user, token });
  } catch (error) {
    console.error("!!! LỖI ĐĂNG KÝ:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier có thể là email, phone hoặc username

    // 1. Tìm user
    const user = await prisma.users.findFirst({
      // Chỉ tìm bằng username vì đã đơn giản hóa form
      where: { username: identifier },
    });
    if (!user)
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });

    // 2. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Mật khẩu không chính xác!" });

    // 3. Cập nhật trạng thái Online
    await prisma.users.update({
      where: { id: user.id },
      data: { isOnline: true },
    });

    const token = generateToken(user);
    res.status(200).json({ success: true, data: user, token });
  } catch (error) {
    console.error("!!! LỖI ĐĂNG NHẬP:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
