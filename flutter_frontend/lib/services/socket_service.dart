import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';

class SocketService {
  static IO.Socket? socket;
  static final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  static Stream<Map<String, dynamic>> get onMessageReceived => _messageController.stream;

  static Future<void> connect({String? userId}) async {
    final token = await ApiService.getToken();
    if (token == null) return;

    if (socket != null && socket!.connected) {
      if (userId != null && userId.isNotEmpty) {
        socket?.emit('user_connected', userId);
      }
      return;
    }

    socket = IO.io(
      '/',
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    socket?.connect();

    socket?.onConnect((_) {
      print('🔥 Socket connected to Flutter Web');
      if (userId != null && userId.isNotEmpty) {
        socket?.emit('user_connected', userId);
      }
    });

    socket?.on('receive_message', (data) {
      print('📩 Socket receive_message: $data');
      if (data is Map<String, dynamic>) {
        _messageController.add(data);
      }
    });

    socket?.onDisconnect((_) => print('🔴 Socket disconnected'));
  }

  static void disconnect() {
    socket?.disconnect();
    socket = null;
  }
}
