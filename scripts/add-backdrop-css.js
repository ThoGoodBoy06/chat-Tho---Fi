const fs = require('fs');
const path = require('path');

const cssRules = `
    /* Universal Frosted Glass & Backdrop Blur for iOS Safari & All Browsers */
    flt-backdrop, flt-backdrop-interior, flt-backdrop-filter, [style*="backdrop-filter"], [style*="-webkit-backdrop-filter"] {
      -webkit-backdrop-filter: blur(14px) !important;
      backdrop-filter: blur(14px) !important;
      background-color: rgba(0, 0, 0, 0.22) !important;
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
`;

const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
];

htmlFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  let html = fs.readFileSync(f, 'utf8');
  if (html.includes('flt-backdrop-filter')) {
    console.log(`ℹ️ Already has backdrop-filter CSS in ${path.basename(f)}`);
    return;
  }
  html = html.replace('<style>', '<style>' + cssRules);
  fs.writeFileSync(f, html, 'utf8');
  console.log(`✅ Injected universal backdrop-filter CSS into ${f}`);
});
