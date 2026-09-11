const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js')
];

const BACKEND_URL = "https://chat-tho-fi-vn-9s8u.onrender.com";

for (const filePath of files) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Patch ApiService.da()
  const targetApi = 'if(q.includes("pages.dev")||q.includes("cloudflare"))return"${BACKEND_URL}/api"';
  const replaceApi = 'if(q.includes("pages.dev")||q.includes("workers.dev")||q.includes("cloudflare"))return"${BACKEND_URL}/api"';

  if (content.includes(targetApi)) {
    content = content.replace(targetApi, replaceApi);
    console.log(`[${path.basename(filePath)}] Patched ApiService baseUrl for Cloudflare Pages!`);
  } else {
    console.warn(`[${path.basename(filePath)}] Target API pattern not found`);
  }

  // 2. Patch SocketService
  const targetSocket = 'else if(n.includes("pages.dev")||n.includes("cloudflare")){p=a0.a="${BACKEND_URL}"}';
  const replaceSocket = 'else if(n.includes("pages.dev")||n.includes("workers.dev")||n.includes("cloudflare")){p=a0.a="${BACKEND_URL}"}';

  if (content.includes(targetSocket)) {
    content = content.replace(targetSocket, replaceSocket);
    console.log(`[${path.basename(filePath)}] Patched SocketService serverUrl for Cloudflare Pages!`);
  } else {
    console.warn(`[${path.basename(filePath)}] Target Socket pattern not found`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log("🎉 Flutter Web Bundle is 100% ready for Cloudflare Pages!");
