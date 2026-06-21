const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Lấy ảnh đại diện và ảnh bìa công khai
router.get("/:id/avatar", userController.getUserAvatar);
router.get("/:id/cover", userController.getUserCover);

// Cập nhật profile (Tên, tiểu sử)
router.put("/profile", authMiddleware, userController.updateProfile);

// Cập nhật ảnh bìa - nhận Base64 từ JSON body, lưu thẳng vào Neon DB
router.post(
  "/cover",
  authMiddleware,
  userController.updateCoverImage,
);

// Lấy thông tin hồ sơ người dùng
router.get("/:id", authMiddleware, userController.getUserProfile);

module.exports = router;
