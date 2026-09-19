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
  const port = 9261;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_react_${Date.now()}`,
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
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
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

    // Click vào item cuộc trò chuyện Thanh Tho (x: 200, y: 260)
    console.log('Clicking on Thanh Tho at (200, 260)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 260, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 260, button: 'left', clickCount: 1 });

    console.log('Chờ 6s cho tin nhắn nạp...');
    await new Promise(r => setTimeout(r, 6000));

    const checkState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          const state = window._activeChatScreenState;
          const convId = window._currentActiveChatConvId;
          return {
            hasProv: !!prov,
            hasState: !!state,
            convId: convId,
            messageCount: prov && prov.d ? prov.d.length : 0,
            recent: prov && prov.d ? prov.d.slice(-4).map(m => ({
              id: m.a,
              content: (m.e || '').substring(0, 30),
              type: m.d,
              imageUrl: m.f,
              reactions: m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : null
            })) : []
          };
        })()
      `,
      returnByValue: true
    });

    console.log('State in desktop:', JSON.stringify(checkState.result.value, null, 2));

    const shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_desktop_chat.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/test_desktop_chat.png');

    // Nếu có prov, thử react vào tin nhắn ảnh gần nhất
    if (checkState.result.value && checkState.result.value.hasProv) {
      const reactRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const msgs = prov.d || [];
            let imgMsg = msgs.slice().reverse().find(m => m.d === 'image' || (m.f && m.f.length > 0) || (m.e && m.e.startsWith('data:image')));
            if (!imgMsg) imgMsg = msgs[msgs.length - 1];
            prov.a1l(imgMsg.a, '❤️');
            return {
              reactedId: imgMsg.a,
              content: imgMsg.e,
              type: imgMsg.d
            };
          })()
        `,
        returnByValue: true
      });
      console.log('Direct react result:', JSON.stringify(reactRes.result.value, null, 2));

      await new Promise(r => setTimeout(r, 2000));

      const shot2 = await send('Page.captureScreenshot');
      fs.writeFileSync('scripts/test_desktop_after_react.png', Buffer.from(shot2.data, 'base64'));
      console.log('📸 Đã lưu scripts/test_desktop_after_react.png');
    }

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
