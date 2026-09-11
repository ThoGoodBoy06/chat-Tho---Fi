const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const supabaseUrl = (process.env.SUPABASE_URL || "")
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

function isConfigured() {
  return !!(supabaseUrl && supabaseKey);
}

if (isConfigured()) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("🟢 [Supabase] Khởi tạo Supabase client thành công!");
  } catch (e) {
    console.warn("⚠️ [Supabase] Không thể khởi tạo Supabase client:", e.message);
  }
} else {
  console.warn(
    "⚠️ [Supabase] Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong .env. Sẽ dùng lưu trữ cục bộ."
  );
}

/**
 * Tải avatar (người dùng hoặc nhóm) lên Supabase Storage (Bucket: avatars)
 * @param {string} base64Str 
 * @param {string} entityId ID của user hoặc nhóm
 * @returns {Promise<string>} Public URL của avatar
 */
async function uploadAvatar(base64Str, entityId = uuidv4()) {
  if (supabase) {
    try {
      let mimeType = "image/jpeg";
      let base64Data = base64Str;

      if (base64Str.startsWith("data:")) {
        const match = base64Str.match(/^data:(.*?);base64,/);
        if (match) {
          mimeType = match[1];
          base64Data = base64Str.slice(match[0].length);
        }
      }

      const buffer = Buffer.from(base64Data, "base64");
      const ext = (mimeType.split("/")[1] || "jpg").split("+")[0];
      const filePath = `avatars/${entityId}_${Date.now()}.${ext}`;

      // Tải lên bucket avatars
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error) {
        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl) {
          console.log(`✅ [Supabase Storage] Avatar tải lên thành công: ${publicUrlData.publicUrl}`);
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn("⚠️ [Supabase Storage] Lỗi tải avatar:", error.message);
      }
    } catch (err) {
      console.warn("⚠️ [Supabase Storage] Thất bại khi đẩy avatar:", err.message);
    }
  }

  // Fallback: Lưu vào đĩa cục bộ public/avatars
  try {
    let mimeType = "image/jpeg";
    let base64Data = base64Str;
    if (base64Str.startsWith("data:")) {
      const match = base64Str.match(/^data:(.*?);base64,/);
      if (match) {
        mimeType = match[1];
        base64Data = base64Str.slice(match[0].length);
      }
    }
    const buffer = Buffer.from(base64Data, "base64");
    const ext = (mimeType.split("/")[1] || "jpg").split("+")[0];
    const avatarDir = path.join(__dirname, "public", "avatars");
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

    const fileName = `avatar_${entityId}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(avatarDir, fileName), buffer);
    return `/avatars/${fileName}`;
  } catch (e) {
    return base64Str;
  }
}

/**
 * Tải file nhẹ hoặc âm thanh thoại ngắn lên Supabase Storage (Bucket: chat-media)
 * @param {string} base64Str 
 * @param {string} type "image" | "audio" | "file"
 * @param {string} originalName 
 * @returns {Promise<string>} Public URL của file
 */
async function uploadBase64(base64Str, type = "file", originalName = "") {
  if (supabase) {
    try {
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
        if (type === "image") mimeType = "image/jpeg";
        else if (type === "audio") mimeType = "audio/webm";
        else mimeType = "application/octet-stream";
      }

      const buffer = Buffer.from(base64Data, "base64");
      let extension = (mimeType.split("/")[1] || "").split("+")[0];

      let cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      if (!cleanName) {
        cleanName = `${uuidv4()}.${extension || "bin"}`;
      } else if (!cleanName.includes(".")) {
        cleanName = `${cleanName}.${extension || "bin"}`;
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const filePath = `uploads/${dateStr}/${uuidv4()}-${cleanName}`;

      const { data, error } = await supabase.storage
        .from("chat-media")
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error) {
        const { data: publicUrlData } = supabase.storage
          .from("chat-media")
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl) {
          console.log(`✅ [Supabase Storage] File nhẹ tải lên thành công: ${publicUrlData.publicUrl}`);
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn("⚠️ [Supabase Storage] Lỗi tải file nhẹ:", error.message || error);
      }
    } catch (e) {
      console.warn("⚠️ [Supabase Storage] Lỗi ngoại lệ:", e.message);
    }
  }

  // Fallback cục bộ
  try {
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
      if (type === "image") mimeType = "image/jpeg";
      else if (type === "audio") mimeType = "audio/webm";
      else mimeType = "application/octet-stream";
    }

    const buffer = Buffer.from(base64Data, "base64");
    let extension = (mimeType.split("/")[1] || "").split("+")[0];

    let cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    if (!cleanName) {
      cleanName = `${uuidv4()}.${extension || "bin"}`;
    } else if (!cleanName.includes(".")) {
      cleanName = `${cleanName}.${extension || "bin"}`;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const uploadsDir = path.join(__dirname, "uploads", dateStr);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${uuidv4()}-${cleanName}`;
    const fullPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(fullPath, buffer);

    const localUrl = `/uploads/${dateStr}/${fileName}`;
    console.log(`✅ [Local Fallback] Đã lưu file cục bộ: ${localUrl}`);
    return localUrl;
  } catch (fsErr) {
    console.error("❌ Lưu file cục bộ thất bại:", fsErr);
    return base64Str;
  }
}

module.exports = {
  supabase,
  isConfigured,
  uploadAvatar,
  uploadBase64,
};
