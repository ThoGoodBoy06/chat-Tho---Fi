const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Route xử lý trò chuyện với AI
router.get("/chat/history", authMiddleware, aiController.getHistory);
router.post("/chat", authMiddleware, aiController.chat);
router.post("/chat/stream", authMiddleware, aiController.chatStream);
router.delete("/chat/history", authMiddleware, aiController.resetHistory);

module.exports = router;
