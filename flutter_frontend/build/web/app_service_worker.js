'use strict';

// Filled from release content, so a changed bundle always gets a fresh cache.
const CACHE_NAME = 'chat-thofi-assets-5e56b0dc3c7e7b76';
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  '/tho_fi_logo_transparent.png',
  '/main.dart.js',
  '/flutter_bootstrap.js',
  '/app_fonts.css',
  '/icon-192.png',
  '/icon.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Load the generated list of bundled fonts, engine files and local assets.
    // API responses and personal uploads are deliberately absent from this list.
    let urls = [...APP_SHELL];
    try {
      const manifest = await fetch('/offline-assets.json', {cache: 'no-cache'});
      if (manifest.ok) {
        const assets = await manifest.json();
        urls = [...new Set([...APP_SHELL, ...assets.filter(url => isAppAsset(new URL(url, self.location.origin).pathname))])];
      }
    } catch (_) {}
    for (let index = 0; index < urls.length; index += 3) {
      await Promise.all(urls.slice(index, index + 3).map(async url => {
        try {
          const response = await fetch(url, {cache: 'no-cache'});
          if (response.ok) await cache.put(url, response);
        } catch (_) {}
      }));
    }
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
  return path.startsWith('/assets/') ||
    path.startsWith('/canvaskit/') ||
    path.endsWith('.wasm') ||
    path === '/app_fonts.css' ||
    path === '/manifest.json' ||
    /^\/(main\.dart\.js|flutter(?:_bootstrap)?\.js|webrtc_audio_helper\.js|web_notifications\.js)$/.test(path) ||
    /^\/(?:icon[^/]*|favicon|apple-touch-icon|tho_fi_logo(?:_transparent)?)\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(path) ||
    /^\/(?:ringtone|tuttut|amthanhtinnhan|amthanhtat)\.mp3$/.test(path);
}

function isCacheableExternal(url) {
  const host = url.hostname;
  return host === 'fonts.googleapis.com' ||
    host === 'fonts.gstatic.com' ||
    (host === 'www.gstatic.com' && (url.pathname.includes('canvaskit') || url.pathname.includes('flutter'))) ||
    host === 'cdn.jsdelivr.net';
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Private uploads, API, media proxies, push workers and range requests remain under browser control.
  if (request.method !== 'GET' || request.headers.has('range')) return;

  // External core assets: Google Fonts, remote CanvasKit, CDN libraries
  if (url.origin !== self.location.origin) {
    if (!isCacheableExternal(url)) return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  // Navigation requests: index.html
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

  // Cache-First strategy for core assets: CanvasKit wasm/js, localized fonts, app icons, JS bundles
  // Guarantees second-load startup is instantaneous (< 50ms) even offline or on flaky mobile data.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = (await cache.match(url.pathname)) || (await cache.match(request, {ignoreSearch: true}));
    if (cached) return cached;
    const response = await fetch(request, {cache: 'no-cache'});
    if (response.ok && response.type !== 'opaque') await cache.put(url.pathname, response.clone());
    return response;
  })());
});
