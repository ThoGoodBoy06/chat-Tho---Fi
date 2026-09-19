const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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
          reject(new Error(`Failed to connect to CDP port ${port}`));
        }
      });
    }, 500);
  });
}

async function run() {
  const port = 9380;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  // Mở browser bình thường, không inject token trước, để xem người dùng thấy gì!
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    `--user-data-dir=C:\\temp\\chrome_user_entry_${Date.now()}`,
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
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]', JSON.stringify(data.params.exceptionDetails));
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
        await send('Page.navigate', { url: 'http://localhost:3000' });
        resolve();
      };
    });

    console.log('Chờ 10s cho trang web nạp...');
    await new Promise(r => setTimeout(r, 10000));

    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/user_screen_what_they_see.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/user_screen_what_they_see.png');

    // Đánh giá DOM hiện tại
    const domEval = await send('Runtime.evaluate', {
      expression: `
        ({
          title: document.title,
          bodyText: document.body.innerText ? document.body.innerText.substring(0, 200) : '',
          flutterInitialized: !!window._flutter,
          hasFlutterCanvas: !!document.querySelector('flutter-view, canvas, flt-glass-pane')
        })
      `,
      returnByValue: true
    });
    console.log('DOM Evaluation:', domEval.result.value);

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
