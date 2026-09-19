const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generatePerfectHomeIcons() {
  const sourceLogo = path.join(__dirname, '..', 'public', 'tho_fi_logo_transparent.png');
  if (!fs.existsSync(sourceLogo)) {
    throw new Error('Source logo not found: ' + sourceLogo);
  }

  console.log('Trimming transparent logo...');
  const trimmedBuffer = await sharp(sourceLogo).trim().toBuffer();
  const trimmedMeta = await sharp(trimmedBuffer).metadata();
  console.log('Trimmed logo dimension:', trimmedMeta.width, 'x', trimmedMeta.height);

  const targets = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-maskable-192.png', size: 192 },
    { name: 'icon.png', size: 512 },
    { name: 'icon-maskable-512.png', size: 512 },
    { name: 'icon_1024.png', size: 1024 },
    { name: 'favicon.png', size: 1024 }
  ];

  const generatedBuffers = {};

  for (const t of targets) {
    const targetW = Math.round(t.size * 0.8058);
    const resizedLogo = await sharp(trimmedBuffer).resize(targetW).toBuffer();
    const meta = await sharp(resizedLogo).metadata();

    const left = Math.round((t.size - meta.width) / 2);
    const top = Math.round((t.size - meta.height) / 2);

    console.log(`Generating ${t.name} (${t.size}x${t.size}): logo=${meta.width}x${meta.height}, pos=(${left}, ${top})`);

    const outputBuffer = await sharp({
      create: {
        width: t.size,
        height: t.size,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toBuffer();

    generatedBuffers[t.name] = outputBuffer;
  }

  const destDirs = [
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', 'flutter_frontend', 'web'),
    path.join(__dirname, '..', 'backend', 'public'),
    path.join(__dirname, '..', 'flutter_frontend', 'build', 'web'),
    path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web')
  ];

  for (const dir of destDirs) {
    if (!fs.existsSync(dir)) {
      console.log('Skipping non-existent dir:', dir);
      continue;
    }
    console.log('Updating icons in:', dir);
    for (const [filename, buf] of Object.entries(generatedBuffers)) {
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buf);
    }
  }

  // Update HTML files to ensure 180x180 points to apple-touch-icon.png
  const htmlFiles = [
    path.join(__dirname, '..', 'public', 'index.html'),
    path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
    path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
    path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
  ];

  for (const htmlPath of htmlFiles) {
    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      if (content.includes('sizes="180x180" href="/icon-192.png"')) {
        content = content.replace('sizes="180x180" href="/icon-192.png"', 'sizes="180x180" href="/apple-touch-icon.png"');
        fs.writeFileSync(htmlPath, content, 'utf8');
        console.log('Updated apple-touch-icon href in:', htmlPath);
      }
    }
  }

  console.log('All home screen icons generated and synced successfully!');
}

generatePerfectHomeIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
