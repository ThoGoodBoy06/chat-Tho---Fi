const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'flutter_frontend', 'build', 'web');
const source = path.join(root, 'flutter_frontend', 'web');
const hash = crypto.createHash('sha256');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
if (!fs.existsSync(path.join(web, 'main.dart.js'))) throw Error('Build Flutter Web before preparing the release.');
// Hash all build contents, including assets. Template files are always restored
// before hashing so running this step twice is idempotent.
for (const name of ['index.html', 'app_service_worker.js', '_headers']) {
  fs.copyFileSync(path.join(source, name), path.join(web, name));
}
let bootstrap = fs.readFileSync(path.join(web, 'flutter_bootstrap.js'), 'utf8');
bootstrap = bootstrap.replace(/\?v=[a-f0-9]{16}/g, '?v=__APP_BUILD_VERSION__');
fs.writeFileSync(path.join(web, 'flutter_bootstrap.js'), bootstrap);
for (const file of files(web).sort()) {
  if (path.basename(file) === 'flutter_service_worker.js' || path.basename(file) === 'release.json') continue;
  hash.update(path.relative(web, file));
  hash.update(fs.readFileSync(file));
}
const version = hash.digest('hex').slice(0, 16);
for (const name of ['index.html', 'app_service_worker.js', 'flutter_bootstrap.js']) {
  const file = path.join(web, name);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('__APP_BUILD_VERSION__', version));
}
fs.writeFileSync(path.join(web, 'release.json'), JSON.stringify({version}, null, 2) + '\n');
// Copy only build outputs; preserve unrelated files in each serving directory.
for (const destination of ['public', 'backend/public', 'backend/flutter_frontend/build/web']) {
  fs.cpSync(web, path.join(root, destination), {recursive: true});
}
console.log('Prepared and synchronized Flutter Web release ' + version);
