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
  StreamSubscription? _deliveredSubscription;
  StreamSubscription? _readSubscription;
  StreamSubscription? _userStatusSubscription;
  StreamSubscription? _nicknameSubscription;

  /// Callback để thông báo cho UI cuộn xuống khi có tin nhắn mới
  VoidCallback? onNewMessageReceived;

  /// Callback khi mở cuộc trò chuyện mới để nhảy ngay xuống tin nhắn mới nhất
  VoidCallback? onConversationSelected;

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
        SocketService.emitMarkAsDelivered(newMsg.id, conversationId: newMsg.conversationId);
        if (selectedConversation != null && selectedConversation!.id == newMsg.conversationId && currentUser != null) {
          SocketService.emitMarkAsRead(newMsg.id, conversationId: newMsg.conversationId);
        }
      }
    });

    _typingSubscription = SocketService.onUserTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      final uid = data['userId']?.toString() ?? data['senderId']?.toString();
      final nickname = data['nickname']?.toString() ?? data['senderName']?.toString() ?? 'Người dùng';

      if (convId != null && uid != null && uid != currentUser?.id) {
        typingUsers[convId] = nickname;
        if (selectedConversation != null && selectedConversation!.id == convId) {
          isPartnerTyping = true;
        }
        notifyListeners();
      }
    });

    _stopTypingSubscription = SocketService.onUserStopTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      if (convId != null) {
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
          messages[idx] = messages[idx].copyWith(reactions: reactions);
        }
        SocketService.playReactSound();
        notifyListeners();
      }
    });

    _deliveredSubscription = SocketService.onMessageDelivered.listen((data) {
      final msgId = data['messageId']?.toString();
      if (msgId != null) {
        final idx = messages.indexWhere((m) => m.id == msgId);
        if (idx != -1 && !messages[idx].isDelivered) {
          messages[idx] = messages[idx].copyWith(isDelivered: true);
          notifyListeners();
        }
      }
    });

    _readSubscription = SocketService.onMessagesRead.listen((data) {
      final convId = data['conversationId']?.toString();
      final readBy = data['readBy']?.toString();
      if (selectedConversation != null && (convId == null || selectedConversation!.id == convId)) {
        bool updated = false;
        for (int i = 0; i < messages.length; i++) {
          if (!messages[i].isRead && (readBy == null || messages[i].senderId != readBy)) {
            messages[i] = messages[i].copyWith(isRead: true, isDelivered: true);
            updated = true;
          }
        }
        if (updated) notifyListeners();
      }
    });

    _userStatusSubscription = SocketService.onUserStatusChanged.listen((data) {
      final userId = data['userId']?.toString() ?? data['id']?.toString();
      final isOnline = data['isOnline'] == true || data['status'] == 'online';
      DateTime? lastActive;
      if (data['lastActive'] != null) {
        lastActive = DateTime.tryParse(data['lastActive'].toString());
      }
      if (userId != null && userId.isNotEmpty) {
        updateUserOnlineStatus(userId, isOnline, lastActive: lastActive);
      }
    });

    _nicknameSubscription = SocketService.onNicknameChanged.listen((data) {
      final convId = data['conversationId']?.toString();
      final userId = data['targetUserId']?.toString() ?? data['userId']?.toString();
      final nickname = data['nickname']?.toString();
      if (convId != null && userId != null) {
        updateMemberNickname(convId, userId, nickname);
      }
      if (data['systemMessage'] != null) {
        final rawSys = data['systemMessage'];
        if (rawSys is Map<String, dynamic>) {
          addRealtimeMessage(MessageModel.fromJson(rawSys));
        } else if (rawSys is Map) {
          addRealtimeMessage(MessageModel.fromJson(Map<String, dynamic>.from(rawSys)));
        }
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

    // Optimistic update locally for instant feedback
    final index = messages.indexWhere((m) => m.id == messageId);
    if (index != -1 && currentUser != null) {
      final msg = messages[index];
      final Map<String, String> updatedReactions = Map<String, String>.from(msg.reactions);
      final userId = currentUser!.id;

      if (updatedReactions[userId] == emoji) {
        updatedReactions.remove(userId);
      } else {
        updatedReactions[userId] = emoji;
      }

      messages[index] = msg.copyWith(reactions: updatedReactions);
      notifyListeners();
    }

    // Play local reaction sound immediately
    SocketService.playReactSound();

    // Emit socket event for real-time broadcast
    SocketService.emitReactMessage(messageId, selectedConversation!.id, emoji);

    // Call REST API fallback for guaranteed database persistence
    ApiService.reactToMessage(messageId, emoji).catchError((e) {
      debugPrint('⚠️ Fallback react API error: $e');
    });
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

  final Set<String> _processedMessageIdsForUnread = {};

  /// Cập nhật tin nhắn mới nhất trong danh sách đoạn chat hoàn toàn ở bộ nhớ (không cần gọi API getConversations)
  void _updateLastMessageInConversation(MessageModel msg) {
    if (msg.conversationId == null || msg.conversationId!.isEmpty) return;
    final idx = conversations.indexWhere((c) => c.id == msg.conversationId);
    if (idx != -1) {
      final old = conversations[idx];
      final isFromSelf = (currentUser != null && msg.senderId != null && msg.senderId == currentUser!.id);
      final isCurrentlySelected = (selectedConversation != null && selectedConversation!.id == old.id);

      int newUnreadCount = old.unreadCount;
      if (isFromSelf || isCurrentlySelected) {
        newUnreadCount = 0;
      } else {
        // Chỉ tăng +1 duy nhất một lần cho mỗi mã tin nhắn (tránh bị nhân bản do socket)
        if (msg.id.isNotEmpty && !_processedMessageIdsForUnread.contains(msg.id)) {
          _processedMessageIdsForUnread.add(msg.id);
          newUnreadCount = old.unreadCount + 1;
        }
      }

      final updatedConv = ConversationModel(
        id: old.id,
        name: old.name,
        avatar: old.avatar,
        type: old.type,
        lastMessage: msg.content,
        unreadCount: newUnreadCount,
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

  void clearCurrentUser() {
    currentUser = null;
    selectedConversation = null;
    messages = [];
    conversations = [];
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

    // Đặt unreadCount của đoạn chat được chọn về 0 lập tức ở local
    final idx = conversations.indexWhere((c) => c.id == conv.id);
    if (idx != -1) {
      final old = conversations[idx];
      if (old.unreadCount > 0) {
        conversations[idx] = ConversationModel(
          id: old.id,
          name: old.name,
          avatar: old.avatar,
          type: old.type,
          lastMessage: old.lastMessage,
          unreadCount: 0,
          updatedAt: old.updatedAt,
          targetUserId: old.targetUserId,
          members: old.members,
        );
      }
    }

    isLoadingMessages = true;
    messages = [];
    notifyListeners();

    // Báo cho server socket & REST API biết người dùng đã xem tất cả tin nhắn trong cuộc trò chuyện này
    if (currentUser != null) {
      SocketService.markMessagesRead(conv.id, currentUser!.id);
    }
    ApiService.markAsRead(conv.id).catchError((_) {});

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

      // Nhảy ngay xuống tin nhắn mới nhất khi chọn đoạn chat
      onConversationSelected?.call();
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
        'replyMessageId': replyId,
      });
    }

    try {
      final res = await ApiService.sendMessage(
        selectedConversation!.id,
        text,
        type: type,
        replyMessageId: replyId,
      );
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

  Future<bool> deleteConversation(String conversationId) async {
    try {
      final success = await ApiService.deleteConversation(conversationId);
      if (success) {
        conversations.removeWhere((c) => c.id == conversationId);
        if (selectedConversation != null && selectedConversation!.id == conversationId) {
          clearSelectedConversation();
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Error in deleteConversation provider: $e');
    }
    return false;
  }

  void updateUserOnlineStatus(String userId, bool isOnline, {DateTime? lastActive}) {
    bool updated = false;
    for (int i = 0; i < conversations.length; i++) {
      final conv = conversations[i];
      final memberIndex = conv.members.indexWhere((m) => m.id == userId);
      if (memberIndex != -1) {
        final updatedMembers = List<UserModel>.from(conv.members);
        final oldMember = updatedMembers[memberIndex];
        final newLastActive = isOnline
            ? DateTime.now()
            : (lastActive ?? oldMember.lastActive ?? DateTime.now());
        updatedMembers[memberIndex] = UserModel(
          id: oldMember.id,
          username: oldMember.username,
          fullName: oldMember.fullName,
          email: oldMember.email,
          phone: oldMember.phone,
          avatar: oldMember.avatar,
          isOnline: isOnline,
          lastActive: newLastActive,
        );
        conversations[i] = ConversationModel(
          id: conv.id,
          name: conv.name,
          avatar: conv.avatar,
          type: conv.type,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
          updatedAt: conv.updatedAt,
          targetUserId: conv.targetUserId,
          members: updatedMembers,
        );
        if (selectedConversation?.id == conv.id) {
          selectedConversation = conversations[i];
        }
        updated = true;
      }
    }
    if (updated) {
      notifyListeners();
    }
  }

  Future<bool> updateNickname(String conversationId, String userId, String? nickname) async {
    final success = await ApiService.updateNickname(conversationId, userId, nickname);
    if (success) {
      SocketService.emitChangeNickname(conversationId, userId, nickname);
      updateMemberNickname(conversationId, userId, nickname);
    }
    return success;
  }

  void updateMemberNickname(String conversationId, String userId, String? nickname) {
    bool updated = false;
    for (int i = 0; i < conversations.length; i++) {
      if (conversations[i].id == conversationId) {
        final conv = conversations[i];
        final memberIndex = conv.members.indexWhere((m) => m.id == userId);
        if (memberIndex != -1) {
          final updatedMembers = List<UserModel>.from(conv.members);
          final oldMember = updatedMembers[memberIndex];
          final cleanNickname = (nickname != null && nickname.trim().isNotEmpty) ? nickname.trim() : null;
          updatedMembers[memberIndex] = UserModel(
            id: oldMember.id,
            username: oldMember.username,
            fullName: oldMember.fullName,
            nickname: cleanNickname,
            email: oldMember.email,
            phone: oldMember.phone,
            avatar: oldMember.avatar,
            isOnline: oldMember.isOnline,
            lastActive: oldMember.lastActive,
          );

          String newConvName = conv.name;
          if (conv.type == 'private' && userId == conv.targetUserId) {
            newConvName = cleanNickname ?? oldMember.fullName;
          }

          conversations[i] = ConversationModel(
            id: conv.id,
            name: newConvName,
            avatar: conv.avatar,
            type: conv.type,
            lastMessage: conv.lastMessage,
            unreadCount: conv.unreadCount,
            updatedAt: conv.updatedAt,
            targetUserId: conv.targetUserId,
            members: updatedMembers,
          );

          if (selectedConversation?.id == conversationId) {
            selectedConversation = conversations[i];
          }
          updated = true;
        }
      }
    }
    if (updated) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _typingSubscription?.cancel();
    _stopTypingSubscription?.cancel();
    _reactedSubscription?.cancel();
    _deliveredSubscription?.cancel();
    _readSubscription?.cancel();
    _userStatusSubscription?.cancel();
    _nicknameSubscription?.cancel();
    super.dispose();
  }
}
