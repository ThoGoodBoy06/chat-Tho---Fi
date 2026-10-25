import 'package:flutter/material.dart';

class ChatThemeItem {
  final String id;
  final String name;
  final LinearGradient gradient;
  final LinearGradient? backgroundGradient;
  final LinearGradient? darkBackgroundGradient;
  final Color? headerColor;
  final Color? darkHeaderColor;
  final Color primaryColor;
  final Color previewColor;

  const ChatThemeItem({
    required this.id,
    required this.name,
    required this.gradient,
    this.backgroundGradient,
    this.darkBackgroundGradient,
    this.headerColor,
    this.darkHeaderColor,
    required this.primaryColor,
    required this.previewColor,
  });
}

class ChatThemes {
  static const List<ChatThemeItem> allThemes = [
    ChatThemeItem(
      id: 'classic',
      name: 'Mặc định (Classic)',
      gradient: LinearGradient(
        colors: [Color(0xFF0084FF), Color(0xFF0068FF)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkHeaderColor: Color(0xFF1E293B),
      primaryColor: Color(0xFF0084FF),
      previewColor: Color(0xFF0084FF),
    ),
    ChatThemeItem(
      id: 'sunset',
      name: 'Hoàng hôn (Sunset)',
      gradient: LinearGradient(
        colors: [Color(0xFFFF512F), Color(0xFFDD2476)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      backgroundGradient: LinearGradient(
        colors: [Color(0xFFFFFAF6), Color(0xFFFFF0EB), Color(0xFFFFE6EE)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkBackgroundGradient: LinearGradient(
        colors: [Color(0xFF230D1C), Color(0xFF180A1A), Color(0xFF120512)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      headerColor: Color(0xFFFFF7F4),
      darkHeaderColor: Color(0xFF220D1D),
      primaryColor: Color(0xFFFF512F),
      previewColor: Color(0xFFDD2476),
    ),
    ChatThemeItem(
      id: 'ocean',
      name: 'Đại dương (Ocean)',
      gradient: LinearGradient(
        colors: [Color(0xFF00B4DB), Color(0xFF0083B0)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      backgroundGradient: LinearGradient(
        colors: [Color(0xFFF0F9FF), Color(0xFFE6F4FE), Color(0xFFDDF0FE)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkBackgroundGradient: LinearGradient(
        colors: [Color(0xFF081C33), Color(0xFF061426), Color(0xFF040E1B)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      headerColor: Color(0xFFF5FAFF),
      darkHeaderColor: Color(0xFF081E36),
      primaryColor: Color(0xFF00B4DB),
      previewColor: Color(0xFF0083B0),
    ),
    ChatThemeItem(
      id: 'berry',
      name: 'Quả mọng (Berry)',
      gradient: LinearGradient(
        colors: [Color(0xFF8A2387), Color(0xFFE94057)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      backgroundGradient: LinearGradient(
        colors: [Color(0xFFFDF4F8), Color(0xFFF8EFFD), Color(0xFFF3E8FF)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkBackgroundGradient: LinearGradient(
        colors: [Color(0xFF220C26), Color(0xFF18081D), Color(0xFF110414)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      headerColor: Color(0xFFFBF6FB),
      darkHeaderColor: Color(0xFF200B24),
      primaryColor: Color(0xFFE94057),
      previewColor: Color(0xFF8A2387),
    ),
    ChatThemeItem(
      id: 'emerald',
      name: 'Ngọc bích (Emerald)',
      gradient: LinearGradient(
        colors: [Color(0xFF11998E), Color(0xFF38EF7D)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      backgroundGradient: LinearGradient(
        colors: [Color(0xFFF0FDF4), Color(0xFFE7FAF0), Color(0xFFDDF6EA)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkBackgroundGradient: LinearGradient(
        colors: [Color(0xFF06221A), Color(0xFF041813), Color(0xFF03100D)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      headerColor: Color(0xFFF5FCF7),
      darkHeaderColor: Color(0xFF062019),
      primaryColor: Color(0xFF11998E),
      previewColor: Color(0xFF38EF7D),
    ),
    ChatThemeItem(
      id: 'love',
      name: 'Tình yêu (Love)',
      gradient: LinearGradient(
        colors: [Color(0xFFFF3377), Color(0xFFFF6584)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      backgroundGradient: LinearGradient(
        colors: [Color(0xFFFFF0F5), Color(0xFFFFEBF0), Color(0xFFFFE4EC)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      darkBackgroundGradient: LinearGradient(
        colors: [Color(0xFF260C1B), Color(0xFF1A0713), Color(0xFF12040D)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      headerColor: Color(0xFFFFF5F8),
      darkHeaderColor: Color(0xFF240A1A),
      primaryColor: Color(0xFFFF3377),
      previewColor: Color(0xFFFF3377),
    ),
  ];

  static ChatThemeItem getTheme(String? themeId) {
    if (themeId == null || themeId.isEmpty || themeId == 'default') {
      return allThemes[0];
    }
    return allThemes.firstWhere(
      (t) => t.id == themeId,
      orElse: () => allThemes[0],
    );
  }
}
