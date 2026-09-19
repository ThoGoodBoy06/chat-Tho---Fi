const fs = require('fs');
const path = require('path');

console.log('🚀 Bắt đầu triển khai tính năng Hỗ trợ MỌI định dạng ảnh (Universal Image Support)...');

// 1. Cập nhật controllers/chat.controller.js & backend/controllers/chat.controller.js
['controllers/chat.controller.js', 'backend/controllers/chat.controller.js'].forEach(p => {
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  // Tìm hàm uploadMedia
  const startMarker = 'exports.uploadMedia = async (req, res) => {';
  const endMarker = 'const newMessage = await prisma.messages.create({';

  const sIdx = content.indexOf(startMarker);
  const eIdx = content.indexOf(endMarker);

  if (sIdx !== -1 && eIdx !== -1) {
    const pre = content.slice(0, sIdx);
    const post = content.slice(eIdx);

    const newUploadMediaHeader = `exports.uploadMedia = async (req, res) => {
    try {
        const senderId = req.user ? req.user.id || req.user.userId : req.userId;
        const { conversationId } = req.params;
        const file = req.file;

        if (!file && !req.body.fileBytes) {
            return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
        }

        let buffer;
        let originalName = "";
        let mimeType = "";

        if (file) {
            buffer = file.buffer;
            originalName = file.originalname || \`upload_\${Date.now()}\`;
            mimeType = file.mimetype || "";
        } else if (req.body.fileBytes) {
            buffer = Buffer.from(req.body.fileBytes, "base64");
            originalName = req.body.fileName || \`upload_\${Date.now()}\`;
            if (req.body.mimeType) mimeType = req.body.mimeType;
        }

        if ((!mimeType || mimeType === "application/octet-stream") && req.body.mimeType) {
            mimeType = req.body.mimeType;
        }

        const ext = (originalName.split(".").pop() || "").toLowerCase();
        let isImage = false;
        let isVideo = false;
        let isAudio = false;

        // 1. Kiểm tra chính xác định dạng qua Magic Bytes (File Signature)
        if (buffer && buffer.length >= 4) {
            // JPEG / JFIF
            if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/jpeg";
            }
            // PNG
            else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/png";
            }
            // GIF
            else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/gif";
            }
            // WEBP
            else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/webp";
            }
            // BMP
            else if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/bmp";
            }
            // TIFF
            else if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A) || (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00)) {
                isImage = true;
                if (!mimeType.startsWith("image/")) mimeType = "image/tiff";
            }
            // HEIC / HEIF / AVIF (iPhone & Camera format)
            else if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
                const brand = buffer.toString("ascii", 8, 12).toLowerCase();
                if (brand.includes("heic") || brand.includes("mif1") || brand.includes("msf1") || brand.includes("hevc") || brand.includes("avif") || brand.includes("heix")) {
                    isImage = true;
                    if (!mimeType.startsWith("image/")) mimeType = brand.includes("avif") ? "image/avif" : "image/heic";
                }
            }
        }

        // 2. Danh sách toàn bộ phần mở rộng của ảnh & video
        const imageExts = [
            "jpg", "jpeg", "jfif", "jpe", "jif", "jfi",
            "png", "webp", "gif", "bmp", "dib",
            "svg", "svgz", "ico",
            "heic", "heif", "avif",
            "tiff", "tif",
            "raw", "cr2", "nef", "arw", "dng", "orf", "rw2", "pef"
        ];
        const videoExts = ["mp4", "mov", "webm", "mkv", "avi", "3gp", "m4v", "wmv", "flv", "ts"];
        const audioExts = ["mp3", "wav", "webm", "ogg", "m4a", "aac", "flac", "wma", "opus"];

        if (imageExts.includes(ext) || mimeType.startsWith("image/")) isImage = true;
        if (videoExts.includes(ext) || mimeType.startsWith("video/")) isVideo = true;
        if (audioExts.includes(ext) || mimeType.startsWith("audio/") || (originalName.startsWith("voice_") && ext === "webm")) isAudio = true;

        let type = "file";
        if (isImage) type = "image";
        else if (isVideo) type = "video";
        else if (isAudio) type = "audio";
        else if (req.body.type) type = req.body.type;

        // 3. Tự động chuẩn hóa ảnh: Dùng sharp chuyển đổi mọi định dạng phức tạp (HEIC, TIFF, BMP, JFIF, RAW) sang Web JPEG sắc nét
        if (type === "image") {
            try {
                let sharpInstance = null;
                try {
                    const sharp = require("sharp");
                    sharpInstance = sharp;
                } catch (_) {}

                if (sharpInstance) {
                    const needsConversion = ["heic", "heif", "tiff", "tif", "bmp", "dib", "raw", "cr2", "nef", "arw", "dng", "jfif", "jpe", "jif"].includes(ext) ||
                        mimeType === "image/heic" || mimeType === "image/heif" || mimeType === "image/tiff" || mimeType === "image/bmp";
                    
                    if (needsConversion) {
                        const convertedBuffer = await sharpInstance(buffer)
                            .rotate() // Tự động xoay ảnh đúng chiều theo EXIF điện thoại
                            .jpeg({ quality: 92, mozjpeg: true })
                            .toBuffer();
                        buffer = convertedBuffer;
                        mimeType = "image/jpeg";
                        originalName = (originalName.replace(/\\.[^.]+$/, "") || "image") + ".jpg";
                        console.log(\`✨ [Universal Image] Đã chuẩn hóa định dạng ảnh (\${ext}) sang Web JPEG: \${(buffer.length / 1024).toFixed(1)} KB\`);
                    } else if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
                        // Giữ nguyên định dạng gốc, chỉ auto-orient EXIF để ảnh không bị quay ngược
                        try {
                            const orientedBuffer = await sharpInstance(buffer).rotate().toBuffer();
                            buffer = orientedBuffer;
                        } catch (_) {}
                    }
                }
            } catch (convErr) {
                console.warn("⚠️ [Universal Image] Bỏ qua chuyển đổi ảnh:", convErr.message);
            }
        }

        console.log(\`📤 [uploadMedia] Nhận tệp: "\${originalName}" | Dung lượng: \${(buffer.length / 1024).toFixed(1)} KB | MIME: \${mimeType} | Loại: \${type}\`);

        const storageService = require("../services/storage.service");
        const publicUrl = await storageService.processUploadBuffer(buffer, mimeType, type, originalName, conversationId);

        `;

    content = pre + newUploadMediaHeader + post;
    fs.writeFileSync(p, content, 'utf8');
    console.log(`✅ [${p}] Đã cập nhật bộ xử lý ảnh toàn năng (Universal Image Processor)`);
  }
});

// 2. Cập nhật Flutter Frontend Source (chat_screen.dart)
const chatScreenPath = 'flutter_frontend/lib/screens/chat_screen.dart';
if (fs.existsSync(chatScreenPath)) {
  let dart = fs.readFileSync(chatScreenPath, 'utf8');

  // Cập nhật FileUploadInputElement.accept để hỗ trợ chọn mọi định dạng ảnh
  const oldAccept = "final uploadInput = html.FileUploadInputElement()..accept = 'image/*';";
  const newAccept = "final uploadInput = html.FileUploadInputElement()..accept = 'image/*,.jpg,.jpeg,.png,.gif,.webp,.jfif,.heic,.heif,.avif,.bmp,.svg,.ico,.tiff,.tif,image/heic,image/heif,image/webp,image/avif';";
  if (dart.includes(oldAccept)) {
    dart = dart.replace(oldAccept, newAccept);
    console.log(`✅ [${chatScreenPath}] Đã mở rộng accept cho FileUploadInputElement`);
  }

  // Cập nhật nhận diện hasImgUrl
  const oldHasImg = "final hasImgUrl = lowerContent.endsWith('.jpg') || lowerContent.endsWith('.jpeg') ||\r\n        lowerContent.endsWith('.png') || lowerContent.endsWith('.webp') ||\r\n        lowerContent.endsWith('.gif') || lowerContent.contains('/chat-media/') ||\r\n        lowerContent.contains('.jpg?') || lowerContent.contains('.png?');";
  const newHasImg = "final hasImgUrl = lowerContent.endsWith('.jpg') || lowerContent.endsWith('.jpeg') ||\r\n        lowerContent.endsWith('.png') || lowerContent.endsWith('.webp') ||\r\n        lowerContent.endsWith('.gif') || lowerContent.endsWith('.jfif') ||\r\n        lowerContent.endsWith('.heic') || lowerContent.endsWith('.heif') ||\r\n        lowerContent.endsWith('.avif') || lowerContent.endsWith('.bmp') ||\r\n        lowerContent.endsWith('.svg') || lowerContent.endsWith('.ico') ||\r\n        lowerContent.contains('/chat-media/') || lowerContent.contains('/images/') ||\r\n        lowerContent.contains('.jpg?') || lowerContent.contains('.png?') || lowerContent.contains('.jfif?');";

  const oldHasImgLF = "final hasImgUrl = lowerContent.endsWith('.jpg') || lowerContent.endsWith('.jpeg') ||\n        lowerContent.endsWith('.png') || lowerContent.endsWith('.webp') ||\n        lowerContent.endsWith('.gif') || lowerContent.contains('/chat-media/') ||\n        lowerContent.contains('.jpg?') || lowerContent.contains('.png?');";
  const newHasImgLF = "final hasImgUrl = lowerContent.endsWith('.jpg') || lowerContent.endsWith('.jpeg') ||\n        lowerContent.endsWith('.png') || lowerContent.endsWith('.webp') ||\n        lowerContent.endsWith('.gif') || lowerContent.endsWith('.jfif') ||\n        lowerContent.endsWith('.heic') || lowerContent.endsWith('.heif') ||\n        lowerContent.endsWith('.avif') || lowerContent.endsWith('.bmp') ||\n        lowerContent.endsWith('.svg') || lowerContent.endsWith('.ico') ||\n        lowerContent.contains('/chat-media/') || lowerContent.contains('/images/') ||\n        lowerContent.contains('.jpg?') || lowerContent.contains('.png?') || lowerContent.contains('.jfif?');";

  if (dart.includes(oldHasImg)) {
    dart = dart.replace(oldHasImg, newHasImg);
  } else if (dart.includes(oldHasImgLF)) {
    dart = dart.replace(oldHasImgLF, newHasImgLF);
  }

  fs.writeFileSync(chatScreenPath, dart, 'utf8');
  console.log(`✅ [${chatScreenPath}] Đã cập nhật nhận diện hasImgUrl cho mọi đuôi ảnh`);
}

// 3. Cập nhật main.dart.js (Cả 4 bản sao)
const jsFiles = [
  'public/main.dart.js',
  'backend/public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

jsFiles.forEach(p => {
  if (!fs.existsSync(p)) return;
  let js = fs.readFileSync(p, 'utf8');

  // Mở rộng nhận diện ảnh trong aaY
  const oldImgPattern = '_sl.indexOf(".gif")!==-1||_sl.indexOf("/chat-media/")!==-1;';
  const newImgPattern = '_sl.indexOf(".gif")!==-1||_sl.indexOf(".jfif")!==-1||_sl.indexOf(".heic")!==-1||_sl.indexOf(".heif")!==-1||_sl.indexOf(".avif")!==-1||_sl.indexOf(".bmp")!==-1||_sl.indexOf("/chat-media/")!==-1||_sl.indexOf("/images/")!==-1;';

  if (js.includes(oldImgPattern)) {
    js = js.replace(oldImgPattern, newImgPattern);
    fs.writeFileSync(p, js, 'utf8');
    console.log(`✅ [${p}] Đã mở rộng nhận diện mọi định dạng ảnh trong main.dart.js`);
  }
});

console.log('🎉 Đã hoàn tất cài đặt tính năng hỗ trợ MỌI định dạng ảnh!');
