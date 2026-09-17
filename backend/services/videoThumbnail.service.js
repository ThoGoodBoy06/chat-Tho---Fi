const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

/**
 * Trích xuất ảnh bìa (thumbnail frame) từ video buffer sử dụng OpenCV Python
 * @param {Buffer} videoBuffer
 * @returns {Buffer|null} Ảnh JPEG thumbnail buffer
 */
function extractVideoThumbnail(videoBuffer) {
  if (!videoBuffer || videoBuffer.length === 0) return null;

  const tempId = uuidv4();
  const tmpVidPath = path.join(__dirname, `tmp_vid_${tempId}.mp4`);
  const tmpThumbPath = path.join(__dirname, `tmp_thumb_${tempId}.jpg`);

  try {
    fs.writeFileSync(tmpVidPath, videoBuffer);

    // Sử dụng Python OpenCV trích xuất frame đầu tiên và resize về chuẩn 480px
    const pyCode = [
      'import cv2, os, sys',
      `cap = cv2.VideoCapture(r"${tmpVidPath.replace(/\\/g, '/')}")`,
      'ret, frame = cap.read()',
      'cap.release()',
      'if not ret:',
      '    sys.exit(1)',
      'h, w = frame.shape[:2]',
      'target_w = 480',
      'target_h = int(h * (target_w / w))',
      'resized = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)',
      `cv2.imwrite(r"${tmpThumbPath.replace(/\\/g, '/')}", resized, [cv2.IMWRITE_JPEG_QUALITY, 85])`
    ].join('; ');

    execSync(`python -c "${pyCode}"`, { stdio: 'pipe', timeout: 5000 });

    if (fs.existsSync(tmpThumbPath)) {
      const thumbBuf = fs.readFileSync(tmpThumbPath);
      return thumbBuf;
    }
  } catch (err) {
    console.warn('⚠️ [videoThumbnail] Không thể trích xuất frame bằng OpenCV:', err.message);
  } finally {
    try { if (fs.existsSync(tmpVidPath)) fs.unlinkSync(tmpVidPath); } catch (_) {}
    try { if (fs.existsSync(tmpThumbPath)) fs.unlinkSync(tmpThumbPath); } catch (_) {}
  }

  return null;
}

module.exports = {
  extractVideoThumbnail
};
