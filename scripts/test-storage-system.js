require("dotenv").config();
const storageService = require("../services/storage.service");
const r2Service = require("../services/r2.service");
const supabaseService = require("../supabase");

async function runTests() {
  console.log("=========================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ HỆ THỐNG STORAGE MỚI");
  console.log("=========================================\n");

  // 1. Kiểm tra trạng thái cấu hình
  console.log("1️⃣ KIỂM TRA CẤU HÌNH:");
  console.log("- Supabase Configured:", supabaseService.isConfigured());
  console.log("- Cloudflare R2 Configured:", r2Service.isConfigured());

  // 2. Test tải Avatar (Supabase Storage)
  console.log("\n2️⃣ TEST TẢI AVATAR (Ưu tiên Supabase Storage):");
  const sampleAvatarBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  try {
    const avatarUrl = await storageService.processUpload(sampleAvatarBase64, "avatar", "test_avatar.png", "test-user-id");
    console.log("✅ Avatar URL tạo ra:", avatarUrl);
  } catch (err) {
    console.error("❌ Lỗi test avatar:", err.message);
  }

  // 3. Test tải File Nhẹ / Âm thanh (Supabase Storage)
  console.log("\n3️⃣ TEST TẢI FILE NHẸ / AUDIO (< 1.5MB):");
  const sampleAudioBase64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA";
  try {
    const audioUrl = await storageService.processUpload(sampleAudioBase64, "audio", "voice_note.mp3", "test-conv-id");
    console.log("✅ Audio URL tạo ra:", audioUrl);
  } catch (err) {
    console.error("❌ Lỗi test audio:", err.message);
  }

  // 4. Test phân luồng Media Nặng (Video / File lớn -> Cloudflare R2 / Fallback)
  console.log("\n4️⃣ TEST PHÂN LUỒNG TỆP NẶNG (Video / File lớn):");
  const sampleVideoBase64 = "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAA==";
  try {
    const videoUrl = await storageService.processUpload(sampleVideoBase64, "video", "clip.mp4", "test-conv-id");
    console.log("✅ Video URL tạo ra:", videoUrl);
  } catch (err) {
    console.error("❌ Lỗi test video:", err.message);
  }

  // 5. Test Presigned URL
  console.log("\n5️⃣ TEST PRESIGNED URL (Cloudflare R2 Direct Upload):");
  try {
    const presigned = await storageService.getDirectUploadUrl("large_video.mp4", "video/mp4", "videos");
    if (presigned) {
      console.log("✅ Presigned URL tạo thành công:", presigned);
    } else {
      console.log("ℹ️ Cloudflare R2 chưa điền khóa bí mật trong .env, tính năng presigned đang tạm chờ khóa R2.");
    }
  } catch (err) {
    console.warn("⚠️ Presigned URL:", err.message);
  }

  console.log("\n=========================================");
  console.log("🎉 KIỂM THỬ HOÀN TẤT!");
  console.log("=========================================");
}

runTests();
