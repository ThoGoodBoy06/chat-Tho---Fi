'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"amthanhtinnhan.mp3": "bbab8183cb9cf2cb736b4f5ede0f2f58",
"apple-touch-icon.png": "51dbc6ca9c68fa43b554e709aeeca753",
"assets/AssetManifest.bin": "1fb9a339f909243f3db3c37a0d0eff3e",
"assets/AssetManifest.bin.json": "2d3a6be054ebb6be5df24915dd510061",
"assets/AssetManifest.json": "bdcc4f986554c6339a52455f093bd9f7",
"assets/assets/icon-192.png": "0b0054452acd63fe7a018a25cb83de9f",
"assets/assets/icon_1024.png": "0054bc42104d86e37a76e0cf8baf2c90",
"assets/assets/sounds/amthanhtat.mp3": "16dc30f03c1e42ff4e44ce2477a5e16f",
"assets/assets/sounds/amthanhtinnhan.mp3": "bbab8183cb9cf2cb736b4f5ede0f2f58",
"assets/assets/sounds/ringtone.mp3": "faa7e68a9b3c11e22fea63da62499757",
"assets/assets/sounds/tuttut.mp3": "2b632d43a786bcaf9fa149bc45310c47",
"assets/assets/tho_fi_logo.png": "50b92efb3530833786a6589d4309c112",
"assets/assets/tho_fi_logo_transparent.png": "50b92efb3530833786a6589d4309c112",
"assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"assets/fonts/MaterialIcons-Regular.otf": "3903b037e3a271fceb0ec6b3b02817d5",
"assets/NOTICES": "09c5f10fd15af586f8f6abfbea312457",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "e986ebe42ef785b27164c36a9abc7818",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/shaders/stretch_effect.frag": "23fc0b9e204601c015309bcfc989b939",
"canvaskit/canvaskit.js": "738255d00768497e86aa4ca510cce1e1",
"canvaskit/canvaskit.js.symbols": "74a84c23f5ada42fe063514c587968c6",
"canvaskit/canvaskit.wasm": "9251bb81ae8464c4df3b072f84aa969b",
"canvaskit/chromium/canvaskit.js": "901bb9e28fac643b7da75ecfd3339f3f",
"canvaskit/chromium/canvaskit.js.symbols": "ee7e331f7f5bbf5ec937737542112372",
"canvaskit/chromium/canvaskit.wasm": "399e2344480862e2dfa26f12fa5891d7",
"canvaskit/experimental_webparagraph/canvaskit.js": "d5ae693ff16b04b96e5cc853f56f0798",
"canvaskit/experimental_webparagraph/canvaskit.js.symbols": "6185bba61ca49e58eda00ed356b1d378",
"canvaskit/experimental_webparagraph/canvaskit.wasm": "e008e87c245b0718932b34e9a15be803",
"canvaskit/skwasm.js": "5d4f9263ec93efeb022bb14a3881d240",
"canvaskit/skwasm.js.symbols": "c3c05bd50bdf59da8626bbe446ce65a3",
"canvaskit/skwasm.wasm": "4051bfc27ba29bf420d17aa0c3a98bce",
"canvaskit/skwasm.worker.js": "bfb704a6c714a75da9ef320991e88b03",
"canvaskit/skwasm_heavy.js": "258ff7ee3b94602b5096574c9dc3f2e2",
"canvaskit/skwasm_heavy.js.symbols": "82d8b2224f4543d8a1853b7d910bf5e3",
"canvaskit/skwasm_heavy.wasm": "f22698a773ef756eff818039e37be5c3",
"canvaskit/wimp.js": "83c54ce25f346f0dbf0cf4155bb0735b",
"canvaskit/wimp.js.symbols": "886a5d1e2b20d5ce0e766cca70f98763",
"canvaskit/wimp.wasm": "9242e201530449825b5645ed3d5af22c",
"favicon.png": "0054bc42104d86e37a76e0cf8baf2c90",
"firebase-messaging-sw.js": "6c3ac3e2de4a37314e35e36f4511a354",
"flutter.js": "383e55f7f3cce5be08fcf1f3881f585c",
"flutter_bootstrap.js": "2e1d381a856ced439fc3ec9ad16e0f91",
"icon-192.png": "0b0054452acd63fe7a018a25cb83de9f",
"icon-maskable-192.png": "09b80faa29f96d2e6574de2c965a051e",
"icon-maskable-512.png": "6f2a9d5c2e5edaaed725a9036bb16e17",
"icon.png": "bbd0ff03b1f66d874f1fc4cfb242767b",
"icon_1024.png": "0054bc42104d86e37a76e0cf8baf2c90",
"index.html": "5eb37d4f5e62c038d40e815fc5212c12",
"/": "5eb37d4f5e62c038d40e815fc5212c12",
"main.dart.js": "83e881e00430dbe5daf5b6f6523f59fd",
"manifest.json": "354fc5eae41fefe2fdfdfde577425d38",
"tho_fi_logo.png": "50b92efb3530833786a6589d4309c112",
"tho_fi_logo_transparent.png": "50b92efb3530833786a6589d4309c112",
"version.json": "6e219987ebc110d8f6d87e34448379f6"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
