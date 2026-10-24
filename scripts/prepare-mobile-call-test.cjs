// Compile only into scratch/. Never copy this signed-in test app into build/web.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const sdk = process.argv[2];
if (!sdk) throw Error('Usage: node scripts/prepare-mobile-call-test.cjs <Flutter SDK>');
const build = path.join(root, 'flutter_frontend/.dart_tool/flutter_build');
const bootstrap = fs.readdirSync(build).map(n => path.join(build,n,'main.dart')).find(p =>
  fs.existsSync(p) && fs.readFileSync(p,'utf8').includes("import 'package:flutter_frontend/main.dart' as entrypoint;"));
if (!bootstrap) throw Error('Generate the production Flutter bootstrap first.');
const scratch = path.join(root, 'scratch');
fs.mkdirSync(scratch, {recursive:true});
const relative = p => path.relative(scratch,p).replaceAll('\\','/');
const source = fs.readFileSync(bootstrap,'utf8')
  .replace("import 'package:flutter_frontend/main.dart' as entrypoint;", "import '"+relative(path.join(root,'scripts/fixtures/mobile_call_app.dart'))+"' as entrypoint;")
  .replace("'web_plugin_registrant.dart'",JSON.stringify(relative(path.join(path.dirname(bootstrap),'web_plugin_registrant.dart'))));
const target = path.join(scratch,'mobile_call_bootstrap.dart');
fs.writeFileSync(target,source);
const result = cp.spawnSync(path.join(sdk,'bin/cache/dart-sdk/bin/dart.exe'),[
  '--disable-dart-dev',path.join(sdk,'bin/cache/dart-sdk/bin/snapshots/dart2js.dart.snapshot'),
  '--platform-binaries='+path.join(sdk,'bin/cache/flutter_web_sdk/kernel'),'--invoker=flutter_tool',
  '--packages='+path.join(root,'flutter_frontend/.dart_tool/package_config.json'),'-O4','-o',
  path.join(scratch,'mobile-call-app.js'),target
],{cwd:root,stdio:'inherit'});
process.exitCode=result.status ?? 1;
