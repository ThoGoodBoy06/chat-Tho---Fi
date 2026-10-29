import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../services/api_service.dart';

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
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  // Reference: centered logo, white canvas, underlined tabs and navy actions.
  // Content follows the reference login form; only existing authentication is used.
  // Tab underline and form-size transitions respect reduced-motion preferences.
  static const _blue = Color(0xFF174F96);

  void _selectMode(bool register) {
    if (_isLoading || register == _isRegisterMode) return;
    setState(() {
      _isRegisterMode = register;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final background = dark ? const Color(0xFF101B2B) : Colors.white;
    return Scaffold(
        backgroundColor: background,
        body: SafeArea(child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 900;
            final form = ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: SingleChildScrollView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 32, vertical: 28),
                    child: AutofillGroup(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                          const SizedBox(height: 12),
                          Center(
                              child: Image.asset(
                                  'assets/tho_fi_logo_transparent.png',
                                  width: 112,
                                  height: 112,
                                  semanticLabel: 'Logo Chat Tho-Fi')),
                          const SizedBox(height: 12),
                          Center(
                              child: Text('Chat Tho-Fi',
                                  style: TextStyle(
                                      fontSize: 15,
                                      color: dark ? Colors.white70 : _blue,
                                      letterSpacing: 0.2,
                                      fontWeight: FontWeight.w600))),
                          const SizedBox(height: 20),
                          Text(_isRegisterMode
                                  ? 'Một tài khoản mới, ngàn câu chuyện chờ bạn.'
                                  : 'Chuyện của bạn, luôn có người nghe.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontSize: 25,
                                  height: 1.35,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.8,
                                  color: dark
                                      ? Colors.white
                                      : const Color(0xFF101010))),
                          const SizedBox(height: 24),
                          Row(children: [
                            _modeTab('Đăng nhập', false, reduce),
                            _modeTab('Đăng ký', true, reduce),
                          ]),
                          const SizedBox(height: 36),
                          if (_errorMessage != null)
                            Padding(
                                padding: const EdgeInsets.only(bottom: 18),
                                child: Semantics(
                                    liveRegion: true,
                                    child: Text(_errorMessage!,
                                        style: TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .error,
                                            fontSize: 13,
                                            height: 1.5)))),
                          AnimatedSize(
                              duration:
                                  Duration(milliseconds: reduce ? 0 : 180),
                              alignment: Alignment.topCenter,
                              child: Column(children: [
                                if (_isRegisterMode) ...[
                                  _buildInputField(
                                      controller: _fullNameController,
                                      label: 'Họ và tên',
                                      icon: Icons.badge_outlined),
                                  const SizedBox(height: 18),
                                  _buildInputField(
                                      controller: _usernameController,
                                      label: 'Tên tài khoản',
                                      icon: Icons.person_outline_rounded),
                                ] else
                                  _buildInputField(
                                      controller: _identifierController,
                                      label:
                                          'Tài khoản, email hoặc số điện thoại',
                                      icon: Icons.person_outline_rounded),
                              ])),
                          const SizedBox(height: 18),
                          _buildInputField(
                              controller: _passwordController,
                              label: 'Mật khẩu',
                              icon: Icons.lock_outline_rounded,
                              isPassword: true,
                              obscureText: _obscurePassword,
                              onTogglePassword: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                              onSubmitted: (_) {
                                if (!_isLoading) _handleSubmit();
                              }),
                          const SizedBox(height: 26),
                          SizedBox(
                              height: 52,
                              child: ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                      backgroundColor: _blue,
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor:
                                          const Color(0xFF809FC7),
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(5))),
                                  onPressed: _isLoading ? null : _handleSubmit,
                                  child: _isLoading
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                              color: Colors.white,
                                              strokeWidth: 2))
                                      : Text(
                                          _isRegisterMode
                                              ? 'TẠO TÀI KHOẢN'
                                              : 'ĐĂNG NHẬP',
                                          style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                              letterSpacing: 0.4)))),
                          const SizedBox(height: 12),
                          TextButton(
                              onPressed: _isLoading
                                  ? null
                                  : () => _selectMode(!_isRegisterMode),
                              style: TextButton.styleFrom(
                                  foregroundColor:
                                      dark ? const Color(0xFF9CC4FF) : _blue),
                              child: Text(
                                  _isRegisterMode
                                      ? 'Đã có tài khoản? Đăng nhập'
                                      : 'Chưa có tài khoản? Đăng ký',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 13))),
                          const SizedBox(height: 30),
                          Row(children: [
                            Expanded(
                                child: Divider(
                                    color: dark
                                        ? Colors.white12
                                        : const Color(0xFFEBEDF1))),
                            Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                child: Text('Chat Tho-Fi',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: dark
                                            ? Colors.white38
                                            : const Color(0xFF989FA9)))),
                            Expanded(
                                child: Divider(
                                    color: dark
                                        ? Colors.white12
                                        : const Color(0xFFEBEDF1)))
                          ]),
                          const SizedBox(height: 16),
                          Text('Kết nối và chia sẻ mỗi ngày',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                  fontSize: 12,
                                  color: dark
                                      ? Colors.white54
                                      : const Color(0xFF8A929F))),
                          const SizedBox(height: 16),
                        ]))));
            if (!wide) return Center(child: form);
            return Row(children: [
              Expanded(child: _brandCanvas()),
              Expanded(child: Center(child: form))
            ]);
          },
        )));
  }

  Widget _modeTab(String label, bool register, bool reduce) {
    final selected = register == _isRegisterMode;
    return Expanded(
        child: Semantics(
            selected: selected,
            child: InkWell(
                onTap: _isLoading ? null : () => _selectMode(register),
                child: Column(children: [
                  Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight:
                                  selected ? FontWeight.w700 : FontWeight.w400,
                              color: selected
                                  ? _blue
                                  : Theme.of(context).colorScheme.onSurface))),
                  AnimatedContainer(
                      duration: Duration(milliseconds: reduce ? 0 : 160),
                      height: 3,
                      color: selected ? _blue : Colors.transparent),
                ]))));
  }

  Widget _brandCanvas() => Container(
      color: _blue,
      child: Center(
          child: Stack(alignment: Alignment.center, children: [
        for (final size in [460.0, 340.0, 220.0])
          Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withOpacity(0.035))),
        Container(
            width: 150,
            height: 150,
            padding: const EdgeInsets.all(22),
            decoration: const BoxDecoration(
                color: Colors.white, shape: BoxShape.circle),
            child: Image.asset('assets/tho_fi_logo_transparent.png')),
      ])));

  Widget _buildInputField(
      {required TextEditingController controller,
      required String label,
      required IconData icon,
      bool isPassword = false,
      bool obscureText = false,
      VoidCallback? onTogglePassword,
      Function(String)? onSubmitted}) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(5),
            boxShadow: dark
                ? []
                : [
                    BoxShadow(
                        color: const Color(0xFF174F96).withOpacity(0.08),
                        blurRadius: 18,
                        offset: const Offset(0, 6))
                  ]),
        child: TextField(
            controller: controller,
            obscureText: obscureText,
            enabled: !_isLoading,
            autocorrect: false,
            enableSuggestions: !isPassword,
            autofillHints: isPassword
                ? [
                    _isRegisterMode
                        ? AutofillHints.newPassword
                        : AutofillHints.password
                  ]
                : [
                    controller == _fullNameController
                        ? AutofillHints.name
                        : AutofillHints.username
                  ],
            textInputAction:
                isPassword ? TextInputAction.done : TextInputAction.next,
            style: TextStyle(
                fontSize: 15,
                color: dark ? Colors.white : const Color(0xFF30333A)),
            decoration: InputDecoration(
                hintText: label,
                semanticCounterText: label,
                hintStyle: TextStyle(
                    fontSize: 12,
                    color: dark ? Colors.white54 : const Color(0xFF969696)),
                filled: true,
                fillColor: dark ? const Color(0xFF19283F) : Colors.white,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(5),
                    borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(5),
                    borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(5),
                    borderSide: const BorderSide(color: _blue, width: 1.2)),
                suffixIcon: isPassword
                    ? IconButton(
                        tooltip: obscureText ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                        onPressed: onTogglePassword,
                        icon: Icon(
                            obscureText
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: dark
                                ? Colors.white38
                                : const Color(0xFFBDBDBD)))
                    : null),
            onSubmitted: onSubmitted));
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
            if (userObj is Map) {
              final userMap = Map<String, dynamic>.from(userObj);
              await provider.setCurrentUser(userMap);
            }
            // setCurrentUser starts the socket once for this session.
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage =
              res['message'] ?? res['error'] ?? 'Đăng ký thất bại');
        }
      } else {
        final res = await ApiService.login(identifier, password);
        if (res['token'] != null) {
          await ApiService.saveToken(res['token']);
          if (mounted) {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            final userObj = res['data'] ?? res['user'];
            if (userObj is Map) {
              final userMap = Map<String, dynamic>.from(userObj);
              await provider.setCurrentUser(userMap);
            }
            // setCurrentUser starts the socket once for this session.
            widget.onLoginSuccess();
          }
        } else {
          setState(() => _errorMessage = res['message'] ??
              res['error'] ??
              'Tài khoản hoặc mật khẩu không chính xác');
        }
      }
    } catch (e) {
      setState(() => _errorMessage = 'Không thể kết nối đến máy chủ: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
