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

  ChatProvider() {
    _initSocket();
  }

  void _initSocket() {
    _socketSubscription = SocketService.onMessageReceived.listen((data) {
      final newMsg = MessageModel.fromJson(data);
      if (selectedConversation != null && newMsg.conversationId == selectedConversation!.id) {
        final existingIdx = messages.indexWhere((m) => m.id == newMsg.id);
        if (existingIdx == -1) {
          messages.add(newMsg);
        } else {
          messages[existingIdx] = newMsg;
        }
        notifyListeners();
      }
      fetchConversations();
    });
  }

  Future<void> setCurrentUser(Map<String, dynamic> userJson) async {
    currentUser = UserModel.fromJson(userJson);
    if (currentUser != null && currentUser!.id.isNotEmpty) {
      SocketService.connect(userId: currentUser!.id);
    }
    notifyListeners();
  }

  Future<void> fetchConversations() async {
    isLoadingConversations = true;
    notifyListeners();

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

    try {
      final res = await ApiService.getMessages(conv.id);
      final rawData = res['data'] as List? ?? [];
      messages = rawData.map((m) => MessageModel.fromJson(m)).toList();
    } catch (e) {
      debugPrint('Error fetching messages: $e');
    } finally {
      isLoadingMessages = false;
      notifyListeners();
    }
  }

  void deselectConversation() {
    selectedConversation = null;
    messages = [];
    notifyListeners();
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
      fetchConversations();
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
