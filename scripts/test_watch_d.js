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
          reject(new Error(`Failed to connect to CDP port ${port}`));
        }
      });
    }, 500);
  });
}

async function main() {
  const port = 9999;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_watch_${Date.now()}`,
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
        if (text.includes('[WATCH]') || text.includes('error') || text.includes('Error') || text.includes('Socket')) {
          console.log(`[Browser Console]:`, text);
        }
      }
    };

    await new Promise(r => setTimeout(r, 8000));

    // Click on conversation list item "Thanh Tho" at (200, 300)
    console.log('Opening chat...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 4000));

    // Setup watcher on prov.d
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          if (!prov) return console.log('[WATCH] No provider');
          console.log('[WATCH] Hooking prov.d. Initial length = ' + prov.d.length);

          // Wrap .splice
          var origSplice = prov.d.splice;
          prov.d.splice = function(start, deleteCount) {
            console.log('[WATCH] splice called! start=' + start + ', deleteCount=' + deleteCount + ', length before=' + this.length + ', stack:\\n' + new Error().stack);
            return origSplice.apply(this, arguments);
          };

          // Watch prov.d property reassignment
          var _internalD = prov.d;
          Object.defineProperty(prov, 'd', {
            get: function() { return _internalD; },
            set: function(val) {
              console.log('[WATCH] prov.d REASSIGNED! Old length=' + (_internalD ? _internalD.length : 'null') + ', New length=' + (val ? val.length : 'null') + ', stack:\\n' + new Error().stack);
              _internalD = val;
            },
            configurable: true
          });
        })()
      `,
      returnByValue: true
    });

    // Send image
    console.log('Sending test image...');
    await send('Runtime.evaluate', {
      expression: `
        (async function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          var base64Img = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
          var res = await fetch(base64Img);
          var blob = await res.blob();
          var file = new File([blob], "watch_image.jpg", { type: "image/jpeg" });

          var reader = new FileReader();
          reader.readAsArrayBuffer(file);
          var avr = new A.avr(reader, prov.c, file, prov);

          reader.onloadend = async function() {
            console.log('[WATCH] calling avr.$1...');
            try {
              await avr.$1(reader);
              console.log('[WATCH] avr.$1 call returned');
            } catch(e) {
              console.error('[WATCH] avr.$1 threw:', e);
            }
          };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });

    await new Promise(r => setTimeout(r, 6000));
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

main();
