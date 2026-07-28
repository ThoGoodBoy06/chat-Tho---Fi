import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:html' as html;

class ApiService {
  static String get baseUrl {
    final location = html.window.location;
    final host = location.hostname;
    // Nếu đang chạy trên Flutter dev server (port 8080), trỏ về backend port 3000
    if (location.port == '8080') {
      return 'http://$host:3000/api';
    }
    return '/api';
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
    );
    return jsonDecode(response.body);
  }

  // Auth: Register
  static Future<Map<String, dynamic>> register(Map<String, String> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  // Auth: Get Current User Profile
  static Future<Map<String, dynamic>> getMe() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return {};
  }

  // Fetch Conversations
  static Future<List<dynamic>> getConversations() async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/chat/conversations'),
      headers: headers,
    );
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

  // Fetch Messages for a conversation
  static Future<Map<String, dynamic>> getMessages(String conversationId, {int limit = 50}) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/chat/$conversationId/messages?limit=$limit'),
      headers: headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    return {'data': []};
  }

  // Create or get 1-on-1 private conversation
  static Future<Map<String, dynamic>> createConversation(String receiverId) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/chat/conversations'),
      headers: headers,
      body: jsonEncode({'receiverId': receiverId}),
    );
    return jsonDecode(response.body);
  }

  // Send Message
  static Future<Map<String, dynamic>> sendMessage(String conversationId, String content, {String type = 'text'}) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/chat/$conversationId/messages'),
      headers: headers,
      body: jsonEncode({
        'content': content,
        'type': type,
      }),
    );
    return jsonDecode(response.body);
  }
}
