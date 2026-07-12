import 'dart:convert'; // Để parse JSON gửi từ Web
import 'dart:io' show Platform; // Để check Platform.isAndroid / Platform.isIOS
import 'package:flutter/foundation.dart'; // Import kIsWeb
import 'package:http/http.dart' as http; // Để gọi API trực tiếp bằng Token
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dash_bubble/dash_bubble.dart';

// Import các thành phần Chat Native mới
import 'services/socket_service.dart';
import 'screens/native_chat_screen.dart';

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
  
  // DashBubble chỉ hỗ trợ Android (iOS không có cơ chế overlay bubble)
  if (!kIsWeb && Platform.isAndroid) {
    _showChatBubble(message);
  }
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
          'incoming_calls_v2', // channel id
          'Incoming Calls', // channel name
          channelDescription: 'Kênh nhận thông báo cuộc gọi đến Chat Tho-Fi.',
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.high,
          sound: RawResourceAndroidNotificationSound('ringtone'),
          playSound: true,
        ),
        // iOS: Dùng âm thanh mặc định (custom sound cần thêm file .caf/.aiff vào iOS bundle)
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
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
          'chat_messages_v2', // channel id
          'Chat Messages', // channel name
          channelDescription: 'Kênh nhận thông báo tin nhắn Chat Tho-Fi.',
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.high,
          sound: RawResourceAndroidNotificationSound('amthanhtinnhan'),
          playSound: true,
        ),
        // iOS: Dùng âm thanh mặc định (custom sound cần thêm file .caf/.aiff vào iOS bundle)
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }
}

// Hàm hiển thị bong bóng chat (Overlay) - CHỈ DÀNH CHO ANDROID
// iOS không hỗ trợ overlay bubble, plugin DashBubble chỉ hoạt động trên Android.
void _showChatBubble(RemoteMessage message) async {
  // Bảo vệ kép: thoát ngay nếu không phải Android
  if (kIsWeb || !Platform.isAndroid) return;
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
        'chat_messages_v2', 
        'Chat Messages', 
        description: 'Kênh nhận thông báo tin nhắn Chat Tho-Fi.', 
        importance: Importance.max,
        sound: RawResourceAndroidNotificationSound('amthanhtinnhan'),
        playSound: true,
      );

      // 2. Cấu hình Kênh thông báo cho CUỘC GỌI ĐẾN (ringtone.mp3)
      const AndroidNotificationChannel callChannel = AndroidNotificationChannel(
        'incoming_calls_v2', 
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

      // Cài đặt ban đầu cho local notification (Android + iOS)
      const AndroidInitializationSettings initializationSettingsAndroid =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      // iOS: Cấu hình quyền hiển thị notification
      const DarwinInitializationSettings initializationSettingsIOS =
          DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const InitializationSettings initializationSettings = InitializationSettings(
        android: initializationSettingsAndroid,
        iOS: initializationSettingsIOS,
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

  // Trạng thái đồng bộ của thanh Header Native
  bool _isChatActive = false;
  String _conversationId = "";
  String _chatTheme = "classic";
  String _partnerId = "";
  String _partnerName = "";
  String _partnerAvatar = "";
  String _partnerStatus = "";
  bool _partnerOnline = false;

  // Thông tin xác thực người dùng đồng bộ để gọi API native
  String _myId = "";
  String _token = "";

  // Hàm đồng bộ tài khoản bằng Token trực tiếp qua HTTP
  Future<void> _syncAuthWithToken(String tokenVal) async {
    if (tokenVal.isEmpty || tokenVal == "null") return;
    try {
      final response = await http.get(
        Uri.parse('https://chat-tho-fi.onrender.com/api/auth/me'),
        headers: {
          'Authorization': 'Bearer $tokenVal',
        },
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final userData = data['data'];
          setState(() {
            _token = tokenVal;
            _myId = userData['id'] ?? '';
          });
          SocketService().connect('https://chat-tho-fi.onrender.com', _myId);
          print("✅ Đồng bộ trực tiếp qua Token thành công! User ID: $_myId");
        }
      }
    } catch (e) {
      print("❌ Lỗi đồng bộ trực tiếp qua Token: $e");
    }
  }

  // Hàm chủ động đọc Token trực tiếp từ LocalStorage của WebView
  Future<void> _tryFetchTokenFromWeb() async {
    try {
      final result = await _controller.runJavaScriptReturningResult(
        "localStorage.getItem('authToken')"
      );
      String tokenVal = result.toString().trim();
      // Bỏ dấu nháy kép bọc quanh kết quả JS trên một số thiết bị
      if (tokenVal.startsWith('"') && tokenVal.endsWith('"')) {
        tokenVal = tokenVal.substring(1, tokenVal.length - 1);
      }
      if (tokenVal.startsWith('\'') && tokenVal.endsWith('\'')) {
        tokenVal = tokenVal.substring(1, tokenVal.length - 1);
      }
      if (tokenVal.isNotEmpty && tokenVal != "null") {
        await _syncAuthWithToken(tokenVal);
      }
    } catch (e) {
      print("❌ Lỗi đọc token trực tiếp từ WebView: $e");
    }
  }

  // Hàm tự động gọi API lấy hoặc tạo phòng chat dựa trên partnerId để lấy conversationId
  Future<void> _fetchOrCreateConversationId(String partnerId) async {
    if (partnerId.isEmpty || _token.isEmpty) return;
    try {
      final response = await http.post(
        Uri.parse('https://chat-tho-fi.onrender.com/api/chat/conversations'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode({
          'receiverId': partnerId,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && data['data'] != null) {
          setState(() {
            _conversationId = data['data']['id'] ?? '';
            _chatTheme = data['data']['theme'] ?? 'classic';
          });
          print("✅ Đã lấy thành công conversationId thực tế: $_conversationId, theme: $_chatTheme");
        }
      }
    } catch (e) {
      print("❌ Lỗi gọi API lấy hoặc tạo conversationId: $e");
    }
  }

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
              // Đảm bảo loại bỏ class has-native-header của Web để luôn hiển thị header gốc
              _controller.runJavaScript("""
                (function() {
                  document.body.classList.remove('has-native-header');
                  setInterval(function() {
                    if (document.body.classList.contains('has-native-header')) {
                      document.body.classList.remove('has-native-header');
                    }
                  }, 300);
                })();
              """);
              // Khi trang web tải xong, truyền Token vào nếu đã sẵn sàng
              _injectFcmTokenToWeb();
              // Đồng thời chủ động đọc token trực tiếp từ LocalStorage
              Future.delayed(const Duration(milliseconds: 600), () {
                _tryFetchTokenFromWeb();
              });
            },
            onWebResourceError: (WebResourceError error) {
              print("Lỗi tải trang: ${error.description}");
            },
          ),
        )
        ..addJavaScriptChannel(
          'FlutterHeaderChannel',
          onMessageReceived: (JavaScriptMessage message) {
            try {
              final Map<String, dynamic> data = jsonDecode(message.message);
              final String event = data['event'] ?? '';
              
              if (event == 'auth_sync') {
                setState(() {
                  _token = data['token'] ?? '';
                  _myId = data['myId'] ?? '';
                });
                // Kết nối Socket.IO native trực tiếp tới server
                SocketService().connect('https://chat-tho-fi.onrender.com', _myId);
              } else if (event == 'open_chat') {
                final String partnerId = data['partnerId'] ?? '';
                // Nếu chưa có token native, lập tiếp đọc từ WebView rồi lấy conversationId
                if (_token.isEmpty || _myId.isEmpty) {
                  _tryFetchTokenFromWeb().then((_) {
                    _fetchOrCreateConversationId(partnerId);
                  });
                } else {
                  _fetchOrCreateConversationId(partnerId);
                }
                
                setState(() {
                  _isChatActive = true;
                  _partnerId = partnerId;
                  _partnerName = data['partnerName'] ?? '';
                  _partnerAvatar = data['partnerAvatar'] ?? '';
                  _partnerStatus = 'Đang hoạt động'; // Trạng thái mặc định ban đầu
                  _partnerOnline = true;
                });
              } else if (event == 'close_chat') {
                setState(() {
                  _isChatActive = false;
                  _conversationId = '';
                  _chatTheme = 'classic';
                  _partnerId = '';
                  _partnerName = '';
                  _partnerAvatar = '';
                  _partnerStatus = '';
                  _partnerOnline = false;
                });
              } else if (event == 'update_status') {
                setState(() {
                  _partnerStatus = data['partnerStatus'] ?? '';
                  _partnerOnline = data['partnerOnline'] ?? false;
                });
              }
            } catch (e) {
              print("Lỗi nhận dữ liệu qua Channel: $e");
            }
          },
        )
        ..loadRequest(Uri.parse('https://chat-tho-fi.onrender.com'));

      // Khởi tạo các sự kiện lắng nghe tin nhắn
      _setupMessagingListeners();
    }
  }

  void _setupMessagingListeners() async {
    try {
      // Xin cấp quyền overlay (hiển thị trên ứng dụng khác) cho bong bóng chat
      // CHỈ TRÊN ANDROID - iOS không hỗ trợ overlay bubble
      if (Platform.isAndroid) {
        final hasOverlay = await DashBubble.instance.hasOverlayPermission();
        if (!hasOverlay) {
          await DashBubble.instance.requestOverlayPermission();
        }
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

      // Hiển thị bong bóng chat khi có tin nhắn mới (chỉ Android)
      if (Platform.isAndroid) {
        _showChatBubble(message);
      }
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

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
