const fs = require('fs');
const path = require('path');

const timestamp = Date.now();
console.log(`🚀 Starting CanvasKit enforcement with version: ${timestamp}`);

const dirs = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }
  console.log(`Processing directory: ${dir}`);

  // 1. Update flutter_bootstrap.js
  const bootstrapPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootstrapPath)) {
    let content = fs.readFileSync(bootstrapPath, 'utf8');
    
    // Replace "renderer":"auto" with "renderer":"canvaskit"
    content = content.replace(/"renderer"\s*:\s*"auto"/g, '"renderer":"canvaskit"');
    
    // Update mainJsPath version query param
    content = content.replace(/"mainJsPath"\s*:\s*"main\.dart\.js(?:\?v=[^"]*)?"/g, `"mainJsPath":"main.dart.js?v=${timestamp}"`);
    
    // Ensure config includes renderer: "canvaskit"
    if (content.includes('canvasKitBaseUrl: "canvaskit/"') && !content.includes('renderer: "canvaskit"')) {
      content = content.replace('canvasKitBaseUrl: "canvaskit/"', 'renderer: "canvaskit",\n    canvasKitBaseUrl: "canvaskit/"');
    }
    
    fs.writeFileSync(bootstrapPath, content, 'utf8');
    console.log(`  ✓ Updated ${bootstrapPath}`);
  }

  // 2. Patch main.dart.js fallback to always choose CanvasKit
  const mainJsPath = path.join(dir, 'main.dart.js');
  if (fs.existsSync(mainJsPath)) {
    let content = fs.readFileSync(mainJsPath, 'utf8');
    const bb9Regex = /bb9\(\)\{[^}]*B\.nt\.p\(0,s\)\}/;
    if (bb9Regex.test(content)) {
      content = content.replace(bb9Regex, 'bb9(){return!0}');
      fs.writeFileSync(mainJsPath, content, 'utf8');
      console.log(`  ✓ Patched A.bb9() to return !0 in ${mainJsPath}`);
    }
    // 2b. Wrap BackdropFilter child c in Positioned.fill: A.eG(0,c,d,d,0,0,0,d)
    const targetGesture = 'new A.awq(a),d,d,d,d,d,d,!1,B.ao)';
    const replacementGesture = 'new A.awq(a),d,d,d,d,d,d,!1,B.ao);c=A.eG(0,c,d,d,0,0,0,d)';
    if (content.includes(targetGesture) && !content.includes(replacementGesture)) {
      content = content.replace(targetGesture, replacementGesture);
      fs.writeFileSync(mainJsPath, content, 'utf8');
      console.log(`  ✓ Wrapped BackdropFilter in Positioned.fill in ${mainJsPath}`);
    } else if (content.includes(replacementGesture)) {
      console.log(`  ✓ BackdropFilter already wrapped in Positioned.fill in ${mainJsPath}`);
    }
  }

  // 3. Update index.html
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');

    // Update flutter_bootstrap.js script src version
    content = content.replace(/flutter_bootstrap\.js(?:\?v=\d+)?/g, `flutter_bootstrap.js?v=${timestamp}`);
    content = content.replace(/main\.dart\.js(?:\?v=\d+)?/g, `main.dart.js?v=${timestamp}`);

    // Ensure window.flutterWebRenderer = "canvaskit"
    if (!content.includes('window.flutterWebRenderer = "canvaskit"')) {
      const injection = `<script>\n    window.flutterWebRenderer = "canvaskit";\n  </script>\n  <script src="flutter_bootstrap.js?v=${timestamp}"`;
      content = content.replace(/<script src="flutter_bootstrap\.js\?v=\d+"/, injection);
    }

    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`  ✓ Updated ${indexPath}`);
  }
});

console.log('✅ CanvasKit enforcement completed successfully!');
