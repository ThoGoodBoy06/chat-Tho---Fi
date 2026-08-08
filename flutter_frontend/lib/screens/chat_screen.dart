import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:universal_html/html.dart' as html;
import 'package:audioplayers/audioplayers.dart' as audioplayers;
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart' as emoji;
import '../models/models.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';
import '../services/socket_service.dart';
import '../services/api_service.dart';
import 'friend_requests_screen.dart';
import 'my_groups_screen.dart';
import 'add_friend_screen.dart';
import 'qr_scanner_screen.dart';
import 'other_user_profile_screen.dart';
import 'profile_tab.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ChatScreen({Key? key, required this.onLogout}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  int _currentTabIndex = 0; // 0: Tin nhắn, 1: Danh bạ, 2: Tin tức, 3: Trợ lý AI, 4: Cá nhân
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final _inputFocusNode = FocusNode();
  bool _isAttachmentMenuOpen = false;
  bool _isTyping = false;
  String _searchQuery = '';
  bool _isSearchOpen = false;
  bool _showEmojiPicker = false;
  int _selectedEmojiCategory = 0;
  final _searchController = TextEditingController();
  final _contactSearchController = TextEditingController();
  String _contactSearchQuery = '';
  StreamSubscription? _incomingCallSub;
  StreamSubscription? _visibilitySub;

  // AI Assistant Chat state
  final List<Map<String, String>> _aiMessages = [
    {'sender': 'ai', 'content': 'Xin chào! Tôi là Trợ lý AI Chat Tho-Fi. Tôi có thể giúp gì cho bạn hôm nay?'}
  ];
  final _aiTextController = TextEditingController();

  bool _showScrollToBottomButton = false;
  Timer? _debounceTimer;

  // Voice recording state
  bool _isRecording = false;
  int _recordingSeconds = 0;
  Timer? _recordingTimer;
  html.MediaRecorder? _mediaRecorder;
  html.MediaStream? _mediaStream;
  List<html.Blob> _audioChunks = [];

  int _pendingFriendRequestsCount = 0;
  Future<List<dynamic>>? _contactsFuture;
  Timer? _pendingRefreshTimer;

  String _removeAccents(String str) {
    var withDia = 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ';
    var withoutDia = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD';
    for (int i = 0; i < withDia.length; i++) {
      str = str.replaceAll(withDia[i], withoutDia[i]);
    }
    return str;
  }

  Future<void> _fetchPendingRequestsCount() async {
    try {
      final list = await ApiService.getPendingFriendRequests();
      if (mounted) {
        setState(() {
          _pendingFriendRequestsCount = list.length;
        });
      }
    } catch (e) {
      debugPrint('⚠️ Error fetching pending requests count: $e');
    }
  }

  @override
  void initState() {
    super.initState();
    _contactsFuture = ApiService.getFriends();
    WidgetsBinding.instance.addObserver(this);
    if (kIsWeb) {
      _visibilitySub = html.document.onVisibilityChange.listen((_) {
        if (html.document.hidden == true) {
          SocketService.emitGoOffline();
        } else {
          SocketService.emitGoOnline();
          _fetchPendingRequestsCount();
        }
      });
    }

    // Auto-refresh pending friend requests count badge in background every 8 seconds
    _pendingRefreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) {
        _fetchPendingRequestsCount();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<ChatProvider>(context, listen: false);
      provider.fetchConversations();
      provider.onNewMessageReceived = _scrollToBottom;
      provider.onConversationSelected = _jumpToBottom;
      _initCallListeners();
      _fetchPendingRequestsCount();
    });
    _textController.addListener(_onTextChanged);
    _scrollController.addListener(_onScroll);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.detached) {
      SocketService.emitGoOffline();
    } else if (state == AppLifecycleState.resumed) {
      SocketService.emitGoOnline();
      _fetchPendingRequestsCount();
    }
  }

  Future<void> _refreshFriendsListSilently() async {
    try {
      final friends = await ApiService.getFriends();
      if (mounted) {
        setState(() {
          _contactsFuture = Future.value(friends);
        });
      }
    } catch (_) {}
  }

  StreamSubscription? _friendRequestSub;
  StreamSubscription? _unfriendSub;

  void _initCallListeners() {
    _incomingCallSub?.cancel();
    _incomingCallSub = SocketService.onIncomingCall.listen((data) {
      if (mounted) {
        _handleIncomingCall(data);
      }
    });
    _friendRequestSub?.cancel();
    _friendRequestSub = SocketService.onFriendRequestReceived.listen((data) {
      debugPrint('⚡ [ChatScreen] Real-time friend request socket event: $data');
      if (mounted) {
        if (data is Map && data['count'] is int) {
          setState(() {
            _pendingFriendRequestsCount = data['count'] as int;
          });
        } else {
          _fetchPendingRequestsCount();
        }
        _refreshFriendsListSilently();
        try {
          final provider = Provider.of<ChatProvider>(context, listen: false);
          provider.fetchConversations(showLoading: false);
        } catch (_) {}
      }
    });
    _unfriendSub?.cancel();
    _unfriendSub = SocketService.onUserUnfriended.listen((_) {
      if (mounted) {
        _refreshFriendsListSilently();
        try {
          final provider = Provider.of<ChatProvider>(context, listen: false);
          provider.fetchConversations(showLoading: false);
        } catch (_) {}
      }
    });
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final maxScroll = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    final show = (maxScroll - currentScroll) > 150;
    if (show != _showScrollToBottomButton) {
      setState(() => _showScrollToBottomButton = show);
    }
  }

  void _onTextChanged() {
    final text = _textController.text;
    final typing = text.trim().isNotEmpty;
    if (typing != _isTyping) {
      setState(() => _isTyping = typing);
    }

    final provider = Provider.of<ChatProvider>(context, listen: false);

    if (typing) {
      provider.emitTyping();
      _debounceTimer?.cancel();
      _debounceTimer = Timer(const Duration(milliseconds: 1800), () {
        provider.emitStopTyping();
      });
    } else {
      _debounceTimer?.cancel();
      provider.emitStopTyping();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _visibilitySub?.cancel();
    _friendRequestSub?.cancel();
    _unfriendSub?.cancel();
    _debounceTimer?.cancel();
    _pendingRefreshTimer?.cancel();
    try {
      final provider = Provider.of<ChatProvider>(context, listen: false);
      provider.onNewMessageReceived = null;
      provider.onConversationSelected = null;
    } catch (_) {}
    _textController.removeListener(_onTextChanged);
    _scrollController.removeListener(_onScroll);
    _textController.dispose();
    _aiTextController.dispose();
    _searchController.dispose();
    _contactSearchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Map<String, int> _aggregateReactions(Map<String, String> reactions) {
    final counts = <String, int>{};
    for (final emoji in reactions.values) {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
    }
    return counts;
  }

  Widget _buildReactionBadges(Map<String, String> reactions, {double fontSize = 11, bool isOwnMessage = false, EdgeInsetsGeometry? margin}) {
    if (reactions.isEmpty) return const SizedBox.shrink();
    final aggregated = _aggregateReactions(reactions);
    final entries = aggregated.entries.toList();
    return Container(
      margin: margin ?? EdgeInsets.zero,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: entries.map((e) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(e.key, style: TextStyle(fontSize: fontSize + 2)),
                if (e.value > 1)
                  Padding(
                    padding: const EdgeInsets.only(left: 1),
                    child: Text(
                      '${e.value}',
                      style: TextStyle(
                        fontSize: fontSize - 2,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF65676B),
                      ),
                    ),
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  void _showFlyingEmoji(BuildContext context, Offset startPosition, String emoji) {
    try {
      final overlay = Overlay.of(context, rootOverlay: true);
      late OverlayEntry entry;
      entry = OverlayEntry(
        builder: (_) => _FlyingEmojiWidget(
          from: startPosition,
          emoji: emoji,
          onComplete: () {
            try {
              entry.remove();
            } catch (_) {}
          },
        ),
      );
      overlay.insert(entry);
    } catch (e) {
      debugPrint('⚠️ Error showing flying emoji: $e');
    }
  }

  int _lastMessageCount = 0;

  void _jumpToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollController.hasClients) {
            _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
          }
        });
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Kiểm tra tin nhắn chỉ chứa emoji (không có text thường)
  bool _isEmojiOnly(String text) {
    final emojiRegex = RegExp(
      r'(\u00a9|\u00ae|[\u2000-\u3300]|[\ud83c-\ud83e][\ud000-\udfff]|[\ud83d][\ud000-\udfff]|[\u2600-\u27ff]|\ufe0f|\u200d|\u20e3|[\u2190-\u21ff]|[\u2300-\u23ff]|[\u2460-\u24ff]|[\u25a0-\u25ff]|[\u2900-\u297f]|[\u2b05-\u2b07]|[\u2b1b-\u2b1c]|[\u2b50]|[\u3030]|[\u303d]|[\u3297]|[\u3299])+',
      unicode: true,
    );
    final stripped = text.replaceAll(emojiRegex, '').replaceAll(' ', '');
    return text.trim().isNotEmpty && stripped.isEmpty;
  }

  void _handleSend(ChatProvider provider) {
    final text = _textController.text.trim();
    final sendText = text.isEmpty ? '👍' : text;
    _textController.clear();
    _debounceTimer?.cancel();
    provider.emitStopTyping();
    provider.sendMessage(sendText);
    _scrollToBottom();
  }

  void _showMessengerStyleContextMenu(BuildContext context, MessageModel msg, ChatProvider provider, bool isMe) {
    final parentOverlay = Overlay.of(context, rootOverlay: true);

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 220),
      transitionBuilder: (dialogCtx, anim1, anim2, child) {
        final curved = CurvedAnimation(parent: anim1, curve: Curves.easeOutBack);
        return ScaleTransition(
          scale: curved,
          child: FadeTransition(
            opacity: anim1,
            child: child,
          ),
        );
      },
      pageBuilder: (dialogContext, anim1, anim2) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          body: Stack(
            children: [
              // Nền làm mờ toàn màn hình & Chạm để đóng
              GestureDetector(
                onTap: () => Navigator.pop(dialogContext),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                  child: Container(
                    color: Colors.black.withOpacity(0.22),
                  ),
                ),
              ),
              // Căn lề sát mép màn hình (Bên trái cho đối phương, Bên phải cho tin nhắn của mình)
              Align(
                alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 30),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        // 1. Thanh thả cảm xúc phía trên (Y chang hình: Emojis + Camera xanh + Nút cộng)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(30),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.16),
                                blurRadius: 24,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ...['❤️', '😆', '😮', '😢', '😡', '👍'].map((emoji) {
                                return _SpringEmojiPickerItem(
                                  emoji: emoji,
                                  onFlyingEmojiRequested: (position) {
                                    late OverlayEntry entry;
                                    entry = OverlayEntry(
                                      builder: (_) => _FlyingEmojiWidget(
                                        from: position,
                                        emoji: emoji,
                                        onComplete: () {
                                          try {
                                            entry.remove();
                                          } catch (_) {}
                                        },
                                      ),
                                    );
                                    parentOverlay.insert(entry);
                                  },
                                  onTap: () {
                                    Navigator.pop(dialogContext);
                                    provider.reactToMessage(msg.id, emoji);
                                  },
                                );
                              }),
                              const SizedBox(width: 4),
                              // Nút Camera xanh Messenger
                              Container(
                                width: 32,
                                height: 32,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF0068FF),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 17),
                              ),
                              const SizedBox(width: 6),
                              // Nút dấu cộng (+)
                              Container(
                                width: 32,
                                height: 32,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.add_rounded, color: Color(0xFF64748B), size: 20),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),

                        // 2. Bong bóng tin nhắn được chọn kèm Badge cảm xúc
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                              decoration: BoxDecoration(
                                color: isMe ? const Color(0xFF0068FF) : Colors.white,
                                borderRadius: BorderRadius.circular(18),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.14),
                                    blurRadius: 16,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Text(
                                msg.content,
                                style: TextStyle(
                                  color: isMe ? Colors.white : const Color(0xFF0F172A),
                                  fontSize: 15,
                                ),
                              ),
                            ),
                            if (msg.reactions.isNotEmpty)
                              Positioned(
                                bottom: -10,
                                right: isMe ? null : 8,
                                left: isMe ? 8 : null,
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 200),
                                  transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                                  child: KeyedSubtree(
                                    key: ValueKey('ctx_reactions_${msg.reactions.hashCode}'),
                                    child: _buildReactionBadges(
                                      msg.reactions,
                                      fontSize: 12,
                                      isOwnMessage: isMe,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // 3. Menu chức năng phía dưới (Trả lời, Sao chép, Xóa tin nhắn)
                        Container(
                          width: 220,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.16),
                                blurRadius: 24,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                title: const Text('Trả lời', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                                trailing: const Icon(Icons.reply_rounded, color: Color(0xFF0F172A), size: 20),
                                onTap: () {
                                  Navigator.pop(context);
                                  provider.setReplyingToMessage(msg);
                                },
                              ),
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                title: const Text('Sao chép', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                                trailing: const Icon(Icons.copy_rounded, color: Color(0xFF0F172A), size: 20),
                                onTap: () {
                                  Navigator.pop(context);
                                  html.window.navigator.clipboard?.writeText(msg.content);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Đã sao chép tin nhắn')),
                                  );
                                },
                              ),
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              if ((msg.senderId == provider.currentUser?.id || isMe) && !msg.isRecalled) ...[
                                ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                  title: const Text('Thu hồi tin nhắn', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
                                  trailing: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 20),
                                  onTap: () {
                                    Navigator.pop(dialogContext);
                                    _showRecallOptionsSheet(context, msg, provider);
                                  },
                                ),
                              ] else ...[
                                ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                  title: const Text('Gỡ ở phía tôi', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF64748B))),
                                  trailing: const Icon(Icons.delete_sweep_rounded, color: Color(0xFF64748B), size: 20),
                                  onTap: () {
                                    Navigator.pop(dialogContext);
                                    provider.deleteMessage(msg.id);
                                  },
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showRecallOptionsSheet(BuildContext context, MessageModel msg, ChatProvider provider) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      backgroundColor: Colors.white,
      builder: (modalCtx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'Thu hồi tin nhắn đối với ai?',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Chọn phương thức thu hồi cho tin nhắn này',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                tileColor: const Color(0xFFFEF2F2),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFEF4444),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.undo_rounded, color: Colors.white, size: 20),
                ),
                title: const Text(
                  'Thu hồi với mọi người',
                  style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 15),
                ),
                subtitle: const Text(
                  'Bỏ gửi tin nhắn này đối với tất cả mọi người trong chat',
                  style: TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
                ),
                onTap: () async {
                  Navigator.pop(modalCtx);
                  final success = await provider.recallMessage(msg.id);
                  if (!success && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Không thể thu hồi tin nhắn. Vui lòng thử lại.')),
                    );
                  }
                },
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                tileColor: const Color(0xFFF8FAFC),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFF94A3B8),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.delete_outline_rounded, color: Colors.white, size: 20),
                ),
                title: const Text(
                  'Gỡ ở phía bạn',
                  style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w600, fontSize: 15),
                ),
                subtitle: const Text(
                  'Tin nhắn này sẽ bị xóa khỏi thiết bị của bạn',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                onTap: () {
                  Navigator.pop(modalCtx);
                  provider.deleteMessage(msg.id);
                },
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(modalCtx),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    backgroundColor: const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text(
                    'Hủy',
                    style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleAiSend() {
    final text = _aiTextController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _aiMessages.add({'sender': 'user', 'content': text});
      _aiTextController.clear();
    });

    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) {
        setState(() {
          _aiMessages.add({'sender': 'ai', 'content': 'Cảm ơn bạn đã hỏi "$text". Tôi đang hỗ trợ xử lý yêu cầu của bạn một cách tốt nhất!'});
        });
      }
    });
  }

  String _formatTime(DateTime dt) {
    return DateFormat('HH:mm').format(dt);
  }

  String _formatLastActive(DateTime? lastActive, bool isOnline) {
    if (isOnline) return 'Đang hoạt động';
    if (lastActive == null) return 'Hoạt động gần đây';
    final now = DateTime.now();
    final diff = now.difference(lastActive);
    if (diff.inSeconds < 60) {
      return 'Hoạt động vừa xong';
    } else if (diff.inMinutes < 60) {
      return 'Hoạt động ${diff.inMinutes} phút trước';
    } else if (diff.inHours < 24) {
      return 'Hoạt động ${diff.inHours} giờ trước';
    } else if (diff.inDays < 7) {
      return 'Hoạt động ${diff.inDays} ngày trước';
    } else {
      return 'Hoạt động ${DateFormat('dd/MM').format(lastActive)}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 900;

    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF0F2F5);

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Container(
          color: bgColor,
          child: Row(
            children: [
              if (isDesktop) _buildDesktopNavRail(),
              Expanded(
                child: _buildBodyForCurrentTab(provider, isDesktop),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: (!isDesktop && !(_currentTabIndex == 0 && provider.selectedConversation != null))
          ? Container(
              color: bgColor,
              child: _buildMobileBottomBar(),
            )
          : null,
    );
  }

  Widget _buildBodyForCurrentTab(ChatProvider provider, bool isDesktop) {
    switch (_currentTabIndex) {
      case 0: // Tin nhắn (Messenger Style)
        if (isDesktop) {
          return Row(
            children: [
              SizedBox(
                width: MediaQuery.of(context).size.width * 0.35,
                child: _buildChatList(provider),
              ),
              const VerticalDivider(width: 1, color: Color(0xFFE4E6EB)),
              Expanded(
                child: provider.selectedConversation != null
                    ? _buildChatWindow(provider, isDesktop: true)
                    : _buildEmptyChatPlaceholder(),
              ),
            ],
          );
        } else {
          return provider.selectedConversation != null
              ? _buildChatWindow(provider, isDesktop: false)
              : _buildChatList(provider);
        }
      case 1: // Danh bạ
        return _buildContactsTab(provider);
      case 2: // Tin tức AI
        return _buildNewsTab();
      case 3: // Trợ lý AI
        return _buildAiAssistantTab();
      case 4: // Cá nhân
        return _buildProfileTab(provider);
      default:
        return _buildChatList(provider);
    }
  }

  Widget _buildDesktopNavRail() {
    final navItems = [
      {'icon': Icons.chat_bubble_rounded, 'label': 'Tin nhắn'},
      {'icon': Icons.people_alt_rounded, 'label': 'Danh bạ'},
      {'icon': Icons.newspaper_rounded, 'label': 'Tin tức'},
      {'icon': Icons.smart_toy_rounded, 'label': 'Trợ lý AI'},
      {'icon': Icons.account_circle_rounded, 'label': 'Cá nhân'},
    ];

    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final navBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final borderColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
    final unselectedIconColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return Container(
      width: 76,
      decoration: BoxDecoration(
        color: navBgColor,
        border: Border(right: BorderSide(color: borderColor, width: 1)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 20),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF0068FF), Color(0xFF0091FF)]),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(color: const Color(0xFF0068FF).withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: const Icon(Icons.forum_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(height: 28),
          Expanded(
            child: ListView.builder(
              itemCount: navItems.length,
              itemBuilder: (context, index) {
                final isSelected = _currentTabIndex == index;
                return Tooltip(
                  message: navItems[index]['label'] as String,
                  child: InkWell(
                    onTap: () => setState(() => _currentTabIndex = index),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF0068FF).withOpacity(0.15) : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        navItems[index]['icon'] as IconData,
                        color: isSelected ? const Color(0xFF0068FF) : unselectedIconColor,
                        size: 24,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            onPressed: widget.onLogout,
            tooltip: 'Đăng xuất',
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
  String _formatMessengerTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 1) return 'Vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút';
    if (diff.inHours < 24) return '${diff.inHours} giờ';
    if (diff.inDays == 1) return 'Hôm qua';
    if (diff.inDays < 7) return '${diff.inDays} ngày';
    return DateFormat('dd/MM').format(date);
  }

  String _formatLastMessageText(String? rawMsg) {
    if (rawMsg == null || rawMsg.trim().isEmpty) {
      return 'Bắt đầu cuộc trò chuyện';
    }
    final text = rawMsg.trim();
    final lower = text.toLowerCase();
    
    if (lower.startsWith('data:image') ||
        lower.contains('/uploads/') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.gif') ||
        lower == '[hình ảnh]' ||
        lower == 'image') {
      return 'Đã gửi một hình ảnh';
    }
    
    if (lower.startsWith('data:audio') ||
        lower.contains('.webm') ||
        lower.contains('.mp3') ||
        lower == '[tin nhắn thoại]' ||
        lower == 'audio') {
      return 'Đã gửi một tin nhắn thoại';
    }
    
    if (lower.startsWith('{"filename"') || lower.startsWith('{"url"')) {
      return 'Đã gửi một tệp đính kèm';
    }
    
    return text;
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

  Widget _buildChatList(ChatProvider provider) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : Colors.white;
    final headerBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF000000);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF8E8E93);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF2F2F7);
    final borderColor = isDark ? const Color(0xFF334155) : const Color(0x0F000000);

    final filteredList = provider.conversations.where((conv) {
      if (provider.showUnreadOnly && (conv.unreadCount ?? 0) == 0) return false;
      if (_searchQuery.isNotEmpty) {
        return conv.name.toLowerCase().contains(_searchQuery.toLowerCase());
      }
      return true;
    }).toList();

    final totalUnreadCount = provider.conversations.fold<int>(0, (sum, conv) => sum + (conv.unreadCount ?? 0));

    return Container(
      color: bgColor,
      child: Column(
        children: [
          // 1. Top Navigation Bar (Height 56px, iOS style)
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: headerBgColor,
              border: Border(bottom: BorderSide(color: borderColor, width: 1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Left: Bell Icon
                IconButton(
                  icon: Icon(Icons.notifications_none_rounded, color: textColor, size: 24),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Không có thông báo mới nào'), duration: Duration(seconds: 2)),
                    );
                  },
                  tooltip: 'Thông báo',
                ),
                // Center: Title "Chat Tho-Fi" (18px, Bold, #007AFF)
                Text(
                  'Chat Tho-Fi',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF007AFF),
                  ),
                ),
                // Right: QR Scanner + Add Friend Button
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // QR Scanner Button
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const QrScannerScreen()),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF334155) : const Color(0xFF475569).withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.qr_code_scanner_rounded,
                          color: isDark ? Colors.white : const Color(0xFF334155),
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Add Friend Button
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const AddFriendScreen()),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0068FF).withOpacity(0.12),
                          border: Border.all(color: const Color(0x1F0068FF), width: 1),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(
                              Icons.person_add_alt_1_rounded,
                              color: Color(0xFF0068FF),
                              size: 18,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Thêm bạn bè',
                              style: TextStyle(
                                color: Color(0xFF0068FF),
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Search Field (If search icon toggled)
          if (_isSearchOpen)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: headerBgColor,
                border: Border(bottom: BorderSide(color: borderColor, width: 1)),
              ),
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  color: cardBgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: TextStyle(fontSize: 14, color: textColor),
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm cuộc trò chuyện...',
                    hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                    prefixIcon: Icon(Icons.search_rounded, color: subTextColor, size: 18),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? GestureDetector(
                            onTap: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                            child: Icon(Icons.cancel_rounded, color: subTextColor, size: 16),
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ),

          // 2. Section Header (Placed directly above chat list)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'Tin nhắn',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (totalUnreadCount > 0)
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Text(
                          '$totalUnreadCount chưa đọc',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF007AFF),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    InkWell(
                      onTap: () => _showNewChatDialog(provider),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEBF3FF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Filter Badges (Tất cả / Chưa đọc)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            margin: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: () => provider.setShowUnreadOnly(false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: !provider.showUnreadOnly ? const Color(0xFF007AFF) : cardBgColor,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Tất cả',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: !provider.showUnreadOnly ? Colors.white : subTextColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => provider.setShowUnreadOnly(true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: provider.showUnreadOnly ? const Color(0xFF007AFF) : cardBgColor,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Chưa đọc',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: provider.showUnreadOnly ? Colors.white : subTextColor,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. Item Danh sách Chat (ListView.builder)
          Expanded(
            child: provider.isLoadingConversations
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF007AFF)))
                : filteredList.isEmpty
                    ? Center(
                        child: Text(
                          'Không có cuộc trò chuyện nào',
                          style: TextStyle(color: subTextColor, fontSize: 14),
                        ),
                      )
                    : ListView.builder(
                        itemCount: filteredList.length,
                        itemBuilder: (context, index) {
                          final conv = filteredList[index];
                          final isSelected = conv.id == provider.selectedConversationId;
                          final unreadCount = conv.unreadCount ?? 0;
                          final hasUnread = unreadCount > 0;

                          final itemBg = isSelected
                              ? (isDark ? const Color(0xFF1E293B) : const Color(0x0D007AFF))
                              : bgColor;

                          return InkWell(
                            onTap: () => provider.selectConversation(conv),
                            hoverColor: isDark ? const Color(0xFF1E293B) : const Color(0x05000000),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              decoration: BoxDecoration(
                                color: itemBg,
                                border: Border(
                                  bottom: BorderSide(color: borderColor, width: 1),
                                ),
                              ),
                              child: Row(
                                children: [
                                  // Avatar: 52px diameter (radius 26)
                                  Stack(
                                    children: [
                                      Container(
                                        width: 52,
                                        height: 52,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          gradient: (conv.avatar == null || conv.avatar!.isEmpty)
                                              ? _getAvatarGradient(conv.name)
                                              : null,
                                          image: (conv.avatar != null && conv.avatar!.isNotEmpty)
                                              ? DecorationImage(
                                                  image: NetworkImage(conv.avatar!),
                                                  fit: BoxFit.cover,
                                                )
                                              : null,
                                        ),
                                        child: (conv.avatar == null || conv.avatar!.isEmpty)
                                            ? Center(
                                                child: Text(
                                                  _getInitials(conv.name),
                                                  style: const TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              )
                                            : null,
                                      ),
                                      if (conv.isOnline == true)
                                        Positioned(
                                          right: 0,
                                          bottom: 0,
                                          child: Container(
                                            width: 13,
                                            height: 13,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF34C759),
                                              shape: BoxShape.circle,
                                              border: Border.all(color: bgColor, width: 2),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(width: 14),
                                  // Text & Information
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          conv.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: textColor,
                                            fontSize: 15,
                                            fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _formatLastMessageText(conv.lastMessage),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: hasUnread ? (isDark ? Colors.white : const Color(0xFF3C3C43)) : subTextColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // Time & Unread Badge (Shifted slightly left)
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      if (conv.lastMessageAt != null)
                                        Text(
                                          _formatMessengerTime(conv.lastMessageAt!),
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: hasUnread ? const Color(0xFF007AFF) : const Color(0xFF8E8E93),
                                            fontWeight: hasUnread ? FontWeight.w600 : FontWeight.w400,
                                          ),
                                        ),
                                      if (hasUnread) ...[
                                        const SizedBox(height: 4),
                                        Container(
                                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF007AFF),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Center(
                                            child: Text(
                                              unreadCount > 99 ? '99+' : '$unreadCount',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                height: 1.0,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(width: 4),
                                  // Nút 3 chấm gần mép phải
                                  SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: PopupMenuButton<String>(
                                      padding: EdgeInsets.zero,
                                      icon: const Icon(
                                        Icons.more_vert_rounded,
                                        size: 20,
                                        color: Color(0xFF8E8E93),
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      elevation: 3,
                                      onSelected: (value) {
                                        if (value == 'delete') {
                                          _confirmDeleteConversation(context, provider, conv);
                                        }
                                      },
                                      itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                                        PopupMenuItem<String>(
                                          value: 'delete',
                                          child: Row(
                                            children: const [
                                              Icon(Icons.delete_outline_rounded, color: Colors.red, size: 20),
                                              SizedBox(width: 8),
                                              Text(
                                                'Xóa cuộc trò chuyện',
                                                style: TextStyle(
                                                  color: Colors.red,
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w500,
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
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteConversation(BuildContext context, ChatProvider provider, ConversationModel conv) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xóa cuộc trò chuyện', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        content: Text('Bạn có chắc chắn muốn xóa cuộc trò chuyện với "${conv.name}"? Cuộc trò chuyện chỉ bị ẩn ở phía bạn, đối phương vẫn thấy bình thường.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await provider.deleteConversation(conv.id);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Đã xóa cuộc trò chuyện.' : 'Không thể xóa cuộc trò chuyện.'),
                    backgroundColor: success ? const Color(0xFF007AFF) : Colors.red,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                );
              }
            },
            child: const Text('Xóa', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyChatPlaceholder() {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    return Container(
      color: isDark ? const Color(0xFF0F172A) : Colors.white,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.chat_bubble_outline_rounded, size: 72, color: Color(0xFF0068FF)),
            const SizedBox(height: 16),
            Text(
              'Chọn một cuộc trò chuyện để bắt đầu nhắn tin',
              style: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF65676B), fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  /// Card thông báo cuộc gọi chuẩn Messenger / Zalo (Nằm cùng hàng với đoạn chat, có avatar đối phương nếu là cuộc gọi đến)
  Widget _buildCallNotificationCard(MessageModel msg, bool isMe, ChatProvider provider) {
    final content = msg.content;
    final lowerContent = content.toLowerCase();
    final isMissed = msg.type == 'missed_call' || lowerContent.contains('nhỡ') || lowerContent.contains('bỏ lỡ') || lowerContent.contains('không trả lời');
    final isVideo = lowerContent.contains('video');

    return Container(
      constraints: const BoxConstraints(maxWidth: 255),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: isMissed ? const Color(0xFFFFF1F2) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isMissed ? const Color(0xFFFECDD3) : const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon đại diện loại cuộc gọi
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: isMissed ? const Color(0xFFEF4444) : const Color(0xFF0068FF),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isMissed
                  ? (isVideo ? Icons.videocam_off_rounded : Icons.phone_missed_rounded)
                  : (isVideo ? Icons.videocam_rounded : Icons.phone_in_talk_rounded),
              color: Colors.white,
              size: 13,
            ),
          ),
          const SizedBox(width: 8),
          // Tên thông báo & thời gian
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  content.isNotEmpty ? content : (isMissed ? 'Cuộc gọi nhỡ' : 'Cuộc gọi thoại'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isMissed ? const Color(0xFF991B1B) : const Color(0xFF0F172A),
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                Text(
                  _formatTime(msg.createdAt),
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 9.5,
                  ),
                ),
              ],
            ),
          ),
          if (isMissed) ...[
            const SizedBox(width: 8),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  if (isVideo) {
                    _startVideoCall(provider);
                  } else {
                    _startVoiceCall(provider);
                  }
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.call, color: Colors.white, size: 10),
                      SizedBox(width: 3),
                      Text(
                        'Gọi lại',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSystemMessage(MessageModel msg, ConversationModel? conv, UserModel? currentUser) {
    String displayText = msg.content;
    final metadata = msg.systemMetadata;

    if (metadata != null) {
      final action = metadata['action']?.toString();
      final actorId = metadata['actorId']?.toString();
      final targetId = metadata['targetId']?.toString();
      final nickname = metadata['nickname']?.toString();

      if (action == 'change_nickname') {
        UserModel? actorUser;
        UserModel? targetUser;

        if (conv != null && conv.members.isNotEmpty) {
          for (final m in conv.members) {
            if (m.id == actorId) actorUser = m;
            if (m.id == targetId) targetUser = m;
          }
        }

        final actorName = (actorId != null && actorId == currentUser?.id)
            ? 'Bạn'
            : (actorUser?.displayName ?? 'Người dùng');
        final targetName = (targetId != null && targetId == currentUser?.id)
            ? 'bạn'
            : (targetUser?.displayName ?? 'Người dùng');

        final cleanNick = (nickname != null && nickname.trim().isNotEmpty) ? nickname.trim() : null;

        if (cleanNick != null) {
          if (actorId == targetId) {
            displayText = (actorId == currentUser?.id)
                ? 'Bạn đã tự đặt biệt danh của mình là "$cleanNick".'
                : '$actorName đã tự đặt biệt danh của mình là "$cleanNick".';
          } else {
            displayText = '$actorName đã đặt biệt danh cho $targetName là "$cleanNick".';
          }
        } else {
          if (actorId == targetId) {
            displayText = (actorId == currentUser?.id)
                ? 'Bạn đã xóa biệt danh của mình.'
                : '$actorName đã xóa biệt danh của mình.';
          } else {
            displayText = '$actorName đã xóa biệt danh của $targetName.';
          }
        }
      }
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 24),
      child: Center(
        child: Text(
          displayText,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF8A8D91),
            fontSize: 12,
            fontWeight: FontWeight.w500,
            fontStyle: FontStyle.italic,
          ),
        ),
      ),
    );
  }

  Widget _buildMessageStatusIndicator(MessageModel msg, ConversationModel? conv, bool isLastSentMessage) {
    if (!isLastSentMessage) return const SizedBox.shrink();

    // 1. Trạng thái Chưa Đọc: Giữ MẶC ĐỊNH (Icon tĩnh không tạo hiệu ứng rơi)
    if (!msg.isRead) {
      if (msg.isDelivered) {
        // Trạng thái Đã nhận: Hiển thị icon hình tròn màu Xanh (#0068FF), có dấu tích trắng.
        return Container(
          margin: const EdgeInsets.only(top: 3, right: 2),
          width: 14,
          height: 14,
          decoration: const BoxDecoration(
            color: Color(0xFF0068FF),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Icon(Icons.check, size: 9, color: Colors.white),
          ),
        );
      } else {
        // Trạng thái Đã gửi: Hiển thị icon hình tròn rỗng viền xám, có dấu tích bên trong.
        return Container(
          margin: const EdgeInsets.only(top: 3, right: 2),
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFF94A3B8), width: 1.2),
          ),
          child: const Center(
            child: Icon(Icons.check, size: 8, color: Color(0xFF94A3B8)),
          ),
        );
      }
    }

    // 2. Trạng thái ĐÃ XEM: Hiển thị Avatar rơi từ GIỮA MÀN HÌNH xuống có VẬT LÝ BOUNCE
    String? partnerAvatar = conv?.avatar;
    String? partnerUserId = conv?.targetUserId;
    if (conv != null && conv.members.isNotEmpty) {
      final partner = conv.members.firstWhere(
        (m) => m.id != msg.senderId,
        orElse: () => conv.members.first,
      );
      partnerUserId ??= partner.id;
      if (partnerAvatar == null || partnerAvatar.isEmpty) {
        partnerAvatar = partner.avatar;
      }
    }
    if ((partnerAvatar == null || partnerAvatar.isEmpty) && partnerUserId != null && partnerUserId.isNotEmpty) {
      partnerAvatar = '/api/users/$partnerUserId/avatar';
    }

    Widget avatarWidget;
    if (partnerAvatar != null && partnerAvatar.isNotEmpty) {
      final fullUrl = partnerAvatar.startsWith('http')
          ? partnerAvatar
          : '${ApiService.baseUrl.replaceAll('/api', '')}$partnerAvatar';
      avatarWidget = Container(
        margin: const EdgeInsets.only(top: 3, right: 2),
        width: 16,
        height: 16,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.15),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: CircleAvatar(
          radius: 8,
          backgroundImage: NetworkImage(fullUrl),
          backgroundColor: const Color(0xFFE4E6EB),
        ),
      );
    } else {
      final initial = (conv?.name != null && conv!.name.isNotEmpty) ? conv.name[0].toUpperCase() : 'U';
      avatarWidget = Container(
        margin: const EdgeInsets.only(top: 3, right: 2),
        width: 16,
        height: 16,
        child: CircleAvatar(
          radius: 8,
          backgroundColor: const Color(0xFF0068FF),
          child: Text(
            initial,
            style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
      );
    }

    return Builder(
      builder: (context) {
        final screenSize = MediaQuery.of(context).size;
        // Tính toán tọa độ trung tâm màn hình (Cả chiều X lẫn chiều Y):
        // Indicator ở góc phải dưới tin nhắn. Cần lùi X về giữa (-35% chiều rộng) và đưa Y lên giữa (-42% chiều cao).
        final double startYOffset = -(screenSize.height * 0.42) / 16.0;
        final double startXOffset = -(screenSize.width * 0.35) / 16.0;

        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 950),
          reverseDuration: const Duration(milliseconds: 200),
          switchInCurve: Curves.bounceOut,
          switchOutCurve: Curves.easeIn,
          transitionBuilder: (child, animation) {
            final slideAnimation = Tween<Offset>(
              begin: Offset(startXOffset, startYOffset),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.bounceOut,
            ));

            return SlideTransition(
              position: slideAnimation,
              child: ScaleTransition(
                scale: animation,
                child: FadeTransition(
                  opacity: animation,
                  child: child,
                ),
              ),
            );
          },
          child: KeyedSubtree(
            key: ValueKey('read_avatar_${msg.id}'),
            child: avatarWidget,
          ),
        );
      },
    );
  }

  Widget _buildChatWindow(ChatProvider provider, {required bool isDesktop}) {
    final conv = provider.selectedConversation;
    if (conv == null) return _buildEmptyChatPlaceholder();

    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : Colors.white;
    final headerBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF050505);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF65676B);

    const primaryColor = Color(0xFF0068FF);

    return Container(
      color: bgColor,
      child: Column(
        children: [
          // A. Header Chat (56px, white/slate, shadow) - Filled Call & Video icons matching Messenger
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: headerBgColor,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(isDark ? 0.3 : 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                if (!isDesktop)
                  IconButton(
                    icon: const Icon(Icons.chevron_left_rounded, color: primaryColor, size: 30),
                    onPressed: () => provider.clearSelectedConversation(),
                  ),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      if (!conv.isGroup) {
                        UserModel? partner;
                        if (conv.members.isNotEmpty) {
                          final uid = provider.currentUser?.id;
                          partner = conv.members.firstWhere(
                            (m) => m.id != uid,
                            orElse: () => conv.members.first,
                          );
                        }
                        final targetId = (conv.targetUserId != null && conv.targetUserId!.isNotEmpty)
                            ? conv.targetUserId!
                            : (partner?.id ?? conv.id);
                        if (targetId.isNotEmpty) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => OtherUserProfileScreen(
                              userId: targetId,
                              initialUserData: partner != null ? partner.toJson() : null,
                            )),
                          );
                        }
                      }
                    },
                    child: Row(
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: primaryColor,
                              backgroundImage: (conv.avatar != null && conv.avatar!.isNotEmpty)
                                  ? NetworkImage(conv.avatar!)
                                  : null,
                              child: (conv.avatar == null || conv.avatar!.isEmpty)
                                  ? Text(
                                      conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                                    )
                                  : null,
                            ),
                            if (conv.isOnline == true)
                              Positioned(
                                right: -1,
                                bottom: -1,
                                child: Container(
                                  width: 14,
                                  height: 14,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF31A24C),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: headerBgColor, width: 2.5),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                conv.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: textColor,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 1),
                              Builder(
                                builder: (_) {
                                  UserModel? partner;
                                  if (conv.members.isNotEmpty) {
                                    final uid = provider.currentUser?.id;
                                    partner = conv.members.firstWhere(
                                      (m) => m.id != uid,
                                      orElse: () => conv.members.first,
                                    );
                                  }
                                  return Text(
                                    _formatLastActive(partner?.lastActive, conv.isOnline),
                                    style: const TextStyle(
                                      color: Color(0xFF65676B),
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.normal,
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.phone_rounded, color: primaryColor, size: 24),
                  onPressed: () => _startVoiceCall(provider),
                  tooltip: 'Gọi thoại',
                ),
                IconButton(
                  icon: const Icon(Icons.videocam_rounded, color: primaryColor, size: 26),
                  onPressed: () => _startVideoCall(provider),
                  tooltip: 'Gọi Video',
                ),
                IconButton(
                  icon: const Icon(Icons.info_outline, color: primaryColor, size: 24),
                  onPressed: () => _showChatInfo(provider),
                  tooltip: 'Thông tin cuộc trò chuyện',
                ),
              ],
            ),
          ),

          // C. Messages List #messages
          Expanded(
            child: provider.isLoadingMessages
                ? const Center(child: CircularProgressIndicator(color: primaryColor))
                : Builder(
                    builder: (context) {
                      final lastSentMessageIndex = provider.messages.lastIndexWhere((m) => m.senderId == provider.currentUser?.id);

                      return ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        itemCount: provider.messages.length,
                        itemBuilder: (context, index) {
                          final msg = provider.messages[index];
                          final isMe = msg.senderId == provider.currentUser?.id;
                          final isLastSentMessage = (index == lastSentMessageIndex);
                          final showTime = index == 0 || (index > 0 && msg.createdAt.difference(provider.messages[index - 1].createdAt).inMinutes > 30);

                      if (msg.type == 'system') {
                        return _buildSystemMessage(msg, conv, provider.currentUser);
                      }

                      final lowerContent = msg.content.toLowerCase();
                      final isCallMsg = !msg.isRecalled && (
                          msg.type == 'call' || msg.type == 'missed_call' || msg.type == 'video_call' ||
                          lowerContent.contains('cuộc gọi') || lowerContent.contains('cuoc goi')
                      );

                      if (isCallMsg) {
                        return Column(
                          children: [
                            if (showTime)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                child: Center(
                                  child: Text(
                                    _formatTime(msg.createdAt),
                                    style: const TextStyle(color: Color(0xFF8A8D91), fontSize: 12, fontWeight: FontWeight.w500),
                                  ),
                                ),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Row(
                                mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  if (!isMe) ...[
                                    CircleAvatar(
                                      radius: 14,
                                      backgroundColor: primaryColor,
                                      backgroundImage: (conv.avatar != null && conv.avatar!.isNotEmpty)
                                          ? NetworkImage(conv.avatar!)
                                          : null,
                                      child: (conv.avatar == null || conv.avatar!.isEmpty)
                                          ? Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10, color: Colors.white))
                                          : null,
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                  Flexible(
                                    child: _buildCallNotificationCard(msg, isMe, provider),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        );
                      }

                      return Column(
                        children: [
                          if (showTime)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Center(
                                child: Text(
                                  _formatTime(msg.createdAt),
                                  style: const TextStyle(color: Color(0xFF8A8D91), fontSize: 12, fontWeight: FontWeight.w500),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _SwipeToReplyWrapper(
                              onReply: () => provider.setReplyingToMessage(msg),
                              child: Row(
                                mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  if (!isMe) ...[
                                    GestureDetector(
                                      onTap: () {
                                        final senderId = msg.senderId;
                                        if (senderId != null && senderId.isNotEmpty) {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(builder: (_) => OtherUserProfileScreen(userId: senderId)),
                                          );
                                        }
                                      },
                                      child: CircleAvatar(
                                        radius: 14,
                                        backgroundColor: primaryColor,
                                        backgroundImage: (conv.avatar != null && conv.avatar!.isNotEmpty)
                                            ? NetworkImage(conv.avatar!)
                                            : null,
                                        child: (conv.avatar == null || conv.avatar!.isEmpty)
                                            ? Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10, color: Colors.white))
                                            : null,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                  Flexible(
                                    child: GestureDetector(
                                      onLongPress: () => _showMessengerStyleContextMenu(context, msg, provider, isMe),
                                      onSecondaryTapDown: (details) => _showMessengerStyleContextMenu(context, msg, provider, isMe),
                                      onDoubleTapDown: (details) {
                                        _showFlyingEmoji(context, details.globalPosition, '❤️');
                                      },
                                      onDoubleTap: () => provider.reactToMessage(msg.id, '❤️'),
                                      child: Column(
                                        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                        children: [
                                          Stack(
                                            clipBehavior: Clip.none,
                                            children: [
                                              Builder(
                                                builder: (context) {
                                                  final isEmojiMsg = !msg.isRecalled && msg.type == null || msg.type == 'text' ? _isEmojiOnly(msg.content) : false;
                                                  final isSpecialType = msg.type == 'image' || msg.type == 'audio' || msg.type == 'file' || msg.type == 'missed_call' || msg.type == 'call'
                                                      || msg.content.startsWith('data:image') || msg.content.startsWith('data:audio')
                                                      || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty);
                                                  final isPureImage = (msg.type == 'image' || msg.content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty));

                                                  // Emoji-only: hiển thị to, không nền (giống Messenger)
                                                  if (isEmojiMsg && !msg.isRecalled) {
                                                    return Container(
                                                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                                                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                      child: Text(
                                                        msg.content,
                                                        style: const TextStyle(fontSize: 48),
                                                      ),
                                                    );
                                                  }

                                                  return Container(
                                                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                                                    padding: isPureImage
                                                        ? EdgeInsets.zero
                                                        : (isSpecialType
                                                            ? const EdgeInsets.all(4)
                                                            : const EdgeInsets.symmetric(horizontal: 15, vertical: 10)),
                                                    decoration: BoxDecoration(
                                                      color: msg.isRecalled
                                                          ? Colors.transparent
                                                          : (isPureImage
                                                              ? Colors.transparent
                                                              : (isMe ? null : (isDark ? const Color(0xFF1E293B) : const Color(0xFFE4E6EB)))),
                                                      gradient: (isMe && !msg.isRecalled && !isPureImage)
                                                          ? const LinearGradient(colors: [Color(0xFF0084FF), Color(0xFF0068FF)])
                                                          : null,
                                                      border: msg.isRecalled
                                                          ? Border.all(color: const Color(0xFFCBD5E1), width: 1)
                                                          : null,
                                                      borderRadius: BorderRadius.circular(18),
                                                    ),
                                                    child: msg.isRecalled
                                                        ? const Text(
                                                            'Tin nhắn đã bị thu hồi',
                                                            style: TextStyle(
                                                              color: Color(0xFF8A8D91),
                                                              fontSize: 14,
                                                              fontStyle: FontStyle.italic,
                                                            ),
                                                          )
                                                        : Column(
                                                            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                                            mainAxisSize: MainAxisSize.min,
                                                            children: [
                                                              if (msg.replyMessageId != null && msg.replyMessageId!.isNotEmpty) ...[
                                                                Builder(
                                                                  builder: (context) {
                                                                    MessageModel? originMsg;
                                                                    for (final m in provider.messages) {
                                                                      if (m.id == msg.replyMessageId) {
                                                                        originMsg = m;
                                                                        break;
                                                                      }
                                                                    }
                                                                    final originContent = originMsg?.content ?? 'Tin nhắn';
                                                                    final originSender = (originMsg != null && originMsg.senderId == provider.currentUser?.id)
                                                                        ? 'Bạn'
                                                                        : (conv.name.isNotEmpty ? conv.name : 'Người dùng');
                                                                    return Container(
                                                                      margin: const EdgeInsets.only(bottom: 6),
                                                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                                      decoration: BoxDecoration(
                                                                        color: isMe ? Colors.white.withOpacity(0.2) : Colors.black.withOpacity(0.06),
                                                                        borderRadius: BorderRadius.circular(10),
                                                                        border: Border(
                                                                          left: BorderSide(
                                                                            color: isMe ? Colors.white : const Color(0xFF0068FF),
                                                                            width: 3,
                                                                          ),
                                                                        ),
                                                                      ),
                                                                      child: Column(
                                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                                        mainAxisSize: MainAxisSize.min,
                                                                        children: [
                                                                          Text(
                                                                            originSender,
                                                                            style: TextStyle(
                                                                              color: isMe ? Colors.white : const Color(0xFF0068FF),
                                                                              fontWeight: FontWeight.bold,
                                                                              fontSize: 11,
                                                                            ),
                                                                          ),
                                                                          const SizedBox(height: 2),
                                                                          Text(
                                                                            originContent,
                                                                            maxLines: 2,
                                                                            overflow: TextOverflow.ellipsis,
                                                                            style: TextStyle(
                                                                              color: isMe ? Colors.white.withOpacity(0.9) : const Color(0xFF65676B),
                                                                              fontSize: 12,
                                                                            ),
                                                                          ),
                                                                        ],
                                                                      ),
                                                                    );
                                                                  },
                                                                ),
                                                              ],
                                                              _buildMessageBubbleContent(msg, isMe),
                                                            ],
                                                          ),
                                                  );
                                                },
                                              ),
                                              if (msg.reactions.isNotEmpty && !msg.isRecalled)
                                                Positioned(
                                                  right: -4,
                                                  bottom: -8,
                                                  child: AnimatedSwitcher(
                                                    duration: const Duration(milliseconds: 200),
                                                    transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                                                    child: KeyedSubtree(
                                                      key: ValueKey('chat_reactions_${msg.reactions.hashCode}'),
                                                      child: _buildReactionBadges(
                                                        msg.reactions,
                                                        fontSize: 10,
                                                        isOwnMessage: isMe,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          if (isMe) ...[
                                            const SizedBox(height: 4),
                                            _buildMessageStatusIndicator(msg, conv, isLastSentMessage),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                      );
                    },
                  ),
          ),

          // Typing Indicator Widget (Chuẩn Messenger: Bỏ icon phía trước, có chữ [Tên] đang gõ + 3 chấm chuyển động)
          Consumer<ChatProvider>(
            builder: (context, chatProv, child) {
              final typingUser = chatProv.getTypingUserForSelectedConversation();
              if (typingUser == null || typingUser.isEmpty) {
                return const SizedBox.shrink();
              }
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE4E6EB),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$typingUser đang gõ ',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF65676B),
                              fontWeight: FontWeight.w500,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const BouncingDotsIndicator(),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),

          // Reply Quote Preview Bar
          Consumer<ChatProvider>(
            builder: (context, chatProv, child) {
              final replyMsg = chatProv.replyingToMessage;
              if (replyMsg == null) return const SizedBox.shrink();

              String senderName = 'Người dùng';
              if (replyMsg.senderId == chatProv.currentUser?.id) {
                senderName = chatProv.currentUser?.fullName ?? 'chính mình';
              } else if (chatProv.selectedConversation != null) {
                senderName = chatProv.selectedConversation!.name;
              }

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: headerBgColor,
                  border: Border(top: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE4E6EB))),
                ),
                child: Row(
                  children: [
                    Container(width: 4, height: 36, color: primaryColor),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đang trả lời $senderName:',
                            style: const TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            replyMsg.content,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: subTextColor, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close_rounded, size: 18, color: subTextColor),
                      onPressed: () => chatProv.setReplyingToMessage(null),
                    ),
                  ],
                ),
              );
            },
          ),

          // D. Input Area: Filled icons matching user reference images (+, camera, gallery, mic, pill Aa + emoji, send/like)
          SafeArea(
            top: false,
            bottom: true,
            child: Container(
              padding: const EdgeInsets.only(left: 8, right: 8, top: 8, bottom: 12),
              decoration: BoxDecoration(
                color: headerBgColor,
                border: Border(top: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE4E6EB))),
              ),
              child: _isRecording
                  ? Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.delete_outline_rounded, color: Colors.red, size: 26),
                          onPressed: _cancelRecording,
                          tooltip: 'Hủy ghi âm',
                        ),
                        Expanded(
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF451A03) : const Color(0xFFFFF0F5),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                const BlinkingRedDot(),
                                const SizedBox(width: 8),
                                Text(
                                  _formatRecordingTime(_recordingSeconds),
                                  style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                const Spacer(),
                                Text('Đang ghi âm...', style: TextStyle(color: subTextColor, fontSize: 12)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        IconButton(
                          icon: const Icon(Icons.send_rounded, color: primaryColor, size: 26),
                          onPressed: () => _stopAndSendRecording(provider),
                          tooltip: 'Gửi tin nhắn thoại',
                        ),
                      ],
                    )
                  : Row(
                      children: [
                        TextFieldTapRegion(
                          child: Focus(
                            canRequestFocus: false,
                            descendantsAreFocusable: false,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: AnimatedRotation(
                                    turns: _isAttachmentMenuOpen ? 0.125 : 0.0,
                                    duration: const Duration(milliseconds: 300),
                                    curve: Curves.easeOutBack,
                                    child: const Icon(Icons.add_circle_rounded, color: primaryColor, size: 28),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isAttachmentMenuOpen = !_isAttachmentMenuOpen;
                                    });
                                  },
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 36),
                                  tooltip: _isAttachmentMenuOpen ? 'Đóng menu' : 'Mở menu tiện ích',
                                ),
                                AnimatedSize(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutBack,
                                  child: _isAttachmentMenuOpen
                                      ? Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                              icon: const Icon(Icons.camera_alt_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _captureCameraImage(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Chụp ảnh',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.image_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _pickAndUploadImage(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Gửi ảnh',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.mic_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _handleVoiceRecording(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Ghi âm',
                                            ),
                                          ],
                                        )
                                      : const SizedBox(width: 0, height: 0),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Expanded(
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.only(left: 14, right: 6),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF0F2F5),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _textController,
                                    focusNode: _inputFocusNode,
                                    onTapOutside: (event) {
                                      FocusScope.of(context).unfocus();
                                    },
                                    style: TextStyle(color: textColor, fontSize: 15),
                                    decoration: InputDecoration(
                                      hintText: 'Aa',
                                      hintStyle: TextStyle(color: subTextColor, fontSize: 15),
                                      border: InputBorder.none,
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                                    ),
                                    onSubmitted: (_) => _handleSend(provider),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.sentiment_satisfied_alt_rounded, color: primaryColor, size: 22),
                                  onPressed: () => _toggleEmojiPicker(),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 30),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: Icon(
                            _isTyping ? Icons.send_rounded : Icons.thumb_up_rounded,
                            color: primaryColor,
                            size: 26,
                          ),
                          onPressed: () => _handleSend(provider),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36),
                        ),
                      ],
                    ),
            ),
          ),
          if (_showEmojiPicker) ...[
            _buildEmojiPicker(),
          ],
        ],
      ),
    );
  }

  void _toggleEmojiPicker() {
    setState(() {
      _showEmojiPicker = !_showEmojiPicker;
    });
  }

  void _onEmojiSelected(String emoji) {
    final text = _textController.text;
    final selection = _textController.selection;
    if (selection.isValid && selection.start >= 0 && selection.end >= 0) {
      final newText = text.replaceRange(selection.start, selection.end, emoji);
      _textController.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: selection.start + emoji.length),
      );
    } else {
      _textController.text = text + emoji;
      _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
    }
    _onTextChanged();
  }

  Widget _buildEmojiPicker() {
    return SizedBox(
      height: 320,
      child: emoji.EmojiPicker(
        onEmojiSelected: (category, emojiItem) {
          _onEmojiSelected(emojiItem.emoji);
        },
        config: emoji.Config(
          height: 320,
          emojiViewConfig: emoji.EmojiViewConfig(
            columns: 8,
            emojiSizeMax: 28,
            verticalSpacing: 0,
            horizontalSpacing: 0,
            gridPadding: EdgeInsets.zero,
            recentsLimit: 28,
            noRecents: const Text(
              'Chưa có emoji gần đây',
              style: TextStyle(fontSize: 14, color: Color(0xFF8E8E93)),
              textAlign: TextAlign.center,
            ),
            buttonMode: emoji.ButtonMode.MATERIAL,
            loadingIndicator: const SizedBox.shrink(),
          ),
          categoryViewConfig: emoji.CategoryViewConfig(
            initCategory: emoji.Category.SMILEYS,
            indicatorColor: const Color(0xFF007AFF),
            iconColorSelected: const Color(0xFF007AFF),
            iconColor: const Color(0xFF65676B),
            backspaceColor: const Color(0xFF007AFF),
            categoryIcons: const emoji.CategoryIcons(),
            tabBarHeight: 46,
          ),
          bottomActionBarConfig: const emoji.BottomActionBarConfig(
            showBackspaceButton: true,
            showSearchViewButton: true,
            backgroundColor: Colors.white,
          ),
          searchViewConfig: const emoji.SearchViewConfig(
            hintText: 'Tìm kiếm emoji...',
            backgroundColor: Colors.white,
          ),
          skinToneConfig: const emoji.SkinToneConfig(
            enabled: true,
            indicatorColor: Color(0xFF007AFF),
          ),
        ),
      ),
    );
  }

  void _showNewChatDialog(ChatProvider provider) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tạo cuộc trò chuyện mới',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Color(0xFF8E8E93)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          content: SizedBox(
            width: 360,
            height: 380,
            child: FutureBuilder<List<dynamic>>(
              future: ApiService.getUsers(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFF007AFF)));
                }
                final users = snapshot.data ?? [];
                final filteredUsers = users.where((u) => u['id']?.toString() != provider.currentUser?.id).toList();

                if (filteredUsers.isEmpty) {
                  return const Center(
                    child: Text('Chưa có người dùng nào khác trong hệ thống', style: TextStyle(color: Color(0xFF8E8E93))),
                  );
                }

                return ListView.builder(
                  itemCount: filteredUsers.length,
                  itemBuilder: (context, index) {
                    final u = filteredUsers[index];
                    final name = u['fullName'] ?? u['username'] ?? 'Người dùng';
                    final uid = u['id']?.toString() ?? '';

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: _getAvatarGradient(name),
                        ),
                        child: Center(
                          child: Text(
                            _getInitials(name),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                      ),
                      title: Text(
                        name,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: Colors.black),
                      ),
                      subtitle: Text('@${u['username'] ?? ''}', style: const TextStyle(color: Color(0xFF8E8E93), fontSize: 13)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF007AFF),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Text('Nhắn tin', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                      onTap: () async {
                        Navigator.pop(context);
                        await provider.startPrivateChat(uid);
                      },
                    );
                  },
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _showUnfriendDialog(Map<String, dynamic> user, VoidCallback onDeleted) async {
    final name = user['fullName'] ?? user['name'] ?? user['username'] ?? 'Người dùng';
    final uid = user['id']?.toString() ?? '';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Xóa bạn bè',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
        ),
        content: Text(
          'Bạn có chắc chắn muốn xóa $name khỏi danh sách bạn bè không?',
          style: const TextStyle(fontSize: 14, color: Color(0xFF334155)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Hủy',
              style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text(
              'Xóa',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirm == true && uid.isNotEmpty) {
      final success = await ApiService.deleteFriend(uid);
      if (mounted) {
        if (success) {
          SocketService.emitUnfriendUser(uid);
          setState(() {
            _contactsFuture = ApiService.getFriends();
          });
          onDeleted();
          try {
            final provider = Provider.of<ChatProvider>(context, listen: false);
            provider.fetchConversations();
          } catch (_) {}
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Đã xóa $name khỏi danh bạ'),
              backgroundColor: Colors.red,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không thể xóa bạn bè, vui lòng thử lại sau.')),
          );
        }
      }
    }
  }

  // TAB 1: Danh bạ
  // TAB 1: Danh bạ
  Widget _buildContactsTab(ChatProvider provider) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : Colors.white;
    final cardBgColor = isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC);
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final dividerColor = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);

    return Container(
      color: bgColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.people_alt_rounded, color: Color(0xFF0068FF), size: 26),
                const SizedBox(width: 8),
                Text(
                  'Danh Bạ',
                  style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // Phần 1: Thanh Tìm kiếm (Search Bar)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _contactSearchController,
              onChanged: (val) {
                setState(() {
                  _contactSearchQuery = val.trim();
                });
              },
              style: TextStyle(color: textColor),
              decoration: InputDecoration(
                hintText: 'Tìm kiếm bạn bè...',
                hintStyle: TextStyle(color: subTextColor, fontSize: 14),
                prefixIcon: Icon(Icons.search_rounded, color: subTextColor, size: 20),
                suffixIcon: _contactSearchQuery.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.clear_rounded, size: 18, color: subTextColor),
                        onPressed: () {
                          _contactSearchController.clear();
                          setState(() {
                            _contactSearchQuery = '';
                          });
                        },
                      )
                    : null,
                filled: true,
                fillColor: cardBgColor,
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF0068FF), width: 1.5),
                ),
              ),
            ),
          ),

          const SizedBox(height: 4),

          // Phần 2: Menu tiện ích (Lời mời kết bạn & Nhóm của tôi)
          ListTile(
            leading: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFF0068FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.person_add_rounded, color: Colors.white, size: 22),
            ),
            title: Text(
              'Lời mời kết bạn',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textColor),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_pendingFriendRequestsCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$_pendingFriendRequestsCount Mới',
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                if (_pendingFriendRequestsCount > 0) const SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, color: subTextColor),
              ],
            ),
            onTap: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const FriendRequestsScreen()),
              );
              _fetchPendingRequestsCount();
            },
          ),
          ListTile(
            leading: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: const Color(0xFF0068FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.groups_rounded, color: Colors.white, size: 22),
            ),
            title: Text(
              'Nhóm của tôi',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textColor),
            ),
            trailing: Icon(Icons.chevron_right_rounded, color: subTextColor),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MyGroupsScreen()),
              );
            },
          ),

          Divider(height: 16, thickness: 8, color: dividerColor),

          // Phần 3: Khối danh sách bạn bè
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Tất cả bạn bè',
              style: TextStyle(color: subTextColor, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),

          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: _contactsFuture ??= ApiService.getFriends(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)));
                }
                final users = snapshot.data ?? [];
                final filteredUsers = users.where((u) {
                  if (u['id']?.toString() == provider.currentUser?.id) return false;
                  if (_contactSearchQuery.isNotEmpty) {
                    final rawName = (u['fullName'] ?? u['name'] ?? u['username'] ?? '').toString();
                    final rawUsername = (u['username'] ?? '').toString();
                    final name = rawName.toLowerCase();
                    final nameNoAccent = _removeAccents(rawName).toLowerCase();
                    final username = rawUsername.toLowerCase();
                    final q = _contactSearchQuery.toLowerCase();
                    final qNoAccent = _removeAccents(q).toLowerCase();

                    return name.contains(q) || nameNoAccent.contains(qNoAccent) || username.contains(q) || username.contains(qNoAccent);
                  }
                  return true;
                }).toList();

                if (filteredUsers.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline_rounded, size: 52, color: subTextColor),
                          const SizedBox(height: 12),
                          Text(
                            _contactSearchQuery.isNotEmpty ? 'Không tìm thấy bạn bè nào phù hợp' : 'Bạn chưa có người bạn nào trong danh bạ.\nHãy bấm nút (+) ở góc trên để tìm và kết bạn mới!',
                            style: TextStyle(color: subTextColor, fontSize: 14, height: 1.4),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.only(bottom: 16),
                  itemCount: filteredUsers.length,
                  separatorBuilder: (context, index) => Divider(
                    height: 1,
                    indent: 72,
                    color: dividerColor,
                  ),
                  itemBuilder: (context, index) {
                    final u = filteredUsers[index];
                    final name = u['fullName'] ?? u['name'] ?? u['username'] ?? 'Người dùng';
                    final username = u['username'] ?? '';
                    final uid = u['id']?.toString() ?? '';
                    final isOnline = u['isOnline'] == true || u['status'] == 'online';

                    return ListTile(
                      onTap: () async {
                        if (uid.isNotEmpty) {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => OtherUserProfileScreen(userId: uid, initialUserData: u is Map<String, dynamic> ? u : null)),
                          );
                          if (mounted) {
                            setState(() {
                              _contactsFuture = ApiService.getFriends();
                            });
                          }
                        }
                      },
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      leading: Stack(
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
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, height: 1.0),
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
                                  border: Border.all(color: cardBgColor, width: 2),
                                ),
                              ),
                            ),
                        ],
                      ),
                      title: Text(
                        name,
                        style: TextStyle(
                          color: textColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        '@$username',
                        style: TextStyle(color: subTextColor, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Material(
                            color: const Color(0xFF0068FF).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(20),
                              onTap: () async {
                                setState(() => _currentTabIndex = 0);
                                await provider.startPrivateChat(uid);
                              },
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.chat_bubble_rounded, size: 14, color: Color(0xFF0068FF)),
                                    SizedBox(width: 4),
                                    Text(
                                      'Nhắn tin',
                                      style: TextStyle(
                                        color: Color(0xFF0068FF),
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          PopupMenuButton<String>(
                            icon: Icon(Icons.more_vert_rounded, color: subTextColor, size: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            onSelected: (val) {
                              if (val == 'unfriend') {
                                _showUnfriendDialog(u, () {
                                  setState(() {});
                                });
                              }
                            },
                            itemBuilder: (ctx) => [
                              PopupMenuItem<String>(
                                value: 'unfriend',
                                child: Row(
                                  children: const [
                                    Icon(Icons.person_remove_rounded, color: Colors.red, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'Xóa bạn bè',
                                      style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // TAB 2: Tin tức AI
  Widget _buildNewsTab() {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF0F2F5);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    final newsList = [
      {'title': 'OpenAI ra mắt mô hình AI mới nâng cấp khả năng suy luận vượt trội', 'time': '10 phút trước', 'category': 'Trí tuệ nhân tạo'},
      {'title': 'Google Gemini cập nhật tính năng phân tích video và âm thanh trực tiếp', 'time': '1 giờ trước', 'category': 'Google AI'},
      {'title': 'Meta phát hành Llama 3 mã nguồn mở đạt hiệu năng xuất sắc', 'time': '3 giờ trước', 'category': 'Meta AI'},
    ];

    return Container(
      color: bgColor,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.newspaper_rounded, color: Color(0xFF0068FF), size: 28),
              const SizedBox(width: 12),
              Text(
                'Tin Tức Công Nghệ AI',
                style: TextStyle(color: textColor, fontSize: 22, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Expanded(
            child: ListView.builder(
              itemCount: newsList.length,
              itemBuilder: (context, index) {
                final item = newsList[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: cardBgColor,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(isDark ? 0.2 : 0.04), blurRadius: 10, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: const Color(0xFF0068FF).withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                            child: Text(item['category']!, style: const TextStyle(color: Color(0xFF0068FF), fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                          const Spacer(),
                          Text(item['time']!, style: TextStyle(color: subTextColor, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(item['title']!, style: TextStyle(color: textColor, fontSize: 17, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.arrow_forward_rounded, size: 16, color: Color(0xFF0068FF)),
                        label: const Text('Đọc chi tiết', style: TextStyle(color: Color(0xFF0068FF), fontWeight: FontWeight.bold)),
                      ),
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

  // TAB 3: Trợ lý AI
  Widget _buildAiAssistantTab() {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF0F2F5);
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final inputBgColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);

    return Container(
      color: bgColor,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(18),
            color: cardBgColor,
            child: Row(
              children: [
                const Icon(Icons.smart_toy_rounded, color: Color(0xFF0068FF), size: 28),
                const SizedBox(width: 12),
                Text('Trợ Lý AI Chat Tho-Fi', style: TextStyle(color: textColor, fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
          ),

          // Messages
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _aiMessages.length,
              itemBuilder: (context, index) {
                final msg = _aiMessages[index];
                final isUser = msg['sender'] == 'user';
                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF0068FF) : cardBgColor,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(isDark ? 0.2 : 0.04), blurRadius: 6)],
                    ),
                    child: Text(msg['content']!, style: TextStyle(color: isUser ? Colors.white : textColor, fontSize: 15, height: 1.3)),
                  ),
                );
              },
            ),
          ),

          // Input
          Container(
            padding: const EdgeInsets.all(14),
            color: cardBgColor,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _aiTextController,
                    style: TextStyle(color: textColor),
                    decoration: InputDecoration(
                      hintText: 'Hỏi Trợ lý AI bất kỳ điều gì...',
                      hintStyle: TextStyle(color: subTextColor),
                      filled: true,
                      fillColor: inputBgColor,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => _handleAiSend(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF0068FF)),
                  onPressed: _handleAiSend,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // TAB 4: Cá nhân
  Widget _buildProfileTab(ChatProvider provider) {
    return ProfileTab(onLogout: widget.onLogout);
  }
  void _showMediaUploadOptions(ChatProvider provider) {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.image_outlined, color: Color(0xFF0068FF)),
              title: const Text('Gửi hình ảnh'),
              onTap: () {
                Navigator.pop(context);
                _pickAndUploadImage(provider);
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined, color: Color(0xFF0068FF)),
              title: const Text('Gửi tập tin'),
              onTap: () {
                Navigator.pop(context);
              },
            ),
          ],
        );
      },
    );
  }

  String _formatRecordingTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _pickAndUploadImage(ChatProvider provider) {
    final conv = provider.selectedConversation;
    if (conv == null) return;
    final uploadInput = html.FileUploadInputElement()..accept = 'image/*';
    uploadInput.click();
    uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final file = files[0];
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                SizedBox(width: 12),
                Text('Đang gửi hình ảnh...'),
              ],
            ),
            duration: Duration(seconds: 3),
          ),
        );
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) async {
          if (reader.result is Uint8List) {
            final bytes = reader.result as Uint8List;
            final res = await ApiService.uploadMedia(conv.id, bytes, file.name, file.type);
            if (res['success'] == true && res['data'] != null) {
              try {
                final msg = MessageModel.fromJson(res['data']);
                provider.addRealtimeMessage(msg);
              } catch (_) {}
            }
          }
        });
      }
    });
  }

  void _captureCameraImage(ChatProvider provider) {
    final conv = provider.selectedConversation;
    if (conv == null) return;
    final uploadInput = html.FileUploadInputElement()
      ..accept = 'image/*'
      ..setAttribute('capture', 'environment');
    uploadInput.click();
    uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final file = files[0];
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                SizedBox(width: 12),
                Text('Đang gửi hình ảnh...'),
              ],
            ),
            duration: Duration(seconds: 3),
          ),
        );
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) async {
          if (reader.result is Uint8List) {
            final bytes = reader.result as Uint8List;
            final res = await ApiService.uploadMedia(conv.id, bytes, file.name, file.type);
            if (res['success'] == true && res['data'] != null) {
              try {
                final msg = MessageModel.fromJson(res['data']);
                provider.addRealtimeMessage(msg);
              } catch (_) {}
            }
          }
        });
      }
    });
  }

  void _showGifPicker(ChatProvider provider) {
    provider.sendMessage('https://media.giphy.com/media/l0HlHJGHe3yAMhdQY/giphy.gif', type: 'image');
  }

  Future<void> _handleVoiceRecording(ChatProvider provider) async {
    if (_isRecording) {
      await _stopAndSendRecording(provider);
    } else {
      await _startRecording();
    }
  }

  Future<void> _startRecording() async {
    try {
      final stream = await html.window.navigator.mediaDevices?.getUserMedia({'audio': true});
      if (stream == null) return;
      _mediaStream = stream;
      _audioChunks = [];
      _mediaRecorder = html.MediaRecorder(stream);
      _mediaRecorder?.addEventListener('dataavailable', (html.Event event) {
        final blobEvent = event as html.BlobEvent;
        if (blobEvent.data != null) {
          _audioChunks.add(blobEvent.data!);
        }
      });
      _mediaRecorder?.start();
      setState(() {
        _isRecording = true;
        _recordingSeconds = 0;
      });
      _recordingTimer?.cancel();
      _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (mounted && _isRecording) {
          setState(() {
            _recordingSeconds++;
          });
        }
      });
    } catch (err) {
      debugPrint('Lỗi xin quyền Micro: $err');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng cấp quyền Micro trên trình duyệt để ghi âm')),
      );
    }
  }

  Future<void> _stopAndSendRecording(ChatProvider provider) async {
    final conv = provider.selectedConversation;
    if (conv == null || !_isRecording) return;
    _recordingTimer?.cancel();

    _mediaRecorder?.addEventListener('stop', (html.Event event) async {
      final audioBlob = html.Blob(_audioChunks, 'audio/webm');
      final reader = html.FileReader();
      reader.readAsArrayBuffer(audioBlob);
      reader.onLoadEnd.listen((e) async {
        if (reader.result is Uint8List) {
          final bytes = reader.result as Uint8List;
          await ApiService.uploadMedia(conv.id, bytes, 'voice_${DateTime.now().millisecondsSinceEpoch}.webm', 'audio/webm');
        }
      });
    });

    _mediaRecorder?.stop();
    _mediaStream?.getTracks().forEach((track) => (track as dynamic).stop());

    setState(() {
      _isRecording = false;
      _recordingSeconds = 0;
    });
  }

  void _cancelRecording() {
    _recordingTimer?.cancel();
    try {
      _mediaRecorder?.stop();
      _mediaStream?.getTracks().forEach((track) => (track as dynamic).stop());
    } catch (_) {}
    setState(() {
      _isRecording = false;
      _recordingSeconds = 0;
    });
  }

  void _startVoiceCall(ChatProvider provider) {
    _startCall(context, provider, isVideo: false);
  }

  void _startVideoCall(ChatProvider provider) {
    _startCall(context, provider, isVideo: true);
  }

  void _showChatInfo(ChatProvider provider) {
    final conv = provider.selectedConversation;
    if (conv == null) return;

    String? partnerAvatar = conv.avatar;
    UserModel? partnerUser;
    if (conv.members.isNotEmpty) {
      final currentUserId = provider.currentUser?.id;
      partnerUser = conv.members.firstWhere(
        (m) => m.id != currentUserId,
        orElse: () => conv.members.first,
      );
      if (partnerAvatar == null || partnerAvatar.isEmpty) {
        partnerAvatar = partnerUser.avatar;
      }
    }

    String? fullAvatarUrl;
    if (partnerAvatar != null && partnerAvatar.isNotEmpty) {
      fullAvatarUrl = partnerAvatar.startsWith('http')
          ? partnerAvatar
          : '${ApiService.baseUrl.replaceAll('/api', '')}$partnerAvatar';
    }

    final isOnline = conv.isOnline == true;

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          elevation: 8,
          backgroundColor: Colors.white,
          child: Container(
            width: 320,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // 1. Ảnh đại diện (Ở trên cùng, Căn giữa)
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    CircleAvatar(
                      radius: 46,
                      backgroundColor: const Color(0xFF0068FF),
                      backgroundImage: fullAvatarUrl != null ? NetworkImage(fullAvatarUrl) : null,
                      child: fullAvatarUrl == null
                          ? Text(
                              conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                              style: const TextStyle(fontSize: 36, color: Colors.white, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                    if (isOnline)
                      Positioned(
                        right: 2,
                        bottom: 2,
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: const Color(0xFF31A24C),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2.5),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),

                // 2. Tên người dùng (Ngay bên dưới ảnh, Căn giữa)
                Text(
                  conv.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF050505),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),

                // 3. Trạng thái hoạt động
                Text(
                  _formatLastActive(partnerUser?.lastActive, isOnline),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.normal,
                    color: Color(0xFF65676B),
                  ),
                ),
                const SizedBox(height: 16),

                // 4. Nút Đổi Biệt Danh (Đặt trong menu i)
                InkWell(
                  onTap: () {
                    Navigator.pop(context);
                    if (conv.type == 'group') {
                      _showGroupNicknameSelectionSheet(provider, conv);
                    } else if (partnerUser != null) {
                      _showEditNicknameDialog(provider, conv, partnerUser);
                    }
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFBFDBFE), width: 1),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.edit_note_rounded, color: Color(0xFF0068FF), size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Đổi biệt danh',
                          style: TextStyle(color: Color(0xFF0068FF), fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 5. Các nút thao tác nhanh (Gọi thoại / Gọi Video)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _startVoiceCall(provider);
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.phone_rounded, color: Color(0xFF0068FF), size: 18),
                            SizedBox(width: 6),
                            Text(
                              'Gọi thoại',
                              style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _startVideoCall(provider);
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.videocam_rounded, color: Color(0xFF10B981), size: 18),
                            SizedBox(width: 6),
                            Text(
                              'Gọi Video',
                              style: TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // 6. Nút Đóng
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      backgroundColor: const Color(0xFFF8FAFC),
                    ),
                    child: const Text(
                      'Đóng',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showEditNicknameDialog(ChatProvider provider, ConversationModel conv, UserModel member) {
    final controller = TextEditingController(text: member.nickname ?? '');
    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: Colors.white,
          title: const Text(
            'Đặt biệt danh',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Đặt biệt danh cho ${member.fullName}:',
                style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Nhập biệt danh hoặc để trống để gỡ...',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  focusedBorder: OutlineInputBorder(
                    borderSide: const BorderSide(color: Color(0xFF0068FF), width: 2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () async {
                final newNick = controller.text.trim();
                Navigator.pop(dialogCtx);
                await provider.updateNickname(conv.id, member.id, newNick);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0068FF),
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Lưu', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showGroupNicknameSelectionSheet(ChatProvider provider, ConversationModel conv) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalCtx) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn thành viên để đổi biệt danh',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 16),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: conv.members.length,
                  itemBuilder: (ctx, idx) {
                    final member = conv.members[idx];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF0068FF),
                        backgroundImage: (member.avatar != null && member.avatar!.isNotEmpty)
                            ? NetworkImage(member.avatar!)
                            : null,
                        child: (member.avatar == null || member.avatar!.isEmpty)
                            ? Text(member.displayName[0].toUpperCase(), style: const TextStyle(color: Colors.white))
                            : null,
                      ),
                      title: Text(member.displayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: member.nickname != null && member.nickname!.isNotEmpty
                          ? Text('Tên gốc: ${member.fullName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))
                          : null,
                      trailing: const Icon(Icons.edit_outlined, color: Color(0xFF0068FF), size: 20),
                      onTap: () {
                        Navigator.pop(modalCtx);
                        _showEditNicknameDialog(provider, conv, member);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMessageBubbleContent(MessageModel msg, bool isMe) {
    if (msg.isRecalled) {
      return const Text(
        'Tin nhắn đã được thu hồi',
        style: TextStyle(
          color: Color(0xFF8A8D91),
          fontSize: 14,
          fontStyle: FontStyle.italic,
        ),
      );
    }
    final content = msg.content;
    final isImage = msg.type == 'image' || content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty);
    final isAudio = msg.type == 'audio' || content.startsWith('data:audio');
    final isFile = msg.type == 'file';
    final isMissedCall = msg.type == 'missed_call' || msg.type == 'call';

    if (isImage) {
      String? imageUrl = msg.imageUrl;
      Uint8List? imageBytes;

      if (content.startsWith('data:image')) {
        try {
          final base64Str = content.split(',').last;
          imageBytes = base64Decode(base64Str);
        } catch (e) {
          debugPrint('Base64 decode error: $e');
        }
      } else if (content.startsWith('http') || content.startsWith('/')) {
        imageUrl = content;
      }

      Widget imgWidget;
      if (imageBytes != null) {
        imgWidget = Image.memory(
          imageBytes,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            padding: const EdgeInsets.all(12),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.broken_image, color: Colors.grey),
                SizedBox(width: 6),
                Text('Ảnh lỗi'),
              ],
            ),
          ),
        );
      } else if (imageUrl != null && imageUrl.isNotEmpty) {
        imgWidget = Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            padding: const EdgeInsets.all(12),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.broken_image, color: Colors.grey),
                SizedBox(width: 6),
                Text('Ảnh lỗi'),
              ],
            ),
          ),
        );
      } else {
        imgWidget = const Padding(
          padding: EdgeInsets.all(8.0),
          child: Text('[Hình ảnh]'),
        );
      }

      return GestureDetector(
        onTap: () {
          showDialog(
            context: context,
            builder: (_) => Dialog(
              backgroundColor: Colors.transparent,
              insetPadding: const EdgeInsets.all(12),
              child: Stack(
                alignment: Alignment.topRight,
                children: [
                  InteractiveViewer(child: imgWidget),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
          );
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 240, maxHeight: 300),
            child: imgWidget,
          ),
        ),
      );
    }

    if (isAudio) {
      final audioUrl = (msg.audioUrl != null && msg.audioUrl!.isNotEmpty)
          ? msg.audioUrl!
          : content;
      return VoiceBubbleWidget(audioUrl: audioUrl, isMe: isMe);
    }

    if (isFile) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insert_drive_file_rounded, color: isMe ? Colors.white : const Color(0xFF0068FF)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              content.isNotEmpty ? content : 'Tệp đính kèm',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: isMe ? Colors.white : const Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      );
    }

    if (isMissedCall) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.phone_missed_rounded, color: isMe ? Colors.white70 : const Color(0xFFEF4444), size: 18),
          const SizedBox(width: 6),
          Text(
            content.isNotEmpty ? content : 'Cuộc gọi nhỡ',
            style: TextStyle(color: isMe ? Colors.white : const Color(0xFF0F172A), fontSize: 13.5, fontWeight: FontWeight.w500),
          ),
        ],
      );
    }

    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    return Text(
      content,
      style: TextStyle(color: isMe ? Colors.white : (isDark ? Colors.white : const Color(0xFF0F172A)), fontSize: 15, height: 1.3),
    );
  }

  void _handleIncomingCall(Map<String, dynamic> data) {
    final callerId = data['callerId']?.toString();
    final callerName = data['callerName']?.toString() ?? 'Người dùng';
    final callType = data['callType']?.toString() ?? 'audio';
    final isVideo = callType == 'video';

    if (callerId == null || callerId.isEmpty) return;

    Timer? autoRejectTimer;

    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'IncomingCall',
      pageBuilder: (dialogContext, anim1, anim2) {
        autoRejectTimer = Timer(const Duration(seconds: 30), () {
          SocketService.socket?.emit('reject_call', {
            'callerId': callerId,
            'callType': callType,
          });
          if (Navigator.of(dialogContext).canPop()) {
            Navigator.of(dialogContext).pop();
          }
        });

        return WillPopScope(
          onWillPop: () async => false,
          child: Material(
            color: const Color(0xFF090D1A),
            child: SafeArea(
              child: SizedBox.expand(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        children: [
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                isVideo ? Icons.videocam_rounded : Icons.phone_in_talk_rounded,
                                color: const Color(0xFF10B981),
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Cuộc gọi ${isVideo ? "Video" : "Thoại"} đến',
                                style: const TextStyle(
                                  color: Color(0xFF10B981),
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF10B981).withOpacity(0.5), width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF10B981).withOpacity(0.2),
                                  blurRadius: 30,
                                  spreadRadius: 10,
                                ),
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 60,
                              backgroundColor: const Color(0xFF0068FF),
                              child: Text(
                                callerName.isNotEmpty ? callerName[0].toUpperCase() : 'U',
                                style: const TextStyle(fontSize: 48, color: Colors.white, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            callerName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Đang đổ chuông...',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),

                      Padding(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  iconSize: 36,
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFEF4444),
                                    padding: const EdgeInsets.all(22),
                                    elevation: 6,
                                  ),
                                  icon: const Icon(Icons.call_end_rounded, color: Colors.white),
                                  onPressed: () {
                                    autoRejectTimer?.cancel();
                                    SocketService.socket?.emit('reject_call', {
                                      'callerId': callerId,
                                      'callType': callType,
                                    });
                                    Navigator.of(dialogContext).pop();
                                  },
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Từ chối',
                                  style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),

                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  iconSize: 36,
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFF10B981),
                                    padding: const EdgeInsets.all(22),
                                    elevation: 6,
                                  ),
                                  icon: const Icon(Icons.call_rounded, color: Colors.white),
                                  onPressed: () {
                                    autoRejectTimer?.cancel();
                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
                                    audioPlayer?.muted = false;
                                    audioPlayer?.volume = 1.0;
                                    audioPlayer?.play().catchError((_) {});
                                    SocketService.socket?.emit('accept_call', {'callerId': callerId});
                                    Navigator.of(dialogContext).pop();
                                    _showCallDialog(
                                      context: context,
                                      partnerName: callerName,
                                      isVideo: isVideo,
                                      targetUserId: callerId,
                                      isCaller: false,
                                    );
                                  },
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Trả lời',
                                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _startCall(BuildContext context, ChatProvider provider, {required bool isVideo}) {
    final conv = provider.selectedConversation;
    if (conv == null) return;

    var targetUserId = conv.targetUserId;
    final callerId = provider.currentUser?.id;

    if (targetUserId == null || targetUserId.isEmpty || targetUserId == callerId) {
      if (conv.members.isNotEmpty && callerId != null) {
        final otherMember = conv.members.firstWhere(
          (m) => m.id != callerId,
          orElse: () => conv.members.first,
        );
        targetUserId = otherMember.id;
      }
    }

    final callerName = provider.currentUser?.fullName ?? provider.currentUser?.username ?? 'Tôi';
    final callerAvatar = provider.currentUser?.avatar ?? '';

    if (targetUserId == null || targetUserId.isEmpty || targetUserId == callerId) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không tìm thấy thông tin đối phương để kết nối cuộc gọi')),
      );
      return;
    }

    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
    audioPlayer?.muted = false;
    audioPlayer?.volume = 1.0;
    audioPlayer?.play().catchError((_) {});

    SocketService.socket?.emit('request_call', {
      'callerId': callerId,
      'callerName': callerName,
      'callerAvatar': callerAvatar,
      'calleeId': targetUserId,
      'callType': isVideo ? 'video' : 'audio',
    });

    _showCallDialog(
      context: context,
      partnerName: conv.name,
      isVideo: isVideo,
      targetUserId: targetUserId,
      isCaller: true,
    );
  }

  void _showCallDialog({
    required BuildContext context,
    required String partnerName,
    required bool isVideo,
    required String targetUserId,
    required bool isCaller,
  }) {
    bool isMuted = false;
    bool isSpeakerOn = true;
    bool isCameraOff = false;
    String callStatus = isCaller ? 'Đang gọi...' : 'Đang đàm thoại';

    StreamSubscription? acceptSub;
    StreamSubscription? rejectSub;
    StreamSubscription? endSub;
    StreamSubscription? signalSub;
    html.RtcPeerConnection? pc;
    html.MediaStream? localStream;
    html.AudioElement? remoteAudio;
    final List<Map<String, dynamic>> pendingSignals = [];
    final List<Map<String, dynamic>> iceCandidateQueue = [];

    html.VideoElement getOrCreateVideo(String id, {required bool isLocal}) {
      var el = html.document.getElementById(id) as html.VideoElement?;
      if (el == null) {
        el = html.VideoElement()
          ..id = id
          ..autoplay = true
          ..setAttribute('playsinline', 'true');
        html.document.body?.children.add(el);
      }
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      if (isLocal) {
        el.muted = true;
        el.style
          ..position = 'fixed'
          ..top = '24px'
          ..right = '24px'
          ..width = '130px'
          ..height = '175px'
          ..objectFit = 'cover'
          ..zIndex = '2147483647'
          ..borderRadius = '16px'
          ..border = '2px solid rgba(255, 255, 255, 0.8)'
          ..boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6)'
          ..transform = 'scaleX(-1)';
      } else {
        el.style
          ..position = 'fixed'
          ..top = '0'
          ..left = '0'
          ..width = '100vw'
          ..height = '100vh'
          ..objectFit = 'cover'
          ..zIndex = '2147483646'
          ..background = '#090D1A';
      }
      return el;
    }

    void cleanupCall() {
      try {
        acceptSub?.cancel();
        rejectSub?.cancel();
        endSub?.cancel();
        signalSub?.cancel();

        final localVideo = html.document.getElementById('localVideoPlayer') as html.VideoElement?;
        final remoteVideo = html.document.getElementById('remoteVideoPlayer') as html.VideoElement?;
        if (localVideo != null) {
          localVideo.pause();
          localVideo.srcObject = null;
          localVideo.style.display = 'none';
        }
        if (remoteVideo != null) {
          remoteVideo.pause();
          remoteVideo.srcObject = null;
          remoteVideo.style.display = 'none';
        }

        if (remoteAudio != null) {
          remoteAudio!.pause();
          remoteAudio!.srcObject = null;
          remoteAudio!.remove();
          remoteAudio = null;
        }

        if (localStream != null) {
          for (var track in localStream!.getTracks()) {
            (track as dynamic).stop();
          }
          localStream = null;
        }

        pc?.close();
        pc = null;
        pendingSignals.clear();
        iceCandidateQueue.clear();
      } catch (e) {
        print('⚠️ WebRTC cleanup error: $e');
      }
    }

    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'CallRoom',
      barrierColor: isVideo ? Colors.transparent : Colors.black.withOpacity(0.9),
      pageBuilder: (dialogContext, anim1, anim2) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> processIceQueue() async {
              for (var candidateMap in iceCandidateQueue) {
                try {
                  await pc?.addIceCandidate(html.RtcIceCandidate(candidateMap));
                  print('✅ Queued ICE Candidate added successfully!');
                } catch (e) {
                  print('⚠️ Error adding queued ICE candidate: $e');
                }
              }
              iceCandidateQueue.clear();
            }

            Future<void> processSignal(Map<String, dynamic> data) async {
              final signal = data['signal'];
              if (signal == null) return;
              if (pc == null) {
                pendingSignals.add(data);
                return;
              }
              try {
                final type = signal['type']?.toString();
                if (type == 'offer') {
                  await pc!.setRemoteDescription({
                    'type': 'offer',
                    'sdp': signal['sdp'],
                  });
                  await processIceQueue();
                  final answer = await pc!.createAnswer();
                  await pc!.setLocalDescription({
                    'type': answer.type,
                    'sdp': answer.sdp,
                  });
                  SocketService.socket?.emit('webrtc_signal', {
                    'connectedUserId': targetUserId,
                    'signal': {
                      'type': 'answer',
                      'sdp': answer.sdp,
                    }
                  });
                } else if (type == 'answer') {
                  await pc!.setRemoteDescription({
                    'type': 'answer',
                    'sdp': signal['sdp'],
                  });
                  await processIceQueue();
                } else if (type == 'candidate') {
                  final candidateStr = signal['candidate']?.toString();
                  if (candidateStr != null && candidateStr.isNotEmpty) {
                    final candidateMap = {
                      'candidate': candidateStr,
                      'sdpMid': signal['sdpMid']?.toString(),
                      'sdpMLineIndex': signal['sdpMLineIndex'],
                    };
                    if (pc?.remoteDescription != null) {
                      try {
                        await pc!.addIceCandidate(html.RtcIceCandidate(candidateMap));
                      } catch (e) {
                        print('⚠️ Error adding direct ICE candidate: $e');
                      }
                    } else {
                      iceCandidateQueue.add(candidateMap);
                    }
                  }
                }
              } catch (e) {
                print('⚠️ WebRTC Signal Handling Error: $e');
              }
            }

            Future<void> initWebRTC() async {
              if (!kIsWeb || pc != null) return;
              try {
                final config = {
                  'iceServers': [
                    {'urls': 'stun:stun.l.google.com:19302'},
                    {'urls': 'stun:stun1.l.google.com:19302'},
                    {'urls': 'stun:stun2.l.google.com:19302'},
                    {'urls': 'stun:stun3.l.google.com:19302'},
                    {'urls': 'stun:stun4.l.google.com:19302'},
                    {'urls': 'stun:stun.cloudflare.com:3478'},
                    {'urls': 'stun:openrelay.metered.ca:80'},
                    {
                      'urls': 'turn:openrelay.metered.ca:80',
                      'username': 'openrelayproject',
                      'credential': 'openrelayproject'
                    },
                    {
                      'urls': 'turn:openrelay.metered.ca:443',
                      'username': 'openrelayproject',
                      'credential': 'openrelayproject'
                    }
                  ],
                  'iceCandidatePoolSize': 10
                };
                pc = await html.RtcPeerConnection(config);

                final existingAudio = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
                if (existingAudio != null) {
                  remoteAudio = existingAudio;
                } else {
                  remoteAudio = html.AudioElement()..autoplay = true;
                  remoteAudio!.style.display = 'none';
                  html.document.body?.children.add(remoteAudio!);
                }
                remoteAudio!.muted = false;
                remoteAudio!.volume = 1.0;
                remoteAudio!.play().catchError((_) {});

                try {
                  localStream = await html.window.navigator.mediaDevices?.getUserMedia({
                    'audio': true,
                    'video': isVideo ? {'facingMode': 'user'} : false,
                  });
                } catch (camErr) {
                  print('⚠️ Flexible camera request failed: $camErr, trying raw boolean...');
                  try {
                    localStream = await html.window.navigator.mediaDevices?.getUserMedia({
                      'audio': true,
                      'video': isVideo,
                    });
                  } catch (rawErr) {
                    print('❌ Final getUserMedia error: $rawErr');
                  }
                }

                if (isVideo && localStream != null) {
                  final localVideo = getOrCreateVideo('localVideoPlayer', isLocal: true);
                  localVideo.srcObject = localStream;
                  localVideo.style.display = 'block';
                  localVideo.play().catchError((e) {
                    Future.delayed(const Duration(milliseconds: 300), () {
                      localVideo.play().catchError((_) {});
                    });
                  });
                }

                if (localStream != null && pc != null) {
                  for (var track in localStream!.getTracks()) {
                    try {
                      pc!.addTrack(track, localStream!);
                    } catch (_) {}
                  }
                }

                pc?.onAddStream.listen((event) {
                  print('🔊 WebRTC onAddStream fired! Stream: ${event.stream?.id}');
                  if (event.stream != null) {
                    if (remoteAudio != null) {
                      remoteAudio!.srcObject = event.stream!;
                      remoteAudio!.muted = false;
                      remoteAudio!.volume = 1.0;
                      remoteAudio!.play().catchError((e) => print('⚠️ Audio Play Error: $e'));
                    }
                    if (isVideo) {
                      final remoteVideo = getOrCreateVideo('remoteVideoPlayer', isLocal: false);
                      remoteVideo.srcObject = event.stream!;
                      remoteVideo.style.display = 'block';
                      remoteVideo.play().catchError((e) {
                        Future.delayed(const Duration(milliseconds: 300), () {
                          remoteVideo.play().catchError((_) {});
                        });
                      });
                    }
                  }
                });

                pc?.onTrack.listen((event) {
                  print('🔊 WebRTC onTrack fired! Track: ${event.track?.kind}');
                  html.MediaStream? stream;
                  if (event.streams != null && event.streams!.isNotEmpty) {
                    stream = event.streams![0];
                  } else if (event.track != null) {
                    stream = html.MediaStream([event.track!]);
                  }

                  if (stream != null) {
                    if (remoteAudio != null) {
                      remoteAudio!.srcObject = stream;
                      remoteAudio!.muted = false;
                      remoteAudio!.volume = 1.0;
                      remoteAudio!.play().catchError((e) => print('⚠️ Audio Play Error: $e'));
                    }
                    if (isVideo) {
                      final remoteVideo = getOrCreateVideo('remoteVideoPlayer', isLocal: false);
                      remoteVideo.srcObject = stream;
                      remoteVideo.style.display = 'block';
                      remoteVideo.play().catchError((e) {
                        Future.delayed(const Duration(milliseconds: 300), () {
                          remoteVideo.play().catchError((_) {});
                        });
                      });
                    }
                  }
                });

                pc?.onIceCandidate.listen((event) {
                  if (event.candidate != null && event.candidate!.candidate != null) {
                    SocketService.socket?.emit('webrtc_signal', {
                      'connectedUserId': targetUserId,
                      'signal': {
                        'type': 'candidate',
                        'candidate': event.candidate!.candidate,
                        'sdpMid': event.candidate!.sdpMid,
                        'sdpMLineIndex': event.candidate!.sdpMLineIndex,
                      }
                    });
                  }
                });

                pc?.onIceConnectionStateChange.listen((_) {
                  print('⚡ WebRTC ICE Connection State: ${pc?.iceConnectionState}');
                });

                if (pendingSignals.isNotEmpty) {
                  final signalsToProcess = List<Map<String, dynamic>>.from(pendingSignals);
                  pendingSignals.clear();
                  for (var sig in signalsToProcess) {
                    await processSignal(sig);
                  }
                }

                if (isCaller) {
                  final offer = await pc!.createOffer();
                  await pc!.setLocalDescription({
                    'type': offer.type,
                    'sdp': offer.sdp,
                  });
                  SocketService.socket?.emit('webrtc_signal', {
                    'connectedUserId': targetUserId,
                    'signal': {
                      'type': 'offer',
                      'sdp': offer.sdp,
                    }
                  });
                }
              } catch (e) {
                print('⚠️ WebRTC Init Error: $e');
              }
            }

            acceptSub ??= SocketService.onCallAccepted.listen((_) {
              setDialogState(() {
                callStatus = 'Đang đàm thoại';
              });
              initWebRTC();
            });

            rejectSub ??= SocketService.onCallRejected.listen((data) {
              setDialogState(() {
                callStatus = 'Người dùng bận / Từ chối';
              });
              Future.delayed(const Duration(milliseconds: 1200), () {
                cleanupCall();
                if (Navigator.of(dialogContext).canPop()) {
                  Navigator.of(dialogContext).pop();
                }
              });
            });

            endSub ??= SocketService.onCallEnded.listen((_) {
              print('🔴 Đối phương đã tắt máy -> Tự động đóng màn hình gọi!');
              cleanupCall();
              if (Navigator.of(dialogContext).canPop()) {
                Navigator.of(dialogContext).pop();
              }
            });

            signalSub ??= SocketService.onWebrtcSignal.listen((data) async {
              await processSignal(data);
            });

            if (!isCaller && pc == null) {
              initWebRTC();
            }

            return WillPopScope(
              onWillPop: () async => false,
              child: Material(
                color: isVideo ? Colors.transparent : const Color(0xFF090D1A),
                child: SafeArea(
                  child: SizedBox.expand(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            children: [
                              const SizedBox(height: 10),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.5),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isVideo ? Icons.videocam_rounded : Icons.phone_rounded,
                                      color: isVideo ? const Color(0xFF10B981) : const Color(0xFF0068FF),
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      callStatus,
                                      style: TextStyle(
                                        color: isVideo ? const Color(0xFF10B981) : const Color(0xFF0068FF),
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          if (!isVideo)
                            Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF0068FF).withOpacity(0.5), width: 3),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF0068FF).withOpacity(0.25),
                                        blurRadius: 40,
                                        spreadRadius: 10,
                                      ),
                                    ],
                                  ),
                                  child: CircleAvatar(
                                    radius: 64,
                                    backgroundColor: const Color(0xFF0068FF),
                                    child: Text(
                                      partnerName.isNotEmpty ? partnerName[0].toUpperCase() : 'U',
                                      style: const TextStyle(fontSize: 52, color: Colors.white, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 24),
                                Text(
                                  partnerName,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  callStatus == 'Đang đàm thoại' ? 'Đã kết nối âm thanh P2P' : 'Đang kết nối...',
                                  style: const TextStyle(
                                    color: Color(0xFF94A3B8),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            )
                          else
                            const SizedBox.shrink(),

                          Padding(
                            padding: const EdgeInsets.only(bottom: 24),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.6),
                                borderRadius: BorderRadius.circular(32),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    iconSize: 30,
                                    icon: Icon(isMuted ? Icons.mic_off_rounded : Icons.mic_rounded, color: Colors.white),
                                    onPressed: () {
                                      setDialogState(() {
                                        isMuted = !isMuted;
                                        if (localStream != null) {
                                          for (var track in localStream!.getAudioTracks()) {
                                            track.enabled = !isMuted;
                                          }
                                        }
                                      });
                                    },
                                  ),
                                  const SizedBox(width: 16),

                                  if (isVideo) ...[
                                    IconButton(
                                      iconSize: 30,
                                      icon: Icon(isCameraOff ? Icons.videocam_off_rounded : Icons.videocam_rounded, color: Colors.white),
                                      onPressed: () {
                                        setDialogState(() {
                                          isCameraOff = !isCameraOff;
                                          if (localStream != null) {
                                            for (var track in localStream!.getVideoTracks()) {
                                              track.enabled = !isCameraOff;
                                            }
                                          }
                                        });
                                      },
                                    ),
                                    const SizedBox(width: 16),
                                  ],

                                  IconButton(
                                    iconSize: 36,
                                    style: IconButton.styleFrom(
                                      backgroundColor: const Color(0xFFEF4444),
                                      padding: const EdgeInsets.all(16),
                                    ),
                                    icon: const Icon(Icons.call_end_rounded, color: Colors.white),
                                    onPressed: () {
                                      SocketService.socket?.emit('end_call', {'connectedUserId': targetUserId});
                                      cleanupCall();
                                      if (Navigator.of(dialogContext).canPop()) {
                                        Navigator.of(dialogContext).pop();
                                      }
                                    },
                                  ),
                                  const SizedBox(width: 16),

                                  IconButton(
                                    iconSize: 30,
                                    icon: Icon(isSpeakerOn ? Icons.volume_up_rounded : Icons.volume_off_rounded, color: Colors.white),
                                    onPressed: () {
                                      setDialogState(() {
                                        isSpeakerOn = !isSpeakerOn;
                                        if (remoteAudio != null) {
                                          remoteAudio!.muted = !isSpeakerOn;
                                        }
                                      });
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    ).then((_) {
      cleanupCall();
    });
  }

  Widget _buildMobileBottomBar() {
    final chatProvider = Provider.of<ChatProvider>(context);
    final unreadMessagesCount = chatProvider.totalUnreadCount;
    final pendingRequestsCount = _pendingFriendRequestsCount;

    final List<Map<String, dynamic>> tabs = [
      {
        'title': 'Tin nhắn',
        'outlineIcon': Icons.chat_bubble_outline_rounded,
        'solidIcon': Icons.chat_bubble_rounded,
        'badge': unreadMessagesCount,
      },
      {
        'title': 'Danh bạ',
        'outlineIcon': Icons.people_outline_rounded,
        'solidIcon': Icons.people_rounded,
        'badge': pendingRequestsCount,
      },
      {
        'title': 'Tin tức',
        'outlineIcon': Icons.article_outlined,
        'solidIcon': Icons.article_rounded,
        'badge': 0,
      },
      {
        'title': 'Trợ lý AI',
        'outlineIcon': Icons.auto_awesome_outlined,
        'solidIcon': Icons.auto_awesome_rounded,
        'badge': 0,
      },
      {
        'title': 'Cá nhân',
        'outlineIcon': Icons.person_outline_rounded,
        'solidIcon': Icons.person_rounded,
        'badge': 0,
      },
    ];

    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final cardBgColor = isDark ? const Color(0xFF1E293B) : Colors.white;
    final borderColor = isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9);
    final unselectedIconColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return SafeArea(
      bottom: true,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: cardBgColor,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0068FF).withOpacity(0.08),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: List.generate(tabs.length, (index) {
            bool isSelected = _currentTabIndex == index;
            int badgeNum = (tabs[index]['badge'] as int? ?? 0);

            Widget iconWidget = Icon(
              isSelected ? tabs[index]['solidIcon'] as IconData : tabs[index]['outlineIcon'] as IconData,
              color: isSelected ? const Color(0xFF0068FF) : unselectedIconColor,
              size: 22,
            );

            if (badgeNum > 0) {
              iconWidget = Stack(
                clipBehavior: Clip.none,
                children: [
                  iconWidget,
                  Positioned(
                    top: -5,
                    right: -7,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white, width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFEF4444).withOpacity(0.4),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        badgeNum > 99 ? '99+' : '$badgeNum',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),
                ],
              );
            }

            return GestureDetector(
              onTap: () {
                setState(() => _currentTabIndex = index);
                if (index == 1) {
                  _fetchPendingRequestsCount();
                }
              },
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                padding: EdgeInsets.symmetric(horizontal: isSelected ? 14 : 10, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0068FF).withOpacity(0.12) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    iconWidget,
                    if (isSelected) ...[
                      const SizedBox(width: 6),
                      Text(
                        tabs[index]['title'] as String,
                        style: const TextStyle(
                          color: Color(0xFF0068FF),
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _SwipeToReplyWrapper extends StatefulWidget {
  final Widget child;
  final VoidCallback onReply;

  const _SwipeToReplyWrapper({
    Key? key,
    required this.child,
    required this.onReply,
  }) : super(key: key);

  @override
  State<_SwipeToReplyWrapper> createState() => _SwipeToReplyWrapperState();
}

class _SwipeToReplyWrapperState extends State<_SwipeToReplyWrapper> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  double _dragOffset = 0.0;
  static const double _maxDrag = 48.0;
  bool _triggered = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails details) {
    setState(() {
      _dragOffset += details.delta.dx;
      if (_dragOffset > _maxDrag) _dragOffset = _maxDrag;
      if (_dragOffset < -_maxDrag) _dragOffset = -_maxDrag;

      if (_dragOffset.abs() >= 30.0 && !_triggered) {
        _triggered = true;
      }
    });
  }

  void _onDragEnd(DragEndDetails details) {
    if (_triggered) {
      widget.onReply();
    }
    _triggered = false;
    final start = _dragOffset;
    final animation = Tween<double>(begin: start, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    animation.addListener(() {
      setState(() {
        _dragOffset = animation.value;
      });
    });
    _controller.forward(from: 0.0);
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_dragOffset.abs() / _maxDrag).clamp(0.0, 1.0);
    return GestureDetector(
      onHorizontalDragUpdate: _onDragUpdate,
      onHorizontalDragEnd: _onDragEnd,
      child: Stack(
        alignment: _dragOffset > 0 ? Alignment.centerLeft : Alignment.centerRight,
        children: [
          if (progress > 0.05)
            Opacity(
              opacity: progress,
              child: Transform.scale(
                scale: progress,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: Color(0xFF0068FF),
                    child: Icon(Icons.reply_rounded, color: Colors.white, size: 16),
                  ),
                ),
              ),
            ),
          Transform.translate(
            offset: Offset(_dragOffset, 0),
            child: widget.child,
          ),
        ],
      ),
    );
  }
}

class _SpringEmojiPickerItem extends StatefulWidget {
  final String emoji;
  final VoidCallback onTap;
  final Function(Offset position) onFlyingEmojiRequested;

  const _SpringEmojiPickerItem({
    Key? key,
    required this.emoji,
    required this.onTap,
    required this.onFlyingEmojiRequested,
  }) : super(key: key);

  @override
  State<_SpringEmojiPickerItem> createState() => _SpringEmojiPickerItemState();
}

class _SpringEmojiPickerItemState extends State<_SpringEmojiPickerItem> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  final GlobalKey _key = GlobalKey();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    final renderBox = _key.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox != null) {
      final position = renderBox.localToGlobal(Offset.zero);
      final center = Offset(
        position.dx + renderBox.size.width / 2,
        position.dy + renderBox.size.height / 2,
      );
      widget.onFlyingEmojiRequested(center);
    }
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        _handleTap();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          child: Text(
            widget.emoji,
            key: _key,
            style: const TextStyle(fontSize: 27),
          ),
        ),
      ),
    );
  }
}

class _EmojiParticle {
  final double dx;
  final double dy;
  final double startScale;
  final double maxScale;
  final double rotation;
  final double fontSize;
  final double delay;

  _EmojiParticle({
    required this.dx,
    required this.dy,
    required this.startScale,
    required this.maxScale,
    required this.rotation,
    required this.fontSize,
    required this.delay,
  });
}

class _FlyingEmojiWidget extends StatefulWidget {
  final Offset from;
  final String emoji;
  final VoidCallback onComplete;

  const _FlyingEmojiWidget({
    Key? key,
    required this.from,
    required this.emoji,
    required this.onComplete,
  }) : super(key: key);

  @override
  State<_FlyingEmojiWidget> createState() => _FlyingEmojiWidgetState();
}

class _FlyingEmojiWidgetState extends State<_FlyingEmojiWidget> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<_EmojiParticle> _particles;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 950),
      vsync: this,
    );

    final rand = Random();
    _particles = List.generate(7, (index) {
      if (index == 0) {
        return _EmojiParticle(
          dx: 0,
          dy: -190,
          startScale: 0.4,
          maxScale: 1.8,
          rotation: 0,
          fontSize: 42,
          delay: 0.0,
        );
      }
      final angle = (index - 3.5) * 0.45;
      final distance = 130.0 + rand.nextDouble() * 60.0;
      final dx = sin(angle) * distance;
      final dy = -cos(angle) * distance - 30;
      return _EmojiParticle(
        dx: dx,
        dy: dy,
        startScale: 0.2 + rand.nextDouble() * 0.2,
        maxScale: 0.8 + rand.nextDouble() * 0.4,
        rotation: (rand.nextDouble() - 0.5) * 0.7,
        fontSize: 24 + rand.nextDouble() * 12,
        delay: rand.nextDouble() * 0.12,
      );
    });

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onComplete();
      }
    });

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final progress = _controller.value;
        return Stack(
          children: _particles.map((p) {
            final effectiveProgress = max(0.0, min(1.0, (progress - p.delay) / (1.0 - p.delay)));
            if (effectiveProgress <= 0) return const SizedBox.shrink();

            final curveValue = Curves.easeOutCubic.transform(effectiveProgress);
            final scaleCurve = Curves.elasticOut.transform(min(1.0, effectiveProgress * 2.2));
            final opacity = (1.0 - Curves.easeIn.transform(max(0.0, (effectiveProgress - 0.35) / 0.65))).clamp(0.0, 1.0);

            final wobble = sin(effectiveProgress * pi * 3.5) * 6;
            final currentDx = widget.from.dx + (p.dx * curveValue) + wobble;
            final currentDy = widget.from.dy + (p.dy * curveValue);
            final scale = (p.startScale + (p.maxScale - p.startScale) * scaleCurve).clamp(0.0, 2.5);

            return Positioned(
              left: currentDx - (p.fontSize / 2),
              top: currentDy - (p.fontSize / 2),
              child: Transform.rotate(
                angle: p.rotation * curveValue,
                child: Transform.scale(
                  scale: scale,
                  child: Opacity(
                    opacity: opacity,
                    child: Text(
                      widget.emoji,
                      style: TextStyle(
                        fontSize: p.fontSize,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class BouncingDotsIndicator extends StatefulWidget {
  const BouncingDotsIndicator({Key? key}) : super(key: key);

  @override
  State<BouncingDotsIndicator> createState() => _BouncingDotsIndicatorState();
}

class _BouncingDotsIndicatorState extends State<BouncingDotsIndicator> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final delay = index * 0.2;
            final double value = (sin((_controller.value * 2 * pi) - (delay * 2 * pi)) + 1) / 2;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              width: 5,
              height: 5 + (value * 4),
              decoration: BoxDecoration(
                color: const Color(0xFF0068FF).withOpacity(0.5 + (value * 0.5)),
                shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}

class BlinkingRedDot extends StatefulWidget {
  const BlinkingRedDot({Key? key}) : super(key: key);

  @override
  State<BlinkingRedDot> createState() => _BlinkingRedDotState();
}

class _BlinkingRedDotState extends State<BlinkingRedDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _controller,
      child: Container(
        width: 10,
        height: 10,
        decoration: const BoxDecoration(
          color: Colors.red,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

class VoiceBubbleWidget extends StatefulWidget {
  final String audioUrl;
  final bool isMe;
  const VoiceBubbleWidget({Key? key, required this.audioUrl, required this.isMe}) : super(key: key);

  @override
  State<VoiceBubbleWidget> createState() => _VoiceBubbleWidgetState();
}

class _VoiceBubbleWidgetState extends State<VoiceBubbleWidget> {
  late final audioplayers.AudioPlayer _player;
  bool _isPlaying = false;
  double _progress = 0.0;
  String _currentTimeStr = "0:00";
  Duration _totalDuration = Duration.zero;
  StreamSubscription? _positionSub;
  StreamSubscription? _durationSub;
  StreamSubscription? _stateSub;

  @override
  void initState() {
    super.initState();
    _player = audioplayers.AudioPlayer();
    _durationSub = _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _totalDuration = d);
    });
    _positionSub = _player.onPositionChanged.listen((pos) {
      if (!mounted) return;
      final totalMs = _totalDuration.inMilliseconds;
      setState(() {
        _progress = totalMs > 0 ? (pos.inMilliseconds / totalMs).clamp(0.0, 1.0) : 0.0;
        final sec = pos.inSeconds;
        _currentTimeStr = "${sec ~/ 60}:${(sec % 60).toString().padLeft(2, '0')}";
      });
    });
    _stateSub = _player.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _isPlaying = false;
          _progress = 0.0;
          _currentTimeStr = "0:00";
        });
      }
    });
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _durationSub?.cancel();
    _stateSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  void _togglePlay() async {
    if (_isPlaying) {
      await _player.pause();
      setState(() => _isPlaying = false);
    } else {
      await _player.play(audioplayers.UrlSource(widget.audioUrl));
      setState(() => _isPlaying = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 200),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: _togglePlay,
            child: CircleAvatar(
              radius: 16,
              backgroundColor: widget.isMe ? Colors.white : const Color(0xFF0068FF),
              child: Icon(
                _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: widget.isMe ? const Color(0xFF0068FF) : Colors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _progress,
                    minHeight: 4,
                    backgroundColor: (widget.isMe ? Colors.white : const Color(0xFF0068FF)).withOpacity(0.3),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      widget.isMe ? Colors.white : const Color(0xFF0068FF),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _currentTimeStr,
                  style: TextStyle(
                    color: widget.isMe ? Colors.white70 : const Color(0xFF65676B),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
