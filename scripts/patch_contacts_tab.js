const fs = require('fs');

const files = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');

  // 1. Desktop Nav Rail
  const oldDesktopRail = `                    onTap: () {
                      setState(() => _currentTabIndex = index);
                      if (index == 3) {
                        _loadAiHistory(forceReload: true);
                      }
                    },`;
  const newDesktopRail = `                    onTap: () {
                      setState(() => _currentTabIndex = index);
                      if (index == 1) {
                        _fetchPendingRequestsCount();
                        _contactsFuture = ApiService.getFriends();
                      } else if (index == 3) {
                        _loadAiHistory(forceReload: true);
                      }
                    },`;
  if (content.includes(oldDesktopRail)) {
    content = content.replace(oldDesktopRail, newDesktopRail);
    console.log('Patched desktop rail in', f);
  }

  // 2. Mobile Bottom Bar
  const oldMobileBottom = `              onTap: () {
                setState(() => _currentTabIndex = index);
                if (index == 1) {
                  _fetchPendingRequestsCount();
                } else if (index == 3) {
                  _loadAiHistory(forceReload: true);
                }
              },`;
  const newMobileBottom = `              onTap: () {
                setState(() => _currentTabIndex = index);
                if (index == 1) {
                  _fetchPendingRequestsCount();
                  _contactsFuture = ApiService.getFriends();
                } else if (index == 3) {
                  _loadAiHistory(forceReload: true);
                }
              },`;
  if (content.includes(oldMobileBottom)) {
    content = content.replace(oldMobileBottom, newMobileBottom);
    console.log('Patched mobile bottom in', f);
  }

  // 3. Header in _buildContactsTab
  const oldHeader = `          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.people_alt_rounded, color: Color(0xFF0068FF), size: 26),
                const SizedBox(width: 8),
                Text(
                  'Danh Bạ',
                  style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),`;

  const newHeader = `          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.people_alt_rounded, color: Color(0xFF0068FF), size: 26),
                    const SizedBox(width: 8),
                    Text(
                      'Danh Bạ',
                      style: TextStyle(color: textColor, fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                IconButton(
                  tooltip: 'Thêm bạn bè',
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0068FF).withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF0068FF), size: 20),
                  ),
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AddFriendScreen()),
                    );
                    if (mounted) {
                      setState(() {
                        _contactsFuture = ApiService.getFriends();
                      });
                      _fetchPendingRequestsCount();
                    }
                  },
                ),
              ],
            ),
          ),`;

  if (content.includes(oldHeader)) {
    content = content.replace(oldHeader, newHeader);
    console.log('Patched header in', f);
  }

  // 4. Empty state
  const oldEmpty = `                if (filteredUsers.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline_rounded, size: 52, color: subTextColor),
                          const SizedBox(height: 12),
                          Text(
                            _contactSearchQuery.isNotEmpty ? 'Không tìm thấy bạn bè nào phù hợp' : 'Bạn chưa có người bạn nào trong danh bạ.\\nHãy bấm nút (+) ở góc trên để tìm và kết bạn mới!',
                            style: TextStyle(color: subTextColor, fontSize: 14, height: 1.4),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  );
                }`;

  const newEmpty = `                if (filteredUsers.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline_rounded, size: 52, color: subTextColor),
                          const SizedBox(height: 12),
                          Text(
                            _contactSearchQuery.isNotEmpty ? 'Không tìm thấy bạn bè nào phù hợp' : 'Bạn chưa có người bạn nào trong danh bạ.\\nHãy bấm nút (+) ở góc trên để tìm và kết bạn mới!',
                            style: TextStyle(color: subTextColor, fontSize: 14, height: 1.4),
                            textAlign: TextAlign.center,
                          ),
                          if (_contactSearchQuery.isEmpty) ...[
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const AddFriendScreen()),
                                );
                                if (mounted) {
                                  setState(() {
                                    _contactsFuture = ApiService.getFriends();
                                  });
                                  _fetchPendingRequestsCount();
                                }
                              },
                              icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                              label: const Text('Thêm bạn bè ngay'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF0068FF),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }`;

  if (content.includes(oldEmpty)) {
    content = content.replace(oldEmpty, newEmpty);
    console.log('Patched empty state in', f);
  }

  // 5. Avatar item in ListTile
  const oldAvatarBlock = `                      leading: Stack(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: _getAvatarGradient(name),
                            ),
                            child: Center(
                              child: Text(
                                _getInitials(name),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, height: 1.0),
                              ),
                            ),
                          ),`;

  const newAvatarBlock = `                      leading: Stack(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: (u['avatar'] == null || u['avatar'].toString().trim().isEmpty) ? _getAvatarGradient(name) : null,
                            ),
                            child: ClipOval(
                              child: (u['avatar'] != null && u['avatar'].toString().trim().isNotEmpty)
                                  ? Image(
                                      image: getSafeAvatarProvider(u['avatar'].toString())!,
                                      width: 48,
                                      height: 48,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        width: 48,
                                        height: 48,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          gradient: _getAvatarGradient(name),
                                        ),
                                        child: Center(
                                          child: Text(
                                            _getInitials(name),
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, height: 1.0),
                                          ),
                                        ),
                                      ),
                                    )
                                  : Center(
                                      child: Text(
                                        _getInitials(name),
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white, height: 1.0),
                                      ),
                                    ),
                            ),
                          ),`;

  if (content.includes(oldAvatarBlock)) {
    content = content.replace(oldAvatarBlock, newAvatarBlock);
    console.log('Patched avatar block in', f);
  }

  fs.writeFileSync(f, content, 'utf8');
}
console.log('Done patching dart files.');
