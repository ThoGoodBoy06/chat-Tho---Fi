const prisma = require("../prisma");
const r2Service = require("./r2.service");

/**
 * ════════════════════════════════════════════════════════════════════
 * 🧹 DỊCH VỤ DỌN DẸP BỘ NHỚ ĐỊNH KỲ (MEDIA RETENTION & CLEANUP SERVICE)
 * Thiết kế chuẩn theo các ứng dụng lớn (Telegram, Messenger, Zalo):
 * 1. Khi tin nhắn bị Thu Hồi (isRecalled = true): Giữ tệp trong một thời gian ân hạn
 *    (Retention Period, mặc định 7 ngày) để phục vụ kiểm duyệt, audit log và phòng tranh chấp.
 * 2. Sau thời gian ân hạn: Tự động chạy tiến trình ngầm (Garbage Collector)
 *    xóa vĩnh viễn tệp ảnh/video khỏi Cloudflare R2 / Ổ cứng Server và gán null trong DB
 *    để hoàn toàn giải phóng dung lượng lưu trữ.
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Quét và xóa các tệp media của tin nhắn đã thu hồi quá số ngày quy định
 * @param {number} retentionDays - Số ngày lưu trữ trước khi xóa vĩnh viễn (mặc định 7 ngày)
 * @returns {Promise<{ success: boolean, purgedCount: number }>}
 */
async function purgeRecalledMedia(retentionDays = 7) {
  try {
    const thresholdDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    console.log(`🧹 [Media Cleanup] Bắt đầu quét media thu hồi cũ hơn ${retentionDays} ngày (trước ${thresholdDate.toISOString()})...`);

    const recalledMessages = await prisma.messages.findMany({
      where: {
        isRecalled: true,
        createdAt: { lte: thresholdDate },
        OR: [
          { imageUrl: { not: null } },
          { videoUrl: { not: null } },
          { fileUrl: { not: null } },
          { audioUrl: { not: null } }
        ]
      },
      select: {
        id: true,
        imageUrl: true,
        videoUrl: true,
        fileUrl: true,
        audioUrl: true
      }
    });

    if (!recalledMessages || recalledMessages.length === 0) {
      console.log("🧹 [Media Cleanup] Không có tệp media đã thu hồi nào cần giải phóng dung lượng.");
      return { success: true, purgedCount: 0 };
    }

    console.log(`🧹 [Media Cleanup] Phát hiện ${recalledMessages.length} tin nhắn đã thu hồi cần giải phóng tệp...`);
    let purgedCount = 0;

    for (const msg of recalledMessages) {
      const urls = [msg.imageUrl, msg.videoUrl, msg.fileUrl, msg.audioUrl].filter(Boolean);

      for (const u of urls) {
        await r2Service.deleteMedia(u);
      }

      await prisma.messages.update({
        where: { id: msg.id },
        data: {
          imageUrl: null,
          videoUrl: null,
          fileUrl: null,
          audioUrl: null
        }
      });

      purgedCount++;
    }

    console.log(`✅ [Media Cleanup] Đã giải phóng hoàn tất dung lượng cho ${purgedCount} tin nhắn thu hồi!`);
    return { success: true, purgedCount };
  } catch (err) {
    console.error("❌ [Media Cleanup] Lỗi khi dọn dẹp media đã thu hồi:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Khởi chạy Cron ngầm định kỳ
 * @param {number} intervalHours - Chu kỳ quét (mặc định 24 giờ)
 * @param {number} retentionDays - Thời gian giữ ảnh/video (mặc định 7 ngày)
 */
function startPeriodicCleanup(intervalHours = 24, retentionDays = 7) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Lần quét đầu tiên sau 2 phút từ khi khởi động server
  setTimeout(() => {
    purgeRecalledMedia(retentionDays).catch(err => {
      console.warn("⚠️ [Media Cleanup] Lỗi lần quét đầu:", err.message);
    });
  }, 2 * 60 * 1000);

  // Lặp lại định kỳ mỗi ngày
  setInterval(() => {
    purgeRecalledMedia(retentionDays).catch(err => {
      console.warn("⚠️ [Media Cleanup] Lỗi quét định kỳ:", err.message);
    });
  }, intervalMs);

  console.log(`🛡️ [Media Cleanup] Đã kích hoạt tiến trình tự động giải phóng dung lượng (Chu kỳ: ${intervalHours}h, Thời gian giữ: ${retentionDays} ngày).`);
}

module.exports = {
  purgeRecalledMedia,
  startPeriodicCleanup
};
