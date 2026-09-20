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
  const port = 9259;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=504,804',
    'https://chat-tho-fi.pages.dev'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('pages.dev')) || tabs[0];
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

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending[data.id]) {
        pending[data.id](data.result);
        delete pending[data.id];
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER LOG]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
      }
      if (data.method === 'Network.responseReceived') {
        const resp = data.params.response;
        console.log('[NET RESP]', resp.status, resp.url);
      }
      if (data.method === 'Network.loadingFailed') {
        console.log('[NET FAILED]', data.params.errorText, data.params.type, data.params.requestId);
      }
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('flutter.authToken', JSON.stringify('${token}'));
        localStorage.setItem('authToken', '${token}');
        localStorage.setItem('flutter.userId', JSON.stringify('${userId}'));
        localStorage.setItem('userId', '${userId}');
      `
    });

    await send('Page.navigate', { url: 'https://chat-tho-fi.pages.dev' });

    console.log('Chờ 12s cho https://chat-tho-fi.pages.dev nạp...');
    await new Promise(r => setTimeout(r, 12000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\07389ac6-6731-445a-8900-268b4aab6511\\pages_dev_authenticated_diagnose.png';
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log('✅ Đã lưu pages_dev_authenticated_diagnose.png!');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
  }
}

run();
