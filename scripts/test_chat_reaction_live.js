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
  const port = 9275;
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

    // Đóng banner thông báo nếu có nút close
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const flt = document.querySelector('flt-glass-pane');
          if (flt && flt.shadowRoot) {
            const btns = flt.shadowRoot.querySelectorAll('button, flt-semantics-placeholder');
          }
        })()
      `
    });

    // Mở cuộc trò chuyện Thanh Tho (y: 235)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 235, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 235, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4000));

    // Cuộn xuống đáy để xem tin nhắn mới nhất
    for (let i = 0; i < 12; i++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 250, y: 500, deltaX: 0, deltaY: 1500 });
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1500));

    // Chụp ảnh phòng chat trước khi thả cảm xúc
    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/live_chat_before_reaction.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/live_chat_before_reaction.png');

    // Thử gọi window.reactToMessage vào tin nhắn ảnh gần nhất
    const reactRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          if (!prov) return { error: 'No active provider' };
          const msgs = prov.d || [];
          let imgMsg = msgs.slice().reverse().find(m => m.d === 'image' || (m.f && m.f.length > 0) || (m.e && m.e.startsWith('data:image')));
          if (!imgMsg) imgMsg = msgs[msgs.length - 1];
          if (!imgMsg) return { error: 'No message found' };
          
          window.reactToMessage(imgMsg.a, '❤️');
          return {
            reactedId: imgMsg.a,
            content: (imgMsg.e || '').substring(0, 30),
            type: imgMsg.d
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Live react result:', JSON.stringify(reactRes.result.value, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // Chụp ảnh sau khi thả cảm xúc để xem badge ❤️ hiện lên
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/live_chat_after_reaction.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/live_chat_after_reaction.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
