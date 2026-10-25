const { createHash } = require('node:crypto');
const { parse } = require('node-html-parser');
const { allowedImage } = require('./news_image.service');
const ARTICLE_HOSTS = ['vnexpress.net', 'dantri.com.vn', 'tinhte.vn'];
const MAX_HTML_BYTES = 3 * 1024 * 1024;

function allowedArticle(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ARTICLE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
const text = value => String(value || '').replace(/\s+/g, ' ').trim();

function extractArticle(html, article) {
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) throw Error('Article too large');
  const root = parse(html, { blockTextElements: {script:true, style:true, noscript:true} });
  // Do not attempt to bypass publisher sign-in or paid content.
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.rawText);
      const objects = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])];
      if (objects.some(o => o?.isAccessibleForFree === false || o?.isAccessibleForFree === 'False')) {
        throw Object.assign(Error('Publisher restricted'), {restricted:true});
      }
    } catch (error) { if (error.restricted) throw error; }
  }
  const host = new URL(article.link).hostname;
  const selectors = host.endsWith('vnexpress.net') ? ['article.fck_detail']
    : host.endsWith('dantri.com.vn') ? ['#articleContent [data-slot="content"]', '.singular-content', '.article-content']
    : ['.xfBody.big', '.bbWrapper', '.xfBody'];
  let body;
  for (const selector of selectors) { body = root.querySelector(selector); if (body) break; }
  if (!body) throw Error('Publisher article layout unavailable');
  for (const node of body.querySelectorAll('script,style,noscript,iframe,form,button,nav,aside,svg,h1,' +
      '.box-tinlienquan,.box-embed-video .video-control,.adsbygoogle,[data-content-name="article-related"],' +
      '[data-component-type="tin_xemthem"],.insert-link-box,.social-share,.table-of-content')) node.remove();

  const blocks = [], images = [], seenImages = new Set();
  let pendingText = '';
  function flush(type = 'paragraph') {
    const value = text(pendingText); pendingText = '';
    if (value && blocks.length < 400) blocks.push({type, text:value.slice(0, 10000)});
  }
  function image(node) {
    const attrs = node.attributes;
    const candidates = [attrs['data-original'], attrs['data-src'], attrs['data-bigger'], attrs.src,
      (attrs['data-srcset'] || attrs.srcset || '').split(',')[0]?.trim().split(/\s+/)[0]];
    let url;
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = new URL(candidate, article.link).href;
        if (allowedImage(parsed) && !/\.svg(?:[?#]|$)/i.test(parsed)) {url = parsed; break;}
      } catch {}
    }
    if (!url || seenImages.has(url) || images.length >= 60) return;
    const width = Number(attrs['data-width'] || attrs.width);
    const height = Number(attrs['data-height'] || attrs.height);
    if ((width > 0 && width < 100) || (height > 0 && height < 60)) return;
    seenImages.add(url);
    const id = createHash('sha256').update(url).digest('hex').slice(0, 24);
    images.push({id, imageUrl:url});
    blocks.push({type:'image', imageId:id, alt:text(attrs.alt).slice(0, 300),
      aspectRatio: width > 0 && height > 0 ? Math.min(3, Math.max(0.4, width / height)) : 1.5});
  }
  function walk(node) {
    if (blocks.length >= 400) return;
    if (node.nodeType === 3) { pendingText += node.textContent; return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'IMG') { flush(); image(node); return; }
    if (tag === 'BR') { flush(); return; }
    if (tag === 'FIGCAPTION') { flush(); pendingText = node.textContent; flush('caption'); return; }
    const block = ['P','DIV','H2','H3','H4','FIGURE','UL','OL','LI','BLOCKQUOTE','TABLE','TR'].includes(tag) ||
      node.classList.contains('xf-body-paragraph');
    if (block) flush();
    for (const child of node.childNodes) walk(child);
    if (block) flush(/^H[234]$/.test(tag) ? 'heading' : tag === 'BLOCKQUOTE' ? 'quote' : 'paragraph');
  }
  const intro = host.endsWith('dantri.com.vn') ? root.querySelector('#articleContent [data-slot="sapo"],h2.singular-sapo') : null;
  if (intro) blocks.push({type:'lead', text:text(intro.textContent).slice(0, 2000)});
  walk(body); flush();
  const textLength = blocks.reduce((sum, b) => sum + (b.text?.length || 0), 0);
  if (textLength < 80 && !images.length) throw Error('Publisher returned no article content');
  return {blocks, images};
}

async function fetchArticle(url, fetchImpl) {
  if (!allowedArticle(url)) throw Error('Unsupported publisher');
  const response = await fetchImpl(url, {
    redirect:'error', signal:AbortSignal.timeout(12000),
    headers:{'User-Agent':'ChatThoFi-NewsReader/1.0', Accept:'text/html'},
  });
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) throw Error('Publisher unavailable');
  if (Number(response.headers.get('content-length')) > MAX_HTML_BYTES) throw Error('Article too large');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_HTML_BYTES) throw Error('Article too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function createNewsArticleService({lookup, fetchImpl = global.fetch, now = Date.now} = {}) {
  const cache = new Map(), pending = new Map();
  let retained = 0;
  async function load(id) {
    const article = await lookup(id);
    if (!article) throw Object.assign(Error('Không tìm thấy bài báo.'), {status:404});
    let extracted;
    try { extracted = extractArticle(await fetchArticle(article.link, fetchImpl), article); }
    catch (_) { extracted = null; }
    const data = {...article, blocks:extracted?.blocks || [],
      available:!!extracted,
      ...(!extracted ? {message:'Nguồn báo chưa cung cấp nội dung đầy đủ lúc này. Bạn có thể thử tải lại.'} : {})};
    const value = {data, images:extracted?.images || [], expires:now() + (extracted ? 30 * 60 * 1000 : 60000)};
    const size = Buffer.byteLength(JSON.stringify(value));
    while (cache.size && (cache.size >= 60 || retained + size > 8 * 1024 * 1024)) {
      const oldest = cache.keys().next().value; retained -= cache.get(oldest).size; cache.delete(oldest);
    }
    cache.set(id, {...value, size}); retained += size;
    return data;
  }
  function get(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) return Promise.reject(Object.assign(Error('Không tìm thấy bài báo.'), {status:404}));
    const entry = cache.get(id);
    if (entry?.expires > now()) {cache.delete(id);cache.set(id,entry);return Promise.resolve(entry.data);}
    if (entry) {retained -= entry.size;cache.delete(id);}
    if (pending.has(id)) return pending.get(id);
    if (pending.size >= 8) return Promise.reject(Object.assign(Error('Vui lòng thử lại sau.'), {status:503}));
    const job = load(id).finally(() => pending.delete(id)); pending.set(id, job); return job;
  }
  function findImage(id) {
    for (const entry of cache.values()) {
      const image = entry.images.find(image => image.id === id);
      if (image) return image;
    }
    return null;
  }
  return {get, findImage};
}

module.exports = {allowedArticle, extractArticle, createNewsArticleService};
