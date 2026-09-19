const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userId = 'efe1bee5-f9df-46ce-83b6-50127a2334bd';
const token = jwt.sign({ userId, id: userId }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9333',
    '--no-sandbox',
    '--disable-gpu',
    '--user-data-dir=C:\\temp\\chrome_debug_' + Date.now(),
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const listRes = await fetch('http://127.0.0.1:9333/json/list');
    const tabs = await listRes.json();
    console.log('Found tabs:', tabs.length);
    const wsUrl = tabs[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return msgId;
    };

    ws.onopen = async () => {
      send('Runtime.enable');
      send('Log.enable');
      send('Page.enable');

      // Set localStorage token before loading
      send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          localStorage.setItem("flutter.authToken", JSON.stringify("${token}"));
          localStorage.setItem("authToken", "${token}");
          localStorage.setItem("flutter.userId", JSON.stringify("${userId}"));
          localStorage.setItem("userId", "${userId}");
        `
      });

      send('Page.navigate', { url: 'http://localhost:3000' });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params.type;
        const text = data.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
        console.log(`[Browser ${type.toUpperCase()}]:`, text);
      } else if (data.method === 'Runtime.exceptionThrown') {
        console.error('[Browser Exception]:', JSON.stringify(data.params.exceptionDetails));
      }
    };

    // Wait 10s and inspect
    await new Promise(r => setTimeout(r, 10000));
    ws.close();
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    chrome.kill();
    process.exit(0);
  }
}

main();
