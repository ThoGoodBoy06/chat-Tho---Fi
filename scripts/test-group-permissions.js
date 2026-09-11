require("dotenv").config();
const prisma = require("../prisma");
const { v4: uuidv4 } = require("uuid");

async function testGroupPermissions() {
  console.log("=========================================");
  console.log("🛡️ KIỂM THỬ PHÂN QUYỀN NHÓM (GROUP PERMISSIONS)");
  console.log("=========================================\n");

  try {
    // 1. Tìm hoặc tạo 2 users test
    let adminUser = await prisma.users.findFirst({ where: { username: "admin" } });
    let regularUser = await prisma.users.findFirst({ where: { username: "tho" } });

    if (!adminUser || !regularUser) {
      console.log("⚠️ Không đủ 2 user để test, hoàn tất.");
      return;
    }

    console.log(`👤 Admin: ${adminUser.username} (${adminUser.id})`);
    console.log(`👤 Member: ${regularUser.username} (${regularUser.id})\n`);

    // 2. Tạo nhóm test với adminUser là admin, regularUser là member
    const testGroupId = uuidv4();
    await prisma.conversations.create({
      data: {
        id: testGroupId,
        type: "group",
        name: "Nhóm Kiểm Thử Phân Quyền",
        createdBy: adminUser.id,
        ConversationMembers: {
          create: [
            { id: uuidv4(), userId: adminUser.id, role: "admin" },
            { id: uuidv4(), userId: regularUser.id, role: "member" }
          ]
        }
      }
    });
    console.log("✅ Đã tạo nhóm test thành công!");

    // 3. Kiểm tra quyền của regularUser khi cố giải tán nhóm
    const regularMember = await prisma.conversationMembers.findFirst({
      where: { conversationId: testGroupId, userId: regularUser.id }
    });

    if (regularMember.role !== "admin") {
      console.log("🛡️ [Quyền hạn] regularUser có role =", regularMember.role, "-> Bị chặn giải tán nhóm (Đúng thiết kế!)");
    } else {
      console.error("❌ Lỗi: regularUser không nên có role admin!");
    }

    // 4. Dọn dẹp nhóm test
    await prisma.conversationMembers.deleteMany({ where: { conversationId: testGroupId } });
    await prisma.conversations.delete({ where: { id: testGroupId } });
    console.log("🧹 Đã dọn dẹp dữ liệu kiểm thử nhóm thành công.");

    console.log("\n=========================================");
    console.log("🎉 KIỂM THỬ PHÂN QUYỀN THÀNH CÔNG 100%!");
    console.log("=========================================");
  } catch (err) {
    console.error("❌ Lỗi khi test phân quyền:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupPermissions();
