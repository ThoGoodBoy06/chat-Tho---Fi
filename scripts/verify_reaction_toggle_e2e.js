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
  const port = 9295;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_react_toggle_${Date.now()}`,
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

    // Click vào item cuộc trò chuyện Thanh Tho (x: 200, y: 260)
    console.log('Clicking on Thanh Tho at (200, 260)...');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 260 });
    await new Promise(r => setTimeout(r, 100));
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 260, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 100));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 260, button: 'left', clickCount: 1 });

    console.log('Chờ 5s cho tin nhắn nạp...');
    await new Promise(r => setTimeout(r, 5000));

    // Cuộn xuống đáy để xem tin nhắn gần nhất
    for (let i = 0; i < 6; i++) {
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 500, deltaX: 0, deltaY: 800 });
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1000));

    const checkMsg = async () => {
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            if (!prov) return { error: 'No activeChatProvider' };
            const msgs = prov.d || [];
            if (msgs.length === 0) return { error: 'No messages' };
            const m = msgs[msgs.length - 1];
            let reactMap = {};
            if (m.Q) {
              if (m.Q.entries) {
                for (let [k, v] of m.Q.entries()) reactMap[k] = v;
              } else if (typeof m.Q === 'object') {
                reactMap = m.Q;
              }
            }
            return {
              id: m.a,
              content: (m.e || '').substring(0, 30),
              reactions: reactMap
            };
          })()
        `,
        returnByValue: true
      });
      return res.result.value;
    };

    const triggerReact = async (msgId, emoji) => {
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            window.reactToMessage('${msgId}', '${emoji}');
            return true;
          })()
        `,
        returnByValue: true
      });
      return res.result.value;
    };

    const initial = await checkMsg();
    console.log('Target message:', initial);
    const targetId = initial.id;

    // BƯỚC 1: Thả icon Like (👍) lần 1
    console.log('\n--- BƯỚC 1: Thả icon 👍 lần 1 ---');
    await triggerReact(targetId, '👍');
    await new Promise(r => setTimeout(r, 1500));
    const step1 = await checkMsg();
    console.log('Reactions sau Bước 1:', step1.reactions);
    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_step1_liked.png', Buffer.from(shot.data, 'base64'));

    // BƯỚC 2: Thả lại icon Like (👍) lần 2 -> HỦY
    console.log('\n--- BƯỚC 2: Thả lại icon 👍 lần 2 (HỦY CẢM XÚC) ---');
    await triggerReact(targetId, '👍');
    await new Promise(r => setTimeout(r, 1500));
    const step2 = await checkMsg();
    console.log('Reactions sau Bước 2:', step2.reactions);
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_step2_cancelled.png', Buffer.from(shot.data, 'base64'));

    // BƯỚC 3: Thả icon Tim (❤️)
    console.log('\n--- BƯỚC 3: Thả icon ❤️ ---');
    await triggerReact(targetId, '❤️');
    await new Promise(r => setTimeout(r, 1500));
    const step3 = await checkMsg();
    console.log('Reactions sau Bước 3:', step3.reactions);
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_step3_heart.png', Buffer.from(shot.data, 'base64'));

    // BƯỚC 4: Đổi sang icon Like (👍)
    console.log('\n--- BƯỚC 4: Đổi sang icon 👍 ---');
    await triggerReact(targetId, '👍');
    await new Promise(r => setTimeout(r, 1500));
    const step4 = await checkMsg();
    console.log('Reactions sau Bước 4:', step4.reactions);
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_step4_switched.png', Buffer.from(shot.data, 'base64'));

    // BƯỚC 5: Thả lại icon Like (👍) lần nữa -> HỦY
    console.log('\n--- BƯỚC 5: Thả lại icon 👍 lần nữa (HỦY CẢM XÚC) ---');
    await triggerReact(targetId, '👍');
    await new Promise(r => setTimeout(r, 1500));
    const step5 = await checkMsg();
    console.log('Reactions sau Bước 5:', step5.reactions);
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_step5_cancelled.png', Buffer.from(shot.data, 'base64'));

    console.log('\n=======================================');
    console.log('KẾT QUẢ KIỂM TRA:');
    console.log('Bước 1 (Có 👍):', step1.reactions[userId] === '👍');
    console.log('Bước 2 (Hủy 👍 thành công):', !step2.reactions || step2.reactions[userId] === undefined);
    console.log('Bước 3 (Có ❤️):', step3.reactions[userId] === '❤️');
    console.log('Bước 4 (Đổi sang 👍):', step4.reactions[userId] === '👍');
    console.log('Bước 5 (Hủy 👍 thành công):', !step5.reactions || step5.reactions[userId] === undefined);
    console.log('=======================================');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
