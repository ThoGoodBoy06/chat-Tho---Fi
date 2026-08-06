import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({Key? key}) : super(key: key);

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _oldPassController = TextEditingController();
  final _newPassController = TextEditingController();
  final _confirmPassController = TextEditingController();

  bool _isObscureOld = true;
  bool _isObscureNew = true;
  bool _isObscureConfirm = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _oldPassController.dispose();
    _newPassController.dispose();
    _confirmPassController.dispose();
    super.dispose();
  }

  Future<void> _handleChangePassword() async {
    final oldPass = _oldPassController.text.trim();
    final newPass = _newPassController.text.trim();
    final confirmPass = _confirmPassController.text.trim();

    if (oldPass.isEmpty || newPass.isEmpty || confirmPass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập đầy đủ các trường thông tin mật khẩu.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (newPass.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mật khẩu mới phải có ít nhất 6 ký tự.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (newPass != confirmPass) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mật khẩu mới và mật khẩu nhập lại không trùng khớp.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService.changePassword(oldPass, newPass);
    setState(() => _isLoading = false);

    if (mounted) {
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Đổi mật khẩu thành công!'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Mật khẩu cũ không chính xác.'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: cardBgColor,
        elevation: 0.5,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Đổi mật khẩu',
          style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 19),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0068FF).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF0068FF).withOpacity(0.2), width: 1),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_rounded, color: Color(0xFF0068FF), size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Mật khẩu mới phải có ít nhất 6 ký tự. Vui lòng bảo mật mật khẩu của bạn.',
                        style: TextStyle(color: textColor, fontSize: 13, height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 1. Mật khẩu cũ
              Text(
                'MẬT KHẨU CŨ',
                style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _oldPassController,
                obscureText: _isObscureOld,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Nhập mật khẩu hiện tại',
                  hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                  prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF0068FF)),
                  suffixIcon: IconButton(
                    icon: Icon(_isObscureOld ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: subTextColor),
                    onPressed: () => setState(() => _isObscureOld = !_isObscureOld),
                  ),
                  filled: true,
                  fillColor: cardBgColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
              ),
              const SizedBox(height: 20),

              // 2. Mật khẩu mới
              Text(
                'MẬT KHẨU MỚI',
                style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _newPassController,
                obscureText: _isObscureNew,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Nhập mật khẩu mới (tối thiểu 6 ký tự)',
                  hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                  prefixIcon: const Icon(Icons.key_rounded, color: Color(0xFF0068FF)),
                  suffixIcon: IconButton(
                    icon: Icon(_isObscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: subTextColor),
                    onPressed: () => setState(() => _isObscureNew = !_isObscureNew),
                  ),
                  filled: true,
                  fillColor: cardBgColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
              ),
              const SizedBox(height: 20),

              // 3. Nhập lại mật khẩu mới
              Text(
                'NHẬP LẠI MẬT KHẨU MỚI',
                style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _confirmPassController,
                obscureText: _isObscureConfirm,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Xác nhận lại mật khẩu mới',
                  hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                  prefixIcon: const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF0068FF)),
                  suffixIcon: IconButton(
                    icon: Icon(_isObscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: subTextColor),
                    onPressed: () => setState(() => _isObscureConfirm = !_isObscureConfirm),
                  ),
                  filled: true,
                  fillColor: cardBgColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
              ),
              const SizedBox(height: 32),

              // Button Lưu Mật Khẩu
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0068FF),
                    foregroundColor: Colors.white,
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: _isLoading ? null : _handleChangePassword,
                  child: _isLoading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text(
                          'Cập nhật mật khẩu',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
