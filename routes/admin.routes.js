const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { adminAuth, requireRole } = require("../middlewares/adminAuth");

// Toàn bộ route /api/admin/* đều phải qua adminAuth
router.use(adminAuth);

// 1. Profile & Thống kê tổng quan
router.get("/me", adminController.getMe);
router.get("/stats", adminController.getStats);

// 2. User Management
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserDetails);
router.post("/users/invite", requireRole("ADMIN", "SUPER_ADMIN"), adminController.createInviteLink);
router.post("/users/:id/reset-password", requireRole("ADMIN", "SUPER_ADMIN"), adminController.generatePasswordResetLink);
router.put("/users/:id/status", requireRole("ADMIN", "SUPER_ADMIN"), adminController.updateUserStatus);
router.put("/users/:id/role", requireRole("SUPER_ADMIN"), adminController.updateUserRole);
router.post("/users/:id/force-logout", requireRole("ADMIN", "SUPER_ADMIN"), adminController.forceLogout);
router.post("/users/:id/pending-deletion", requireRole("ADMIN", "SUPER_ADMIN"), adminController.setPendingDeletion);
router.delete("/users/:id/permanent", requireRole("SUPER_ADMIN"), adminController.permanentDeleteUser);

// 3. Reports & Moderation (MODERATOR có thể xử lý)
router.get("/reports", adminController.getReports);
router.put("/reports/:id", adminController.updateReportStatus);

// 4. Notifications (FCM Push Broadcast)
router.post("/notifications/preview", requireRole("ADMIN", "SUPER_ADMIN"), adminController.previewNotification);
router.post("/notifications/broadcast", requireRole("ADMIN", "SUPER_ADMIN"), adminController.broadcastNotification);

// 5. Calls Center (Giám sát trạng thái cuộc gọi)
router.get("/calls/active", adminController.getActiveCalls);
router.get("/calls/stats", adminController.getCallStats);

// 6. Media & Storage Analytics
router.get("/media/stats", adminController.getMediaStats);
router.get("/media/gallery", adminController.getRecentMediaGallery);

// 7. System Health & Configuration
router.get("/system/health", adminController.getSystemHealth);
router.get("/system/config", adminController.getSystemConfig);
router.put("/system/config", requireRole("ADMIN", "SUPER_ADMIN"), adminController.updateSystemConfig);

// 8. Admin Audit Logs
router.get("/audit-logs", requireRole("ADMIN", "SUPER_ADMIN"), adminController.getAuditLogs);

// 9. Conversations & Message Moderation
router.get("/users/all-simple", adminController.getAllUsersSimple);
router.get("/messages/lookup", adminController.directMessageLookup);
router.get("/conversations", adminController.getConversations);
router.get("/conversations/:id/messages", adminController.getConversationMessages);
router.delete("/messages/:id", adminController.deleteMessage);

module.exports = router;
