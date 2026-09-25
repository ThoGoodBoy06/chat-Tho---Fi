param([string]$FlutterPath = 'flutter')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $projectRoot 'flutter_frontend')
try {
  & $FlutterPath --no-version-check build web --release --no-pub --web-renderer canvaskit --pwa-strategy none --no-tree-shake-icons
  if ($LASTEXITCODE -ne 0) { throw 'Flutter Web release build failed.' }
} finally {
  Pop-Location
}
& node (Join-Path $PSScriptRoot 'prepare-web-release.js')
if ($LASTEXITCODE -ne 0) { throw 'Preparing release assets failed.' }
