import 'package:flutter_frontend/utils/call_signal_inbox.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('offer arriving before call view is preserved ahead of new ICE', () async {
    final inbox = CallSignalInbox();
    inbox.add({'type': 'offer'});
    inbox.add({'type': 'candidate-1'});
    final received = <String>[];
    final subscription = inbox.stream.listen((signal) => received.add(signal['type'] as String));
    inbox.add({'type': 'candidate-2'});
    await Future<void>.delayed(Duration.zero);
    expect(received, ['offer', 'candidate-1', 'candidate-2']);
    await subscription.cancel();
    await inbox.close();
  });
  test('hangup clears early signals before the next call', () async {
    final inbox = CallSignalInbox();
    inbox.add({'type': 'old-offer'});
    inbox.clear();
    inbox.add({'type': 'new-offer'});
    final received = <String>[];
    final subscription = inbox.stream.listen((signal) => received.add(signal['type'] as String));
    await Future<void>.delayed(Duration.zero);
    expect(received, ['new-offer']);
    await subscription.cancel();
    await inbox.close();
  });
  test('stale signals expire while waiting for a listener', () async {
    var now = DateTime(2026);
    final inbox = CallSignalInbox(now: () => now);
    inbox.add({'type': 'expired'});
    now = now.add(const Duration(seconds: 16));
    inbox.add({'type': 'offer'});
    final received = <String>[];
    final subscription = inbox.stream.listen((signal) => received.add(signal['type'] as String));
    await Future<void>.delayed(Duration.zero);
    expect(received, ['offer']);
    await subscription.cancel();
    await inbox.close();
  });
}
