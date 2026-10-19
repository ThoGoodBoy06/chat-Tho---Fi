import 'dart:async';
import 'dart:js_util' as js;
import 'package:universal_html/html.dart' as html;
import 'package:flutter_frontend/utils/call_media.dart';
import 'package:flutter_frontend/utils/web_helpers.dart';

Future<Map<String, num>> audioStats(html.RtcPeerConnection pc) async {
  final report = await js.promiseToFuture<dynamic>(js.callMethod(pc, 'getStats', []));
  final totals = <String, num>{'sent': 0, 'received': 0, 'energy': 0};
  js.callMethod(report, 'forEach', [js.allowInterop((dynamic value, dynamic key, dynamic map) {
    final type = js.getProperty(value, 'type');
    final kind = js.getProperty(value, 'kind');
    if (kind != 'audio') return;
    if (type == 'media-source') totals['sourceEnergy'] = js.getProperty(value, 'totalAudioEnergy') ?? 0;
    if (type == 'outbound-rtp') totals['bytesSent'] = js.getProperty(value, 'bytesSent') ?? 0;
    if (type == 'inbound-rtp') totals['bytesReceived'] = js.getProperty(value, 'bytesReceived') ?? 0;
    if (type == 'outbound-rtp') totals['sent'] = js.getProperty(value, 'packetsSent') ?? 0;
    if (type == 'inbound-rtp') {
      totals['received'] = js.getProperty(value, 'packetsReceived') ?? 0;
      totals['energy'] = js.getProperty(value, 'totalAudioEnergy') ?? 0;
    }
  })]);
  return totals;
}

void phase(String message) => js.setProperty(html.window, 'callTransportTestPhase', message);

Future<void> main() async {
  final video = Uri.base.queryParameters['video'] != 'false';
  final a = html.RtcPeerConnection({'iceServers': []});
  final b = html.RtcPeerConnection({'iceServers': []});
  html.MediaStream? first, second;
  try {
    phase("callWebFunction('unlockAudio', []);");
    callWebFunction('unlockAudio', []);
    phase("first = await");
    first = await html.window.navigator.mediaDevices!.getUserMedia({'audio': true, 'video': video});
    phase("second = await");
    second = await html.window.navigator.mediaDevices!.getUserMedia({'audio': true, 'video': video});
    phase("requireCallTracks(first");
    for (final stream in [first, second]) {
      for (final track in stream.getAudioTracks()) { stream.removeTrack(track); track.stop(); }
      final tone = js.callMethod<html.MediaStream>(html.window, 'createTestToneStream', []);
      for (final track in tone.getAudioTracks()) { stream.addTrack(track); }
    }
    final sourceRms = await js.promiseToFuture<num>(js.callMethod(html.window, 'measureTestStream', [first]));
    requireCallTracks(first, video: video);
    requireCallTracks(second, video: video);
    final receivedA = html.MediaStream(), receivedB = html.MediaStream();
    void receive(html.MediaStream into, html.RtcTrackEvent event) {
      final ids = <Object?>{};
      for (final track in into.getTracks()) { ids.add(track.id); }
      if (event.track != null && !ids.contains(event.track!.id)) into.addTrack(event.track!);
      if (into.getAudioTracks().isNotEmpty) callWebFunction('attachRemoteStream', [into]);
    }
    a.onTrack.listen((event) => receive(receivedA, event));
    b.onTrack.listen((event) => receive(receivedB, event));
    final pendingA = <html.RtcIceCandidate>[], pendingB = <html.RtcIceCandidate>[];
    a.onIceCandidate.listen((event) { if (event.candidate != null) { if (b.remoteDescription == null) {pendingB.add(event.candidate!);} else {b.addIceCandidate(event.candidate!);} } });
    b.onIceCandidate.listen((event) { if (event.candidate != null) { if (a.remoteDescription == null) {pendingA.add(event.candidate!);} else {a.addIceCandidate(event.candidate!);} } });
    for (final track in first.getTracks()) { a.addTrack(track, first); }
    for (final track in second.getTracks()) { b.addTrack(track, second); }
    phase("final offer = await");
    final offer = await createCallDescription(a, video: video);
    phase("await a.setLocalDescription");
    await a.setLocalDescription({'type': offer['type'], 'sdp': offer['sdp']});
    phase("await b.setRemoteDescription");
    await b.setRemoteDescription({'type': offer['type'], 'sdp': offer['sdp']});
    for (final candidate in pendingB) { await b.addIceCandidate(candidate); }
    phase("final answer = await");
    final answer = await createCallDescription(b, answer: true, video: video);
    phase("await b.setLocalDescription");
    await b.setLocalDescription({'type': answer['type'], 'sdp': answer['sdp']});
    phase("await a.setRemoteDescription");
    await a.setRemoteDescription({'type': answer['type'], 'sdp': answer['sdp']});
    for (final candidate in pendingA) { await a.addIceCandidate(candidate); }
    phase("Map<String, num> statsA");
    Map<String, num> statsA = {}, statsB = {};
    for (var i = 0; i < 100; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      statsA = await audioStats(a); statsB = await audioStats(b);
      if ((statsA['received'] ?? 0) > 60 && (statsB['received'] ?? 0) > 60) break;
    }
    final aRms = await js.promiseToFuture<num>(js.callMethod(html.window, 'measureTestStream', [receivedA]));
    final bRms = await js.promiseToFuture<num>(js.callMethod(html.window, 'measureTestStream', [receivedB]));
    final audio = html.document.getElementById('remoteAudioPlayer') as html.AudioElement;
    js.setProperty(html.window, 'callTransportTestResult', js.jsify({
      'sinkHasStream': audio.srcObject != null, 'sinkPaused': audio.paused, 'sinkReady': audio.readyState, 'sourceRms': sourceRms,
      'contextState': js.getProperty(js.getProperty(html.window, '_callAudioCtx'), 'state'),
      'a': statsA, 'b': statsB, 'aRms': aRms, 'bRms': bRms, 'audioMuted': audio.muted,
      'aAudioTracks': receivedA.getAudioTracks().length, 'bAudioTracks': receivedB.getAudioTracks().length,
      'aVideoTracks': receivedA.getVideoTracks().length, 'bVideoTracks': receivedB.getVideoTracks().length,
    }));
  } catch (error, stack) {
    js.setProperty(html.window, 'callTransportTestResult', js.jsify({'error': '$error', 'stack': '$stack'}));
  } finally {
    a.close(); b.close();
    for (final stream in [first, second]) { for (final track in stream?.getTracks() ?? <html.MediaStreamTrack>[]) {track.stop();} }
    callWebFunction('stopCallAudio', []);
  }
}
