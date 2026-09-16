import 'dart:html' as html;
import 'dart:js' as js;

void removeLoadingScreen() {
  try {
    final element = html.document.getElementById('loading-screen');
    element?.remove();
  } catch (_) {}
}

void redirectToAdmin() {
  try {
    html.window.location.href = '/admin';
  } catch (_) {}
}

void triggerPwaInstall() {
  try {
    if (js.context.hasProperty('triggerPwaInstall')) {
      js.context.callMethod('triggerPwaInstall');
    }
  } catch (_) {}
}

bool canInstallPwa() {
  try {
    if (js.context.hasProperty('canInstallPwa')) {
      return js.context.callMethod('canInstallPwa') == true;
    }
  } catch (_) {}
  return false;
}
