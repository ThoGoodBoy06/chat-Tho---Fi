{{flutter_js}}
{{flutter_build_config}}

for (const build of _flutter.buildConfig.builds) {
  if (build.mainJsPath) build.mainJsPath += '?v=__APP_BUILD_VERSION__';
}
_flutter.loader.load({
  config: {renderer: 'canvaskit', canvasKitBaseUrl: 'canvaskit/', useColorEmoji: true},
  serviceWorkerSettings: null
});
