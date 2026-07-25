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
  final bool isRead;
  final DateTime createdAt;

  MessageModel({
    required this.id,
    this.conversationId,
    this.senderId,
    this.type = 'text',
    required this.content,
    this.imageUrl,
    this.isRead = false,
    required this.createdAt,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString(),
      senderId: json['senderId']?.toString(),
      type: json['type']?.toString() ?? 'text',
      content: json['content']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString(),
      isRead: json['isRead'] == true,
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
  final List<UserModel> members;

  ConversationModel({
    required this.id,
    required this.name,
    this.avatar,
    this.type = 'private',
    this.lastMessage,
    this.unreadCount = 0,
    this.updatedAt,
    this.members = const [],
  });

  factory ConversationModel.fromJson(Map<String, dynamic> rawJson) {
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

    if (rawJson['nickname'] != null && rawJson['nickname'].toString().isNotEmpty) {
      convName = rawJson['nickname'].toString();
    } else if (json['ConversationMembers'] is List) {
      for (var member in (json['ConversationMembers'] as List)) {
        if (member is Map && member['Users'] != null) {
          final user = member['Users'];
          if (convName.isEmpty) convName = user['fullName']?.toString() ?? user['username']?.toString() ?? '';
          if (convAvatar == null) convAvatar = user['avatar']?.toString();
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
    );
  }
}
