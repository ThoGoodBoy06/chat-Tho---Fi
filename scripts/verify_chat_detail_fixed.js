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
  const port = 9257;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=504,804',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = {};

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending[msgId] = resolve;
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending[data.id]) {
        pending[data.id](data.result);
        delete pending[data.id];
      }
      // Hold messages for 4s so we can capture the message skeleton!
      if (data.method === 'Fetch.requestPaused') {
        const requestId = data.params.requestId;
        console.log('⚡ Intercepted:', data.params.request.url, '-> HOLDING 4s for Message Skeleton capture!');
        setTimeout(async () => {
          try {
            await send('Fetch.continueRequest', { requestId });
          } catch (err) {}
        }, 4000);
      }
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });

    // Enable intercept for /api/chat/*/messages*
    await send('Fetch.enable', {
      patterns: [
        { urlPattern: '*/api/chat/*/messages*', requestStage: 'Request' },
        { urlPattern: '*messages?limit=*', requestStage: 'Request' }
      ]
    });

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('flutter.authToken', JSON.stringify('${token}'));
        localStorage.setItem('authToken', '${token}');
        localStorage.setItem('flutter.userId', JSON.stringify('${userId}'));
        localStorage.setItem('userId', '${userId}');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000' });
    console.log('Chờ 8s cho app nạp...');
    await new Promise(r => setTimeout(r, 8000));

    // Click on conversation with Thanh Tho (x: 200, y: 260)
    console.log('Bấm vào cuộc trò chuyện Thanh Tho...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 260, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 260, button: 'left', clickCount: 1 });

    // Wait 1.0s while messages request is held -> capture message bubbles skeleton!
    console.log('Chờ 1.0s và chụp ảnh màn hình Message Bubbles Skeleton Loading...');
    await new Promise(r => setTimeout(r, 1000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\07389ac6-6731-445a-8900-268b4aab6511\\message_bubbles_skeleton_verified.png';
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log('✅ Đã lưu message_bubbles_skeleton_verified.png thành công!');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
  }
}

run();
