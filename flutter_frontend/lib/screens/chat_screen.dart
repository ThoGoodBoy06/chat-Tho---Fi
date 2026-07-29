import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:html' as html;
import '../models/models.dart';
import '../providers/chat_provider.dart';
import '../services/socket_service.dart';

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
  StreamSubscription? _incomingCallSub;

  // AI Assistant Chat state
  final List<Map<String, String>> _aiMessages = [
    {'sender': 'ai', 'content': 'Xin chào! Tôi là Trợ lý AI Chat Tho-Fi. Tôi có thể giúp gì cho bạn hôm nay?'}
  ];
  final _aiTextController = TextEditingController();

  bool _showScrollToBottomButton = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<ChatProvider>(context, listen: false);
      provider.fetchConversations();
      provider.onNewMessageReceived = _scrollToBottom;
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
    final typing = _textController.text.trim().isNotEmpty;
    if (typing != _isTyping) {
      setState(() => _isTyping = typing);
    }
  }

  @override
  void dispose() {
    // Hủy callback auto-scroll
    try {
      Provider.of<ChatProvider>(context, listen: false).onNewMessageReceived = null;
    } catch (_) {}
    _textController.removeListener(_onTextChanged);
    _scrollController.removeListener(_onScroll);
    _textController.dispose();
    _aiTextController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  int _lastMessageCount = 0;

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  void _handleSend(ChatProvider provider) {
    final text = _textController.text.trim();
    final sendText = text.isEmpty ? '👍' : text;
    _textController.clear();
    provider.sendMessage(sendText);
    _scrollToBottom();
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
    final isMobile = MediaQuery.of(context).size.width < 768;

    // Auto-scroll giờ được xử lý qua callback onNewMessageReceived trong ChatProvider

    return Scaffold(
      backgroundColor: const Color(0xFFF0F2F5),
      body: SafeArea(
        child: Row(
          children: [
            // Left App Navigation Drawer (Desktop/Tablet)
            if (!isMobile) _buildDesktopNavRail(),

            // Main View Switcher based on Selected Tab
            Expanded(
              child: _buildBodyForCurrentTab(provider, isMobile),
            ),
          ],
        ),
      ),
      bottomNavigationBar: (isMobile && !(_currentTabIndex == 0 && provider.selectedConversation != null))
          ? _buildMobileBottomBar()
          : null,
    );
  }

  Widget _buildBodyForCurrentTab(ChatProvider provider, bool isMobile) {
    switch (_currentTabIndex) {
      case 0: // Tin nhắn
        return Row(
          children: [
            if (!isMobile || provider.selectedConversation == null)
              SizedBox(
                width: isMobile ? MediaQuery.of(context).size.width : 340,
                child: _buildConversationsList(provider, isMobile),
              ),
            if (!isMobile || provider.selectedConversation != null)
              Expanded(
                child: provider.selectedConversation == null
                    ? _buildEmptyChatState()
                    : _buildActiveChatArea(provider, isMobile),
              ),
          ],
        );
      case 1: // Danh bạ
        return _buildContactsTab(provider);
      case 2: // Tin tức AI
        return _buildNewsTab();
      case 3: // Trợ lý AI
        return _buildAiAssistantTab();
      case 4: // Cá nhân
        return _buildProfileTab(provider);
      default:
        return _buildConversationsList(provider, isMobile);
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

  Widget _buildConversationsList(ChatProvider provider, bool isMobile) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      ),
      child: Column(
        children: [
          // Header & Search
          Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Đoạn chat', style: TextStyle(color: Color(0xFF0F172A), fontSize: 22, fontWeight: FontWeight.bold)),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.camera_alt_outlined, color: Color(0xFF0068FF), size: 22),
                          onPressed: () {},
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit_square, color: Color(0xFF0068FF), size: 22),
                          onPressed: () {},
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
                          decoration: const InputDecoration(
                            hintText: 'Tìm kiếm trên Chat Tho-Fi...',
                            hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Conversations List
          Expanded(
            child: provider.isLoadingConversations
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
                : provider.conversations.isEmpty
                    ? const Center(child: Text('Chưa có cuộc trò chuyện nào', style: TextStyle(color: Color(0xFF94A3B8))))
                    : ListView.builder(
                        itemCount: provider.conversations.length,
                        itemBuilder: (context, index) {
                          final conv = provider.conversations[index];
                          final isSelected = provider.selectedConversation?.id == conv.id;
                          return ListTile(
                            selected: isSelected,
                            selectedTileColor: const Color(0xFFEBF3FF),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            leading: Stack(
                              children: [
                                CircleAvatar(
                                  radius: 26,
                                  backgroundColor: const Color(0xFF0068FF),
                                  child: Text(
                                    conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white, width: 2),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            title: Text(
                              conv.name,
                              style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            subtitle: Text(
                              conv.lastMessage ?? 'Bắt đầu trò chuyện!',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: isSelected ? const Color(0xFF0068FF) : const Color(0xFF64748B), fontSize: 13),
                            ),
                            onTap: () => provider.selectConversation(conv),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyChatState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, 4)),
              ],
            ),
            child: const Icon(Icons.chat_bubble_outline_rounded, size: 64, color: Color(0xFF0068FF)),
          ),
          const SizedBox(height: 20),
          const Text(
            'Chào mừng đến với Chat Tho-Fi',
            style: TextStyle(color: Color(0xFF0F172A), fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Chọn một cuộc trò chuyện để bắt đầu nhắn tin ngay',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveChatArea(ChatProvider provider, bool isMobile) {
    final conv = provider.selectedConversation!;

    return Column(
      children: [
        // Zalo Top Header Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              if (isMobile)
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0068FF), size: 20),
                  onPressed: () => provider.deselectConversation(),
                ),
              Stack(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: const Color(0xFF0068FF),
                    child: Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
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
                      conv.name,
                      style: const TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const Text(
                      'Đang hoạt động',
                      style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.phone_rounded, color: Color(0xFF0068FF)),
                onPressed: () => _startCall(context, provider, isVideo: false),
              ),
              IconButton(
                icon: const Icon(Icons.videocam_rounded, color: Color(0xFF0068FF)),
                onPressed: () => _startCall(context, provider, isVideo: true),
              ),
              IconButton(icon: const Icon(Icons.info_outline_rounded, color: Color(0xFF0068FF)), onPressed: () {}),
            ],
          ),
        ),

        // Messages List
        Expanded(
          child: provider.isLoadingMessages
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
              : Stack(
                  children: [
                    ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      itemCount: provider.messages.length,
                      itemBuilder: (context, index) {
                        final msg = provider.messages[index];
                        final isMe = msg.senderId == provider.currentUser?.id;

                        if (msg.type == 'system') {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.04),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  msg.content,
                                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 12, fontStyle: FontStyle.italic),
                                ),
                              ),
                            ),
                          );
                        }

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              if (!isMe) ...[
                                CircleAvatar(
                                  radius: 14,
                                  backgroundColor: const Color(0xFF0068FF),
                                  child: Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10, color: Colors.white)),
                                ),
                                const SizedBox(width: 8),
                              ],
                              Flexible(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                                  decoration: BoxDecoration(
                                    color: isMe ? const Color(0xFF0068FF) : Colors.white,
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(18),
                                      topRight: const Radius.circular(18),
                                      bottomLeft: Radius.circular(isMe ? 18 : 4),
                                      bottomRight: Radius.circular(isMe ? 4 : 18),
                                    ),
                                    border: isMe ? null : Border.all(color: const Color(0xFFE2E8F0)),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.04),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      _buildMessageBubbleContent(msg, isMe),
                                      const SizedBox(height: 4),
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            _formatTime(msg.createdAt),
                                            style: TextStyle(color: isMe ? Colors.white70 : const Color(0xFF94A3B8), fontSize: 10),
                                          ),
                                          if (isMe) ...[
                                            const SizedBox(width: 4),
                                            Icon(
                                              msg.isRead ? Icons.done_all_rounded : Icons.done_rounded,
                                              size: 14,
                                              color: msg.isRead ? Colors.cyanAccent : Colors.white60,
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    if (_showScrollToBottomButton)
                      Positioned(
                        right: 16,
                        bottom: 16,
                        child: Material(
                          color: Colors.white,
                          elevation: 6,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _scrollToBottom,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              child: const Icon(
                                Icons.arrow_downward_rounded,
                                color: Color(0xFF0068FF),
                                size: 22,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
        ),

        // Messenger Input Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF0068FF), size: 24), onPressed: () {}),
              IconButton(icon: const Icon(Icons.camera_alt_outlined, color: Color(0xFF0068FF), size: 24), onPressed: () {}),
              IconButton(icon: const Icon(Icons.photo_outlined, color: Color(0xFF0068FF), size: 24), onPressed: () {}),
              IconButton(icon: const Icon(Icons.mic_none_rounded, color: Color(0xFF0068FF), size: 24), onPressed: () {}),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
                          decoration: const InputDecoration(
                            hintText: 'Aa',
                            hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 15),
                            border: InputBorder.none,
                          ),
                          onSubmitted: (_) => _handleSend(provider),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.sentiment_satisfied_alt_rounded, color: Color(0xFF0068FF)),
                        onPressed: () {},
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => _handleSend(provider),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0068FF),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isTyping ? Icons.send_rounded : Icons.thumb_up_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // TAB 1: Danh bạ
  Widget _buildContactsTab(ChatProvider provider) {
    return Container(
      color: const Color(0xFFF0F2F5),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.people_alt_rounded, color: Color(0xFF0068FF), size: 28),
              const SizedBox(width: 12),
              const Text(
                'Danh Bạ Bạn Bè',
                style: TextStyle(color: Color(0xFF0F172A), fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.person_add_rounded, size: 18),
                label: const Text('Thêm Bạn'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0068FF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Expanded(
            child: ListView.builder(
              itemCount: provider.conversations.length,
              itemBuilder: (context, index) {
                final conv = provider.conversations[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: const Color(0xFF0068FF),
                        child: Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white)),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(conv.name, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16)),
                            const SizedBox(height: 4),
                            const Text('Tài khoản đã xác thực', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                          ],
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () {
                          setState(() => _currentTabIndex = 0);
                          provider.selectConversation(conv);
                        },
                        icon: const Icon(Icons.chat_bubble_rounded, size: 16),
                        label: const Text('Nhắn tin'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF1F5F9),
                          foregroundColor: const Color(0xFF0F172A),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
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
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isMe ? Colors.white.withOpacity(0.2) : const Color(0xFF0068FF).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.play_arrow_rounded, color: isMe ? Colors.white : const Color(0xFF0068FF), size: 22),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Tin nhắn thoại',
                  style: TextStyle(
                    color: isMe ? Colors.white : const Color(0xFF0F172A),
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Bấm để nghe',
                  style: TextStyle(
                    color: isMe ? Colors.white70 : const Color(0xFF64748B),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      );
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

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        autoRejectTimer = Timer(const Duration(seconds: 30), () {
          SocketService.socket?.emit('reject_call', {
            'callerId': callerId,
            'callType': callType,
          });
          if (Navigator.of(dialogContext).canPop()) {
            Navigator.of(dialogContext).pop();
          }
        });

        return Dialog(
          backgroundColor: const Color(0xFF0F172A),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 48,
                  backgroundColor: const Color(0xFF0068FF),
                  child: Text(
                    callerName.isNotEmpty ? callerName[0].toUpperCase() : 'U',
                    style: const TextStyle(fontSize: 36, color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  callerName,
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isVideo ? Icons.videocam_rounded : Icons.phone_rounded,
                      color: const Color(0xFF10B981),
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Cuộc gọi ${isVideo ? "Video" : "Thoại"} đến...',
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                      icon: const Icon(Icons.call_end_rounded, color: Colors.white),
                      label: const Text('TỪ CHỐI', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      onPressed: () {
                        autoRejectTimer?.cancel();
                        SocketService.socket?.emit('reject_call', {
                          'callerId': callerId,
                          'callType': callType,
                        });
                        Navigator.of(dialogContext).pop();
                      },
                    ),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                      ),
                      icon: const Icon(Icons.call_rounded, color: Colors.white),
                      label: const Text('TRẢ LỜI', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      onPressed: () {
                        autoRejectTimer?.cancel();
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
                  ],
                ),
              ],
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
    String callStatus = isCaller ? 'Đang gọi...' : 'Đang đàm thoại';

    StreamSubscription? acceptSub;
    StreamSubscription? rejectSub;
    StreamSubscription? endSub;
    StreamSubscription? signalSub;
    html.RtcPeerConnection? pc;
    html.MediaStream? localStream;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> initWebRTC() async {
              if (!kIsWeb) return;
              try {
                final config = {
                  'iceServers': [
                    {'urls': 'stun:stun.l.google.com:19302'}
                  ]
                };
                pc = await html.RtcPeerConnection(config);

                localStream = await html.window.navigator.mediaDevices?.getUserMedia({
                  'audio': true,
                  'video': isVideo,
                });

                if (localStream != null && pc != null) {
                  for (var track in localStream!.getTracks()) {
                    pc!.addTrack(track, localStream!);
                  }
                }

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

                if (isCaller) {
                  final offer = await pc!.createOffer();
                  await pc!.setLocalDescription({'type': offer.type, 'sdp': offer.sdp});
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
                if (Navigator.of(dialogContext).canPop()) {
                  Navigator.of(dialogContext).pop();
                }
              });
            });

            endSub ??= SocketService.onCallEnded.listen((_) {
              if (Navigator.of(dialogContext).canPop()) {
                Navigator.of(dialogContext).pop();
              }
            });

            signalSub ??= SocketService.onWebrtcSignal.listen((data) async {
              final signal = data['signal'];
              if (signal == null || pc == null) return;
              try {
                final type = signal['type']?.toString();
                if (type == 'offer') {
                  await pc!.setRemoteDescription({'type': 'offer', 'sdp': signal['sdp']});
                  final answer = await pc!.createAnswer();
                  await pc!.setLocalDescription({'type': answer.type, 'sdp': answer.sdp});
                  SocketService.socket?.emit('webrtc_signal', {
                    'connectedUserId': targetUserId,
                    'signal': {
                      'type': 'answer',
                      'sdp': answer.sdp,
                    }
                  });
                } else if (type == 'answer') {
                  await pc!.setRemoteDescription({'type': 'answer', 'sdp': signal['sdp']});
                } else if (type == 'candidate') {
                  await pc!.addIceCandidate({
                    'candidate': signal['candidate'],
                    'sdpMid': signal['sdpMid'],
                    'sdpMLineIndex': signal['sdpMLineIndex'],
                  });
                }
              } catch (e) {
                print('⚠️ WebRTC Signal Handling Error: $e');
              }
            });

            if (!isCaller && pc == null) {
              initWebRTC();
            }

            return WillPopScope(
              onWillPop: () async => false,
              child: Dialog(
                backgroundColor: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 48,
                        backgroundColor: const Color(0xFF0068FF),
                        child: Text(
                          partnerName.isNotEmpty ? partnerName[0].toUpperCase() : 'U',
                          style: const TextStyle(fontSize: 36, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        partnerName,
                        style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isVideo ? Icons.videocam_rounded : Icons.phone_rounded,
                            color: const Color(0xFF0068FF),
                            size: 18,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            callStatus,
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                      const SizedBox(height: 40),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          IconButton(
                            iconSize: 28,
                            style: IconButton.styleFrom(
                              backgroundColor: isMuted ? Colors.white24 : const Color(0xFF1E293B),
                              padding: const EdgeInsets.all(14),
                            ),
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
                          IconButton(
                            iconSize: 28,
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFEF4444),
                              padding: const EdgeInsets.all(18),
                            ),
                            icon: const Icon(Icons.call_end_rounded, color: Colors.white),
                            onPressed: () {
                              acceptSub?.cancel();
                              rejectSub?.cancel();
                              endSub?.cancel();
                              signalSub?.cancel();
                              if (localStream != null) {
                                for (var track in localStream!.getTracks()) {
                                  track.stop();
                                }
                              }
                              pc?.close();
                              SocketService.socket?.emit('end_call', {'connectedUserId': targetUserId});
                              Navigator.of(dialogContext).pop();
                            },
                          ),
                          IconButton(
                            iconSize: 28,
                            style: IconButton.styleFrom(
                              backgroundColor: isSpeakerOn ? const Color(0xFF0068FF).withOpacity(0.3) : const Color(0xFF1E293B),
                              padding: const EdgeInsets.all(14),
                            ),
                            icon: Icon(isSpeakerOn ? Icons.volume_up_rounded : Icons.volume_off_rounded, color: Colors.white),
                            onPressed: () => setDialogState(() => isSpeakerOn = !isSpeakerOn),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    ).then((_) {
      acceptSub?.cancel();
      rejectSub?.cancel();
      endSub?.cancel();
      signalSub?.cancel();
      if (localStream != null) {
        for (var track in localStream!.getTracks()) {
          track.stop();
        }
      }
      pc?.close();
    });
  }

  Widget _buildMobileBottomBar() {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            top: 6,
            bottom: bottomPadding > 0 ? 0 : 8,
          ),
          child: BottomNavigationBar(
            currentIndex: _currentTabIndex,
            onTap: (index) => setState(() => _currentTabIndex = index),
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: const Color(0xFF0068FF),
            unselectedItemColor: const Color(0xFF64748B),
            selectedFontSize: 11,
            unselectedFontSize: 11,
            iconSize: 24,
            type: BottomNavigationBarType.fixed,
            items: const [
              BottomNavigationBarItem(icon: Padding(padding: EdgeInsets.only(bottom: 3), child: Icon(Icons.chat_bubble_rounded)), label: 'Tin nhắn'),
              BottomNavigationBarItem(icon: Padding(padding: EdgeInsets.only(bottom: 3), child: Icon(Icons.people_alt_rounded)), label: 'Danh bạ'),
              BottomNavigationBarItem(icon: Padding(padding: EdgeInsets.only(bottom: 3), child: Icon(Icons.newspaper_rounded)), label: 'Tin tức'),
              BottomNavigationBarItem(icon: Padding(padding: EdgeInsets.only(bottom: 3), child: Icon(Icons.smart_toy_rounded)), label: 'Trợ lý AI'),
              BottomNavigationBarItem(icon: Padding(padding: EdgeInsets.only(bottom: 3), child: Icon(Icons.account_circle_rounded)), label: 'Cá nhân'),
            ],
          ),
        ),
      ),
    );
  }
}
