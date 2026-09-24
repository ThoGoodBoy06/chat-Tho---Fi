'use strict';

const CACHE_NAME = 'chat-thofi-assets-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tho_fi_logo_transparent.png',
  '/icon-192.png',
  '/assets/sounds/amthanhtinnhan.mp3'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('chat-thofi-assets-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass API, WebSocket, and external CDNs
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('socket.io') ||
    url.hostname.includes('render.com') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // HTML documents: Network-first, fallback to cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static Assets (.wasm, .js, .ttf, .png, .mp3, etc.): Cache-first with stale-while-revalidate
  if (
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.includes('/canvaskit/') ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((c) => c.put(req, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});
