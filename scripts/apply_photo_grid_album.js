const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`Processing: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update _pickAndUploadImage to allow multiple file selection and batch optimistic sending
  const oldPickMarker = 'final uploadInput = html.FileUploadInputElement()..accept = \'image/*,.jpg,.jpeg,.png,.gif,.webp,.jfif,.heic,.heif,.avif,.bmp,.svg,.ico,.tiff,.tif,image/heic,image/heif,image/webp,image/avif\';';
  const newPickMarker = `final uploadInput = html.FileUploadInputElement()
      ..accept = 'image/*,.jpg,.jpeg,.png,.gif,.webp,.jfif,.heic,.heif,.avif,.bmp,.svg,.ico,.tiff,.tif,image/heic,image/heif,image/webp,image/avif'
      ..multiple = true;`;

  if (content.includes(oldPickMarker)) {
    content = content.replace(oldPickMarker, newPickMarker);
    console.log(`  [${path.basename(filePath)}] Added multiple = true to FileUploadInputElement`);
  }

  // Update file reading loop in _pickAndUploadImage
  const oldLoopBlock = `uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final file = files[0];
        final scaffold = ScaffoldMessenger.of(context);
        scaffold.hideCurrentSnackBar();
        scaffold.showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                SizedBox(width: 12),
                Text('Đang gửi hình ảnh...'),
              ],
            ),
            duration: Duration(minutes: 1),
          ),
        );
        final reader = html.FileReader();
        reader.readAsArrayBuffer(file);
        reader.onLoadEnd.listen((e) async {
          final bytes = _extractUint8ListFromReader(reader.result);
          if (bytes != null && bytes.isNotEmpty) {
            String mimeType = file.type;
            if (mimeType.isEmpty) {
              final ext = (file.name.split('.').pop() ?? '').toLowerCase();
              if (ext == 'png') mimeType = 'image/png';
              else if (ext == 'webp') mimeType = 'image/webp';
              else if (ext == 'gif') mimeType = 'image/gif';
              else mimeType = 'image/jpeg';
            }

            // Tạo ngay tin nhắn ảnh tạm thời với hiệu ứng đang gửi (Optimistic UI)
            final optId = 'optimistic-\${DateTime.now().millisecondsSinceEpoch}';
            final base64Url = 'data:\$mimeType;base64,\${base64Encode(bytes)}';
            final tempMsg = MessageModel(
              id: optId,
              conversationId: conv.id,
              senderId: provider.currentUser?.id,
              type: 'image',
              content: base64Url,
              imageUrl: base64Url,
              createdAt: DateTime.now(),
            );
            provider.addRealtimeMessage(tempMsg);
            _scrollToBottom();

            try {
              final res = await ApiService.uploadMedia(conv.id, bytes, file.name, mimeType);
              scaffold.hideCurrentSnackBar();
              if (res['success'] == true && res['data'] != null) {
                try {
                  final realMsg = MessageModel.fromJson(res['data']);
                  // Thay thế tin nhắn tạm bằng tin nhắn chính thức từ server
                  final idx = provider.messages.indexWhere((m) => m.id == optId);
                  if (idx != -1) {
                    provider.messages[idx] = realMsg;
                  } else if (!provider.messages.any((m) => m.id == realMsg.id)) {
                    provider.messages.add(realMsg);
                  }
                  provider.notifyListeners();
                } catch (_) {}
              } else {
                provider.messages.removeWhere((m) => m.id == optId);
                provider.notifyListeners();
                scaffold.showSnackBar(
                  SnackBar(
                    content: Text('Gửi ảnh thất bại: \${res['message'] ?? 'Lỗi không xác định'}'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              }
            } catch (err) {
              provider.messages.removeWhere((m) => m.id == optId);
              provider.notifyListeners();
              scaffold.hideCurrentSnackBar();
              scaffold.showSnackBar(
                SnackBar(content: Text('Lỗi kết nối khi gửi ảnh: \$err'), backgroundColor: const Color(0xFFEF4444)),
              );
            }
          }
        });
      }
    });`;

  const newLoopBlock = `uploadInput.onChange.listen((e) {
      final files = uploadInput.files;
      if (files != null && files.isNotEmpty) {
        final scaffold = ScaffoldMessenger.of(context);
        scaffold.hideCurrentSnackBar();
        scaffold.showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                const SizedBox(width: 12),
                Text(files.length > 1 ? 'Đang gửi \${files.length} hình ảnh...' : 'Đang gửi hình ảnh...'),
              ],
            ),
            duration: const Duration(minutes: 1),
          ),
        );

        for (int i = 0; i < files.length; i++) {
          final file = files[i];
          final fileIndex = i;
          final reader = html.FileReader();
          reader.readAsArrayBuffer(file);
          reader.onLoadEnd.listen((e) async {
            final bytes = _extractUint8ListFromReader(reader.result);
            if (bytes != null && bytes.isNotEmpty) {
              String mimeType = file.type;
              if (mimeType.isEmpty) {
                final ext = (file.name.split('.').pop() ?? '').toLowerCase();
                if (ext == 'png') mimeType = 'image/png';
                else if (ext == 'webp') mimeType = 'image/webp';
                else if (ext == 'gif') mimeType = 'image/gif';
                else mimeType = 'image/jpeg';
              }

              // Tạo ngay tin nhắn ảnh tạm thời với hiệu ứng đang gửi (Optimistic UI)
              final optId = 'optimistic-\${DateTime.now().millisecondsSinceEpoch}-\$fileIndex';
              final base64Url = 'data:\$mimeType;base64,\${base64Encode(bytes)}';
              final tempMsg = MessageModel(
                id: optId,
                clientTempId: optId,
                conversationId: conv.id,
                senderId: provider.currentUser?.id,
                type: 'image',
                content: base64Url,
                imageUrl: base64Url,
                createdAt: DateTime.now(),
                status: 'sending',
              );
              provider.addRealtimeMessage(tempMsg);
              _scrollToBottom();

              try {
                final res = await ApiService.uploadMedia(conv.id, bytes, file.name, mimeType);
                scaffold.hideCurrentSnackBar();
                if (res['success'] == true && res['data'] != null) {
                  try {
                    final realMsg = MessageModel.fromJson(res['data']).copyWith(status: 'sent', clientTempId: optId);
                    final idx = provider.messages.indexWhere((m) => m.id == optId);
                    if (idx != -1) {
                      provider.messages[idx] = realMsg;
                    } else if (!provider.messages.any((m) => m.id == realMsg.id)) {
                      provider.messages.add(realMsg);
                    }
                    provider.notifyListeners();
                  } catch (_) {}
                } else {
                  provider.messages.removeWhere((m) => m.id == optId);
                  provider.notifyListeners();
                }
              } catch (err) {
                final idx = provider.messages.indexWhere((m) => m.id == optId);
                if (idx != -1) {
                  provider.messages[idx] = provider.messages[idx].copyWith(status: 'error');
                  provider.notifyListeners();
                }
              }
            }
          });
        }
      }
    });`;

  if (content.includes(oldLoopBlock)) {
    content = content.replace(oldLoopBlock, newLoopBlock);
    console.log(`  [${path.basename(filePath)}] Updated batch file upload handling`);
  }

  // 2. Add Album Grid / Photo Collage rendering helpers right before _buildMessageBubbleContent
  if (!content.includes('bool _isImageMessage(MessageModel msg)')) {
    const albumHelpers = `  bool _isImageMessage(MessageModel msg) {
    if (msg.isRecalled) return false;
    final content = msg.content.toLowerCase();
    final hasImgUrl = content.endsWith('.jpg') || content.endsWith('.jpeg') ||
        content.endsWith('.png') || content.endsWith('.webp') ||
        content.endsWith('.gif') || content.endsWith('.jfif') ||
        content.endsWith('.heic') || content.endsWith('.heif') ||
        content.endsWith('.avif') || content.endsWith('.bmp') ||
        content.endsWith('.svg') || content.endsWith('.ico') ||
        content.contains('/chat-media/') || content.contains('/images/') ||
        content.contains('.jpg?') || content.contains('.png?') || content.contains('.jfif?');
    return msg.type == 'image' || msg.content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl;
  }

  void _showImagePreviewDialog(String targetMediaUrl, Widget imgWidget) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(child: Center(child: imgWidget)),
            Positioned(
              top: 10,
              right: 10,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (targetMediaUrl.isNotEmpty)
                    Container(
                      decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                      child: IconButton(
                        icon: const Icon(Icons.download_rounded, color: Colors.white, size: 24),
                        tooltip: 'Lưu ảnh về máy',
                        onPressed: () {
                          try {
                            html.window.callMethod('downloadMediaDirectly', [
                              targetMediaUrl,
                              'image_\${DateTime.now().millisecondsSinceEpoch}.jpg'
                            ]);
                          } catch (_) {}
                        },
                      ),
                    ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                    child: IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
                      onPressed: () => Navigator.pop(context),
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

  Widget _buildCollagePhotoCell(
    BuildContext context,
    MessageModel imgMsg,
    BorderRadius borderRadius, {
    int extraCount = 0,
  }) {
    final content = imgMsg.content;
    String? imageUrl = imgMsg.imageUrl;
    Uint8List? imageBytes;

    if (content.startsWith('data:image')) {
      try {
        final base64Str = content.split(',').last;
        imageBytes = base64Decode(base64Str);
      } catch (_) {}
    } else if (content.startsWith('http') || content.startsWith('/')) {
      imageUrl = content;
    }
    if (imageUrl != null && imageUrl.isNotEmpty) {
      imageUrl = ApiService.formatImageUrl(imageUrl);
    }

    Widget img;
    if (imageBytes != null) {
      img = Image.memory(imageBytes, fit: BoxFit.cover, width: double.infinity, height: double.infinity);
    } else if (imageUrl != null && imageUrl.isNotEmpty) {
      img = Image.network(imageUrl, fit: BoxFit.cover, width: double.infinity, height: double.infinity);
    } else {
      img = Container(color: Colors.grey.shade300, child: const Icon(Icons.image, color: Colors.grey));
    }

    final isSending = imgMsg.id.startsWith('optimistic-') || imgMsg.id.startsWith('uploading-') || imgMsg.status == 'sending';
    final targetUrl = imageUrl ?? (content.startsWith('data:image') ? content : '');

    return ClipRRect(
      borderRadius: borderRadius,
      child: GestureDetector(
        onTap: () {
          if (isSending) return;
          if (kIsWeb && targetUrl.isNotEmpty) {
            try {
              html.window.callMethod('openImageModal', [targetUrl]);
              return;
            } catch (_) {}
          }
          _showImagePreviewDialog(targetUrl, img);
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            img,
            if (isSending)
              Container(
                color: Colors.black.withOpacity(0.4),
                child: const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                  ),
                ),
              ),
            if (extraCount > 0)
              Container(
                color: Colors.black.withOpacity(0.58),
                child: Center(
                  child: Text(
                    '+\$extraCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      shadows: [Shadow(color: Colors.black54, blurRadius: 4, offset: Offset(0, 1))],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoGridCollage(BuildContext context, List<MessageModel> cluster, bool isMe) {
    final count = cluster.length;
    final screenWidth = MediaQuery.of(context).size.width;
    final totalWidth = min(screenWidth * 0.72, 320.0);
    const gap = 2.0;
    const radius = 16.0;

    if (count == 2) {
      final cellWidth = (totalWidth - gap) / 2;
      final totalHeight = cellWidth * 1.25;
      return Container(
        width: totalWidth,
        height: totalHeight,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius)),
        child: Row(
          children: [
            SizedBox(
              width: cellWidth,
              height: totalHeight,
              child: _buildCollagePhotoCell(
                context,
                cluster[0],
                const BorderRadius.only(topLeft: Radius.circular(radius), bottomLeft: Radius.circular(radius)),
              ),
            ),
            const SizedBox(width: gap),
            SizedBox(
              width: cellWidth,
              height: totalHeight,
              child: _buildCollagePhotoCell(
                context,
                cluster[1],
                const BorderRadius.only(topRight: Radius.circular(radius), bottomRight: Radius.circular(radius)),
              ),
            ),
          ],
        ),
      );
    }

    if (count == 3) {
      final leftWidth = (totalWidth - gap) * 0.6;
      final rightWidth = (totalWidth - gap) * 0.4;
      final totalHeight = totalWidth * 0.85;
      final subHeight = (totalHeight - gap) / 2;
      return Container(
        width: totalWidth,
        height: totalHeight,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius)),
        child: Row(
          children: [
            SizedBox(
              width: leftWidth,
              height: totalHeight,
              child: _buildCollagePhotoCell(
                context,
                cluster[0],
                const BorderRadius.only(topLeft: Radius.circular(radius), bottomLeft: Radius.circular(radius)),
              ),
            ),
            const SizedBox(width: gap),
            SizedBox(
              width: rightWidth,
              height: totalHeight,
              child: Column(
                children: [
                  SizedBox(
                    width: rightWidth,
                    height: subHeight,
                    child: _buildCollagePhotoCell(
                      context,
                      cluster[1],
                      const BorderRadius.only(topRight: Radius.circular(radius)),
                    ),
                  ),
                  const SizedBox(height: gap),
                  SizedBox(
                    width: rightWidth,
                    height: subHeight,
                    child: _buildCollagePhotoCell(
                      context,
                      cluster[2],
                      const BorderRadius.only(bottomRight: Radius.circular(radius)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // 4 or 5+ photos (2x2 grid)
    final cellWidth = (totalWidth - gap) / 2;
    final cellHeight = cellWidth;
    final totalHeight = cellHeight * 2 + gap;
    final extraCount = count > 4 ? count - 3 : 0;

    return Container(
      width: totalWidth,
      height: totalHeight,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(radius)),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(
                width: cellWidth,
                height: cellHeight,
                child: _buildCollagePhotoCell(
                  context,
                  cluster[0],
                  const BorderRadius.only(topLeft: Radius.circular(radius)),
                ),
              ),
              const SizedBox(width: gap),
              SizedBox(
                width: cellWidth,
                height: cellHeight,
                child: _buildCollagePhotoCell(
                  context,
                  cluster[1],
                  const BorderRadius.only(topRight: Radius.circular(radius)),
                ),
              ),
            ],
          ),
          const SizedBox(height: gap),
          Row(
            children: [
              SizedBox(
                width: cellWidth,
                height: cellHeight,
                child: _buildCollagePhotoCell(
                  context,
                  cluster[2],
                  const BorderRadius.only(bottomLeft: Radius.circular(radius)),
                ),
              ),
              const SizedBox(width: gap),
              SizedBox(
                width: cellWidth,
                height: cellHeight,
                child: _buildCollagePhotoCell(
                  context,
                  cluster[3],
                  const BorderRadius.only(bottomRight: Radius.circular(radius)),
                  extraCount: extraCount,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAlbumMessageItem(
    List<MessageModel> cluster,
    bool isMe,
    ConversationModel? conv,
    ChatProvider provider,
    bool showTime,
    bool isLastSent,
  ) {
    final headMsg = cluster.first;
    final lastMsg = cluster.last;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        if (showTime)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Text(
                _formatTime(headMsg.createdAt),
                style: const TextStyle(color: Color(0xFF8A8D91), fontSize: 12, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _SwipeToReplyWrapper(
            onReply: () => provider.setReplyingToMessage(headMsg),
            child: Row(
              mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (!isMe) ...[
                  GestureDetector(
                    onTap: () {
                      final senderId = headMsg.senderId;
                      if (senderId != null && senderId.isNotEmpty) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => OtherUserProfileScreen(userId: senderId)),
                        );
                      }
                    },
                    child: CircleAvatar(
                      radius: 14,
                      backgroundColor: Theme.of(context).primaryColor,
                      backgroundImage: getSafeAvatarProvider(conv?.avatar),
                      child: (conv?.avatar == null || conv!.avatar!.isEmpty)
                          ? Text(
                              conv != null && conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                              style: const TextStyle(fontSize: 10, color: Colors.white),
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        if (_expandedTimestampMessageIds.contains(headMsg.id)) {
                          _expandedTimestampMessageIds.remove(headMsg.id);
                        } else {
                          _expandedTimestampMessageIds.add(headMsg.id);
                        }
                      });
                    },
                    onLongPress: () => _showMessengerStyleContextMenu(context, headMsg, provider, isMe),
                    onSecondaryTapDown: (details) => _showMessengerStyleContextMenu(context, headMsg, provider, isMe),
                    onDoubleTapDown: (details) {
                      _showFlyingEmoji(context, details.globalPosition, '❤️');
                    },
                    onDoubleTap: () => provider.reactToMessage(headMsg.id, '❤️'),
                    child: Column(
                      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            _buildPhotoGridCollage(context, cluster, isMe),
                            if (headMsg.reactions.isNotEmpty && !headMsg.isRecalled)
                              Positioned(
                                right: -4,
                                bottom: -8,
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 200),
                                  transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                                  child: KeyedSubtree(
                                    key: ValueKey('album_reactions_\${headMsg.reactions.hashCode}'),
                                    child: _buildReactionBadges(
                                      headMsg.reactions,
                                      fontSize: 10,
                                      isOwnMessage: isMe,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        if (_expandedTimestampMessageIds.contains(headMsg.id)) ...[
                          Padding(
                            padding: const EdgeInsets.only(top: 3, bottom: 2, left: 4, right: 4),
                            child: Text(
                              _formatMessageTimestamp(headMsg.createdAt),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w400,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF65676B),
                              ),
                            ),
                          ),
                        ],
                        if (isMe) ...[
                          const SizedBox(height: 4),
                          _buildMessageStatusIndicator(lastMsg, conv, isLastSent),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

`;

    const marker = '  Widget _buildMessageBubbleContent(MessageModel msg, bool isMe) {';
    content = content.replace(marker, albumHelpers + marker);
    console.log(`  [${path.basename(filePath)}] Injected Photo Grid & Album helpers`);
  }

  // 3. Update ListView.builder item rendering to cluster consecutive image messages
  const oldItemBuilder = `final msg = provider.messages[index];
                          final isMe = msg.senderId == provider.currentUser?.id;
                          final isLastSentMessage = (index == lastSentMessageIndex);
                          final showTime = index == 0 || (index > 0 && msg.createdAt.difference(provider.messages[index - 1].createdAt).inMinutes > 30);`;

  const newItemBuilder = `final msg = provider.messages[index];

                          // --- Photo Grid Album Clustering (Messenger & Zalo style) ---
                          if (_isImageMessage(msg)) {
                            if (index > 0) {
                              final prev = provider.messages[index - 1];
                              if (_isImageMessage(prev) && prev.senderId == msg.senderId && msg.createdAt.difference(prev.createdAt).inSeconds.abs() < 60) {
                                return const SizedBox.shrink();
                              }
                            }
                            final cluster = <MessageModel>[msg];
                            for (int j = index + 1; j < provider.messages.length; j++) {
                              final next = provider.messages[j];
                              if (_isImageMessage(next) && next.senderId == msg.senderId && next.createdAt.difference(cluster.last.createdAt).inSeconds.abs() < 60) {
                                cluster.add(next);
                              } else {
                                break;
                              }
                            }
                            if (cluster.length >= 2) {
                              final isMe = msg.senderId == provider.currentUser?.id;
                              final isLastSent = (index + cluster.length - 1 == lastSentMessageIndex);
                              final showTime = index == 0 || (index > 0 && msg.createdAt.difference(provider.messages[index - 1].createdAt).inMinutes > 30);
                              return RepaintBoundary(
                                key: ValueKey('album_\${msg.id}_\${cluster.length}'),
                                child: _buildAlbumMessageItem(cluster, isMe, conv, provider, showTime, isLastSent),
                              );
                            }
                          }

                          final isMe = msg.senderId == provider.currentUser?.id;
                          final isLastSentMessage = (index == lastSentMessageIndex);
                          final showTime = index == 0 || (index > 0 && msg.createdAt.difference(provider.messages[index - 1].createdAt).inMinutes > 30);`;

  if (content.includes(oldItemBuilder)) {
    content = content.replace(oldItemBuilder, newItemBuilder);
    console.log(`  [${path.basename(filePath)}] Added Album clustering to ListView.builder`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Saved ${filePath}`);
});
