import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class ChatScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ChatScreen({Key? key, required this.onLogout}) : super(key: key);

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  List<dynamic> _conversations = [];
  Map<String, dynamic>? _selectedConversation;
  List<dynamic> _messages = [];
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  StreamSubscription? _socketSubscription;
  bool _isLoadingConversations = true;
  bool _isLoadingMessages = false;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    _socketSubscription = SocketService.onMessageReceived.listen((msg) {
      if (_selectedConversation != null && msg['conversationId'] == _selectedConversation!['id']) {
        setState(() {
          _messages.add(msg);
        });
        _scrollToBottom();
      }
      _loadConversations();
    });
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadConversations() async {
    final list = await ApiService.getConversations();
    setState(() {
      _conversations = list;
      _isLoadingConversations = false;
      if (_selectedConversation == null && _conversations.isNotEmpty) {
        _selectConversation(_conversations[0]);
      }
    });
  }

  Future<void> _selectConversation(Map<String, dynamic> conv) async {
    setState(() {
      _selectedConversation = conv;
      _isLoadingMessages = true;
      _messages = [];
    });

    final res = await ApiService.getMessages(conv['id']);
    setState(() {
      _messages = res['data'] ?? [];
      _isLoadingMessages = false;
    });
    _scrollToBottom();
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

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _selectedConversation == null) return;

    _messageController.clear();
    final res = await ApiService.sendMessage(_selectedConversation!['id'], text);
    if (res['data'] != null) {
      setState(() {
        _messages.add(res['data']);
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: const Color(0xFF090D1A),
      body: SafeArea(
        child: Row(
          children: [
            // Sidebar: Conversations List
            if (!isMobile || _selectedConversation == null)
              SizedBox(
                width: isMobile ? MediaQuery.of(context).size.width : 320,
                child: _buildSidebar(),
              ),

            // Main Chat Area
            if (!isMobile || _selectedConversation != null)
              Expanded(
                child: _selectedConversation == null
                    ? const Center(
                        child: Text(
                          'Chọn một cuộc trò chuyện để bắt đầu',
                          style: TextStyle(color: Colors.grey, fontSize: 16),
                        ),
                      )
                    : _buildChatArea(isMobile),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF111625),
        border: Border(right: BorderSide(color: Color(0xFF1E2638))),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFF0068FF),
                  child: Icon(Icons.person, color: Colors.white),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Chat Tho-Fi',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.logout, color: Colors.grey),
                  onPressed: widget.onLogout,
                  tooltip: 'Đăng xuất',
                ),
              ],
            ),
          ),
          const Divider(color: Color(0xFF1E2638), height: 1),
          // Conversations list
          Expanded(
            child: _isLoadingConversations
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
                : ListView.builder(
                    itemCount: _conversations.length,
                    itemBuilder: (context, index) {
                      final conv = _conversations[index];
                      final isSelected = _selectedConversation?['id'] == conv['id'];
                      return ListTile(
                        selected: isSelected,
                        selectedTileColor: const Color(0xFF1A233A),
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF0068FF),
                          child: Text(
                            (conv['name'] ?? 'U')[0].toUpperCase(),
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                        title: Text(
                          conv['name'] ?? 'Cuộc trò chuyện',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          conv['lastMessage'] ?? 'Bắt đầu chat...',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.grey, fontSize: 13),
                        ),
                        onTap: () => _selectConversation(conv),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatArea(bool isMobile) {
    return Container(
      color: const Color(0xFF090D1A),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: const Color(0xFF111625),
            child: Row(
              children: [
                if (isMobile)
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => setState(() => _selectedConversation = null),
                  ),
                CircleAvatar(
                  backgroundColor: const Color(0xFF0068FF),
                  child: Text((_selectedConversation!['name'] ?? 'U')[0].toUpperCase()),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedConversation!['name'] ?? 'Người chat',
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Text(
                        'Đang hoạt động',
                        style: TextStyle(color: Colors.greenAccent, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                IconButton(icon: const Icon(Icons.phone, color: Color(0xFF0068FF)), onPressed: () {}),
                IconButton(icon: const Icon(Icons.videocam, color: Color(0xFF0068FF)), onPressed: () {}),
              ],
            ),
          ),

          // Messages list
          Expanded(
            child: _isLoadingMessages
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0068FF)))
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final isMe = msg['senderId'] != null; // Simplified
                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                          decoration: BoxDecoration(
                            color: isMe ? const Color(0xFF0068FF) : const Color(0xFF1E2638),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Text(
                            msg['content'] ?? '',
                            style: const TextStyle(color: Colors.white, fontSize: 15),
                          ),
                        ),
                      );
                    },
                  ),
          ),

          // Input area
          Container(
            padding: const EdgeInsets.all(12),
            color: const Color(0xFF111625),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Aa',
                      hintStyle: const TextStyle(color: Colors.grey),
                      filled: true,
                      fillColor: const Color(0xFF1C2333),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF0068FF)),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
