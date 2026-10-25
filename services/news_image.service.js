const IMAGE_HOSTS = ['vnecdn.net', 'dantri.com.vn', 'tinhte.vn'];
const MAX_BYTES = 5 * 1024 * 1024;

function allowedImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      IMAGE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

function createNewsImageService({ lookup, fetchImpl = global.fetch, now = Date.now,
  resize = async buffer => require('sharp')(buffer, { limitInputPixels: 20000000, animated: false })
    .rotate().resize({ width: 264, height: 264, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, effort: 2 }).toBuffer(),
} = {}) {
  const cache = new Map(), pending = new Map(), failed = new Map();
  const waiters = [];
  let active = 0;
  let retained = 0;
  async function withSlot(work) {
    if (active < 3) active++; else await new Promise(resolve => waiters.push(resolve));
    try { return await work(); }
    finally {
      const next = waiters.shift();
      if (next) next(); else active--;
    }
  }
  async function produce(id) {
    const article = await lookup(id);
    if (!article?.imageUrl || !allowedImage(article.imageUrl)) throw Object.assign(Error('No photo'), {status:404});
    const response = await fetchImpl(article.imageUrl, {
      signal: AbortSignal.timeout(6000), redirect: 'error',
      headers: { Accept: 'image/*', 'User-Agent': 'ChatThoFi-NewsReader/1.0' },
    });
    if (!response.ok || !/^image\/(jpeg|png|webp|gif|avif)(;|$)/i.test(response.headers.get('content-type') || '') ||
        Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('Invalid photo');
    const chunks = []; let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_BYTES) throw Error('Photo too large');
      chunks.push(Buffer.from(chunk));
    }
    const buffer = await resize(Buffer.concat(chunks));
    if (buffer.length > MAX_BYTES) throw Error('Photo too large');
    while (cache.size && (cache.size >= 100 || retained + buffer.length > 10 * 1024 * 1024)) {
      const oldest = cache.keys().next().value;
      retained -= cache.get(oldest).buffer.length; cache.delete(oldest);
    }
    cache.set(id, {buffer, expires:now() + 3600000}); retained += buffer.length;
    return buffer;
  }
  function get(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) return Promise.reject(Object.assign(Error('Invalid article'), {status:404}));
    const cached = cache.get(id);
    if (cached && cached.expires > now()) {
      cache.delete(id); cache.set(id, cached); return Promise.resolve(cached.buffer);
    }
    if (cached) { retained -= cached.buffer.length; cache.delete(id); }
    if (pending.has(id)) return pending.get(id);
    if ((failed.get(id) || 0) > now() || pending.size >= 24) {
      return Promise.reject(Object.assign(Error('Photo temporarily unavailable'), {status:503}));
    }
    const job = withSlot(() => produce(id)).catch(error => {
      if (failed.size >= 100) failed.delete(failed.keys().next().value);
      failed.set(id, now() + 60000); throw error;
    }).finally(() => pending.delete(id));
    pending.set(id, job); return job;
  }
  return { get };
}

module.exports = { allowedImage, createNewsImageService };
