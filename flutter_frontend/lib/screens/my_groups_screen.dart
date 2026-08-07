import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/theme_provider.dart';

class MyGroupsScreen extends StatelessWidget {
  const MyGroupsScreen({Key? key}) : super(key: key);

  LinearGradient _getAvatarGradient(String key) {
    final gradients = [
      const LinearGradient(colors: [Color(0xFF007AFF), Color(0xFF5AC8FA)]),
      const LinearGradient(colors: [Color(0xFF5856D6), Color(0xFFAF52DE)]),
      const LinearGradient(colors: [Color(0xFFFF2D55), Color(0xFFFF6482)]),
      const LinearGradient(colors: [Color(0xFFFF9500), Color(0xFFFFCC00)]),
      const LinearGradient(colors: [Color(0xFF34C759), Color(0xFF30D158)]),
      const LinearGradient(colors: [Color(0xFF00C7BE), Color(0xFF63E6E2)]),
      const LinearGradient(colors: [Color(0xFFA28BFE), Color(0xFF6B4EFF)]),
    ];
    final index = key.hashCode.abs() % gradients.length;
    return gradients[index];
  }

  String _getInitials(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'G';
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
    }
    if (trimmed.length >= 2) {
      return trimmed.substring(0, 2).toUpperCase();
    }
    return trimmed[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ChatProvider>(context);
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final bgColor = isDark ? const Color(0xFF0F172A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);

    final groupConversations = provider.conversations.where((conv) {
      return conv.isGroup;
    }).toList();

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: Text(
          'Nhóm của tôi',
          style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: bgColor,
        elevation: 0.5,
        iconTheme: IconThemeData(color: textColor),
      ),
      body: groupConversations.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.groups_outlined, size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 12),
                  const Text(
                    'Bạn chưa tham gia nhóm nào',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 15, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: groupConversations.length,
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                indent: 76,
                color: Color(0xFFF1F5F9),
              ),
              itemBuilder: (context, index) {
                final group = groupConversations[index];
                final groupName = group.name.isNotEmpty ? group.name : 'Nhóm chat';
                final memberCount = group.memberCount;

                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  leading: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: _getAvatarGradient(groupName),
                    ),
                    child: Center(
                      child: Text(
                        _getInitials(groupName),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  title: Text(
                    groupName,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    memberCount > 0 ? '$memberCount thành viên' : 'Nhóm trò chuyện',
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
                  onTap: () {
                    provider.selectConversation(group);
                    Navigator.pop(context);
                  },
                );
              },
            ),
    );
  }
}
