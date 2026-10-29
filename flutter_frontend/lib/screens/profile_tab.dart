import 'profile_photo_viewer.dart';
import '../widgets/profile_cover.dart';
import '../widgets/tab_design.dart';
import '../widgets/app_avatar.dart';
import 'dart:async';
import 'package:universal_html/html.dart' as html;
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

  Future<void> _refreshProfileImage(String field, String image) async {
    final provider = context.read<ChatProvider>();
    final original = provider.currentUser;
    if (original == null) return;
    // Apply the successful upload immediately, then replace its data URL with
    // the stored server URL. Refreshing conversations does not refresh /me.
    await provider.setCurrentUser({...original.toJson(), field: image});
    final response = await ApiService.getMe();
    final updated = response['data'] ?? response['user'];
    if (mounted &&
        updated is Map<String, dynamic> &&
        updated['id']?.toString() == provider.currentUser?.id) {
      await provider.setCurrentUser(updated);
    }
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
          if (!mounted) return;
          final uploadUserId = context.read<ChatProvider>().currentUser?.id;
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
              if (mounted &&
                  context.read<ChatProvider>().currentUser?.id ==
                      uploadUserId) {
                setState(() => _isUploadingAvatar = false);
                if (success) {
                  await _refreshProfileImage('avatar', compressedBase64);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cập nhật ảnh đại diện thành công!'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Lỗi khi cập nhật ảnh đại diện. Vui lòng thử lại.'),
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
          if (!mounted) return;
          final uploadUserId = context.read<ChatProvider>().currentUser?.id;
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
              final success =
                  await ApiService.updateCoverImage(compressedBase64);
              if (mounted &&
                  context.read<ChatProvider>().currentUser?.id ==
                      uploadUserId) {
                setState(() => _isUploadingCover = false);
                if (success) {
                  await _refreshProfileImage('coverImage', compressedBase64);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Cập nhật ảnh bìa thành công!'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content:
                          Text('Lỗi khi cập nhật ảnh bìa. Vui lòng thử lại.'),
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
    final isDark =
        Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
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
              const Text('Thông tin cá nhân',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading:
                    const Icon(Icons.person_rounded, color: Color(0xFF0068FF)),
                title: const Text('Họ và tên'),
                subtitle: Text(user?.fullName ?? 'Chưa cập nhật',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.alternate_email_rounded,
                    color: Color(0xFF0068FF)),
                title: const Text('Tên người dùng (@username)'),
                subtitle: Text('@${user?.username ?? "user"}',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.info_outline_rounded,
                    color: Color(0xFF0068FF)),
                title: const Text('Tiểu sử'),
                subtitle: Text(
                  user?.bio != null && user!.bio.toString().isNotEmpty
                      ? user.bio
                      : 'Chưa có tiểu sử',
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

  void _openSettings([String? section]) {
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => SettingsScreen(
                onLogout: widget.onLogout, initialSection: section)));
  }

  void _showAppearance() {
    showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
              child: Consumer<ThemeProvider>(
                  builder: (_, theme, __) => Padding(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                          const ListTile(
                              title: Text('Giao diện',
                                  style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700))),
                          SwitchListTile(
                              title: const Text('Chế độ tối'),
                              subtitle:
                                  const Text('Áp dụng trên toàn bộ ứng dụng'),
                              value: theme.isDarkMode,
                              onChanged: theme.toggleDarkMode),
                        ]),
                      )),
            ));
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final user = provider.currentUser;
    final dark = context.watch<ThemeProvider>().isDarkMode;
    final surface = dark ? const Color(0xFF1E293B) : Colors.white;
    final muted = dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final bg = dark ? const Color(0xFF0F172A) : const Color(0xFFF7F9FC);
    final fullName = user?.fullName ?? 'Người dùng';
    final avatar = user?.avatar;
    final cover = user?.coverImage;
    final bio = user?.bio?.trim() ?? '';
    final ImageProvider fullCover;
    if (cover != null && cover.isNotEmpty) {
      fullCover = ResizeImage(NetworkImage(cover), width: 1200);
    } else {
      fullCover = const ExactAssetImage('assets/profile-cover-bay.webp');
    }
    Widget defaultCover() => Image.asset('assets/profile-cover-bay.webp',
        scale: 1,
        width: double.infinity,
        fit: BoxFit.contain,
        excludeFromSemantics: true);
    Widget row(IconData icon, String label, VoidCallback tap,
            {bool danger = false}) =>
        ListTile(
          minVerticalPadding: 8,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
          leading: Icon(icon,
              size: 23,
              color: danger
                  ? const Color(0xFFDC3545)
                  : Theme.of(context).colorScheme.onSurface),
          title: Text(label,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: danger ? const Color(0xFFDC3545) : null)),
          trailing: danger
              ? null
              : Icon(Icons.chevron_right_rounded, color: muted, size: 21),
          onTap: tap,
        );
    return ColoredBox(
        color: bg,
        child: SingleChildScrollView(
          key: const PageStorageKey('profile-workspace'),
          child: Column(children: [
            ColoredBox(
                color: surface,
                child: TabHeading(title: 'Cá nhân', brandActions: [
                  IconButton(
                      tooltip: 'Cài đặt',
                      icon: const Icon(Icons.settings_outlined),
                      onPressed: () => _openSettings()),
                ])),
            RepaintBoundary(
                child: ColoredBox(
                    color: surface,
                    child: Column(children: [
                      ProfileCover(
                        image: fullCover,
                        onOpen: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => ProfilePhotoViewer(
                                    title: 'Ảnh bìa',
                                    image: cover != null && cover.isNotEmpty
                                        ? NetworkImage(cover) as ImageProvider
                                        : const ExactAssetImage(
                                            'assets/profile-cover-bay.webp')))),
                        fallback: defaultCover(),
                        editControl: Material(
                            color: Colors.black.withOpacity(0.5),
                            borderRadius: BorderRadius.circular(12),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: _isUploadingCover
                                  ? null
                                  : _pickAndUpdateCoverImage,
                              child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 10),
                                  child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        _isUploadingCover
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child:
                                                    CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        color: Colors.white))
                                            : const Icon(
                                                Icons.camera_alt_outlined,
                                                size: 18,
                                                color: Colors.white),
                                        const SizedBox(width: 5),
                                        Text(
                                            _isUploadingCover
                                                ? 'Đang tải...'
                                                : 'Sửa ảnh bìa',
                                            style: const TextStyle(
                                                fontSize: 11,
                                                color: Colors.white,
                                                fontWeight: FontWeight.w600)),
                                      ])),
                            )),
                        avatar: Stack(clipBehavior: Clip.none, children: [
                          Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                  color: surface,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                        color: Colors.black.withOpacity(0.1),
                                        blurRadius: 12,
                                        offset: const Offset(0, 3))
                                  ]),
                              child: Semantics(
                                  label: avatar != null && avatar.isNotEmpty
                                      ? 'Xem ảnh đại diện'
                                      : 'Ảnh đại diện',
                                  button: avatar != null && avatar.isNotEmpty,
                                  child: InkWell(
                                      customBorder: const CircleBorder(),
                                      onTap: avatar != null && avatar.isNotEmpty
                                          ? () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                  builder: (_) => ProfilePhotoViewer(
                                                      title: 'Ảnh đại diện',
                                                      image: NetworkImage(
                                                          avatar))))
                                          : null,
                                      child: AppAvatar(
                                          overlayChild: _isUploadingAvatar,
                                          radius: 46,
                                          backgroundColor:
                                              const Color(0xFF0068FF),
                                          backgroundImage: avatar != null && avatar.isNotEmpty
                                              ? NetworkImage(avatar)
                                              : null,
                                          child: _isUploadingAvatar
                                              ? const CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  color: Colors.white)
                                              : Text(fullName.isEmpty ? 'U' : fullName.characters.first.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w700)))))),
                          Positioned(
                              bottom: 0,
                              right: -2,
                              child: Material(
                                  color: const Color(0xFF0068FF),
                                  shape: const CircleBorder(),
                                  child: IconButton(
                                      tooltip: 'Đổi ảnh đại diện',
                                      onPressed: _isUploadingAvatar
                                          ? null
                                          : _pickAndUpdateAvatar,
                                      constraints: const BoxConstraints(
                                          minWidth: 36, minHeight: 36),
                                      padding: const EdgeInsets.all(8),
                                      icon: const Icon(
                                          Icons.camera_alt_outlined,
                                          size: 17,
                                          color: Colors.white)))),
                        ]),
                      ),
                      Padding(
                          padding: const EdgeInsets.fromLTRB(20, 46, 20, 18),
                          child: Column(children: [
                            Text(fullName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontSize: 21,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.5)),
                            const SizedBox(height: 3),
                            Text('@${user?.username ?? 'user'}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: muted, fontSize: 13)),
                            if (bio.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(bio,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                      color: muted, fontSize: 12, height: 1.4))
                            ],
                            const SizedBox(height: 12),
                            OutlinedButton(
                                onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) =>
                                            const EditProfileScreen())),
                                style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(180, 42),
                                    foregroundColor:
                                        Theme.of(context).colorScheme.primary,
                                    side: BorderSide(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 20, vertical: 10),
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(20))),
                                child: const Text('Chỉnh sửa hồ sơ',
                                    style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600))),
                          ])),
                    ]))),
            Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
                child: Material(
                    color: surface,
                    borderRadius: BorderRadius.circular(18),
                    clipBehavior: Clip.antiAlias,
                    child: Column(children: [
                      row(
                          Icons.qr_code_rounded,
                          'Mã QR của tôi',
                          () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const MyQrScreen()))),
                      Divider(
                          height: 1,
                          indent: 54,
                          endIndent: 16,
                          color: muted.withOpacity(0.15)),
                      row(Icons.bookmark_outline_rounded, 'Tin nhắn lưu trữ',
                          () {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                            content: Text(
                                'Xem các tin nhắn đã ghim trong phần thông tin cuộc trò chuyện.')));
                      }),
                      Divider(
                          height: 1,
                          indent: 54,
                          endIndent: 16,
                          color: muted.withOpacity(0.15)),
                      row(Icons.notifications_none_rounded, 'Thông báo',
                          () => _openSettings('notifications')),
                      Divider(
                          height: 1,
                          indent: 54,
                          endIndent: 16,
                          color: muted.withOpacity(0.15)),
                      row(Icons.palette_outlined, 'Giao diện', _showAppearance),
                      Divider(
                          height: 1,
                          indent: 54,
                          endIndent: 16,
                          color: muted.withOpacity(0.15)),
                      row(Icons.lock_outline_rounded, 'Quyền riêng tư',
                          () => _openSettings('privacy')),
                    ]))),
            Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 20),
                child: Material(
                    color: surface,
                    clipBehavior: Clip.antiAlias,
                    borderRadius: BorderRadius.circular(18),
                    child: row(
                        Icons.logout_rounded, 'Đăng xuất', widget.onLogout,
                        danger: true))),
          ]),
        ));
  }
}
