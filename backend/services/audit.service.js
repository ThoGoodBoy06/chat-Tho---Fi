const prisma = require("../prisma");

/**
 * Ghi nhận nhật ký quản trị AdminAuditLog
 * @param {Object} params
 * @param {import("express").Request} [params.req]
 * @param {Object} [params.admin] - { id, username }
 * @param {string} params.action - e.g. "USER_SUSPEND", "USER_ROLE_CHANGE", "USER_DELETE", "BROADCAST_FCM", "CONFIG_UPDATE", "REPORT_RESOLVE"
 * @param {string} params.targetType - e.g. "USER", "REPORT", "NOTIFICATION", "SYSTEM", "MEDIA"
 * @param {string} [params.targetId]
 * @param {Object} [params.details]
 */
async function logAdminAction({ req, admin, action, targetType, targetId = null, details = null }) {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        null;
      userAgent = req.headers["user-agent"] || null;
    }

    const adminId = admin?.id || req?.user?.id || "system";
    const adminUsername = admin?.username || req?.user?.username || "system";

    const logEntry = await prisma.adminAuditLog.create({
      data: {
        adminId,
        adminUsername,
        action,
        targetType,
        targetId: targetId ? String(targetId) : null,
        details: details || {},
        ipAddress,
        userAgent,
      },
    });

    console.log(`🛡️ [AUDIT] [${adminUsername}] thực hiện [${action}] trên [${targetType}:${targetId || "N/A"}]`);
    return logEntry;
  } catch (err) {
    console.error("⚠️ [AUDIT ERROR] Không thể ghi nhật ký audit:", err.message);
    return null;
  }
}

module.exports = {
  logAdminAction,
};
