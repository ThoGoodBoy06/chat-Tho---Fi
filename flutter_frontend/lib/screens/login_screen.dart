import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLoginSuccess;
  const LoginScreen({Key? key, required this.onLoginSuccess}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isRegisterMode = false;
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleSubmit() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (password.isEmpty || (!_isRegisterMode && identifier.isEmpty)) {
      setState(() => _errorMessage = 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isRegisterMode) {
        final res = await ApiService.register({
          'username': _usernameController.text.trim(),
          'fullName': _fullNameController.text.trim(),
          'password': password,
        });

        if (res['token'] != null) {
          await ApiService.saveToken(res['token']);
          if (mounted) {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            if (res['user'] != null) provider.setCurrentUser(res['user']);
            await SocketService.connect();
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage = res['error'] ?? 'Đăng ký thất bại');
        }
      } else {
        final res = await ApiService.login(identifier, password);
        if (res['token'] != null) {
          await ApiService.saveToken(res['token']);
          if (mounted) {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            if (res['user'] != null) provider.setCurrentUser(res['user']);
            await SocketService.connect();
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage = res['error'] ?? 'Tài khoản hoặc mật khẩu không chính xác');
        }
      }
    } catch (e) {
      setState(() => _errorMessage = 'Không thể kết nối đến máy chủ: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090D1A),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF090D1A), Color(0xFF0038A8), Color(0xFF090D1A)],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.all(36.0),
              decoration: BoxDecoration(
                color: const Color(0xFF161C2E).withOpacity(0.95),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 30,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0068FF), Color(0xFF00C6FF)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0068FF).withOpacity(0.4),
                          blurRadius: 15,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.chat_bubble_rounded, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Chat Tho-Fi',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isRegisterMode ? 'Tạo tài khoản mới để kết nối' : 'Đăng nhập để tiếp tục trò chuyện',
                    style: TextStyle(fontSize: 14, color: Colors.grey[400]),
                  ),
                  const SizedBox(height: 32),

                  if (_errorMessage != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.red.withOpacity(0.3)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  if (_isRegisterMode) ...[
                    TextField(
                      controller: _fullNameController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Họ và tên',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.badge_outlined, color: Color(0xFF0068FF)),
                        filled: true,
                        fillColor: const Color(0xFF0F1424),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _usernameController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Tên tài khoản (username)',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.person_outline, color: Color(0xFF0068FF)),
                        filled: true,
                        fillColor: const Color(0xFF0F1424),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ] else ...[
                    TextField(
                      controller: _identifierController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Username, Email hoặc SĐT',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.person_outline, color: Color(0xFF0068FF)),
                        filled: true,
                        fillColor: const Color(0xFF0F1424),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Mật khẩu',
                      labelStyle: TextStyle(color: Colors.grey[400]),
                      prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF0068FF)),
                      filled: true,
                      fillColor: const Color(0xFF0F1424),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => _handleSubmit(),
                  ),

                  const SizedBox(height: 28),

                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0068FF),
                        elevation: 4,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isLoading
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                          : Text(
                              _isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  TextButton(
                    onPressed: () {
                      setState(() {
                        _isRegisterMode = !_isRegisterMode;
                        _errorMessage = null;
                      });
                    },
                    child: Text(
                      _isRegisterMode ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký ngay',
                      style: const TextStyle(color: Color(0xFF00C6FF), fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
