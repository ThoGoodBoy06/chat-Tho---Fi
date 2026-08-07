const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("🟢 Supabase client initialized successfully!");
  } catch (e) {
    console.warn("⚠️ Warning: Could not initialize Supabase client:", e.message);
  }
} else {
  console.warn(
    "⚠️ Warning: SUPABASE_URL or SUPABASE_KEY is missing in env. File upload will use local file storage."
  );
}

/**
 * Uploads a base64 string directly to Supabase Storage, with fallback to local file storage
 * @param {string} base64Str base64 encoded data (with or without data: URI prefix)
 * @param {string} type "image" | "audio" | "file"
 * @param {string} originalName Name of the file (optional)
 * @returns {Promise<string>} The public URL of the uploaded file
 */
async function uploadBase64(base64Str, type, originalName = "") {
  // 1. Thử tải lên Supabase Storage nếu có cấu hình
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
      let extension = mimeType.split("/")[1] || "";
      if (extension.includes("+")) {
        extension = extension.split("+")[0];
      }
      
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
          console.log(`✅ Supabase upload success: ${publicUrlData.publicUrl}`);
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn("⚠️ Supabase Storage upload error, falling back to local file storage:", error.message || error);
      }
    } catch (e) {
      console.warn("⚠️ Supabase Storage failed, falling back to local file storage:", e.message);
    }
  }

  // 2. Fallback: Lưu file vào đĩa cục bộ thư mục uploads/ trên server
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
    let extension = mimeType.split("/")[1] || "";
    if (extension.includes("+")) {
      extension = extension.split("+")[0];
    }
    
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
    console.log(`✅ Saved local upload success: ${localUrl}`);
    return localUrl;
  } catch (fsErr) {
    console.error("❌ Local file storage failed:", fsErr);
    return base64Str;
  }
}

module.exports = {
  supabase,
  uploadBase64,
};
