import 'package:flutter_frontend/utils/call_session.dart';
import 'package:flutter_test/flutter_test.dart';
void main() {
  test('events from an older call with the same peer are ignored', () {
    expect(matchesCallSession({'callId':'old'}, 'current'), false);
    expect(matchesCallSession({'callId':'current'}, 'current'), true);
  });
  test('legacy calls remain compatible during deployment', () {
    expect(matchesCallSession({}, 'current'), true);
    expect(matchesCallSession({'callId':'current'}, null), true);
  });
}
