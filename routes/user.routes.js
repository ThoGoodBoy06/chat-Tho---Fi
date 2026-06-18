const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const userController = require("../controllers/user.controller");

// Đảm bảo thư mục lưu ảnh bìa tồn tại
const coverDir = path.join(__dirname, "..", "public", "covers");
if (!fs.existsSync(coverDir)) {
  fs.mkdirSync(coverDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, coverDir),
  filename: (req, file, cb) =>
    cb(null, `cover_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// Tạm thời import middleware kiểm tra token. (Bạn hãy trỏ đúng đường dẫn middleware hiện có của bạn)
// Giả sử bạn đang dùng file auth.middleware.js, nếu không có bạn có thể tách JWT verify logic thành middleware
const authMiddleware = require("../middlewares/auth.middleware");

// Cập nhật profile (Tên, tiểu sử)
router.put("/profile", authMiddleware, userController.updateProfile);

// Cập nhật ảnh bìa
router.post(
  "/cover",
  authMiddleware,
  upload.single("coverImage"),
  userController.updateCoverImage,
);

module.exports = router;
