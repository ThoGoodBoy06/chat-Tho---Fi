import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:html' as html;
import '../models/models.dart';
import '../providers/chat_provider.dart';
import '../services/socket_service.dart';
import '../services/api_service.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ChatScreen({Key? key, required this.onLogout}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  int _currentTabIndex = 0; // 0: Tin nhắn, 1: Danh bạ, 2: Tin tức, 3: Trợ lý AI, 4: Cá nhân
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  bool _isTyping = false;
  String _searchQuery = '';
  bool _isSearchOpen = false;
  final _searchController = TextEditingController();
  StreamSubscription? _incomingCallSub;

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<ChatProvider>(context, listen: false);
      provider.fetchConversations();
      provider.onNewMessageReceived = _scrollToBottom;
      provider.onConversationSelected = _jumpToBottom;
      _initCallListeners();
    });
    _textController.addListener(_onTextChanged);
    _scrollController.addListener(_onScroll);
  }

  void _initCallListeners() {
    _incomingCallSub?.cancel();
    _incomingCallSub = SocketService.onIncomingCall.listen((data) {
      if (mounted) {
        _handleIncomingCall(data);
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
    _debounceTimer?.cancel();
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
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _FlyingEmojiWidget(
        from: startPosition,
        emoji: emoji,
        onComplete: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
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
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, anim1, anim2) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          body: Stack(
            children: [
              // Nền làm mờ toàn màn hình & Chạm để đóng
              GestureDetector(
                onTap: () => Navigator.pop(context),
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
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                                final emojiKey = GlobalKey();
                                return GestureDetector(
                                  onTap: () {
                                    final renderBox = emojiKey.currentContext?.findRenderObject() as RenderBox?;
                                    if (renderBox != null) {
                                      final position = renderBox.localToGlobal(Offset.zero);
                                      final center = Offset(
                                        position.dx + renderBox.size.width / 2,
                                        position.dy + renderBox.size.height / 2,
                                      );
                                      _showFlyingEmoji(context, center, emoji);
                                    }
                                    Navigator.pop(context);
                                    provider.reactToMessage(msg.id, emoji);
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 5),
                                    child: Text(emoji, key: emojiKey, style: const TextStyle(fontSize: 26)),
                                  ),
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
                              ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                title: const Text('Xóa tin nhắn', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFFEF4444))),
                                trailing: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 20),
                                onTap: () {
                                  Navigator.pop(context);
                                  provider.deleteMessage(msg.id);
                                },
                              ),
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

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 900;

    return Scaffold(
      backgroundColor: const Color(0xFFF0F2F5),
      body: SafeArea(
        child: Row(
          children: [
            if (isDesktop) _buildDesktopNavRail(),
            Expanded(
              child: _buildBodyForCurrentTab(provider, isDesktop),
            ),
          ],
        ),
      ),
      bottomNavigationBar: (!isDesktop && !(_currentTabIndex == 0 && provider.selectedConversation != null))
          ? _buildMobileBottomBar()
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

    return Container(
      width: 76,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
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
                        color: isSelected ? const Color(0xFFEBF3FF) : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        navItems[index]['icon'] as IconData,
                        color: isSelected ? const Color(0xFF0068FF) : const Color(0xFF64748B),
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
    final filteredList = provider.conversations.where((conv) {
      if (provider.showUnreadOnly && (conv.unreadCount ?? 0) == 0) return false;
      if (_searchQuery.isNotEmpty) {
        return conv.name.toLowerCase().contains(_searchQuery.toLowerCase());
      }
      return true;
    }).toList();

    final totalUnreadCount = provider.conversations.fold<int>(0, (sum, conv) => sum + (conv.unreadCount ?? 0));

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // 1. Top Navigation Bar (Height 56px, iOS style)
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0x0F000000), width: 1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Left: Bell Icon
                IconButton(
                  icon: const Icon(Icons.notifications_none_rounded, color: Color(0xFF000000), size: 24),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Không có thông báo mới nào'), duration: Duration(seconds: 2)),
                    );
                  },
                  tooltip: 'Thông báo',
                ),
                // Center: Title "Chat Tho-Fi" (18px, Bold, #007AFF)
                const Text(
                  'Chat Tho-Fi',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF007AFF),
                  ),
                ),
                // Right: Glass Icon in Container 36x36px, border Color(0x1F000000), radius 10px
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _isSearchOpen = !_isSearchOpen;
                      if (!_isSearchOpen) {
                        _searchQuery = '';
                        _searchController.clear();
                      }
                    });
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _isSearchOpen ? const Color(0x0F007AFF) : Colors.transparent,
                      border: Border.all(color: const Color(0x1F000000), width: 1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      _isSearchOpen ? Icons.close_rounded : Icons.search_rounded,
                      color: const Color(0xFF000000),
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search Field (If search icon toggled)
          if (_isSearchOpen)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0x0F000000), width: 1)),
              ),
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFF2F2F7),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: const TextStyle(fontSize: 14, color: Colors.black),
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm cuộc trò chuyện...',
                    hintStyle: const TextStyle(color: Color(0xFF8E8E93), fontSize: 14),
                    prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF8E8E93), size: 18),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? GestureDetector(
                            onTap: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                            child: const Icon(Icons.cancel_rounded, color: Color(0xFF8E8E93), size: 16),
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
                const Text(
                  'Tin nhắn',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF000000),
                  ),
                ),
                Row(
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
                    GestureDetector(
                      onTap: () => _showNewChatDialog(provider),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0x0F007AFF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.add_rounded, size: 16, color: Color(0xFF007AFF)),
                            SizedBox(width: 2),
                            Text(
                              'Mới',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF007AFF)),
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

          // Filter Badges (Tất cả / Chưa đọc)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            margin: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => provider.setShowUnreadOnly(false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: !provider.showUnreadOnly ? const Color(0xFF007AFF) : const Color(0xFFF2F2F7),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Tất cả',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: !provider.showUnreadOnly ? Colors.white : const Color(0xFF8E8E93),
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
                      color: provider.showUnreadOnly ? const Color(0xFF007AFF) : const Color(0xFFF2F2F7),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Chưa đọc',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: provider.showUnreadOnly ? Colors.white : const Color(0xFF8E8E93),
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
                    ? const Center(
                        child: Text(
                          'Không có cuộc trò chuyện nào',
                          style: TextStyle(color: Color(0xFF8E8E93), fontSize: 14),
                        ),
                      )
                    : ListView.builder(
                        itemCount: filteredList.length,
                        itemBuilder: (context, index) {
                          final conv = filteredList[index];
                          final isSelected = conv.id == provider.selectedConversationId;
                          final unreadCount = conv.unreadCount ?? 0;
                          final hasUnread = unreadCount > 0;

                          return InkWell(
                            onTap: () => provider.selectConversation(conv),
                            hoverColor: const Color(0x05000000),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              decoration: BoxDecoration(
                                color: isSelected ? const Color(0x0D007AFF) : Colors.white,
                                border: const Border(
                                  bottom: BorderSide(color: Color(0x0F000000), width: 1),
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
                                              border: Border.all(color: Colors.white, width: 2),
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
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                conv.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  color: const Color(0xFF000000),
                                                  fontSize: 15,
                                                  fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            if (conv.lastMessageAt != null)
                                              Text(
                                                _formatMessengerTime(conv.lastMessageAt!),
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: hasUnread ? const Color(0xFF007AFF) : const Color(0xFF8E8E93),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                conv.lastMessage ?? 'Bắt đầu cuộc trò chuyện',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: hasUnread ? const Color(0xFF3C3C43) : const Color(0xFF8E8E93),
                                                ),
                                              ),
                                            ),
                                            if (hasUnread) ...[
                                              const SizedBox(width: 8),
                                              Container(
                                                constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFF007AFF),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: Center(
                                                  child: Text(
                                                    '$unreadCount',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ],
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

  Widget _buildEmptyChatPlaceholder() {
    return Container(
      color: Colors.white,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.chat_bubble_outline_rounded, size: 72, color: Color(0xFF0068FF)),
            SizedBox(height: 16),
            Text(
              'Chọn một cuộc trò chuyện để bắt đầu nhắn tin',
              style: TextStyle(color: Color(0xFF65676B), fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageStatusIndicator(MessageModel msg) {
    if (msg.isRead) {
      return const Icon(Icons.done_all, color: Color(0xFF0068FF), size: 14);
    }
    return const Icon(Icons.done_all, color: Color(0xFF65676B), size: 14);
  }

  Widget _buildChatWindow(ChatProvider provider, {required bool isDesktop}) {
    final conv = provider.selectedConversation;
    if (conv == null) return _buildEmptyChatPlaceholder();

    const primaryColor = Color(0xFF0068FF);

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // A. Header Chat (56px, white, shadow) - Filled Call & Video icons matching Messenger
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
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
                CircleAvatar(
                  radius: 19,
                  backgroundColor: primaryColor,
                  backgroundImage: (conv.avatar != null && conv.avatar!.isNotEmpty)
                      ? NetworkImage(conv.avatar!)
                      : null,
                  child: (conv.avatar == null || conv.avatar!.isEmpty)
                      ? Text(
                          conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        conv.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF050505),
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        conv.isOnline == true ? 'Đang hoạt động' : 'Hoạt động gần đây',
                        style: const TextStyle(
                          color: Color(0xFF8A8D91),
                          fontSize: 12,
                        ),
                      ),
                    ],
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
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    itemCount: provider.messages.length,
                    itemBuilder: (context, index) {
                      final msg = provider.messages[index];
                      final isMe = msg.senderId == provider.currentUser?.id;
                      final showTime = index == 0 || (index > 0 && msg.createdAt.difference(provider.messages[index - 1].createdAt).inMinutes > 30);

                      if (msg.type == 'system') {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Center(
                            child: Text(
                              msg.content,
                              style: const TextStyle(color: Color(0xFF8A8D91), fontSize: 12, fontStyle: FontStyle.italic),
                            ),
                          ),
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
                                              Container(
                                                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                                                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
                                                decoration: BoxDecoration(
                                                  color: msg.isRecalled
                                                      ? Colors.transparent
                                                      : (isMe ? null : const Color(0xFFE4E6EB)),
                                                  gradient: (isMe && !msg.isRecalled)
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
                                                          Text(
                                                            msg.content,
                                                            style: TextStyle(
                                                              color: isMe ? Colors.white : const Color(0xFF050505),
                                                              fontSize: 15,
                                                              height: 1.3,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
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
                                            _buildMessageStatusIndicator(msg),
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
                  ),
          ),

          // Typing Indicator Widget
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
                    CircleAvatar(
                      radius: 12,
                      backgroundColor: primaryColor,
                      child: Text(typingUser[0].toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F2F5),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const BouncingDotsIndicator(),
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
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE4E6EB))),
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
                            style: const TextStyle(color: Color(0xFF65676B), fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF65676B)),
                      onPressed: () => chatProv.setReplyingToMessage(null),
                    ),
                  ],
                ),
              );
            },
          ),

          // D. Input Area: Filled icons matching user reference images (+, camera, gallery, mic, pill Aa + emoji, send/like)
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE4E6EB))),
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
                            color: const Color(0xFFFFF0F5),
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
                              const Text('Đang ghi âm...', style: TextStyle(color: Colors.grey, fontSize: 12)),
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
                      IconButton(
                        icon: const Icon(Icons.add_circle, color: primaryColor, size: 26),
                        onPressed: () => _showMediaUploadOptions(provider),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36),
                      ),
                      IconButton(
                        icon: const Icon(Icons.camera_alt_rounded, color: primaryColor, size: 24),
                        onPressed: () => _captureCameraImage(provider),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36),
                      ),
                      IconButton(
                        icon: const Icon(Icons.image_rounded, color: primaryColor, size: 24),
                        onPressed: () => _pickAndUploadImage(provider),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36),
                      ),
                      IconButton(
                        icon: const Icon(Icons.mic_rounded, color: primaryColor, size: 24),
                        onPressed: () => _handleVoiceRecording(provider),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36),
                      ),
                      Expanded(
                        child: Container(
                          height: 38,
                          padding: const EdgeInsets.only(left: 14, right: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0F2F5),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _textController,
                                  style: const TextStyle(color: Color(0xFF050505), fontSize: 15),
                                  decoration: const InputDecoration(
                                    hintText: 'Aa',
                                    hintStyle: TextStyle(color: Color(0xFF8A8D91), fontSize: 15),
                                    border: InputBorder.none,
                                    isDense: true,
                                    contentPadding: EdgeInsets.symmetric(vertical: 8),
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
        ],
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

  // TAB 1: Danh bạ
  Widget _buildContactsTab(ChatProvider provider) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.people_alt_rounded, color: Color(0xFF007AFF), size: 28),
              const SizedBox(width: 12),
              const Text(
                'Danh Bạ Người Dùng',
                style: TextStyle(color: Color(0xFF000000), fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => _showNewChatDialog(provider),
                icon: const Icon(Icons.person_add_rounded, size: 18),
                label: const Text('Tìm Mới'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF007AFF),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
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
                    child: Text('Chưa có người dùng nào khác trong hệ thống', style: TextStyle(color: Color(0xFF8E8E93), fontSize: 14)),
                  );
                }

                return ListView.builder(
                  itemCount: filteredUsers.length,
                  itemBuilder: (context, index) {
                    final u = filteredUsers[index];
                    final name = u['fullName'] ?? u['username'] ?? 'Người dùng';
                    final uid = u['id']?.toString() ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x0F000000)),
                      ),
                      child: Row(
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
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, style: const TextStyle(color: Color(0xFF000000), fontWeight: FontWeight.bold, fontSize: 16)),
                                const SizedBox(height: 2),
                                Text('@${u['username'] ?? ''}', style: const TextStyle(color: Color(0xFF8E8E93), fontSize: 13)),
                              ],
                            ),
                          ),
                          ElevatedButton.icon(
                            onPressed: () async {
                              setState(() => _currentTabIndex = 0);
                              await provider.startPrivateChat(uid);
                            },
                            icon: const Icon(Icons.chat_bubble_rounded, size: 16),
                            label: const Text('Nhắn tin'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF007AFF),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
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
    final newsList = [
      {'title': 'OpenAI ra mắt mô hình AI mới nâng cấp khả năng suy luận vượt trội', 'time': '10 phút trước', 'category': 'Trí tuệ nhân tạo'},
      {'title': 'Google Gemini cập nhật tính năng phân tích video và âm thanh trực tiếp', 'time': '1 giờ trước', 'category': 'Google AI'},
      {'title': 'Meta phát hành Llama 3 mã nguồn mở đạt hiệu năng xuất sắc', 'time': '3 giờ trước', 'category': 'Meta AI'},
    ];

    return Container(
      color: const Color(0xFFF0F2F5),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.newspaper_rounded, color: Color(0xFF0068FF), size: 28),
              SizedBox(width: 12),
              Text(
                'Tin Tức Công Nghệ AI',
                style: TextStyle(color: Color(0xFF0F172A), fontSize: 22, fontWeight: FontWeight.bold),
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
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: const Color(0xFFEBF3FF), borderRadius: BorderRadius.circular(8)),
                            child: Text(item['category']!, style: const TextStyle(color: Color(0xFF0068FF), fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                          const Spacer(),
                          Text(item['time']!, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(item['title']!, style: const TextStyle(color: Color(0xFF0F172A), fontSize: 17, fontWeight: FontWeight.bold)),
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
    return Container(
      color: const Color(0xFFF0F2F5),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(18),
            color: Colors.white,
            child: Row(
              children: const [
                Icon(Icons.smart_toy_rounded, color: Color(0xFF0068FF), size: 28),
                SizedBox(width: 12),
                Text('Trợ Lý AI Chat Tho-Fi', style: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.bold)),
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
                      color: isUser ? const Color(0xFF0068FF) : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
                    ),
                    child: Text(msg['content']!, style: TextStyle(color: isUser ? Colors.white : const Color(0xFF0F172A), fontSize: 15, height: 1.3)),
                  ),
                );
              },
            ),
          ),

          // Input
          Container(
            padding: const EdgeInsets.all(14),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _aiTextController,
                    style: const TextStyle(color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      hintText: 'Hỏi Trợ lý AI bất kỳ điều gì...',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF1F5F9),
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
    final user = provider.currentUser;

    return Container(
      color: const Color(0xFFF0F2F5),
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 480),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 20)],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 46,
                backgroundColor: const Color(0xFF0068FF),
                child: Text(
                  (user?.fullName ?? 'U')[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                user?.fullName ?? 'Người dùng',
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                '@${user?.username ?? "user"}',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
              ),
              const SizedBox(height: 24),
              const Divider(color: Color(0xFFE2E8F0)),
              ListTile(
                leading: const Icon(Icons.person_outline_rounded, color: Color(0xFF0068FF)),
                title: const Text('Thông tin cá nhân', style: TextStyle(color: Color(0xFF0F172A))),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF94A3B8), size: 16),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.lock_outline_rounded, color: Color(0xFF0068FF)),
                title: const Text('Đổi mật khẩu', style: TextStyle(color: Color(0xFF0F172A))),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF94A3B8), size: 16),
                onTap: () {},
              ),
              ListTile(
                leading: const Icon(Icons.light_mode_outlined, color: Color(0xFF0068FF)),
                title: const Text('Giao diện Sáng (White Mode)', style: TextStyle(color: Color(0xFF0F172A))),
                trailing: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
                onTap: () {},
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: widget.onLogout,
                  icon: const Icon(Icons.logout_rounded, color: Colors.white),
                  label: const Text('Đăng Xuất', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) {
          if (reader.result is Uint8List) {
            final bytes = reader.result as Uint8List;
            ApiService.uploadMedia(conv.id, bytes, file.name, file.type);
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
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) {
          if (reader.result is Uint8List) {
            final bytes = reader.result as Uint8List;
            ApiService.uploadMedia(conv.id, bytes, file.name, file.type);
          }
        });
      }
    });
  }

  void _showGifPicker(ChatProvider provider) {
    provider.sendMessage('https://media.giphy.com/media/l0HlHJGHe3yAMhdQY/giphy.gif', type: 'image');
  }

  void _toggleEmojiPicker() {
    _textController.text = '${_textController.text}😊';
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
    _mediaStream?.getTracks().forEach((track) => track.stop());

    setState(() {
      _isRecording = false;
      _recordingSeconds = 0;
    });
  }

  void _cancelRecording() {
    _recordingTimer?.cancel();
    try {
      _mediaRecorder?.stop();
      _mediaStream?.getTracks().forEach((track) => track.stop());
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
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(conv.name),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(radius: 36, backgroundColor: const Color(0xFF0068FF), child: Text(conv.name[0].toUpperCase(), style: const TextStyle(fontSize: 28, color: Colors.white))),
              const SizedBox(height: 12),
              Text(conv.isOnline == true ? 'Trạng thái: Đang hoạt động' : 'Trạng thái: Hoạt động gần đây'),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Đóng')),
          ],
        );
      },
    );
  }

  Widget _buildMessageBubbleContent(MessageModel msg, bool isMe) {
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

    return Text(
      content,
      style: TextStyle(color: isMe ? Colors.white : const Color(0xFF0F172A), fontSize: 15, height: 1.3),
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
            track.stop();
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

                localStream = await html.window.navigator.mediaDevices?.getUserMedia({
                  'audio': true,
                  'video': isVideo ? {'width': 1280, 'height': 720, 'facingMode': 'user'} : false,
                });

                if (isVideo && localStream != null) {
                  final localVideo = html.document.getElementById('localVideoPlayer') as html.VideoElement?;
                  if (localVideo != null) {
                    localVideo.srcObject = localStream;
                    localVideo.style.display = 'block';
                    localVideo.play().catchError((e) {
                      Future.delayed(const Duration(milliseconds: 300), () {
                        localVideo.play().catchError((_) {});
                      });
                    });
                  }
                }

                if (localStream != null && pc != null) {
                  try {
                    pc!.addStream(localStream!);
                  } catch (_) {}
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
                      final remoteVideo = html.document.getElementById('remoteVideoPlayer') as html.VideoElement?;
                      if (remoteVideo != null) {
                        remoteVideo.srcObject = event.stream!;
                        remoteVideo.style.display = 'block';
                        remoteVideo.play().catchError((e) {
                          Future.delayed(const Duration(milliseconds: 300), () {
                            remoteVideo.play().catchError((_) {});
                          });
                        });
                      }
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
                      final remoteVideo = html.document.getElementById('remoteVideoPlayer') as html.VideoElement?;
                      if (remoteVideo != null) {
                        remoteVideo.srcObject = stream;
                        remoteVideo.style.display = 'block';
                        remoteVideo.play().catchError((e) {
                          Future.delayed(const Duration(milliseconds: 300), () {
                            remoteVideo.play().catchError((_) {});
                          });
                        });
                      }
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
    final navItems = [
      {'icon': Icons.chat_bubble_rounded, 'label': 'Tin nhắn'},
      {'icon': Icons.people_alt_rounded, 'label': 'Danh bạ'},
      {'icon': Icons.newspaper_rounded, 'label': 'Tin tức'},
      {'icon': Icons.smart_toy_rounded, 'label': 'Trợ lý AI'},
      {'icon': Icons.account_circle_rounded, 'label': 'Cá nhân'},
    ];

    return Container(
      height: 84,
      decoration: const BoxDecoration(
        color: Color(0xECFFFFFF),
        border: Border(top: BorderSide(color: Color(0x14000000), width: 1)),
      ),
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Row(
            children: List.generate(navItems.length, (index) {
              final isSelected = _currentTabIndex == index;
              final item = navItems[index];
              return Expanded(
                child: InkWell(
                  onTap: () => setState(() => _currentTabIndex = index),
                  splashColor: Colors.transparent,
                  highlightColor: Colors.transparent,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.start,
                    children: [
                      // Top indicator line 20x2px #007AFF
                      Container(
                        width: 20,
                        height: 2,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF007AFF) : Colors.transparent,
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                      Icon(
                        item['icon'] as IconData,
                        size: 24,
                        color: isSelected ? const Color(0xFF007AFF) : const Color(0xFF8E8E93),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item['label'] as String,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? const Color(0xFF007AFF) : const Color(0xFF8E8E93),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
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
  late Animation<Offset> _positionAnimation;
  late Animation<double> _opacityAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );

    _positionAnimation = Tween<Offset>(
      begin: widget.from,
      end: widget.from - const Offset(0, 140),
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _opacityAnimation = Tween<double>(
      begin: 1.0,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.5, 1.0, curve: Curves.easeOut),
    ));

    _scaleAnimation = Tween<double>(
      begin: 0.6,
      end: 1.3,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.3, curve: Curves.easeOutBack),
    ));

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
        return Positioned(
          left: _positionAnimation.value.dx,
          top: _positionAnimation.value.dy,
          child: Transform.scale(
            scale: _scaleAnimation.value,
            child: Opacity(
              opacity: _opacityAnimation.value,
              child: Text(widget.emoji, style: const TextStyle(fontSize: 36)),
            ),
          ),
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
  html.AudioElement? _audioElement;
  bool _isPlaying = false;
  double _progress = 0.0;
  String _currentTimeStr = "0:00";

  @override
  void initState() {
    super.initState();
    _audioElement = html.AudioElement(widget.audioUrl);
    _audioElement?.onTimeUpdate.listen((_) {
      if (_audioElement != null && _audioElement!.duration > 0 && mounted) {
        setState(() {
          _progress = (_audioElement!.currentTime / _audioElement!.duration).clamp(0.0, 1.0);
          final sec = _audioElement!.currentTime.toInt();
          _currentTimeStr = "${sec ~/ 60}:${(sec % 60).toString().padLeft(2, '0')}";
        });
      }
    });
    _audioElement?.onEnded.listen((_) {
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
    _audioElement?.pause();
    _audioElement = null;
    super.dispose();
  }

  void _togglePlay() {
    if (_audioElement == null) return;
    if (_isPlaying) {
      _audioElement!.pause();
      setState(() => _isPlaying = false);
    } else {
      _audioElement!.play();
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
