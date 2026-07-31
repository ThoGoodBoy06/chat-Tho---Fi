const admin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const fs = require("fs");
const path = require("path");

try {
  let serviceAccount;
  const keyPathJson = path.join(__dirname, "firebase-key.json");
  const keyPathNoExt = path.join(__dirname, "firebase-key");

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("Lỗi parse FIREBASE_SERVICE_ACCOUNT từ env:", e.message);
    }
  }

  // Kiểm tra cả 2 trường hợp tên file (có đuôi .json và không có đuôi)
  if (!serviceAccount && fs.existsSync(keyPathJson)) {
    serviceAccount = require(keyPathJson);
  } else if (!serviceAccount && fs.existsSync(keyPathNoExt)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPathNoExt, "utf8"));
  }

  if (!serviceAccount) {
    throw new Error("Không tìm thấy file firebase-key hoặc biến FIREBASE_SERVICE_ACCOUNT");
  }

  initializeApp({
    credential: cert(serviceAccount),
  });

  console.log("🔥 Đã kết nối thành công tới Google Firebase Admin!");
} catch (error) {
  console.warn("⚠️ Cảnh báo: " + error.message + ". Thông báo đẩy (Push Notifications) sẽ bị tắt.");
}

module.exports = admin;
