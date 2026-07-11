import 'package:flutter/foundation.dart'; // Import kIsWeb
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dash_bubble/dash_bubble.dart';

// Biến toàn cục để quản lý Notifications
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

// Cần pragma này để chạy ngầm trên Android
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print("📩 Nhận tin nhắn chạy ngầm (Background): ${message.messageId}");
  
  // Hiển thị thông báo nội bộ nếu đây là tin nhắn data-only (không có payload notification, ví dụ: cuộc gọi đến)
  if (message.notification == null) {
    _showLocalNotification(message);
  }
  
  _showChatBubble(message);
}

// Hàm hiển thị thông báo nội bộ (Foreground hoặc khi nhận cuộc gọi chạy ngầm)
void _showLocalNotification(RemoteMessage message) {
  final data = message.data;
  final type = data['type'];
  final title = message.notification?.title ?? data['title'] ?? "Tin nhắn mới";
  final body = message.notification?.body ?? data['body'] ?? "Nhấn để mở";

  if (type == 'incoming_call') {
    // Thông báo cuộc gọi đến
    flutterLocalNotificationsPlugin.show(
      message.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'incoming_calls', // channel id
          'Incoming Calls', // channel name
          channelDescription: 'Kênh nhận thông báo cuộc gọi đến Chat Tho-Fi.',
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.high,
          sound: RawResourceAndroidNotificationSound('ringtone'),
          playSound: true,
        ),
      ),
    );
  } else {
    // Thông báo tin nhắn thường
    flutterLocalNotificationsPlugin.show(
      message.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'chat_messages', // channel id
          'Chat Messages', // channel name
          channelDescription: 'Kênh nhận thông báo tin nhắn Chat Tho-Fi.',
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.high,
          sound: RawResourceAndroidNotificationSound('amthanhtinnhan'),
          playSound: true,
        ),
      ),
    );
  }
}

// Hàm hiển thị bong bóng chat (Overlay)
void _showChatBubble(RemoteMessage message) async {
  try {
    final hasPermission = await DashBubble.instance.hasOverlayPermission();
    if (!hasPermission) {
      print("⚠️ Chưa có quyền hiển thị trên ứng dụng khác để bật bong bóng chat.");
      return;
    }

    final title = message.notification?.title ?? message.data['title'] ?? "Tin nhắn mới";
    final body = message.notification?.body ?? message.data['body'] ?? "Nhấn để mở cuộc trò chuyện";

    // Dừng bong bóng cũ nếu đang chạy để cập nhật tin nhắn mới
    final isRunning = await DashBubble.instance.isRunning();
    if (isRunning) {
      await DashBubble.instance.stopBubble();
    }

    await DashBubble.instance.startBubble(
      bubbleOptions: BubbleOptions(
        bubbleIcon: "ic_launcher", // Tên launcher icon của Android
        enableClose: true,
        enableAnimateToEdge: true,
      ),
      notificationOptions: NotificationOptions(
        title: title,
        body: body,
        icon: "ic_launcher",
      ),
      onTap: () {
        print("Tapped chat bubble!");
      },
    );
  } catch (e) {
    print("Lỗi hiển thị bong bóng chat: $e");
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb) {
    try {
      // Khởi tạo Firebase SDK
      await Firebase.initializeApp();
      
      // Thiết lập bộ lắng nghe chạy ngầm (background)
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // 1. Cấu hình Kênh thông báo cho TIN NHẮN THƯỜNG (amthanhtinnhan.mp3)
      const AndroidNotificationChannel chatChannel = AndroidNotificationChannel(
        'chat_messages', 
        'Chat Messages', 
        description: 'Kênh nhận thông báo tin nhắn Chat Tho-Fi.', 
        importance: Importance.max,
        sound: RawResourceAndroidNotificationSound('amthanhtinnhan'),
        playSound: true,
      );

      // 2. Cấu hình Kênh thông báo cho CUỘC GỌI ĐẾN (ringtone.mp3)
      const AndroidNotificationChannel callChannel = AndroidNotificationChannel(
        'incoming_calls', 
        'Incoming Calls', 
        description: 'Kênh nhận thông báo cuộc gọi đến Chat Tho-Fi.', 
        importance: Importance.max,
        sound: RawResourceAndroidNotificationSound('ringtone'),
        playSound: true,
      );

      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(chatChannel);

      await flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(callChannel);

      // Cài đặt cài đặt ban đầu cho local notification
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const InitializationSettings initializationSettings = InitializationSettings(
        android: initializationSettingsAndroid,
      );
      await flutterLocalNotificationsPlugin.initialize(initializationSettings);

      // Xin quyền thông báo trên Android 13+ / iOS
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (e) {
      print("Lỗi cấu hình Firebase/Notifications ban đầu: $e");
    }
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tho Fi Chat',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
      ),
      home: const WebViewScreen(),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  String? _fcmToken;
  bool _isPageFinished = false;

  @override
  void initState() {
    super.initState();
    
    // Chỉ khởi tạo WebViewController nếu không phải nền tảng Web
    if (!kIsWeb) {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0x00000000))
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (int progress) {},
            onPageStarted: (String url) {},
            onPageFinished: (String url) {
              setState(() {
                _isPageFinished = true;
              });
              // Khi trang web tải xong, truyền Token vào nếu đã sẵn sàng
              _injectFcmTokenToWeb();
            },
            onWebResourceError: (WebResourceError error) {
              print("Lỗi tải trang: ${error.description}");
            },
          ),
        )
        ..loadRequest(Uri.parse('https://chat-tho-fi.onrender.com'));

      // Khởi tạo các sự kiện lắng nghe tin nhắn
      _setupMessagingListeners();
    }
  }

  void _setupMessagingListeners() async {
    try {
      // Xin cấp quyền overlay (hiển thị trên ứng dụng khác) cho bong bóng chat
      final hasOverlay = await DashBubble.instance.hasOverlayPermission();
      if (!hasOverlay) {
        await DashBubble.instance.requestOverlayPermission();
      }

      // Lấy FCM Token thiết bị
      _fcmToken = await FirebaseMessaging.instance.getToken();
      print("🔑 Đã lấy được Native FCM Token: $_fcmToken");
      _injectFcmTokenToWeb();
    } catch (e) {
      print("❌ Lỗi lấy native FCM Token: $e");
    }

    // Lắng nghe tin nhắn khi app đang mở (Foreground)
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print("📩 Nhận tin nhắn trong Foreground: ${message.messageId}");
      
      // Hiển thị thông báo nội bộ
      _showLocalNotification(message);

      // Hiển thị bong bóng chat khi có tin nhắn mới
      _showChatBubble(message);
    });
  }

  void _injectFcmTokenToWeb() {
    if (_fcmToken != null && _isPageFinished) {
      print("💉 Đang truyền FCM Token vào trang web...");
      _controller.runJavaScript("""
        window.flutterFcmToken = '$_fcmToken';
        if (window.onFlutterFcmTokenReceived) {
          window.onFlutterFcmTokenReceived('$_fcmToken');
        }
      """);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) {
      return const Scaffold(
        body: Center(
          child: Padding(
            padding: EdgeInsets.all(24.0),
            child: Text(
              '📱 Trình duyệt WebView chỉ chạy trên điện thoại thật hoặc máy ảo (Android/iOS).\n\nVui lòng cắm điện thoại thật hoặc khởi động máy ảo Android Studio, sau đó chạy lại lệnh: flutter run',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey, height: 1.5),
            ),
          ),
        ),
      );
    }

    final bool isIOS = defaultTargetPlatform == TargetPlatform.iOS;

    return Scaffold(
      resizeToAvoidBottomInset: !isIOS,
      body: SafeArea(
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
