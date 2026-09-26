import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class ChatProvider extends ChangeNotifier {
  UserModel? currentUser;
  List<ConversationModel> conversations = [];
  ConversationModel? selectedConversation;
  List<MessageModel> messages = [];
  final Map<String, List<MessageModel>> _messagesCache = {};
  static const int _maxCachedConversations = 12;
  static const int _maxCachedMessages = 100;
  final Map<String, Future<Map<String, dynamic>>> _messageRequests = {};
  int _messageLoadRevision = 0;
  int _sessionRevision = 0;
  bool _disposed = false;

  void _cacheMessages(String id, List<MessageModel> value) {
    _messagesCache.remove(id);
    _messagesCache[id] = value.length > _maxCachedMessages
        ? value.sublist(value.length - _maxCachedMessages)
        : List<MessageModel>.from(value);
    while (_messagesCache.length > _maxCachedConversations) {
      _messagesCache.remove(_messagesCache.keys.first);
    }
  }

  Future<Map<String, dynamic>> _loadMessages(String id) {
    return _messageRequests.putIfAbsent(id, () {
      final request = ApiService.getMessages(id);
      // Remove only this request: logout may have started a new session.
      request.then((_) {
        if (identical(_messageRequests[id], request)) _messageRequests.remove(id);
      }, onError: (Object error, StackTrace stack) {
        if (identical(_messageRequests[id], request)) _messageRequests.remove(id);
      });
      return request;
    });
  }

  bool isLoadingConversations = false;
  bool isLoadingMessages = false;
  bool isPartnerTyping = false;
  Map<String, String> typingUsers = {};
  MessageModel? replyingToMessage;
  StreamSubscription? _socketSubscription;
  StreamSubscription? _recalledSubscription;
  StreamSubscription? _typingSubscription;
  StreamSubscription? _stopTypingSubscription;
  StreamSubscription? _reactedSubscription;
  StreamSubscription? _deliveredSubscription;
  StreamSubscription? _readSubscription;
  StreamSubscription? _userStatusSubscription;
  StreamSubscription? _nicknameSubscription;
  StreamSubscription? _conversationNicknamesSubscription;
  StreamSubscription? _profileUpdatedSubscription;
  StreamSubscription? _themeSubscription;

  /// Callback để thông báo cho UI cuộn xuống khi có tin nhắn mới
  VoidCallback? onNewMessageReceived;

  /// Callback khi mở cuộc trò chuyện mới để nhảy ngay xuống tin nhắn mới nhất
  VoidCallback? onConversationSelected;

  /// Tổng số tin nhắn chưa đọc từ tất cả cuộc trò chuyện
  int get totalUnreadCount {
    int total = 0;
    for (final c in conversations) {
      total += c.unreadCount;
    }
    return total;
  }

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
        if (typingUsers[convId] == nickname) return;
        typingUsers[convId] = nickname;
        if (selectedConversation?.id == convId) isPartnerTyping = true;
        notifyListeners();
      }
    });

    _stopTypingSubscription = SocketService.onUserStopTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      if (convId != null && typingUsers.containsKey(convId)) {
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

    _recalledSubscription = SocketService.onMessageRecalled.listen((data) {
      final msgId = data['messageId']?.toString();
      if (msgId != null && msgId.isNotEmpty) {
        final idx = messages.indexWhere((m) => m.id == msgId);
        if (idx != -1) {
          messages[idx] = messages[idx].copyWith(isRecalled: true);
          notifyListeners();
        }
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

    final handleNicknameUpdate = (dynamic rawData) {
      if (rawData is! Map) return;
      final data = Map<String, dynamic>.from(rawData);
      final convId = data['conversationId']?.toString();
      final userId = data['targetUserId']?.toString() ?? data['userId']?.toString();
      final nickname = data['newNickname']?.toString() ?? data['nickname']?.toString();
      final rawNicknames = data['nicknames'];
      Map<String, String>? nicknamesMap;
      if (rawNicknames is Map) {
        nicknamesMap = {};
        rawNicknames.forEach((k, v) {
          if (v != null && v.toString().trim().isNotEmpty) {
            nicknamesMap![k.toString()] = v.toString().trim();
          }
        });
      }
      if (convId != null && userId != null) {
        updateMemberNickname(convId, userId, nickname, newNicknamesMap: nicknamesMap);
      }
    };

    _nicknameSubscription = SocketService.onNicknameChanged.listen(handleNicknameUpdate);
    _conversationNicknamesSubscription = SocketService.onConversationNicknamesUpdated.listen(handleNicknameUpdate);

    _profileUpdatedSubscription = SocketService.onUserProfileUpdated.listen((data) {
      final updatedUserId = data['id']?.toString() ?? data['userId']?.toString();
      debugPrint('👤 Real-time user profile update for ID $updatedUserId');
      if (updatedUserId != null && currentUser != null && currentUser!.id == updatedUserId) {
        final updatedMap = Map<String, dynamic>.from(currentUser!.toJson());
        if (data['fullName'] != null) updatedMap['fullName'] = data['fullName'];
        if (data['bio'] != null) updatedMap['bio'] = data['bio'];
        if (data['avatar'] != null) updatedMap['avatar'] = data['avatar'];
        if (data['coverPhoto'] != null || data['coverImage'] != null) {
          updatedMap['coverImage'] = data['coverPhoto'] ?? data['coverImage'];
        }
        currentUser = UserModel.fromJson(updatedMap);
      }
      fetchConversations(showLoading: false);
      notifyListeners();
    });

    _themeSubscription = SocketService.onConversationThemeUpdated.listen((data) {
      final convId = data['conversationId']?.toString();
      final theme = data['theme']?.toString();
      if (convId != null && theme != null) {
        _updateConversationThemeLocally(convId, theme);
      }
    });
  }

  void _updateConversationThemeLocally(String convId, String theme) {
    final idx = conversations.indexWhere((c) => c.id == convId);
    if (idx != -1) {
      conversations[idx] = conversations[idx].copyWith(theme: theme);
    }
    if (selectedConversation != null && selectedConversation!.id == convId) {
      selectedConversation = selectedConversation!.copyWith(theme: theme);
    }
    notifyListeners();
  }

  Future<void> updateConversationTheme(String conversationId, String theme) async {
    // 1. Phản hồi tức thời trên giao diện (Optimistic UI)
    _updateConversationThemeLocally(conversationId, theme);

    // 2. Phát socket event cho đối phương
    SocketService.emitUpdateConversationTheme(conversationId, theme);

    // 3. Ghi vào database qua REST API
    try {
      await ApiService.updateConversationTheme(conversationId, theme);
    } catch (e) {
      debugPrint('⚠️ Error updating theme via API: $e');
    }
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

      bool isSame(String? a, String? b) {
        if (a == null || b == null) return false;
        if (a == b) return true;
        return a.replaceAll('\uFE0F', '').trim() == b.replaceAll('\uFE0F', '').trim();
      }

      if (isSame(updatedReactions[userId], emoji)) {
        updatedReactions.remove(userId);
      } else {
        updatedReactions[userId] = emoji;
      }

      messages[index] = msg.copyWith(reactions: updatedReactions);
      notifyListeners();
    }

    // Play local reaction sound immediately
    SocketService.playReactSound();

    // Emit socket event for real-time broadcast and DB persistence
    if (SocketService.isConnected) {
      SocketService.emitReactMessage(messageId, selectedConversation!.id, emoji);
    } else {
      // Call REST API fallback only when socket is disconnected
      ApiService.reactToMessage(messageId, emoji).catchError((e) {
        debugPrint('⚠️ Fallback react API error: $e');
      });
    }
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
          if (_processedMessageIdsForUnread.length > 2000) {
            _processedMessageIdsForUnread.remove(_processedMessageIdsForUnread.first);
          }
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

    // Chống trùng lặp tin nhắn hệ thống (system message) có cùng nội dung trong vòng 5 giây
    if (msg.type == 'system') {
      final isDupSystem = messages.any((m) =>
          m.type == 'system' &&
          (m.id == msg.id || (m.content == msg.content && m.createdAt.difference(msg.createdAt).inSeconds.abs() < 5)));
      if (isDupSystem) return;
    }

    // Chống spam / trùng lặp cuộc gọi nhỡ (trong vòng 15 giây)
    if (msg.type == 'missed_call' || msg.type == 'call' || msg.type == 'video_call') {
      final isDupCall = messages.any((m) =>
          (m.type == 'missed_call' || m.type == 'call' || m.type == 'video_call') &&
          m.conversationId == msg.conversationId &&
          m.createdAt.difference(msg.createdAt).inSeconds.abs() < 15);
      if (isDupCall) return;
    }

    // Kiểm tra trùng lặp (bao gồm cả optimistic message và socket relay message)
    final existingIdx = messages.indexWhere((m) => m.id == msg.id);
    if (existingIdx != -1) {
      // Cập nhật tin nhắn đã có (thay thế optimistic/relay bằng real)
      messages[existingIdx] = msg;
    } else {
      // Kiểm tra xem có phải tin nhắn đã có dạng tạm (optimistic-* hoặc rt-*)
      final tempIdx = messages.indexWhere((m) =>
          (m.id.startsWith('optimistic-') || m.id.startsWith('rt-')) &&
          m.content == msg.content &&
          m.senderId == msg.senderId);
      if (tempIdx != -1) {
        messages[tempIdx] = msg;
      } else {
        messages.add(msg);
      }
    }

    if (selectedConversation != null) {
      _cacheMessages(selectedConversation!.id, messages);
    }

    notifyListeners();

    // Gọi callback để UI cuộn xuống
    onNewMessageReceived?.call();
  }

  Future<void> setCurrentUser(Map<String, dynamic> userJson) async {
    if (currentUser?.id != userJson['id']?.toString()) {
      clearCurrentUser();
    }
    currentUser = UserModel.fromJson(userJson);
    if (currentUser != null && currentUser!.id.isNotEmpty) {
      SocketService.connect(userId: currentUser!.id);
    }
    notifyListeners();
  }

  void clearCurrentUser() {
    _sessionRevision++;
    _messageLoadRevision++;
    _messageRequests.clear();
    _messagesCache.clear();
    _processedMessageIdsForUnread.clear();
    typingUsers.clear();
    isPartnerTyping = false;
    replyingToMessage = null;
    selectedConversationId = null;
    isLoadingMessages = false;
    isLoadingConversations = false;
    _isFetchingConversations = false;
    _lastFetchTime = null;
    currentUser = null;
    selectedConversation = null;
    messages = [];
    conversations = [];
    notifyListeners();
  }

  Future<void> _loadCachedConversations() async {
    final userId = currentUser?.id;
    if (userId == null) return;
    final session = _sessionRevision;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_disposed || session != _sessionRevision) return;
      final cachedStr = prefs.getString('cached_conversations_$userId');
      if (cachedStr != null && cachedStr.isNotEmpty && conversations.isEmpty) {
        final decoded = jsonDecode(cachedStr);
        if (decoded is List) {
          conversations = decoded
              .map((c) => ConversationModel.fromJson(c, currentUserId: currentUser?.id))
              .toList();
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  bool _isFetchingConversations = false;
  DateTime? _lastFetchTime;

  Future<void> fetchConversations({bool showLoading = true}) async {
    // Debounce: Nếu đang fetch hoặc vừa fetch trong vòng 2.5s thì bỏ qua
    if (_isFetchingConversations) return;
    if (_lastFetchTime != null && DateTime.now().difference(_lastFetchTime!).inMilliseconds < 2500) {
      return;
    }
    final session = _sessionRevision;
    _lastFetchTime = DateTime.now();
    _isFetchingConversations = true;

    // Tải cache cục bộ trước nếu chưa có dữ liệu để hiển thị tức thì không chờ đợi
    if (conversations.isEmpty) {
      await _loadCachedConversations();
    }

    if (_disposed || session != _sessionRevision) return;
    if (showLoading && conversations.isEmpty) {
      isLoadingConversations = true;
      notifyListeners();
    }

    try {
      if (currentUser == null) {
        final meRes = await ApiService.getMe();
        if (_disposed || session != _sessionRevision) return;
        final userObj = meRes['data'] ?? meRes['user'];
        if (userObj is Map<String, dynamic>) {
          currentUser = UserModel.fromJson(userObj);
        }
      }
      final rawList = await ApiService.getConversations();
      if (_disposed || session != _sessionRevision) return;
      if (rawList != null) {
        final parsed = rawList
            .map((c) {
              try {
                return ConversationModel.fromJson(c, currentUserId: currentUser?.id);
              } catch (err) {
                debugPrint('Lỗi parse 1 conversation: $err');
                return null;
              }
            })
            .whereType<ConversationModel>()
            .toList();

        // 🛡️ BẢO VỆ: Nếu đã có danh sách cuộc trò chuyện mà kết quả mới rỗng, không xóa mất giao diện của người dùng!
        if (parsed.isNotEmpty || conversations.isEmpty) {
          conversations = parsed;
          try {
            final prefs = await SharedPreferences.getInstance();
            if (!_disposed && session == _sessionRevision && currentUser != null) {
              await prefs.setString('cached_conversations_${currentUser!.id}', jsonEncode(rawList));
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      debugPrint('Error fetching conversations: $e');
    } finally {
      if (!_disposed && session == _sessionRevision) {
        _isFetchingConversations = false;
        isLoadingConversations = false;
        notifyListeners();
      }
    }
  }

  String? selectedConversationId;
  bool showUnreadOnly = false;

  void setShowUnreadOnly(bool val) {
    showUnreadOnly = val;
    notifyListeners();
  }

  void clearSelectedConversation() {
    if (selectedConversation != null) _cacheMessages(selectedConversation!.id, messages);
    _messageLoadRevision++;
    isLoadingMessages = false;
    isPartnerTyping = false;
    replyingToMessage = null;
    selectedConversation = null;
    selectedConversationId = null;
    messages = [];
    notifyListeners();
  }

  Future<void> selectConversation(ConversationModel conv) async {
    if (selectedConversation != null) _cacheMessages(selectedConversation!.id, messages);
    final revision = ++_messageLoadRevision;
    final session = _sessionRevision;
    selectedConversation = conv;
    isPartnerTyping = typingUsers.containsKey(conv.id);
    replyingToMessage = null;
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

    // ⚡ INSTANT DISPLAY: Nếu đã có cache tin nhắn của cuộc trò chuyện này, hiển thị ngay lập tức (0ms)
    if (_messagesCache.containsKey(conv.id) && _messagesCache[conv.id]!.isNotEmpty) {
      messages = List.from(_messagesCache[conv.id]!);
      isLoadingMessages = false;
    } else {
      isLoadingMessages = true;
      messages = [];
    }
    notifyListeners();

    // Báo cho server socket & REST API biết người dùng đã xem tất cả tin nhắn trong cuộc trò chuyện này
    if (currentUser != null) {
      SocketService.markMessagesRead(conv.id, currentUser!.id);
    }
    ApiService.markAsRead(conv.id).catchError((_) {});

    // Join vào room của conversation để nhận tin nhắn real-time
    SocketService.joinRoom(conv.id);

    final messagesAtStart = {for (final message in messages) message.id: message};
    try {
      final res = await _loadMessages(conv.id);
      if (_disposed || session != _sessionRevision || revision != _messageLoadRevision || selectedConversation?.id != conv.id) return;
      final rawData = res['data'] as List? ?? [];
      final fetched = rawData.map((m) {
        if (m is Map<String, dynamic>) return MessageModel.fromJson(m);
        if (m is Map) return MessageModel.fromJson(Map<String, dynamic>.from(m));
        return null;
      }).whereType<MessageModel>().toList();

      final List<MessageModel> cleanFetched = [];
      final systemTimesByContent = <String, List<DateTime>>{};
      final callTimes = <DateTime>[];
      for (final m in fetched) {
        if (m.type == 'system') {
          final times = systemTimesByContent.putIfAbsent(m.content, () => []);
          final hasDup = times.any((time) => time.difference(m.createdAt).inSeconds.abs() < 5);
          if (hasDup) continue;
          times.add(m.createdAt);
        }
        if (m.type == 'missed_call' || m.type == 'call' || m.type == 'video_call') {
          final hasDupCall = callTimes.any((time) => time.difference(m.createdAt).inSeconds.abs() < 15);
          if (hasDupCall) continue;
          callTimes.add(m.createdAt);
        }
        cleanFetched.add(m);
      }

      // Preserve messages/receipts/reactions received while the HTTP request ran.
      final merged = {for (final message in cleanFetched) message.id: message};
      for (final message in messages) {
        if (!identical(messagesAtStart[message.id], message) ||
            message.id.startsWith('optimistic-') || message.id.startsWith('rt-')) {
          final temporary = message.id.startsWith('optimistic-') || message.id.startsWith('rt-');
          final acknowledged = temporary && cleanFetched.any((item) =>
              item.senderId == message.senderId && item.content == message.content &&
              item.createdAt.difference(message.createdAt).inSeconds.abs() < 30);
          if (!acknowledged) merged[message.id] = message;
        }
      }
      messages = merged.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      _cacheMessages(conv.id, messages);
    } catch (e) {
      debugPrint('Error fetching messages: $e');
    } finally {
      if (!_disposed && session == _sessionRevision && revision == _messageLoadRevision && selectedConversation?.id == conv.id) {
        isLoadingMessages = false;
        notifyListeners();
        if (messagesAtStart.isEmpty) onConversationSelected?.call();
      }
    }
  }

  void deselectConversation() {
    SocketService.leaveRoom();
    clearSelectedConversation();
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
    final conversation = selectedConversation!;
    final session = _sessionRevision;

    emitStopTyping();
    SocketService.playSendSound();

    final replyId = replyingToMessage?.id;
    replyingToMessage = null;

    // Optimistic UI message (Hiển thị tức thì trên màn hình)
    final optId = 'optimistic-${DateTime.now().microsecondsSinceEpoch}';
    final optMsg = MessageModel(
      id: optId,
      conversationId: conversation.id,
      senderId: currentUser?.id,
      content: text,
      type: type,
      replyMessageId: replyId,
      createdAt: DateTime.now(),
    );

    messages.add(optMsg);
    _cacheMessages(conversation.id, messages);
    _updateLastMessageInConversation(optMsg);
    notifyListeners();
    onNewMessageReceived?.call();

    // ⚡ Bắn tín hiệu tin nhắn tức thời qua Socket.IO (<20ms)
    if (SocketService.socket != null && SocketService.socket!.connected) {
      SocketService.socket!.emit('send_message', {
        'conversationId': conversation.id,
        'content': text,
        'type': type,
        'tempId': optId,
        'senderId': currentUser?.id,
        'senderName': currentUser?.fullName,
        'replyMessageId': replyId,
        'receiverId': conversation.targetUserId,
        'memberIds': conversation.members.map((m) => m.id).toList(),
      });
    }

    try {
      final res = await ApiService.sendMessage(
        conversation.id,
        text,
        type: type,
        replyMessageId: replyId,
      );
      if (_disposed || session != _sessionRevision) return;
      final msgData = res['data'] ?? (res['success'] == true ? res : null);
      if (msgData is Map<String, dynamic>) {
        final realMsg = MessageModel.fromJson(msgData);
        final targetMessages = selectedConversation?.id == conversation.id
            ? messages : (_messagesCache[conversation.id] ?? <MessageModel>[]);
        final idx = targetMessages.indexWhere((m) => m.id == optId);
        final realIdx = targetMessages.indexWhere((m) => m.id == realMsg.id);
        if (realIdx != -1) {
          targetMessages[realIdx] = realMsg;
          targetMessages.removeWhere((m) => m.id == optId);
        } else if (idx != -1) {
          targetMessages[idx] = realMsg;
        } else {
          targetMessages.add(realMsg);
        }
        _cacheMessages(conversation.id, targetMessages);
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
        _messagesCache.remove(conversationId);
        conversations.removeWhere((c) => c.id == conversationId);
        if (selectedConversation != null && selectedConversation!.id == conversationId) {
          clearSelectedConversation();
        }
        _messagesCache.remove(conversationId);
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
    final cleanNick = (nickname != null && nickname.trim().isNotEmpty) ? nickname.trim() : null;

    // 1. Phản hồi tức thì trên UI (Optimistic UI)
    updateMemberNickname(conversationId, userId, cleanNick);

    // 2. Phát socket event cho đối phương
    SocketService.emitUpdateNickname(conversationId, userId, cleanNick);

    // 3. Gọi REST API song song để lưu DB
    final success = await ApiService.updateNickname(conversationId, userId, cleanNick);
    return success;
  }

  void updateMemberNickname(String conversationId, String userId, String? nickname, {Map<String, String>? newNicknamesMap}) {
    bool updated = false;
    for (int i = 0; i < conversations.length; i++) {
      if (conversations[i].id == conversationId) {
        final conv = conversations[i];
        final cleanNickname = (nickname != null && nickname.trim().isNotEmpty) ? nickname.trim() : null;

        Map<String, String> updatedNicknames = Map<String, String>.from(conv.nicknames ?? {});
        if (newNicknamesMap != null) {
          updatedNicknames = Map<String, String>.from(newNicknamesMap);
        } else {
          if (cleanNickname != null) {
            updatedNicknames[userId] = cleanNickname;
          } else {
            updatedNicknames.remove(userId);
          }
        }

        final memberIndex = conv.members.indexWhere((m) => m.id == userId);
        List<UserModel> updatedMembers = List<UserModel>.from(conv.members);
        if (memberIndex != -1) {
          final oldMember = updatedMembers[memberIndex];
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
        }

        String newConvName = conv.name;
        if (conv.type == 'private') {
          final partnerId = conv.targetUserId ?? (memberIndex != -1 ? updatedMembers[memberIndex].id : null);
          if (partnerId != null) {
            if (updatedNicknames.containsKey(partnerId) && updatedNicknames[partnerId]!.isNotEmpty) {
              newConvName = updatedNicknames[partnerId]!;
            } else {
              final partner = updatedMembers.firstWhere(
                (m) => m.id == partnerId,
                orElse: () => UserModel(id: partnerId, username: '', fullName: ''),
              );
              if (partner.fullName.isNotEmpty) {
                newConvName = partner.fullName;
              }
            }
          }
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
          theme: conv.theme,
          nicknames: updatedNicknames.isNotEmpty ? updatedNicknames : null,
        );

        if (selectedConversation?.id == conversationId) {
          selectedConversation = conversations[i];
        }
        updated = true;
      }
    }
    if (updated) {
      notifyListeners();
    }
  }

  /// Thu hồi tin nhắn
  Future<bool> recallMessage(String messageId) async {
    final success = await ApiService.recallMessage(messageId);
    if (success) {
      final idx = messages.indexWhere((m) => m.id == messageId);
      if (idx != -1) {
        messages[idx] = messages[idx].copyWith(isRecalled: true);
        notifyListeners();
      }
      if (selectedConversation != null) {
        SocketService.emitRecallMessage(messageId, selectedConversation!.id);
      }
      return true;
    }
    return false;
  }

  @override
  void dispose() {
    _disposed = true;
    _sessionRevision++;
    _messageLoadRevision++;
    _conversationNicknamesSubscription?.cancel();
    _socketSubscription?.cancel();
    _recalledSubscription?.cancel();
    _typingSubscription?.cancel();
    _stopTypingSubscription?.cancel();
    _reactedSubscription?.cancel();
    _deliveredSubscription?.cancel();
    _readSubscription?.cancel();
    _userStatusSubscription?.cancel();
    _nicknameSubscription?.cancel();
    _profileUpdatedSubscription?.cancel();
    _themeSubscription?.cancel();
    super.dispose();
  }
}
