// The real Flutter tab against live public RSS; isolated from user accounts.
const { chromium, webkit } = require('playwright');
const { Server } = require('socket.io');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { createNewsFeedService } = require('../services/news_feed.service');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'flutter_frontend/build/web');
const feeds = createNewsFeedService();
const { createNewsImageService } = require('../services/news_image.service');
const photos = createNewsImageService({lookup:async id => (await feeds.getLatest()).data.find(n => n.id === id)});
let newsRequests = 0, releaseNews;
const gate = new Promise(resolve => { releaseNews = resolve; });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if(url.pathname==='/favicon.ico') {res.statusCode=204;return res.end();}
  if (url.pathname.startsWith('/api/news/image/')) {
    try {
      const image = await photos.get(url.pathname.split('/').at(-1));
      res.setHeader('Content-Type', 'image/webp');
      return res.end(image);
    } catch (e) { console.log('Photo failure:',url.pathname,e.message); res.statusCode = 404; return res.end(); }
  }
  if (url.pathname === '/api/news') {
    newsRequests++; await gate;
    const news = await feeds.getLatest();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify(news));
  }
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, data: [] }));
  }
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app_fonts.css"><script src="/flutter_bootstrap.js" async></script>');
  }
  const file = url.pathname === '/main.dart.js' ? path.join(root, 'scratch/mobile-call-app.js') : path.join(web, url.pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.json') ? 'application/json' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

const io = new Server(server);
(async () => {
  const feed = await feeds.getLatest();
  assert.equal(feed.success, true);
  for (const category of ['Vietnam', 'World', 'Tech_AI']) assert(feed.data.some(n => n.category === category));
  await new Promise(resolve => server.listen(3000, '127.0.0.1', resolve));
  for (const [engine, name, viewport] of [[chromium, 'chrome-mobile', {width:390,height:844}], [webkit, 'webkit-mobile', {width:390,height:844}], [chromium, 'chrome-desktop', {width:1280,height:900}]]) {
    const browser = await engine.launch({ headless: true, executablePath: engine === chromium ? (process.env.CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe') : process.env.WEBKIT_EXECUTABLE });
    try {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('console', msg => { if(msg.type()==='error') console.log(name+' console:',msg.text()); });
      page.on('pageerror', e => errors.push(e.stack || e.message));
      await page.goto('http://127.0.0.1:3000/?news=1');
      await page.getByText('Tin tức', {exact:true}).waitFor();
      if (name === 'chrome-mobile') {
        await page.screenshot({path:path.join(root, 'scratch/news-loading-mobile.png')});
        releaseNews();
      }
      for (const [category, label] of [['Vietnam','Việt Nam'], ['World','Thế giới'], ['Tech_AI','Công nghệ']]) {
        await page.getByText(label, {exact:true}).click();
        const first = feed.data.find(n => n.category === category);
        try { await page.getByText(first.title, {exact:false}).first().waitFor({timeout:20000}); } catch (e) { await page.screenshot({path:path.join(root,'scratch/news-error.png')}); fs.writeFileSync(path.join(root,'scratch/news-error-dom.txt'),await page.locator('body').innerText()); throw e; }
        if (category === 'Vietnam') await page.screenshot({path:path.join(root, `scratch/news-${name}.png`)});
      }
      const current = feed.data.find(n => n.category === 'Tech_AI');
      const popupPromise = page.waitForEvent('popup');
      await page.getByText(current.title, {exact:false}).first().click();
      const popup = await popupPromise;
      await popup.waitForURL(url => url.hostname === new URL(current.link).hostname, {waitUntil:'commit'});
      await popup.close();
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(name + ': live categories, source articles, loading and original-link action passed');
    } finally { await browser.close(); }
  }
  assert.equal(newsRequests, 3, 'switching categories should not fetch the feed again');
  console.log('RSS live article counts:', JSON.stringify(Object.fromEntries(['Vietnam','World','Tech_AI'].map(c=>[c,feed.data.filter(n=>n.category===c).length]))));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {io.close();server.close();});
