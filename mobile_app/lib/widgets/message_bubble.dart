import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isMe;
  final String? partnerAvatar;
  final bool showTime;
  final bool isLastReadMessage; // Để hiển thị avatar thu nhỏ báo hiệu "Đã xem"

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    this.partnerAvatar,
    this.showTime = false,
    this.isLastReadMessage = false,
  });

  String _formatTime(String? createdAtStr) {
    if (createdAtStr == null) return "";
    try {
      final dateTime = DateTime.parse(createdAtStr).toLocal();
      return DateFormat('HH:mm').format(dateTime);
    } catch (_) {
      return "";
    }
  }

  Widget _buildMessageContent() {
    final type = message['type'] ?? 'text';
    final content = message['content'] ?? '';
    final isRecalled = message['isRecalled'] == true;

    if (isRecalled) {
      return const Text(
        "Tin nhắn đã bị thu hồi",
        style: TextStyle(
          fontStyle: FontStyle.italic,
          color: Colors.grey,
        ),
      );
    }

    if (type == 'image' || content.toString().startsWith('data:image/') || content.toString().contains('.png') || content.toString().contains('.jpg')) {
      final String imageUrl = content.toString().startsWith('data:image/')
          ? content.toString()
          : (content.toString().startsWith('http')
              ? content.toString()
              : 'https://chat-tho-fi.onrender.com' + content.toString());

      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              padding: const EdgeInsets.all(12),
              color: Colors.grey.shade200,
              child: const Icon(Icons.broken_image, color: Colors.grey),
            );
          },
        ),
      );
    }

    // Mặc định là tin nhắn văn bản (text)
    return Text(
      content.toString(),
      style: TextStyle(
        color: isMe ? Colors.white : Colors.black87,
        fontSize: 15,
        height: 1.3,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reactions = message['reactions'] as List?;
    final timeStr = _formatTime(message['createdAt']);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0, horizontal: 12.0),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (showTime && timeStr.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8.0, bottom: 4.0),
              child: Center(
                child: Text(
                  timeStr,
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
              ),
            ),
          Row(
            mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!isMe) ...[
                CircleAvatar(
                  radius: 14,
                  backgroundColor: Colors.grey.shade200,
                  backgroundImage: partnerAvatar != null && partnerAvatar!.isNotEmpty
                      ? NetworkImage(partnerAvatar!.startsWith('http')
                          ? partnerAvatar!
                          : 'https://chat-tho-fi.onrender.com' + partnerAvatar!)
                      : null,
                  child: partnerAvatar == null || partnerAvatar!.isEmpty
                      ? const Icon(Icons.person, size: 14, color: Colors.grey)
                      : null,
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.72,
                  ),
                  decoration: BoxDecoration(
                    color: isMe 
                        ? const Color(0xFF0068FF) 
                        : const Color(0xF2F0F2F5),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(isMe ? 18 : 4),
                      bottomRight: Radius.circular(isMe ? 4 : 18),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                  child: _buildMessageContent(),
                ),
              ),
            ],
          ),
          
          // Hiển thị Reactions thả tim/like
          if (reactions != null && reactions.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2.0, left: 36.0, right: 8.0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    )
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: reactions.map((react) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1.0),
                      child: Text(
                        react['emoji'] ?? '❤️',
                        style: const TextStyle(fontSize: 12),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

          // Hiển thị Avatar "Đã xem" (Last Read Avatar) ở góc phải dưới tin nhắn của mình
          if (isMe && isLastReadMessage && partnerAvatar != null)
            Padding(
              padding: const EdgeInsets.only(top: 2.0, right: 2.0),
              child: CircleAvatar(
                radius: 6.5,
                backgroundColor: Colors.grey.shade200,
                backgroundImage: partnerAvatar!.isNotEmpty
                    ? NetworkImage(partnerAvatar!.startsWith('http')
                        ? partnerAvatar!
                        : 'https://chat-tho-fi.onrender.com' + partnerAvatar!)
                    : null,
              ),
            ),
        ],
      ),
    );
  }
}
