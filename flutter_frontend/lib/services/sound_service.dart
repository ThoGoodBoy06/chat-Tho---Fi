import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class SoundService {
  static final AudioPlayer _ringtonePlayer = AudioPlayer();
  static final AudioPlayer _tutTutPlayer = AudioPlayer();
  static final AudioPlayer _messagePlayer = AudioPlayer();
  static bool _isPlayingRingtone = false;
  static bool _isPlayingTutTut = false;

  /// Phát âm thanh chuông cuộc gọi đến (lặp lại cho đến khi nghe/từ chối)
  static Future<void> playRingtone() async {
    if (_isPlayingRingtone) return;
    try {
      _isPlayingRingtone = true;
      await _ringtonePlayer.setReleaseMode(ReleaseMode.loop);
      if (kIsWeb) {
        try {
          await _ringtonePlayer.play(UrlSource('/ringtone.mp3'));
        } catch (_) {
          await _ringtonePlayer.play(UrlSource('https://chat-tho-fi.vn/ringtone.mp3'));
        }
      } else {
        try {
          await _ringtonePlayer.play(AssetSource('sounds/ringtone.mp3'));
        } catch (_) {
          await _ringtonePlayer.play(UrlSource('https://chat-tho-fi.vn/ringtone.mp3'));
        }
      }
      debugPrint('🔔 [SoundService] Đang phát chuông cuộc gọi đến...');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi phát chuông cuộc gọi: $e');
    }
  }

  /// Dừng âm thanh chuông cuộc gọi đến
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

  /// Phát âm thanh chờ tút tút khi người dùng gọi đi
  static Future<void> playTutTut() async {
    if (_isPlayingTutTut) return;
    try {
      _isPlayingTutTut = true;
      await _tutTutPlayer.setReleaseMode(ReleaseMode.loop);
      if (kIsWeb) {
        try {
          await _tutTutPlayer.play(UrlSource('/tuttut.mp3'));
        } catch (_) {
          await _tutTutPlayer.play(UrlSource('https://chat-tho-fi.vn/tuttut.mp3'));
        }
      } else {
        try {
          await _tutTutPlayer.play(AssetSource('sounds/tuttut.mp3'));
        } catch (_) {
          await _tutTutPlayer.play(UrlSource('https://chat-tho-fi.vn/tuttut.mp3'));
        }
      }
      debugPrint('📞 [SoundService] Đang phát âm thanh chờ tút tút...');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi phát âm thanh tút tút: $e');
    }
  }

  /// Dừng âm thanh tút tút
  static Future<void> stopTutTut() async {
    if (!_isPlayingTutTut) return;
    try {
      _isPlayingTutTut = false;
      await _tutTutPlayer.stop();
      debugPrint('🔇 [SoundService] Đã dừng âm thanh tút tút.');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi dừng tút tút: $e');
    }
  }

  /// Dừng tất cả âm thanh cuộc gọi (cả chuông gọi đến và tút tút)
  static Future<void> stopAllCallSounds() async {
    await stopRingtone();
    await stopTutTut();
  }

  /// Phát âm thanh thông báo tin nhắn 1 lần & rung điện thoại
  static Future<void> playMessageSound() async {
    try {
      try {
        await HapticFeedback.vibrate();
        await HapticFeedback.heavyImpact();
      } catch (e) {
        debugPrint('Vibration error: $e');
      }

      await _messagePlayer.stop();
      await _messagePlayer.setReleaseMode(ReleaseMode.release);
      if (kIsWeb) {
        try {
          await _messagePlayer.play(UrlSource('/amthanhtinnhan.mp3'));
        } catch (_) {
          await _messagePlayer.play(UrlSource('https://chat-tho-fi.vn/amthanhtinnhan.mp3'));
        }
      } else {
        try {
          await _messagePlayer.play(AssetSource('sounds/amthanhtinnhan.mp3'));
        } catch (_) {
          await _messagePlayer.play(UrlSource('https://chat-tho-fi.vn/amthanhtinnhan.mp3'));
        }
      }
      debugPrint('🎵 [SoundService] Đã phát âm thanh amthanhtinnhan.mp3 & rung điện thoại.');
    } catch (e) {
      debugPrint('⚠️ [SoundService] Lỗi khi phát âm thanh tin nhắn: $e');
    }
  }

  /// Giải phóng tài nguyên
  static void dispose() {
    _ringtonePlayer.dispose();
    _tutTutPlayer.dispose();
    _messagePlayer.dispose();
  }
}
