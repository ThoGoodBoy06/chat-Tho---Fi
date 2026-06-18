const admin = require("firebase-admin");
const { initializeApp, cert } = require("firebase-admin/app");
const fs = require("fs");
const path = require("path");

try {
  let serviceAccount;
  const keyPathJson = path.join(__dirname, "firebase-key.json");
  const keyPathNoExt = path.join(__dirname, "firebase-key");

  // Kiểm tra cả 2 trường hợp tên file (có đuôi .json và không có đuôi)
  if (fs.existsSync(keyPathJson)) {
    serviceAccount = require(keyPathJson);
  } else if (fs.existsSync(keyPathNoExt)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPathNoExt, "utf8"));
  } else {
    throw new Error("Không tìm thấy file firebase-key hoặc firebase-key.json");
  }

  initializeApp({
    credential: cert(serviceAccount),
  });

  console.log("🔥 Đã kết nối thành công tới Google Firebase Admin!");
} catch (error) {
  console.error(
    "❌ Lỗi khởi tạo Firebase. Vui lòng kiểm tra lại file firebase-key.json",
  );
  console.error(error.message);
}

module.exports = admin;
