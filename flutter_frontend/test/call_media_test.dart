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
  List<html.MediaStreamTrack> getTracks() => [...audio, ...video];
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('voice capture requests no camera and does not retry missing hardware', () async {
    var attempts = 0;
    await expectLater(acquireCallMedia(video: false, request: (constraints) async {
      attempts++; expect(constraints['video'], false); throw Exception('NotFoundError');
    }), throwsException);
    expect(attempts, 1);
    expect(callMediaError(Exception('NotFoundError'), video: false), isNot(contains('camera')));
  });
  test('permission denial does not request permission twice', () async {
    var attempts = 0;
    await expectLater(acquireCallMedia(video: true, request: (_) async {
      attempts++; throw Exception('NotAllowedError');
    }), throwsException);
    expect(attempts, 1);
  });
  test('unsupported constraints retry simple capture and retain live audio', () async {
    var attempts = 0; final stream = _Stream([_Track('live')], []);
    final captured = await acquireCallMedia(video: false, request: (constraints) async {
      if (++attempts == 1) throw Exception('OverconstrainedError');
      expect(constraints, {'audio': true, 'video': false}); return stream;
    });
    expect(captured, same(stream)); expect(attempts, 2);
  });
  test('failed camera validation releases the microphone already captured', () async {
    final microphone = _StoppableTrack('live'); final stream = _Stream([microphone], []);
    await expectLater(acquireCallMedia(video: true, request: (_) async => stream), throwsStateError);
    expect(microphone.stopped, true);
  });
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

class _StoppableTrack extends _Track {
  bool stopped = false;
  _StoppableTrack(String state) : super(state);
  void stop() { stopped = true; }
}
