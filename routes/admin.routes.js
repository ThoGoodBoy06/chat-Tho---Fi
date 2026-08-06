const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");

// Overview Stats
router.get("/stats", adminController.getStats);

// User Management
router.get("/users", adminController.getUsers);
router.put("/users/:id/status", adminController.updateUserStatus);

// Chat & Audit Log Management
router.get("/conversations", adminController.getConversations);
router.get("/conversations/:id/messages", adminController.getConversationMessages);
router.delete("/messages/:id", adminController.deleteMessage);

// Reports Management
router.get("/reports", adminController.getReports);
router.put("/reports/:id", adminController.updateReportStatus);

module.exports = router;
