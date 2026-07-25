import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await ApiService.getToken();
    if (token != null) {
      await SocketService.connect();
      setState(() {
        _isLoggedIn = true;
      });
    }
    setState(() {
      _isCheckingAuth = false;
    });
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
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF0068FF),
        scaffoldBackgroundColor: const Color(0xFF090D1A),
      ),
      home: _isCheckingAuth
          ? const Scaffold(
              body: Center(
                child: CircularProgressIndicator(color: Color(0xFF0068FF)),
              ),
            )
          : _isLoggedIn
              ? ChatScreen(onLogout: _onLogout)
              : LoginScreen(onLoginSuccess: _onLoginSuccess),
    );
  }
}
