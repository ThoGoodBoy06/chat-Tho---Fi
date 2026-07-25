const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetWebDir = path.join(__dirname, '..', 'flutter_frontend', 'build', 'web');

if (fs.existsSync(path.join(targetWebDir, 'index.html'))) {
    console.log('✅ Flutter Web build already exists at:', targetWebDir);
    process.exit(0);
}

console.log('🚀 Starting automatic Flutter Web build on Render...');

try {
    const sdkDir = path.join(__dirname, '..', '.flutter_sdk');
    const flutterBin = path.join(sdkDir, 'bin', 'flutter');

    if (!fs.existsSync(flutterBin)) {
        console.log('📦 Downloading Flutter SDK for Linux build environment...');
        const tarPath = path.join(__dirname, '..', 'flutter.tar.xz');
        execSync(`curl -sL https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.22.0-stable.tar.xz -o "${tarPath}"`, { stdio: 'inherit' });
        console.log('📂 Extracting Flutter SDK...');
        execSync(`mkdir -p "${sdkDir}" && tar -xf "${tarPath}" -C "${sdkDir}" --strip-components=1`, { stdio: 'inherit' });
        if (fs.existsSync(tarPath)) {
            fs.unlinkSync(tarPath);
        }
    }

    console.log('🔨 Building Flutter Web release...');
    const flutterFrontendDir = path.join(__dirname, '..', 'flutter_frontend');
    execSync(`"${flutterBin}" pub get`, { cwd: flutterFrontendDir, stdio: 'inherit' });
    execSync(`"${flutterBin}" build web --release`, { cwd: flutterFrontendDir, stdio: 'inherit' });

    console.log('🎉 Flutter Web build completed successfully!');
} catch (err) {
    console.error('⚠️ Failed to build Flutter Web on Render:', err.message);
    console.log('Fallback: Will serve public/ HTML frontend');
}
