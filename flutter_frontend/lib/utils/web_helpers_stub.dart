import 'dart:async';

void registerWebQrView(String containerId) {}

void startWebQrScanner(String containerId) {}

void stopWebQrScanner() {}

void scanWebQrImage(String dataUrl) {}

StreamSubscription? listenWebQrEvent(Function(String payload) onScanned) {
  return null;
}

Future<String?> getFcmTokenFromWebJs() async {
  return null;
}
