import 'theme/app_theme.dart';
import 'dart:async';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/chat_provider.dart';
import 'providers/theme_provider.dart';
import 'services/api_service.dart';
import 'services/network_status.dart';
import 'services/socket_service.dart';
import 'services/fcm_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';
import 'utils/web_utils.dart' as web_utils;
import 'utils/avatar_image.dart';

/// Custom ScrollBehavior tối ưu cho Flutter Web:
/// Kích hoạt cuộn mượt cho chuột, cảm ứng, trackpad với BouncingScrollPhysics.
class SmoothWebScrollBehavior extends MaterialScrollBehavior {
  const SmoothWebScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
  };

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  PaintingBinding.instance.imageCache.maximumSize = 300;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 120 << 20;
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const ChatThoFiApp(),
    ),
  );
}

class ChatThoFiApp extends StatefulWidget {
  const ChatThoFiApp({Key? key}) : super(key: key);

  @override
  State<ChatThoFiApp> createState() => _ChatThoFiAppState();
}

class _ChatThoFiAppState extends State<ChatThoFiApp> {
  bool _isLoggedIn = false;
  bool _isCheckingAuth = true;
  int _authRevision = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _removeLoadingScreen();
    });
    NetworkStatus.initialize();
    NetworkStatus.online.addListener(_onNetworkChanged);
    _checkAuth();
  }

  void _onNetworkChanged() {
    if (NetworkStatus.online.value && mounted) _checkAuth();
  }
  @override
  void dispose() {
    NetworkStatus.online.removeListener(_onNetworkChanged);
    super.dispose();
  }
  void _removeLoadingScreen() {
    web_utils.removeLoadingScreen();
  }

  Future<void> _checkAuth() async {
    final revision = ++_authRevision;
    try {
      final token = await ApiService.getToken();
      if (token != null && token.isNotEmpty) {
        // Local-First Instant Boot (0ms): Hiển thị ngay phiên đã lưu trong máy không cần chờ mạng
        final cachedUser = await ApiService.getOfflineUser();
        if (!mounted || revision != _authRevision) return;
        if (cachedUser != null && cachedUser['id'] != null) {
          final cachedMap = Map<String, dynamic>.from(cachedUser);
          final provider = Provider.of<ChatProvider>(context, listen: false);
          await provider.setCurrentUser(cachedMap);
          await provider.loadCachedConversationsImmediate();
          if (!mounted || revision != _authRevision) return;
          setState(() {
            _isLoggedIn = true;
            _isCheckingAuth = false;
          });
          _removeLoadingScreen();
          // Xác thực và làm mới dữ liệu ngầm ở hậu cảnh (không chặn giao diện)
          unawaited(_refreshSessionInBackground(revision));
          return;
        }

        Map<String, dynamic> meRes;
        if (!NetworkStatus.online.value) { meRes = {'data': cachedUser}; }
        else {
          try { meRes = await ApiService.getMe(); }
          catch (_) {
            if (cachedUser == null) rethrow;
            NetworkStatus.online.value = false;
            meRes = {'data': cachedUser};
          }
        }
        final userObj = meRes['data'] ?? meRes['user'];
        if (!mounted || revision != _authRevision) return;
        if (userObj is Map && userObj['id'] != null) {
          final userMap = Map<String, dynamic>.from(userObj);
          if (mounted) {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            await provider.setCurrentUser(userMap);
            await provider.loadCachedConversationsImmediate();
            if (!mounted || revision != _authRevision) return;
            setState(() {
              _isLoggedIn = true;
              _isCheckingAuth = false;
            });
            _removeLoadingScreen();
            unawaited(_prepareApp().then((_) {
              if (!mounted || revision != _authRevision) return;
              if (NetworkStatus.online.value && provider.selectedConversation != null) {
                provider.selectConversation(provider.selectedConversation!);
              }
            }));
          }
          if (NetworkStatus.online.value) FCMService.initAndRegisterToken();
        } else {
          if (NetworkStatus.online.value) await ApiService.clearToken();
          if (mounted) context.read<ChatProvider>().clearCurrentUser();
          _isLoggedIn = false;
        }
      } else {
        _isLoggedIn = false;
      }
    } catch (e) {
      debugPrint('Error in _checkAuth: $e');
      _isLoggedIn = false;
    } finally {
      if (mounted && revision == _authRevision) {
        if (_isCheckingAuth) {
          setState(() {
            _isCheckingAuth = false;
          });
        }
        _removeLoadingScreen();
      }
    }
  }

  Future<void> _refreshSessionInBackground(int revision) async {
    if (!mounted || revision != _authRevision || !NetworkStatus.online.value) return;
    try {
      final meRes = await ApiService.getMe();
      if (!mounted || revision != _authRevision) return;
      final userObj = meRes['data'] ?? meRes['user'];
      if (userObj is Map && userObj['id'] != null) {
        final provider = Provider.of<ChatProvider>(context, listen: false);
        await provider.setCurrentUser(Map<String, dynamic>.from(userObj));
        if (!mounted || revision != _authRevision) return;
        await _prepareApp();
        if (!mounted || revision != _authRevision) return;
        if (NetworkStatus.online.value && provider.selectedConversation != null) {
          provider.selectConversation(provider.selectedConversation!);
        }
        if (NetworkStatus.online.value) FCMService.initAndRegisterToken();
      } else if (meRes['success'] == false && await ApiService.getToken() == null) {
        if (mounted && revision == _authRevision) {
          context.read<ChatProvider>().clearCurrentUser();
          setState(() {
            _isLoggedIn = false;
          });
        }
      }
    } catch (_) {
      // Giữ nguyên phiên offline khi mạng chập chờn
    }
  }

  Future<void> _prepareApp() async {
    final provider = context.read<ChatProvider>();
    // Slow networks must not keep the user on the splash indefinitely.
    try {
      await provider.prepareInitialConversations().timeout(
        const Duration(seconds: 4), onTimeout: () {},
      );
    } catch (error) {
      debugPrint('Initial message preparation: $error');
    }
    if (!mounted) return;
    if (!NetworkStatus.online.value) return;
    final avatars = provider.conversations.take(12)
        .map((conversation) => conversation.avatar)
        .whereType<String>().where((avatar) => avatar.isNotEmpty).toSet().toList();
    final deadline = DateTime.now().add(const Duration(seconds: 1));
    var nextAvatar = 0;
    Future<void> warmAvatars() async {
      while (mounted && nextAvatar < avatars.length && DateTime.now().isBefore(deadline)) {
        final url = ApiService.formatImageUrl(avatars[nextAvatar++]);
        // Match the canonical 192px cache key used by resizeAvatar for all size <= 256.
        if (!mounted || DateTime.now().isAfter(deadline)) return;
        await precacheImage(
          resizeAvatar(NetworkImage(url), size: 192), context,
          onError: (_, __) {},
        );
      }
    }
    await Future.wait([warmAvatars(), warmAvatars()])
        .timeout(const Duration(seconds: 1), onTimeout: () => []);
  }

  void _onLoginSuccess() async {
    final provider = Provider.of<ChatProvider>(context, listen: false);
    await provider.loadCachedConversationsImmediate();
    if (!mounted) return;
    setState(() {
      _isLoggedIn = true;
      _isCheckingAuth = false;
    });
    unawaited(_prepareApp());
    if (NetworkStatus.online.value) FCMService.initAndRegisterToken();
  }

  void _onLogout() async {
    _authRevision++;
    await ApiService.clearToken();
    SocketService.disconnect();
    if (mounted) {
      Provider.of<ChatProvider>(context, listen: false).clearCurrentUser();
    }
    if (!mounted) return;
    setState(() {
      _isLoggedIn = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);

    return MaterialApp(
      title: 'Chat Tho-Fi',
      debugShowCheckedModeBanner: false,
      scrollBehavior: const SmoothWebScrollBehavior(),
      themeMode: themeProvider.themeMode,
      theme: AppTheme.create(Brightness.light),
      darkTheme: AppTheme.create(Brightness.dark),
      builder: (context, child) {
        final mediaQueryData = MediaQuery.of(context);
        return MediaQuery(
          data: mediaQueryData.copyWith(
            textScaler: mediaQueryData.textScaler.clamp(
              minScaleFactor: 0.8,
              maxScaleFactor: 1.0,
            ),
          ),
          child: ValueListenableBuilder<bool>(
            valueListenable: NetworkStatus.online, child: child!,
            builder: (context, online, page) => Column(children: [
              if (!online) Material(color: const Color(0xFFFFF3CD), child: SafeArea(bottom: false,
                child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(children: const [Icon(Icons.wifi_off_rounded, size: 18), SizedBox(width: 8),
                    Expanded(child: Text('Không có mạng · Chỉ xem dữ liệu đã lưu', style: TextStyle(fontSize: 13)))])))),
              Expanded(child: page!),
            ]),
          ),
        );
      },
      home: _isCheckingAuth
          ? const SplashScreen()
          : Selector<ChatProvider, bool>(
              selector: (_, provider) => provider.currentUser != null,
              builder: (context, isLoggedIn, _) {
                return isLoggedIn
                    ? ChatScreen(onLogout: _onLogout)
                    : LoginScreen(onLoginSuccess: _onLoginSuccess);
              },
            ),
    );
  }
}
