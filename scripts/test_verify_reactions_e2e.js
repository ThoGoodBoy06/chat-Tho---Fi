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
  const port = 9275;
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

    // 1. Lấy danh sách tin nhắn hiện tại từ API
    const msgsRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const res = await fetch('/api/chat/8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0/messages', {
            headers: { 'Authorization': 'Bearer ' + '${token}' }
          });
          const d = await res.json();
          const msgs = d.data || d.messages || [];
          return msgs.map(m => ({ id: m.id, type: m.type, content: m.content?.slice(0, 30), reactions: m.reactions }));
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Tổng số tin nhắn trong hội thoại:', msgsRes.result.value?.length);
    const messages = msgsRes.result.value || [];
    const targetMsg = messages[messages.length - 1];
    console.log('Tin nhắn mục tiêu để test reaction:', targetMsg);

    // 2. Thử thả cảm xúc ❤️ qua window.reactToMessage
    if (targetMsg) {
      console.log(`Đang thả cảm xúc ❤️ vào tin nhắn: ${targetMsg.id}...`);
      await send('Runtime.evaluate', {
        expression: `window.reactToMessage('${targetMsg.id}', '❤️')`,
        returnByValue: true
      });
      await new Promise(r => setTimeout(r, 1200));

      // Kiểm tra lại API xem tin nhắn đã có reaction chưa
      const verifyRes = await send('Runtime.evaluate', {
        expression: `
          (async () => {
            const res = await fetch('/api/chat/8b9b9cbe-fbff-413a-82a2-2c1fc1e38fc0/messages', {
              headers: { 'Authorization': 'Bearer ' + '${token}' }
            });
            const d = await res.json();
            const msgs = d.data || d.messages || [];
            const m = msgs.find(x => x.id === '${targetMsg.id}');
            return m ? { id: m.id, reactions: m.reactions } : null;
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('Kết quả kiểm tra DB sau khi thả tim:', JSON.stringify(verifyRes.result.value, null, 2));
    }

    // 3. Test mở Gallery ảnh và thả cảm xúc từ Gallery Lightbox
    const sampleImg = 'https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/177cd118-15e4-4125-8758-0a715b51acdc-z7944974787687_ba06a45bba872b60228fca7869a23cd6_-_Copy.jpg';
    await send('Runtime.evaluate', {
      expression: `window.openImageModal('${sampleImg}')`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));

    // Mở emoji bar trong gallery
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('galleryReactBtn');
          if (btn) btn.click();
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 600));

    // Chụp ảnh gallery với bảng emoji đang mở
    let shot = await send('Page.captureScreenshot');
    const artifactDir = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db';
    fs.writeFileSync(`${artifactDir}/gallery_reaction_palette.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu gallery_reaction_palette.png vào artifacts!');

    // Click chọn emoji 😆 trong gallery
    const clickEmojiRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const bar = document.getElementById('galleryReactionRow');
          if (bar) {
            const spans = bar.querySelectorAll('span');
            if (spans.length >= 2) {
              spans[1].click(); // 😆
              return { clicked: spans[1].textContent };
            }
          }
          return { error: 'No span' };
        })()
      `,
      returnByValue: true
    });
    console.log('Click emoji trong gallery:', JSON.stringify(clickEmojiRes.result.value));
    await new Promise(r => setTimeout(r, 1200));

    // Đóng modal
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const m = document.getElementById('globalAlbumGalleryModal');
          if (m) m.remove();
        })()
      `,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));

    // Chụp lại ảnh màn hình cuộc trò chuyện
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync(`${artifactDir}/chat_reactions_verified.png`, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu chat_reactions_verified.png vào artifacts!');

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
