const { createHash } = require('node:crypto');
const { XMLParser, XMLValidator } = require('fast-xml-parser');

// Only public RSS feeds are fetched. Article bodies are read on the publisher's site.
const FEEDS = [
  { url: 'https://vnexpress.net/rss/thoi-su.rss', category: 'Vietnam', source: 'VnExpress', host: 'vnexpress.net' },
  { url: 'https://dantri.com.vn/rss/thoi-su.rss', category: 'Vietnam', source: 'Dân trí', host: 'dantri.com.vn' },
  { url: 'https://vnexpress.net/rss/the-gioi.rss', category: 'World', source: 'VnExpress', host: 'vnexpress.net' },
  { url: 'https://dantri.com.vn/rss/the-gioi.rss', category: 'World', source: 'Dân trí', host: 'dantri.com.vn' },
  { url: 'https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss', category: 'Tech_AI', source: 'VnExpress', host: 'vnexpress.net' },
  { url: 'https://dantri.com.vn/rss/cong-nghe.rss', category: 'Tech_AI', source: 'Dân trí', host: 'dantri.com.vn' },
  { url: 'https://tinhte.vn/rss', category: 'Tech_AI', source: 'Tinh tế', host: 'tinhte.vn' },
];
const CATEGORIES = ['Vietnam', 'World', 'Tech_AI'];
const MAX_XML_BYTES = 2 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: false, parseTagValue: false, processEntities: false,
});

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—' };
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, key) => {
    if (key[0] !== '#') return named[key.toLowerCase()] ?? match;
    const number = key[1]?.toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : '';
  });
}
function plainText(value, limit) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
function safeUrl(value, base, requiredHost) {
  try {
    const url = new URL(decodeEntities(value), base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (requiredHost && url.hostname !== requiredHost && !url.hostname.endsWith(`.${requiredHost}`)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
function tagText(value) {
  return typeof value === 'string' ? value : value?.['#text'] || '';
}
function parseFeed(xml, feed, now = Date.now()) {
  if (Buffer.byteLength(xml) > MAX_XML_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('Unsafe or oversized RSS');
  if (XMLValidator.validate(xml) !== true) throw Error('Invalid RSS XML');
  const raw = parser.parse(xml)?.rss?.channel?.item;
  if (!raw) throw Error('No RSS items');
  const items = Array.isArray(raw) ? raw : [raw];
  const seen = new Set();
  return items.slice(0, 60).flatMap(item => {
    const title = plainText(tagText(item.title), 240);
    const link = safeUrl(tagText(item.link), feed.url, feed.host);
    const timestamp = Date.parse(tagText(item.pubDate));
    if (!title || !link || !Number.isFinite(timestamp) || timestamp > now + 86400000 || seen.has(link)) return [];
    seen.add(link);
    const description = tagText(item.description);
    const markup = decodeEntities(description);
    const imageMatch = markup.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    const media = item['media:content'] || item['media:thumbnail'] || item.enclosure;
    const image = safeUrl(imageMatch?.[1] || media?.['@_url'] || '', feed.url);
    return [{
      id: createHash('sha256').update(`${feed.category}|${link}`).digest('hex').slice(0, 24),
      title, content: plainText(description, 360), category: feed.category,
      source: feed.source, link, imageUrl: image === feed.url || /\.gif(?:[?#]|$)/i.test(image || '') ? null : image,
      createdAt: new Date(timestamp).toISOString(),
    }];
  }).slice(0, 30);
}

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_XML_BYTES) throw Error('RSS too large');
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_XML_BYTES) {
      throw Error('RSS too large');
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function createNewsFeedService({ fetchImpl = global.fetch, now = Date.now, feeds = FEEDS, ttl = 10 * 60 * 1000 } = {}) {
  const cache = new Map();
  let pending;
  let retryAt = 0;
  let updatedAt = null;
  let failures = [];
  async function refresh() {
    const outcomes = await Promise.allSettled(feeds.map(async feed => {
      const response = await fetchImpl(feed.url, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'ChatThoFi-NewsReader/1.0' },
        signal: AbortSignal.timeout(8000), redirect: 'error',
      });
      if (!response.ok) throw Error(`RSS HTTP ${response.status}`);
      const items = parseFeed(await readBounded(response), feed, now());
      if (!items.length) throw Error('RSS has no usable articles');
      cache.set(feed.url, items);
      return feed.source;
    }));
    failures = feeds.filter((_, i) => outcomes[i].status === 'rejected').map(f => ({ source: f.source, category: f.category }));
    const success = outcomes.some(result => result.status === 'fulfilled');
    if (success) updatedAt = new Date(now()).toISOString();
    retryAt = now() + (failures.length ? 60 * 1000 : ttl);
  }
  async function getLatest(category) {
    if (category && !CATEGORIES.includes(category)) throw Object.assign(Error('Danh mục không hợp lệ.'), { status: 400 });
    if (now() >= retryAt) {
      if (!pending) pending = refresh().finally(() => { pending = null; });
      await pending;
    }
    const dedup = new Map();
    for (const items of cache.values()) for (const item of items) {
      if (category && item.category !== category) continue;
      const key = `${item.category}|${item.title.toLocaleLowerCase('vi')}`;
      if (!dedup.has(key)) dedup.set(key, item);
    }
    const data = [...dedup.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // An upstream outage never replaces previously fetched articles with demo data.
    const relevantFailures = failures.filter(f => !category || f.category === category);
    const missingCategories = (category ? [category] : CATEGORIES).filter(c => !data.some(n => n.category === c));
    return { success: data.length > 0, data, updatedAt,
      stale: relevantFailures.length > 0, missingCategories,
      ...(data.length ? {} : { message: 'Chưa tải được tin từ các báo. Vui lòng thử lại sau.' }),
    };
  }
  return { getLatest };
}

module.exports = { FEEDS, CATEGORIES, parseFeed, createNewsFeedService };
