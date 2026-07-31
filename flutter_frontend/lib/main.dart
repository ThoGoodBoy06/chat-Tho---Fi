import 'dart:html' as html;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/chat_provider.dart';
import 'services/api_service.dart';
import 'services/socket_service.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => ChatProvider(),
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _removeLoadingScreen();
    });
    _checkAuth();
  }

  void _removeLoadingScreen() {
    if (kIsWeb) {
      try {
        final element = html.document.getElementById('loading-screen');
        element?.remove();
      } catch (_) {}
    }
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
            Provider.of<ChatProvider>(context, listen: false).setCurrentUser(userObj);
            setState(() {
              _isLoggedIn = true;
            });
          }
          await SocketService.connect(userId: userId);
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
  }

  void _onLogout() async {
    await ApiService.clearToken();
    SocketService.disconnect();
    setState(() {
      _isLoggedIn = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chat Tho-Fi',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        primaryColor: const Color(0xFF007AFF),
        scaffoldBackgroundColor: const Color(0xFFFFFFFF),
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
      home: _isCheckingAuth
          ? const Scaffold(
              body: Center(
                child: CircularProgressIndicator(color: Color(0xFF007AFF)),
              ),
            )
          : _isLoggedIn
              ? ChatScreen(onLogout: _onLogout)
              : LoginScreen(onLoginSuccess: _onLoginSuccess),
    );
  }
}
