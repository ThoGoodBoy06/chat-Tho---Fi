'use strict';

// Filled from release content, so a changed bundle always gets a fresh cache.
const CACHE_NAME = 'chat-thofi-assets-__APP_BUILD_VERSION__';
const APP_SHELL = ['/index.html', '/manifest.json', '/tho_fi_logo_transparent.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const response = await fetch(url, {cache: 'no-cache'});
        if (response.ok) await cache.put(url, response);
      } catch (_) { /* Installing offline must not break a working version. */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('chat-thofi-assets-') && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function isAppAsset(path) {
  return path.startsWith('/assets/') || path.startsWith('/canvaskit/') ||
    /^\/(main\.dart\.js|flutter(?:_bootstrap)?\.js|webrtc_audio_helper\.js)$/.test(path) ||
    /^\/(?:icon[^/]*|favicon|apple-touch-icon|tho_fi_logo(?:_transparent)?)\.png$/.test(path) ||
    /^\/(?:ringtone|tuttut|amthanhtinnhan|amthanhtat)\.mp3$/.test(path);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Private uploads, API, media proxies, push workers and external hosts never
  // enter the app cache. Range requests remain under browser/media control.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      request.headers.has('range')) return;

  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, {cache: 'no-cache'});
        if (response.ok) await cache.put('/index.html', response.clone());
        return response;
      } catch (_) {
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }
  if (!isAppAsset(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Every release has its own cache. Warm launches reuse heavy fonts/wasm
    // without issuing a second background download for each cached asset.
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request, {cache: 'no-cache'});
    if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
    return response;
  })());
});
