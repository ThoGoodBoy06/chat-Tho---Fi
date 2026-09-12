import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/fcm_service.dart';
import '../services/sound_service.dart';
import '../utils/web_helpers.dart';
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
                          subtitle: Text('Tùy chỉnh chuông gọi, âm nhắn & iOS PWA', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                          trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                          onTap: () {
                            _showNotificationModal(context, isDark);
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

  void _showNotificationModal(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
          final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
          final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
          final dividerColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

          bool isGranted = isNotificationPermissionGranted();
          bool isLoading = false;
          bool isTestingPush = false;
          bool isRinging = SoundService.isPlayingRingtone;

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.88,
            ),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 20,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: subTextColor.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Thông báo & Âm thanh',
                              style: TextStyle(
                                color: textColor,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              'Nhận thông báo khi tắt app hoặc khóa máy',
                              style: TextStyle(color: subTextColor, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close_rounded, color: subTextColor),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                Divider(color: dividerColor, height: 1),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: (isGranted ? const Color(0xFF10B981) : const Color(0xFFF59E0B)).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: (isGranted ? const Color(0xFF10B981) : const Color(0xFFF59E0B)).withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isGranted ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                              color: isGranted ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                              size: 26,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isGranted ? 'Thông báo đang BẬT' : 'Thông báo CHƯA BẬT',
                                    style: TextStyle(
                                      color: isGranted ? const Color(0xFF10B981) : const Color(0xFFD97706),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    isGranted
                                        ? 'Thiết bị này đã sẵn sàng nhận chuông gọi & tin nhắn khi bạn ra ngoài màn hình chính.'
                                        : 'Vui lòng bấm nút bên dưới để cấp quyền thông báo trên thiết bị này.',
                                    style: TextStyle(color: subTextColor, fontSize: 12.5),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0068FF),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          icon: isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Icon(Icons.notifications_active_rounded),
                          label: Text(
                            isGranted ? 'Cập nhật lại quyền thông báo' : 'Bật thông báo trên thiết bị này',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          onPressed: isLoading
                              ? null
                              : () async {
                                  setModalState(() => isLoading = true);
                                  final success = await FCMService.requestPermissionAndRegisterToken();
                                  setModalState(() {
                                    isLoading = false;
                                    isGranted = isNotificationPermissionGranted();
                                  });
                                  if (mounted) {
                                    if (success) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          backgroundColor: Color(0xFF10B981),
                                          content: Text('✅ Đã kích hoạt thông báo đẩy thành công!'),
                                        ),
                                      );
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          backgroundColor: Color(0xFFEF4444),
                                          content: Text('⚠️ Không thể bật thông báo. Nếu dùng iOS, hãy thêm app ra Màn hình chính theo hướng dẫn bên dưới.'),
                                        ),
                                      );
                                    }
                                  }
                                },
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF0068FF),
                            side: const BorderSide(color: Color(0xFF0068FF), width: 1.2),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          icon: isTestingPush
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send_to_mobile_rounded),
                          label: const Text('Gửi thông báo đẩy thử nghiệm (Test Push)', style: TextStyle(fontWeight: FontWeight.w600)),
                          onPressed: isTestingPush
                              ? null
                              : () async {
                                  setModalState(() => isTestingPush = true);
                                  final res = await ApiService.sendTestPushNotification();
                                  setModalState(() => isTestingPush = false);
                                  if (mounted) {
                                    if (res['success'] == true) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          backgroundColor: Color(0xFF10B981),
                                          content: Text('🔔 Đã bắn thông báo thử nghiệm! Bạn có thể khóa máy hoặc thoát ra màn hình chính để xem thông báo.'),
                                        ),
                                      );
                                    } else {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          backgroundColor: const Color(0xFFEF4444),
                                          content: Text('⚠️ Gửi thông báo test thất bại: ${res['message'] ?? 'Chưa đăng ký thiết bị'}'),
                                        ),
                                      );
                                    }
                                  }
                                },
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'KIỂM TRA ÂM THANH & RUNG',
                        style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isRinging ? const Color(0xFFEF4444) : cardBg,
                                foregroundColor: isRinging ? Colors.white : textColor,
                                elevation: 0,
                                side: BorderSide(color: isRinging ? const Color(0xFFEF4444) : dividerColor),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              icon: Icon(isRinging ? Icons.stop_rounded : Icons.phone_in_talk_rounded, size: 18),
                              label: Text(isRinging ? 'Dừng chuông' : 'Thử chuông gọi', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              onPressed: () {
                                if (isRinging) {
                                  SoundService.stopRingtone();
                                  setModalState(() => isRinging = false);
                                } else {
                                  SoundService.playRingtone();
                                  setModalState(() => isRinging = true);
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: cardBg,
                                foregroundColor: textColor,
                                elevation: 0,
                                side: BorderSide(color: dividerColor),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                              icon: const Icon(Icons.message_rounded, size: 18, color: Color(0xFF0068FF)),
                              label: const Text('Thử âm tin nhắn', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              onPressed: () {
                                SoundService.playMessageSound();
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: dividerColor),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.apple, color: Color(0xFF0068FF), size: 22),
                                const SizedBox(width: 8),
                                Text(
                                  'Hướng dẫn cho iPhone / iOS',
                                  style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 14.5),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            _buildIosStep('1', 'Mở bằng Safari', 'Truy cập link web app bằng trình duyệt Safari trên iPhone.', textColor, subTextColor),
                            const SizedBox(height: 8),
                            _buildIosStep('2', 'Thêm vào MH chính', 'Bấm nút Chia sẻ (⎋) ở thanh công cụ dưới cùng Safari ➔ Chọn "Thêm vào MH chính" (Add to Home Screen).', textColor, subTextColor),
                            const SizedBox(height: 8),
                            _buildIosStep('3', 'Mở app & Bật thông báo', 'Mở app từ biểu tượng ngoài màn hình chính, vào mục này và bấm "Bật thông báo trên thiết bị này" ➔ Chọn "Cho phép".', textColor, subTextColor),
                            const SizedBox(height: 8),
                            _buildIosStep('4', 'Cài đặt iOS', 'Vào Cài đặt iPhone ➔ Thông báo ➔ Chat Tho-Fi ➔ Bật Màn hình khóa, Biểu ngữ và Âm thanh.', textColor, subTextColor),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildIosStep(String step, String title, String desc, Color textColor, Color subTextColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xFF0068FF),
            shape: BoxShape.circle,
          ),
          child: Text(step, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: TextSpan(
              style: TextStyle(color: subTextColor, fontSize: 12.5, height: 1.35),
              children: [
                TextSpan(text: '$title: ', style: TextStyle(color: textColor, fontWeight: FontWeight.bold)),
                TextSpan(text: desc),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
