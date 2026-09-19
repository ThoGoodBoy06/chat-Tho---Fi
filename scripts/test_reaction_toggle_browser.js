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
  const port = 9310;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    `--user-data-dir=C:\\temp\\chrome_react_mobile_${Date.now()}`,
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

    console.log('Chờ 8s cho app khởi động...');
    await new Promise(r => setTimeout(r, 8000));

    console.log('Nhấn vào cuộc trò chuyện...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 235, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 235, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4500));

    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/flutter_inside_chat.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/flutter_inside_chat.png');

    const checkStatus = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          if (!prov) return { error: 'No activeChatProvider' };
          const msgs = prov.d || [];
          return {
            totalMsgs: msgs.length,
            convId: window._currentConvId || (window._currentActiveChatConvId),
            lastMsg: msgs.length > 0 ? {
              id: msgs[msgs.length - 1].a,
              content: msgs[msgs.length - 1].e,
              reactions: msgs[msgs.length - 1].Q ? Object.fromEntries(msgs[msgs.length - 1].Q.entries ? msgs[msgs.length - 1].Q.entries() : []) : null
            } : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Chat status:', JSON.stringify(checkStatus.result.value, null, 2));

    if (checkStatus.result.value && checkStatus.result.value.lastMsg) {
      const targetMsgId = checkStatus.result.value.lastMsg.id;

      // 1. Thả like 👍 lần 1
      console.log('\n--- Thả 👍 lần 1 ---');
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsgId}', '👍')`
      });
      await new Promise(r => setTimeout(r, 1500));
      shot = await send('Page.captureScreenshot');
      fs.writeFileSync('scripts/chat_after_like1.png', Buffer.from(shot.data, 'base64'));

      // Kiểm tra reaction
      let res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const m = prov.d.find(x => x.a === '${targetMsgId}');
            return m && m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : {};
          })()
        `,
        returnByValue: true
      });
      console.log('Reactions sau lần 1 (Mong đợi có 👍):', res.result.value);

      // 2. Thả like 👍 lần 2 -> HỦY CẢM XÚC
      console.log('\n--- Thả 👍 lần 2 (HỦY CẢM XÚC) ---');
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsgId}', '👍')`
      });
      await new Promise(r => setTimeout(r, 1500));
      shot = await send('Page.captureScreenshot');
      fs.writeFileSync('scripts/chat_after_like2_cancelled.png', Buffer.from(shot.data, 'base64'));

      res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const m = prov.d.find(x => x.a === '${targetMsgId}');
            return m && m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : {};
          })()
        `,
        returnByValue: true
      });
      console.log('Reactions sau lần 2 (Mong đợi ĐÃ HỦY - rỗng):', res.result.value);

      // 3. Thả icon tim ❤️
      console.log('\n--- Thả ❤️ ---');
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsgId}', '❤️')`
      });
      await new Promise(r => setTimeout(r, 1500));
      res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const m = prov.d.find(x => x.a === '${targetMsgId}');
            return m && m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : {};
          })()
        `,
        returnByValue: true
      });
      console.log('Reactions sau thả ❤️ (Mong đợi có ❤️):', res.result.value);

      // 4. Đổi sang like 👍
      console.log('\n--- Đang có ❤️, đổi sang 👍 ---');
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsgId}', '👍')`
      });
      await new Promise(r => setTimeout(r, 1500));
      res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const m = prov.d.find(x => x.a === '${targetMsgId}');
            return m && m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : {};
          })()
        `,
        returnByValue: true
      });
      console.log('Reactions sau đổi sang 👍 (Mong đợi chuyển sang 👍):', res.result.value);

      // 5. Thả like 👍 lại lần nữa -> HỦY CẢM XÚC
      console.log('\n--- Thả 👍 lần nữa để HỦY ---');
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsgId}', '👍')`
      });
      await new Promise(r => setTimeout(r, 1500));
      res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
            const m = prov.d.find(x => x.a === '${targetMsgId}');
            return m && m.Q ? Object.fromEntries(m.Q.entries ? m.Q.entries() : []) : {};
          })()
        `,
        returnByValue: true
      });
      console.log('Reactions sau lần hủy cuối (Mong đợi ĐÃ HỦY - rỗng):', res.result.value);
      shot = await send('Page.captureScreenshot');
      fs.writeFileSync('scripts/chat_final_verified.png', Buffer.from(shot.data, 'base64'));
    }

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
