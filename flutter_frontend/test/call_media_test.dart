import 'package:flutter_frontend/utils/call_media.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:universal_html/html.dart' as html;

class _Track implements html.MediaStreamTrack {
  @override
  final String readyState;
  _Track(this.readyState);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Stream implements html.MediaStream {
  final List<html.MediaStreamTrack> audio, video;
  _Stream(this.audio, this.video);
  @override
  List<html.MediaStreamTrack> getAudioTracks() => audio;
  @override
  List<html.MediaStreamTrack> getVideoTracks() => video;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('cannot start a silent call with missing or ended microphone', () {
    for (final stream in [null, _Stream([], []), _Stream([_Track('ended')], [])]) {
      expect(() => requireCallTracks(stream, video: false), throwsStateError);
    }
  });
  test('voice call requires live audio; video also requires a live camera', () {
    final voice = _Stream([_Track('live')], []);
    requireCallTracks(voice, video: false);
    expect(() => requireCallTracks(voice, video: true), throwsStateError);
    requireCallTracks(_Stream([_Track('live')], [_Track('live')]), video: true);
  });
  test('permission, busy device and missing device errors are actionable', () {
    expect(callMediaError(Exception('NotAllowedError')), contains('cho phép'));
    expect(callMediaError(Exception('NotReadableError')), contains('Đóng app'));
    expect(callMediaError(Exception('NotFoundError')), contains('Không tìm thấy'));
  });
}
