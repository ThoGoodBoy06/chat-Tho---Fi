const r2Service = require("./r2.service");
const supabaseService = require("../supabase");
const { v4: uuidv4 } = require("uuid");

/**
 * Điều phối lưu trữ thông minh đa tầng chống mất ảnh/video:
 * - Avatar người dùng: Supabase Storage (Bucket avatars)
 * - Tệp nặng hoặc Video (>= 1.5MB): Cloudflare R2 (0đ egress) -> Fallback Supabase
 * - Tệp nhẹ & Hình ảnh (< 1.5MB): Supabase Storage -> Fallback Cloudflare R2 (Bảo vệ tuyệt đối)
 * - Cục bộ: Chỉ dùng khi cả 2 Cloud Storage đều không thể kết nối
 */

const LIGHT_FILE_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15MB (Ảnh thường ưu tiên Supabase có sẵn CORS)

/**
 * Xử lý lưu trữ trực tiếp từ Buffer
 */
async function processUploadBuffer(buffer, mimeType = "application/octet-stream", type = "file", originalName = "", entityId = "") {
  if (!buffer || buffer.length === 0) return "";

  const isHeavy = type === "video" || (type !== "image" && buffer.length >= LIGHT_FILE_THRESHOLD_BYTES);

  // 1. Tệp nặng hoặc Video -> Ưu tiên Cloudflare R2 (Băng thông 0đ)
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

  // 2. Thử tải lên Supabase Storage
  try {
    const supabaseUrl = await supabaseService.uploadBuffer(buffer, mimeType, type, originalName);
    if (supabaseUrl && supabaseUrl.startsWith("http")) {
      return supabaseUrl;
    }
    console.warn("⚠️ [Storage Service] Supabase trả về URL cục bộ:", supabaseUrl);
  } catch (supErr) {
    console.warn("⚠️ [Storage Service] Supabase upload failed:", supErr.message);
  }

  // 3. Nếu Supabase không thành công (hoặc trả về local URL) và R2 đã cấu hình -> Thử lưu lên Cloudflare R2!
  if (r2Service.isConfigured()) {
    try {
      const category = type === "video" ? "videos" : (type === "image" ? "images" : "files");
      const dateStr = new Date().toISOString().split("T")[0];
      let extension = (mimeType.split("/")[1] || "").split("+")[0];
      let cleanName = (originalName || "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
      if (!cleanName) cleanName = `${uuidv4()}.${extension || "bin"}`;
      else if (!cleanName.includes(".")) cleanName = `${cleanName}.${extension || "bin"}`;
      const key = `${category}/${dateStr}/${uuidv4()}-${cleanName}`;
      const r2Url = await r2Service.uploadBuffer(buffer, key, mimeType);
      console.log(`🚀 [Storage Service Fallback] Đã lưu buffer lên Cloudflare R2: ${r2Url}`);
      return r2Url;
    } catch (r2Err) {
      console.warn("⚠️ [Storage Service Fallback] Upload Cloudflare R2 cũng thất bại:", r2Err.message);
    }
  }

  // 4. Bước đường cùng: Lưu cục bộ
  return await supabaseService.uploadBuffer(buffer, mimeType, type, originalName);
}

/**
 * Xử lý lưu trữ dữ liệu Base64
 */
async function processUpload(base64Str, type = "file", originalName = "", entityId = "") {
  if (!base64Str) return "";

  if (type === "avatar") {
    return await supabaseService.uploadAvatar(base64Str, entityId);
  }

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
