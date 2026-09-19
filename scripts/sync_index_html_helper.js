const fs = require('fs');
const path = require('path');

const indexFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'backend', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const scriptTag = `<script src="/webrtc_audio_helper.js?v=v_react_fix_${Date.now()}"></script>`;

indexFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('webrtc_audio_helper.js')) {
    // Update cache buster
    content = content.replace(/<script src="\/webrtc_audio_helper\.js[^"]*"><\/script>/g, scriptTag);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`[UPDATED] ${file}`);
  } else {
    // Insert before <link rel="manifest"
    const target = '<link rel="manifest"';
    if (content.includes(target)) {
      content = content.replace(target, scriptTag + '\n  ' + target);
      fs.writeFileSync(file, content, 'utf8');
      console.log(`[INSERTED] ${file}`);
    } else {
      console.warn(`[TARGET NOT FOUND] in ${file}`);
    }
  }
});
