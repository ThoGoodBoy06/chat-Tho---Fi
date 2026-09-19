const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

function waitForJson(port, maxAttempts = 25) {
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
    }, 400);
  });
}

async function run() {
  const port = 9533;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    `--user-data-dir=C:\\temp\\chrome_dismiss_test_${Date.now()}`,
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

    // Mở cuộc trò chuyện qua prov.q9(prov.b[0])
    console.log('Mở cuộc trò chuyện đầu tiên qua provider...');
    const selectRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          if (!prov) return { error: 'No provider' };
          const convs = prov.b || [];
          if (convs.length === 0) return { error: 'No convs' };
          prov.q9(convs[0]);
          return { success: true, convId: convs[0].a };
        })()
      `,
      returnByValue: true
    });
    console.log('Select conv result:', JSON.stringify(selectRes.result.value));

    console.log('Chờ 4s cho tin nhắn nạp...');
    await new Promise(r => setTimeout(r, 4000));

    // Kích hoạt Context Menu
    console.log('Kích hoạt Context Menu...');
    const triggerMenu = await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof window._openLastContextMenu === 'function') {
            window._openLastContextMenu();
            return { success: true, method: '_openLastContextMenu' };
          }
          const state = window._activeChatScreenState;
          const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          const ctx = window._activeChatContext || (state && state.c);
          if (state && typeof state.VK === 'function' && prov && prov.d && prov.d.length > 0) {
            state.VK(ctx, prov.d[prov.d.length - 1], prov, false);
            return { success: true, method: 'state.VK' };
          }
          return { error: 'No trigger found', hasOpenLast: typeof window._openLastContextMenu, hasState: !!state };
        })()
      `,
      returnByValue: true
    });
    console.log('Trigger result:', JSON.stringify(triggerMenu.result.value));

    await new Promise(r => setTimeout(r, 1000));

    // Chụp ảnh 1: Menu đang hiện
    let shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/context_menu_opened_verify.png', Buffer.from(shot1.data, 'base64'));
    console.log('📸 Đã lưu scripts/context_menu_opened_verify.png');

    // Bấm vào chỗ trống bất kì (ở phía trên: x: 100, y: 100 - vùng làm mờ trống)
    console.log('👉 Bấm vào chỗ trống bất kì tại (100, 100)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 100, y: 100, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 100, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 1000));

    // Chụp ảnh 2: Sau khi bấm vào chỗ trống
    let shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/context_menu_dismissed_verify.png', Buffer.from(shot2.data, 'base64'));
    console.log('📸 Đã lưu scripts/context_menu_dismissed_verify.png');

    console.log('🎯 HOÀN TẤT KIỂM THỬ E2E!');
  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
