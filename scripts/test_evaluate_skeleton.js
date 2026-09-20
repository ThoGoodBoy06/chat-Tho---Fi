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
  const port = 9253;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=504,804',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = {};

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        pending[msgId] = resolve;
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending[data.id]) {
        pending[data.id](data.result);
        delete pending[data.id];
      }
    };

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');

    console.log('Chờ 5s cho app Flutter nạp...');
    await new Promise(r => setTimeout(r, 5000));

    // Evaluate A.aSkList in browser
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          try {
            var contacts = A.aSkList("contacts", false);
            var chats = A.aSkList("chats", true);
            var reqs = A.aSkList("requests", false);
            var prof = A.aSkList("profile", true);
            return {
              success: true,
              contactsType: contacts ? contacts.constructor.name : 'null',
              chatsType: chats ? chats.constructor.name : 'null',
              reqsType: reqs ? reqs.constructor.name : 'null',
              profType: prof ? prof.constructor.name : 'null'
            };
          } catch(e) {
            return { success: false, error: e.toString(), stack: e.stack };
          }
        })()
      `,
      returnByValue: true
    });

    console.log('Result from Runtime.evaluate:', JSON.stringify(evalRes.result.value, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
  }
}

run();
