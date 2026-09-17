const fs = require('fs');

const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

dartFiles.forEach(df => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');

  const oldMethodSig = 'Widget _buildVideoBubble(BuildContext context, String videoUrl, bool isMe) {';
  const newMethod = `Widget _buildVideoBubble(BuildContext context, String videoUrl, bool isMe, [String? thumbnailUrl]) {
    if (thumbnailUrl != null && thumbnailUrl.isNotEmpty) {
      final formattedThumb = ApiService.formatImageUrl(thumbnailUrl);
      return GestureDetector(
        onTap: () => _openVideoPlayerModal(context, videoUrl),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: 240,
            height: 160,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(12),
              image: DecorationImage(
                image: NetworkImage(formattedThumb),
                fit: BoxFit.cover,
              ),
            ),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: Colors.black.withOpacity(0.55),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
            ),
          ),
        ),
      );
    }`;

  if (code.includes(oldMethodSig)) {
    code = code.replace(oldMethodSig, newMethod);
    fs.writeFileSync(df, code, 'utf8');
    console.log(`✅ [${df}] Đã cập nhật _buildVideoBubble trong Dart`);
  }
});

console.log('✨ Xong!');
