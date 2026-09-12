const fs = require('fs');
const path = require('path');

const chatScreenPath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');
let content = fs.readFileSync(chatScreenPath, 'utf8');

// Chuẩn hóa line endings thành \n để tìm kiếm và thay thế chính xác
const isCRLF = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// 1. Info Dialog button
const target1 = `if (conv.type == 'group') {
                      _showGroupNicknameSelectionSheet(provider, conv);
                    } else if (partnerUser != null) {
                      _showEditNicknameDialog(provider, conv, partnerUser);
                    }`;
const rep1 = `_showNicknameSelectionSheet(provider, conv);`;

if (norm.includes(target1)) {
  norm = norm.replace(target1, rep1);
  console.log('✅ 1. Đã cập nhật nút Info Dialog gọi _showNicknameSelectionSheet');
} else {
  console.log('ℹ️ 1. Nút Info Dialog đã được cập nhật trước đó');
}

// 2. _buildSystemMessage
const target2 = `    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 24),
      child: Center(
        child: Text(
          displayText,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF8A8D91),
            fontSize: 12,
            fontWeight: FontWeight.w500,
            fontStyle: FontStyle.italic,
          ),
        ),
      ),
    );`;

const rep2 = `    if (msg.senderId != null && currentUser != null && msg.senderId == currentUser.id) {
      if (displayText.contains('đã đổi chủ đề đoạn chat thành')) {
        final idx = displayText.indexOf('đã đổi chủ đề đoạn chat thành');
        displayText = 'Bạn ' + displayText.substring(idx);
      } else if (displayText.contains('đã đặt biệt danh cho')) {
        final idx = displayText.indexOf('đã đặt biệt danh cho');
        displayText = 'Bạn ' + displayText.substring(idx);
      } else if (displayText.contains('đã tự đặt biệt danh của mình')) {
        final idx = displayText.indexOf('đã tự đặt biệt danh của mình');
        displayText = 'Bạn ' + displayText.substring(idx);
      } else if (displayText.contains('đã xóa biệt danh của')) {
        final idx = displayText.indexOf('đã xóa biệt danh của');
        displayText = 'Bạn ' + displayText.substring(idx);
      }
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 24),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 14),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.04),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            displayText,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );`;

if (norm.includes(target2)) {
  norm = norm.replace(target2, rep2);
  console.log('✅ 2. Đã cập nhật _buildSystemMessage với Pill Container và Fallback đại từ');
} else {
  console.log('ℹ️ 2. _buildSystemMessage đã cập nhật hoặc không tìm thấy khớp');
}

// 3. _showEditNicknameDialog và _showGroupNicknameSelectionSheet
const target3Start = 'void _showEditNicknameDialog(ChatProvider provider, ConversationModel conv, UserModel member) {';
const target3End = 'Widget _buildMessageBubbleContent(MessageModel msg, bool isMe) {';

const idxStart = norm.indexOf(target3Start);
const idxEnd = norm.indexOf(target3End);

if (idxStart !== -1 && idxEnd !== -1) {
  const newMethods = `void _showEditNicknameDialog(ChatProvider provider, ConversationModel conv, UserModel member) {
    final currentNick = conv.nicknames?[member.id] ?? member.nickname ?? '';
    final controller = TextEditingController(text: currentNick);
    final isMe = member.id == provider.currentUser?.id;
    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: Colors.white,
          title: const Text(
            'Đặt biệt danh',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF0F172A)),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isMe
                      ? 'Đặt biệt danh cho chính bạn:'
                      : 'Đặt biệt danh cho \${member.fullName}:',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: 'Nhập biệt danh hoặc để trống để gỡ...',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFF0068FF), width: 2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            ),
            ElevatedButton(
              onPressed: () async {
                final newNick = controller.text.trim();
                Navigator.pop(dialogCtx);
                await provider.updateNickname(conv.id, member.id, newNick.isEmpty ? null : newNick);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0068FF),
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Lưu', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showNicknameSelectionSheet(ChatProvider provider, ConversationModel conv) {
    final currentUserId = provider.currentUser?.id;
    final List<UserModel> participants = [];

    // Luôn đưa tài khoản hiện tại vào danh sách đầu tiên
    if (provider.currentUser != null) {
      final meInConv = conv.members.firstWhere(
        (m) => m.id == currentUserId,
        orElse: () => provider.currentUser!,
      );
      participants.add(meInConv);
    }

    // Đưa các thành viên khác vào
    for (final m in conv.members) {
      if (m.id != currentUserId && !participants.any((p) => p.id == m.id)) {
        participants.add(m);
      }
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (modalCtx) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn thành viên để đổi biệt danh',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 16),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: participants.length,
                  itemBuilder: (ctx, idx) {
                    final member = participants[idx];
                    final isMe = member.id == currentUserId;
                    final displayName = conv.getDisplayName(member.id);
                    final hasCustomNick = conv.nicknames != null && conv.nicknames!.containsKey(member.id) && conv.nicknames![member.id]!.isNotEmpty;

                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF0068FF),
                        backgroundImage: (member.avatar != null && member.avatar!.isNotEmpty)
                            ? NetworkImage(member.avatar!)
                            : null,
                        child: (member.avatar == null || member.avatar!.isEmpty)
                            ? Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U', style: const TextStyle(color: Colors.white))
                            : null,
                      ),
                      title: Row(
                        children: [
                          Flexible(
                            child: Text(
                              displayName,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isMe) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE2E8F0),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('Bạn', style: TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ],
                      ),
                      subtitle: hasCustomNick
                          ? Text('Tên gốc: \${member.fullName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))
                          : const Text('Đặt biệt danh', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                      trailing: const Icon(Icons.edit_outlined, color: Color(0xFF0068FF), size: 20),
                      onTap: () {
                        Navigator.pop(modalCtx);
                        _showEditNicknameDialog(provider, conv, member);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showGroupNicknameSelectionSheet(ChatProvider provider, ConversationModel conv) {
    _showNicknameSelectionSheet(provider, conv);
  }

  `;

  norm = norm.substring(0, idxStart) + newMethods + norm.substring(idxEnd);
  console.log('✅ 3. Đã cập nhật hoàn chỉnh _showEditNicknameDialog và _showNicknameSelectionSheet');
} else {
  console.log('⚠️ 3. Không tìm thấy vị trí methods:', idxStart, idxEnd);
}

// Khôi phục line endings gốc
const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
fs.writeFileSync(chatScreenPath, result, 'utf8');
console.log('🎉 Hoàn tất vá chat_screen.dart!');
