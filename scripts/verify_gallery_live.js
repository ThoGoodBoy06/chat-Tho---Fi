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
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      }).on('error', (err) => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(err);
        }
      });
    }, 500);
  });
}

async function run() {
  const port = 9232;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=500,900',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    let id = 1;
    const callbacks = {};

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && callbacks[data.id]) {
        callbacks[data.id](data.result);
        delete callbacks[data.id];
      }
    };

    const send = (method, params = {}) => {
      const msgId = id++;
      return new Promise((res) => {
        callbacks[msgId] = res;
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    await new Promise((res) => {
      ws.onopen = async () => {
        await send('Runtime.enable');
        await send('Page.enable');
        await send('Network.enable');
        await send('Network.setCacheDisabled', { cacheDisabled: true });
        await send('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            localStorage.setItem('flutter.authToken', JSON.stringify('${token}'));
            localStorage.setItem('authToken', '${token}');
            localStorage.setItem('flutter.userId', JSON.stringify('${userId}'));
            localStorage.setItem('userId', '${userId}');
          `
        });
        await send('Page.navigate', { url: 'http://localhost:3000' });
        res();
      };
    });

    console.log('Waiting 8s for app to load...');
    await new Promise(r => setTimeout(r, 8000));

    // Click on chat item
    console.log('Clicking on conversation item...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 250, y: 250, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 250, y: 250, button: 'left', clickCount: 1 });

    console.log('Waiting 6s for conversation messages to load...');
    await new Promise(r => setTimeout(r, 6000));

    // Test getImagesFromActiveConversation
    const testResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          var convId = window._currentActiveChatConvId;
          var convImages = [];
          if (typeof getImagesFromActiveConversation === 'function') {
            convImages = getImagesFromActiveConversation();
          }
          return {
            hasProv: !!prov,
            messagesTotal: prov && prov.d ? prov.d.length : 0,
            convId: convId,
            convImagesCount: convImages.length,
            sampleImages: convImages.slice(0, 3)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Provider & Conversation images test:', JSON.stringify(testResult.result.value, null, 2));

    // Now test calling openImageModal directly with an image URL
    const openModalResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          var sampleImg = '';
          if (prov && prov.d) {
            for (var i = 0; i < prov.d.length; i++) {
              var m = prov.d[i];
              if (m && (m.imageUrl || m.f || m.content)) {
                var u = m.imageUrl || m.f || m.content;
                if (typeof u === 'string' && (u.includes('.jpg') || u.includes('.png') || u.includes('data:image'))) {
                  sampleImg = u;
                  break;
                }
              }
            }
          }
          if (sampleImg && window.openImageModal) {
            window.openImageModal(sampleImg);
          }
          var modal = document.getElementById('globalAlbumGalleryModal');
          var counter = document.getElementById('galleryCounterText');
          return {
            sampleImgFound: !!sampleImg,
            modalOpen: !!modal,
            counter: counter ? counter.textContent : 'none'
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Direct openImageModal result:', JSON.stringify(openModalResult.result.value, null, 2));

    const shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_modal_screenshot.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot to scripts/test_modal_screenshot.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
