import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class OtherUserProfileScreen extends StatefulWidget {
  final String userId;
  final Map<String, dynamic>? initialUserData;

  const OtherUserProfileScreen({
    Key? key,
    required this.userId,
    this.initialUserData,
  }) : super(key: key);

  @override
  State<OtherUserProfileScreen> createState() => _OtherUserProfileScreenState();
}

class _OtherUserProfileScreenState extends State<OtherUserProfileScreen> {
  Map<String, dynamic>? _userData;
  bool _isLoading = true;
  bool _isActionLoading = false;
  StreamSubscription? _profileSub;

  @override
  void initState() {
    super.initState();
    if (widget.initialUserData != null) {
      _userData = Map<String, dynamic>.from(widget.initialUserData!);
      _isLoading = false;
    }
    _loadProfileData();
    _profileSub = SocketService.onUserProfileUpdated.listen((data) {
      final updatedId = data['id']?.toString() ?? data['userId']?.toString();
      final currentTargetId = _userData?['id']?.toString() ?? widget.userId;
      if ((updatedId == widget.userId || (updatedId != null && updatedId == currentTargetId)) && mounted) {
        if (_userData != null) {
          setState(() {
            if (data['fullName'] != null) _userData!['fullName'] = data['fullName'];
            if (data['bio'] != null) _userData!['bio'] = data['bio'];
            if (data['avatar'] != null) _userData!['avatar'] = data['avatar'];
            if (data['coverPhoto'] != null || data['coverImage'] != null) {
              _userData!['coverPhoto'] = data['coverPhoto'] ?? data['coverImage'];
              _userData!['coverImage'] = data['coverPhoto'] ?? data['coverImage'];
            }
          });
        } else {
          _loadProfileData();
        }
      }
    });
  }

  @override
  void dispose() {
    _profileSub?.cancel();
    super.dispose();
  }

  Future<void> _loadProfileData() async {
    if (_userData == null && mounted) {
      setState(() => _isLoading = true);
    }
    try {
      final data = await ApiService.lookupUserById(widget.userId);
      if (mounted) {
        setState(() {
          if (data != null) {
            _userData = data;
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('⚠️ Error loading other user profile: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleSendFriendRequest() async {
    if (_userData == null) return;
    setState(() => _isActionLoading = true);
    final success = await ApiService.sendFriendRequest(widget.userId);
    setState(() => _isActionLoading = false);

    if (mounted) {
      if (success) {
        SocketService.emitSendFriendRequest(widget.userId);
        setState(() {
          _userData!['status'] = 'PENDING';
          _userData!['relationship'] = 'pending_sent';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã gửi lời mời kết bạn tới ${_userData!['fullName'] ?? _userData!['username']}'),
            backgroundColor: const Color(0xFF0068FF),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể gửi lời mời kết bạn, vui lòng thử lại sau.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _handleCancelFriendRequest() async {
    if (_userData == null) return;
    setState(() => _isActionLoading = true);
    final success = await ApiService.cancelFriendRequest(widget.userId);
    setState(() => _isActionLoading = false);

    if (mounted) {
      if (success) {
        setState(() {
          _userData!['status'] = 'NONE';
          _userData!['relationship'] = 'none';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã hủy lời mời kết bạn.'),
            backgroundColor: Color(0xFF64748B),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể hủy lời mời, vui lòng thử lại sau.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _handleAcceptFriendRequest() async {
    if (_userData == null) return;
    setState(() => _isActionLoading = true);
    final success = await ApiService.acceptFriendRequest(widget.userId);
    setState(() => _isActionLoading = false);

    if (mounted) {
      if (success) {
        setState(() {
          _userData!['status'] = 'FRIEND';
          _userData!['relationship'] = 'friends';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng ý kết bạn với ${_userData!['fullName'] ?? _userData!['username']}'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Thao tác thất bại, vui lòng thử lại sau.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _handleUnfriend() async {
    if (_userData == null) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
            SizedBox(width: 10),
            Text('Xóa bạn bè', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'Bạn có chắc chắn muốn xóa ${_userData!['fullName'] ?? _userData!['username']} khỏi danh sách bạn bè không?',
          style: const TextStyle(color: Color(0xFF475569)),
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
              setState(() => _isActionLoading = true);
              final success = await ApiService.deleteFriend(widget.userId);
              setState(() => _isActionLoading = false);

              if (mounted) {
                if (success) {
                  setState(() {
                    _userData!['status'] = 'NONE';
                    _userData!['relationship'] = 'none';
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã xóa khỏi danh sách bạn bè.'),
                      backgroundColor: Color(0xFF64748B),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Xóa bạn bè thất bại, thử lại sau.'),
                      backgroundColor: Color(0xFFEF4444),
                    ),
                  );
                }
              }
            },
            child: const Text('Xóa bạn', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _handleStartChat() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    Navigator.pop(context); // Close profile screen
    await chatProvider.startPrivateChat(widget.userId);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    if (_isLoading) {
      return Scaffold(
        backgroundColor: bgColor,
        appBar: AppBar(
          backgroundColor: cardBgColor,
          elevation: 0.5,
          leading: IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text('Trang cá nhân', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18)),
          centerTitle: true,
        ),
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFF0068FF)),
        ),
      );
    }

    if (_userData == null) {
      return Scaffold(
        backgroundColor: bgColor,
        appBar: AppBar(
          backgroundColor: cardBgColor,
          elevation: 0.5,
          leading: IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text('Trang cá nhân', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18)),
          centerTitle: true,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
              const SizedBox(height: 12),
              Text('Không thể tải thông tin hồ sơ.', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadProfileData,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Thử lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0068FF),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final String fullName = _userData?['fullName'] ?? _userData?['username'] ?? 'Người dùng';
    final String username = _userData?['username'] ?? 'user';
    final String bio = (_userData?['bio'] != null && _userData!['bio'].toString().trim().isNotEmpty)
        ? _userData!['bio'].toString().trim()
        : 'Đang sử dụng Chat Tho-Fi ✨';
    final String? avatarUrl = _userData?['avatar'];
    final String? coverUrl = _userData?['coverPhoto'] ?? _userData?['coverImage'];
    final bool isOnline = _userData?['isOnline'] == true;

    final String status = (_userData?['status'] ?? 'NONE').toString().toUpperCase();
    final String relationship = (_userData?['relationship'] ?? 'none').toString().toLowerCase();

    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          // 1. Header (Ảnh bìa + Avatar tràn viền)
          SliverToBoxAdapter(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Khung chứa Ảnh bìa (Cover Photo)
                Container(
                  height: 220,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0068FF),
                    gradient: coverUrl == null
                        ? LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: isDark
                                ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                                : [const Color(0xFF0068FF), const Color(0xFF00C6FF)],
                          )
                        : null,
                    image: coverUrl != null
                        ? DecorationImage(
                            image: NetworkImage(coverUrl),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                ),

                // Top Floating AppBar Controls (Back + 3 Dots Menu)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Back Button with blurred dark background
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.35),
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
                            onPressed: () => Navigator.pop(context),
                            tooltip: 'Quay lại',
                          ),
                        ),

                        // Popup Menu (Chặn, Báo cáo, Xóa bạn bè)
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.35),
                            shape: BoxShape.circle,
                          ),
                          child: PopupMenuButton<String>(
                            icon: const Icon(Icons.more_vert_rounded, color: Colors.white, size: 22),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            onSelected: (val) {
                              if (val == 'unfriend') {
                                _handleUnfriend();
                              } else if (val == 'block') {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Đã chặn người dùng này.')),
                                );
                              } else if (val == 'report') {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Đã gửi báo cáo vi phạm tới quản trị viên.')),
                                );
                              }
                            },
                            itemBuilder: (ctx) => [
                              if (status == 'FRIEND' || relationship == 'friends')
                                const PopupMenuItem<String>(
                                  value: 'unfriend',
                                  child: Row(
                                    children: [
                                      Icon(Icons.person_remove_rounded, color: Color(0xFFEF4444), size: 20),
                                      SizedBox(width: 10),
                                      Text('Xóa bạn bè', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ),
                              const PopupMenuItem<String>(
                                value: 'block',
                                child: Row(
                                  children: [
                                    Icon(Icons.block_rounded, color: Color(0xFF64748B), size: 20),
                                    SizedBox(width: 10),
                                    Text('Chặn người này'),
                                  ],
                                ),
                              ),
                              const PopupMenuItem<String>(
                                value: 'report',
                                child: Row(
                                  children: [
                                    Icon(Icons.flag_outlined, color: Color(0xFF64748B), size: 20),
                                    SizedBox(width: 10),
                                    Text('Báo cáo vi phạm'),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Card thông tin chính nằm đè bên dưới
                Container(
                  margin: const EdgeInsets.only(top: 170),
                  padding: const EdgeInsets.fromLTRB(20, 56, 20, 24),
                  decoration: BoxDecoration(
                    color: cardBgColor,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
                        blurRadius: 16,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Tên hiển thị + Username
                      Text(
                        fullName,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '@$username',
                        style: TextStyle(color: subTextColor, fontSize: 14, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 10),

                      // Bio badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Cụm 3 nút Hành động (Nhắn tin, Gọi thoại, Gọi Video)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // 1. Nút Nhắn tin (Nền xanh)
                          _buildActionButtonItem(
                            icon: Icons.chat_bubble_rounded,
                            label: 'Nhắn tin',
                            bgColor: const Color(0xFF0068FF),
                            iconColor: Colors.white,
                            textColor: Colors.white,
                            onTap: _handleStartChat,
                          ),
                          const SizedBox(width: 16),

                          // 2. Nút Gọi thoại (Nền xám)
                          _buildActionButtonItem(
                            icon: Icons.phone_rounded,
                            label: 'Gọi thoại',
                            bgColor: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                            iconColor: isDark ? Colors.white : const Color(0xFF475569),
                            textColor: textColor,
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Đang khởi tạo cuộc gọi thoại...')),
                              );
                            },
                          ),
                          const SizedBox(width: 16),

                          // 3. Nút Gọi Video (Nền xám)
                          _buildActionButtonItem(
                            icon: Icons.videocam_rounded,
                            label: 'Gọi Video',
                            bgColor: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                            iconColor: isDark ? Colors.white : const Color(0xFF475569),
                            textColor: textColor,
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Đang khởi tạo cuộc gọi Video...')),
                              );
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Trạng thái Quan hệ (Full-width button)
                      if (_isActionLoading)
                        const SizedBox(height: 50, child: Center(child: CircularProgressIndicator(color: Color(0xFF0068FF))))
                      else
                        _buildRelationshipButton(status, relationship, isDark),
                    ],
                  ),
                ),

                // Avatar đè lên giữa mép Ảnh bìa
                Positioned(
                  top: 120,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: cardBgColor,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.15),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Stack(
                        children: [
                          CircleAvatar(
                            radius: 46,
                            backgroundColor: const Color(0xFF0068FF),
                            backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty)
                                ? NetworkImage(avatarUrl)
                                : null,
                            child: (avatarUrl == null || avatarUrl.isEmpty)
                                ? Text(
                                    fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U',
                                    style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                                  )
                                : null,
                          ),
                          if (isOnline)
                            Positioned(
                              right: 2,
                              bottom: 2,
                              child: Container(
                                width: 18,
                                height: 18,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: cardBgColor, width: 3),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtonItem({
    required IconData icon,
    required String label,
    required Color bgColor,
    required Color iconColor,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: bgColor.withOpacity(0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(color: textColor, fontSize: 12.5, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildRelationshipButton(String status, String relationship, bool isDark) {
    if (status == 'SELF' || relationship == 'self') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: const Text(
          'Đây là tài khoản của bạn',
          style: TextStyle(color: Color(0xFF64748B), fontSize: 14, fontWeight: FontWeight.bold),
        ),
      );
    } else if (status == 'FRIEND' || relationship == 'friends') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
        ),
        alignment: Alignment.center,
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
            SizedBox(width: 8),
            Text(
              'Đã là bạn bè',
              style: TextStyle(color: Color(0xFF10B981), fontSize: 15, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    } else if (status == 'PENDING' && relationship == 'pending_sent') {
      return SizedBox(
        width: double.infinity,
        height: 50,
        child: OutlinedButton.icon(
          onPressed: _handleCancelFriendRequest,
          icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFFEF4444)),
          label: const Text(
            'Đã gửi lời mời (Bấm để hủy)',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFEF4444)),
          ),
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
            backgroundColor: const Color(0xFFFEF2F2),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
      );
    } else if (relationship == 'pending_received') {
      return SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton.icon(
          onPressed: _handleAcceptFriendRequest,
          icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
          label: const Text(
            'Chấp nhận lời mời kết bạn',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 2,
          ),
        ),
      );
    } else {
      // status == 'NONE'
      return SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton.icon(
          onPressed: _handleSendFriendRequest,
          icon: const Icon(Icons.person_add_rounded, size: 18),
          label: const Text(
            'Thêm bạn bè',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0068FF),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 2,
          ),
        ),
      );
    }
  }
}
