const { spawn } = require('child_process');
const http = require('http');
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
          reject(new Error(`Failed to connect to CDP port ${port} after ${maxAttempts} attempts`));
        }
      });
    }, 500);
  });
}

async function main() {
  const port = 9555;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_inspect_${Date.now()}`,
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

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

    await new Promise((resolve) => {
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
        resolve();
      };
    });

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
        console.log(`[Browser Console]:`, text);
      }
    };

    console.log('Waiting 8s for Flutter app to initialize...');
    await new Promise(r => setTimeout(r, 8000));

    const shot = await send('Page.captureScreenshot');
    const fs = require('fs');
    fs.writeFileSync('scripts/current_view.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to scripts/current_view.png');

    // Inspect window and flutter objects
    const stateRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var res = {
            hasActiveChatState: !!window._activeChatScreenState,
            currentActiveChatConvId: window._currentActiveChatConvId,
            chatScreenContext: !!window._chatScreenContext
          };
          return res;
        })()
      `,
      returnByValue: true
    });
    console.log('App state before select:', stateRes.result.value);

    // Let's programmatically select the conversation through Flutter state if possible
    const selectRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          // Let's find ChatProvider in the active scope or triggers
          // In Flutter web, let's click at conversation 1 position (x: 250, y: 150)
          return { ready: true };
        })()
      `,
      returnByValue: true
    });

    // Click on conversation list item "Thanh Tho" at (200, 300)
    console.log('Clicking on Thanh Tho at (200, 300)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 4000));

    const chatShot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/chat_view.png', Buffer.from(chatShot.data, 'base64'));
    console.log('Screenshot saved to scripts/chat_view.png');

    const afterClickRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var state = window._activeChatScreenState || $._activeChatScreenState;
          if (!state) return { activeChat: false };
          var prov = null;
          for (var k in state) {
            if (state[k] && state[k].d && Array.isArray(state[k].d)) {
              prov = state[k];
              break;
            }
          }
          if (!prov) return { activeChat: true, providerFound: false };
          return {
            activeChat: true,
            providerFound: true,
            convId: (prov.c ? prov.c.a : null),
            messageCount: prov.d.length,
            messages: prov.d.map(function(m) {
              return {
                id: m.a,
                sender: m.c,
                type: m.d,
                status: m.status,
                content: (m.e || '').substring(0, 30)
              };
            })
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After click state:', JSON.stringify(afterClickRes.result ? afterClickRes.result.value : null, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

main();
