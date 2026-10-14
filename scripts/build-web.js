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

// Tự động kiểm tra và cập nhật đường dẫn môi trường trong .dart_tool/package_config.json
const pkgConfigPath = path.join(frontendDir, '.dart_tool', 'package_config.json');
if (fs.existsSync(pkgConfigPath)) {
    let pkgConfig = fs.readFileSync(pkgConfigPath, 'utf8');
    const flutterRootDir = path.resolve(path.dirname(flutterCmd), '..').replace(/\\/g, '/');
    const pubCacheDir = (env.PUB_CACHE || '').replace(/\\/g, '/');
    let modified = false;

    if (flutterRootDir && !pkgConfig.includes(flutterRootDir)) {
        pkgConfig = pkgConfig.replace(/"flutterRoot":\s*"[^"]+"/g, `"flutterRoot": "file:///${flutterRootDir}"`);
        pkgConfig = pkgConfig.replace(/file:\/\/\/[^"]+\/packages\/flutter/g, `file:///${flutterRootDir}/packages/flutter`);
        pkgConfig = pkgConfig.replace(/file:\/\/\/[^"]+\/bin\/cache\/pkg\/sky_engine/g, `file:///${flutterRootDir}/bin/cache/pkg/sky_engine`);
        modified = true;
    }
    if (pubCacheDir && !pkgConfig.includes(pubCacheDir)) {
        pkgConfig = pkgConfig.replace(/"pubCache":\s*"[^"]+"/g, `"pubCache": "file:///${pubCacheDir}"`);
        pkgConfig = pkgConfig.replace(/file:\/\/\/[^"]+\/hosted\/pub\.dev/g, `file:///${pubCacheDir}/hosted/pub.dev`);
        modified = true;
    }
    if (modified) {
        fs.writeFileSync(pkgConfigPath, pkgConfig, 'utf8');
        console.log('🔧 Đã tự động cập nhật đường dẫn SDK trong .dart_tool/package_config.json');
    }
}

// Dọn dẹp cache kernel flutter_build bị hỏng nếu có
const flutterBuildDir = path.join(frontendDir, '.dart_tool', 'flutter_build');
if (fs.existsSync(flutterBuildDir)) {
    try {
        fs.rmSync(flutterBuildDir, { recursive: true, force: true });
    } catch (_) {}
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
