const r2Service = require("./r2.service");
const supabaseService = require("../supabase");
const { v4: uuidv4 } = require("uuid");

/**
 * Điều phối lưu trữ thông minh:
 * - Avatar người dùng / Avatar nhóm: Supabase Storage (Bucket avatars)
 * - Tin nhắn thoại (audio) / File nhẹ (< 1.5MB): Supabase Storage (Bucket chat-media)
 * - Video / Ảnh nặng / Tệp đính kèm lớn (>= 1.5MB): Cloudflare R2 (Zero Egress Fees)
 */

const LIGHT_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5MB

/**
 * Xử lý lưu trữ trực tiếp từ Buffer (Tối ưu RAM và tốc độ, không qua base64)
 * @param {Buffer} buffer 
 * @param {string} mimeType 
 * @param {string} type "image" | "video" | "audio" | "file" | "avatar"
 * @param {string} originalName 
 * @param {string} entityId 
 * @returns {Promise<string>}
 */
async function processUploadBuffer(buffer, mimeType = "application/octet-stream", type = "file", originalName = "", entityId = "") {
  if (!buffer || buffer.length === 0) return "";

  const isHeavy = type === "video" || buffer.length >= LIGHT_FILE_THRESHOLD_BYTES;

  // 1. Tệp nặng hoặc Video -> Cloudflare R2 (Băng thông 0đ)
  if (isHeavy && r2Service.isConfigured()) {
    try {
      const category = type === "video" ? "videos" : (type === "image" ? "images" : "files");
      const dateStr = new Date().toISOString().split("T")[0];
      let extension = (mimeType.split("/")[1] || "").split("+")[0];
      let cleanName = (originalName || "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      if (!cleanName) {
        cleanName = `${uuidv4()}.${extension || "bin"}`;
      } else if (!cleanName.includes(".")) {
        cleanName = `${cleanName}.${extension || "bin"}`;
      }
      const key = `${category}/${dateStr}/${uuidv4()}-${cleanName}`;

      const r2Url = await r2Service.uploadBuffer(buffer, key, mimeType);
      console.log(`🚀 [Storage Service] Đã lưu buffer lên Cloudflare R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB): ${r2Url}`);
      return r2Url;
    } catch (err) {
      console.warn("⚠️ [Storage Service] Upload Buffer lên Cloudflare R2 lỗi, chuyển sang Supabase Storage:", err.message);
    }
  }

  // 2. Tệp nhẹ (< 1.5MB), Audio hoặc khi R2 chưa cấu hình -> Supabase Storage
  return await supabaseService.uploadBuffer(buffer, mimeType, type, originalName);
}

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
  let mimeType = "";
  if (base64Str.startsWith("data:")) {
    const commaIndex = base64Str.indexOf(",");
    if (commaIndex !== -1) {
      const match = base64Str.match(/^data:(.*?);base64,/);
      if (match) mimeType = match[1];
      dataPart = base64Str.slice(commaIndex + 1);
    }
  }
  const buffer = Buffer.from(dataPart, "base64");
  return await processUploadBuffer(buffer, mimeType, type, originalName, entityId);
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
  processUploadBuffer,
  getDirectUploadUrl,
};

