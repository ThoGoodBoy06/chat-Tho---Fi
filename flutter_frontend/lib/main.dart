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
        Map<String, dynamic> meRes;
        if (!NetworkStatus.online.value) { meRes = {'data': await ApiService.getOfflineUser()}; }
        else {
          try { meRes = await ApiService.getMe(); }
          catch (_) {
            final cached = await ApiService.getOfflineUser();
            if (cached == null) rethrow;
            NetworkStatus.online.value = false;
            meRes = {'data': cached};
          }
        }
        final userObj = meRes['data'] ?? meRes['user'];
        if (!mounted || revision != _authRevision) return;
        if (userObj is Map && userObj['id'] != null) {
          final userMap = Map<String, dynamic>.from(userObj);
          if (mounted) {
            await Provider.of<ChatProvider>(context, listen: false).setCurrentUser(userMap);
            await _prepareApp();
            if (!mounted || revision != _authRevision) return;
            final provider = context.read<ChatProvider>();
            if (NetworkStatus.online.value && provider.selectedConversation != null) {
              provider.selectConversation(provider.selectedConversation!);
            }
            setState(() {
              _isLoggedIn = true;
            });
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
        setState(() {
          _isCheckingAuth = false;
        });
        _removeLoadingScreen();
      }
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
        // Match the cache keys used by the sidebar and message avatars.
        for (final size in [104, 56]) {
          if (!mounted || DateTime.now().isAfter(deadline)) return;
          await precacheImage(
            ResizeImage(NetworkImage(url), width: size, height: size), context,
            onError: (_, __) {},
          );
        }
      }
    }
    await Future.wait([warmAvatars(), warmAvatars()])
        .timeout(const Duration(seconds: 1), onTimeout: () => []);
  }

  void _onLoginSuccess() async {
    setState(() => _isCheckingAuth = true);
    try {
      await _prepareApp();
    } catch (error) {
      debugPrint('Initial cache preparation: $error');
    }
    if (!mounted) return;
    setState(() {
      _isLoggedIn = true;
      _isCheckingAuth = false;
    });
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
      theme: ThemeData(
        brightness: Brightness.light,
        primaryColor: const Color(0xFF0068FF),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
        ),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF0068FF),
          secondary: Color(0xFF0068FF),
          surface: Colors.white,
          background: Color(0xFFF8FAFC),
        ),
        fontFamily: 'Inter',
        fontFamilyFallback: const ['Noto Color Emoji'],
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF0068FF),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E293B),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        cardColor: const Color(0xFF1E293B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0068FF),
          secondary: Color(0xFF0068FF),
          surface: Color(0xFF1E293B),
          background: Color(0xFF0F172A),
        ),
        fontFamily: 'Inter',
        fontFamilyFallback: const ['Noto Color Emoji'],
      ),
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
