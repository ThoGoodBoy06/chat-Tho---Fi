import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/utils/call_duration.dart';

void main() {
  test('call duration covers connection, minutes and hours', () {
    expect(formatCallDuration(0), '00:00');
    expect(formatCallDuration(61), '01:01');
    expect(formatCallDuration(3599), '59:59');
    expect(formatCallDuration(3600), '01:00:00');
    expect(formatCallDuration(3661), '01:01:01');
  });
}
