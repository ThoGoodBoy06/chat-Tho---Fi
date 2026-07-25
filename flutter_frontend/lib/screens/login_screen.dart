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
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();

  bool _isRegisterMode = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F2F5),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFFEBF3FF),
              Color(0xFFF0F2F5),
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 440),
              padding: const EdgeInsets.all(36.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Zalo App Logo
                  Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0068FF), Color(0xFF0091FF)],
                      ),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0068FF).withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.chat_bubble_rounded,
                      size: 42,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Chat Tho-Fi',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isRegisterMode ? 'Đăng ký tài khoản trải nghiệm ngay' : 'Đăng nhập để tiếp tục trò chuyện',
                    style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 32),

                  if (_errorMessage != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13.5, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],

                  if (_isRegisterMode) ...[
                    _buildInputField(
                      controller: _fullNameController,
                      label: 'Họ và tên',
                      icon: Icons.badge_outlined,
                    ),
                    const SizedBox(height: 14),
                    _buildInputField(
                      controller: _usernameController,
                      label: 'Tên tài khoản (Username)',
                      icon: Icons.person_outline_rounded,
                    ),
                    const SizedBox(height: 14),
                  ] else ...[
                    _buildInputField(
                      controller: _identifierController,
                      label: 'Username, Email hoặc SĐT',
                      icon: Icons.person_outline_rounded,
                    ),
                    const SizedBox(height: 14),
                  ],

                  _buildInputField(
                    controller: _passwordController,
                    label: 'Mật khẩu',
                    icon: Icons.lock_outline_rounded,
                    isPassword: true,
                    obscureText: _obscurePassword,
                    onTogglePassword: () => setState(() => _obscurePassword = !_obscurePassword),
                    onSubmitted: (_) => _handleSubmit(),
                  ),

                  const SizedBox(height: 28),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0068FF),
                        elevation: 2,
                        shadowColor: const Color(0xFF0068FF).withOpacity(0.4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                            )
                          : Text(
                              _isRegisterMode ? 'ĐĂNG KÝ TÀI KHOẢN' : 'ĐĂNG NHẬP',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5),
                            ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Toggle Register/Login Mode
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _isRegisterMode = !_isRegisterMode;
                        _errorMessage = null;
                      });
                    },
                    child: RichText(
                      text: TextSpan(
                        text: _isRegisterMode ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? ',
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                        children: [
                          TextSpan(
                            text: _isRegisterMode ? 'Đăng nhập ngay' : 'Tạo tài khoản ngay',
                            style: const TextStyle(color: Color(0xFF0068FF), fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
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

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onTogglePassword,
    Function(String)? onSubmitted,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
          prefixIcon: Icon(icon, color: const Color(0xFF0068FF), size: 22),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: const Color(0xFF94A3B8),
                    size: 20,
                  ),
                  onPressed: onTogglePassword,
                )
              : null,
          filled: true,
          fillColor: Colors.transparent,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        ),
        onSubmitted: onSubmitted,
      ),
    );
  }

  Future<void> _handleSubmit() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (password.isEmpty || (!_isRegisterMode && identifier.isEmpty)) {
      setState(() => _errorMessage = 'Vui lòng nhập đầy đủ thông tin');
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
            final userObj = res['data'] ?? res['user'];
            if (userObj is Map<String, dynamic>) provider.setCurrentUser(userObj);
            await SocketService.connect();
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage = res['message'] ?? res['error'] ?? 'Đăng ký thất bại');
        }
      } else {
        final res = await ApiService.login(identifier, password);
        if (res['token'] != null) {
          await ApiService.saveToken(res['token']);
          if (mounted) {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            final userObj = res['data'] ?? res['user'];
            if (userObj is Map<String, dynamic>) provider.setCurrentUser(userObj);
            await SocketService.connect();
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage = res['message'] ?? res['error'] ?? 'Tài khoản hoặc mật khẩu không chính xác');
        }
      }
    } catch (e) {
      setState(() => _errorMessage = 'Không thể kết nối đến máy chủ: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
