import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../widgets/message_bubble.dart';
import '../services/socket_service.dart';

class NativeChatScreen extends StatefulWidget {
  final String conversationId;
  final String chatTheme;
  final String partnerId;
  final String partnerName;
  final String partnerAvatar;
  final String myId;
  final String token;
  final VoidCallback onBackPressed; // Callback khi quay lại WebView chính

  const NativeChatScreen({
    super.key,
    required this.conversationId,
    required this.chatTheme,
    required this.partnerId,
    required this.partnerName,
    required this.partnerAvatar,
    required this.myId,
    required this.token,
    required this.onBackPressed,
  });

  @override
  State<NativeChatScreen> createState() => _NativeChatScreenState();
}

class _NativeChatScreenState extends State<NativeChatScreen> {
  final List<Map<String, dynamic>> _messages = [];
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final SocketService _socketService = SocketService();
  final ImagePicker _imagePicker = ImagePicker();

  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _pageLimit = 50;

  // Trạng thái chủ đề phòng chat
  String _chatTheme = "classic";

  // Trạng thái của đối phương
  bool _partnerOnline = false;
  String _partnerStatus = "Đang hoạt động";
  bool _isPartnerTyping = false;
  String _lastReadMessageId = "";

  @override
  void initState() {
    super.initState();
    _chatTheme = widget.chatTheme;
    _fetchMessages();
    _setupSocketListeners();
    _scrollController.addListener(_onScroll);

    // Đánh dấu đã xem tin nhắn khi bắt đầu mở chat
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _socketService.markMessagesRead(widget.conversationId);
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _inputController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 100 &&
        !_isLoadingMore &&
        _hasMore) {
      _fetchMoreMessages();
    }
  }

  // Lắng nghe real-time qua Socket.IO
  void _setupSocketListeners() {
    // 1. Nhận tin nhắn mới
    _socketService.onMessageReceived = (messageData) {
      if (messageData['conversationId'] == widget.conversationId) {
        setState(() {
          // Tránh add trùng tin nhắn (nếu API gửi trước socket)
          final exists = _messages.any((m) => m['id'] == messageData['id']);
          if (!exists) {
            _messages.insert(0, messageData);
          }
        });
        _scrollToBottom();
        // Đọc luôn tin nhắn vừa nhận
        _socketService.markMessagesRead(widget.conversationId);
      }
    };

    // 2. Lắng nghe trạng thái đang gõ
    _socketService.onTypingStatusChanged = (typingData) {
      if (typingData['conversationId'] == widget.conversationId || 
          typingData['senderId'] == widget.partnerId) {
        setState(() {
          _isPartnerTyping = typingData['isTyping'] ?? false;
        });
        if (_isPartnerTyping) {
          _scrollToBottom();
        }
      }
    };

    // 3. Lắng nghe trạng thái Online/Offline của đối phương
    _socketService.onUserStatusChanged = (statusData) {
      if (statusData['userId'] == widget.partnerId) {
        setState(() {
          _partnerOnline = statusData['isOnline'] ?? false;
          _partnerStatus = _partnerOnline ? "Đang hoạt động" : "Offline";
        });
      }
    };

    // 4. Lắng nghe trạng thái đã xem tin nhắn từ đối phương
    _socketService.onMessagesRead = (readData) {
      if (readData['conversationId'] == widget.conversationId && 
          readData['readBy'] == widget.partnerId) {
        setState(() {
          _lastReadMessageId = readData['lastReadMessageId'] ?? "";
        });
      }
    };

    // 5. Lắng nghe sự thay đổi chủ đề chat thời gian thực
    _socketService.onThemeChanged = (themeData) {
      if (themeData['conversationId'] == widget.conversationId) {
        setState(() {
          _chatTheme = themeData['theme'] ?? 'classic';
        });
      }
    };
  }

  // Tải lịch sử tin nhắn ban đầu từ API
  Future<void> _fetchMessages() async {
    setState(() {
      _isLoading = true;
    });

    final url = 'https://chat-tho-fi.onrender.com/api/chat/${widget.conversationId}/messages?limit=$_pageLimit';
    try {
      final response = await http.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> fetchedList = data['data'] ?? [];
        final bool hasMore = data['hasMore'] ?? false;

        setState(() {
          _messages.clear();
          _messages.addAll(fetchedList.map((m) => Map<String, dynamic>.from(m)).toList());
          _hasMore = hasMore;
          _isLoading = false;

          // Tìm tin nhắn cuối cùng đối phương đã đọc để hiển thị avatar báo đã xem
          _detectLastReadMessage();
        });
        _scrollToBottom();
      } else {
        throw Exception("Lỗi HTTP ${response.statusCode}");
      }
    } catch (e) {
      print("❌ Lỗi fetch tin nhắn: $e");
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Tải thêm tin nhắn cũ (Infinite scroll)
  Future<void> _fetchMoreMessages() async {
    if (_messages.isEmpty) return;
    setState(() {
      _isLoadingMore = true;
    });

    final lastMessageId = _messages.last['id'];
    final url = 'https://chat-tho-fi.onrender.com/api/chat/${widget.conversationId}/messages?limit=$_pageLimit&before=$lastMessageId';
    try {
      final response = await http.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> fetchedList = data['data'] ?? [];
        final bool hasMore = data['hasMore'] ?? false;

        setState(() {
          _messages.addAll(fetchedList.map((m) => Map<String, dynamic>.from(m)).toList());
          _hasMore = hasMore;
          _isLoadingMore = false;
        });
      }
    } catch (e) {
      print("❌ Lỗi fetch thêm tin nhắn: $e");
      setState(() {
        _isLoadingMore = false;
      });
    }
  }

  void _detectLastReadMessage() {
    // Logic tìm tin nhắn cuối cùng mà đối phương đã xem
    // Đối phương xem tin nhắn của mình gửi (isMe = true và isRead = true)
    for (var msg in _messages) {
      if (msg['senderId'] == widget.myId && msg['isRead'] == true) {
        _lastReadMessageId = msg['id'];
        break;
      }
    }
  }

  // Cuộn danh sách xuống cuối
  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0.0, // Vì ListView.builder sử dụng reverse: true nên đáy là pixels = 0
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // Gửi tin nhắn văn bản
  Future<void> _handleSendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty) return;

    _inputController.clear();
    _socketService.sendStopTyping(widget.partnerId, widget.conversationId);

    // Tạo tin nhắn giả định (optimistic UI) để hiển thị ngay lập tức
    final tempId = "temp-${DateTime.now().millisecondsSinceEpoch}";
    final optimisticMsg = {
      'id': tempId,
      'content': text,
      'senderId': widget.myId,
      'conversationId': widget.conversationId,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'type': 'text',
      'isRead': false,
      'reactions': [],
    };

    setState(() {
      _messages.insert(0, optimisticMsg);
    });
    _scrollToBottom();

    // Gửi lên backend qua API REST
    final url = 'https://chat-tho-fi.onrender.com/api/chat/messages';
    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}'
        },
        body: jsonEncode({
          'content': text,
          'conversationId': widget.conversationId,
          'receiverId': widget.partnerId,
          'tempId': tempId,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final realMsg = data['data'];
        
        setState(() {
          // Thay thế tin nhắn giả định bằng tin nhắn thật từ DB
          final idx = _messages.indexWhere((m) => m['id'] == tempId);
          if (idx != -1) {
            _messages[idx] = realMsg;
          }
        });
      }
    } catch (e) {
      print("❌ Lỗi gửi tin nhắn: $e");
    }
  }

  // Chọn hình ảnh và gửi dạng Base64
  Future<void> _handleSendImage() async {
    final XFile? pickedFile = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 70, // Nén ảnh xuống 70% chất lượng để gửi nhanh hơn
      maxWidth: 1000,
      maxHeight: 1000,
    );

    if (pickedFile == null) return;

    // Đọc ảnh và chuyển sang Base64 Data URL
    final bytes = await File(pickedFile.path).readAsBytes();
    final base64String = base64Encode(bytes);
    final dataUrl = "data:image/jpeg;base64,$base64String";

    final tempId = "temp-${DateTime.now().millisecondsSinceEpoch}";
    final optimisticMsg = {
      'id': tempId,
      'content': dataUrl,
      'senderId': widget.myId,
      'conversationId': widget.conversationId,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'type': 'image',
      'isRead': false,
      'reactions': [],
    };

    setState(() {
      _messages.insert(0, optimisticMsg);
    });
    _scrollToBottom();

    // Gửi lên backend qua API
    final url = 'https://chat-tho-fi.onrender.com/api/chat/messages';
    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}'
        },
        body: jsonEncode({
          'content': dataUrl,
          'conversationId': widget.conversationId,
          'receiverId': widget.partnerId,
          'tempId': tempId,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        final realMsg = data['data'];

        setState(() {
          final idx = _messages.indexWhere((m) => m['id'] == tempId);
          if (idx != -1) {
            _messages[idx] = realMsg;
          }
        });
      }
    } catch (e) {
      print("❌ Lỗi gửi ảnh: $e");
    }
  }

  // Gửi icon Like (👍)
  void _handleSendLike() {
    _inputController.text = "👍";
    _handleSendMessage();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          // Khung danh sách tin nhắn
          Expanded(
            child: _isLoading
                ? const Center(
                    child: SpinKitRing(
                      color: Color(0xFF0068FF),
                      size: 40.0,
                    ),
                  )
                : Stack(
                    children: [
                      ListView.builder(
                        controller: _scrollController,
                        reverse: true, // Cuộn từ dưới lên trên giống Messenger
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isMe = message['senderId'] == widget.myId;
                          final isLastRead = message['id'] == _lastReadMessageId;

                          // Hiển thị giờ nếu khoảng cách giữa 2 tin nhắn cách xa nhau (> 5 phút)
                          bool showTime = false;
                          if (index == _messages.length - 1) {
                            showTime = true;
                          } else {
                            try {
                              final current = DateTime.parse(message['createdAt']);
                              final prev = DateTime.parse(_messages[index + 1]['createdAt']);
                              if (current.difference(prev).inMinutes > 5) {
                                showTime = true;
                              }
                            } catch (_) {}
                          }

                          return MessageBubble(
                            key: ValueKey(message['id']),
                            message: message,
                            isMe: isMe,
                            chatTheme: _chatTheme,
                            partnerAvatar: widget.partnerAvatar,
                            showTime: showTime,
                            isLastReadMessage: isLastRead,
                          );
                        },
                      ),
                      
                      // Hiển thị bóng tròn loading khi cuộn trang lên tải tin cũ
                      if (_isLoadingMore)
                        const Positioned(
                          top: 10,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: CircleAvatar(
                              radius: 14,
                              backgroundColor: Colors.white,
                              child: SpinKitRing(
                                color: Color(0xFF0068FF),
                                size: 18.0,
                                lineWidth: 2,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
          ),

          // Đối phương đang gõ tin nhắn
          if (_isPartnerTyping)
            Padding(
              padding: const EdgeInsets.only(left: 54.0, bottom: 8.0, top: 4.0),
              child: Row(
                children: [
                  const Text(
                    "Đang soạn tin nhắn",
                    style: TextStyle(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
                  ),
                  const SizedBox(width: 4),
                  SpinKitThreeBounce(
                    color: Colors.grey.shade400,
                    size: 8.0,
                  ),
                ],
              ),
            ),

          // Khung nhập liệu ở dưới cùng
          _buildInputArea(),
        ],
      ),
    );
  }

  // Khung nhập liệu bottom bar
  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Nút chọn ảnh từ thư viện
            IconButton(
              icon: const Icon(Icons.image, color: Color(0xFF0068FF), size: 24),
              onPressed: _handleSendImage,
            ),
            
            // Ô nhập văn bản
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 2.0),
                child: TextField(
                  controller: _inputController,
                  maxLines: 4,
                  minLines: 1,
                  style: const TextStyle(fontSize: 15),
                  decoration: const InputDecoration(
                    hintText: "Aa",
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                  onChanged: (val) {
                    setState(() {}); // Re-build để đổi nút Like thành Gửi
                    
                    if (val.trim().isNotEmpty) {
                      _socketService.sendTyping(widget.partnerId, widget.conversationId, "Bạn");
                    } else {
                      _socketService.sendStopTyping(widget.partnerId, widget.conversationId);
                    }
                  },
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Nút gửi hoặc nút Like (👍) dựa trên nội dung text nhập vào
            _inputController.text.trim().isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.send, color: Color(0xFF0068FF), size: 24),
                    onPressed: _handleSendMessage,
                  )
                : IconButton(
                    icon: const Icon(Icons.thumb_up, color: Color(0xFF0068FF), size: 24),
                    onPressed: _handleSendLike,
                  ),
          ],
        ),
      ),
    );
  }

  // AppBar Native
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleSpacing: 0,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1.0),
        child: Container(
          color: Colors.grey.withOpacity(0.2),
          height: 1.0,
        ),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF0068FF), size: 20),
        onPressed: widget.onBackPressed,
      ),
      title: Row(
        children: [
          Stack(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: Colors.grey.shade200,
                backgroundImage: widget.partnerAvatar.isNotEmpty
                    ? NetworkImage(widget.partnerAvatar.startsWith('http')
                        ? widget.partnerAvatar
                        : 'https://chat-tho-fi.onrender.com' + widget.partnerAvatar)
                    : null,
                child: widget.partnerAvatar.isEmpty
                    ? Text(
                        widget.partnerName.isNotEmpty ? widget.partnerName[0].toUpperCase() : 'U',
                        style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.bold),
                      )
                    : null,
              ),
              if (_partnerOnline)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF42B72A),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  widget.partnerName,
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  _partnerStatus,
                  style: TextStyle(
                    color: _partnerOnline ? const Color(0xFF42B72A) : Colors.grey,
                    fontSize: 11,
                    fontWeight: _partnerOnline ? FontWeight.w500 : FontWeight.normal,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        // Cuộc gọi Webrtc và Info: Chuyển hướng người dùng về WebView để chạy
        IconButton(
          icon: const Icon(Icons.phone, color: Color(0xFF0068FF), size: 22),
          onPressed: widget.onBackPressed,
        ),
        IconButton(
          icon: const Icon(Icons.videocam, color: Color(0xFF0068FF), size: 24),
          onPressed: widget.onBackPressed,
        ),
        IconButton(
          icon: const Icon(Icons.info_outline, color: Color(0xFF0068FF), size: 22),
          onPressed: widget.onBackPressed,
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}
