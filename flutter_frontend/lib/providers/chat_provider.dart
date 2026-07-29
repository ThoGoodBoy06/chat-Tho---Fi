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
  Map<String, String> typingUsers = {};
  MessageModel? replyingToMessage;
  StreamSubscription? _socketSubscription;
  StreamSubscription? _typingSubscription;
  StreamSubscription? _stopTypingSubscription;
  StreamSubscription? _reactedSubscription;

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
      _updateLastMessageInConversation(newMsg);
      if (newMsg.senderId != currentUser?.id) {
        SocketService.playReceiveSound();
      }
    });

    _typingSubscription = SocketService.onUserTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      final uid = data['userId']?.toString() ?? data['senderId']?.toString();
      final nickname = data['nickname']?.toString() ?? data['senderName']?.toString() ?? 'Người dùng';

      if (uid != null && uid == currentUser?.id) return;

      if (convId != null && convId.isNotEmpty) {
        typingUsers[convId] = nickname;
        if (selectedConversation != null && selectedConversation!.id == convId) {
          isPartnerTyping = true;
        }
        notifyListeners();
      }
    });

    _stopTypingSubscription = SocketService.onUserStopTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      if (convId != null && convId.isNotEmpty) {
        typingUsers.remove(convId);
        if (selectedConversation != null && selectedConversation!.id == convId) {
          isPartnerTyping = false;
        }
        notifyListeners();
      }
    });

    _reactedSubscription = SocketService.onMessageReacted.listen((data) {
      final msgId = data['messageId']?.toString();
      final rawReactions = data['reactions'];
      if (msgId != null && rawReactions != null) {
        Map<String, String> reactions = {};
        if (rawReactions is Map) {
          rawReactions.forEach((key, value) {
            reactions[key.toString()] = value.toString();
          });
        }
        final idx = messages.indexWhere((m) => m.id == msgId);
        if (idx != -1) {
          final old = messages[idx];
          messages[idx] = MessageModel(
            id: old.id,
            conversationId: old.conversationId,
            senderId: old.senderId,
            type: old.type,
            content: old.content,
            imageUrl: old.imageUrl,
            audioUrl: old.audioUrl,
            isRead: old.isRead,
            replyMessageId: old.replyMessageId,
            reactions: reactions,
            createdAt: old.createdAt,
          );
        }
        SocketService.playReactSound();
        notifyListeners();
      }
    });
  }

  void deleteMessage(String messageId) {
    messages.removeWhere((m) => m.id == messageId);
    notifyListeners();
  }

  void setReplyingToMessage(MessageModel? msg) {
    replyingToMessage = msg;
    notifyListeners();
  }

  void reactToMessage(String messageId, String emoji) {
    if (selectedConversation == null) return;
    SocketService.emitReactMessage(messageId, selectedConversation!.id, emoji);
    notifyListeners();
  }

  String? getTypingUserForSelectedConversation() {
    if (selectedConversation == null) return null;
    return typingUsers[selectedConversation!.id];
  }

  void emitTyping() {
    if (selectedConversation == null || currentUser == null) return;
    SocketService.emitTyping(
      selectedConversation!.id,
      currentUser!.id,
      currentUser!.fullName ?? currentUser!.username,
    );
  }

  void emitStopTyping() {
    if (selectedConversation == null || currentUser == null) return;
    SocketService.emitStopTyping(
      selectedConversation!.id,
      currentUser!.id,
    );
  }

  /// Cập nhật tin nhắn mới nhất trong danh sách đoạn chat hoàn toàn ở bộ nhớ (không cần gọi API getConversations)
  void _updateLastMessageInConversation(MessageModel msg) {
    if (msg.conversationId == null || msg.conversationId!.isEmpty) return;
    final idx = conversations.indexWhere((c) => c.id == msg.conversationId);
    if (idx != -1) {
      final old = conversations[idx];
      final updatedConv = ConversationModel(
        id: old.id,
        name: old.name,
        avatar: old.avatar,
        type: old.type,
        lastMessage: msg.content,
        unreadCount: old.unreadCount,
        updatedAt: msg.createdAt,
        targetUserId: old.targetUserId,
        members: old.members,
      );
      conversations.removeAt(idx);
      conversations.insert(0, updatedConv);
      notifyListeners();
    }
  }

  /// Thêm tin nhắn real-time vào danh sách, tránh trùng lặp
  void addRealtimeMessage(MessageModel msg) {
    if (selectedConversation == null) return;
    if (msg.conversationId != null &&
        msg.conversationId!.isNotEmpty &&
        msg.conversationId != selectedConversation!.id) {
      return;
    }

    // Kiểm tra trùng lặp (bao gồm cả optimistic message)
    final existingIdx = messages.indexWhere((m) => m.id == msg.id);
    if (existingIdx != -1) {
      // Cập nhật tin nhắn đã có (thay thế optimistic bằng real)
      messages[existingIdx] = msg;
    } else {
      // Kiểm tra xem có phải tin nhắn do chính mình gửi và đã có optimistic chưa
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

  String? selectedConversationId;
  bool showUnreadOnly = false;

  void setShowUnreadOnly(bool val) {
    showUnreadOnly = val;
    notifyListeners();
  }

  void clearSelectedConversation() {
    selectedConversation = null;
    selectedConversationId = null;
    messages = [];
    notifyListeners();
  }

  Future<void> selectConversation(ConversationModel conv) async {
    selectedConversation = conv;
    selectedConversationId = conv.id;
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

    emitStopTyping();
    SocketService.playSendSound();

    final replyId = replyingToMessage?.id;
    replyingToMessage = null;

    // Optimistic UI message (Hiển thị tức thì trên màn hình)
    final optId = 'optimistic-${DateTime.now().millisecondsSinceEpoch}';
    final optMsg = MessageModel(
      id: optId,
      conversationId: selectedConversation!.id,
      senderId: currentUser?.id,
      content: text,
      type: type,
      replyMessageId: replyId,
      createdAt: DateTime.now(),
    );

    messages.add(optMsg);
    _updateLastMessageInConversation(optMsg);
    notifyListeners();
    onNewMessageReceived?.call();

    // ⚡ Bắn tín hiệu tin nhắn tức thời qua Socket.IO (<20ms)
    if (SocketService.socket != null && SocketService.socket!.connected) {
      SocketService.socket!.emit('send_message', {
        'conversationId': selectedConversation!.id,
        'content': text,
        'type': type,
        'tempId': optId,
        'senderId': currentUser?.id,
        'senderName': currentUser?.fullName,
      });
    }

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
        _updateLastMessageInConversation(realMsg);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error sending message: $e');
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _typingSubscription?.cancel();
    _stopTypingSubscription?.cancel();
    _reactedSubscription?.cancel();
    super.dispose();
  }
}
