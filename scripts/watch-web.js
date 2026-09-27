const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const libDir = path.join(rootDir, 'flutter_frontend', 'lib');

console.log('👀 Đang theo dõi các thay đổi trong:', libDir);
console.log('💡 Bất cứ khi nào bạn nhấn Ctrl + S lưu code trong flutter_frontend/lib, hệ thống sẽ tự động build lại!');

let debounceTimer = null;
let isBuilding = false;

function triggerBuild(filename) {
    if (isBuilding) {
        console.log(`⏳ Đang trong quá trình build, bỏ qua sự kiện của: ${filename}`);
        return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        isBuilding = true;
        console.log(`\n🔔 Phát hiện thay đổi trong [${filename}]. Bắt đầu tự động build lại...`);
        
        const child = spawn('node', [path.join(__dirname, 'build-web.js')], {
            cwd: rootDir,
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            isBuilding = false;
            if (code === 0) {
                console.log('\n✨ Đã tự động cập nhật xong! Bạn hãy F5 lại http://localhost:3000 để thấy kết quả.');
            } else {
                console.error(`❌ Build tự động kết thúc với mã lỗi: ${code}`);
            }
        });
    }, 1200);
}

fs.watch(libDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.endsWith('.dart')) {
        triggerBuild(filename);
    }
});
