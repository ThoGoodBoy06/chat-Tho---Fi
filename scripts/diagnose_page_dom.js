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
  const port = 9265;
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

    // Kiểm tra semantics hoặc flt-glass-pane
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const flt = document.querySelector('flt-glass-pane');
          const shadow = flt && flt.shadowRoot;
          const canvas = shadow ? shadow.querySelectorAll('canvas') : document.querySelectorAll('canvas');
          const allText = document.body.innerText;
          return {
            hasGlassPane: !!flt,
            hasShadow: !!shadow,
            canvasCount: canvas ? canvas.length : 0,
            textSnippet: (allText || '').substring(0, 200)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM check:', JSON.stringify(domCheck.result.value, null, 2));

    // Thử dispatch PointerEvent trực tiếp vào flt-glass-pane
    console.log('Dispatching PointerEvents at 200, 240...');
    const pointerRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const target = document.querySelector('flt-glass-pane') || document.body;
          const x = 200, y = 240;
          
          const down = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: 1
          });
          const up = new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: 0
          });
          target.dispatchEvent(down);
          target.dispatchEvent(up);
          return { dispatched: true };
        })()
      `,
      returnByValue: true
    });
    console.log('Pointer dispatch result:', JSON.stringify(pointerRes.result.value, null, 2));

    await new Promise(r => setTimeout(r, 4000));

    const checkProv = await send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            hasProv: !!(window._activeChatProvider || (window.$ && window.$._activeChatProvider)),
            convId: window._currentActiveChatConvId
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After pointer click:', JSON.stringify(checkProv.result.value, null, 2));

    const shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_pointer_click.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/test_pointer_click.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
