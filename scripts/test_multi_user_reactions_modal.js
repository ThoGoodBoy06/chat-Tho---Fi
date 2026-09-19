const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const userIdA = 'efe1bee5-f9df-46ce-83b6-50127a2334bd'; // Minh Khang (Bạn)
const tokenA = jwt.sign({ userId: userIdA, id: userIdA }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

const userIdB = '9b21bd4e-657d-471d-b71d-147d9eacf64b'; // Thanh Tho

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
  const port = 9340;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=450,900',
    `--user-data-dir=C:\\temp\\chrome_multi_react_${Date.now()}`,
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
            localStorage.setItem('flutter.authToken', JSON.stringify('${tokenA}'));
            localStorage.setItem('authToken', '${tokenA}');
            localStorage.setItem('flutter.userId', JSON.stringify('${userIdA}'));
            localStorage.setItem('userId', '${userIdA}');
          `
        });
        await send('Page.navigate', { url: 'http://localhost:3000' });
        resolve();
      };
    });

    console.log('Chờ 8s cho app khởi động...');
    await new Promise(r => setTimeout(r, 8000));

    const testMsgId = '919c4834-9efa-45e7-9a9a-698ae54dc16e';

    // Thiết lập cả 2 người cùng thả cảm xúc vào DB
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.messages.update({
      where: { id: testMsgId },
      data: {
        reactions: JSON.stringify({
          [userIdA]: '👍',
          [userIdB]: '❤️'
        })
      }
    });

    console.log('1. Đã gán 2 cảm xúc vào tin nhắn: Minh Khang (👍) & Thanh Tho (❤️)');

    // 2. Mở Modal chi tiết cảm xúc
    console.log('2. Mở Modal chi tiết cảm xúc...');
    await send('Runtime.evaluate', {
      expression: `window.showReactionDetailsModal({ '${userIdA}': '👍', '${userIdB}': '❤️' }, '${testMsgId}')`
    });

    await new Promise(r => setTimeout(r, 1200));

    // Kiểm tra DOM của Modal
    const domCheck = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.getElementById('reactionDetailsModal');
          if (!modal) return { found: false };
          const tabs = Array.from(modal.querySelectorAll('#reactionFilterTabs button')).map(b => b.innerText);
          const users = Array.from(modal.querySelectorAll('#reactionUsersList > div')).map(row => {
            const name = row.querySelector('div:nth-child(2) > div:first-child')?.innerText || '';
            const btn = row.querySelector('button')?.innerText || null;
            return { name: name, btn: btn };
          });
          return {
            found: true,
            tabs: tabs,
            users: users
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Check với 2 người:', JSON.stringify(domCheck.result.value, null, 2));

    let shot = await send('Page.captureScreenshot');
    const artifactPath = 'C:\\Users\\MSI PC\\.gemini\\antigravity-ide\\brain\\5e073b1b-93f2-4218-8a28-13bec30963db\\multi_user_reactions_modal_verified.png';
    fs.writeFileSync('scripts/multi_user_reactions_modal_verified.png', Buffer.from(shot.data, 'base64'));
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu multi_user_reactions_modal_verified.png');

    // 3. Bấm nút "Gỡ" của "Bạn"
    console.log('3. Nhấn nút Gỡ cảm xúc của Bạn...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const removeBtn = document.querySelector('#reactionUsersList button');
          if (removeBtn) removeBtn.click();
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1500));

    // Kiểm tra lại DOM xem chỉ còn lại Thanh Tho không
    const domCheckAfter = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const modal = document.getElementById('reactionDetailsModal');
          if (!modal) return { found: false };
          const users = Array.from(modal.querySelectorAll('#reactionUsersList > div')).map(row => {
            const name = row.querySelector('div:nth-child(2) > div:first-child')?.innerText || '';
            const btn = row.querySelector('button')?.innerText || null;
            return { name: name, btn: btn };
          });
          return {
            found: true,
            users: users
          };
        })()
      `,
      returnByValue: true
    });
    console.log('DOM Check sau khi gỡ Bạn:', JSON.stringify(domCheckAfter.result.value, null, 2));

    shot = await send('Page.captureScreenshot');
    fs.writeFileSync('scripts/multi_user_after_remove_one.png', Buffer.from(shot.data, 'base64'));
    console.log('📸 Đã lưu scripts/multi_user_after_remove_one.png');

    // Dọn dẹp DB
    await prisma.messages.update({
      where: { id: testMsgId },
      data: { reactions: '{}' }
    });

  } finally {
    chromeProcess.kill();
  }
}

run().catch(console.error);
