const sharp = require('sharp');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const sourceIcon = path.join(publicDir, 'icon.png');

// ============================================
// 👉 CHỈNH GIÁ TRỊ NÀY ĐỂ THAY ĐỔI KÍCH THƯỚC LOGO
// 0.72 = hiện tại | 0.80 = lớn hơn | 0.85 = rất lớn
const LOGO_RATIO = 0.80;
// ============================================

async function generateIcons() {
    console.log(`Logo ratio: ${LOGO_RATIO} (${LOGO_RATIO * 100}%)`);

    // Trim whitespace từ icon gốc
    const trimmedBuffer = await sharp(sourceIcon).trim().toBuffer();
    const trimmedMeta = await sharp(trimmedBuffer).metadata();
    console.log(`Trimmed icon: ${trimmedMeta.width}x${trimmedMeta.height}`);

    // --- Maskable 512x512 ---
    const logoSize512 = Math.round(512 * LOGO_RATIO);
    const resized512 = await sharp(trimmedBuffer)
        .resize(logoSize512, logoSize512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

    await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: resized512, gravity: 'centre' }])
        .png().toFile(path.join(publicDir, 'icon-maskable-512.png'));
    console.log('✅ icon-maskable-512.png');

    // --- Maskable 192x192 ---
    const logoSize192 = Math.round(192 * LOGO_RATIO);
    const resized192 = await sharp(trimmedBuffer)
        .resize(logoSize192, logoSize192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

    await sharp({ create: { width: 192, height: 192, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: resized192, gravity: 'centre' }])
        .png().toFile(path.join(publicDir, 'icon-maskable-192.png'));
    console.log('✅ icon-maskable-192.png');

    // --- Regular 192x192 ---
    await sharp(sourceIcon).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✅ icon-192.png');

    // --- Apple Touch Icon 180x180 ---
    const appleLogoSize = Math.round(180 * LOGO_RATIO);
    const resizedApple = await sharp(trimmedBuffer)
        .resize(appleLogoSize, appleLogoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();

    await sharp({ create: { width: 180, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite([{ input: resizedApple, gravity: 'centre' }])
        .png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ apple-touch-icon.png');

    console.log('\n🎉 Hoàn tất! Tất cả icon đã được tạo.');
}

generateIcons().catch(console.error);
