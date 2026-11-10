import '../widgets/auth_illustrated_header.dart';
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
  bool _isRegisterMode = false,
      _isLoading = false,
      _obscurePassword = true,
      _pressed = false;
  String? _errorMessage;
  bool _artPrecached = false;
  int _modeRevision = 0;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_artPrecached) {
      _artPrecached = true;
      precacheImage(AuthIllustratedHeader.loginArt, context);
      precacheImage(AuthIllustratedHeader.registerArt, context);
    }
  }

  static const _blue = Color(0xFF0068FF);
  Duration _duration(int ms) =>
      Duration(milliseconds: MediaQuery.of(context).disableAnimations ? 0 : ms);
  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  void _selectMode(bool register) {
    if (_isLoading || register == _isRegisterMode) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _isRegisterMode = register;
      _modeRevision++;
      _errorMessage = null;
      _obscurePassword = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? const Color(0xFFF0F5FF) : const Color(0xFF0E193B);
    final muted = dark ? const Color(0xFF9DAEC8) : const Color(0xFF7888A3);
    final surface = dark ? const Color(0xFF101B2B) : Colors.white;
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF0A1220) : const Color(0xFFEDF5FF),
      body: SafeArea(child: LayoutBuilder(builder: (context, constraints) {
        final desktop = constraints.maxWidth >= 900;
        final page = ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ColoredBox(
                color: surface,
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: AutofillGroup(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                        AuthIllustratedHeader(
                            register: _isRegisterMode, revision: _modeRevision),
                        Padding(
                            padding: const EdgeInsets.fromLTRB(24, 14, 24, 24),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Material(
                                      color: dark
                                          ? const Color(0xFF1A2D49)
                                          : const Color(0xFFE6F0FF),
                                      borderRadius: BorderRadius.circular(28),
                                      child: Padding(
                                          padding: const EdgeInsets.all(4),
                                          child: Stack(children: [
                                            Positioned.fill(
                                                child: AnimatedAlign(
                                                    key: const ValueKey(
                                                        'auth-tab-slider'),
                                                    duration: _duration(240),
                                                    curve: Curves.easeOutCubic,
                                                    alignment: _isRegisterMode
                                                        ? Alignment.centerRight
                                                        : Alignment.centerLeft,
                                                    child: FractionallySizedBox(
                                                        widthFactor: 0.5,
                                                        heightFactor: 1,
                                                        child: DecoratedBox(
                                                            decoration:
                                                                BoxDecoration(
                                                          color: dark
                                                              ? const Color(
                                                                  0xFF2C4568)
                                                              : Colors.white,
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(24),
                                                          boxShadow: [
                                                            BoxShadow(
                                                                color: _blue
                                                                    .withOpacity(dark
                                                                        ? 0.05
                                                                        : 0.14),
                                                                blurRadius: 9,
                                                                offset:
                                                                    const Offset(
                                                                        0, 3))
                                                          ],
                                                        ))))),
                                            Row(children: [
                                              _modeTab('Đăng nhập', false),
                                              _modeTab('Đăng ký', true)
                                            ]),
                                          ]))),
                                  const SizedBox(height: 28),
                                  _AuthAnimatedSize(
                                      duration: _duration(240),
                                      curve: Curves.easeOutCubic,
                                      alignment: Alignment.topCenter,
                                      child: _errorMessage == null
                                          ? const SizedBox(
                                              width: double.infinity)
                                          : Padding(
                                              padding: const EdgeInsets.only(
                                                  bottom: 18),
                                              child: Semantics(
                                                  liveRegion: true,
                                                  child: Text(_errorMessage!,
                                                      style: TextStyle(
                                                          color:
                                                              Theme.of(context)
                                                                  .colorScheme
                                                                  .error,
                                                          fontSize: 13,
                                                          height: 1.5))))),
                                  _AuthAnimatedSize(
                                      duration: _duration(240),
                                      curve: Curves.easeOutCubic,
                                      alignment: Alignment.topCenter,
                                      child: AnimatedSwitcher(
                                          duration: _duration(180),
                                          transitionBuilder:
                                              (child, animation) =>
                                                  FadeTransition(
                                                      opacity: animation,
                                                      child: child),
                                          layoutBuilder: (current, previous) =>
                                              Stack(
                                                  alignment:
                                                      Alignment.topCenter,
                                                  children: [
                                                    for (final child
                                                        in previous)
                                                      ExcludeSemantics(
                                                          child: IgnorePointer(
                                                              child: child)),
                                                    if (current != null)
                                                      current,
                                                  ]),
                                          child: Column(
                                              key: ValueKey(_modeRevision),
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.stretch,
                                              children: [
                                                if (_isRegisterMode) ...[
                                                  _field(
                                                      _fullNameController,
                                                      'Họ và tên',
                                                      'Tên bạn muốn hiển thị',
                                                      Icons
                                                          .person_outline_rounded),
                                                  const SizedBox(height: 16),
                                                  _field(
                                                      _usernameController,
                                                      'Tên tài khoản',
                                                      'Chọn tên tài khoản',
                                                      Icons
                                                          .alternate_email_rounded),
                                                ] else
                                                  _field(
                                                      _identifierController,
                                                      'Tài khoản',
                                                      'Email, số điện thoại hoặc tên tài khoản',
                                                      Icons
                                                          .person_outline_rounded),
                                              ]))),
                                  const SizedBox(height: 16),
                                  _field(
                                      _passwordController,
                                      'Mật khẩu',
                                      _isRegisterMode
                                          ? 'Tạo mật khẩu'
                                          : 'Nhập mật khẩu',
                                      Icons.lock_outline_rounded,
                                      password: true),
                                  const SizedBox(height: 26),
                                  Listener(
                                      onPointerDown: (_) {
                                        if (!_isLoading)
                                          setState(() => _pressed = true);
                                      },
                                      onPointerUp: (_) =>
                                          setState(() => _pressed = false),
                                      onPointerCancel: (_) =>
                                          setState(() => _pressed = false),
                                      child: AnimatedScale(
                                          scale: _pressed ? 0.975 : 1,
                                          duration: _duration(110),
                                          curve: Curves.easeOut,
                                          child: DecoratedBox(
                                              decoration: BoxDecoration(
                                                  borderRadius:
                                                      BorderRadius.circular(14),
                                                  boxShadow: [
                                                    BoxShadow(
                                                        color: _blue
                                                            .withOpacity(dark
                                                                ? 0.15
                                                                : 0.20),
                                                        blurRadius: 20,
                                                        offset:
                                                            const Offset(0, 8))
                                                  ]),
                                              child: ElevatedButton(
                                                onPressed: _isLoading
                                                    ? null
                                                    : _handleSubmit,
                                                style: ElevatedButton.styleFrom(
                                                    backgroundColor: _blue,
                                                    foregroundColor:
                                                        Colors.white,
                                                    disabledBackgroundColor:
                                                        dark
                                                            ? const Color(
                                                                0xFF2C4568)
                                                            : const Color(
                                                                0xFF89B7F5),
                                                    elevation: 0,
                                                    minimumSize: const Size(
                                                        double.infinity, 54),
                                                    shape:
                                                        RoundedRectangleBorder(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        14))),
                                                child: AnimatedSwitcher(
                                                    duration: _duration(140),
                                                    child: _isLoading
                                                        ? const SizedBox(
                                                            key: ValueKey(
                                                                'loading'),
                                                            width: 22,
                                                            height: 22,
                                                            child:
                                                                CircularProgressIndicator(
                                                                    strokeWidth:
                                                                        2,
                                                                    color: Colors
                                                                        .white))
                                                        : Row(
                                                            key: ValueKey(
                                                                _modeRevision),
                                                            mainAxisAlignment:
                                                                MainAxisAlignment
                                                                    .center,
                                                            children: [
                                                                Flexible(
                                                                    child: Text(
                                                                        _isRegisterMode
                                                                            ? 'Tạo tài khoản'
                                                                            : 'Đăng nhập',
                                                                        style: const TextStyle(
                                                                            fontSize:
                                                                                16,
                                                                            fontWeight:
                                                                                FontWeight.w700))),
                                                                const SizedBox(
                                                                    width: 12),
                                                                const Icon(
                                                                    Icons
                                                                        .arrow_forward_rounded,
                                                                    size: 22),
                                                              ])),
                                              )))),
                                  const SizedBox(height: 14),
                                  TextButton(
                                      onPressed: _isLoading
                                          ? null
                                          : () => _selectMode(!_isRegisterMode),
                                      child: Text.rich(
                                          TextSpan(
                                              style: TextStyle(
                                                  color: ink, fontSize: 13),
                                              children: [
                                                TextSpan(
                                                    text: _isRegisterMode
                                                        ? 'Đã có tài khoản? '
                                                        : 'Chưa có tài khoản? '),
                                                TextSpan(
                                                    text: _isRegisterMode
                                                        ? 'Đăng nhập'
                                                        : 'Đăng ký',
                                                    style: TextStyle(
                                                        color: dark
                                                            ? const Color(
                                                                0xFF80B4FF)
                                                            : _blue,
                                                        fontWeight:
                                                            FontWeight.w700)),
                                              ]),
                                          textAlign: TextAlign.center)),
                                  const SizedBox(height: 24),
                                  Row(children: [
                                    Expanded(
                                        child: Divider(
                                            color: muted.withOpacity(0.3))),
                                    Padding(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 20),
                                        child: Text('Chat Tho-Fi',
                                            style: TextStyle(
                                                fontSize: 11, color: muted))),
                                    Expanded(
                                        child: Divider(
                                            color: muted.withOpacity(0.3)))
                                  ]),
                                  const SizedBox(height: 14),
                                  Text('Kết nối và chia sẻ mỗi ngày',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                          fontSize: 12, color: muted)),
                                ])),
                      ])),
                )));
        return Center(
            child: desktop
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: ClipRRect(
                        borderRadius: BorderRadius.circular(28), child: page))
                : SizedBox(height: constraints.maxHeight, child: page));
      })),
    );
  }

  Widget _modeTab(String title, bool register) => Expanded(
      child: Semantics(
          selected: register == _isRegisterMode,
          child: TextButton(
            onPressed: _isLoading ? null : () => _selectMode(register),
            style: TextButton.styleFrom(
                minimumSize: const Size(0, 44),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                foregroundColor: register == _isRegisterMode
                    ? (Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF9BC4FF)
                        : _blue)
                    : Theme.of(context).colorScheme.onSurface,
                shape: const StadiumBorder()),
            child: AnimatedDefaultTextStyle(
                duration: _duration(180),
                style: TextStyle(
                    fontFamily: 'Roboto',
                    fontSize: 15,
                    color: register == _isRegisterMode
                        ? (Theme.of(context).brightness == Brightness.dark
                            ? const Color(0xFF9BC4FF)
                            : _blue)
                        : Theme.of(context).colorScheme.onSurface,
                    fontWeight: register == _isRegisterMode
                        ? FontWeight.w700
                        : FontWeight.w500),
                child: Text(title)),
          )));

  Widget _field(TextEditingController controller, String label, String hint,
          IconData icon,
          {bool password = false}) =>
      _AuthField(
        key: ValueKey(controller),
        controller: controller,
        label: label,
        hint: hint,
        icon: icon,
        enabled: !_isLoading,
        password: password,
        obscure: password && _obscurePassword,
        autofill: password
            ? (_isRegisterMode
                ? AutofillHints.newPassword
                : AutofillHints.password)
            : controller == _fullNameController
                ? AutofillHints.name
                : AutofillHints.username,
        onToggle: () => setState(() => _obscurePassword = !_obscurePassword),
        onSubmit: password ? (_) => _handleSubmit() : null,
      );

  Future<void> _handleSubmit() async {
    if (_isLoading) return;
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    if (password.isEmpty ||
        (!_isRegisterMode && identifier.isEmpty) ||
        (_isRegisterMode &&
            (_fullNameController.text.trim().isEmpty ||
                _usernameController.text.trim().isEmpty))) {
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
            if (mounted) widget.onLoginSuccess();
          }
        } else if (mounted) {
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
            if (mounted) widget.onLoginSuccess();
          }
        } else if (mounted) {
          setState(() => _errorMessage = res['message'] ??
              res['error'] ??
              'Tài khoản hoặc mật khẩu không chính xác');
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Không thể kết nối đến máy chủ: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}

class _AuthField extends StatefulWidget {
  const _AuthField(
      {super.key,
      required this.controller,
      required this.label,
      required this.hint,
      required this.icon,
      required this.enabled,
      required this.password,
      required this.obscure,
      required this.autofill,
      required this.onToggle,
      this.onSubmit});
  final TextEditingController controller;
  final String label, hint, autofill;
  final IconData icon;
  final bool enabled, password, obscure;
  final VoidCallback onToggle;
  final ValueChanged<String>? onSubmit;
  @override
  State<_AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<_AuthField> {
  final _focus = FocusNode();
  @override
  void initState() {
    super.initState();
    _focus.addListener(_changed);
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _focus.removeListener(_changed);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduced = MediaQuery.of(context).disableAnimations;
    final blue = dark ? const Color(0xFF80B4FF) : const Color(0xFF0068FF);
    final border = OutlineInputBorder(
        borderRadius: BorderRadius.circular(13), borderSide: BorderSide.none);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(widget.label,
          style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: dark ? const Color(0xFFDFE9FA) : const Color(0xFF172444))),
      const SizedBox(height: 7),
      AnimatedContainer(
        duration: Duration(milliseconds: reduced ? 0 : 160),
        decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color: _focus.hasFocus
                    ? blue
                    : dark
                        ? const Color(0xFF3A4C66)
                        : const Color(0xFFBDCCE1),
                width: 1),
            boxShadow: [
              BoxShadow(
                  color: _focus.hasFocus
                      ? blue.withOpacity(0.10)
                      : Colors.transparent,
                  blurRadius: 8)
            ]),
        child: TextField(
            controller: widget.controller,
            focusNode: _focus,
            enabled: widget.enabled,
            obscureText: widget.obscure,
            autocorrect: false,
            enableSuggestions: !widget.password,
            autofillHints: [widget.autofill],
            textInputAction:
                widget.password ? TextInputAction.done : TextInputAction.next,
            onSubmitted: widget.onSubmit,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              hintText: widget.hint,
              isDense: true,
              hintStyle: TextStyle(
                  fontSize: 12,
                  color:
                      dark ? const Color(0xFF9DAEC8) : const Color(0xFF78869C)),
              prefixIcon: Icon(widget.icon,
                  size: 21,
                  color: _focus.hasFocus ? blue : const Color(0xFF7B899E)),
              suffixIcon: widget.password
                  ? IconButton(
                      tooltip: widget.obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu',
                      onPressed: widget.onToggle,
                      icon: AnimatedSwitcher(
                          duration: Duration(milliseconds: reduced ? 0 : 120),
                          child: Icon(
                              widget.obscure
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              key: ValueKey(widget.obscure),
                              size: 20,
                              color: const Color(0xFF7B899E))))
                  : null,
              filled: true,
              fillColor:
                  dark ? const Color(0xFF16263B) : const Color(0xFFF4F8FF),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 17),
              border: border,
              enabledBorder: border,
              focusedBorder: border,
              disabledBorder: border,
            )),
      ),
    ]);
  }
}

/// Older Flutter renderers cannot animate size with a zero-duration controller.
class _AuthAnimatedSize extends StatelessWidget {
  const _AuthAnimatedSize(
      {required this.duration,
      required this.curve,
      required this.alignment,
      required this.child});
  final Duration duration;
  final Curve curve;
  final AlignmentGeometry alignment;
  final Widget child;
  @override
  Widget build(BuildContext context) => duration == Duration.zero
      ? child
      : AnimatedSize(
          duration: duration, curve: curve, alignment: alignment, child: child);
}
