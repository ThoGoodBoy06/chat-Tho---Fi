import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

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

  // Get accepted friends only (Danh bạ bạn bè thực sự đã kết bạn)
  static Future<List<dynamic>> getFriends() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/users/friends'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        } else if (decoded is List) {
          return decoded as List<dynamic>;
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.getFriends: $e');
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

  // Change password API
  static Future<Map<String, dynamic>> changePassword(String currentPassword, String newPassword) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/change-password'),
        headers: headers,
        body: jsonEncode({
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        }),
      ).timeout(const Duration(seconds: 15));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Đổi mật khẩu thành công!'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Đổi mật khẩu thất bại'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Lỗi kết nối máy chủ: $e'};
    }
  }

  // Update Profile API
  static Future<bool> updateProfile({String? fullName, String? bio}) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/users/profile'),
        headers: headers,
        body: jsonEncode({
          if (fullName != null) 'fullName': fullName,
          if (bio != null) 'bio': bio,
        }),
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.updateProfile: $e');
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

  // --- ADMIN APIs ---

  // Lấy thống kê tổng quan (Overview Stats)
  static Future<AdminStatsModel?> getAdminStats() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/stats'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] != null) {
          return AdminStatsModel.fromJson(Map<String, dynamic>.from(decoded['data']));
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.getAdminStats: $e');
    }
    return null;
  }

  // Lấy danh sách người dùng (Admin User Management)
  static Future<Map<String, dynamic>> getAdminUsers({String search = '', int page = 1, int limit = 20}) async {
    try {
      final headers = await _getHeaders();
      final queryParams = 'search=${Uri.encodeComponent(search)}&page=$page&limit=$limit';
      final response = await http.get(
        Uri.parse('$baseUrl/admin/users?$queryParams'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.getAdminUsers: $e');
    }
    return {'success': false, 'data': []};
  }

  // Khóa/Mở khóa hoặc Đổi Role người dùng
  static Future<bool> updateUserStatus(String userId, {bool? isBlocked, String? role}) async {
    try {
      final headers = await _getHeaders();
      final bodyMap = <String, dynamic>{};
      if (isBlocked != null) bodyMap['isBlocked'] = isBlocked;
      if (role != null) bodyMap['role'] = role;

      final response = await http.put(
        Uri.parse('$baseUrl/admin/users/$userId/status'),
        headers: headers,
        body: jsonEncode(bodyMap),
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.updateUserStatus: $e');
      return false;
    }
  }

  // Lấy danh sách tất cả các cuộc trò chuyện
  static Future<List<dynamic>> getAdminConversations() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/conversations'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.getAdminConversations: $e');
    }
    return [];
  }

  // Xem chi tiết lịch sử tin nhắn của 1 cuộc trò chuyện
  static Future<List<MessageModel>> getAdminMessages(String conversationId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/conversations/$conversationId/messages'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] is List) {
          return (decoded['data'] as List)
              .map((m) => MessageModel.fromJson(Map<String, dynamic>.from(m)))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.getAdminMessages: $e');
    }
    return [];
  }

  // Xóa / Thu hồi tin nhắn vi phạm
  static Future<bool> deleteAdminMessage(String messageId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/admin/messages/$messageId'),
        headers: headers,
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.deleteAdminMessage: $e');
      return false;
    }
  }

  // Lấy danh sách báo cáo vi phạm
  static Future<List<ReportModel>> getAdminReports() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/admin/reports'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] is List) {
          return (decoded['data'] as List)
              .map((r) => ReportModel.fromJson(Map<String, dynamic>.from(r)))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.getAdminReports: $e');
    }
    return [];
  }

  // Cập nhật trạng thái báo cáo
  static Future<bool> updateReportStatus(String reportId, String status) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$baseUrl/admin/reports/$reportId'),
        headers: headers,
        body: jsonEncode({'status': status}),
      ).timeout(const Duration(seconds: 15));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Error in ApiService.updateReportStatus: $e');
      return false;
    }
  }

  // Lấy danh sách lời mời kết bạn PENDING
  static Future<List<dynamic>> getPendingFriendRequests() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/users/friend-requests'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.getPendingFriendRequests: $e');
    }
    return [];
  }

  // Chấp nhận lời mời kết bạn
  static Future<bool> acceptFriendRequest(String requestId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/friend-requests/$requestId/accept'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['success'] == true;
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.acceptFriendRequest: $e');
    }
    return false;
  }

  // Từ chối lời mời kết bạn
  static Future<bool> rejectFriendRequest(String requestId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/friend-requests/$requestId/reject'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['success'] == true;
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.rejectFriendRequest: $e');
    }
    return false;
  }

  // Tìm kiếm người dùng theo từ khóa (Tên, username, SĐT, email)
  static Future<List<dynamic>> searchUsers(String query) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/users/search?q=${Uri.encodeComponent(query)}'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        }
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.searchUsers: $e');
    }
    return [];
  }

  // Gửi lời mời kết bạn
  static Future<bool> sendFriendRequest(String targetUserId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/friend-requests'),
        headers: headers,
        body: jsonEncode({'receiverId': targetUserId}),
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['success'] == true;
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.sendFriendRequest: $e');
    }
    return false;
  }

  // Xóa bạn bè
  static Future<bool> deleteFriend(String friendId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/users/friends/$friendId'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['success'] == true;
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.deleteFriend: $e');
    }
    return false;
  }

  // Hủy lời mời kết bạn đã gửi
  static Future<bool> cancelFriendRequest(String receiverId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/users/friend-requests/$receiverId/cancel'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['success'] == true;
      }
    } catch (e) {
      debugPrint('⚠️ Error ApiService.cancelFriendRequest: $e');
    }
    return false;
  }
}
