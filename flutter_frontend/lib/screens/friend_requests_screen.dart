import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/chat_provider.dart';

class FriendRequestsScreen extends StatefulWidget {
  const FriendRequestsScreen({Key? key}) : super(key: key);

  @override
  State<FriendRequestsScreen> createState() => _FriendRequestsScreenState();
}

class _FriendRequestsScreenState extends State<FriendRequestsScreen> {
  List<dynamic> _requests = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() => _isLoading = true);
    final list = await ApiService.getPendingFriendRequests();
    if (mounted) {
      setState(() {
        _requests = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleAccept(String requestId, int index) async {
    final success = await ApiService.acceptFriendRequest(requestId);
    if (mounted) {
      if (success) {
        setState(() {
          _requests.removeAt(index);
        });
        try {
          Provider.of<ChatProvider>(context, listen: false).fetchConversations();
        } catch (_) {}
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã chấp nhận lời mời kết bạn!'),
            backgroundColor: Color(0xFF0068FF),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Thao tác thất bại, vui lòng thử lại sau.')),
        );
      }
    }
  }

  Future<void> _handleReject(String requestId, int index) async {
    final success = await ApiService.rejectFriendRequest(requestId);
    if (mounted) {
      if (success) {
        setState(() {
          _requests.removeAt(index);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã từ chối lời mời kết bạn.')),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Lời mời kết bạn',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
          : _requests.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.person_add_disabled_rounded, size: 64, color: Colors.grey[300]),
                      const SizedBox(height: 12),
                      const Text(
                        'Không có lời mời kết bạn nào',
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 15, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _requests.length,
                  separatorBuilder: (context, index) => const Divider(
                    height: 1,
                    indent: 76,
                    color: Color(0xFFF1F5F9),
                  ),
                  itemBuilder: (context, index) {
                    final req = _requests[index];
                    final requester = req['requester'] ?? {};
                    final name = requester['fullName'] ?? requester['username'] ?? 'Người dùng';
                    final username = requester['username'] ?? '';
                    final isOnline = requester['isOnline'] == true;
                    final reqId = req['id']?.toString() ?? '';

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
                                  '@$username',
                                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ElevatedButton(
                                onPressed: () => _handleAccept(reqId, index),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF0068FF),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                ),
                                child: const Text(
                                  'Chấp nhận',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 6),
                              OutlinedButton(
                                onPressed: () => _handleReject(reqId, index),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF64748B),
                                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                ),
                                child: const Text(
                                  'Từ chối',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
