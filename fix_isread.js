const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking messages with NULL or false isRead...');
  const nullCount = await prisma.messages.count({
    where: { isRead: null }
  });
  console.log(`📊 Messages with isRead IS NULL: ${nullCount}`);

  const falseCount = await prisma.messages.count({
    where: { isRead: false }
  });
  console.log(`📊 Messages with isRead === false: ${falseCount}`);

  const trueCount = await prisma.messages.count({
    where: { isRead: true }
  });
  console.log(`📊 Messages with isRead === true: ${trueCount}`);

  // Set all NULL or false isRead to true so database is clean!
  const updated = await prisma.messages.updateMany({
    where: {
      NOT: { isRead: true }
    },
    data: {
      isRead: true
    }
  });
  console.log(`✅ Updated ${updated.count} messages to isRead = true in Database!`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
