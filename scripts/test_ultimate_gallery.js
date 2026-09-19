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
  const port = 9234;
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

    console.log('Chờ 8s cho app Flutter khởi động...');
    await new Promise(r => setTimeout(r, 8000));

    // Bấm vào cuộc trò chuyện
    console.log('Mở cuộc trò chuyện...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4500));

    // Kiểm tra trạng thái cache ảnh
    const convState = await send('Runtime.evaluate', {
      expression: `
        ({
          activeConvImages: window._activeConvImages ? window._activeConvImages.length : 0,
          currentConvId: window._currentConvId,
          activeChatProvider: !!window._activeChatProvider
        })
      `,
      returnByValue: true
    });
    console.log('Trạng thái gom ảnh sau khi vào chat:', JSON.stringify(convState.result.value, null, 2));

    // Click vào ảnh trong đoạn chat (khoảng x=320, y=300)
    console.log('Nhấn vào ảnh để mở Gallery Viewer...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 320, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 320, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1500));

    // Kiểm tra modal
    const modalState = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var modal = document.getElementById('globalAlbumGalleryModal');
          if (!modal) return { open: false };
          var track = document.getElementById('galleryTrack');
          var slides = track ? track.querySelectorAll('.gallery-slide') : [];
          var counter = document.getElementById('galleryCounterText');
          var thumbs = document.getElementById('galleryThumbs');
          var thumbCards = thumbs ? thumbs.querySelectorAll('div') : [];
          return {
            open: true,
            slideCount: slides.length,
            counterText: counter ? counter.textContent : '',
            thumbCount: thumbCards.length,
            scrollLeft: track ? track.scrollLeft : 0
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Trạng thái Modal Gallery:', JSON.stringify(modalState.result.value, null, 2));

    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/ultimate_gallery_opened.png', Buffer.from(shot1.data, 'base64'));
    console.log('✅ Đã lưu scripts/ultimate_gallery_opened.png');

    // Giả lập kéo chuột sang trái (Mouse drag left: x=350 -> x=100)
    console.log('Thực hiện kéo chuột (Mouse Drag)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 350, y: 450, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 280, y: 450 });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 450 });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 450 });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 450, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 1000));

    const modalStateAfter = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var track = document.getElementById('galleryTrack');
          var counter = document.getElementById('galleryCounterText');
          return {
            counterText: counter ? counter.textContent : '',
            scrollLeft: track ? track.scrollLeft : 0
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Trạng thái sau khi kéo chuột:', JSON.stringify(modalStateAfter.result.value, null, 2));

    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/ultimate_gallery_dragged.png', Buffer.from(shot2.data, 'base64'));
    console.log('✅ Đã lưu scripts/ultimate_gallery_dragged.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
