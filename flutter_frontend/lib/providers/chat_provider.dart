import 'dart:async';
import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class ChatProvider extends ChangeNotifier {
  UserModel? currentUser;
  List<ConversationModel> conversations = [];
  ConversationModel? selectedConversation;
  List<MessageModel> messages = [];
  bool isLoadingConversations = false;
  bool isLoadingMessages = false;
  bool isPartnerTyping = false;
  StreamSubscription? _socketSubscription;

  /// Callback để thông báo cho UI cuộn xuống khi có tin nhắn mới
  VoidCallback? onNewMessageReceived;

  ChatProvider() {
    _initSocket();
  }

  void _initSocket() {
    _socketSubscription = SocketService.onMessageReceived.listen((data) {
      print('📨 ChatProvider nhận tin nhắn từ socket: ${data['id']}');
      final newMsg = MessageModel.fromJson(data);
      addRealtimeMessage(newMsg);
      fetchConversations(showLoading: false);
    });
  }

  /// Thêm tin nhắn real-time vào danh sách, tránh trùng lặp
  void addRealtimeMessage(MessageModel msg) {
    if (selectedConversation == null) return;
    if (msg.conversationId != selectedConversation!.id) return;

    // Kiểm tra trùng lặp (bao gồm cả optimistic message)
    final existingIdx = messages.indexWhere((m) => m.id == msg.id);
    if (existingIdx != -1) {
      // Cập nhật tin nhắn đã có (thay thế optimistic bằng real)
      messages[existingIdx] = msg;
    } else {
      // Kiểm tra xem có phải tin nhắn do chính mình gửi và đã có optimistic chưa
      // (optimistic id bắt đầu bằng 'optimistic-')
      final optimisticIdx = messages.indexWhere((m) =>
          m.id.startsWith('optimistic-') &&
          m.content == msg.content &&
          m.senderId == msg.senderId);
      if (optimisticIdx != -1) {
        messages[optimisticIdx] = msg;
      } else {
        messages.add(msg);
      }
    }

    notifyListeners();

    // Gọi callback để UI cuộn xuống
    onNewMessageReceived?.call();
  }

  Future<void> setCurrentUser(Map<String, dynamic> userJson) async {
    currentUser = UserModel.fromJson(userJson);
    if (currentUser != null && currentUser!.id.isNotEmpty) {
      SocketService.connect(userId: currentUser!.id);
    }
    notifyListeners();
  }

  Future<void> fetchConversations({bool showLoading = true}) async {
    if (showLoading) {
      isLoadingConversations = true;
      notifyListeners();
    }

    try {
      if (currentUser == null) {
        final meRes = await ApiService.getMe();
        final userObj = meRes['data'] ?? meRes['user'];
        if (userObj is Map<String, dynamic>) {
          currentUser = UserModel.fromJson(userObj);
        }
      }
      if (currentUser != null && currentUser!.id.isNotEmpty) {
        SocketService.connect(userId: currentUser!.id);
      }
      final rawList = await ApiService.getConversations();
      conversations = rawList
          .map((c) => ConversationModel.fromJson(c, currentUserId: currentUser?.id))
          .toList();
    } catch (e) {
      debugPrint('Error fetching conversations: $e');
    } finally {
      isLoadingConversations = false;
      notifyListeners();
    }
  }

  Future<void> selectConversation(ConversationModel conv) async {
    selectedConversation = conv;
    isLoadingMessages = true;
    messages = [];
    notifyListeners();

    // Join vào room của conversation để nhận tin nhắn real-time
    SocketService.joinRoom(conv.id);

    try {
      final res = await ApiService.getMessages(conv.id);
      final rawData = res['data'] as List? ?? [];
      messages = rawData.map((m) => MessageModel.fromJson(m)).toList();
    } catch (e) {
      debugPrint('Error fetching messages: $e');
    } finally {
      isLoadingMessages = false;
      notifyListeners();

      // Cuộn xuống sau khi load xong
      onNewMessageReceived?.call();
    }
  }

  void deselectConversation() {
    SocketService.leaveRoom();
    selectedConversation = null;
    messages = [];
    notifyListeners();
  }

  Future<void> startPrivateChat(String receiverId) async {
    try {
      final res = await ApiService.createConversation(receiverId);
      final convData = res['data'];
      if (convData is Map<String, dynamic>) {
        final convId = convData['id']?.toString() ?? convData['conversationId']?.toString();
        await fetchConversations();
        if (convId != null) {
          final found = conversations.firstWhere(
            (c) => c.id == convId,
            orElse: () => ConversationModel.fromJson(convData, currentUserId: currentUser?.id),
          );
          selectConversation(found);
        }
      }
    } catch (e) {
      debugPrint('Error starting private chat: $e');
    }
  }

  Future<void> sendMessage(String text, {String type = 'text'}) async {
    if (selectedConversation == null || text.trim().isEmpty) return;

    // Optimistic UI message
    final optId = 'optimistic-${DateTime.now().millisecondsSinceEpoch}';
    final optMsg = MessageModel(
      id: optId,
      conversationId: selectedConversation!.id,
      senderId: currentUser?.id,
      content: text,
      type: type,
      createdAt: DateTime.now(),
    );

    messages.add(optMsg);
    notifyListeners();
    onNewMessageReceived?.call();

    try {
      final res = await ApiService.sendMessage(selectedConversation!.id, text, type: type);
      final msgData = res['data'] ?? (res['success'] == true ? res : null);
      if (msgData is Map<String, dynamic>) {
        final realMsg = MessageModel.fromJson(msgData);
        final idx = messages.indexWhere((m) => m.id == optId);
        if (idx != -1) {
          messages[idx] = realMsg;
        } else if (!messages.any((m) => m.id == realMsg.id)) {
          messages.add(realMsg);
        }
        notifyListeners();
      }
      fetchConversations(showLoading: false);
    } catch (e) {
      debugPrint('Error sending message: $e');
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    super.dispose();
  }
}
