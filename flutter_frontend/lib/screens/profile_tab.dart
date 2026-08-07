import 'dart:async';
import 'dart:html' as html;
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
  bool _isUploadingAvatar = false;
  bool _isUploadingCover = false;

  /// Tối ưu nén ảnh trực tiếp bằng HTML Canvas siêu nhanh trên Web
  /// Giảm kích thước file ảnh từ ~15MB xuống còn ~80KB HD
  /// Tối ưu nén ảnh trực tiếp bằng HTML Canvas siêu nhanh trên Web
  /// Giảm kích thước file ảnh từ ~15MB xuống còn ~80KB HD
  Future<String> _compressImageBase64(
    String base64Data, {
    required int maxWidth,
    required int maxHeight,
    double quality = 0.82,
  }) {
    final completer = Completer<String>();
    final img = html.ImageElement();

    img.onLoad.listen((_) {
      int width = img.width ?? maxWidth;
      int height = img.height ?? maxHeight;
      if (width <= 0) width = maxWidth;
      if (height <= 0) height = maxHeight;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = (height * maxWidth / width).round();
          width = maxWidth;
        } else {
          width = (width * maxHeight / height).round();
          height = maxHeight;
        }
      }

      final canvas = html.CanvasElement(width: width, height: height);
      final ctx = canvas.context2D;
      ctx.drawImageScaled(img, 0, 0, width, height);
      final compressed = canvas.toDataUrl('image/jpeg', quality);
      if (!completer.isCompleted) completer.complete(compressed);
    });

    img.onError.listen((_) {
      if (!completer.isCompleted) completer.complete(base64Data);
    });

    // Đặt img.src SAU KHI đã gắn listener onLoad & onError để không bao giờ bị trôi sự kiện load 1st time
    img.src = base64Data;

    // Timeout dự phòng sau 2.5 giây nếu browser không kích hoạt onLoad
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (!completer.isCompleted) {
        completer.complete(base64Data);
      }
    });

    return completer.future;
  }

  void _pickAndUpdateAvatar() {
    final uploadInput = html.FileUploadInputElement()..accept = 'image/*';
    uploadInput.click();
    uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final file = files[0];
        final reader = html.FileReader();
        reader.readAsDataUrl(file);
        reader.onLoadEnd.listen((e) async {
          if (reader.result is String) {
            final rawBase64 = reader.result as String;
            setState(() => _isUploadingAvatar = true);
            try {
              final compressedBase64 = await _compressImageBase64(
                rawBase64,
                maxWidth: 512,
                maxHeight: 512,
                quality: 0.82,
              );
              final success = await ApiService.updateAvatar(compressedBase64);
              if (mounted) {
                setState(() => _isUploadingAvatar = false);
                if (success) {
                  Provider.of<ChatProvider>(context, listen: false).fetchConversations(showLoading: false);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cập nhật ảnh đại diện thành công!'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Lỗi khi cập nhật ảnh đại diện. Vui lòng thử lại.'),
                      backgroundColor: Color(0xFFEF4444),
                    ),
                  );
                }
              }
            } catch (err) {
              if (mounted) {
                setState(() => _isUploadingAvatar = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Lỗi xử lý ảnh: $err'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              }
            }
          }
        });
      }
    });
  }

  void _pickAndUpdateCoverImage() {
    final uploadInput = html.FileUploadInputElement()..accept = 'image/*';
    uploadInput.click();
    uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final file = files[0];
        final reader = html.FileReader();
        reader.readAsDataUrl(file);
        reader.onLoadEnd.listen((e) async {
          if (reader.result is String) {
            final rawBase64 = reader.result as String;
            setState(() => _isUploadingCover = true);
            try {
              final compressedBase64 = await _compressImageBase64(
                rawBase64,
                maxWidth: 1280,
                maxHeight: 720,
                quality: 0.82,
              );
              final success = await ApiService.updateCoverImage(compressedBase64);
              if (mounted) {
                setState(() => _isUploadingCover = false);
                if (success) {
                  Provider.of<ChatProvider>(context, listen: false).fetchConversations(showLoading: false);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cập nhật ảnh bìa thành công!'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Lỗi khi cập nhật ảnh bìa. Vui lòng thử lại.'),
                      backgroundColor: Color(0xFFEF4444),
                    ),
                  );
                }
              }
            } catch (err) {
              if (mounted) {
                setState(() => _isUploadingCover = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Lỗi xử lý ảnh: $err'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              }
            }
          }
        });
      }
    });
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
                subtitle: Text(
                  user?.bio != null && user!.bio.toString().isNotEmpty ? user.bio : 'Chưa có tiểu sử',
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
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
      body: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            // 1. Header Stack: Cover Photo + Info Box (Column) with Avatar rendered on TOP as Stack Child 3
            RepaintBoundary(
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.topCenter,
                children: [
                // Child 1: Cover photo & User Details Container in a Column
                Column(
                  children: [
                    // Khung Ảnh Bìa (Cover Photo)
                    Stack(
                      children: [
                        Container(
                          height: 185,
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
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.black.withOpacity(0.35),
                                  Colors.transparent,
                                ],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ),
                            ),
                          ),
                        ),

                        // Nút Đổi Ảnh Bìa (Góc dưới bên phải ảnh bìa)
                        Positioned(
                          bottom: 12,
                          right: 16,
                          child: InkWell(
                            onTap: _isUploadingCover ? null : _pickAndUpdateCoverImage,
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.55),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white.withOpacity(0.4), width: 1),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _isUploadingCover
                                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                      : const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 15),
                                  const SizedBox(width: 4),
                                  Text(
                                    _isUploadingCover ? 'Đang tải...' : 'Sửa ảnh bìa',
                                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    // Khung thông tin cá nhân dưới Avatar
                    Container(
                      width: double.infinity,
                      color: cardBgColor,
                      padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // Tên người dùng căn giữa màn hình (font to, in đậm, xử lý overflow 3 chấm)
                          Text(
                            fullName,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: textColor,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),

                          // @username căn giữa, chữ xám
                          Text(
                            '@$username',
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: subTextColor,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Tiểu sử (Bio) văn bản thuần túy căn giữa, chữ xám, KHÔNG khung/viền
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              bio,
                              textAlign: TextAlign.center,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569),
                                fontSize: 13.5,
                                height: 1.4,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Nút "Chỉnh sửa trang cá nhân" rộng ~80% màn hình
                          SizedBox(
                            width: double.infinity,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: OutlinedButton.icon(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                                  );
                                },
                                icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF0068FF)),
                                label: const Text(
                                  'Chỉnh sửa trang cá nhân',
                                  style: TextStyle(
                                    color: Color(0xFF0068FF),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14.5,
                                  ),
                                ),
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF0068FF), width: 1.5),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  backgroundColor: const Color(0xFF0068FF).withOpacity(0.04),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Child 2: Icon Bánh răng (Cài đặt) ở góc trên cùng bên phải ảnh bìa
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

                // Child 3: Avatar đặt đè lên ranh giới (top = 185 - 46 = 139). VẼ TRÊN CÙNG ĐỂ KHÔNG BAO GIỜ BỊ CHE KHUNG TRẮNG!
                Positioned(
                  top: 139,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: cardBgColor,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.16),
                                blurRadius: 14,
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
                            child: _isUploadingAvatar
                                ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5)
                                : (avatarUrl == null || avatarUrl.isEmpty)
                                    ? Text(
                                        fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U',
                                        style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.bold),
                                      )
                                    : null,
                          ),
                        ),

                        // Nút camera nhỏ ở góc dưới Avatar để thay đổi ảnh đại diện
                        Positioned(
                          bottom: 2,
                          right: 2,
                          child: InkWell(
                            onTap: _isUploadingAvatar ? null : _pickAndUpdateAvatar,
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0068FF),
                                shape: BoxShape.circle,
                                border: Border.all(color: cardBgColor, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 6,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.camera_alt_rounded,
                                color: Colors.white,
                                size: 16,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // 2. Danh sách chức năng phẳng (Menu 3 mục duy nhất)
          RepaintBoundary(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Mục 1: Mã QR của tôi
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                    leading: Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.qr_code_rounded, color: Color(0xFF10B981), size: 22),
                    ),
                    title: Text(
                      'Mã QR của tôi',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Chia sẻ mã QR để kết bạn nhanh', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 24),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const MyQrScreen()),
                      );
                    },
                  ),
                  Divider(height: 1, indent: 68, endIndent: 18, color: dividerColor),

                  // Mục 2: Tin nhắn lưu trữ
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                    leading: Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.bookmark_outline_rounded, color: Color(0xFF8B5CF6), size: 22),
                    ),
                    title: Text(
                      'Tin nhắn lưu trữ',
                      style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    subtitle: Text('Lưu trữ đám mây & tin nhắn đã ghim', style: TextStyle(color: subTextColor, fontSize: 12.5)),
                    trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 24),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Tính năng Tin nhắn lưu trữ đang hoạt động')),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
