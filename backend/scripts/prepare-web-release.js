const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'flutter_frontend', 'build', 'web');
const source = path.join(root, 'flutter_frontend', 'web');
const hash = crypto.createHash('sha256');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
if (!fs.existsSync(path.join(web, 'main.dart.js'))) throw Error('Build Flutter Web before preparing the release.');
require('./assert-production-bundle').assertProductionBundle(path.join(web, 'main.dart.js'));

// Remove pre-compressed outputs from any prior run so hashing stays idempotent.
for (const file of files(web)) {
  if (file.endsWith('.br') || file.endsWith('.gz')) {
    fs.unlinkSync(file);
  }
}

const EXCLUDED_OFFLINE_PATTERN = /(?:^\/canvaskit\/|^\/assets\/NOTICES$|\.(?:symbols|map|br|gz)$|-OFL\.txt$|HUGEICONS-NOTICE\.txt$|NotoColorEmoji\.ttf$|\/(?:Arimo|Inter|Outfit)-[^/]+\.ttf$)/i;
const offlineAssets = files(web)
  .map(file => '/' + path.relative(web, file).replaceAll('\\', '/'))
  .filter(url => !EXCLUDED_OFFLINE_PATTERN.test(url) &&
    (url.startsWith('/assets/') || ['/webrtc_audio_helper.js', '/web_notifications.js'].includes(url)));
fs.writeFileSync(path.join(web, 'offline-assets.json'), JSON.stringify(offlineAssets));

// Hash all build contents, including assets. Template files are always restored
// before hashing so running this step twice is idempotent.
for (const name of ['index.html', 'app_service_worker.js', '_headers', 'firebase-messaging-sw.js', 'web_notifications.js', 'app_fonts.css', 'webrtc_audio_helper.js']) {
  fs.copyFileSync(path.join(source, name), path.join(web, name));
}
let bootstrap = fs.readFileSync(path.join(web, 'flutter_bootstrap.js'), 'utf8');
bootstrap = bootstrap.replaceAll('"renderer":"auto"', '"renderer":"canvaskit"');
bootstrap = bootstrap.replace(/\?v=[a-f0-9]{16}/g, '?v=__APP_BUILD_VERSION__');
fs.writeFileSync(path.join(web, 'flutter_bootstrap.js'), bootstrap);
for (const file of files(web).sort()) {
  const base = path.basename(file);
  if (base === 'flutter_service_worker.js' || base === 'release.json' || base.endsWith('.br') || base.endsWith('.gz')) continue;
  hash.update(path.relative(web, file));
  hash.update(fs.readFileSync(file));
}
const version = hash.digest('hex').slice(0, 16);
for (const name of ['index.html', 'app_service_worker.js', 'flutter_bootstrap.js']) {
  const file = path.join(web, name);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('__APP_BUILD_VERSION__', version));
}
fs.writeFileSync(path.join(web, 'release.json'), JSON.stringify({version}, null, 2) + '\n');

// Pre-compress active runtime assets with Brotli (and Gzip for largest bundles)
// so Express serves pre-compressed bytes directly without per-request CPU stalls.
const ACTIVE_BROTLI_FILES = new Set([
  '/main.dart.js',
  '/flutter_bootstrap.js',
  '/web_notifications.js',
  '/webrtc_audio_helper.js',
  '/index.html',
  '/app_fonts.css',
  '/manifest.json',
  '/offline-assets.json',
  '/canvaskit/chromium/canvaskit.wasm',
  '/canvaskit/chromium/canvaskit.js',
  '/canvaskit/canvaskit.wasm',
  '/canvaskit/canvaskit.js',
]);
const ACTIVE_GZIP_FILES = new Set([
  '/main.dart.js',
  '/canvaskit/chromium/canvaskit.wasm',
  '/canvaskit/canvaskit.wasm',
]);

let brCount = 0;
for (const file of files(web)) {
  const relUrl = '/' + path.relative(web, file).replaceAll('\\', '/');
  const isCompressibleAsset = relUrl.startsWith('/assets/') &&
    /\.(?:ttf|otf|json|svg|js|css)$/i.test(relUrl) &&
    !EXCLUDED_OFFLINE_PATTERN.test(relUrl);
  if (!ACTIVE_BROTLI_FILES.has(relUrl) && !isCompressibleAsset) continue;

  const raw = fs.readFileSync(file);
  if (raw.length < 1024) continue;

  const isHeavyStatic = /\.(?:wasm|js|ttf|otf)$/i.test(relUrl);
  const br = zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: isHeavyStatic ? 11 : 6,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  if (br.length < raw.length) {
    fs.writeFileSync(file + '.br', br);
    brCount++;
  }
  if (ACTIVE_GZIP_FILES.has(relUrl)) {
    const gz = zlib.gzipSync(raw, {level: 9});
    if (gz.length < raw.length) {
      fs.writeFileSync(file + '.gz', gz);
    }
  }
}

const offlineTotalBytes = offlineAssets.reduce((sum, url) => {
  const full = path.join(web, url.slice(1));
  return sum + (fs.existsSync(full) ? fs.statSync(full).size : 0);
}, 0);

// Copy only build outputs; preserve unrelated files in each serving directory.
for (const destination of ['public', 'backend/public', 'backend/flutter_frontend/build/web']) {
  fs.cpSync(web, path.join(root, destination), {recursive: true});
}
console.log(
  `Prepared and synchronized Flutter Web release ${version} ` +
  `(offline-assets: ${offlineAssets.length} files / ${(offlineTotalBytes / 1024 / 1024).toFixed(2)} MB, ` +
  `brotli: ${brCount} files)`
);
