import 'dart:convert';

class UserModel {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatar;
  final bool isOnline;
  final DateTime? lastActive;

  UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    this.avatar,
    this.isOnline = false,
    this.lastActive,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['username']?.toString() ?? 'Người dùng',
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      avatar: json['avatar']?.toString(),
      isOnline: json['isOnline'] == true,
      lastActive: json['lastActive'] != null ? DateTime.tryParse(json['lastActive'].toString()) : null,
    );
  }
}

class MessageModel {
  final String id;
  final String? conversationId;
  final String? senderId;
  final String? type;
  final String content;
  final String? imageUrl;
  final String? audioUrl;
  final bool isRead;
  final String? replyMessageId;
  final Map<String, String> reactions;
  final DateTime createdAt;

  MessageModel({
    required this.id,
    this.conversationId,
    this.senderId,
    this.type = 'text',
    required this.content,
    this.imageUrl,
    this.audioUrl,
    this.isRead = false,
    this.replyMessageId,
    this.reactions = const {},
    required this.createdAt,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    String? img = json['imageUrl']?.toString();
    String? aud = json['audioUrl']?.toString();
    String msgType = json['type']?.toString() ?? 'text';
    String contentStr = json['content']?.toString() ?? '';

    if (msgType == 'image' && (img == null || img.isEmpty)) {
      img = contentStr;
    }
    if (msgType == 'audio' && (aud == null || aud.isEmpty)) {
      aud = contentStr;
    }

    Map<String, String> parsedReactions = {};
    final rawReactions = json['reactions'];
    if (rawReactions is Map) {
      rawReactions.forEach((key, value) {
        parsedReactions[key.toString()] = value.toString();
      });
    } else if (rawReactions is String && rawReactions.isNotEmpty) {
      try {
        final decoded = jsonDecode(rawReactions);
        if (decoded is Map) {
          decoded.forEach((key, value) {
            parsedReactions[key.toString()] = value.toString();
          });
        }
      } catch (_) {}
    }

    return MessageModel(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString(),
      senderId: json['senderId']?.toString(),
      type: msgType,
      content: contentStr,
      imageUrl: img,
      audioUrl: aud,
      isRead: json['isRead'] == true,
      replyMessageId: json['replyMessageId']?.toString(),
      reactions: parsedReactions,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class ConversationModel {
  final String id;
  final String name;
  final String? avatar;
  final String type;
  final String? lastMessage;
  final int unreadCount;
  final DateTime? updatedAt;
  final String? targetUserId;
  final List<UserModel> members;

  bool get isOnline => members.any((m) => m.isOnline);
  String? get partnerId => targetUserId;
  DateTime? get lastMessageAt => updatedAt;

  ConversationModel({
    required this.id,
    required this.name,
    this.avatar,
    this.type = 'private',
    this.lastMessage,
    this.unreadCount = 0,
    this.updatedAt,
    this.targetUserId,
    this.members = const [],
  });

  factory ConversationModel.fromJson(Map<String, dynamic> rawJson, {String? currentUserId}) {
    final json = (rawJson['Conversations'] is Map<String, dynamic>)
        ? rawJson['Conversations'] as Map<String, dynamic>
        : rawJson;

    String? lastMsgText;
    if (json['Messages'] is List && (json['Messages'] as List).isNotEmpty) {
      final firstMsg = (json['Messages'] as List)[0];
      if (firstMsg is Map) lastMsgText = firstMsg['content']?.toString();
    }

    String convName = json['name']?.toString() ?? '';
    String? convAvatar = json['avatar']?.toString();
    String? partnerUserId;
    final isGroup = json['type'] == 'group';

    List<UserModel> parsedMembers = [];
    final membersList = json['ConversationMembers'] ?? rawJson['ConversationMembers'];
    if (membersList is List) {
      for (var member in membersList) {
        if (member is Map && member['Users'] is Map) {
          parsedMembers.add(UserModel.fromJson(member['Users'] as Map<String, dynamic>));
        }
      }

      if (isGroup) {
        if (convName.isEmpty) {
          final memberNames = membersList
              .where((m) => m is Map && m['Users'] is Map)
              .map((m) => (m['Users'] as Map)['fullName']?.toString() ?? '')
              .where((name) => name.isNotEmpty)
              .toList();
          convName = memberNames.join(', ');
        }
      } else {
        for (var member in membersList) {
          if (member is Map) {
            final memberUserId = member['userId']?.toString() ?? (member['Users'] is Map ? member['Users']['id']?.toString() : null);
            final userObj = member['Users'];
            
            if (memberUserId != null && (currentUserId == null || memberUserId != currentUserId)) {
              partnerUserId = memberUserId;
              final nickname = member['nickname']?.toString();
              if (nickname != null && nickname.isNotEmpty) {
                convName = nickname;
              } else if (userObj is Map) {
                convName = userObj['fullName']?.toString() ?? userObj['username']?.toString() ?? 'Người dùng';
              }
              if (userObj is Map && (convAvatar == null || convAvatar.isEmpty)) {
                convAvatar = userObj['avatar']?.toString();
              }
              if (currentUserId != null && memberUserId != currentUserId) {
                break;
              }
            }
          }
        }
      }
    }

    if (convName.isEmpty) convName = 'Cuộc trò chuyện';

    return ConversationModel(
      id: json['id']?.toString() ?? rawJson['conversationId']?.toString() ?? '',
      name: convName,
      avatar: convAvatar,
      type: json['type']?.toString() ?? 'private',
      lastMessage: lastMsgText ?? json['lastMessage']?.toString(),
      unreadCount: json['_count']?['Messages'] is int ? json['_count']['Messages'] : 0,
      updatedAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      targetUserId: partnerUserId,
      members: parsedMembers,
    );
  }
}
