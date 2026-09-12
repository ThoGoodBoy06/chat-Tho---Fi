const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');
let content = fs.readFileSync(filePath, 'utf8');

const target = '// 4. Nút Đổi Biệt Danh (Đặt trong menu i)';

const replacement = `// 4a. Nút Đổi Chủ Đề (Chat Theme)
                Builder(
                  builder: (ctx) {
                    final currentTheme = ChatThemes.getTheme(conv.theme);
                    return InkWell(
                      onTap: () {
                        Navigator.pop(context);
                        _showThemePickerBottomSheet(provider, conv);
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: currentTheme.gradient,
                                    border: Border.all(color: Colors.white, width: 2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: currentTheme.primaryColor.withOpacity(0.4),
                                        blurRadius: 4,
                                        offset: const Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 10),
                                const Text(
                                  'Chủ đề đoạn chat',
                                  style: TextStyle(
                                    color: Color(0xFF0F172A),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                Text(
                                  currentTheme.name.split(' (')[0],
                                  style: TextStyle(
                                    color: currentTheme.primaryColor,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 10),

                // 4b. Nút Đổi Biệt Danh (Đặt trong menu i)`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Đã chèn thành công nút Đổi Chủ Đề vào _showChatInfo');
} else {
  console.log('ℹ️ Đã tồn tại nút Đổi Chủ Đề hoặc không tìm thấy target');
}
