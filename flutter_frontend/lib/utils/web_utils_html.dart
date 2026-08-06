import 'dart:html' as html;

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
