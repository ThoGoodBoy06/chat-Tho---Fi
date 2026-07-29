import 'dart:async';
import 'package:flutter/foundation.dart';
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
      if (_currentRoomId != null && _currentRoomId!.isNotEmpty) {
        socket?.emit('join_room', _currentRoomId);
        socket?.emit('join_conversation', _currentRoomId);
      }
      return;
    }

    String serverUrl;
    if (kIsWeb) {
      final location = html.window.location;
      final host = location.hostname;
      if ((host == 'localhost' || host == '127.0.0.1') && location.port != '3000') {
        final protocol = location.protocol.isEmpty ? 'http:' : location.protocol;
        serverUrl = '$protocol//$host:3000';
      } else {
        serverUrl = Uri.base.origin;
      }
    } else {
      serverUrl = 'https://chat-tho-fi-vn.onrender.com';
    }

    socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .setQuery({'token': token})
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
      if (_currentRoomId != null) {
        socket?.emit('join_room', _currentRoomId);
        socket?.emit('join_conversation', _currentRoomId);
      }
    });

    socket?.onConnectError((data) {
      print('⚠️ Socket connect_error: $data');
    });

    socket?.onError((data) {
      print('⚠️ Socket error: $data');
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

  static void joinRoom(String roomId) {
    _currentRoomId = roomId;
    if (socket != null && socket!.connected) {
      socket!.emit('join_room', roomId);
      socket!.emit('join_conversation', roomId);
      print('📡 Đã emit join_room & join_conversation: $roomId');
    }
  }

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
