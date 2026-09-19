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

async function main() {
  const port = 9777;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_trig_${Date.now()}`,
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
      } else if (data.method === 'Runtime.exceptionThrown') {
        console.error(`[Browser Exception]:`, JSON.stringify(data.params.exceptionDetails));
      }
    };

    console.log('Waiting 8s for Flutter app to initialize...');
    await new Promise(r => setTimeout(r, 8000));

    // Click on conversation list item "Thanh Tho" at (200, 300)
    console.log('Clicking on Thanh Tho at (200, 300)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 4000));

    // Screenshot BEFORE sending
    const beforeShot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/before_send.png', Buffer.from(beforeShot.data, 'base64'));
    console.log('Saved scripts/before_send.png');

    // Trigger image send in browser
    console.log('Triggering send image...');
    const triggerRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          if (!prov) {
            var state = window._activeChatScreenState || $._activeChatScreenState;
            if (state) {
              for (var k in state) {
                if (state[k] && state[k].d && Array.isArray(state[k].d)) {
                  prov = state[k];
                  break;
                }
              }
            }
          }
          if (!prov) return { error: 'No provider found' };

          // Create a 1x1 test red JPEG image Blob
          var base64Img = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
          var res = await fetch(base64Img);
          var blob = await res.blob();
          var file = new File([blob], "test_image.jpg", { type: "image/jpeg" });

          var reader = new FileReader();
          reader.readAsArrayBuffer(file);
          var avr = new A.avr(reader, prov.c, file, prov);
          reader.onloadend = function() {
            try {
              avr.$1(reader);
            } catch(err) {
              console.error('Error invoking avr.$1:', err);
            }
          };

          return { success: true, initialMsgCount: prov.d.length };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Trigger result:', triggerRes.result ? triggerRes.result.value : null);

    // Wait 1.5s (optimistic sending state)
    await new Promise(r => setTimeout(r, 1500));
    const sendingShot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/during_send.png', Buffer.from(sendingShot.data, 'base64'));
    console.log('Saved scripts/during_send.png');

    // Wait 5s (upload finished state)
    await new Promise(r => setTimeout(r, 5000));
    const afterShot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/after_send.png', Buffer.from(afterShot.data, 'base64'));
    console.log('Saved scripts/after_send.png');

    const finalState = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          if (!prov) return null;
          return {
            msgCount: prov.d.length,
            last5: prov.d.slice(-5).map(function(m) {
              return { id: m.a, status: m.status, type: m.d, content: (m.e||'').substring(0, 30) };
            })
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Final state:', JSON.stringify(finalState.result ? finalState.result.value : null, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

main();
