import 'package:universal_html/html.dart' as html;

void requireCallTracks(html.MediaStream? stream, {required bool video}) {
  if (stream == null || !stream.getAudioTracks().any((t) => t.readyState == 'live')) {
    throw StateError('Không lấy được micro. Hãy cho phép micro trong cài đặt trang web.');
  }
  if (video && !stream.getVideoTracks().any((t) => t.readyState == 'live')) {
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
