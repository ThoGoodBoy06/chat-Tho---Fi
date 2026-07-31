const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("🟢 Supabase client initialized successfully!");
} else {
  console.warn(
    "⚠️ Warning: SUPABASE_URL or SUPABASE_KEY is missing in env. File upload will be disabled."
  );
}

/**
 * Uploads a base64 string directly to Supabase Storage
 * @param {string} base64Str base64 encoded data (with or without data: URI prefix)
 * @param {string} type "image" | "audio" | "file"
 * @param {string} originalName Name of the file (optional)
 * @returns {Promise<string>} The public URL of the uploaded file
 */
async function uploadBase64(base64Str, type, originalName = "") {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  // 1. Parse MIME type and clean base64 data
  let mimeType = "";
  let base64Data = base64Str;

  if (base64Str.startsWith("data:")) {
    const match = base64Str.match(/^data:(.*?);base64,/);
    if (match) {
      mimeType = match[1];
      base64Data = base64Str.slice(match[0].length);
    }
  }

  // Fallback MIME types if not parsed
  if (!mimeType) {
    if (type === "image") mimeType = "image/jpeg";
    else if (type === "audio") mimeType = "audio/webm";
    else mimeType = "application/octet-stream";
  }

  // 2. Convert base64 string to buffer
  const buffer = Buffer.from(base64Data, "base64");

  // 3. Generate file name and path
  let extension = mimeType.split("/")[1] || "";
  if (extension.includes("+")) {
    extension = extension.split("+")[0];
  }
  
  // Clean originalName or default to uuid
  let cleanName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  if (!cleanName) {
    cleanName = `${uuidv4()}.${extension || "bin"}`;
  } else if (!cleanName.includes(".")) {
    cleanName = `${cleanName}.${extension || "bin"}`;
  }

  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const filePath = `uploads/${dateStr}/${uuidv4()}-${cleanName}`;

  // 4. Upload file to Supabase Storage bucket 'chat-media'
  const { data, error } = await supabase.storage
    .from("chat-media")
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error("❌ Error uploading to Supabase Storage:", error);
    throw error;
  }

  // 5. Get public URL of the uploaded file
  const { data: publicUrlData } = supabase.storage
    .from("chat-media")
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Could not get public URL from Supabase Storage");
  }

  console.log(`%c✅ Upload success! Public URL: ${publicUrlData.publicUrl}`, "color: green");
  return publicUrlData.publicUrl;
}

module.exports = {
  supabase,
  uploadBase64,
};
