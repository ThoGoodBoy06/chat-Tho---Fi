const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const groupController = require("../controllers/group.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Bật lớp bảo vệ: Chỉ user đã đăng nhập (có Token) mới được dùng các API này
router.use(authMiddleware);

router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createConversation);
router.post("/block", chatController.blockUser);
router.patch("/conversations/:conversationId/theme", chatController.changeConversationTheme);
router.patch("/conversations/:conversationId/nickname", chatController.setNickname);
router.delete("/conversations/:conversationId", chatController.deleteConversation);
router.get("/:conversationId/messages", chatController.getMessages);
router.post("/:conversationId/messages", chatController.sendMessage);
router.post("/:conversationId/upload-media", upload.single("file"), chatController.uploadMedia);

// API cho các tính năng Big Update
router.put("/messages/:messageId/recall", chatController.recallMessage);
router.patch("/messages/:messageId/recall", chatController.recallMessage);
router.post("/messages/:messageId/react", chatController.reactToMessage);
router.patch("/messages/:messageId/edit", chatController.editMessage);
router.delete("/messages/:messageId/me", chatController.deleteMessageForMe);
router.post("/messages/:messageId/delete", chatController.deleteMessageForMe);

// API cho tính năng Ghim, Tìm kiếm, Chuyển tiếp, Link Preview
router.post("/messages/:messageId/pin", chatController.pinMessage);
router.get("/:conversationId/pins", chatController.getPinnedMessages);
router.get("/:conversationId/search", chatController.searchMessages);
router.post("/messages/forward", chatController.forwardMessage);
router.get("/link-preview", chatController.getLinkPreview);

// API cho tính năng nhóm (Group Chat)
router.post("/group/create", groupController.createGroup);
router.post("/group/add", groupController.addMembers);
router.post("/group/kick", groupController.kickMember);
router.post("/group/dissolve", groupController.dissolveGroup);
router.post("/group/role", groupController.changeMemberRole);
router.get("/group/:conversationId/members", groupController.getGroupMembers);
router.post("/group/rename", groupController.renameGroup);
router.post("/group/avatar", groupController.changeGroupAvatar);

module.exports = router;