require("dotenv").config();
const prisma = require("./prisma");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

async function seedAdmin() {
  try {
    const username = "admin";
    const rawPassword = "123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const existingAdmin = await prisma.users.findFirst({
      where: { username: "admin" }
    });

    if (existingAdmin) {
      await prisma.users.update({
        where: { id: existingAdmin.id },
        data: {
          password: hashedPassword,
          role: "ADMIN",
          isBlocked: false,
          fullName: existingAdmin.fullName || "Quản trị viên Admin"
        }
      });
      console.log("✅ Đã cập nhật tài khoản Admin thành công! (Username: admin, Password: 123)");
    } else {
      await prisma.users.create({
        data: {
          id: uuidv4(),
          username: "admin",
          password: hashedPassword,
          fullName: "Quản trị viên Admin",
          email: "admin@zalo.clone",
          phone: "+84-admin",
          role: "ADMIN",
          isBlocked: false
        }
      });
      console.log("✅ Đã tạo mới tài khoản Admin thành công! (Username: admin, Password: 123)");
    }
  } catch (err) {
    console.error("❌ Lỗi khi seed tài khoản Admin:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
