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

// API Lời mời kết bạn & Bạn bè & Tìm kiếm
router.get("/search", authMiddleware, userController.searchUsers);
router.get("/friend-requests", authMiddleware, userController.getPendingFriendRequests);
router.post("/friend-requests", authMiddleware, userController.sendFriendRequest);
router.post("/friend-requests/cancel", authMiddleware, userController.cancelFriendRequest);
router.post("/friend-requests/:receiverId/cancel", authMiddleware, userController.cancelFriendRequest);
router.post("/friend-requests/:id/accept", authMiddleware, userController.acceptFriendRequest);
router.post("/friend-requests/:id/reject", authMiddleware, userController.rejectFriendRequest);
router.delete("/friends/:friendId", authMiddleware, userController.deleteFriend);

// Lấy thông tin chi tiết hồ sơ người dùng khác
router.get("/:id/profile", authMiddleware, userController.getOtherUserProfile);

// Lấy thông tin hồ sơ người dùng
router.get("/:id", authMiddleware, userController.getUserProfile);

module.exports = router;
