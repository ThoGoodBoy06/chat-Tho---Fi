import 'package:universal_html/html.dart' as html;

// Browser MediaStream methods can return JS-backed lists with a dynamic element
// type. A typed predicate passed to .any() then fails at runtime in dart2js.
bool hasLiveCallTrack(Iterable<dynamic> tracks) {
  for (final track in tracks) {
    if ((track as html.MediaStreamTrack).readyState == 'live') return true;
  }
  return false;
}

void requireCallTracks(html.MediaStream? stream, {required bool video}) {
  if (stream == null || !hasLiveCallTrack(stream.getAudioTracks())) {
    throw StateError('Không lấy được micro. Hãy cho phép micro trong cài đặt trang web.');
  }
  if (video && !hasLiveCallTrack(stream.getVideoTracks())) {
    throw StateError('Không lấy được camera. Hãy cho phép camera trong cài đặt trang web.');
  }
}

String callMediaError(Object error) {
  final text = error.toString();
  if (text.contains('NotAllowed') || text.contains('PermissionDenied') || text.contains('SecurityError')) {
    return 'Chưa được phép dùng micro/camera. Mở cài đặt trang web, cho phép rồi gọi lại.';
  }
  if (text.contains('NotFound') || text.contains('DevicesNotFound')) {
    return 'Không tìm thấy micro/camera trên thiết bị.';
  }
  if (text.contains('NotReadable') || text.contains('TrackStart')) {
    return 'Không mở được micro/camera. Đóng app đang sử dụng chúng rồi gọi lại.';
  }
  if (error is StateError) return error.message.toString();
  return 'Không kết nối được cuộc gọi. Kiểm tra mạng và quyền micro/camera rồi gọi lại.';
}
