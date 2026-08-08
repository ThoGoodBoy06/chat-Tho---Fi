import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'api_service.dart';
import 'sound_service.dart';
import '../utils/web_helpers.dart';

/// Hàm xử lý thông báo ngầm khi app bị đóng (Kill State / Terminated)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
    debugPrint('🔥 [FCMService] Background Message ID: ${message.messageId}');
    final data = message.data;
    final msgId = data['messageId']?.toString();
    final convId = data['conversationId']?.toString();
    if (msgId != null && msgId.isNotEmpty) {
      final url = Uri.parse('https://chat-tho-fi-vn.onrender.com/api/chat/messages/mark-delivered');
      await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'messageId': msgId,
          if (convId != null) 'conversationId': convId,
        }),
      ).timeout(const Duration(seconds: 8));
      debugPrint('✅ [FCMService] Sent background markAsDelivered for $msgId');
    }
  } catch (e) {
    debugPrint('⚠️ [FCMService] Lỗi xử lý Background Message: $e');
  }
}

class FCMService {
  static bool _isRegistering = false;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  /// Khởi tạo và Đăng ký FCM Device Token
  static Future<void> initAndRegisterToken() async {
    if (_isRegistering) return;
    _isRegistering = true;

    try {
      if (kIsWeb) {
        // 🌐 Xử lý FCM cho nền tảng Web PWA (Thuần Web Push API & Service Worker)
        final token = await getFcmTokenFromWebJs();
        final deviceId = getWebDeviceId();

        if (token != null && token.isNotEmpty) {
          debugPrint('🔥 [FCM Web] Token lấy thành công: ${token.substring(0, 15)}...');
          await ApiService.updateFcmToken(token, platform: 'web', deviceId: deviceId);
        } else {
          debugPrint('⚠️ [FCM Web] Chưa lấy được FCM Token Web (Cần cấp quyền hoặc Add to Home Screen trên iOS 16.4+).');
        }
      } else {
        // 📱 Xử lý FCM cho Mobile Native (Android & iOS)
        await Firebase.initializeApp();

        // Đăng ký Background Handler
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

        // Xin quyền nhận thông báo
        final messaging = FirebaseMessaging.instance;
        final settings = await messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          criticalAlert: true,
        );

        debugPrint('🔔 Authorization status: ${settings.authorizationStatus}');

        // Khởi tạo Local Notifications Channel chỉ riêng cho Mobile
        await _initLocalNotifications();

        // Vòng lặp chờ APNs token sẵn sàng trên iOS và lấy FCM Token
        String? token;
        final platformStr = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

        for (int i = 0; i < 10; i++) {
          try {
            if (defaultTargetPlatform == TargetPlatform.iOS) {
              final apnsToken = await messaging.getAPNSToken();
              debugPrint('🔥 [FCM iOS] APNs Token (Lần $i): $apnsToken');
            }
            token = await messaging.getToken();
            if (token != null && token.isNotEmpty) break;
          } catch (e) {
            debugPrint('⚠️ Thử lần $i lấy FCM token lỗi: $e');
          }
          await Future.delayed(const Duration(milliseconds: 800));
        }

        if (token != null && token.isNotEmpty) {
          debugPrint('🔥 [FCM Mobile] Token lấy thành công: ${token.substring(0, 15)}...');
          await ApiService.updateFcmToken(token, platform: platformStr, deviceId: '${platformStr}_native_device');
        } else {
          debugPrint('⚠️ [FCM Mobile] Chưa lấy được Token thiết bị.');
        }

        // Lắng nghe token thay đổi
        messaging.onTokenRefresh.listen((newToken) {
          ApiService.updateFcmToken(newToken, platform: platformStr, deviceId: '${platformStr}_native_device');
        });

        // Lắng nghe khi app đang mở (Foreground) trên Mobile
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('📩 [FCM Mobile] Tin nhắn Foreground: ${message.notification?.title}');
          _showForegroundNotification(message);
        });

        // Lắng nghe khi người dùng bấm vào thông báo từ background / màn hình chính
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('🔔 [FCM Mobile] Bấm vào thông báo từ background: ${message.data}');
          final convId = message.data['conversationId']?.toString();
          if (convId != null && convId.isNotEmpty) {
            ApiService.markAsRead(convId).catchError((_) {});
          }
        });

        // Xử lý khi mở app từ trạng thái terminated bằng cách bấm thông báo
        messaging.getInitialMessage().then((RemoteMessage? message) {
          if (message != null) {
            debugPrint('🔔 [FCM Mobile] Bấm vào thông báo từ terminated: ${message.data}');
            final convId = message.data['conversationId']?.toString();
            if (convId != null && convId.isNotEmpty) {
              ApiService.markAsRead(convId).catchError((_) {});
            }
          }
        });
      }
    } catch (e) {
      debugPrint('⚠️ [FCMService] Ngoại lệ khi đăng ký FCM: $e');
    } finally {
      _isRegistering = false;
    }
  }

  /// Khởi tạo kênh thông báo Local Notification trên Android/iOS
  static Future<void> _initLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
      requestCriticalPermission: true,
    );

    const initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);
    await _localNotifications.initialize(initSettings);

    // Tạo Notification Channel riêng cho Android
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    if (androidPlugin != null) {
      // Kênh cuộc gọi đến
      const callChannel = AndroidNotificationChannel(
        'incoming_calls_v3',
        'Cuộc gọi đến',
        description: 'Thông báo cuộc gọi đến kèm âm thanh chuông',
        importance: Importance.max,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('ringtone'),
        enableVibration: true,
      );

      // Kênh tin nhắn
      const chatChannel = AndroidNotificationChannel(
        'chat_messages_v3',
        'Tin nhắn mới',
        description: 'Thông báo tin nhắn mới',
        importance: Importance.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('amthanhtinnhan'),
        enableVibration: true,
      );

      await androidPlugin.createNotificationChannel(callChannel);
      await androidPlugin.createNotificationChannel(chatChannel);
    }
  }

  /// Hiển thị thông báo khi app đang chạy Foreground
  static void _showForegroundNotification(RemoteMessage message) {
    final notification = message.notification;
    final data = message.data;

    bool isCall = data['type'] == 'INCOMING_CALL' || data['type'] == 'call';
    if (isCall) {
      SoundService.playRingtone();
    } else {
      SoundService.playMessageSound();
    }

    if (notification != null) {
      _localNotifications.show(
        notification.hashCode,
        notification.title ?? 'Thông báo',
        notification.body ?? '',
        NotificationDetails(
          android: AndroidNotificationDetails(
            isCall ? 'incoming_calls_v3' : 'chat_messages_v3',
            isCall ? 'Cuộc gọi đến' : 'Tin nhắn mới',
            importance: Importance.max,
            priority: Priority.high,
            playSound: true,
            enableVibration: true,
            sound: RawResourceAndroidNotificationSound(isCall ? 'ringtone' : 'amthanhtinnhan'),
          ),
          iOS: DarwinNotificationDetails(
            sound: isCall ? 'ringtone.mp3' : 'amthanhtinnhan.mp3',
            presentSound: true,
            presentAlert: true,
            presentBadge: true,
            presentBanner: true,
            presentList: true,
          ),
        ),
      );
    }
  }
}
