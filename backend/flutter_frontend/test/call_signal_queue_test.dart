import 'dart:async';
import 'package:flutter_frontend/utils/call_signal_queue.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('offer and ICE operations cannot overlap', () async {
    final queue = CallSignalQueue();
    final gate = Completer<void>();
    final events = <String>[];
    final first = queue.run(() async { events.add('offer'); await gate.future; events.add('answer'); });
    final second = queue.run(() async { events.add('candidate'); });
    await Future<void>.delayed(Duration.zero);
    expect(events, ['offer']);
    gate.complete();
    await Future.wait([first, second]);
    expect(events, ['offer', 'answer', 'candidate']);
  });

  test('hangup cancels queued and future signaling work', () async {
    final queue = CallSignalQueue();
    final gate = Completer<void>();
    var sends = 0;
    final first = queue.run(() async { await gate.future; });
    await Future<void>.delayed(Duration.zero);
    final waiting = queue.run(() async { sends++; });
    queue.close();
    gate.complete();
    await Future.wait([first, waiting]);
    await queue.run(() async { sends++; });
    expect(sends, 0);
  });

  test('a rejected operation does not block later signals', () async {
    final queue = CallSignalQueue();
    await expectLater(queue.run(() async { throw StateError('closed connection'); }), throwsStateError);
    var processed = false;
    await queue.run(() async { processed = true; });
    expect(processed, isTrue);
  });
}
