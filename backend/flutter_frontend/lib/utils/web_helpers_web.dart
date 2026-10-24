import 'dart:async';
import 'call_media.dart';
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

void forceDismissWebCallDialog() {
  try {
    if (js_util.hasProperty(html.window, 'dismissIncomingCallNow')) {
      js_util.callMethod(html.window, 'dismissIncomingCallNow', []);
    }
  } catch (e) {
    print('Lỗi gọi dismissIncomingCallNow từ Web JS: $e');
  }
}

void registerVideoPlayerView(String viewId, String videoUrl) {
  try {
    ui_web.platformViewRegistry.registerViewFactory(
      viewId,
      (int id) {
        final videoEl = html.VideoElement()
          ..src = videoUrl
          ..controls = true
          ..autoplay = true
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.objectFit = 'contain'
          ..style.backgroundColor = '#000000'
          ..style.borderRadius = '16px';
        return videoEl;
      },
    );
  } catch (e) {
    print('Lỗi registerVideoPlayerView: $e');
  }
}


void vibrateWeb(Object pattern) {
  final navigator = js.context['navigator'];
  if (navigator != null && js_util.hasProperty(navigator, 'vibrate')) {
    js_util.callMethod(navigator, 'vibrate', [
      pattern is List ? js_util.jsify(pattern) : pattern,
    ]);
  }
}

bool isWebPushRegistered() {
  try {
    return js_util.callMethod(html.window, 'isWebPushRegistered', []) == true;
  } catch (_) { return false; }
}

void markWebPushRegistered(bool registered) {
  try { js_util.callMethod(html.window, 'markWebPushRegistered', [registered]); }
  catch (_) {}
}

dynamic callWebFunction(String name, List<dynamic> arguments) => js_util.callMethod(html.window, name, arguments);

html.VideoElement registerCallVideoView(String viewType, String elementId) {
  final video = html.VideoElement()..id = elementId;
  video.autoplay = true;
  video.muted = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.style
    ..position = 'relative'
    ..top = '0'
    ..left = '0'
    ..right = 'auto'
    ..width = '100%'
    ..height = '100%'
    ..objectFit = 'cover'
    ..backgroundColor = '#000000'
    ..display = 'block'
    ..zIndex = 'auto'
    ..pointerEvents = 'none';

  ui_web.platformViewRegistry.registerViewFactory(viewType, (int id) {
    return video;
  });
  return video;
}

// Modern browsers resolve createOffer/createAnswer with a plain SDP dictionary.
// Dart 3.4 dart:html incorrectly expects an RTCSessionDescription instance.
Future<Map<String, dynamic>> createCallDescription(html.RtcPeerConnection connection,
    {bool answer = false, bool video = false, bool iceRestart = false}) async {
  final options = <String, dynamic>{
    'offerToReceiveAudio': true,
    'offerToReceiveVideo': video,
    if (iceRestart) 'iceRestart': true,
  };
  final native = await js_util.promiseToFuture<Object>(js_util.callMethod(
      connection, answer ? 'createAnswer' : 'createOffer', [js_util.jsify(options)]));
  return {'type': js_util.getProperty(native, 'type'), 'sdp': js_util.getProperty(native, 'sdp')};
}

Future<html.MediaStream> requestCallMedia({required bool video}) {
  final devices = html.window.navigator.mediaDevices;
  if (devices == null) {
    return Future.error(StateError('Không truy cập được micro. Mở app bằng HTTPS trong Safari hoặc Chrome.'));
  }
  return acquireCallMedia(video: video, request: (constraints) => devices.getUserMedia(constraints));
}

Future<void> replaceCallMicrophone(html.RtcPeerConnection? connection, html.MediaStream stream) async {
  if (connection == null) { stopCallMedia(stream); throw StateError('Cuộc gọi chưa kết nối.'); }
  try {
    final senders = js_util.callMethod(connection, 'getSenders', []) as List;
    for (final sender in senders) {
      final track = js_util.getProperty(sender, 'track');
      if (track != null && js_util.getProperty(track, 'kind') == 'audio') {
        await js_util.promiseToFuture(js_util.callMethod(sender, 'replaceTrack', [stream.getAudioTracks().first]));
        return;
      }
    }
    throw StateError('Không tìm thấy đường truyền micro.');
  } catch (_) { stopCallMedia(stream); rethrow; }
}
