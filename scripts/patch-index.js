const fs = require('fs');

const indexFiles = [
  'flutter_frontend/build/web/index.html',
  'public/index.html',
  'backend/flutter_frontend/build/web/index.html',
  'flutter_frontend/web/index.html'
];

const emojiPreloads = '  <!-- Official Messenger Reaction Emoji Preloads -->\n' +
  '  <link rel="preload" href="/assets/emojis/2764-fe0f.png" as="image">\n' +
  '  <link rel="preload" href="/assets/emojis/1f606.png" as="image">\n' +
  '  <link rel="preload" href="/assets/emojis/1f62e.png" as="image">\n' +
  '  <link rel="preload" href="/assets/emojis/1f622.png" as="image">\n' +
  '  <link rel="preload" href="/assets/emojis/1f621.png" as="image">\n' +
  '  <link rel="preload" href="/assets/emojis/1f44d.png" as="image">\n' +
  '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap">\n';

indexFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('2764-fe0f.png')) {
    console.log('Already updated:', file);
    return;
  }
  const target = '<link rel="preload" href="/tho_fi_logo_transparent.png" as="image">';
  if (html.includes(target)) {
    html = html.replace(target, target + '\n' + emojiPreloads);
    fs.writeFileSync(file, html);
    console.log('Added emoji preloads to:', file);
  } else {
    console.log('Target not found in:', file);
  }
});
