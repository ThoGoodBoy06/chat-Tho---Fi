const { spawn } = require('child_process');
const http = require('http');

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

async function test() {
  const port = 9365;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    let id = 1;
    const send = (method, params = {}) => ws.send(JSON.stringify({ id: id++, method, params }));

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[Console]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[EXCEPTION]', JSON.stringify(data.params.exceptionDetails));
      }
    };

    await new Promise((resolve) => {
      ws.onopen = async () => {
        send('Runtime.enable');
        send('Page.enable');
        send('Network.enable');
        send('Page.navigate', { url: 'http://localhost:3000' });
        resolve();
      };
    });

    console.log('Đang quan sát console trình duyệt trong 8 giây...');
    await new Promise(r => setTimeout(r, 8000));
  } finally {
    chrome.kill();
  }
}
test().catch(console.error);
