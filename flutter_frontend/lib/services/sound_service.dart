import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

class SoundService {
  static final AudioPlayer _ringtonePlayer = AudioPlayer();
  static final AudioPlayer _messagePlayer = AudioPlayer();
  static bool _isPlayingRingtone = false;

  /// Phát âm thanh chuông cuộc gọi (Lặp lại cho đến khi dừng)
  static Future<void> playRingtone() async {
    if (_isPlayingRingtone) return;
    try {
      _isPlayingRingtone = true;
      await _ringtonePlayer.setReleaseMode(ReleaseMode.loop);
      if (kIsWeb) {
        // Trên Web phát sound qua URL tĩnh từ backend hoặc asset
        await _ringtonePlayer.play(UrlSource('/ringtone.mp3'));
      } else {
        await _ringtonePlayer.play(AssetSource('sounds/ringtone.mp3'));
      }
      debugPrint('🔔 [SoundService] Đang phát chuông cuộc gọi đến...');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi phát chuông cuộc gọi: $e');
    }
  }

  /// Dừng âm thanh chuông cuộc gọi
  static Future<void> stopRingtone() async {
    if (!_isPlayingRingtone) return;
    try {
      _isPlayingRingtone = false;
      await _ringtonePlayer.stop();
      debugPrint('🔇 [SoundService] Đã dừng chuông cuộc gọi.');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi dừng chuông: $e');
    }
  }

  /// Phát âm thanh thông báo tin nhắn 1 lần
  static Future<void> playMessageSound() async {
    try {
      await _messagePlayer.setReleaseMode(ReleaseMode.release);
      if (kIsWeb) {
        await _messagePlayer.play(UrlSource('/amthanhtinnhan.mp3'));
      } else {
        await _messagePlayer.play(AssetSource('sounds/message.mp3'));
      }
      debugPrint('🎵 [SoundService] Đã phát âm thanh tin nhắn mới.');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi phát âm thanh tin nhắn: $e');
    }
  }

  /// Giải phóng tài nguyên
  static void dispose() {
    _ringtonePlayer.dispose();
    _messagePlayer.dispose();
  }
}
