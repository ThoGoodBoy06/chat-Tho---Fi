const r2Service = require("./r2.service");
const supabaseService = require("../supabase");

/**
 * Điều phối lưu trữ thông minh:
 * - Avatar người dùng / Avatar nhóm: Supabase Storage (Bucket avatars)
 * - Tin nhắn thoại (audio) / File nhẹ (< 1MB): Supabase Storage (Bucket chat-media)
 * - Ảnh chụp / Album / Video / Tệp đính kèm nặng (>= 1MB): Cloudflare R2 (Zero Egress Fees)
 */

const LIGHT_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5MB

/**
 * Xử lý lưu trữ dữ liệu Base64 một cách tự động
 * @param {string} base64Str Chuỗi Base64
 * @param {string} type "image" | "video" | "audio" | "file" | "avatar"
 * @param {string} originalName Tên file gốc (nếu có)
 * @param {string} entityId ID liên quan (userId hoặc conversationId)
 * @returns {Promise<string>} Đường dẫn URL công khai của file
 */
async function processUpload(base64Str, type = "file", originalName = "", entityId = "") {
  if (!base64Str) return "";

  // 1. Trường hợp là ảnh đại diện (User Avatar / Group Avatar) -> Ưu tiên Supabase Storage
  if (type === "avatar") {
    return await supabaseService.uploadAvatar(base64Str, entityId);
  }

  // Tính toán kích thước sơ bộ của file từ chuỗi base64
  let dataPart = base64Str;
  if (base64Str.startsWith("data:")) {
    const commaIndex = base64Str.indexOf(",");
    if (commaIndex !== -1) dataPart = base64Str.slice(commaIndex + 1);
  }
  const estimatedSizeBytes = Math.round((dataPart.length * 3) / 4);

  // 2. Trường hợp là Video hoặc Tệp đính kèm lớn (>= 1.5MB) -> Ưu tiên Cloudflare R2 (Băng thông 0đ)
  const isHeavy = type === "video" || estimatedSizeBytes >= LIGHT_FILE_THRESHOLD_BYTES;

  if (isHeavy && r2Service.isConfigured()) {
    try {
      const category = type === "video" ? "videos" : (type === "image" ? "images" : "files");
      const r2Url = await r2Service.uploadBase64(base64Str, category, originalName);
      console.log(`🚀 [Storage Service] Đã lưu tệp nặng lên Cloudflare R2: ${r2Url}`);
      return r2Url;
    } catch (err) {
      console.warn("⚠️ [Storage Service] Upload Cloudflare R2 lỗi, chuyển sang Supabase Storage:", err.message);
    }
  }

  // 3. Trường hợp file nhẹ (< 1.5MB), Audio hoặc khi R2 chưa cấu hình -> Supabase Storage (kèm Local Fallback)
  return await supabaseService.uploadBase64(base64Str, type, originalName);
}

/**
 * Lấy Presigned URL để Client có thể tải trực tiếp lên Cloudflare R2
 * @param {string} fileName Tên file
 * @param {string} contentType MIME type
 * @param {string} category "images" | "videos" | "files"
 */
async function getDirectUploadUrl(fileName, contentType, category = "files") {
  if (r2Service.isConfigured()) {
    return await r2Service.getPresignedUploadUrl(fileName, contentType, category);
  }
  return null;
}

module.exports = {
  processUpload,
  getDirectUploadUrl,
};
