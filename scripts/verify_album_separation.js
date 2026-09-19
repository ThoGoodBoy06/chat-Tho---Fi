const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
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
  const port = 9235;
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

    // Mở cuộc trò chuyện
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4000));

    // Test Case 1: Mở ảnh riêng lẻ (click vào ảnh trong chat)
    console.log('Nhấn vào ảnh riêng lẻ...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 320, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 320, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1200));

    const singlePhotoCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var counter = document.getElementById('galleryCounterText');
          var thumbs = document.getElementById('galleryThumbs');
          var prev = document.querySelector('button[style*="left:18px"]') || document.querySelectorAll('#globalAlbumGalleryModal button')[2];
          return {
            counterText: counter ? counter.textContent : 'none',
            thumbsDisplay: thumbs ? thumbs.style.display : 'none',
            isSingle: counter ? counter.textContent.includes('1 / 1') : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Kết quả kiểm tra ảnh riêng lẻ:', JSON.stringify(singlePhotoCheck.result.value, null, 2));

    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_single_photo_verified.png', Buffer.from(shot1.data, 'base64'));
    console.log('✅ Đã lưu scripts/test_single_photo_verified.png');

    // Đóng modal ảnh riêng
    await send('Runtime.evaluate', {
      expression: `
        var btn = document.querySelector('#globalAlbumGalleryModal button:last-of-type');
        if (btn) btn.click();
      `
    });
    await new Promise(r => setTimeout(r, 500));

    // Test Case 2: Mở Album có 2 ảnh
    console.log('Kiểm tra mở Album có 2 ảnh...');
    const albumCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var sampleUrls = [
            'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/177cd118-15e4-4125-8758-0a715b51acdc-z7944974787687_ba06a45bba872b60228fca7869a23cd6_-_Copy.jpg',
            'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/0a98c357-fc1e-46b1-8f81-e8033d2b869f-z6556162590649_d92e7ced8dd33755ef607b9b16b32363.jpg'
          ];
          window.openAlbumGalleryModal(sampleUrls, 0);
          var counter = document.getElementById('galleryCounterText');
          var thumbs = document.getElementById('galleryThumbs');
          var slides = document.querySelectorAll('.gallery-slide');
          return {
            counterText: counter ? counter.textContent : 'none',
            slideCount: slides.length,
            thumbsDisplay: thumbs ? thumbs.style.display : 'none'
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Kết quả kiểm tra Album 2 ảnh:', JSON.stringify(albumCheck.result.value, null, 2));

    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_album_2_photos_verified.png', Buffer.from(shot2.data, 'base64'));
    console.log('✅ Đã lưu scripts/test_album_2_photos_verified.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
