import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import 'settings_screen.dart';
import 'edit_profile_screen.dart';
import 'my_qr_screen.dart';

class ProfileTab extends StatefulWidget {
  final VoidCallback onLogout;

  const ProfileTab({
    Key? key,
    required this.onLogout,
  }) : super(key: key);

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  final _bioController = TextEditingController();
  final _fullNameController = TextEditingController();
  bool _isSavingProfile = false;

  @override
  void dispose() {
    _bioController.dispose();
    _fullNameController.dispose();
    super.dispose();
  }

  void _showEditProfileDialog(dynamic user) {
    _fullNameController.text = user?.fullName ?? '';
    _bioController.text = user?.bio ?? '';

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Row(
                children: [
                  Icon(Icons.edit_rounded, color: Color(0xFF0068FF)),
                  SizedBox(width: 10),
                  Text('Chỉnh sửa thông tin', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _fullNameController,
                    decoration: InputDecoration(
                      labelText: 'Tên hiển thị',
                      prefixIcon: const Icon(Icons.person_outline_rounded),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _bioController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Tiểu sử / Dòng trạng thái',
                      prefixIcon: const Icon(Icons.chat_bubble_outline_rounded),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0068FF),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _isSavingProfile
                      ? null
                      : () async {
                          final newName = _fullNameController.text.trim();
                          final newBio = _bioController.text.trim();

                          if (newName.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Tên hiển thị không được để trống')),
                            );
                            return;
                          }

                          setDialogState(() => _isSavingProfile = true);
                          final success = await ApiService.updateProfile(fullName: newName, bio: newBio);
                          setDialogState(() => _isSavingProfile = false);

                          if (mounted) {
                            Navigator.pop(dialogCtx);
                            if (success) {
                              final provider = Provider.of<ChatProvider>(context, listen: false);
                              final updatedUser = Map<String, dynamic>.from(provider.currentUser?.toJson() ?? {});
                              updatedUser['fullName'] = newName;
                              updatedUser['bio'] = newBio;
                              provider.setCurrentUser(updatedUser);

                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Cập nhật trang cá nhân thành công!'),
                                  backgroundColor: Color(0xFF10B981),
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Cập nhật thất bại, vui lòng thử lại')),
                              );
                            }
                          }
                        },
                  child: _isSavingProfile
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Lưu thay đổi', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showQrCodeModal(dynamic user) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Mã QR cá nhân',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(
                'Quét mã để kết bạn nhanh trên Chat Tho-Fi',
                style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 15, offset: const Offset(0, 4)),
                  ],
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.qr_code_2_rounded,
                      size: 180,
                      color: const Color(0xFF0068FF),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user?.fullName ?? 'Người dùng',
                      style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      '@${user?.username ?? "user"}',
                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  void _showPersonalDetailsModal(dynamic user) {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      backgroundColor: cardBg,
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white24 : Colors.black12,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Thông tin cá nhân', style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person_rounded, color: Color(0xFF0068FF)),
                title: const Text('Họ và tên'),
                subtitle: Text(user?.fullName ?? 'Chưa cập nhật', style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.alternate_email_rounded, color: Color(0xFF0068FF)),
                title: const Text('Tên người dùng (@username)'),
                subtitle: Text('@${user?.username ?? "user"}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.info_outline_rounded, color: Color(0xFF0068FF)),
                title: const Text('Tiểu sử'),
                subtitle: Text(user?.bio != null && user!.bio.toString().isNotEmpty ? user.bio : 'Chưa có tiểu sử', style: const TextStyle(fontWeight: FontWeight.w500)),
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = Provider.of<ChatProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);
    final user = chatProvider.currentUser;
    final isDark = themeProvider.isDarkMode;

    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final dividerColor = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);

    final String fullName = user?.fullName ?? 'Người dùng';
    final String username = user?.username ?? 'user';
    final String bio = (user?.bio != null && user!.bio!.trim().isNotEmpty)
        ? user.bio!
        : 'Đang hoạt động trên Chat Tho-Fi ✨';
    final String? avatarUrl = user?.avatar;
    final String? coverUrl = user?.coverImage;

    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // 1. Header tràn viền (Cover Photo & Stack Avatar)
          SliverToBoxAdapter(
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.bottomLeft,
              children: [
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Khung Ảnh Bìa (Cover Photo)
                    Container(
                      height: 210,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0052D4), Color(0xFF4364F7), Color(0xFF6FB1FC)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        image: (coverUrl != null && coverUrl.isNotEmpty)
                            ? DecorationImage(
                                image: NetworkImage(coverUrl),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: Stack(
                        children: [
                          // Overlay gradient mờ phía trên để icon bánh răng luôn nổi bật
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.black.withOpacity(0.4),
                                    Colors.transparent,
                                    Colors.black.withOpacity(0.2),
                                  ],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                          ),
                          // Nút Cài đặt (Gear Icon) góc trên cùng bên phải bọc trong hình tròn mờ
                          Positioned(
                            top: 16,
                            right: 16,
                            child: SafeArea(
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(24),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => SettingsScreen(onLogout: widget.onLogout),
                                      ),
                                    );
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withOpacity(0.35),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white.withOpacity(0.3), width: 1),
                                    ),
                                    child: const Icon(
                                      Icons.settings_rounded,
                                      color: Colors.white,
                                      size: 22,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Khoảng không cho Avatar đè xuống & thông tin cá nhân bên dưới
                    Container(
                      width: double.infinity,
                      color: cardBgColor,
                      padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      fullName,
                                      style: TextStyle(
                                        color: textColor,
                                        fontSize: 22,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '@$username',
                                      style: TextStyle(
                                        color: subTextColor,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Nút Chỉnh sửa profile
                              OutlinedButton.icon(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                                  );
                                },
                                icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF0068FF)),
                                label: const Text(
                                  'Sửa',
                                  style: TextStyle(color: Color(0xFF0068FF), fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF0068FF), width: 1.2),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.format_quote_rounded, size: 14, color: subTextColor),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    bio,
                                    style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w500),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Avatar đè lên cạnh dưới của Ảnh bìa với viền trắng nổi bật
                Positioned(
                  left: 20,
                  bottom: 110,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: cardBgColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.12),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: CircleAvatar(
                      radius: 44,
                      backgroundColor: const Color(0xFF0068FF),
                      backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                          ? NetworkImage(avatarUrl)
                          : null,
                      child: (avatarUrl == null || avatarUrl.isEmpty)
                          ? Text(
                              fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U',
                              style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Khoảng phân cách mờ
          SliverToBoxAdapter(
            child: Container(
              height: 10,
              color: bgColor,
            ),
          ),

          // 3. Danh sách tính năng (Menu phẳng tràn viền)
          SliverToBoxAdapter(
            child: Container(
              color: cardBgColor,
              child: Column(
                children: [
                  // NHÓM 1: Thông tin & Mã QR
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0068FF).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.person_outline_rounded, color: Color(0xFF0068FF), size: 22),
                    ),
                    title: Text(
                      'Thông tin cá nhân',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Xem và cập nhật chi tiết tài khoản', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const EditProfileScreen()),
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
                      child: const Icon(Icons.qr_code_rounded, color: Color(0xFF10B981), size: 22),
                    ),
                    title: Text(
                      'Mã QR của tôi',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Chia sẻ mã QR để kết bạn nhanh', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const MyQrScreen()),
                      );
                    },
                  ),

                  // Ngăn cách nhóm mờ
                  Divider(height: 16, thickness: 8, color: bgColor),

                  // NHÓM 2: Lưu trữ & Bảo mật
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.archive_outlined, color: Color(0xFF8B5CF6), size: 22),
                    ),
                    title: Text(
                      'Tin nhắn lưu trữ',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Lưu trữ đám mây & các đoạn chat đã ghim', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Tính năng Tin nhắn lưu trữ đang hoạt động tích hợp đám mây')),
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
                      child: const Icon(Icons.security_rounded, color: Color(0xFFF59E0B), size: 22),
                    ),
                    title: Text(
                      'Bảo mật & Quyền riêng tư',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Cài đặt ai có thể tìm thấy và nhắn tin cho bạn', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SettingsScreen(onLogout: widget.onLogout),
                        ),
                      );
                    },
                  ),

                  // Ngăn cách nhóm mờ
                  Divider(height: 16, thickness: 8, color: bgColor),

                  // NHÓM 3: Tiện ích & Hỗ trợ
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEC4899).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.help_outline_rounded, color: Color(0xFFEC4899), size: 22),
                    ),
                    title: Text(
                      'Trung tâm trợ giúp',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Hướng dẫn sử dụng & báo cáo sự cố', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: Icon(Icons.arrow_forward_ios_rounded, color: subTextColor, size: 16),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Chat Tho-Fi v1.0.0 hỗ trợ 24/7')),
                      );
                    },
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
