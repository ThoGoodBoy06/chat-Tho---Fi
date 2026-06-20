const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Cập nhật profile (Tên, tiểu sử)
router.put("/profile", authMiddleware, userController.updateProfile);

// Cập nhật ảnh bìa - nhận Base64 từ JSON body, lưu thẳng vào Neon DB
router.post(
  "/cover",
  authMiddleware,
  userController.updateCoverImage,
);

module.exports = router;
