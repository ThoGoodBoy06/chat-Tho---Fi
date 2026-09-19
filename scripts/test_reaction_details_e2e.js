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
  const port = 9330;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    `--user-data-dir=C:\\temp\\chrome_reaction_details_${Date.now()}`,
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

    console.log('Chờ 8s cho app khởi động...');
    await new Promise(r => setTimeout(r, 8000));

    const testMsgId = '919c4834-9efa-45e7-9a9a-698ae54dc16e';

    // 1. Đảm bảo tin nhắn đang có cảm xúc 👍
    console.log('1. Đặt cảm xúc 👍 cho tin nhắn thử nghiệm...');
    await send('Runtime.evaluate', {
      expression: `
        fetch('/api/chat/messages/${encodeURIComponent(testMsgId)}/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${token}'
          },
          body: JSON.stringify({ reaction: '👍', action: 'add' })
        }).then(r => r.json())
      `,
      awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 1000));

    // 2. Kích hoạt Modal chi tiết cảm xúc
    console.log('2. Mở Modal chi tiết cảm xúc...');
    const openRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          if (typeof window.showReactionDetailsModal === 'function') {
            window.showReactionDetailsModal({ '${userId}': '👍' }, '${testMsgId}');
            return { opened: true };
          }
          return { error: 'showReactionDetailsModal not defined' };
        })()
      `,
      returnByValue: true
    });
    console.log('Modal open result:', openRes.result.value);

    await new Promise(r => setTimeout(r, 1200));

    // Kiểm tra DOM của Modal
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.getElementById('reactionDetailsModal');
          if (!modal) return { found: false };
          const title = modal.querySelector('div')?.innerText;
          const tabs = Array.from(modal.querySelectorAll('#reactionFilterTabs button')).map(b => b.innerText);
          const users = Array.from(modal.querySelectorAll('#reactionUsersList > div')).map(row => {
            const name = row.querySelector('div:nth-child(2) > div:first-child')?.innerText || row.innerText;
            const btn = row.querySelector('button')?.innerText;
            return { text: name, hasRemoveBtn: !!btn, btnText: btn };
          });
          return {
            found: true,
            title: title,
            tabs: tabs,
            users: users
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Check của Modal:', JSON.stringify(domCheck.result.value, null, 2));

    // Chụp ảnh Modal chi tiết cảm xúc
    let shot = await send('Page.captureScreenshot');
    const artifactPath = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db\\reaction_details_modal_verified.png';
    fs.writeFileSync('scripts/reaction_details_modal_verified.png', Buffer.from(shot.data, 'base64'));
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu reaction_details_modal_verified.png');

    // 3. Bấm nút "Gỡ" bên trong modal
    console.log('3. Nhấn nút "Gỡ" bên trong modal để gỡ cảm xúc...');
    const clickRemove = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const removeBtn = document.querySelector('#reactionUsersList button');
          if (!removeBtn) return { clicked: false, error: 'No remove button' };
          removeBtn.click();
          return { clicked: true, text: removeBtn.innerText };
        })()
      `,
      returnByValue: true
    });
    console.log('Click remove result:', clickRemove.result.value);

    await new Promise(r => setTimeout(r, 1500));

    // Chụp ảnh sau khi gỡ
    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/reaction_after_removed_modal.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/reaction_after_removed_modal.png');

    // 4. Xác minh trong DB cảm xúc đã bị gỡ
    const dbCheck = await send('Runtime.evaluate', {
      expression: `
        fetch('/api/chat/messages/${encodeURIComponent(testMsgId)}/reactions', {
          headers: { 'Authorization': 'Bearer ${token}' }
        }).then(r => r.json())
      `,
      awaitPromise: true
    });
    console.log('DB Check sau khi gỡ:', JSON.stringify(dbCheck.result.value, null, 2));

    if (
      domCheck.result.value.found &&
      clickRemove.result.value.clicked &&
      dbCheck.result.value.total === 0
    ) {
      console.log('\n🎉 TOÀN BỘ TÍNH NĂNG XEM CHI TIẾT CẢM XÚC & NÚT GỠ ĐÃ HOẠT ĐỘNG HOÀN HẢO 100%!');
    } else {
      console.error('\n❌ Có điểm chưa đạt yêu cầu!');
    }

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
