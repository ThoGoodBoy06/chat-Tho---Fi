const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'flutter_frontend');

// 1. Tìm đường dẫn Flutter
let flutterCmd = 'flutter';
const candidateFlutterPaths = [
    'C:\\Users\\MSI PC\\Documents\\Codex\\2026-10-03\\c-du-an-nhantin-goidien\\work\\flutter-validation\\flutter\\bin\\flutter.bat',
    'C:\\Users\\MSI PC\\Documents\\Codex\\2026-09-25\\b-n-l-m-app-c\\work\\flutter-validation\\flutter\\bin\\flutter.bat',
];

for (const p of candidateFlutterPaths) {
    if (fs.existsSync(p)) {
        flutterCmd = p;
        break;
    }
}

if (flutterCmd === 'flutter') {
    const checkFlutter = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['flutter.bat'], { shell: true });
    if (checkFlutter.status === 0) {
        flutterCmd = 'flutter.bat';
    }
}

console.log(`🔨 Đang dùng Flutter tại: ${flutterCmd}`);

const env = { ...process.env };
const candidatePubCache = [
    'C:\\Users\\MSI PC\\AppData\\Local\\Pub\\Cache',
    'C:\\Users\\MSI PC\\Documents\\Codex\\2026-10-03\\c-du-an-nhantin-goidien\\work\\flutter-validation\\pub-cache',
    'C:\\Users\\MSI PC\\Documents\\Codex\\2026-09-25\\b-n-l-m-app-c\\work\\flutter-validation\\pub-cache'
];
for (const p of candidatePubCache) {
    if (fs.existsSync(p)) {
        env.PUB_CACHE = p;
        break;
    }
}

// Tự động đồng bộ nếu người dùng sửa file trong backend/flutter_frontend/lib
const backendLib = path.join(rootDir, 'backend', 'flutter_frontend', 'lib');
const rootLib = path.join(rootDir, 'flutter_frontend', 'lib');
if (fs.existsSync(backendLib)) {
    function syncDir(src, dest) {
        for (const item of fs.readdirSync(src, { withFileTypes: true })) {
            const sPath = path.join(src, item.name);
            const dPath = path.join(dest, item.name);
            if (item.isDirectory()) {
                if (fs.existsSync(dPath)) syncDir(sPath, dPath);
            } else if (item.isFile() && item.name.endsWith('.dart')) {
                if (fs.existsSync(dPath)) {
                    const sStat = fs.statSync(sPath);
                    const dStat = fs.statSync(dPath);
                    if (sStat.mtimeMs > dStat.mtimeMs) {
                        fs.copyFileSync(sPath, dPath);
                        console.log(`🔄 Tự động đồng bộ thay đổi: ${path.relative(rootDir, dPath)}`);
                    }
                }
            }
        }
    }
    syncDir(backendLib, rootLib);
}

// 2. Chạy flutter build web
console.log('⚡ Đang biên dịch Flutter Web (CanvasKit Release)... Vui lòng đợi khoảng 1 phút.');
const buildCmd = `"${flutterCmd}" --no-version-check build web --release --no-pub --web-renderer canvaskit --pwa-strategy none --no-tree-shake-icons`;
const buildResult = spawnSync(buildCmd, {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true,
    env
});

if (buildResult.status !== 0) {
    console.error('❌ Lỗi: Biên dịch Flutter Web thất bại!');
    process.exit(buildResult.status || 1);
}

// 3. Chuẩn bị release & đồng bộ các thư mục
console.log('📦 Đang đồng bộ bundle sang các thư mục phục vụ web...');
require('./prepare-web-release.js');

console.log('\n🎉 THÀNH CÔNG! Gói web mới đã được cập nhật.');
console.log('👉 Bây giờ bạn chỉ cần mở http://localhost:3000 và bấm phím F5 để xem thay đổi!');
