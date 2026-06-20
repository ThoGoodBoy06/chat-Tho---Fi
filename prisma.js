const { PrismaClient } = require("@prisma/client");

// Tự động cấu hình connection_limit=3 cho Neon DB gói Free
let databaseUrl = process.env.DATABASE_URL || "";
if (databaseUrl && !databaseUrl.includes("connection_limit")) {
  const separator = databaseUrl.includes("?") ? "&" : "?";
  databaseUrl = `${databaseUrl}${separator}connection_limit=3`;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

module.exports = prisma;
