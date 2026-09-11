const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "tho-fi-media";
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/$/, "");

let r2Client = null;

function isConfigured() {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

if (isConfigured()) {
  try {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
    console.log("☁️ [Cloudflare R2] Khởi tạo S3 Client thành công!");
  } catch (err) {
    console.warn("⚠️ [Cloudflare R2] Lỗi khởi tạo client:", err.message);
  }
} else {
  console.log("ℹ️ [Cloudflare R2] Chưa cấu hình đầy đủ biến môi trường R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). Sẽ dùng cơ chế dự phòng.");
}

/**
 * Tải một Buffer trực tiếp lên Cloudflare R2
 * @param {Buffer} buffer 
 * @param {string} key Đường dẫn file trong bucket (ví dụ: "images/2026-09-11/abc.jpg")
 * @param {string} contentType MIME type
 * @returns {Promise<string>} Public URL của file
 */
async function uploadBuffer(buffer, key, contentType = "application/octet-stream") {
  if (!r2Client) {
    throw new Error("Cloudflare R2 chưa được cấu hình.");
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Tạo Public URL
  if (R2_PUBLIC_DOMAIN) {
    return `${R2_PUBLIC_DOMAIN}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Tải chuỗi Base64 lên Cloudflare R2 (cho hình ảnh chất lượng cao, video, tệp đính kèm lớn)
 * @param {string} base64Str 
 * @param {string} category "images" | "videos" | "files"
 * @param {string} originalName 
 * @returns {Promise<string>} Public URL của file
 */
async function uploadBase64(base64Str, category = "files", originalName = "") {
  if (!r2Client) {
    throw new Error("Cloudflare R2 chưa được cấu hình.");
  }

  let mimeType = "";
  let base64Data = base64Str;

  if (base64Str.startsWith("data:")) {
    const match = base64Str.match(/^data:(.*?);base64,/);
    if (match) {
      mimeType = match[1];
      base64Data = base64Str.slice(match[0].length);
    }
  }

  if (!mimeType) {
    if (category === "images") mimeType = "image/jpeg";
    else if (category === "videos") mimeType = "video/mp4";
    else mimeType = "application/octet-stream";
  }

  const buffer = Buffer.from(base64Data, "base64");
  let extension = mimeType.split("/")[1] || "";
  if (extension.includes("+")) extension = extension.split("+")[0];

  let cleanName = (originalName || "").replace(/[^a-zA-Z0-9.\-_]/g, "_");
  if (!cleanName) {
    cleanName = `${uuidv4()}.${extension || "bin"}`;
  } else if (!cleanName.includes(".")) {
    cleanName = `${cleanName}.${extension || "bin"}`;
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const key = `${category}/${dateStr}/${uuidv4()}-${cleanName}`;

  return await uploadBuffer(buffer, key, mimeType);
}

/**
 * Tạo Presigned URL để Client có thể tải trực tiếp lên Cloudflare R2 không qua Backend
 * (Zero egress + tối ưu băng thông máy chủ)
 * @param {string} fileName Tên file
 * @param {string} contentType MIME type
 * @param {string} category "images" | "videos" | "files"
 * @param {number} expiresIn Giây hết hạn URL (mặc định 1 giờ)
 */
async function getPresignedUploadUrl(fileName, contentType, category = "files", expiresIn = 3600) {
  if (!r2Client) {
    throw new Error("Cloudflare R2 chưa được cấu hình.");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const cleanName = (fileName || uuidv4()).replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `${category}/${dateStr}/${uuidv4()}-${cleanName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  const publicUrl = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
  };
}

module.exports = {
  isConfigured,
  uploadBuffer,
  uploadBase64,
  getPresignedUploadUrl,
};
