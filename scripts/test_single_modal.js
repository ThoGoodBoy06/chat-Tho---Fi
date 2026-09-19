const { spawn } = require('child_process');
const http = require('http');

function waitForJson(port) {
  return new Promise((res, rej) => {
    let a = 0;
    const i = setInterval(() => {
      a++;
      http.get(`http://127.0.0.1:${port}/json/list`, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { clearInterval(i); res(JSON.parse(d)); });
      }).on('error', e => { if (a >= 20) { clearInterval(i); rej(e); } });
    }, 400);
  });
}

async function testSingle() {
  const port = 9237;
  const p = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--window-size=450,900',
    'http://localhost:3000'
  ]);
  try {
    const tabs = await waitForJson(port);
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    let id = 1;
    const callbacks = {};
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id && callbacks[d.id]) { callbacks[d.id](d.result); delete callbacks[d.id]; }
    };
    const send = (method, params = {}) => {
      const mid = id++;
      return new Promise(r => { callbacks[mid] = r; ws.send(JSON.stringify({ id: mid, method, params })); });
    };
    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 4000));
    const res = await send('Runtime.evaluate', {
      expression: `
        (function() {
          window.openImageModal('https://zeaxifmibxkhgaokkgho.supabase.co/storage/v1/object/public/chat-media/uploads/2026-09-19/177cd118-15e4-4125-8758-0a715b51acdc-z7944974787687_ba06a45bba872b60228fca7869a23cd6_-_Copy.jpg');
          var counter = document.getElementById('galleryCounterText');
          var thumbs = document.getElementById('galleryThumbs');
          var buttons = Array.from(document.querySelectorAll('#globalAlbumGalleryModal button'));
          return {
            counter: counter ? counter.textContent : 'none',
            thumbsDisplay: thumbs ? thumbs.style.display : 'none',
            buttonCount: buttons.length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Single image modal verification:', JSON.stringify(res.result.value, null, 2));
  } finally {
    p.kill();
  }
}
testSingle().catch(console.error);
