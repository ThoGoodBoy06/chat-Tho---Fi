const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Route xử lý trò chuyện với AI
router.post("/chat", authMiddleware, aiController.chat);

module.exports = router;
