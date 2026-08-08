import 'dart:async';
import 'dart:js' as js;
import 'dart:js_util' as js_util;
import 'dart:ui_web' as ui_web;
import 'package:universal_html/html.dart' as html;

void registerWebQrView(String containerId) {
  try {
    ui_web.platformViewRegistry.registerViewFactory(
      containerId,
      (int viewId) {
        final element = html.DivElement()
          ..id = containerId
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.background = 'black';
        return element;
      },
    );
  } catch (e) {}
}

void startWebQrScanner(String containerId) {
  try {
    final jsObj = js.context['webQrScanner'];
    if (jsObj != null) {
      jsObj.callMethod('start', [containerId]);
    }
  } catch (e) {}
}

void stopWebQrScanner() {
  try {
    final jsObj = js.context['webQrScanner'];
    if (jsObj != null) {
      jsObj.callMethod('stop', []);
    }
  } catch (e) {}
}

void scanWebQrImage(String dataUrl) {
  try {
    final jsObj = js.context['webQrScanner'];
    if (jsObj != null) {
      jsObj.callMethod('scanImage', [dataUrl]);
    }
  } catch (e) {}
}

StreamSubscription? listenWebQrEvent(Function(String payload) onScanned) {
  try {
    return html.window.on['qr-scanned'].listen((html.Event event) {
      if (event is html.CustomEvent && event.detail != null) {
        onScanned(event.detail.toString());
      }
    });
  } catch (e) {
    return null;
  }
}

Future<String?> getFcmTokenFromWebJs([String? vapidKey]) async {
  try {
    if (js_util.hasProperty(html.window, 'registerFCMAndGetToken')) {
      final args = vapidKey != null ? [vapidKey] : [];
      final promise = js_util.callMethod(html.window, 'registerFCMAndGetToken', args);
      final token = await js_util.promiseToFuture(promise);
      if (token != null && token.toString().isNotEmpty) {
        return token.toString();
      }
    }
  } catch (e) {
    print('❌ [Web JS Interop] Lỗi lấy FCM Token: $e');
  }
  return null;
}

String getWebDeviceId() {
  try {
    if (js_util.hasProperty(html.window, 'getWebDeviceId')) {
      final id = js_util.callMethod(html.window, 'getWebDeviceId', []);
      return id.toString();
    }
  } catch (_) {}
  return 'web_unknown_device';
}

bool isNotificationPermissionGranted() {
  try {
    return html.Notification.permission == 'granted';
  } catch (_) {}
  return false;
}

Future<bool> requestWebNotificationPermission() async {
  try {
    final res = await html.Notification.requestPermission();
    return res == 'granted';
  } catch (_) {}
  return false;
}
