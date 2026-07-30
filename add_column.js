require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
});

async function main() {
  console.log('🔄 Đang kết nối tới Supabase qua DIRECT_URL...');
  try {
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "Messages" ADD COLUMN IF NOT EXISTS "isDelivered" BOOLEAN DEFAULT false;
    `);
    console.log('✅ Đã thêm cột "isDelivered" thành công vào bảng Messages! Kết quả:', result);

    const testQuery = await prisma.messages.findFirst({
      select: { id: true, isDelivered: true, isRead: true }
    });
    console.log('🎉 TRUY VẤN THỬ NGHIỆM THÀNH CÔNG:', testQuery);
  } catch (error) {
    console.error('❌ LỖI:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
