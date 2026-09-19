const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd'; // Minh Khang
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

function waitForJson(port, maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          clearInterval(interval);
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', (err) => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error(`Failed to connect to CDP port ${port}`));
        }
      });
    }, 500);
  });
}

async function run() {
  const port = 9285;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = {};
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending[data.id]) {
        pending[data.id](data.result);
        delete pending[data.id];
      }
    };

    const send = (method, params = {}) => {
      const msgId = id++;
      return new Promise((resolve) => {
        pending[msgId] = resolve;
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    await new Promise((resolve) => {
      ws.onopen = async () => {
        await send('Runtime.enable');
        await send('Page.enable');
        await send('Network.enable');
        await send('Network.setCacheDisabled', { cacheDisabled: true });
        await send('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            localStorage.setItem('flutter.authToken', JSON.stringify('${token}'));
            localStorage.setItem('authToken', '${token}');
            localStorage.setItem('flutter.userId', JSON.stringify('${userId}'));
            localStorage.setItem('userId', '${userId}');
          `
        });
        await send('Page.navigate', { url: 'http://localhost:3000' });
        resolve();
      };
    });

    console.log('Chờ 6s cho app Flutter nạp...');
    await new Promise(r => setTimeout(r, 6000));

    const artifactDir = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db';

    // 1. Mở Gallery Modal xem ảnh
    console.log('Mở Gallery ảnh full-screen...');
    const sampleImg = 'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/177cd118-15e4-4125-8758-0a715b51acdc-z7944974787687_ba06a45bba872b60228fca7869a23cd6_-_Copy.jpg';
    await send('Runtime.evaluate', {
      expression: `window.openImageModal('${sampleImg}')`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1200));

    // Kiểm tra xem nút khoanh tròn 'galleryReactBtn' đã bị xóa chưa
    const checkBtn = await send('Runtime.evaluate', {
      expression: `Boolean(document.getElementById('galleryReactBtn'))`,
      returnByValue: true
    });
    console.log('Nút galleryReactBtn còn tồn tại không?:', checkBtn.result.value, '(Phải là false)');

    // Chụp ảnh xem thanh công cụ sau khi đã xóa nút khoanh tròn
    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/gallery_btn_removed.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu gallery_btn_removed.png (Không còn nút khoanh tròn)!');

    // 2. Thử cử chỉ NHẤN GIỮ (Press and Hold) trên bức ảnh trong Gallery
    console.log('Kích hoạt cử chỉ Nhấn Giữ (Press and Hold) trên ảnh...');
    const triggerHold = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const track = document.getElementById('galleryTrack');
          if (track) {
            // Giả lập sự kiện chuột/touch nhấn giữ 400ms
            const downEvt = new MouseEvent('mousedown', { bubbles: true, clientX: 225, clientY: 450 });
            track.dispatchEvent(downEvt);
            return { dispatched: true };
          }
          return { error: 'No track' };
        })()
      `,
      returnByValue: true
    });
    console.log('Dispatch mousedown on image:', JSON.stringify(triggerHold.result.value));

    // Chờ 450ms để timer nhấn giữ kích hoạt
    await new Promise(r => setTimeout(r, 500));

    // Kiểm tra xem bảng emoji nổi đã xuất hiện chưa
    const checkEmojiBar = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bar = document.getElementById('galleryReactionRow');
          return {
            exists: Boolean(bar),
            display: bar ? bar.style.display : null,
            opacity: bar ? bar.style.opacity : null,
            top: bar ? bar.style.top : null,
            left: bar ? bar.style.left : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Trạng thái bảng emoji sau khi nhấn giữ ảnh:', JSON.stringify(checkEmojiBar.result.value, null, 2));

    // Chụp ảnh bằng chứng bảng emoji hiện ra khi nhấn giữ ảnh
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/gallery_press_hold_emoji_bar.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu gallery_press_hold_emoji_bar.png (Bảng icon hiện ra khi nhấn giữ)!');

    // 3. Click chọn icon ❤️ trong bảng vừa hiện
    const selectEmoji = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bar = document.getElementById('galleryReactionRow');
          if (bar) {
            const firstEmoji = bar.querySelector('span');
            if (firstEmoji) {
              firstEmoji.click();
              return { success: true, emoji: firstEmoji.textContent };
            }
          }
          return { error: 'No emoji' };
        })()
      `,
      returnByValue: true
    });
    console.log('Chọn icon từ menu nhấn giữ:', JSON.stringify(selectEmoji.result.value));

    // Chờ hiệu ứng tim bay
    await new Promise(r => setTimeout(r, 150));
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/gallery_press_hold_heart_flying.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu gallery_press_hold_heart_flying.png (Trái tim bay lên sau khi thả cảm xúc)!');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
