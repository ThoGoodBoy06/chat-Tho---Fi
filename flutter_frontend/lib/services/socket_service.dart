import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';
import 'sound_service.dart';

class SocketService {
  static IO.Socket? socket;
  static final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  static String? _currentUserId;
  static String? _currentRoomId;

  static final _incomingCallController = StreamController<Map<String, dynamic>>.broadcast();
  static final _callAcceptedController = StreamController<Map<String, dynamic>>.broadcast();
  static final _callRejectedController = StreamController<Map<String, dynamic>>.broadcast();
  static final _callEndedController = StreamController<void>.broadcast();
  static final _webrtcSignalController = StreamController<Map<String, dynamic>>.broadcast();
  static final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  static final _stopTypingController = StreamController<Map<String, dynamic>>.broadcast();

  static final _reactedController = StreamController<Map<String, dynamic>>.broadcast();
  static final _readController = StreamController<Map<String, dynamic>>.broadcast();
  static final _deliveredController = StreamController<Map<String, dynamic>>.broadcast();

  static Stream<Map<String, dynamic>> get onMessageReceived => _messageController.stream;
  static Stream<Map<String, dynamic>> get onIncomingCall => _incomingCallController.stream;
  static Stream<Map<String, dynamic>> get onCallAccepted => _callAcceptedController.stream;
  static Stream<Map<String, dynamic>> get onCallRejected => _callRejectedController.stream;
  static Stream<void> get onCallEnded => _callEndedController.stream;
  static Stream<Map<String, dynamic>> get onWebrtcSignal => _webrtcSignalController.stream;
  static Stream<Map<String, dynamic>> get onUserTyping => _typingController.stream;
  static Stream<Map<String, dynamic>> get onUserStopTyping => _stopTypingController.stream;
  static Stream<Map<String, dynamic>> get onMessageReacted => _reactedController.stream;
  static Stream<Map<String, dynamic>> get onMessagesRead => _readController.stream;
  static Stream<Map<String, dynamic>> get onMessageDelivered => _deliveredController.stream;

  // --- AUDIO API SYNTHETIC SOUND GENERATOR ---
  static void playSendSound() {
    SoundService.playMessageSound();
  }

  static void playReceiveSound() {
    SoundService.playMessageSound();
  }

  static void playReactSound() {
    SoundService.playMessageSound();
  }

  static Future<void> connect({required String userId}) async {
    final token = await ApiService.getToken();
    _currentUserId = userId;

    if (socket != null && socket!.connected) {
      socket?.emit('user_connected', userId);
      if (_currentRoomId != null) {
        socket?.emit('join_room', _currentRoomId);
        socket?.emit('join_conversation', _currentRoomId);
      }
      return;
    }

    String serverUrl;
    if (kIsWeb) {
      final host = Uri.base.host;
      final port = Uri.base.port;
      if ((host == 'localhost' || host == '127.0.0.1') && port != 3000) {
        final scheme = Uri.base.scheme.isEmpty ? 'http' : Uri.base.scheme;
        serverUrl = '$scheme://$host:3000';
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

    socket?.on('incoming_call', (data) {
      print('📞 Socket incoming_call: $data');
      if (data is Map) {
        _incomingCallController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('call_accepted', (data) {
      print('✅ Socket call_accepted: $data');
      if (data is Map) {
        _callAcceptedController.add(Map<String, dynamic>.from(data));
      } else {
        _callAcceptedController.add({});
      }
    });

    socket?.on('call_rejected', (data) {
      print('❌ Socket call_rejected: $data');
      if (data is Map) {
        _callRejectedController.add(Map<String, dynamic>.from(data));
      } else {
        _callRejectedController.add({});
      }
    });

    socket?.on('call_ended', (_) {
      print('🔴 Socket call_ended');
      _callEndedController.add(null);
    });

    socket?.on('webrtc_signal', (data) {
      if (data is Map) {
        _webrtcSignalController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('user_typing', (data) {
      if (data is Map) {
        _typingController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('typing', (data) {
      if (data is Map) {
        _typingController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('stop_typing', (data) {
      if (data is Map) {
        _stopTypingController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('user_stop_typing', (data) {
      if (data is Map) {
        _stopTypingController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('message_reacted', (data) {
      if (data is Map) {
        _reactedController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('message_delivered', (data) {
      if (data is Map) {
        _deliveredController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('message_read', (data) {
      if (data is Map) {
        _readController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('messages_read', (data) {
      if (data is Map) {
        _readController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.onDisconnect((_) => print('🔴 Socket disconnected'));
  }

  static void emitMarkAsDelivered(String messageId, {String? conversationId}) {
    if (socket != null && socket!.connected) {
      socket!.emit('mark_as_delivered', {
        'messageId': messageId,
        'conversationId': conversationId,
      });
    }
  }

  static void emitMarkAsRead(String messageId, {String? conversationId}) {
    if (socket != null && socket!.connected) {
      socket!.emit('mark_as_read', {
        'messageId': messageId,
        'conversationId': conversationId,
      });
      if (conversationId != null) {
        socket!.emit('mark_messages_read', {
          'conversationId': conversationId,
        });
      }
    }
  }

  static void emitReactMessage(String messageId, String conversationId, String emoji) {
    if (socket != null && socket!.connected) {
      socket!.emit('react_message', {
        'messageId': messageId,
        'conversationId': conversationId,
        'emoji': emoji,
      });
      playReactSound();
    }
  }

  static void emitTyping(String conversationId, String userId, String nickname) {
    if (socket != null && socket!.connected) {
      socket!.emit('typing', {
        'conversationId': conversationId,
        'userId': userId,
        'nickname': nickname,
        'senderId': userId,
        'senderName': nickname,
      });
    }
  }

  static void emitStopTyping(String conversationId, String userId) {
    if (socket != null && socket!.connected) {
      socket!.emit('stop_typing', {
        'conversationId': conversationId,
        'userId': userId,
      });
      socket!.emit('stop-typing', {
        'conversationId': conversationId,
        'userId': userId,
      });
    }
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

  static void markMessagesRead(String conversationId, String userId) {
    if (socket != null && socket!.connected) {
      socket!.emit('mark_messages_read', {
        'conversationId': conversationId,
        'userId': userId,
      });
      print('👀 Emitted mark_messages_read for conv: $conversationId');
    }
  }

  static void disconnect() {
    _currentRoomId = null;
    _currentUserId = null;
    socket?.disconnect();
    socket = null;
  }
}
