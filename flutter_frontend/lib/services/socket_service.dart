import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';
import 'dart:html' as html;

class SocketService {
  static IO.Socket? socket;
  static final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  static String? _currentUserId;
  static String? _currentRoomId;

  static Stream<Map<String, dynamic>> get onMessageReceived => _messageController.stream;

  static Future<void> connect({String? userId}) async {
    final token = await ApiService.getToken();
    if (token == null) return;

    if (userId != null && userId.isNotEmpty) {
      _currentUserId = userId;
    }

    if (socket != null && socket!.connected) {
      if (_currentUserId != null && _currentUserId!.isNotEmpty) {
        socket?.emit('user_connected', _currentUserId);
      }
      return;
    }

    // Nếu đang chạy trên Flutter dev server (port 8080), trỏ socket về backend port 3000
    final location = html.window.location;
    String serverUrl;
    if (location.port == '8080') {
      serverUrl = 'http://${location.hostname}:3000';
    } else {
      serverUrl = Uri.base.origin;
    }

    socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .build(),
    );

    socket?.connect();

    socket?.onConnect((_) {
      print('🔥 Socket connected to Flutter Web (server: $serverUrl)');
      if (_currentUserId != null && _currentUserId!.isNotEmpty) {
        socket?.emit('user_connected', _currentUserId);
      }
      // Rejoin room nếu có (sau khi reconnect)
      if (_currentRoomId != null) {
        socket?.emit('join_room', _currentRoomId);
      }
    });

    socket?.on('receive_message', (data) {
      print('📩 Socket receive_message: $data');
      if (data is Map<String, dynamic>) {
        _messageController.add(data);
      } else if (data is Map) {
        _messageController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.onDisconnect((_) => print('🔴 Socket disconnected'));
  }

  /// Join vào một phòng chat cụ thể để nhận tin nhắn real-time
  static void joinRoom(String roomId) {
    _currentRoomId = roomId;
    if (socket != null && socket!.connected) {
      socket!.emit('join_room', roomId);
      print('📡 Đã emit join_room: $roomId');
    }
  }

  /// Rời khỏi phòng chat hiện tại
  static void leaveRoom() {
    _currentRoomId = null;
  }

  static void disconnect() {
    _currentRoomId = null;
    _currentUserId = null;
    socket?.disconnect();
    socket = null;
  }
}
