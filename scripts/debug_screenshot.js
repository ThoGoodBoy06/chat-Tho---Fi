const { spawn } = require('child_process');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9444',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    '--user-data-dir=C:\\temp\\chrome_shot_' + Date.now(),
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const listRes = await fetch('http://127.0.0.1:9444/json/list');
  const tabs = await listRes.json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => {
    const msgId = id++;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve) => {
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
    });
  };

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
  };

  await new Promise(r => setTimeout(r, 7000));

  // Take screenshot 1 (home screen)
  const shot1 = await send('Page.captureScreenshot');
  fs.writeFileSync('scripts/home_screen.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved scripts/home_screen.png');

  // Let's inspect active Flutter state
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (function() {
        return {
          title: document.title,
          activeConvId: $._currentActiveChatConvId,
          hasActiveChat: !!$._activeChatScreenState,
          localStorageKeys: Object.keys(localStorage)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Eval:', JSON.stringify(evalRes.result ? evalRes.result.value : null));

  ws.close();
  chrome.kill();
}

main().catch(console.error);
