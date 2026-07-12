import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isMe;
  final String chatTheme;
  final String? partnerAvatar;
  final bool showTime;
  final bool isLastReadMessage; // Để hiển thị avatar thu nhỏ báo hiệu "Đã xem"

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.chatTheme,
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

  // Vẽ khối tin nhắn trích dẫn (Replied Message Preview)
  Widget _buildReplyMessageWidget() {
    final replyMsg = message['replyMessage'];
    if (replyMsg == null) return const SizedBox.shrink();

    // Xác định tên người gửi tin nhắn gốc
    final String senderName = replyMsg['senderId'] == message['senderId']
        ? (isMe ? "Bạn" : "Đối phương")
        : (isMe ? "Đối phương" : "Bạn");

    final content = replyMsg['content'] ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 6.0),
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
      decoration: BoxDecoration(
        color: isMe ? Colors.white.withOpacity(0.18) : Colors.black.withOpacity(0.06),
        borderRadius: BorderRadius.circular(8),
      ),
      child: IntrinsicHeight(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 3,
              decoration: BoxDecoration(
                color: isMe ? Colors.white70 : const Color(0xFF0068FF),
                borderRadius: BorderRadius.circular(1.5),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                     senderName,
                     style: TextStyle(
                       fontSize: 10.5,
                       fontWeight: FontWeight.bold,
                       color: isMe ? Colors.white.withOpacity(0.9) : Colors.black87,
                     ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                     content.toString(),
                     maxLines: 1,
                     overflow: TextOverflow.ellipsis,
                     style: TextStyle(
                       fontSize: 12,
                       color: isMe ? Colors.white70 : Colors.black54,
                     ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
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
                        ? (chatTheme == 'love' ? null : const Color(0xFF0068FF))
                        : const Color(0xF2F0F2F5),
                    gradient: isMe && chatTheme == 'love'
                        ? const LinearGradient(
                            colors: [Color(0xFFFF758C), Color(0xFFFF7EB3)],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          )
                        : null,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(isMe ? 18 : 4),
                      bottomRight: Radius.circular(isMe ? 4 : 18),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildReplyMessageWidget(),
                      _buildMessageContent(),
                    ],
                  ),
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
