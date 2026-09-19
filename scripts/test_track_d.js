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
  const port = 9888;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    `--user-data-dir=C:\\temp\\chrome_track_${Date.now()}`,
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

    // Click on conversation list item "Thanh Tho" at (200, 300)
    console.log('Clicking on Thanh Tho at (200, 300)...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });

    await new Promise(r => setTimeout(r, 4000));

    // Track prov.d before and after
    console.log('Tracking prov.d...');
    const trackRes = await send('Runtime.evaluate', {
      expression: `
        (async function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          if (!prov) return { error: 'No provider' };
          console.log('[TRACK] Step 1: prov.d.length before = ' + prov.d.length);

          // Let's hook into prov.d or watch changes to prov.d
          var originalD = prov.d;
          console.log('[TRACK] originalD length = ' + originalD.length);

          // Create test image
          var base64Img = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
          var res = await fetch(base64Img);
          var blob = await res.blob();
          var file = new File([blob], "track_image.jpg", { type: "image/jpeg" });

          var reader = new FileReader();
          reader.readAsArrayBuffer(file);
          var avr = new A.avr(reader, prov.c, file, prov);

          reader.onloadend = async function() {
            console.log('[TRACK] onloadend fired, prov.d.length = ' + prov.d.length);
            await avr.$1(reader);
            console.log('[TRACK] avr.$1 finished, prov.d.length = ' + prov.d.length);
            console.log('[TRACK] Is prov.d still === originalD? ' + (prov.d === originalD));
          };

          return { success: true };
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Track setup:', trackRes.result ? trackRes.result.value : null);

    // Wait 6 seconds
    await new Promise(r => setTimeout(r, 6000));

    const finalRes = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var prov = window._activeChatProvider || $._activeChatProvider;
          return {
            msgCount: prov.d.length,
            msgs: prov.d.map(function(m) { return { id: m.a, type: m.d, status: m.status }; })
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Final tracked state:', JSON.stringify(finalRes.result ? finalRes.result.value : null, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chrome.kill();
  }
}

main();
