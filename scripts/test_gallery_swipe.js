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

async function run() {
  const port = 9229;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=420,850',
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

    console.log('Waiting 8s for Flutter app to initialize...');
    await new Promise(r => setTimeout(r, 8000));

    // Open chat
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 4000));

    // Click on the image in the chat (around x=300, y=300)
    console.log('Clicking on image in chat to open gallery...');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 300, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 300, y: 300, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1500));

    // Inspect modal state in browser
    const modalState = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var modal = document.getElementById('globalAlbumGalleryModal');
          if (!modal) return { open: false };
          var track = document.getElementById('galleryTrack');
          var slides = track ? track.querySelectorAll('.gallery-slide') : [];
          var counter = document.getElementById('galleryCounterText');
          return {
            open: true,
            slideCount: slides.length,
            counterText: counter ? counter.textContent : '',
            scrollLeft: track ? track.scrollLeft : 0
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal State:', JSON.stringify(modalState.result.value, null, 2));

    const shot1 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/gallery_opened.png', Buffer.from(shot1.data, 'base64'));
    console.log('Saved scripts/gallery_opened.png');

    // Simulate drag / swipe to next slide
    console.log('Simulating swipe / next navigation...');
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          var track = document.getElementById('galleryTrack');
          if (track) {
            track.scrollBy({ left: window.innerWidth, behavior: 'instant' });
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 800));

    const modalStateAfter = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var track = document.getElementById('galleryTrack');
          var counter = document.getElementById('galleryCounterText');
          return {
            counterText: counter ? counter.textContent : '',
            scrollLeft: track ? track.scrollLeft : 0
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After Swipe State:', JSON.stringify(modalStateAfter.result.value, null, 2));

    const shot2 = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/gallery_swiped.png', Buffer.from(shot2.data, 'base64'));
    console.log('Saved scripts/gallery_swiped.png');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
