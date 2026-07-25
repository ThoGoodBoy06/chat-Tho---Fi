import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../providers/chat_provider.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ChatScreen({Key? key, required this.onLogout}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  int _currentTabIndex = 0; // 0: Messages, 1: Contacts, 2: News, 3: AI, 4: Profile
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ChatProvider>(context, listen: false).fetchConversations();
    });
    _textController.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final typing = _textController.text.trim().isNotEmpty;
    if (typing != _isTyping) {
      setState(() => _isTyping = typing);
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _handleSend(ChatProvider provider) async {
    final text = _textController.text.trim();
    if (text.isEmpty) {
      // Like emoji 👍 button when empty
      await provider.sendMessage('👍');
    } else {
      _textController.clear();
      await provider.sendMessage(text);
    }
    _scrollToBottom();
  }

  String _formatTime(DateTime dt) {
    return DateFormat('HH:mm').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: const Color(0xFF090D1A),
      body: SafeArea(
        child: Row(
          children: [
            // Left App Navigation Drawer (Desktop/Tablet)
            if (!isMobile) _buildDesktopNavRail(),

            // Sidebar / Conversations List
            if (!isMobile || provider.selectedConversation == null)
              SizedBox(
                width: isMobile ? MediaQuery.of(context).size.width : 340,
                child: _buildConversationsList(provider, isMobile),
              ),

            // Chat Main Window
            if (!isMobile || provider.selectedConversation != null)
              Expanded(
                child: provider.selectedConversation == null
                    ? _buildEmptyChatState()
                    : _buildActiveChatArea(provider, isMobile),
              ),
          ],
        ),
      ),
      bottomNavigationBar: (isMobile && provider.selectedConversation == null)
          ? _buildMobileBottomBar()
          : null,
    );
  }

  Widget _buildDesktopNavRail() {
    final navItems = [
      {'icon': Icons.chat_bubble, 'label': 'Tin nhắn'},
      {'icon': Icons.contacts, 'label': 'Danh bạ'},
      {'icon': Icons.newspaper, 'label': 'Tin tức'},
      {'icon': Icons.smart_toy, 'label': 'Trợ lý AI'},
      {'icon': Icons.person, 'label': 'Cá nhân'},
    ];

    return Container(
      width: 72,
      color: const Color(0xFF0B0F1C),
      child: Column(
        children: [
          const SizedBox(height: 16),
          const CircleAvatar(
            backgroundColor: Color(0xFF0068FF),
            radius: 20,
            child: Icon(Icons.chat_bubble_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: navItems.length,
              itemBuilder: (context, index) {
                final isSelected = _currentTabIndex == index;
                return InkWell(
                  onTap: () => setState(() => _currentTabIndex = index),
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF0068FF).withOpacity(0.2) : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      navItems[index]['icon'] as IconData,
                      color: isSelected ? const Color(0xFF0068FF) : Colors.grey[400],
                      size: 26,
                    ),
                  ),
                );
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.grey),
            onPressed: widget.onLogout,
            tooltip: 'Đăng xuất',
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildConversationsList(ChatProvider provider, bool isMobile) {
    return Container(
      color: const Color(0xFF131927),
      child: Column(
        children: [
          // Search & Header
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E2638),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.search, color: Colors.grey, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: const InputDecoration(
                              hintText: 'Tìm kiếm trên Chat Tho-Fi...',
                              hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (isMobile)
                  IconButton(
                    icon: const Icon(Icons.logout, color: Colors.grey),
                    onPressed: widget.onLogout,
                  ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFF1E2638)),
          // List
          Expanded(
            child: provider.isLoadingConversations
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
                : provider.conversations.isEmpty
                    ? const Center(child: Text('Chưa có cuộc trò chuyện nào', style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: provider.conversations.length,
                        itemBuilder: (context, index) {
                          final conv = provider.conversations[index];
                          final isSelected = provider.selectedConversation?.id == conv.id;
                          return ListTile(
                            selected: isSelected,
                            selectedTileColor: const Color(0xFF1E273D),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            leading: Stack(
                              children: [
                                CircleAvatar(
                                  radius: 24,
                                  backgroundColor: const Color(0xFF0068FF),
                                  child: Text(
                                    conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 13,
                                    height: 13,
                                    decoration: BoxDecoration(
                                      color: Colors.greenAccent,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: const Color(0xFF131927), width: 2),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            title: Text(
                              conv.name,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                            ),
                            subtitle: Text(
                              conv.lastMessage ?? 'Bắt đầu trò chuyện!',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: Colors.grey[400], fontSize: 13),
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
          Icon(Icons.chat_bubble_outline_rounded, size: 72, color: Colors.grey[600]),
          const SizedBox(height: 16),
          const Text(
            'Chào mừng đến với Chat Tho-Fi',
            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Chọn một cuộc trò chuyện để nhắn tin ngay',
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveChatArea(ChatProvider provider, bool isMobile) {
    final conv = provider.selectedConversation!;

    return Column(
      children: [
        // Zalo Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            color: Color(0xFF131927),
            border: Border(bottom: BorderSide(color: Color(0xFF1E2638))),
          ),
          child: Row(
            children: [
              if (isMobile)
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Color(0xFF0068FF)),
                  onPressed: () => provider.selectConversation(conv),
                ),
              Stack(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: const Color(0xFF0068FF),
                    child: Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U'),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: Colors.greenAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF131927), width: 1.5),
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
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Đang hoạt động',
                      style: TextStyle(color: Colors.grey[400], fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(icon: const Icon(Icons.phone, color: Color(0xFF0068FF)), onPressed: () {}),
              IconButton(icon: const Icon(Icons.videocam, color: Color(0xFF0068FF)), onPressed: () {}),
              IconButton(icon: const Icon(Icons.info_outline, color: Color(0xFF0068FF)), onPressed: () {}),
            ],
          ),
        ),

        // Message List
        Expanded(
          child: provider.isLoadingMessages
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
              : ListView.builder(
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
                          child: Text(
                            msg.content,
                            style: const TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic),
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
                              child: Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10)),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: BoxDecoration(
                                color: isMe ? const Color(0xFF0068FF) : const Color(0xFF1E2638),
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(18),
                                  topRight: const Radius.circular(18),
                                  bottomLeft: Radius.circular(isMe ? 18 : 4),
                                  bottomRight: Radius.circular(isMe ? 4 : 18),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    msg.content,
                                    style: const TextStyle(color: Colors.white, fontSize: 15),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _formatTime(msg.createdAt),
                                        style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10),
                                      ),
                                      if (isMe) ...[
                                        const SizedBox(width: 4),
                                        Icon(
                                          msg.isRead ? Icons.done_all : Icons.done,
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
        ),

        // Messenger Input Area
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: const Color(0xFF131927),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.camera_alt, color: Color(0xFF0068FF)), onPressed: () {}),
              IconButton(icon: const Icon(Icons.photo_library, color: Color(0xFF0068FF)), onPressed: () {}),
              IconButton(icon: const Icon(Icons.mic, color: Color(0xFF0068FF)), onPressed: () {}),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C2436),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _textController,
                          style: const TextStyle(color: Colors.white, fontSize: 15),
                          decoration: const InputDecoration(
                            hintText: 'Aa',
                            hintStyle: TextStyle(color: Colors.grey, fontSize: 15),
                            border: InputBorder.none,
                          ),
                          onSubmitted: (_) => _handleSend(provider),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.sentiment_satisfied_alt, color: Color(0xFF0068FF)),
                        onPressed: () {},
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: Icon(
                  _isTyping ? Icons.send_rounded : Icons.thumb_up_rounded,
                  color: const Color(0xFF0068FF),
                ),
                onPressed: () => _handleSend(provider),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMobileBottomBar() {
    return BottomNavigationBar(
      currentIndex: _currentTabIndex,
      onTap: (index) => setState(() => _currentTabIndex = index),
      backgroundColor: const Color(0xFF111625),
      selectedItemColor: const Color(0xFF0068FF),
      unselectedItemColor: Colors.grey,
      type: BottomNavigationBarType.fixed,
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.chat_bubble), label: 'Tin nhắn'),
        BottomNavigationBarItem(icon: Icon(Icons.contacts), label: 'Danh bạ'),
        BottomNavigationBarItem(icon: Icon(Icons.newspaper), label: 'Tin tức'),
        BottomNavigationBarItem(icon: Icon(Icons.smart_toy), label: 'Trợ lý AI'),
        BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Cá nhân'),
      ],
    );
  }
}
