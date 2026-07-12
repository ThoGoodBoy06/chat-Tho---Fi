import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? socket;
  bool isConnected = false;
  String? currentUserId;

  // Callback lắng nghe tin nhắn mới nhận
  Function(Map<String, dynamic>)? onMessageReceived;
  // Callback lắng nghe khi đối phương đang gõ tin nhắn
  Function(Map<String, dynamic>)? onTypingStatusChanged;
  // Callback lắng nghe khi đối phương đổi trạng thái online/offline
  Function(Map<String, dynamic>)? onUserStatusChanged;
  // Callback lắng nghe khi tin nhắn được đánh dấu đã đọc
  Function(Map<String, dynamic>)? onMessagesRead;

  void connect(String serverUrl, String userId) {
    if (socket != null && isConnected && currentUserId == userId) {
      return;
    }
    
    currentUserId = userId;
    
    // Ngắt kết nối socket cũ nếu có
    disconnect();

    print("🔌 Khởi tạo kết nối Socket.IO tới $serverUrl...");
    
    socket = IO.io(serverUrl, IO.OptionBuilder()
      .setTransports(['websocket']) // Bắt buộc dùng websocket transport
      .enableAutoConnect()
      .build());

    socket!.onConnect((_) {
      print("🔌 Socket.IO đã kết nối thành công: ${socket!.id}");
      isConnected = true;
      
      // Báo cho server biết user vừa online và lấy dữ liệu ban đầu
      socket!.emit("user_connected", userId);
    });

    socket!.onDisconnect((_) {
      print("🔌 Socket.IO đã ngắt kết nối");
      isConnected = false;
    });

    socket!.onConnectError((data) {
      print("🔌 Lỗi kết nối Socket.IO: $data");
    });

    // Lắng nghe sự kiện nhận tin nhắn mới
    socket!.on("receive_message", (data) {
      print("📩 Socket nhận sự kiện receive_message");
      if (onMessageReceived != null) {
        if (data is Map) {
          onMessageReceived!(Map<String, dynamic>.from(data));
        } else if (data is String) {
          try {
            onMessageReceived!(Map<String, dynamic>.from(jsonDecode(data)));
          } catch (_) {}
        }
      }
    });

    // Lắng nghe sự kiện đối phương đang gõ
    socket!.on("typing", (data) {
      if (onTypingStatusChanged != null && data is Map) {
        onTypingStatusChanged!({
          'senderId': data['senderId'],
          'senderName': data['senderName'],
          'conversationId': data['conversationId'],
          'isTyping': true,
        });
      }
    });

    // Lắng nghe sự kiện đối phương dừng gõ (stop-typing mới hoặc stop_typing cũ)
    socket!.on("stop-typing", (data) {
      if (onTypingStatusChanged != null && data is Map) {
        onTypingStatusChanged!({
          'senderId': data['senderId'],
          'isTyping': false,
        });
      }
    });
    
    socket!.on("stop_typing", (data) {
      if (onTypingStatusChanged != null && data is Map) {
        onTypingStatusChanged!({
          'conversationId': data['conversationId'],
          'isTyping': false,
        });
      }
    });

    // Lắng nghe sự kiện thay đổi trạng thái online/offline của user khác
    socket!.on("user_status_changed", (data) {
      if (onUserStatusChanged != null && data is Map) {
        onUserStatusChanged!(Map<String, dynamic>.from(data));
      }
    });
    
    socket!.on("user_status_change", (data) {
      if (onUserStatusChanged != null && data is Map) {
        onUserStatusChanged!(Map<String, dynamic>.from(data));
      }
    });

    // Lắng nghe sự kiện người kia đã đọc tin nhắn
    socket!.on("messages_read", (data) {
      if (onMessagesRead != null && data is Map) {
        onMessagesRead!(Map<String, dynamic>.from(data));
      }
    });
  }

  // Phát tín hiệu đang gõ
  void sendTyping(String? receiverId, String? conversationId, String senderName) {
    if (socket == null || !isConnected) return;
    socket!.emit("typing", {
      'receiverId': receiverId,
      'conversationId': conversationId,
      'senderName': senderName,
      'senderId': currentUserId,
    });
  }

  // Phát tín hiệu dừng gõ
  void sendStopTyping(String? receiverId, String? conversationId) {
    if (socket == null || !isConnected) return;
    socket!.emit("stop-typing", {
      'receiverId': receiverId,
      'conversationId': conversationId,
    });
  }

  // Báo đã xem tin nhắn
  void markMessagesRead(String conversationId) {
    if (socket == null || !isConnected) return;
    socket!.emit("mark_messages_read", {
      'conversationId': conversationId,
      'userId': currentUserId,
    });
  }

  void goOffline() {
    if (socket == null || !isConnected) return;
    socket!.emit("go_offline");
  }

  void goOnline() {
    if (socket == null || !isConnected) return;
    socket!.emit("go_online");
  }

  void disconnect() {
    if (socket != null) {
      socket!.disconnect();
      socket = null;
      isConnected = false;
      print("🔌 Đã đóng kết nối Socket.IO.");
    }
  }
}
