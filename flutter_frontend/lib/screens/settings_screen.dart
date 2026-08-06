import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import 'change_password_screen.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback onLogout;

  const SettingsScreen({
    Key? key,
    required this.onLogout,
  }) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  void _showLogoutConfirmDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
            SizedBox(width: 10),
            Text('Xác nhận đăng xuất', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Chat Tho-Fi không?',
          style: TextStyle(color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              // 1. Xóa toàn bộ Token/Session
              await ApiService.clearToken();
              // 2. Ngắt kết nối Socket.IO ngay lập tức
              SocketService.disconnect();
              // 3. Xóa dữ liệu user cục bộ trong Provider
              if (mounted) {
                Provider.of<ChatProvider>(context, listen: false).clearCurrentUser();
                // 4. Push & Remove Until tới LoginScreen
                Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (_) => LoginScreen(
                      onLoginSuccess: () {},
                    ),
                  ),
                  (route) => false,
                );
              }
            },
            child: const Text('Đăng xuất', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final dividerColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: cardBgColor,
        elevation: 0.5,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Cài đặt',
          style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 19),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 12),
                children: [
                  // Section 1: Giao diện
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                    child: Text(
                      'GIAO DIỆN',
                      style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                  ),
                  Container(
                    color: cardBgColor,
                    child: SwitchListTile(
                      value: isDark,
                      onChanged: (value) {
                        themeProvider.toggleDarkMode(value);
                      },
                      secondary: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.amber : const Color(0xFF0068FF)).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                          color: isDark ? Colors.amber : const Color(0xFF0068FF),
                          size: 22,
                        ),
                      ),
                      title: Text(
                        'Chế độ Tối (Dark Mode)',
                        style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                      ),
                      subtitle: Text(
                        isDark ? 'Giao diện tối giúp dịu mắt khi sử dụng' : 'Giao diện sáng rực rỡ, chuẩn Zalo',
                        style: TextStyle(color: subTextColor, fontSize: 12.5),
                      ),
                    ),
                  ),

                  Divider(height: 24, thickness: 8, color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9)),

                  // Section 2: Tài khoản & Bảo mật
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                    child: Text(
                      'TÀI KHOẢN & BẢO MẬT',
                      style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                  ),
                  Container(
                    color: cardBgColor,
                    child: Column(
                      children: [
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0068FF).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.lock_outline_rounded, color: Color(0xFF0068FF), size: 22),
                          ),
                          title: Text('Đổi mật khẩu', style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15)),
                          subtitle: Text('Cập nhật mật khẩu bảo mật tài khoản', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                          trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
                            );
                          },
                        ),
                        Divider(height: 1, indent: 64, color: dividerColor),
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.shield_outlined, color: Color(0xFF10B981), size: 22),
                          ),
                          title: Text('Bảo mật & Quyền riêng tư', style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15)),
                          subtitle: Text('Mã hóa dữ liệu & quyền riêng tư', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                          trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Tài khoản của bạn đã được bảo vệ mã hóa 256-bit')),
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  Divider(height: 24, thickness: 8, color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9)),

                  // Section 3: Ứng dụng
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                    child: Text(
                      'ỨNG DỤNG & THÔNG TIN',
                      style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                    ),
                  ),
                  Container(
                    color: cardBgColor,
                    child: Column(
                      children: [
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF8B5CF6).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.notifications_none_rounded, color: Color(0xFF8B5CF6), size: 22),
                          ),
                          title: Text('Thông báo & Âm thanh', style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15)),
                          subtitle: Text('Tùy chỉnh chuông gọi & âm nhắn', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                          trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Âm thanh thông báo đã được bật mặc định')),
                            );
                          },
                        ),
                        Divider(height: 1, indent: 64, color: dividerColor),
                        ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.info_outline_rounded, color: Color(0xFFF59E0B), size: 22),
                          ),
                          title: Text('Phiên bản Chat Tho-Fi', style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15)),
                          subtitle: Text('v1.0.0 (Web & Mobile Release)', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                          trailing: const Text('Mới nhất', style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Section 4: Nút Đăng xuất ở TẬN CÙNG dưới đáy màn hình Cài đặt
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBgColor,
                border: Border(top: BorderSide(color: dividerColor, width: 1)),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                tileColor: const Color(0xFFFEF2F2),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 22),
                ),
                title: const Text(
                  'Đăng xuất',
                  style: TextStyle(
                    color: Color(0xFFEF4444),
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                subtitle: const Text(
                  'Đăng xuất khỏi tài khoản hiện tại',
                  style: TextStyle(color: Color(0xFF991B1B), fontSize: 12),
                ),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFFEF4444), size: 16),
                onTap: _showLogoutConfirmDialog,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
