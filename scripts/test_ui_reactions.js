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
  const port = 9280;
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

    console.log('Chờ 8s cho app Flutter nạp...');
    await new Promise(r => setTimeout(r, 8000));

    // Chụp ảnh màn hình danh sách tin nhắn
    const artifactDir = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db';
    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/flutter_chat_list.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã chụp ảnh danh sách hội thoại: flutter_chat_list.png');

    // Click vào cuộc trò chuyện đầu tiên (tọa độ khoảng x: 200, y: 220)
    console.log('Click vào hội thoại để vào phòng chat...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 220, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 220, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 4000));

    // Chụp ảnh phòng chat
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/flutter_inside_chat.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã chụp ảnh bên trong phòng chat: flutter_inside_chat.png');

    // Mở Gallery ảnh thông qua window.openImageModal
    console.log('Mở Gallery ảnh full-screen...');
    const sampleImg = 'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/5987a3da-7349-4eb9-901c-e6e99baaa554-z7197027825173_207f2de1fc56750c96f69fd1e1726a07.jpg';
    await send('Runtime.evaluate', {
      expression: `window.openImageModal('${sampleImg}')`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1200));

    // Click nút thả cảm xúc trên gallery
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('galleryReactBtn');
          if (btn) btn.click();
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 600));

    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/gallery_with_reaction_palette.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã chụp ảnh Gallery với menu emoji: gallery_with_reaction_palette.png');

    // Click chọn icon ❤️
    const reactRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bar = document.getElementById('galleryReactionRow');
          if (bar) {
            const first = bar.querySelector('span');
            if (first) {
              first.click();
              return { success: true, emoji: first.textContent };
            }
          }
          return { error: 'Not found' };
        })()
      `,
      returnByValue: true
    });
    console.log('Thả cảm xúc trong Gallery:', JSON.stringify(reactRes.result.value));

    await new Promise(r => setTimeout(r, 1500));
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/gallery_reacted_flying.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã chụp ảnh sau khi thả cảm xúc: gallery_reacted_flying.png');

    // Đóng gallery
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const m = document.getElementById('globalAlbumGalleryModal');
          if (m) m.remove();
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));

    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/chat_final_verified.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã chụp ảnh kết thúc kiểm tra: chat_final_verified.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
