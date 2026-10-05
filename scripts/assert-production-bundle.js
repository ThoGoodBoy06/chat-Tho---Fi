const fs = require('fs');
function assertProductionBundle(file) {
  const bundle = fs.readFileSync(file, 'utf8');
  for (const marker of ['preview-room', 'fixture-', 'PERF_SAMPLE frames=', 'perf-preview.dart']) {
    if (bundle.includes(marker)) throw Error('Refusing to publish performance preview bundle: ' + marker);
  }
}
module.exports = {assertProductionBundle};
