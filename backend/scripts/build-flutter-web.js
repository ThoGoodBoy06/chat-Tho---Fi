const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetWebDir = path.join(__dirname, '..', 'flutter_frontend', 'build', 'web');

if (fs.existsSync(path.join(targetWebDir, 'index.html'))) {
    console.log('✅ Flutter Web build already exists at:', targetWebDir);
    process.exit(0);
}

console.log('🚀 Starting automatic Flutter Web build...');

try {
    const isWin = process.platform === 'win32';
    const sdkDir = path.join(__dirname, '..', '.flutter_sdk');
    let flutterBin = isWin
        ? path.join(sdkDir, 'bin', 'flutter.bat')
        : path.join(sdkDir, 'bin', 'flutter');

    if (!fs.existsSync(flutterBin) && !fs.existsSync(path.join(sdkDir, 'flutter', 'bin', 'flutter.bat'))) {
        console.log(`📦 Downloading Flutter SDK for ${process.platform}...`);
        if (isWin) {
            const zipPath = path.join(__dirname, '..', 'flutter.zip');
            const winUrl = 'https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.22.0-stable.zip';
            console.log('Downloading Flutter Windows SDK via curl.exe...');
            execSync(`curl.exe -L "${winUrl}" -o "${zipPath}"`, { stdio: 'inherit' });
            console.log('📂 Extracting Flutter SDK on Windows using tar.exe...');
            if (!fs.existsSync(sdkDir)) fs.mkdirSync(sdkDir, { recursive: true });
            execSync(`tar.exe -xf "${zipPath}" -C "${sdkDir}"`, { stdio: 'inherit' });
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        } else {
            const tarPath = path.join(__dirname, '..', 'flutter.tar.xz');
            const linuxUrl = 'https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.22.0-stable.tar.xz';
            execSync(`curl -sL ${linuxUrl} -o "${tarPath}"`, { stdio: 'inherit' });
            console.log('📂 Extracting Flutter SDK on Linux...');
            execSync(`mkdir -p "${sdkDir}" && tar -xf "${tarPath}" -C "${sdkDir}" --strip-components=1`, { stdio: 'inherit' });
            if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
        }
    }

    if (isWin && !fs.existsSync(flutterBin)) {
        flutterBin = path.join(sdkDir, 'flutter', 'bin', 'flutter.bat');
    }

    console.log('🔨 Building Flutter Web release...');
    const flutterFrontendDir = path.join(__dirname, '..', 'flutter_frontend');
    execSync(`"${flutterBin}" pub get`, { cwd: flutterFrontendDir, stdio: 'inherit' });
    execSync(`"${flutterBin}" build web --release`, { cwd: flutterFrontendDir, stdio: 'inherit' });

    console.log('🎉 Flutter Web build completed successfully!');
} catch (err) {
    console.error('⚠️ Failed to build Flutter Web:', err.message);
    console.log('Fallback: Will serve public/ HTML frontend');
}
