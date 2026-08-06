import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class AddFriendScreen extends StatefulWidget {
  const AddFriendScreen({Key? key}) : super(key: key);

  @override
  State<AddFriendScreen> createState() => _AddFriendScreenState();
}

class _AddFriendScreenState extends State<AddFriendScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  List<dynamic> _searchResults = [];
  bool _isSearching = false;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String val) {
    _query = val.trim();
    if (_debounce?.isActive ?? false) _debounce!.cancel();

    if (_query.isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    setState(() => _isSearching = true);
    _debounce = Timer(const Duration(milliseconds: 150), () {
      _performSearch(_query);
    });
  }

  Future<void> _performSearch(String q) async {
    if (q.isEmpty) return;
    final results = await ApiService.searchUsers(q);
    if (mounted && q == _query) {
      setState(() {
        _searchResults = results;
        _isSearching = false;
      });
    }
  }

  Future<void> _handleSendRequest(Map<String, dynamic> user, int index) async {
    final uid = user['id']?.toString() ?? '';
    if (uid.isEmpty) return;

    // Call HTTP API
    final success = await ApiService.sendFriendRequest(uid);

    if (mounted) {
      if (success) {
        // Emit Socket event to trigger real-time notification on receiver's device
        SocketService.emitSendFriendRequest(uid);

        setState(() {
          _searchResults[index]['status'] = 'PENDING';
          _searchResults[index]['relationship'] = 'pending_sent';
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã gửi lời mời kết bạn tới ${user['fullName'] ?? user['username']}'),
            backgroundColor: const Color(0xFF0068FF),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể gửi lời mời kết bạn, vui lòng thử lại sau.')),
        );
      }
    }
  }

  Future<void> _handleCancelRequest(Map<String, dynamic> user, int index) async {
    final uid = user['id']?.toString() ?? '';
    if (uid.isEmpty) return;

    final success = await ApiService.cancelFriendRequest(uid);

    if (mounted) {
      if (success) {
        setState(() {
          _searchResults[index]['status'] = 'NONE';
          _searchResults[index]['relationship'] = 'none';
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã hủy lời mời kết bạn tới ${user['fullName'] ?? user['username']}'),
            backgroundColor: const Color(0xFF64748B),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể hủy lời mời kết bạn, vui lòng thử lại sau.')),
        );
      }
    }
  }

  Future<void> _handleAcceptRequest(Map<String, dynamic> user, int index) async {
    final uid = user['id']?.toString() ?? '';
    if (uid.isEmpty) return;

    final success = await ApiService.acceptFriendRequest(uid);

    if (mounted) {
      if (success) {
        setState(() {
          _searchResults[index]['status'] = 'FRIEND';
          _searchResults[index]['relationship'] = 'friends';
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng ý kết bạn với ${user['fullName'] ?? user['username']}'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Thao tác thất bại, vui lòng thử lại sau.')),
        );
      }
    }
  }

  LinearGradient _getAvatarGradient(String key) {
    final gradients = [
      const LinearGradient(colors: [Color(0xFF007AFF), Color(0xFF5AC8FA)]),
      const LinearGradient(colors: [Color(0xFF5856D6), Color(0xFFAF52DE)]),
      const LinearGradient(colors: [Color(0xFFFF2D55), Color(0xFFFF6482)]),
      const LinearGradient(colors: [Color(0xFFFF9500), Color(0xFFFFCC00)]),
      const LinearGradient(colors: [Color(0xFF34C759), Color(0xFF30D158)]),
      const LinearGradient(colors: [Color(0xFF00C7BE), Color(0xFF63E6E2)]),
      const LinearGradient(colors: [Color(0xFFA28BFE), Color(0xFF6B4EFF)]),
    ];
    final index = key.hashCode.abs() % gradients.length;
    return gradients[index];
  }

  String _getInitials(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'U';
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
    }
    if (trimmed.length >= 2) {
      return trimmed.substring(0, 2).toUpperCase();
    }
    return trimmed[0].toUpperCase();
  }

  Widget _buildActionButton(Map<String, dynamic> user, int index) {
    final status = (user['status'] ?? 'NONE').toString().toUpperCase();
    final relationship = (user['relationship'] ?? 'none').toString().toLowerCase();

    if (status == 'FRIEND' || relationship == 'friends') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Text(
          'Đã là bạn bè',
          style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold),
        ),
      );
    } else if (status == 'SELF' || relationship == 'self') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Text(
          'Tài khoản của bạn',
          style: TextStyle(color: Color(0xFF64748B), fontSize: 12, fontWeight: FontWeight.bold),
        ),
      );
    } else if (relationship == 'pending_received') {
      return ElevatedButton.icon(
        onPressed: () => _handleAcceptRequest(user, index),
        icon: const Icon(Icons.check_circle_outline_rounded, size: 15),
        label: const Text(
          'Chấp nhận',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      );
    } else if (status == 'PENDING' || relationship == 'pending_sent') {
      return OutlinedButton.icon(
        onPressed: () => _handleCancelRequest(user, index),
        icon: const Icon(Icons.close_rounded, size: 14, color: Color(0xFFEF4444)),
        label: const Text(
          'Hủy lời mời',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFEF4444)),
        ),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFFCA5A5), width: 1),
          backgroundColor: const Color(0xFFFEF2F2),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      );
    } else {
      return ElevatedButton.icon(
        onPressed: () => _handleSendRequest(user, index),
        icon: const Icon(Icons.person_add_rounded, size: 15),
        label: const Text(
          'Kết bạn',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF0068FF),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Thêm bạn mới',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      body: Column(
        children: [
          // Search Header
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'Nhập tên, username, SĐT hoặc email...',
                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF0068FF), size: 22),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF94A3B8)),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                      )
                    : null,
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: Color(0xFF0068FF), width: 1.5),
                ),
              ),
            ),
          ),

          if (_isSearching)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(color: Color(0xFF0068FF)),
            )
          else if (_query.isNotEmpty && _searchResults.isEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.search_off_rounded, size: 56, color: Colors.grey[300]),
                    const SizedBox(height: 12),
                    Text(
                      'Không tìm thấy người dùng phù hợp với "$_query"',
                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: ListView.separated(
                itemCount: _searchResults.length,
                separatorBuilder: (context, index) => const Divider(
                  height: 1,
                  indent: 76,
                  color: Color(0xFFF1F5F9),
                ),
                itemBuilder: (context, index) {
                  final user = Map<String, dynamic>.from(_searchResults[index] as Map);
                  final name = user['fullName'] ?? user['username'] ?? 'Người dùng';
                  final username = user['username'] ?? '';
                  final subInfo = user['phone'] ?? user['email'] ?? '@$username';
                  final isOnline = user['isOnline'] == true;

                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        Stack(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: _getAvatarGradient(name),
                              ),
                              child: Center(
                                child: Text(
                                  _getInitials(name),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                            if (isOnline)
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    color: Colors.green,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 2),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  color: Color(0xFF0F172A),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                subInfo.toString().startsWith('@') ? subInfo.toString() : '@$username • ${subInfo.toString()}',
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        _buildActionButton(user, index),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
