'use strict';

<<<<<<< HEAD
self.addEventListener('install', () => {
=======
const RESOURCES = {"assets/AssetManifest.bin": "693635b5258fe5f1cda720cf224f158c",
"assets/AssetManifest.bin.json": "69a99f98c8b1fb8111c5fb961769fcd8",
"assets/AssetManifest.json": "2efbb41d7877d10aac9d091f58ccd7b9",
"assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"assets/fonts/MaterialIcons-Regular.otf": "16875a1cd3d64ff22e30cdc26e9a5999",
"assets/NOTICES": "54538a9966dfb06f1b5e456ef2156be9",
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
"firebase-messaging-sw.js": "6c3ac3e2de4a37314e35e36f4511a354",
"flutter.js": "383e55f7f3cce5be08fcf1f3881f585c",
"flutter_bootstrap.js": "ef2441db00ea11691079efccfa4d49d1",
"index.html": "6fa9eb773d743620e9e513b45a72cad3",
"/": "6fa9eb773d743620e9e513b45a72cad3",
"main.dart.js": "7c06b285ae2089cdb1fa55e11f6ffb5f",
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
>>>>>>> e41d394 (fix: Instant jump to bottom when opening conversation)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();
      } catch (e) {
        console.warn('Failed to unregister the service worker:', e);
      }

      try {
        const clients = await self.clients.matchAll({
          type: 'window',
        });
        // Reload clients to ensure they are not using the old service worker.
        clients.forEach((client) => {
          if (client.url && 'navigate' in client) {
            client.navigate(client.url);
          }
        });
      } catch (e) {
        console.warn('Failed to navigate some service worker clients:', e);
      }
    })()
  );
});
