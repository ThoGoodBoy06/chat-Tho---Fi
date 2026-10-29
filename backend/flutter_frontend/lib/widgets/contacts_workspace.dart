import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'app_avatar.dart';
import 'skeleton_box.dart';
import 'tab_design.dart';

/// Contacts are loaded once by the screen; online faces and rows use that same data.
class ContactsWorkspace extends StatelessWidget {
  const ContactsWorkspace(
      {super.key,
      required this.friends,
      required this.currentUserId,
      required this.query,
      required this.controller,
      required this.onQuery,
      required this.normalize,
      required this.pending,
      this.presence = const {},
      required this.onAdd,
      required this.onRequests,
      required this.onGroups,
      required this.onRetry,
      required this.onProfile,
      required this.onMessage,
      required this.onCall,
      required this.onRemove});
  final Future<List<dynamic>> friends;
  final String? currentUserId;
  final String query;
  final TextEditingController controller;
  final ValueChanged<String> onQuery;
  final String Function(String) normalize;
  final int pending;
  final Map<String, bool> presence;
  final VoidCallback onAdd, onRequests, onGroups, onRetry;
  final ValueChanged<Map<String, dynamic>> onProfile,
      onMessage,
      onCall,
      onRemove;
  String _name(Map<String, dynamic> u) =>
      (u['fullName'] ?? u['name'] ?? u['username'] ?? 'Người dùng').toString();
  bool _online(Map<String, dynamic> u) =>
      presence[u['id']?.toString()] ??
      (u['isOnline'] == true || u['status'] == 'online');
  String _section(Map<String, dynamic> u) {
    final text = normalize(_name(u)).trim().toUpperCase();
    return text.isEmpty || !RegExp(r'^[A-Z]').hasMatch(text) ? '#' : text[0];
  }

  Widget _avatar(Map<String, dynamic> u, {double radius = 23}) {
    final name = _name(u);
    final photo = u['avatar']?.toString().trim() ?? '';
    final words =
        name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    final initials =
        words.take(2).map((w) => w.characters.first).join().toUpperCase();
    return Stack(clipBehavior: Clip.none, children: [
      AppAvatar(
          radius: radius,
          backgroundColor: Colors
              .primaries[name.hashCode.abs() % Colors.primaries.length]
              .shade600,
          backgroundImage: photo.isEmpty
              ? null
              : NetworkImage(ApiService.formatImageUrl(photo)),
          child: Text(initials,
              style: TextStyle(
                  color: Colors.white,
                  fontSize: radius * 0.6,
                  fontWeight: FontWeight.w700))),
      if (_online(u))
        Positioned(
            bottom: 0,
            right: -1,
            child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                    color: const Color(0xFF26BC74),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2)))),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = scheme.onSurfaceVariant;
    final pale = dark ? const Color(0xFF1E293B) : const Color(0xFFF2F5FA);
    return ColoredBox(
      color: dark ? const Color(0xFF0F172A) : Colors.white,
      child: Column(children: [
        TabHeading(title: 'Danh bạ', brandActions: [
          IconButton(
              tooltip: 'Nhóm của tôi',
              onPressed: onGroups,
              icon: const Icon(Icons.group_outlined, size: 22))
        ], actions: [
          IconButton(
              tooltip: 'Thêm bạn bè',
              onPressed: onAdd,
              icon:
                  Icon(Icons.person_add_alt_1_outlined, color: scheme.primary)),
        ]),
        TabSearch(
            controller: controller, hint: 'Tìm bạn bè', onChanged: onQuery),
        Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Row(children: [
              Expanded(
                  child: TextButton(
                      onPressed: () {
                        controller.clear();
                        onQuery('');
                      },
                      style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFF0068FF),
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 44),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12))),
                      child: const Text('Bạn bè',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)))),
              const SizedBox(width: 8),
              Expanded(
                  child: TextButton(
                      onPressed: onRequests,
                      style: TextButton.styleFrom(
                          backgroundColor: pale,
                          foregroundColor: muted,
                          minimumSize: const Size(0, 44),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12))),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('Lời mời',
                                style: TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600)),
                            if (pending > 0) ...[
                              const SizedBox(width: 8),
                              Badge(
                                  label:
                                      Text(pending > 99 ? '99+' : '$pending'))
                            ],
                          ]))),
            ])),
        Expanded(
            child: FutureBuilder<List<dynamic>>(
                future: friends,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return ListView.builder(
                        itemCount: 8,
                        itemBuilder: (_, i) => const Padding(
                            padding: EdgeInsets.symmetric(
                                horizontal: 20, vertical: 13),
                            child: Row(children: [
                              SkeletonBox(width: 46, height: 46, circle: true),
                              SizedBox(width: 14),
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    SkeletonBox(width: 130, height: 16),
                                    SizedBox(height: 8),
                                    SkeletonBox(width: 90, height: 12),
                                  ])),
                            ])));
                  }
                  final q = normalize(query).toLowerCase();
                  final users = (snapshot.data ?? [])
                      .whereType<Map>()
                      .map((u) => Map<String, dynamic>.from(u))
                      .where((u) => u['id']?.toString() != currentUserId)
                      .where((u) =>
                          normalize('${_name(u)} ${u['username'] ?? ''}')
                              .toLowerCase()
                              .contains(q))
                      .toList()
                    ..sort((a, b) => normalize(_name(a))
                        .toLowerCase()
                        .compareTo(normalize(_name(b)).toLowerCase()));
                  final online = users.where(_online).toList();
                  return CustomScrollView(
                      key: const PageStorageKey('contacts-workspace'),
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      slivers: [
                        if (online.isNotEmpty && query.isEmpty)
                          SliverToBoxAdapter(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                const Padding(
                                    padding: EdgeInsets.fromLTRB(20, 8, 20, 14),
                                    child: Text('Đang hoạt động',
                                        style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700))),
                                SizedBox(
                                    height: 86,
                                    child: ListView.separated(
                                        scrollDirection: Axis.horizontal,
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 20),
                                        itemCount: online.length,
                                        separatorBuilder: (_, __) =>
                                            const SizedBox(width: 16),
                                        itemBuilder: (_, i) {
                                          final user = online[i];
                                          return SizedBox(
                                              width: 62,
                                              child: InkWell(
                                                  borderRadius:
                                                      BorderRadius.circular(14),
                                                  onTap: () => onMessage(user),
                                                  child: Column(children: [
                                                    _avatar(user, radius: 26),
                                                    const SizedBox(height: 8),
                                                    Text(_name(user),
                                                        maxLines: 1,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: const TextStyle(
                                                            fontSize: 11)),
                                                  ])));
                                        })),
                              ])),
                        if (users.isEmpty)
                          SliverFillRemaining(
                              hasScrollBody: false,
                              child: Center(
                                  child: Padding(
                                      padding: const EdgeInsets.all(24),
                                      child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.people_outline_rounded,
                                                color: muted, size: 46),
                                            const SizedBox(height: 12),
                                            Text(
                                                snapshot.hasError
                                                    ? 'Chưa tải được danh bạ'
                                                    : query.isNotEmpty
                                                        ? 'Không tìm thấy bạn bè phù hợp'
                                                        : 'Kết nối để bắt đầu một câu chuyện mới.',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                    color: muted, height: 1.5)),
                                            TextButton(
                                                onPressed: snapshot.hasError
                                                    ? onRetry
                                                    : onAdd,
                                                child: Text(snapshot.hasError
                                                    ? 'Thử lại'
                                                    : 'Thêm bạn bè')),
                                          ])))),
                        SliverList(
                            delegate: SliverChildBuilderDelegate((context, i) {
                          final u = users[i];
                          final section = _section(u);
                          final showSection =
                              i == 0 || _section(users[i - 1]) != section;
                          return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (showSection)
                                  Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                          20, 14, 20, 6),
                                      child: Text(section,
                                          style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: muted))),
                                Padding(
                                    padding: const EdgeInsets.only(
                                        left: 12, right: 6),
                                    child: Row(children: [
                                      Expanded(
                                          child: ListTile(
                                              contentPadding:
                                                  const EdgeInsets.only(
                                                      left: 8),
                                              onTap: () => onProfile(u),
                                              leading: _avatar(u),
                                              title: Text(_name(u),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                      fontSize: 14,
                                                      fontWeight:
                                                          FontWeight.w600)))),
                                      IconButton(
                                          tooltip: 'Gọi ${_name(u)}',
                                          onPressed: () => onCall(u),
                                          icon: Icon(Icons.call_outlined,
                                              size: 21, color: scheme.primary)),
                                      IconButton(
                                          tooltip: 'Nhắn tin cho ${_name(u)}',
                                          onPressed: () => onMessage(u),
                                          icon: Icon(
                                              Icons.chat_bubble_outline_rounded,
                                              size: 21,
                                              color: scheme.primary)),
                                      PopupMenuButton<String>(
                                          tooltip: 'Tùy chọn ${_name(u)}',
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(
                                              minWidth: 130),
                                          iconSize: 18,
                                          onSelected: (_) => onRemove(u),
                                          itemBuilder: (_) => [
                                                const PopupMenuItem(
                                                    value: 'remove',
                                                    child: Text('Xóa bạn bè'))
                                              ]),
                                    ])),
                                Divider(
                                    height: 1,
                                    indent: 80,
                                    endIndent: 20,
                                    color:
                                        scheme.outlineVariant.withOpacity(0.4)),
                              ]);
                        }, childCount: users.length)),
                        const SliverToBoxAdapter(child: SizedBox(height: 16)),
                      ]);
                })),
      ]),
    );
  }
}
