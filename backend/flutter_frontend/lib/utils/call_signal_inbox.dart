import 'dart:async';

/// Preserve early SDP/ICE during the transition from ringing to the call view.
class CallSignalInbox {
  CallSignalInbox({DateTime Function()? now}) : _now = now ?? DateTime.now {
    _controller = StreamController<Map<String, dynamic>>.broadcast(
      onListen: () => scheduleMicrotask(_flush),
    );
  }
  final DateTime Function() _now;
  late final StreamController<Map<String, dynamic>> _controller;
  final _pending = <MapEntry<DateTime, Map<String, dynamic>>>[];
  Stream<Map<String, dynamic>> get stream => _controller.stream;

  void add(Map<String, dynamic> signal) {
    if (_controller.hasListener) {
      _flush();
      _controller.add(signal);
    } else {
      _pending.removeWhere((entry) => _now().difference(entry.key) > const Duration(seconds: 15));
      if (_pending.length >= 128) _pending.removeAt(0);
      _pending.add(MapEntry(_now(), signal));
    }
  }

  void _flush() {
    if (!_controller.hasListener || _controller.isClosed) return;
    final signals = List.of(_pending);
    _pending.clear();
    for (final entry in signals) {
      if (_now().difference(entry.key) <= const Duration(seconds: 15)) _controller.add(entry.value);
    }
  }

  void clear() => _pending.clear();
  Future<void> close() { clear(); return _controller.close(); }
}
