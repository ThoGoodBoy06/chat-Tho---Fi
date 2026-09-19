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
    '--window-size=1280,800',
    '--user-data-dir=C:\\temp\\chrome_debug_' + Date.now(),
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9333/json/list');
    const tabs = await listRes.json();
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const send = (method, params = {}) => {
      const msgId = id++;
      ws.send(JSON.stringify({ id: msgId, method, params }));
      return msgId;
    };

    const evaluate = (expression) => {
      return new Promise((resolve) => {
        const msgId = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(data.result ? data.result.result : null);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    ws.onopen = async () => {
      send('Runtime.enable');
      send('Log.enable');
      send('Page.enable');

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

    console.log('Waiting for Flutter web to load...');
    await new Promise(r => setTimeout(r, 6000));

    // Click at (200, 150) where conversation item is
    send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 250, y: 140, button: 'left', clickCount: 1 });
    send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 250, y: 140, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 3000));

    const checkChat = await evaluate(`
      (function() {
        var state = $._activeChatScreenState;
        if (!state) return { activeChat: false };
        var prov = null;
        for (var k in state) {
          if (state[k] && state[k].d && Array.isArray(state[k].d)) {
            prov = state[k];
            break;
          }
        }
        var msgCount = prov ? prov.d.length : 'unknown';
        var msgsSummary = prov ? prov.d.map(function(m) { return { id: m.a, type: m.d, status: m.status, content: (m.e||'').substring(0, 30) }; }) : [];
        return {
          activeChat: true,
          convId: $._currentActiveChatConvId,
          msgCount: msgCount,
          msgs: msgsSummary
        };
      })()
    `);
    console.log('Chat state after click:', JSON.stringify(checkChat ? checkChat.value : null, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error in reproduce_bug:', err);
  } finally {
    chrome.kill();
    process.exit(0);
  }
}

main();
