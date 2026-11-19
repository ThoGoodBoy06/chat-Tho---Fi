{{flutter_js}}
{{flutter_build_config}}

for (const build of _flutter.buildConfig.builds) {
  if (build.mainJsPath) build.mainJsPath += '?v=__APP_BUILD_VERSION__';
}
const _bootConfig = {renderer: 'canvaskit', canvasKitBaseUrl: 'canvaskit/', useColorEmoji: true};
_flutter.loader.load({
  config: _bootConfig,
  serviceWorkerSettings: null,
  onEntrypointLoaded: async function (engineInitializer) {
    if (document.readyState === 'loading') {
      await new Promise(function (resolve) {
        document.addEventListener('DOMContentLoaded', resolve, {once: true});
      });
    }
    const appRunner = await engineInitializer.initializeEngine(_bootConfig);
    await appRunner.runApp();
  }
});
