param([Parameter(Mandatory=$true)][string]$FlutterSdk)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskFrontend = Join-Path $taskRoot 'flutter_frontend'
$taskBootstrap = Get-ChildItem -LiteralPath (Join-Path $taskFrontend '.dart_tool/flutter_build') -Recurse -Filter main.dart |
    Where-Object { (Get-Content -LiteralPath $_.FullName -Raw).Contains("import 'package:flutter_frontend/main.dart' as entrypoint;") } |
    Select-Object -First 1
if (!$taskBootstrap) { throw 'Missing production Flutter bootstrap. Generate with flutter build web --target lib/main.dart.' }
$taskOutputDir = Join-Path $taskFrontend '.dart_tool/production_release'
New-Item -ItemType Directory -Path $taskOutputDir -Force | Out-Null
$taskOutput = Join-Path $taskOutputDir 'main.dart.js'
Write-Output 'Building production entrypoint: package:flutter_frontend/main.dart'
Push-Location $taskFrontend
try {
    & "$FlutterSdk/bin/cache/dart-sdk/bin/dart.exe" --disable-dart-dev "$FlutterSdk/bin/cache/dart-sdk/bin/snapshots/dart2js.dart.snapshot" "--platform-binaries=$FlutterSdk/bin/cache/flutter_web_sdk/kernel" '--invoker=flutter_tool' '-Ddart.vm.product=true' '-DFLUTTER_WEB_USE_SKIA=true' '-DFLUTTER_WEB_AUTO_DETECT=false' -O4 --no-source-maps '--packages=.dart_tool/package_config.json' -o $taskOutput $taskBootstrap.FullName
    if ($LASTEXITCODE -ne 0) { throw 'Production compilation failed.' }
    $taskDependencies = Get-Content -LiteralPath ($taskOutput + '.deps') -Raw
    if ($taskDependencies.Contains('perf-preview.dart') -or !$taskDependencies.Contains('/lib/main.dart')) {
        throw 'Invalid entrypoint in release dependencies.'
    }
    Copy-Item -LiteralPath $taskOutput -Destination 'build/web/main.dart.js' -Force
} finally { Pop-Location }
