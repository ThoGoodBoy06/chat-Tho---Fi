const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Bật lớp bảo vệ: Chỉ user đã đăng nhập (có Token) mới được dùng các API này
router.use(authMiddleware);

router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createConversation);
router.get("/:conversationId/messages", chatController.getMessages);
router.post("/:conversationId/messages", chatController.sendMessage);

// API cho các tính năng Big Update
router.patch("/messages/:messageId/recall", chatController.recallMessage);
router.post("/messages/:messageId/react", chatController.reactToMessage);
router.patch("/messages/:messageId/edit", chatController.editMessage);

module.exports = router;
