import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({Key? key}) : super(key: key);

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _fullNameController = TextEditingController();
  final _bioController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final currentUser = Provider.of<ChatProvider>(context, listen: false).currentUser;
      if (currentUser != null) {
        _fullNameController.text = currentUser.fullName;
        _bioController.text = currentUser.bio ?? '';
      }
    });
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _handleSaveProfile() async {
    final fullName = _fullNameController.text.trim();
    final bio = _bioController.text.trim();

    if (fullName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tên hiển thị không được để trống.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    final success = await ApiService.updateProfile(fullName: fullName, bio: bio);
    setState(() => _isLoading = false);

    if (mounted) {
      if (success) {
        final chatProvider = Provider.of<ChatProvider>(context, listen: false);
        final currentUserMap = Map<String, dynamic>.from(chatProvider.currentUser?.toJson() ?? {});
        currentUserMap['fullName'] = fullName;
        currentUserMap['bio'] = bio;
        chatProvider.setCurrentUser(currentUserMap);

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cập nhật thông tin cá nhân thành công!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cập nhật thất bại, vui lòng thử lại sau.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final chatProvider = Provider.of<ChatProvider>(context);
    final user = chatProvider.currentUser;

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
          'Chỉnh sửa trang cá nhân',
          style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 19),
        ),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _handleSaveProfile,
            child: _isLoading
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Color(0xFF0068FF), strokeWidth: 2))
                : const Text(
                    'Lưu',
                    style: TextStyle(color: Color(0xFF0068FF), fontWeight: FontWeight.bold, fontSize: 16),
                  ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar preview
              Center(
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 46,
                      backgroundColor: const Color(0xFF0068FF),
                      backgroundImage: (user?.avatar != null && user!.avatar!.isNotEmpty)
                          ? NetworkImage(user.avatar!)
                          : null,
                      child: (user?.avatar == null || user!.avatar!.isEmpty)
                          ? Text(
                              (user?.fullName ?? 'U')[0].toUpperCase(),
                              style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '@${user?.username ?? "user"}',
                style: TextStyle(color: subTextColor, fontSize: 13.5),
              ),
              const SizedBox(height: 28),

              // Form fields
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'TÊN HIỂN THỊ',
                  style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _fullNameController,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Nhập tên hiển thị mới',
                  hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                  prefixIcon: const Icon(Icons.person_outline_rounded, color: Color(0xFF0068FF)),
                  filled: true,
                  fillColor: cardBgColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
              ),
              const SizedBox(height: 20),

              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'TIỂU SỬ / DÒNG TRẠNG THÁI',
                  style: TextStyle(color: subTextColor, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.8),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _bioController,
                maxLines: 3,
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Nhập tiểu sử hoặc dòng trạng thái cá nhân...',
                  hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                  prefixIcon: const Padding(
                    padding: EdgeInsets.only(bottom: 36),
                    child: Icon(Icons.format_quote_rounded, color: Color(0xFF0068FF)),
                  ),
                  filled: true,
                  fillColor: cardBgColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                ),
              ),
              const SizedBox(height: 32),

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
                  onPressed: _isLoading ? null : _handleSaveProfile,
                  child: _isLoading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : const Text(
                          'Lưu thay đổi',
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
