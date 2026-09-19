const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu sửa lỗi "Ảnh lỗi" và tối ưu hóa hệ thống lưu trữ ảnh...');

// 1. Cập nhật controllers/chat.controller.js & backend/controllers/chat.controller.js
['controllers/chat.controller.js', 'backend/controllers/chat.controller.js'].forEach(p => {
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');
  
  // Thêm jfif vào danh sách ảnh
  const oldExts = 'const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif"];';
  const newExts = 'const imageExts = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "bmp", "svg", "heic", "heif"];';
  if (content.includes(oldExts)) {
    content = content.replace(oldExts, newExts);
  }

  const oldMimeCheck = 'mimeType = (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : `image/${ext}`;';
  const newMimeCheck = 'mimeType = (ext === "jpg" || ext === "jpeg" || ext === "jfif") ? "image/jpeg" : `image/${ext}`;';
  if (content.includes(oldMimeCheck)) {
    content = content.replace(oldMimeCheck, newMimeCheck);
  }

  fs.writeFileSync(p, content, 'utf8');
  console.log(`✅ [${p}] Đã thêm hỗ trợ định dạng .jfif`);
});

// 2. Cập nhật services/storage.service.js & backend/services/storage.service.js
// Luồng đa tầng: Nếu Supabase Storage lỗi/hết quota/mất kết nối -> Lập tức lưu lên Cloudflare R2
const newStorageServiceCode = `const r2Service = require("./r2.service");
const supabaseService = require("../supabase");
const { v4: uuidv4 } = require("uuid");

/**
 * Điều phối lưu trữ thông minh đa tầng chống mất ảnh/video:
 * - Avatar người dùng: Supabase Storage (Bucket avatars)
 * - Tệp nặng hoặc Video (>= 1.5MB): Cloudflare R2 (0đ egress) -> Fallback Supabase
 * - Tệp nhẹ & Hình ảnh (< 1.5MB): Supabase Storage -> Fallback Cloudflare R2 (Bảo vệ tuyệt đối)
 * - Cục bộ: Chỉ dùng khi cả 2 Cloud Storage đều không thể kết nối
 */

const LIGHT_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5MB

/**
 * Xử lý lưu trữ trực tiếp từ Buffer
 */
async function processUploadBuffer(buffer, mimeType = "application/octet-stream", type = "file", originalName = "", entityId = "") {
  if (!buffer || buffer.length === 0) return "";

  const isHeavy = type === "video" || buffer.length >= LIGHT_FILE_THRESHOLD_BYTES;

  // 1. Tệp nặng hoặc Video -> Ưu tiên Cloudflare R2 (Băng thông 0đ)
  if (isHeavy && r2Service.isConfigured()) {
    try {
      const category = type === "video" ? "videos" : (type === "image" ? "images" : "files");
      const dateStr = new Date().toISOString().split("T")[0];
      let extension = (mimeType.split("/")[1] || "").split("+")[0];
      let cleanName = (originalName || "").replace(/[^a-zA-Z0-9.\\-_]/g, "_");
      if (!cleanName) {
        cleanName = \`\${uuidv4()}.\${extension || "bin"}\`;
      } else if (!cleanName.includes(".")) {
        cleanName = \`\${cleanName}.\${extension || "bin"}\`;
      }
      const key = \`\${category}/\${dateStr}/\${uuidv4()}-\${cleanName}\`;

      const r2Url = await r2Service.uploadBuffer(buffer, key, mimeType);
      console.log(\`🚀 [Storage Service] Đã lưu buffer lên Cloudflare R2 (\${(buffer.length / 1024 / 1024).toFixed(2)} MB): \${r2Url}\`);
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
      let cleanName = (originalName || "").replace(/[^a-zA-Z0-9.\\-_]/g, "_");
      if (!cleanName) cleanName = \`\${uuidv4()}.\${extension || "bin"}\`;
      else if (!cleanName.includes(".")) cleanName = \`\${cleanName}.\${extension || "bin"}\`;
      const key = \`\${category}/\${dateStr}/\${uuidv4()}-\${cleanName}\`;
      const r2Url = await r2Service.uploadBuffer(buffer, key, mimeType);
      console.log(\`🚀 [Storage Service Fallback] Đã lưu buffer lên Cloudflare R2: \${r2Url}\`);
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
`;

['services/storage.service.js', 'backend/services/storage.service.js'].forEach(p => {
  fs.writeFileSync(p, newStorageServiceCode, 'utf8');
  console.log(`✅ [${p}] Đã cập nhật cơ chế đa tầng R2 + Supabase bảo vệ ảnh`);
});

// 3. Cập nhật main.dart.js (Tất cả 4 bản sao) để trỏ đúng URL máy chủ khi hiển thị ảnh/video cục bộ
const jsFiles = [
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

const oldBePatterns = [
  '(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:5000":"https://tho-goodboy-chat-app.onrender.com"',
  '(window.location.origin.indexOf("localhost")!==-1)?"http://localhost:3000":"https://tho-goodboy-chat-app.onrender.com"',
];

const correctedBe = '(window.location.origin.indexOf("localhost")!==-1||window.location.origin.indexOf("127.0.0.1")!==-1)?window.location.origin:"https://chat-tho-fi-vn-9s8u.onrender.com"';

jsFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');
  let count = 0;
  for (const pattern of oldBePatterns) {
    while (js.includes(pattern)) {
      js = js.replace(pattern, correctedBe);
      count++;
    }
  }
  if (count > 0) {
    fs.writeFileSync(p, js, 'utf8');
    console.log(`✅ [${p}] Đã sửa ${count} vị trí domain backend bị sai (5000 / tho-goodboy) thành (port hiện tại / chat-tho-fi-vn-9s8u)`);
  } else {
    console.log(`ℹ️ [${p}] Không tìm thấy mẫu cũ hoặc đã được cập nhật`);
  }
});

// 4. Cập nhật webrtc_audio_helper.js (Tất cả các bản sao)
const helperFiles = [
  'public/webrtc_audio_helper.js',
  'flutter_frontend/web/webrtc_audio_helper.js',
  'flutter_frontend/build/web/webrtc_audio_helper.js',
  'backend/public/webrtc_audio_helper.js',
  'backend/flutter_frontend/web/webrtc_audio_helper.js',
  'backend/flutter_frontend/build/web/webrtc_audio_helper.js'
];

helperFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  let h = fs.readFileSync(p, 'utf8');
  
  // Sửa localhost:5000 -> window.location.origin
  h = h.replace(/fullUrl\s*=\s*'http:\/\/localhost:5000'\s*\+\s*\(fullUrl\.startsWith\('\/'\)\s*\?\s*''\s*:\s*'\/'\)\s*\+\s*fullUrl;/g,
    "fullUrl = window.location.origin + (fullUrl.startsWith('/') ? '' : '/') + fullUrl;");

  // Sửa tho-goodboy-chat-app.onrender.com -> chat-tho-fi-vn-9s8u.onrender.com
  h = h.replace(/https:\/\/tho-goodboy-chat-app\.onrender\.com/g, 'https://chat-tho-fi-vn-9s8u.onrender.com');

  fs.writeFileSync(p, h, 'utf8');
  console.log(`✅ [${p}] Đã sửa domain backend chuẩn xác trong webrtc_audio_helper.js`);
});

// 5. Cập nhật server.js & backend/server.js để bật CORS đầy đủ cho thư mục /uploads
['server.js', 'backend/server.js'].forEach(p => {
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  const target = 'app.use("/uploads", express.static(uploadsPath));';
  const replacement = 'app.use("/uploads", express.static(uploadsPath, { setHeaders: (res) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Cache-Control", "public, max-age=86400"); } }));';
  if (s.includes(target)) {
    s = s.replace(target, replacement);
    fs.writeFileSync(p, s, 'utf8');
    console.log(`✅ [${p}] Đã thêm header CORS và Cache cho /uploads`);
  }
});

console.log('🎉 Hoàn thành toàn bộ sửa lỗi "Ảnh lỗi"!');
