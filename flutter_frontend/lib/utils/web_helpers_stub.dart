import 'dart:async';

void registerWebQrView(String containerId) {}

void startWebQrScanner(String containerId) {}

void stopWebQrScanner() {}

void scanWebQrImage(String dataUrl) {}

StreamSubscription? listenWebQrEvent(Function(String payload) onScanned) {
  return null;
}

Future<String?> getFcmTokenFromWebJs([String? vapidKey]) async {
  return null;
}

String getWebDeviceId() {
  return 'mobile_stub_device';
}
