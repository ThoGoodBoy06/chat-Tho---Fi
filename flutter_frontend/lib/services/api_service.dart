import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static String get baseUrl {
    if (kIsWeb) {
      final host = Uri.base.host;
      final port = Uri.base.port;
      if ((host == 'localhost' || host == '127.0.0.1') && port != 3000) {
        final scheme = Uri.base.scheme.isEmpty ? 'http' : Uri.base.scheme;
        return '$scheme://$host:3000/api';
      }
      return '${Uri.base.origin}/api';
    }
    return 'https://chat-tho-fi-vn.onrender.com/api';
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('authToken');
  }

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('authToken', token);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('authToken');
  }

  static Future<Map<String, String>> _getHeaders() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // Auth: Login
  static Future<Map<String, dynamic>> login(String identifier, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    ).timeout(const Duration(seconds: 45));
    return jsonDecode(response.body);
  }

  // Auth: Register
  static Future<Map<String, dynamic>> register(Map<String, String> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    ).timeout(const Duration(seconds: 45));
    return jsonDecode(response.body);
  }

  // Auth: Get Current User Profile
  static Future<Map<String, dynamic>> getMe() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return {};
  }

  // Fetch Conversations
  static Future<List<dynamic>> getConversations() async {
    final headers = await _getHeaders();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/chat/conversations'),
        headers: headers,
      ).timeout(const Duration(seconds: 45));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        } else if (decoded is List) {
          return decoded as List<dynamic>;
        }
      } else if (response.statusCode == 401) {
        debugPrint('⚠️ Token 401 Unauthorized khi lấy danh sách chat. Xóa token cũ.');
        await clearToken();
      } else {
        debugPrint('⚠️ Lỗi API getConversations status: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('⚠️ Exeption getConversations: $e');
    }
    return [];
  }

  // Fetch Messages for a conversation
  static Future<Map<String, dynamic>> getMessages(String conversationId, {int limit = 50}) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/chat/$conversationId/messages?limit=$limit'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return {'data': []};
  }

  // Mark all unread messages as read in a conversation
  static Future<void> markAsRead(String conversationId) async {
    try {
      final headers = await _getHeaders();
      await http.post(
        Uri.parse('$baseUrl/chat/conversations/$conversationId/read'),
        headers: headers,
      ).timeout(const Duration(seconds: 15));
    } catch (e) {
      debugPrint('Error in ApiService.markAsRead: $e');
    }
  }

  // Delete conversation (soft delete on current user's side)
  static Future<bool> deleteConversation(String conversationId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/chat/conversations/$conversationId'),
        headers: headers,
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Error deleteConversation API: $e');
      return false;
    }
  }

  // Create or get 1-on-1 private conversation
  static Future<Map<String, dynamic>> createConversation(String receiverId) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/chat/conversations'),
      headers: headers,
      body: jsonEncode({'receiverId': receiverId}),
    ).timeout(const Duration(seconds: 45));
    return jsonDecode(response.body);
  }

  // Send Message
  static Future<Map<String, dynamic>> sendMessage(
      String conversationId, String content, {String type = 'text', String? replyMessageId}) async {
    final headers = await _getHeaders();
    final bodyMap = <String, dynamic>{
      'content': content,
      'type': type,
    };
    if (replyMessageId != null && replyMessageId.isNotEmpty) {
      bodyMap['replyMessageId'] = replyMessageId;
    }
    final response = await http.post(
      Uri.parse('$baseUrl/chat/$conversationId/messages'),
      headers: headers,
      body: jsonEncode(bodyMap),
    ).timeout(const Duration(seconds: 45));
    return jsonDecode(response.body);
  }

  // Upload Media (Image, Audio, File)
  static Future<Map<String, dynamic>> uploadMedia(
      String conversationId, Uint8List fileBytes, String fileName, String mimeType) async {
    final token = await getToken();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/chat/$conversationId/upload-media'),
    );
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: fileName,
      ),
    );
    request.fields['mimeType'] = mimeType;
    final streamedResponse = await request.send().timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamedResponse);
    return jsonDecode(response.body);
  }

  // Get all users (Contacts)
  static Future<List<dynamic>> getUsers() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/users'),
      headers: headers,
    ).timeout(const Duration(seconds: 45));
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic> && decoded['data'] is List) {
        return decoded['data'] as List<dynamic>;
      } else if (decoded is List) {
        return decoded as List<dynamic>;
      }
    }
    return [];
  }

  // Update FCM Device Token
  static Future<bool> updateFcmToken(String fcmToken) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/fcm-token'),
        headers: headers,
        body: jsonEncode({'fcmToken': fcmToken}),
      ).timeout(const Duration(seconds: 15));
      debugPrint('🔥 [ApiService] Response updateFcmToken status: ${response.statusCode}');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.updateFcmToken: $e');
      return false;
    }
  }

  // React to Message API Fallback
  static Future<Map<String, dynamic>> reactToMessage(String messageId, String emoji) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/chat/messages/$messageId/react'),
        headers: headers,
        body: jsonEncode({'reaction': emoji}),
      ).timeout(const Duration(seconds: 15));
      return jsonDecode(response.body);
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.reactToMessage: $e');
      return {};
    }
  }

  // Update Nickname in Conversation
  static Future<bool> updateNickname(String conversationId, String userId, String? nickname) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/chat/conversations/$conversationId/members/$userId/nickname'),
        headers: headers,
        body: jsonEncode({'nickname': nickname}),
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.updateNickname: $e');
      return false;
    }
  }
}
