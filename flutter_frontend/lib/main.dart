import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/chat_provider.dart';
import 'providers/theme_provider.dart';
import 'services/api_service.dart';
import 'services/socket_service.dart';
import 'services/fcm_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';
import 'utils/web_utils.dart' as web_utils;

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
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _removeLoadingScreen();
    });
    _checkAuth();
  }

  void _removeLoadingScreen() {
    web_utils.removeLoadingScreen();
  }

  Future<void> _checkAuth() async {
    try {
      final token = await ApiService.getToken();
      if (token != null && token.isNotEmpty) {
        final meRes = await ApiService.getMe();
        final userObj = meRes['data'] ?? meRes['user'];
        if (userObj is Map<String, dynamic> && userObj['id'] != null) {
          final userId = userObj['id'].toString();
          if (mounted) {
            await Provider.of<ChatProvider>(context, listen: false).setCurrentUser(userObj);
            setState(() {
              _isLoggedIn = true;
            });
          }
          await SocketService.connect(userId: userId);
          FCMService.initAndRegisterToken();
        } else {
          await ApiService.clearToken();
          _isLoggedIn = false;
        }
      } else {
        _isLoggedIn = false;
      }
    } catch (e) {
      debugPrint('Error in _checkAuth: $e');
      _isLoggedIn = false;
    } finally {
      if (mounted) {
        setState(() {
          _isCheckingAuth = false;
        });
        _removeLoadingScreen();
      }
    }
  }

  void _onLoginSuccess() {
    setState(() {
      _isLoggedIn = true;
    });
    FCMService.initAndRegisterToken();
  }

  void _onLogout() async {
    await ApiService.clearToken();
    SocketService.disconnect();
    if (mounted) {
      Provider.of<ChatProvider>(context, listen: false).clearCurrentUser();
    }
    setState(() {
      _isLoggedIn = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = Provider.of<ChatProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final currentUser = chatProvider.currentUser;

    return MaterialApp(
      title: 'Chat Tho-Fi',
      debugShowCheckedModeBanner: false,
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
        fontFamily: GoogleFonts.inter().fontFamily,
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
        fontFamily: GoogleFonts.inter().fontFamily,
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
          child: child!,
        );
      },
      home: _showSplash
          ? SplashScreen(
              onFinish: () {
                if (mounted) {
                  setState(() {
                    _showSplash = false;
                  });
                }
              },
            )
          : (_isCheckingAuth
              ? const Scaffold(
                  backgroundColor: Colors.white,
                  body: Center(
                    child: CircularProgressIndicator(color: Color(0xFF0068FF)),
                  ),
                )
              : (currentUser == null
                  ? LoginScreen(onLoginSuccess: _onLoginSuccess)
                  : ChatScreen(onLogout: _onLogout))),
    );
  }
}
