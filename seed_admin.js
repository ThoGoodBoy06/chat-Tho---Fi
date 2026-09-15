require("dotenv").config();
const prisma = require("./prisma");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

async function seedAdmin() {
  try {
    const username = (process.env.SUPER_ADMIN_USERNAME || "admin").trim();
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@ThoFi2026!";
    const fullName = process.env.SUPER_ADMIN_FULLNAME || "Super Administrator";
    const email = process.env.SUPER_ADMIN_EMAIL || `${username}@chat-tho-fi.internal`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const existingAdmin = await prisma.users.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email: { equals: email, mode: "insensitive" } }
        ]
      }
    });

    if (existingAdmin) {
      const updated = await prisma.users.update({
        where: { id: existingAdmin.id },
        data: {
          password: hashedPassword,
          role: "SUPER_ADMIN",
          status: "active",
          isBlocked: false,
          fullName: existingAdmin.fullName || fullName,
          tokenVersion: { increment: 1 }
        }
      });
      console.log(`✅ [SUPER ADMIN] Đã cập nhật Super Admin thành công!`);
      console.log(`   - Username: ${updated.username}`);
      console.log(`   - Role: ${updated.role}`);
      console.log(`   - Status: ${updated.status}`);
      console.log(`   - Mật khẩu: ${rawPassword}`);
    } else {
      const created = await prisma.users.create({
        data: {
          id: uuidv4(),
          username,
          password: hashedPassword,
          fullName,
          email,
          phone: `+84-${username}`,
          role: "SUPER_ADMIN",
          status: "active",
          tokenVersion: 0,
          isBlocked: false
        }
      });
      console.log(`✅ [SUPER ADMIN] Đã tạo mới Super Admin thành công!`);
      console.log(`   - Username: ${created.username}`);
      console.log(`   - Role: ${created.role}`);
      console.log(`   - Status: ${created.status}`);
      console.log(`   - Mật khẩu: ${rawPassword}`);
    }
  } catch (err) {
    console.error("❌ Lỗi khi seed tài khoản Super Admin:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
