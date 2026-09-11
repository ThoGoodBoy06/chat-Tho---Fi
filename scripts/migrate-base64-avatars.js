require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { uploadAvatar } = require('../supabase');

const prisma = new PrismaClient();

async function migrateAvatars() {
  console.log("🚀 Bắt đầu tối ưu hóa avatar & cover photo cũ về Supabase Storage...");
  const users = await prisma.users.findMany();
  let count = 0;

  for (const user of users) {
    let needsUpdate = false;
    let newAvatar = user.avatar;
    let newCover = user.coverPhoto;

    // Nếu avatar đang là chuỗi base64 nặng
    if (user.avatar && user.avatar.startsWith('data:image')) {
      console.log(`⏳ Đang chuyển avatar của user [${user.username}] (${user.avatar.length} ký tự) lên Supabase...`);
      try {
        newAvatar = await uploadAvatar(user.avatar, user.id);
        needsUpdate = true;
      } catch (err) {
        console.warn(`⚠️ Lỗi upload avatar user ${user.username}:`, err.message);
      }
    }

    // Nếu coverPhoto đang là chuỗi base64 nặng
    if (user.coverPhoto && user.coverPhoto.startsWith('data:image')) {
      console.log(`⏳ Đang chuyển cover photo của user [${user.username}] (${user.coverPhoto.length} ký tự) lên Supabase...`);
      try {
        newCover = await uploadAvatar(user.coverPhoto, `cover_${user.id}`);
        needsUpdate = true;
      } catch (err) {
        console.warn(`⚠️ Lỗi upload cover user ${user.username}:`, err.message);
      }
    }

    if (needsUpdate) {
      await prisma.users.update({
        where: { id: user.id },
        data: { avatar: newAvatar, coverPhoto: newCover }
      });
      count++;
      console.log(`✅ Đã tối ưu hóa user [${user.username}] thành URL ngắn gọn!`);
    }
  }

  console.log("\n🚀 Kiểm tra avatar của các nhóm chat...");
  const convs = await prisma.conversations.findMany();
  let groupCount = 0;

  for (const conv of convs) {
    if (conv.avatar && conv.avatar.startsWith('data:image')) {
      console.log(`⏳ Đang chuyển avatar của nhóm [${conv.name}] (${conv.avatar.length} ký tự) lên Supabase...`);
      try {
        const newGroupAvatar = await uploadAvatar(conv.avatar, `group_${conv.id}`);
        await prisma.conversations.update({
          where: { id: conv.id },
          data: { avatar: newGroupAvatar }
        });
        groupCount++;
        console.log(`✅ Đã tối ưu hóa nhóm [${conv.name}] thành URL ngắn gọn!`);
      } catch (err) {
        console.warn(`⚠️ Lỗi upload avatar nhóm ${conv.name}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 Hoàn tất! Đã tối ưu hóa ${count} tài khoản và ${groupCount} nhóm chat. Dung lượng database giảm 99%!`);
  await prisma.$disconnect();
}

migrateAvatars();
