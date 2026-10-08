import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/network_status.dart';
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
  bool _chatVisible = true;
  final Map<String, Set<String>> _readMessageIds = {};
  final Map<String, DateTime> _readThrough = {};

  MessageModel _withReadReceipt(MessageModel message, {MessageModel? previous}) {
    final through = _readThrough[message.conversationId];
    final confirmed = message.senderId == currentUser?.id &&
        ((_readMessageIds[message.conversationId]?.contains(message.id) ?? false) ||
          (through != null && message.status != 'sending' && !message.createdAt.isAfter(through)));
    final read = message.isRead || previous?.isRead == true || confirmed;
    return message.copyWith(isRead: read,
        isDelivered: read || message.isDelivered || previous?.isDelivered == true);
  }

  void applyReadReceipt(Map<String, dynamic> data) {
    final conversationId = data['conversationId']?.toString();
    final reader = data['readBy']?.toString();
    if (conversationId == null || reader == null || reader == currentUser?.id) return;
    final lastId = data['lastReadMessageId']?.toString();
    final through = DateTime.tryParse(data['lastReadCreatedAt']?.toString() ?? '');
    if (through != null && (_readThrough[conversationId] == null || through.isAfter(_readThrough[conversationId]!))) {
      _readThrough[conversationId] = through;
    }
    final ids = _readMessageIds.putIfAbsent(conversationId, () => <String>{});
    if (lastId != null) ids.add(lastId);
    final list = selectedConversation?.id == conversationId ? messages :
        (_messagesCache[conversationId] ?? <MessageModel>[]);
    final boundary = list.indexWhere((message) => message.id == lastId);
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      if (i <= boundary && list[i].senderId == currentUser?.id) ids.add(list[i].id);
      final updated = _withReadReceipt(list[i]);
      if (!_messagesEquivalent(list[i], updated)) { list[i] = updated; changed = true; }
    }
    while (ids.length > 100) { ids.remove(ids.first); }
    while (_readMessageIds.length > 12) {
      final oldest = _readMessageIds.keys.first;
      _readMessageIds.remove(oldest); _readThrough.remove(oldest);
    }
    if (changed) { _cacheMessages(conversationId, list); notifyListeners(); }
  }

  void setChatVisible(bool visible) {
    _chatVisible = visible;
    if (visible) markSelectedConversationRead();
  }

  void markSelectedConversationRead() {
    if (!NetworkStatus.online.value) return;
    final id = selectedConversation?.id;
    if (!_chatVisible || currentUser == null || id == null) return;
    if (SocketService.isConnected) {
      SocketService.markMessagesRead(id, currentUser!.id);
    } else { ApiService.markAsRead(id).catchError((_) {}); }
  }
  SharedPreferences? _sharedPreferences;
  final Map<String, Timer> _messageCacheTimers = {};
  static const int _maxLocalMessageCacheChars = 512 * 1024;
  static const int _maxCachedMessageChars = 32 * 1024;

  bool _hasNearbyTimestamp(
      List<DateTime> times, DateTime timestamp, int seconds) {
    final timestampMicros = timestamp.microsecondsSinceEpoch;
    final windowMicros = seconds * Duration.microsecondsPerSecond;
    final lowerBound = timestampMicros - windowMicros;
    final upperBound = timestampMicros + windowMicros;
    var low = 0;
    var high = times.length;
    while (low < high) {
      final middle = (low + high) >> 1;
      if (times[middle].microsecondsSinceEpoch < lowerBound) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    for (var i = low;
        i < times.length && times[i].microsecondsSinceEpoch <= upperBound;
        i++) {
      if (times[i].difference(timestamp).inSeconds.abs() < seconds) return true;
    }
    return false;
  }

  void _insertTimestamp(List<DateTime> times, DateTime timestamp) {
    var low = 0;
    var high = times.length;
    final value = timestamp.microsecondsSinceEpoch;
    while (low < high) {
      final middle = (low + high) >> 1;
      if (times[middle].microsecondsSinceEpoch < value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    times.insert(low, timestamp);
  }

  void _cacheMessages(String id, List<MessageModel> value) {
    _messagesCache.remove(id);
    final trimmed = value.length > _maxCachedMessages
        ? value.sublist(value.length - _maxCachedMessages)
        : List<MessageModel>.from(value);
    _messagesCache[id] = trimmed;
    while (_messagesCache.length > _maxCachedConversations) {
      _messagesCache.remove(_messagesCache.keys.first);
    }
    _scheduleSaveLocalCachedMessages(id, trimmed);
  }

  void _scheduleSaveLocalCachedMessages(
      String convId, List<MessageModel> msgs) {
    _messageCacheTimers.remove(convId)?.cancel();
    if (msgs.isEmpty) return;
    // Cache writes are deliberately coalesced: socket bursts and an HTTP refresh
    // should not repeatedly encode the same history on the UI isolate.
    _messageCacheTimers[convId] = Timer(const Duration(milliseconds: 250), () {
      _messageCacheTimers.remove(convId);
      _saveLocalCachedMessages(convId, msgs);
    });
  }

  Map<String, dynamic>? _localMessageJson(MessageModel message) {
    final json = message.toJson();
    final content = json['content']?.toString() ?? '';
    final media = <String?>[
      json['imageUrl']?.toString(),
      json['videoUrl']?.toString(),
      json['audioUrl']?.toString(),
    ];
    final hasInlineMedia = content.startsWith('data:image') ||
        content.startsWith('data:video') ||
        content.startsWith('data:audio') ||
        media.any((value) => value != null && value.startsWith('data:'));
    if (hasInlineMedia &&
        (content.length > _maxCachedMessageChars ||
            media.any((value) =>
                value != null && value.length > _maxCachedMessageChars))) {
      return null;
    }
    return json;
  }

  void _saveLocalCachedMessages(String convId, List<MessageModel> msgs) {
    if (msgs.isEmpty || _disposed) return;
    try {
      final raw = <String>[];
      var chars = 2;
      for (final message in msgs.reversed) {
        final encoded = _localMessageJson(message);
        if (encoded == null) continue;
        final encodedMessage = jsonEncode(encoded);
        final candidateChars = encodedMessage.length;
        if (candidateChars + 2 > _maxLocalMessageCacheChars) continue;
        final separatorChars = raw.isEmpty ? 0 : 1;
        if (chars + candidateChars + separatorChars > _maxLocalMessageCacheChars) break;
        raw.add(encodedMessage);
        chars += candidateChars + separatorChars;
      }
      if (raw.isEmpty) {
        final prefs = _sharedPreferences;
        if (prefs != null) {
          unawaited(prefs.remove('cached_msgs_$convId'));
        } else {
          SharedPreferences.getInstance().then((p) async {
            if (_disposed) return false;
            _sharedPreferences = p;
            return await p.remove('cached_msgs_$convId');
          }).catchError((_) => false);
        }
        return;
      }
      final jsonStr = '[${raw.reversed.join(',')}]';
      final prefs = _sharedPreferences;
      if (prefs != null) {
        unawaited(prefs.setString('cached_msgs_$convId', jsonStr));
      } else {
        SharedPreferences.getInstance().then((p) async {
          if (_disposed) return false;
          _sharedPreferences = p;
          return await p.setString('cached_msgs_$convId', jsonStr);
        }).catchError((_) => false);
      }
    } catch (_) {}
  }

  List<MessageModel>? _loadLocalCachedMessages(String convId) {
    try {
      final str = _sharedPreferences?.getString('cached_msgs_$convId');
      if (str != null && str.isNotEmpty) {
        final decoded = jsonDecode(str);
        if (decoded is List) {
          final list = decoded
              .map((m) {
                try {
                  return MessageModel.fromJson(Map<String, dynamic>.from(m));
                } catch (_) {
                  return null;
                }
              })
              .whereType<MessageModel>()
              .toList();
          if (list.isNotEmpty) return list;
        }
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>> _loadMessages(String id) {
    return _messageRequests.putIfAbsent(id, () {
      final request = ApiService.getMessages(id);
      // Remove only this request: logout may have started a new session.
      request.then((_) {
        if (identical(_messageRequests[id], request))
          _messageRequests.remove(id);
      }, onError: (Object error, StackTrace stack) {
        if (identical(_messageRequests[id], request))
          _messageRequests.remove(id);
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
    SharedPreferences.getInstance().then<void>((p) {
      if (!_disposed) _sharedPreferences = p;
    }).catchError((Object _) {});
    NetworkStatus.initialize();
    NetworkStatus.online.addListener(_onNetworkChanged);
    _initSocket();
  }

  void _onNetworkChanged() {
    if (NetworkStatus.online.value) _lastFetchTime = null;
    if (!_disposed) notifyListeners();
  }

  void _initSocket() {
    _socketSubscription = SocketService.onMessageReceived.listen((data) {
      print('📨 ChatProvider nhận tin nhắn từ socket: ${data['id']}');
      final newMsg = MessageModel.fromJson(data);
      final messageChanged = addRealtimeMessage(newMsg, notify: false);
      final conversationChanged =
          _updateLastMessageInConversation(newMsg, notify: false);
      if (messageChanged || conversationChanged) {
        notifyListeners();
        if (messageChanged) onNewMessageReceived?.call();
      }
      if (newMsg.senderId != currentUser?.id) {
        SocketService.playReceiveSound();
        SocketService.emitMarkAsDelivered(newMsg.id,
            conversationId: newMsg.conversationId);
        if (_chatVisible && selectedConversation != null &&
            selectedConversation!.id == newMsg.conversationId &&
            currentUser != null) {
          SocketService.emitMarkAsRead(newMsg.id,
              conversationId: newMsg.conversationId);
        }
      }
    });

    _typingSubscription = SocketService.onUserTyping.listen((data) {
      final convId = data['conversationId']?.toString();
      final uid = data['userId']?.toString() ?? data['senderId']?.toString();
      final nickname = data['nickname']?.toString() ??
          data['senderName']?.toString() ??
          'Người dùng';

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
        if (selectedConversation != null &&
            selectedConversation!.id == convId) {
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

    _readSubscription = SocketService.onMessagesRead.listen(applyReadReceipt);

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
      final userId =
          data['targetUserId']?.toString() ?? data['userId']?.toString();
      final nickname =
          data['newNickname']?.toString() ?? data['nickname']?.toString();
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
        updateMemberNickname(convId, userId, nickname,
            newNicknamesMap: nicknamesMap);
      }
    };

    _nicknameSubscription =
        SocketService.onNicknameChanged.listen(handleNicknameUpdate);
    _conversationNicknamesSubscription = SocketService
        .onConversationNicknamesUpdated
        .listen(handleNicknameUpdate);

    _profileUpdatedSubscription =
        SocketService.onUserProfileUpdated.listen((data) {
      final updatedUserId =
          data['id']?.toString() ?? data['userId']?.toString();
      debugPrint('👤 Real-time user profile update for ID $updatedUserId');
      if (updatedUserId != null &&
          currentUser != null &&
          currentUser!.id == updatedUserId) {
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

    _themeSubscription =
        SocketService.onConversationThemeUpdated.listen((data) {
      final convId = data['conversationId']?.toString();
      final theme = data['theme']?.toString();
      if (convId != null && theme != null) {
        _updateConversationThemeLocally(convId, theme);
        unawaited(_persistConversationThemes());
      }
    });
  }

  int _themeRevision = 0;
  void _updateConversationThemeLocally(String convId, String theme) {
    _themeRevision++;
    final idx = conversations.indexWhere((c) => c.id == convId);
    if (idx != -1) {
      conversations[idx] = conversations[idx].copyWith(theme: theme);
    }
    if (selectedConversation != null && selectedConversation!.id == convId) {
      selectedConversation = selectedConversation!.copyWith(theme: theme);
    }
    notifyListeners();
  }

  final Set<String> _themeUpdates = {};
  Future<bool> updateConversationTheme(String conversationId, String theme) async {
    if (!NetworkStatus.online.value || !_themeUpdates.add(conversationId)) return false;
    final session = _sessionRevision;
    final conv = selectedConversation?.id == conversationId ? selectedConversation :
        conversations.where((c) => c.id == conversationId).firstOrNull;
    final previous = conv?.theme ?? 'classic';
    _updateConversationThemeLocally(conversationId, theme);
    try {
      final response = await ApiService.updateConversationTheme(conversationId, theme);
      if (response['success'] != true) throw StateError('Không lưu được chủ đề');
      if (_disposed || session != _sessionRevision) return false;
      await _persistConversationThemes();
      return true;
    } catch (_) {
      if (!_disposed && session == _sessionRevision) {
        final current = selectedConversation?.id == conversationId ? selectedConversation :
            conversations.where((c) => c.id == conversationId).firstOrNull;
        if (current?.theme == theme) _updateConversationThemeLocally(conversationId, previous);
      }
      return false;
    } finally { _themeUpdates.remove(conversationId); }
  }

  Future<void> _persistConversationThemes() async {
    final userId = currentUser?.id;
    if (userId == null) return;
    final prefs = await SharedPreferences.getInstance();
    if (_disposed || currentUser?.id != userId) return;
    final raw = prefs.getString('cached_conversations_$userId');
    if (raw == null) return;
    try {
      final list = jsonDecode(raw) as List;
      for (final entry in list.whereType<Map>()) {
        final matches = conversations.where((c) => c.id == entry['id']);
        if (matches.isNotEmpty) entry['theme'] = matches.first.theme;
      }
      await prefs.setString('cached_conversations_$userId', jsonEncode(list));
    } catch (_) {}
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
      final Map<String, String> updatedReactions =
          Map<String, String>.from(msg.reactions);
      final userId = currentUser!.id;

      bool isSame(String? a, String? b) {
        if (a == null || b == null) return false;
        if (a == b) return true;
        return a.replaceAll('\uFE0F', '').trim() ==
            b.replaceAll('\uFE0F', '').trim();
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
      SocketService.emitReactMessage(
          messageId, selectedConversation!.id, emoji);
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

  bool _updateLastMessageInConversation(MessageModel msg,
      {bool notify = true}) {
    if (msg.conversationId == null || msg.conversationId!.isEmpty) return false;
    final idx = conversations.indexWhere((c) => c.id == msg.conversationId);
    if (idx == -1) return false;
    final old = conversations[idx];
    final isFromSelf = (currentUser != null &&
        msg.senderId != null &&
        msg.senderId == currentUser!.id);
    final isCurrentlySelected =
        (selectedConversation != null && selectedConversation!.id == old.id);

    int newUnreadCount = old.unreadCount;
    if (isFromSelf || isCurrentlySelected) {
      newUnreadCount = 0;
    } else if (msg.id.isNotEmpty &&
        !_processedMessageIdsForUnread.contains(msg.id)) {
      _processedMessageIdsForUnread.add(msg.id);
      if (_processedMessageIdsForUnread.length > 2000) {
        _processedMessageIdsForUnread
            .remove(_processedMessageIdsForUnread.first);
      }
      newUnreadCount = old.unreadCount + 1;
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
      theme: old.theme,
      nicknames: old.nicknames,
    );
    if (old.lastMessage == updatedConv.lastMessage &&
        old.unreadCount == updatedConv.unreadCount &&
        old.updatedAt == updatedConv.updatedAt &&
        idx == 0) {
      return false;
    }
    conversations.removeAt(idx);
    conversations.insert(0, updatedConv);
    if (notify) notifyListeners();
    return true;
  }

  bool _messagesEquivalent(MessageModel left, MessageModel right) {
    if (left.id != right.id ||
        left.content != right.content ||
        left.type != right.type ||
        left.senderId != right.senderId ||
        left.imageUrl != right.imageUrl ||
        left.videoUrl != right.videoUrl ||
        left.audioUrl != right.audioUrl ||
        left.replyMessageId != right.replyMessageId ||
        left.status != right.status ||
        left.clientTempId != right.clientTempId ||
        left.createdAt != right.createdAt ||
        left.isRead != right.isRead ||
        left.isDelivered != right.isDelivered ||
        left.isRecalled != right.isRecalled ||
        left.isForwarded != right.isForwarded ||
        left.reactions.length != right.reactions.length) {
      return false;
    }
    for (final entry in left.reactions.entries) {
      if (right.reactions[entry.key] != entry.value) return false;
    }
    return true;
  }

  /// Thêm tin nhắn real-time vào danh sách, tránh trùng lặp
  bool addRealtimeMessage(MessageModel msg, {bool notify = true}) {
    msg = _withReadReceipt(msg);
    if (selectedConversation == null) return false;
    if (msg.conversationId != null &&
        msg.conversationId!.isNotEmpty &&
        msg.conversationId != selectedConversation!.id) {
      return false;
    }

    if (msg.type == 'system') {
      final isDupSystem = messages.any((m) =>
          m.type == 'system' &&
          (m.id == msg.id ||
              (m.content == msg.content &&
                  m.createdAt.difference(msg.createdAt).inSeconds.abs() < 5)));
      if (isDupSystem) return false;
    }

    if (msg.type == 'missed_call' ||
        msg.type == 'call' ||
        msg.type == 'video_call') {
      final isDupCall = messages.any((m) =>
          (m.type == 'missed_call' ||
              m.type == 'call' ||
              m.type == 'video_call') &&
          m.conversationId == msg.conversationId &&
          m.createdAt.difference(msg.createdAt).inSeconds.abs() < 15);
      if (isDupCall) return false;
    }

    final existingIdx = messages.indexWhere((m) => m.id == msg.id);
    if (existingIdx != -1) {
      if (_messagesEquivalent(messages[existingIdx], msg)) return false;
      messages[existingIdx] = _withReadReceipt(msg, previous: messages[existingIdx]);
    } else {
      final tempIdx = messages.indexWhere((m) =>
          ((msg.clientTempId != null &&
                  msg.clientTempId!.isNotEmpty &&
                  (m.id == msg.clientTempId ||
                      m.clientTempId == msg.clientTempId)) ||
              ((msg.clientTempId == null || msg.clientTempId!.isEmpty) &&
                  (m.id.startsWith('optimistic-') || m.id.startsWith('rt-')) &&
                  m.senderId == msg.senderId &&
                  (m.content == msg.content ||
                      (m.type == msg.type && m.type != 'text')))));
      if (tempIdx != -1) {
        final previous = messages[tempIdx];
        final incomingTemporary = msg.id.startsWith('optimistic-') || msg.id.startsWith('rt-');
        final previousTemporary = previous.id.startsWith('optimistic-') || previous.id.startsWith('rt-');
        if (incomingTemporary && !previousTemporary) return false;
        messages[tempIdx] = _withReadReceipt(msg, previous: messages[tempIdx]);
      } else {
        messages.add(msg);
      }
    }

    _cacheMessages(selectedConversation!.id, messages);
    if (notify) {
      notifyListeners();
      onNewMessageReceived?.call();
    }
    return true;
  }

  Future<void> setCurrentUser(Map<String, dynamic> userJson) async {
    final token = await ApiService.getToken();
    if (currentUser?.id != userJson['id']?.toString()) {
      clearCurrentUser();
    }
    await ApiService.cacheSessionUser(userJson);
    if (_disposed || token != await ApiService.getToken()) return;
    currentUser = UserModel.fromJson(userJson);
    if (NetworkStatus.online.value && currentUser != null && currentUser!.id.isNotEmpty) {
      SocketService.connect(userId: currentUser!.id);
    }
    notifyListeners();
  }

  void clearCurrentUser() {
    _sessionRevision++;
    _messageLoadRevision++;
    _messageRequests.clear();
    _readMessageIds.clear();
    _readThrough.clear();
    _preloadFuture = null;
    _messageCacheTimers.values.forEach((timer) => timer.cancel());
    _messageCacheTimers.clear();
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

  List<ConversationModel> _deduplicateConversationList(List<ConversationModel> list) {
    final seenConvIds = <String>{};
    final seenPartnerIds = <String>{};
    final result = <ConversationModel>[];

    for (final conv in list) {
      if (conv.id.isEmpty || seenConvIds.contains(conv.id)) continue;

      if (!conv.isGroup) {
        final partnerId = conv.targetUserId?.trim();
        if (partnerId != null && partnerId.isNotEmpty) {
          if (seenPartnerIds.contains(partnerId)) {
            continue;
          }
          seenPartnerIds.add(partnerId);
        }
      }

      seenConvIds.add(conv.id);
      result.add(conv);
    }
    return result;
  }

  Future<void> _loadCachedConversations() async {
    final userId = currentUser?.id;
    if (userId == null) return;
    final session = _sessionRevision;
    try {
      final prefs = await SharedPreferences.getInstance();
      _sharedPreferences = prefs;
      if (_disposed || session != _sessionRevision) return;
      final cachedStr = prefs.getString('cached_conversations_$userId');
      if (cachedStr != null && cachedStr.isNotEmpty && conversations.isEmpty) {
        final decoded = jsonDecode(cachedStr);
        if (decoded is List) {
          final loaded = decoded
              .map((c) =>
                  ConversationModel.fromJson(c, currentUserId: currentUser?.id))
              .toList();
          conversations = _deduplicateConversationList(loaded);
          for (final c in conversations.take(8)) {
            final msgs = _loadLocalCachedMessages(c.id);
            if (msgs != null && msgs.isNotEmpty) {
              _messagesCache[c.id] = msgs;
            }
          }
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  bool _isFetchingConversations = false;
  DateTime? _lastFetchTime;

  Future<void> fetchConversations({bool showLoading = true, bool preload = true}) async {
    // Debounce: Nếu đang fetch hoặc vừa fetch trong vòng 2.5s thì bỏ qua
    if (_isFetchingConversations) return;
    if (_lastFetchTime != null &&
        DateTime.now().difference(_lastFetchTime!).inMilliseconds < 2500) {
      return;
    }
    final session = _sessionRevision;
    final themeRevision = _themeRevision;
    _lastFetchTime = DateTime.now();
    _isFetchingConversations = true;

    // Tải cache cục bộ trước nếu chưa có dữ liệu để hiển thị tức thì không chờ đợi
    if (conversations.isEmpty) {
      await _loadCachedConversations();
    }

    if (_disposed || session != _sessionRevision) return;
    if (!NetworkStatus.online.value) { _isFetchingConversations = false; return; }
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
                final parsed = ConversationModel.fromJson(c, currentUserId: currentUser?.id);
                if (themeRevision != _themeRevision || _themeUpdates.contains(parsed.id)) {
                  final current = selectedConversation?.id == parsed.id ? selectedConversation :
                    conversations.where((item) => item.id == parsed.id).firstOrNull;
                  if (current != null) return parsed.copyWith(theme: current.theme);
                }
                return parsed;
              } catch (err) {
                debugPrint('Lỗi parse 1 conversation: $err');
                return null;
              }
            })
            .whereType<ConversationModel>()
            .toList();

        final deduplicated = _deduplicateConversationList(parsed);

        // 🛡️ BẢO VỆ: Nếu đã có danh sách cuộc trò chuyện mà kết quả mới rỗng, không xóa mất giao diện của người dùng!
        if (deduplicated.isNotEmpty || conversations.isEmpty) {
          conversations = deduplicated;
          try {
            final prefs = await SharedPreferences.getInstance();
            _sharedPreferences = prefs;
            if (!_disposed &&
                session == _sessionRevision &&
                currentUser != null) {
              await prefs.setString('cached_conversations_${currentUser!.id}',
                  jsonEncode(rawList));
              await _persistConversationThemes();
            }
            for (final c in conversations.take(8)) {
              final msgs = _loadLocalCachedMessages(c.id);
              if (msgs != null && msgs.isNotEmpty) {
                _messagesCache[c.id] = msgs;
              }
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
        if (preload) _preloadTopConversationsSilently();
      }
    }
  }

  Future<void>? _preloadFuture;

  /// Prepare a bounded working set while the authenticated splash is visible.
  Future<void> prepareInitialConversations() async {
    final session = _sessionRevision;
    await fetchConversations(showLoading: false, preload: false);
    if (_disposed || session != _sessionRevision) return;
    await _preloadTopConversationsSilently(immediate: true);
  }

  Future<void> _preloadTopConversationsSilently({bool immediate = false}) async {
    if (_disposed || conversations.isEmpty || !NetworkStatus.online.value) return;
    final existing = _preloadFuture;
    if (existing != null) return existing;
    final future = _preloadRecentMessages(immediate);
    _preloadFuture = future;
    try {
      await future;
    } finally {
      if (identical(_preloadFuture, future)) _preloadFuture = null;
    }
  }

  Future<void> _preloadRecentMessages(bool immediate) async {
    final session = _sessionRevision;
    if (!immediate) await Future.delayed(const Duration(milliseconds: 300));
    if (_disposed || session != _sessionRevision) return;
    final topList = conversations.take(5).toList();
    // One request at a time avoids competing with the active conversation.
    for (final conv in topList) {
      if (_disposed || session != _sessionRevision) return;
      final cached = _messagesCache[conv.id];
      if (cached != null && cached.isNotEmpty) {
        _warmMessageImages(cached);
        continue;
      }
      try {
        final res = await _loadMessages(conv.id);
        if (_disposed || session != _sessionRevision) return;
        final rawData = res['data'] as List? ?? [];
        final fetched = rawData
            .map((m) {
              if (m is Map<String, dynamic>) return MessageModel.fromJson(m);
              if (m is Map) return MessageModel.fromJson(Map<String, dynamic>.from(m));
              return null;
            })
            .whereType<MessageModel>()
            .toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
        if (fetched.isNotEmpty) {
          _cacheMessages(conv.id, fetched);
          _warmMessageImages(fetched);
          if (selectedConversation?.id == conv.id && messages.isEmpty) {
            messages = List.from(fetched);
            isLoadingMessages = false;
            notifyListeners();
            onConversationSelected?.call();
          }
        }
      } catch (_) {}
    }
  }

  final Set<String> _warmedImageUrls = <String>{};

  /// Tải trước ảnh thumbnail của các tin nhắn ảnh gần nhất vào ImageCache.
  /// Key phải khớp với Image.network(thumbUrl, cacheWidth: 450) trong chat_screen
  /// (tức ResizeImage(NetworkImage(url), width: 450)) để khi mở chat ảnh hiện ngay.
  void _warmMessageImages(List<MessageModel> list, {int maxImages = 6}) {
    var started = 0;
    for (var i = list.length - 1; i >= 0 && started < maxImages; i--) {
      final msg = list[i];
      if (msg.isRecalled) continue;
      final content = msg.content.trim();
      if (content.startsWith('data:')) continue;
      String? url = msg.imageUrl;
      if (url != null && url.startsWith('data:')) continue;
      if (msg.type != 'image' && (url == null || url.isEmpty)) continue;
      if (content.startsWith('http') || content.startsWith('/')) url = content;
      if (url == null || url.isEmpty) continue;
      final thumbUrl =
          ApiService.formatThumbnailUrl(ApiService.formatImageUrl(url), width: 450);
      if (thumbUrl.isEmpty || !_warmedImageUrls.add(thumbUrl)) continue;
      started++;
      final stream = ResizeImage(NetworkImage(thumbUrl), width: 450)
          .resolve(ImageConfiguration.empty);
      late final ImageStreamListener listener;
      listener = ImageStreamListener(
        (_, __) => stream.removeListener(listener),
        onError: (_, __) {
          stream.removeListener(listener);
          _warmedImageUrls.remove(thumbUrl);
        },
      );
      stream.addListener(listener);
    }
    if (_warmedImageUrls.length > 500) _warmedImageUrls.clear();
  }

  String? selectedConversationId;
  bool showUnreadOnly = false;

  void setShowUnreadOnly(bool val) {
    showUnreadOnly = val;
    notifyListeners();
  }

  void clearSelectedConversation() {
    if (selectedConversation != null)
      _cacheMessages(selectedConversation!.id, messages);
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
    final previousId = selectedConversation?.id;
    final isSameConversation = previousId == conv.id;
    if (!isSameConversation && selectedConversation != null) {
      _cacheMessages(selectedConversation!.id, messages);
    }
    final revision = ++_messageLoadRevision;
    final session = _sessionRevision;
    selectedConversation = conv;
    final nextTyping = typingUsers.containsKey(conv.id);
    final selectionChanged = !isSameConversation ||
        isPartnerTyping != nextTyping ||
        replyingToMessage != null;
    isPartnerTyping = nextTyping;
    replyingToMessage = null;
    selectedConversationId = conv.id;

    // Đặt unreadCount của đoạn chat được chọn về 0 lập tức ở local
    final idx = conversations.indexWhere((c) => c.id == conv.id);
    var unreadChanged = false;
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
          theme: old.theme,
          nicknames: old.nicknames,
        );
        unreadChanged = true;
      }
    }

    // ⚡ TẢI NGAY TỪ BỘ NHỚ ĐỆM (RAM HOẶC LOCAL STORAGE) ĐỂ MỞ CHAT TỨC THÌ TRONG 0MS
    var cachedMessages = _messagesCache[conv.id];
    if (cachedMessages == null || cachedMessages.isEmpty) {
      final localMsgs = _loadLocalCachedMessages(conv.id);
      if (localMsgs != null && localMsgs.isNotEmpty) {
        _cacheMessages(conv.id, localMsgs);
        cachedMessages = localMsgs;
      }
    }

    final hasCachedMessages =
        cachedMessages != null && cachedMessages.isNotEmpty;
    final previousLoading = isLoadingMessages;
    if (!isSameConversation) {
      if (hasCachedMessages) {
        messages = List.from(cachedMessages!);
        isLoadingMessages = false;
      } else if (conv.lastMessage != null &&
          conv.lastMessage!.trim().isNotEmpty) {
        // Hiển thị ngay tin nhắn mới nhất dạng Preview để giao diện mở tức thì, không bị đừng/đơ 2-3s
        messages = [
          MessageModel(
            id: 'preview_${conv.id}',
            conversationId: conv.id,
            senderId: conv.targetUserId ?? '',
            type: 'text',
            content: conv.lastMessage!,
            createdAt: conv.updatedAt ?? DateTime.now(),
            isRead: true,
            isDelivered: true,
          )
        ];
        isLoadingMessages = false;
      } else {
        isLoadingMessages = true;
        messages = [];
      }
    }
    final initialStateChanged = selectionChanged ||
        unreadChanged ||
        (!isSameConversation &&
            (previousLoading != isLoadingMessages ||
                messages.isNotEmpty ||
                hasCachedMessages));
    if (initialStateChanged) notifyListeners();

    // Chỉ gửi lệnh Đã đọc đến máy chủ KHI THỰC SỰ có tin nhắn chưa đọc (tránh spam lock DB)
    if (selectionChanged || unreadChanged) markSelectedConversationRead();

    // Join vào room của conversation để nhận tin nhắn real-time
    if (!NetworkStatus.online.value) {
      isLoadingMessages = false; notifyListeners(); return;
    }
    SocketService.joinRoom(conv.id);

    final messagesAtStart = {
      for (final message in messages) message.id: message
    };
    var messagesUpdated = false;
    final themeRevision = _themeRevision;
    try {
      final res = await _loadMessages(conv.id);
      if (_disposed ||
          session != _sessionRevision ||
          revision != _messageLoadRevision ||
          selectedConversation?.id != conv.id) return;
      final serverTheme = res['theme'];
      if (serverTheme is String && themeRevision == _themeRevision && !_themeUpdates.contains(conv.id)) {
        _updateConversationThemeLocally(conv.id, serverTheme);
        unawaited(_persistConversationThemes());
      }
      final rawData = res['data'] as List? ?? [];
      final fetched = rawData
          .map((m) {
            if (m is Map<String, dynamic>) return MessageModel.fromJson(m);
            if (m is Map)
              return MessageModel.fromJson(Map<String, dynamic>.from(m));
            return null;
          })
          .whereType<MessageModel>()
          .toList();

      final List<MessageModel> cleanFetched = [];
      final systemTimesByContent = <String, List<DateTime>>{};
      final callTimes = <DateTime>[];
      final currentById = <String, MessageModel>{};
      for (final old in messages) {
        currentById.putIfAbsent(old.id, () => old);
      }
      for (final m in fetched) {
        if (m.type == 'system') {
          final times = systemTimesByContent.putIfAbsent(m.content, () => []);
          if (_hasNearbyTimestamp(times, m.createdAt, 5)) continue;
          _insertTimestamp(times, m.createdAt);
        }
        if (m.type == 'missed_call' ||
            m.type == 'call' ||
            m.type == 'video_call') {
          if (_hasNearbyTimestamp(callTimes, m.createdAt, 15)) continue;
          _insertTimestamp(callTimes, m.createdAt);
        }
        cleanFetched.add(_withReadReceipt(m, previous: currentById[m.id] ?? m));
      }

      final fetchedTimesBySenderAndContent =
          <String, Map<String, List<DateTime>>>{};
      for (final item in cleanFetched) {
        final times = fetchedTimesBySenderAndContent
            .putIfAbsent(item.senderId ?? '', () => {})
            .putIfAbsent(item.content, () => []);
        _insertTimestamp(times, item.createdAt);
      }
      final merged = {for (final message in cleanFetched) message.id: message};
      for (final message in messages) {
        if (!identical(messagesAtStart[message.id], message) ||
            message.id.startsWith('optimistic-') ||
            message.id.startsWith('rt-')) {
          final temporary = message.id.startsWith('optimistic-') ||
              message.id.startsWith('rt-');
          final matchingTimes =
              fetchedTimesBySenderAndContent[message.senderId ?? '']
                  ?[message.content];
          final acknowledged = temporary &&
              matchingTimes != null &&
              _hasNearbyTimestamp(matchingTimes, message.createdAt, 30);
          if (!acknowledged) merged[message.id] = message;
        }
      }
      final newMessages = merged.values.toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      _cacheMessages(conv.id, newMessages);
      final hasRealDifferences = newMessages.length != messagesAtStart.length ||
          !newMessages.every((m) => identical(messagesAtStart[m.id], m) || _messagesEquivalent(messagesAtStart[m.id] ?? m, m));
      messages = newMessages;
      messagesUpdated = hasRealDifferences;
    } catch (e) {
      debugPrint('Error fetching messages: $e');
    } finally {
      if (!_disposed &&
          session == _sessionRevision &&
          revision == _messageLoadRevision &&
          selectedConversation?.id == conv.id) {
        final wasLoading = isLoadingMessages;
        isLoadingMessages = false;
        if (wasLoading || messagesUpdated) notifyListeners();
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
        final convId = convData['id']?.toString() ??
            convData['conversationId']?.toString();
        await fetchConversations();
        if (convId != null) {
          final found = conversations.firstWhere(
            (c) => c.id == convId,
            orElse: () => ConversationModel.fromJson(convData,
                currentUserId: currentUser?.id),
          );
          selectConversation(found);
        }
      }
    } catch (e) {
      debugPrint('Error starting private chat: $e');
    }
  }

  Future<void> sendMessage(String text, {String type = 'text'}) async {
    if (!NetworkStatus.online.value) return;
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
      clientTempId: optId,
      status: 'sending',
      conversationId: conversation.id,
      senderId: currentUser?.id,
      content: text,
      type: type,
      replyMessageId: replyId,
      createdAt: DateTime.now(),
    );

    messages.add(optMsg);
    _cacheMessages(conversation.id, messages);
    _updateLastMessageInConversation(optMsg, notify: false);
    notifyListeners();
    onNewMessageReceived?.call();

    // Relay immediately over the established socket while REST persists it.
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
        clientTempId: optId,
      );
      if (_disposed || session != _sessionRevision) return;
      final msgData = res['data'] ?? (res['success'] == true ? res : null);
      if (msgData is Map<String, dynamic>) {
        final decoded = MessageModel.fromJson(msgData);
        final targetMessages = selectedConversation?.id == conversation.id
            ? messages
            : (_messagesCache[conversation.id] ?? <MessageModel>[]);
        final idx = targetMessages.indexWhere((m) => m.id == optId);
        final realMsg = _withReadReceipt(decoded,
            previous: targetMessages.firstWhere((m) => m.id == decoded.id || m.id == optId, orElse: () => decoded));
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
        _updateLastMessageInConversation(realMsg, notify: false);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error sending message: $e');
      if (_disposed || session != _sessionRevision) return;
      final targetMessages = selectedConversation?.id == conversation.id
          ? messages : (_messagesCache[conversation.id] ?? <MessageModel>[]);
      final index = targetMessages.indexWhere((message) => message.id == optId);
      if (index != -1) {
        targetMessages[index] = targetMessages[index].copyWith(status: 'error');
        _cacheMessages(conversation.id, targetMessages);
        notifyListeners();
      }
    }
  }

  Future<bool> deleteConversation(String conversationId) async {
    try {
      final success = await ApiService.deleteConversation(conversationId);
      if (success) {
        _messagesCache.remove(conversationId);
        conversations.removeWhere((c) => c.id == conversationId);
        if (selectedConversation != null &&
            selectedConversation!.id == conversationId) {
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

  void updateUserOnlineStatus(String userId, bool isOnline,
      {DateTime? lastActive}) {
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

  Future<bool> updateNickname(
      String conversationId, String userId, String? nickname) async {
    final cleanNick = (nickname != null && nickname.trim().isNotEmpty)
        ? nickname.trim()
        : null;

    // 1. Phản hồi tức thì trên UI (Optimistic UI)
    updateMemberNickname(conversationId, userId, cleanNick);

    // 2. Phát socket event cho đối phương
    SocketService.emitUpdateNickname(conversationId, userId, cleanNick);

    // 3. Gọi REST API song song để lưu DB
    final success =
        await ApiService.updateNickname(conversationId, userId, cleanNick);
    return success;
  }

  void updateMemberNickname(
      String conversationId, String userId, String? nickname,
      {Map<String, String>? newNicknamesMap}) {
    bool updated = false;
    for (int i = 0; i < conversations.length; i++) {
      if (conversations[i].id == conversationId) {
        final conv = conversations[i];
        final cleanNickname = (nickname != null && nickname.trim().isNotEmpty)
            ? nickname.trim()
            : null;

        Map<String, String> updatedNicknames =
            Map<String, String>.from(conv.nicknames ?? {});
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
          final partnerId = conv.targetUserId ??
              (memberIndex != -1 ? updatedMembers[memberIndex].id : null);
          if (partnerId != null) {
            if (updatedNicknames.containsKey(partnerId) &&
                updatedNicknames[partnerId]!.isNotEmpty) {
              newConvName = updatedNicknames[partnerId]!;
            } else {
              final partner = updatedMembers.firstWhere(
                (m) => m.id == partnerId,
                orElse: () =>
                    UserModel(id: partnerId, username: '', fullName: ''),
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
    NetworkStatus.online.removeListener(_onNetworkChanged);
    _disposed = true;
    _sessionRevision++;
    _messageLoadRevision++;
    for (final timer in _messageCacheTimers.values) {
      timer.cancel();
    }
    _messageCacheTimers.clear();
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
