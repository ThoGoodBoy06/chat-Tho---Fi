import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_service.dart';

/// MessageItemBubble: Widget hiển thị một bong bóng tin nhắn riêng biệt.
/// Độc lập, được cô lập bằng RepaintBoundary và ValueKey để GPU không phải vẽ lại
/// các bong bóng khác khi một tin nhắn thay đổi trạng thái (seen, reaction, typing).
class MessageItemBubble extends StatelessWidget {
  final MessageModel message;
  final bool isMe;
  final String? avatarUrl;
  final String senderName;
  final bool showTime;
  final Widget? contentWidget;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final VoidCallback? onDoubleTap;

  const MessageItemBubble({
    Key? key,
    required this.message,
    required this.isMe,
    this.avatarUrl,
    required this.senderName,
    this.showTime = false,
    this.contentWidget,
    this.onTap,
    this.onLongPress,
    this.onDoubleTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        child: Row(
          mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMe) ...[
              CircleAvatar(
                radius: 14,
                backgroundColor: const Color(0xFF0068FF),
                backgroundImage: (avatarUrl != null && avatarUrl!.isNotEmpty)
                    ? ResizeImage(
                        NetworkImage(ApiService.formatImageUrl(avatarUrl!)),
                        width: 56,
                        height: 56,
                      )
                    : null,
                child: (avatarUrl == null || avatarUrl!.isEmpty)
                    ? Text(
                        senderName.isNotEmpty ? senderName[0].toUpperCase() : 'U',
                        style: const TextStyle(fontSize: 10, color: Colors.white),
                      )
                    : null,
              ),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: GestureDetector(
                onTap: onTap,
                onLongPress: onLongPress,
                onDoubleTap: onDoubleTap,
                child: contentWidget ??
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isMe ? const Color(0xFF0068FF) : const Color(0xFFE4E6EB),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        message.content,
                        style: TextStyle(
                          color: isMe ? Colors.white : Colors.black87,
                          fontSize: 15,
                        ),
                      ),
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
