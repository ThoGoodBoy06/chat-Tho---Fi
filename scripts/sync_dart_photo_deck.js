const fs = require('fs');
const path = require('path');

const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  console.log(`Updating Dart file: ${df}`);
  let content = fs.readFileSync(df, 'utf8');

  // Replace _buildPhotoGridCollage with _buildPhotoDeckAlbum
  const oldMethodMarker = 'Widget _buildPhotoGridCollage(BuildContext context, List<MessageModel> cluster, bool isMe) {';
  const oldHelperMarker = 'Widget _buildCollagePhotoCell(';

  const newDeckImplementation = `  Widget _buildPhotoDeckCardImage(MessageModel msg) {
    final content = msg.content;
    String? imageUrl = msg.imageUrl;
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

    if (imageBytes != null) {
      return Image.memory(imageBytes, fit: BoxFit.cover, width: double.infinity, height: double.infinity);
    } else if (imageUrl != null && imageUrl.isNotEmpty) {
      return Image.network(imageUrl, fit: BoxFit.cover, width: double.infinity, height: double.infinity);
    } else {
      return Container(color: const Color(0xFF334155), child: const Icon(Icons.image, color: Colors.white54, size: 36));
    }
  }

  Widget _buildPhotoDeckAlbum(BuildContext context, List<MessageModel> cluster, bool isMe) {
    final count = cluster.length;
    final screenWidth = MediaQuery.of(context).size.width;
    final cardSize = min(screenWidth * 0.64, 240.0);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final photoUrls = cluster.map((m) {
      if (m.content.startsWith('data:image')) return m.content;
      return m.imageUrl != null && m.imageUrl!.isNotEmpty ? ApiService.formatImageUrl(m.imageUrl!) : ApiService.formatImageUrl(m.content);
    }).toList();

    return Column(
      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        // 1. Tiêu đề: Icon 4 ô vuông (⊞) + Text "N ảnh"
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4, right: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.grid_view_rounded,
                size: 20,
                color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
              ),
              const SizedBox(width: 6),
              Text(
                '\$count ảnh',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),

        // 2. Chồng Thẻ Ảnh 3D kèm nút chuyển tiếp
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (isMe) ...[
              _buildDeckShareButton(context, cluster.first),
              const SizedBox(width: 12),
            ],

            GestureDetector(
              onTap: () {
                if (kIsWeb) {
                  try {
                    html.window.callMethod('openAlbumGalleryModal', [photoUrls, 0]);
                    return;
                  } catch (_) {}
                }
              },
              child: SizedBox(
                width: cardSize + 16,
                height: cardSize + 14,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    if (count >= 3)
                      Transform.translate(
                        offset: const Offset(-5, -6),
                        child: Container(
                          width: cardSize - 6,
                          height: cardSize - 6,
                          decoration: BoxDecoration(
                            color: const Color(0xFF2D3748),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.12),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (count >= 2)
                      Transform.translate(
                        offset: const Offset(6, -3),
                        child: Container(
                          width: cardSize - 3,
                          height: cardSize - 3,
                          decoration: BoxDecoration(
                            color: const Color(0xFF4A5568),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.14),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Transform.translate(
                      offset: const Offset(0, 4),
                      child: Container(
                        width: cardSize,
                        height: cardSize,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.20),
                              blurRadius: 14,
                              offset: const Offset(0, 5),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(24),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              _buildPhotoDeckCardImage(cluster[0]),
                              if (cluster[0].id.startsWith('optimistic-') || cluster[0].status == 'sending')
                                Container(
                                  color: Colors.black.withOpacity(0.4),
                                  child: const Center(
                                    child: SizedBox(
                                      width: 28,
                                      height: 28,
                                      child: CircularProgressIndicator(strokeWidth: 2.5, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            if (!isMe) ...[
              const SizedBox(width: 12),
              _buildDeckShareButton(context, cluster.first),
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildDeckShareButton(BuildContext context, MessageModel msg) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        final provider = Provider.of<ChatProvider>(context, listen: false);
        _showMessengerStyleContextMenu(context, msg, provider, false);
      },
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.10),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(
          Icons.shortcut_rounded,
          size: 20,
          color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
        ),
      ),
    );
  }
`;

  if (content.includes('_buildPhotoGridCollage(context, cluster, isMe)')) {
    content = content.replace('_buildPhotoGridCollage(context, cluster, isMe)', '_buildPhotoDeckAlbum(context, cluster, isMe)');
    console.log(`  [OK] Đổi lời gọi sang _buildPhotoDeckAlbum trong ${path.basename(df)}`);
  }

  // Insert helper methods
  const collageIndex = content.indexOf('Widget _buildPhotoGridCollage(');
  if (collageIndex !== -1) {
    content = content.slice(0, collageIndex) + newDeckImplementation + '\n\n' + content.slice(collageIndex);
    fs.writeFileSync(df, content, 'utf8');
    console.log(`✅ Đã cập nhật thành công ${df}`);
  }
});

console.log('🎉 Hoàn tất đồng bộ mã nguồn Dart!');
