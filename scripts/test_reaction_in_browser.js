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
  const port = 9270;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    'http://localhost:3000'
  ]);

  try {
    const tabs = await waitForJson(port);
    const targetTab = tabs.find(t => t.url.includes('3000')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = {};
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
      }
      if (data.id && pending[data.id]) {
        pending[data.id](data.result);
        delete pending[data.id];
      }
    };

    const send = (method, params = {}) => {
      const msgId = id++;
      return new Promise((resolve) => {
        pending[msgId] = resolve;
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    };

    await new Promise((resolve) => {
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
        resolve();
      };
    });

    console.log('Chờ 6s cho app Flutter nạp...');
    await new Promise(r => setTimeout(r, 6000));

    // 1. Kiểm tra hàm window.reactToMessage có sẵn không
    const checkFn = await send('Runtime.evaluate', {
      expression: `typeof window.reactToMessage === 'function'`,
      returnByValue: true
    });
    console.log('window.reactToMessage available:', checkFn.result.value);

    // 2. Mở một hình ảnh thông qua openAlbumGalleryModal
    const sampleImg = 'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/177cd118-15e4-4125-8758-0a715b51acdc-z7944974787687_ba06a45bba872b60228fca7869a23cd6_-_Copy.jpg';
    const openRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof window.openImageModal === 'function') {
            window.openImageModal('${sampleImg}');
            return { opened: true };
          }
          return { error: 'No openImageModal' };
        })()
      `,
      returnByValue: true
    });
    console.log('Open image modal result:', JSON.stringify(openRes.result.value, null, 2));

    await new Promise(r => setTimeout(r, 1500));

    // Chụp ảnh xem modal mở lên có nút Thả cảm xúc không
    let shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_gallery_with_reaction_btn.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/test_gallery_with_reaction_btn.png');

    // 3. Click vào nút "❤️ Thả cảm xúc" để mở bảng emoji
    const clickReactBtn = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('galleryReactBtn');
          if (btn) {
            btn.click();
            const bar = document.getElementById('galleryReactionRow');
            return { clicked: true, barDisplay: bar ? bar.style.display : null };
          }
          return { error: 'No galleryReactBtn' };
        })()
      `,
      returnByValue: true
    });
    console.log('Click galleryReactBtn result:', JSON.stringify(clickReactBtn.result.value, null, 2));

    await new Promise(r => setTimeout(r, 800));

    // Chụp ảnh xem bảng emoji đã hiện lên chưa
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/test_gallery_emoji_bar_opened.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/test_gallery_emoji_bar_opened.png');

    // 4. Click chọn emoji ❤️ trong bảng emoji
    const clickEmoji = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bar = document.getElementById('galleryReactionRow');
          if (bar) {
            const firstEmoji = bar.querySelector('span');
            if (firstEmoji) {
              firstEmoji.click();
              return { clickedEmoji: firstEmoji.textContent };
            }
          }
          return { error: 'No emoji span' };
        })()
      `,
      returnByValue: true
    });
    console.log('Click emoji result:', JSON.stringify(clickEmoji.result.value, null, 2));

    await new Promise(r => setTimeout(r, 1000));

    // 5. Kiểm tra DB xem message đã được lưu reactions chưa
    const checkDbMsg = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const token = localStorage.getItem('authToken');
          // Gọi API lấy tin nhắn của conv 8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0
          try {
            const res = await fetch('/api/chat/conversations/8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0/messages', {
              headers: { 'Authorization': 'Bearer ' + token }
            });
            const d = await res.json();
            const msgs = d.data || d.messages || [];
            const reacted = msgs.filter(m => m.reactions && Object.keys(m.reactions).length > 0);
            return {
              total: msgs.length,
              reactedCount: reacted.length,
              reactedSample: reacted.slice(0, 2).map(m => ({ id: m.id, reactions: m.reactions, type: m.type }))
            };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('DB messages reaction check:', JSON.stringify(checkDbMsg.result.value, null, 2));

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
