import 'dart:html' as html;

void removeLoadingScreen() {
  try {
    final element = html.document.getElementById('loading-screen');
    element?.remove();
  } catch (_) {}
}
