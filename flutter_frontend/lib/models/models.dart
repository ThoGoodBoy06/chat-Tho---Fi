import 'dart:convert';

class UserModel {
  final String id;
  final String username;
  final String fullName;
  final String? nickname;
  final String? email;
  final String? phone;
  final String? avatar;
  final String? coverImage;
  final String? bio;
  final String role;
  final bool isBlocked;
  final bool isOnline;
  final DateTime? lastActive;

  String get displayName => (nickname != null && nickname!.trim().isNotEmpty) ? nickname!.trim() : fullName;
  bool get isAdmin => role.toUpperCase() == 'ADMIN';

  UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    this.nickname,
    this.email,
    this.phone,
    this.avatar,
    this.coverImage,
    this.bio,
    this.role = 'USER',
    this.isBlocked = false,
    this.isOnline = false,
    this.lastActive,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['username']?.toString() ?? 'Người dùng',
      nickname: json['nickname']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      avatar: json['avatar']?.toString(),
      coverImage: json['coverImage']?.toString() ?? json['coverPhoto']?.toString() ?? json['cover_image']?.toString() ?? json['cover_photo']?.toString(),
      bio: json['bio']?.toString(),
      role: json['role']?.toString() ?? 'USER',
      isBlocked: json['isBlocked'] == true,
      isOnline: json['isOnline'] == true,
      lastActive: json['lastActive'] != null ? DateTime.tryParse(json['lastActive'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'fullName': fullName,
      'nickname': nickname,
      'email': email,
      'phone': phone,
      'avatar': avatar,
      'coverImage': coverImage,
      'coverPhoto': coverImage,
      'bio': bio,
      'role': role,
      'isBlocked': isBlocked,
      'isOnline': isOnline,
      'lastActive': lastActive?.toIso8601String(),
    };
  }
}

class AdminStatsModel {
  final int totalUsers;
  final int onlineUsers;
  final int totalMessages;
  final int totalGroups;

  AdminStatsModel({
    required this.totalUsers,
    required this.onlineUsers,
    required this.totalMessages,
    required this.totalGroups,
  });

  factory AdminStatsModel.fromJson(Map<String, dynamic> json) {
    return AdminStatsModel(
      totalUsers: json['totalUsers'] is int ? json['totalUsers'] : 0,
      onlineUsers: json['onlineUsers'] is int ? json['onlineUsers'] : 0,
      totalMessages: json['totalMessages'] is int ? json['totalMessages'] : 0,
      totalGroups: json['totalGroups'] is int ? json['totalGroups'] : 0,
    );
  }
}

class ReportModel {
  final String id;
  final String reporterId;
  final String reporterName;
  final String reportedUserId;
  final String reportedUserName;
  final bool reportedIsBlocked;
  final String reason;
  final String status;
  final DateTime createdAt;

  ReportModel({
    required this.id,
    required this.reporterId,
    required this.reporterName,
    required this.reportedUserId,
    required this.reportedUserName,
    required this.reportedIsBlocked,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  factory ReportModel.fromJson(Map<String, dynamic> json) {
    return ReportModel(
      id: json['id']?.toString() ?? '',
      reporterId: json['reporterId']?.toString() ?? '',
      reporterName: json['reporter']?['fullName']?.toString() ?? json['reporter']?['username']?.toString() ?? 'N/A',
      reportedUserId: json['reportedUserId']?.toString() ?? '',
      reportedUserName: json['reportedUser']?['fullName']?.toString() ?? json['reportedUser']?['username']?.toString() ?? 'N/A',
      reportedIsBlocked: json['reportedUser']?['isBlocked'] == true,
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
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
  final bool isDelivered;
  final bool isRecalled;
  final String? replyMessageId;
  final Map<String, String> reactions;
  final DateTime createdAt;

  Map<String, dynamic>? get systemMetadata {
    if (type != 'system') return null;
    try {
      final decoded = jsonDecode(content);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
    return null;
  }

  MessageModel({
    required this.id,
    this.conversationId,
    this.senderId,
    this.type = 'text',
    required this.content,
    this.imageUrl,
    this.audioUrl,
    this.isRead = false,
    this.isDelivered = false,
    this.isRecalled = false,
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

    final read = json['isRead'] == true;
    final delivered = json['isDelivered'] == true || read;
    final recalled = json['isRecalled'] == true;

    return MessageModel(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString(),
      senderId: json['senderId']?.toString(),
      type: msgType,
      content: contentStr,
      imageUrl: img,
      audioUrl: aud,
      isRead: read,
      isDelivered: delivered,
      isRecalled: recalled,
      replyMessageId: json['replyMessageId']?.toString(),
      reactions: parsedReactions,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  MessageModel copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    String? type,
    String? content,
    String? imageUrl,
    String? audioUrl,
    bool? isRead,
    bool? isDelivered,
    bool? isRecalled,
    String? replyMessageId,
    Map<String, String>? reactions,
    DateTime? createdAt,
  }) {
    return MessageModel(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      type: type ?? this.type,
      content: content ?? this.content,
      imageUrl: imageUrl ?? this.imageUrl,
      audioUrl: audioUrl ?? this.audioUrl,
      isRead: isRead ?? this.isRead,
      isDelivered: isDelivered ?? this.isDelivered,
      isRecalled: isRecalled ?? this.isRecalled,
      replyMessageId: replyMessageId ?? this.replyMessageId,
      reactions: reactions ?? this.reactions,
      createdAt: createdAt ?? this.createdAt,
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

  bool get isGroup => type == 'group';
  int get memberCount => members.length;

  bool get isOnline {
    if (targetUserId != null && targetUserId!.isNotEmpty && members.isNotEmpty) {
      final partner = members.firstWhere(
        (m) => m.id == targetUserId,
        orElse: () => members.first,
      );
      return partner.isOnline;
    }
    return members.any((m) => m.isOnline);
  }
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
      if (firstMsg is Map) {
        final content = firstMsg['content']?.toString() ?? '';
        final type = firstMsg['type']?.toString();
        final lower = content.toLowerCase().trim();
        if (type == 'image' || lower.startsWith('data:image') || lower.contains('/uploads/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          lastMsgText = 'Đã gửi một hình ảnh';
        } else if (type == 'audio' || lower.startsWith('data:audio') || lower.contains('.webm') || lower.contains('.mp3')) {
          lastMsgText = 'Đã gửi một tin nhắn thoại';
        } else if (type == 'file' || lower.startsWith('{"filename"')) {
          lastMsgText = 'Đã gửi một tệp đính kèm';
        } else {
          lastMsgText = content;
        }
      }
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
          final userMap = Map<String, dynamic>.from(member['Users'] as Map);
          if (member['nickname'] != null && member['nickname'].toString().isNotEmpty) {
            userMap['nickname'] = member['nickname'].toString();
          }
          parsedMembers.add(UserModel.fromJson(userMap));
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

    String? rawLast = lastMsgText ?? json['lastMessage']?.toString();
    String? finalLastMsg;
    if (rawLast != null && rawLast.isNotEmpty) {
      final lower = rawLast.toLowerCase().trim();
      if (lower.startsWith('data:image') || lower.contains('/uploads/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
        finalLastMsg = 'Đã gửi một hình ảnh';
      } else if (lower.startsWith('data:audio') || lower.contains('.webm') || lower.contains('.mp3') || lower.contains('.m4a') || lower.contains('.wav')) {
        finalLastMsg = 'Đã gửi một tin nhắn thoại';
      } else if (lower.startsWith('{"filename"')) {
        finalLastMsg = 'Đã gửi một tệp đính kèm';
      } else {
        finalLastMsg = rawLast;
      }
    }

    return ConversationModel(
      id: json['id']?.toString() ?? rawJson['conversationId']?.toString() ?? '',
      name: convName,
      avatar: convAvatar,
      type: json['type']?.toString() ?? 'private',
      lastMessage: finalLastMsg,
      unreadCount: json['_count']?['Messages'] is int ? json['_count']['Messages'] : 0,
      updatedAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      targetUserId: partnerUserId,
      members: parsedMembers,
    );
  }
}
