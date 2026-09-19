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
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      }).on('error', (err) => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(err);
        }
      });
    }, 500);
  });
}

async function run() {
  const port = 9231;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=500,900',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return new Promise((res) => {
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            res(data.result);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    await new Promise((res) => {
      ws.onopen = async () => {
        await send('Runtime.enable');
        await send('Page.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            localStorage.setItem('flutter.authToken', JSON.stringify('${token}'));
            localStorage.setItem('authToken', '${token}');
            localStorage.setItem('flutter.userId', JSON.stringify('${userId}'));
            localStorage.setItem('userId', '${userId}');
          `
        });
        await send('Page.navigate', { url: 'http://localhost:3000' });
        res();
      };
    });

    console.log('Waiting 8s for app...');
    await new Promise(r => setTimeout(r, 8000));

    // Click chat item
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 250, y: 250, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 250, y: 250, button: 'left', clickCount: 1 });
    console.log('Waiting 5s for chat messages...');
    await new Promise(r => setTimeout(r, 5000));

    // Capture screenshot of chat screen
    const chatShot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/diag_chat_screen.png', Buffer.from(chatShot.data, 'base64'));
    console.log('Saved scripts/diag_chat_screen.png');

    // Check state
    const resState = await send('Runtime.evaluate', {
      expression: `
        ({
          hasActiveChatProvider: !!window._activeChatProvider,
          providerMessagesCount: window._activeChatProvider && window._activeChatProvider.d ? window._activeChatProvider.d.length : 0,
          currentConvId: window._currentActiveChatConvId || window._currentConvId,
          cachedImages: window._chatImagesCache ? window._chatImagesCache.length : 0,
          webrtcHelperUrl: Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => s.includes('webrtc'))
        })
      `,
      returnByValue: true
    });
    console.log('State in browser:', JSON.stringify(resState.result.value, null, 2));

  } finally {
    chromeProcess.kill();
  }
}
run().catch(console.error);
