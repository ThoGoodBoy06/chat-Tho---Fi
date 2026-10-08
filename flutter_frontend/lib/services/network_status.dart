import 'package:flutter/foundation.dart';
import 'package:universal_html/html.dart' as html;

class NetworkStatus {
  static final online = ValueNotifier<bool>(!kIsWeb || html.window.navigator.onLine != false);
  static bool _initialized = false;
  static void initialize() {
    if (_initialized || !kIsWeb) return;
    _initialized = true;
    html.window.onOffline.listen((_) => online.value = false);
    html.window.onOnline.listen((_) => online.value = true);
  }
}
