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
  const port = 9249;
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
        await send('Log.enable');
        ws.addEventListener('message', (msg) => {
          const d = JSON.parse(msg.data);
          if (d.method === 'Runtime.consoleAPICalled') {
            console.log('[BROWSER CONSOLE]', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
          } else if (d.method === 'Runtime.exceptionThrown') {
            console.error('[BROWSER EXCEPTION]', d.params.exceptionDetails);
          }
        });
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

    // Bấm vào tab 1 (Danh bạ) ở bottom bar (tọa độ window size 504x804: x=208, y=765)
    console.log('Bấm tab Danh bạ...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 208, y: 765, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 208, y: 765, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4000));

    // Chụp ảnh màn hình
    const shot = await send('Page.captureScreenshot');
    const artifactPath = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db\\contacts_tab_verified.png';
    fs.writeFileSync('scripts/contacts_tab_verified.png', Buffer.from(shot.data, 'base64'));
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));
    console.log('✅ Đã lưu contacts_tab_verified.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
