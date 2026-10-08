/// Serialize SDP/ICE operations and discard waiting work after hangup.
class CallSignalQueue {
  Future<void> _tail = Future<void>.value();
  bool _closed = false;

  Future<void> run(Future<void> Function() action) {
    final work = _tail.then((_) async {
      if (!_closed) await action();
    });
    _tail = work.catchError((Object _) {});
    return work;
  }

  void close() => _closed = true;
}
