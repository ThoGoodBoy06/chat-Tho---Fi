const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createNewsFeedService, parseFeed } = require('../services/news_feed.service');
const { allowedImage, createNewsImageService } = require('../services/news_image.service');
const clock = Date.parse('2026-10-25T05:00:00Z');
const feeds = ['Vietnam', 'World', 'Tech_AI'].map(category => ({
  category, source: 'Báo thử', host: 'example.com', url: `https://example.com/${category}.rss`,
}));
const xml = (title = 'Tin thật &amp; mới', link = 'https://example.com/story') => `<?xml version="1.0"?><rss version="2.0"><channel><item>
  <title><![CDATA[${title}]]></title><link>${link}</link>
  <description><![CDATA[<a href="${link}"><img src="https://example.com/photo.jpg" /></a> Tóm tắt &amp; thông tin mới]]></description>
  <pubDate>Sun, 25 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>`;

test('extracts attributed, plain-text articles, photos and publication time from RSS', () => {
  const [article] = parseFeed(xml(), feeds[0], clock);
  assert.equal(article.title, 'Tin thật & mới');
  assert.equal(article.content, 'Tóm tắt & thông tin mới');
  assert.equal(article.imageUrl, 'https://example.com/photo.jpg');
  assert.equal(article.category, 'Vietnam');
  assert.equal(article.source, 'Báo thử');
  assert.equal(article.createdAt, '2026-10-25T04:00:00.000Z');
  assert.equal(article.id, parseFeed(xml(), feeds[0], clock)[0].id);
});

test('rejects XML entities, oversized feeds, unsafe links, invalid dates and HTML error pages', () => {
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x "boom">]>' + xml(), feeds[0], clock));
  assert.throws(() => parseFeed('x'.repeat(2097153), feeds[0], clock));
  assert.throws(() => parseFeed('<html>Blocked</html>', feeds[0], clock));
  for (const link of ['javascript:alert(1)', 'https://example.com.evil.test/article', 'https://evil.test/']) {
    assert.equal(parseFeed(xml('Headline', link), feeds[0], clock).length, 0);
  }
  assert.equal(parseFeed(xml().replace('Sun, 25 Oct 2026 04:00:00 GMT', 'bad date'), feeds[0], clock).length, 0);
});

test('coalesces concurrent readers, caches all three categories and validates filters', async () => {
  let requests = 0;
  const service = createNewsFeedService({ feeds, now: () => clock, fetchImpl: async () => {
    requests++; await new Promise(resolve => setImmediate(resolve)); return new Response(xml());
  }});
  const [a, b] = await Promise.all([service.getLatest(), service.getLatest('World')]);
  assert.equal(requests, 3);
  assert.equal(a.data.length, 3);
  assert.equal(b.data.length, 1);
  assert.equal(b.data[0].category, 'World');
  assert.equal(a.stale, false);
  await service.getLatest();
  assert.equal(requests, 3);
  await assert.rejects(service.getLatest('MadeUp'), { status: 400 });
});

test('keeps old headlines when a source fails; a failed first load returns an honest empty result', async () => {
  let time = clock, failing = false;
  const service = createNewsFeedService({ feeds, now: () => time,
    fetchImpl: async () => { if (failing) throw Error('offline'); return new Response(xml()); },
  });
  const first = await service.getLatest();
  failing = true; time += 11 * 60 * 1000;
  const stale = await service.getLatest();
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.data, first.data);
  assert.equal(stale.updatedAt, first.updatedAt);
  const empty = await createNewsFeedService({ feeds, fetchImpl: async () => new Response('unavailable', {status:503}) }).getLatest();
  assert.equal(empty.success, false);
  assert.equal(empty.data.length, 0);
  assert.deepEqual(empty.missingCategories, ['Vietnam', 'World', 'Tech_AI']);
});

test('one unavailable source does not discard the other categories', async () => {
  const result = await createNewsFeedService({ feeds, now: () => clock,
    fetchImpl: async url => new Response(url.includes('World') ? '<html>unavailable</html>' : xml()),
  }).getLatest();
  assert.equal(result.success, true);
  assert.equal(result.stale, true);
  assert.equal(result.data.length, 2);
  assert.deepEqual(result.missingCategories, ['World']);
});

test('news thumbnails only fetch known publisher hosts and reject arbitrary URLs/IDs', async () => {
  assert.equal(allowedImage('https://icdn.dantri.com.vn/image.jpg'), true);
  for (const url of ['http://icdn.dantri.com.vn/a', 'https://dantri.com.vn.evil.test/a',
    'https://127.0.0.1/a', 'https://user:password@icdn.dantri.com.vn/a', 'https://icdn.dantri.com.vn:8080/a']) {
    assert.equal(allowedImage(url), false);
  }
  let requests = 0;
  const service = createNewsImageService({lookup: async () => ({imageUrl:'https://evil.test/image'}),
    fetchImpl: async () => { requests++; throw Error('should not fetch'); }});
  await assert.rejects(service.get('0'.repeat(24)), {status:404});
  await assert.rejects(service.get('https://evil.test/image'), {status:404});
  assert.equal(requests, 0);
});

test('thumbnail work is coalesced, cached and limited to three concurrent fetches', async () => {
  let requests = 0, active = 0, maximum = 0;
  const service = createNewsImageService({lookup: async () => ({imageUrl:'https://icdn.dantri.com.vn/test.jpg'}),
    fetchImpl: async () => {
      requests++; active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setImmediate(resolve)); active--;
      return new Response('photo', {headers:{'content-type':'image/jpeg'}});
    }, resize: async buffer => buffer,
  });
  const id = 'a'.repeat(24);
  const [one, two] = await Promise.all([service.get(id), service.get(id)]);
  assert.equal(one, two); assert.equal(requests, 1);
  await service.get(id); assert.equal(requests, 1);
  await Promise.all(Array.from({length:8}, (_, i) => service.get(i.toString(16).padStart(24,'0'))));
  assert.equal(maximum, 3);
});

test('bad and oversized thumbnail responses are not cached as successful photos', async () => {
  for (const response of [
    new Response('<html>error</html>', {headers:{'content-type':'text/html'}}),
    new Response('photo', {headers:{'content-type':'image/jpeg','content-length':6000000}}),
  ]) {
    const service = createNewsImageService({lookup:async()=>({imageUrl:'https://icdn.dantri.com.vn/test.jpg'}),
      fetchImpl:async()=>response});
    await assert.rejects(service.get('b'.repeat(24)));
  }
});
