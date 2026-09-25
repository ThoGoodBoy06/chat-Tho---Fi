const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const workerSource = fs.readFileSync(path.join(__dirname, '../flutter_frontend/web/app_service_worker.js'), 'utf8');

function harness(version = 'release-a', stores = new Map()) {
  const handlers = {}, calls = [];
  let offline = false, status = 200;
  const key = request => new URL(typeof request === 'string' ? request : request.url, 'https://app.test').href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        match: async request => entries.get(key(request))?.clone(),
        put: async (request, response) => entries.set(key(request), response.clone()),
      };
    },
  };
  vm.runInNewContext(workerSource.replaceAll('__APP_BUILD_VERSION__', version), {
    self: {location: {origin: 'https://app.test'}, clients: {claim: async () => {}}, skipWaiting: async () => {}, addEventListener: (name, handler) => handlers[name] = handler},
    caches, URL, Response,
    fetch: async request => { calls.push(key(request)); if (offline) throw Error('offline'); return new Response('asset ' + version, {status}); },
  });
  return {
    calls, stores,
    offline: value => offline = value,
    status: value => status = value,
    lifecycle: async name => { let pending; handlers[name]({waitUntil: p => pending = p}); await pending; },
    request: async (url, {mode = 'cors', range = false, method = 'GET'} = {}) => {
      let response;
      const request = {url: new URL(url, 'https://app.test').href, method, mode, headers: new Headers(range ? {range: 'bytes=0-10'} : {})};
      handlers.fetch({request, respondWith: result => response = result});
      return response;
    },
  };
}

test('warm assets are reused without repeat background downloads', async () => {
  const app = harness();
  for (const asset of ['/main.dart.js?v=one', '/canvaskit/canvaskit.wasm', '/assets/assets/fonts/NotoColorEmoji.ttf']) {
    assert.equal((await app.request(asset)).status, 200);
    assert.equal((await app.request(asset)).status, 200);
  }
  assert.equal(app.calls.length, 3);
  await app.request('/main.dart.js?v=two');
  assert.equal(app.calls.length, 4);
});

test('private traffic, external resources and media ranges bypass app cache', async () => {
  const app = harness();
  for (const url of ['/api/chat/a/messages', '/uploads/private.png', '/socket.io/', 'https://cdn.test/image.png', '/firebase-messaging-sw.js']) {
    assert.equal(await app.request(url), undefined);
  }
  assert.equal(await app.request('/assets/movie.mp4', {range: true}), undefined);
  assert.equal(await app.request('/assets/file.png', {method: 'POST'}), undefined);
  assert.equal(app.calls.length, 0);
});

test('app shell falls back offline but navigation revalidates online', async () => {
  const app = harness();
  await app.lifecycle('install');
  app.offline(true);
  assert.equal(await (await app.request('/', {mode: 'navigate'})).text(), 'asset release-a');
  app.offline(false);
  const count = app.calls.length;
  await app.request('/', {mode: 'navigate'});
  assert.equal(app.calls.length, count + 1);
});

test('new releases replace only owned old caches and never reuse old assets', async () => {
  const stores = new Map([['unrelated-cache', new Map()]]);
  const old = harness('old', stores);
  await old.request('/canvaskit/canvaskit.wasm');
  const next = harness('new', stores);
  await next.lifecycle('install');
  await next.lifecycle('activate');
  assert.equal(stores.has('chat-thofi-assets-old'), false);
  assert.equal(stores.has('unrelated-cache'), true);
  assert.equal(await (await next.request('/canvaskit/canvaskit.wasm')).text(), 'asset new');
});

test('failed asset responses do not poison the cache', async () => {
  const app = harness();
  app.status(503);
  assert.equal((await app.request('/main.dart.js?v=one')).status, 503);
  app.status(200);
  assert.equal((await app.request('/main.dart.js?v=one')).status, 200);
  assert.equal(app.calls.length, 2);
});
