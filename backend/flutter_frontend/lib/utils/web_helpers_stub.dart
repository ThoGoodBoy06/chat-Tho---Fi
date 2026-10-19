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

bool isNotificationPermissionGranted() => true;
bool isWebPushRegistered() => false;
void markWebPushRegistered(bool registered) {}
Future<bool> requestWebNotificationPermission() async => true;

void forceDismissWebCallDialog() {}

void registerVideoPlayerView(String viewId, String videoUrl) {}

void vibrateWeb(Object pattern) {}

dynamic callWebFunction(String name, List<dynamic> arguments) => null;

dynamic registerCallVideoView(String viewType, String elementId) => null;

Future<Map<String, dynamic>> createCallDescription(dynamic connection,
    {bool answer = false, bool video = false, bool iceRestart = false}) =>
    Future.error(UnsupportedError('WebRTC browser bridge requires the web platform'));
