const fs = require('fs');
const path = require('path');

const files = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add getSafeAvatarProvider helper above class ChatScreen
  if (!content.includes('ImageProvider? getSafeAvatarProvider')) {
    const helperCode = `
/// Decode avatar at max 100x100 to prevent WebGL GPU memory overflow and frame drops
ImageProvider? getSafeAvatarProvider(String? url) {
  if (url == null || url.trim().isEmpty) return null;
  final formatted = ApiService.formatImageUrl(url.trim());
  return ResizeImage(NetworkImage(formatted), width: 100, height: 100);
}

class ChatScreen extends StatefulWidget {`;
    content = content.replace('class ChatScreen extends StatefulWidget {', helperCode);
    console.log(`[${filePath}] Added getSafeAvatarProvider`);
  }

  // 2. Add _isTypingNotifier & _isAttachmentMenuOpenNotifier to _ChatScreenState
  if (!content.includes('_isTypingNotifier = ValueNotifier<bool>(false);')) {
    const stateFields = `class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  int _currentTabIndex = 0; // 0: Tin nhắn, 1: Danh bạ, 2: Tin tức, 3: Trợ lý AI, 4: Cá nhân
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final _inputFocusNode = FocusNode();
  final ValueNotifier<bool> _isTypingNotifier = ValueNotifier<bool>(false);
  final ValueNotifier<bool> _isAttachmentMenuOpenNotifier = ValueNotifier<bool>(false);
  bool _isAttachmentMenuOpen = false;
  bool _isTyping = false;`;

    content = content.replace(
      /class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver \{\s*int _currentTabIndex = 0;[^\n]*\n\s*final _textController = TextEditingController\(\);\s*final _scrollController = ScrollController\(\);\s*final _inputFocusNode = FocusNode\(\);\s*bool _isAttachmentMenuOpen = false;\s*bool _isTyping = false;/g,
      stateFields
    );
    console.log(`[${filePath}] Added ValueNotifiers to _ChatScreenState`);
  }

  // 3. Dispose ValueNotifiers
  if (!content.includes('_isTypingNotifier.dispose();')) {
    content = content.replace(
      '_textController.dispose();',
      '_isTypingNotifier.dispose();\n    _isAttachmentMenuOpenNotifier.dispose();\n    _textController.dispose();'
    );
    console.log(`[${filePath}] Added dispose calls for ValueNotifiers`);
  }

  // 4. Update _onTextChanged to use _isTypingNotifier without triggering full-screen setState
  const oldOnTextChanged = `  void _onTextChanged() {
    final text = _textController.text;
    final typing = text.trim().isNotEmpty;
    if (typing != _isTyping) {
      setState(() => _isTyping = typing);
    }

    final provider = Provider.of<ChatProvider>(context, listen: false);

    if (typing) {
      provider.emitTyping();
      _debounceTimer?.cancel();
      _debounceTimer = Timer(const Duration(milliseconds: 1800), () {
        provider.emitStopTyping();
      });
    } else {
      _debounceTimer?.cancel();
      provider.emitStopTyping();
    }
  }`;

  const newOnTextChanged = `  void _onTextChanged() {
    final text = _textController.text;
    final typing = text.trim().isNotEmpty;
    if (typing != _isTypingNotifier.value) {
      _isTypingNotifier.value = typing;
    }
    _isTyping = typing;

    final provider = Provider.of<ChatProvider>(context, listen: false);

    if (typing) {
      provider.emitTyping();
      _debounceTimer?.cancel();
      _debounceTimer = Timer(const Duration(milliseconds: 1800), () {
        provider.emitStopTyping();
      });
    } else {
      _debounceTimer?.cancel();
      provider.emitStopTyping();
    }
  }`;

  if (content.includes(oldOnTextChanged)) {
    content = content.replace(oldOnTextChanged, newOnTextChanged);
    console.log(`[${filePath}] Updated _onTextChanged without full setState`);
  }

  // 5. Update _handleSend to reset _isTypingNotifier
  const oldHandleSend = `  void _handleSend(ChatProvider provider) {
    final text = _textController.text.trim();
    final sendText = text.isEmpty ? '👍' : text;
    _textController.clear();
    _debounceTimer?.cancel();
    provider.emitStopTyping();
    provider.sendMessage(sendText);
    _scrollToBottom();
  }`;

  const newHandleSend = `  void _handleSend(ChatProvider provider) {
    final text = _textController.text.trim();
    final sendText = text.isEmpty ? '👍' : text;
    _textController.clear();
    _isTypingNotifier.value = false;
    _isTyping = false;
    _debounceTimer?.cancel();
    provider.emitStopTyping();
    provider.sendMessage(sendText);
    _scrollToBottom();
  }`;

  if (content.includes(oldHandleSend)) {
    content = content.replace(oldHandleSend, newHandleSend);
    console.log(`[${filePath}] Updated _handleSend`);
  }

  // 6. Update _buildMessageStatusIndicator to support 'error' retry & 'sending' indicator
  const statusIndicatorOldPattern = `  Widget _buildMessageStatusIndicator(MessageModel msg, ConversationModel? conv, bool isLastSentMessage) {
    if (!isLastSentMessage) return const SizedBox.shrink();

    // 0. Trạng thái Đang gửi (Optimistic UI)
    if (msg.id.startsWith('optimistic-') || msg.id.startsWith('uploading-')) {
      return Container(
        margin: const EdgeInsets.only(top: 3, right: 2),
        width: 14,
        height: 14,
        child: const Center(
          child: SizedBox(
            width: 10,
            height: 10,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF94A3B8)),
            ),
          ),
        ),
      );
    }`;

  const statusIndicatorNewPattern = `  Widget _buildMessageStatusIndicator(MessageModel msg, ConversationModel? conv, bool isLastSentMessage) {
    // 0. Nếu tin nhắn gặp lỗi gửi, hiển thị chấm than đỏ cho phép bấm để gửi lại (áp dụng mọi vị trí)
    if (msg.status == 'error') {
      return GestureDetector(
        onTap: () {
          final provider = Provider.of<ChatProvider>(context, listen: false);
          provider.retrySendMessage(msg);
        },
        child: Container(
          margin: const EdgeInsets.only(top: 3, right: 2),
          padding: const EdgeInsets.all(2),
          decoration: const BoxDecoration(
            color: Color(0xFFE53935),
            shape: BoxShape.circle,
          ),
          child: const Tooltip(
            message: 'Không thể gửi. Bấm để gửi lại',
            child: Icon(Icons.priority_high_rounded, size: 10, color: Colors.white),
          ),
        ),
      );
    }

    if (!isLastSentMessage) return const SizedBox.shrink();

    // 1. Trạng thái Đang gửi (Optimistic UI - Messenger style vòng tròn mỏng xoay nhẹ)
    if (msg.status == 'sending' || msg.id.startsWith('temp_') || msg.id.startsWith('optimistic-') || msg.id.startsWith('uploading-')) {
      return Container(
        margin: const EdgeInsets.only(top: 3, right: 2),
        width: 14,
        height: 14,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF94A3B8).withOpacity(0.5), width: 1.2),
        ),
        child: const Center(
          child: SizedBox(
            width: 8,
            height: 8,
            child: CircularProgressIndicator(
              strokeWidth: 1.2,
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF94A3B8)),
            ),
          ),
        ),
      );
    }`;

  if (content.includes(statusIndicatorOldPattern)) {
    content = content.replace(statusIndicatorOldPattern, statusIndicatorNewPattern);
    console.log(`[${filePath}] Updated _buildMessageStatusIndicator`);
  }

  // 7. Update input area buttons with ValueListenableBuilder for zero-lag 60 FPS
  const oldSendButtonPattern = `IconButton(
                          icon: Icon(
                            _isTyping ? Icons.send_rounded : Icons.thumb_up_rounded,
                            color: primaryColor,
                            size: 26,
                          ),
                          onPressed: () => _handleSend(provider),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36),
                        )`;

  const newSendButtonPattern = `ValueListenableBuilder<bool>(
                          valueListenable: _isTypingNotifier,
                          builder: (context, isTyping, _) {
                            return IconButton(
                              icon: Icon(
                                isTyping ? Icons.send_rounded : Icons.thumb_up_rounded,
                                color: primaryColor,
                                size: 26,
                              ),
                              onPressed: () => _handleSend(provider),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 36),
                            );
                          },
                        )`;

  if (content.includes(oldSendButtonPattern)) {
    content = content.replace(oldSendButtonPattern, newSendButtonPattern);
    console.log(`[${filePath}] Updated send button with ValueListenableBuilder`);
  }

  // 8. Update attachment menu button with ValueListenableBuilder
  const oldAttachPattern = `IconButton(
                                  icon: AnimatedRotation(
                                    turns: _isAttachmentMenuOpen ? 0.125 : 0.0,
                                    duration: const Duration(milliseconds: 300),
                                    curve: Curves.easeOutBack,
                                    child: const Icon(Icons.add_circle_rounded, color: primaryColor, size: 28),
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isAttachmentMenuOpen = !_isAttachmentMenuOpen;
                                    });
                                  },
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 36),
                                  tooltip: _isAttachmentMenuOpen ? 'Đóng menu' : 'Mở menu tiện ích',
                                ),
                                AnimatedSize(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutBack,
                                  child: _isAttachmentMenuOpen
                                      ? Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                              icon: const Icon(Icons.camera_alt_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _captureCameraImage(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Chụp ảnh',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.image_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _pickAndUploadImage(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Gửi ảnh',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.videocam_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _pickAndUploadVideo(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Gửi video',
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.mic_rounded, color: primaryColor, size: 24),
                                              onPressed: () => _handleVoiceRecording(provider),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 36),
                                              tooltip: 'Ghi âm',
                                            ),
                                          ],
                                        )
                                      : const SizedBox(width: 0, height: 0),
                                )`;

  const newAttachPattern = `ValueListenableBuilder<bool>(
                                  valueListenable: _isAttachmentMenuOpenNotifier,
                                  builder: (context, isAttachmentOpen, _) {
                                    return Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: AnimatedRotation(
                                            turns: isAttachmentOpen ? 0.125 : 0.0,
                                            duration: const Duration(milliseconds: 300),
                                            curve: Curves.easeOutBack,
                                            child: const Icon(Icons.add_circle_rounded, color: primaryColor, size: 28),
                                          ),
                                          onPressed: () {
                                            _isAttachmentMenuOpenNotifier.value = !_isAttachmentMenuOpenNotifier.value;
                                          },
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(minWidth: 36),
                                          tooltip: isAttachmentOpen ? 'Đóng menu' : 'Mở menu tiện ích',
                                        ),
                                        AnimatedSize(
                                          duration: const Duration(milliseconds: 300),
                                          curve: Curves.easeOutBack,
                                          child: isAttachmentOpen
                                              ? Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    IconButton(
                                                      icon: const Icon(Icons.camera_alt_rounded, color: primaryColor, size: 24),
                                                      onPressed: () => _captureCameraImage(provider),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 36),
                                                      tooltip: 'Chụp ảnh',
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.image_rounded, color: primaryColor, size: 24),
                                                      onPressed: () => _pickAndUploadImage(provider),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 36),
                                                      tooltip: 'Gửi ảnh',
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.videocam_rounded, color: primaryColor, size: 24),
                                                      onPressed: () => _pickAndUploadVideo(provider),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 36),
                                                      tooltip: 'Gửi video',
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.mic_rounded, color: primaryColor, size: 24),
                                                      onPressed: () => _handleVoiceRecording(provider),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 36),
                                                      tooltip: 'Ghi âm',
                                                    ),
                                                  ],
                                                )
                                              : const SizedBox(width: 0, height: 0),
                                        ),
                                      ],
                                    );
                                  },
                                )`;

  if (content.includes(oldAttachPattern)) {
    content = content.replace(oldAttachPattern, newAttachPattern);
    console.log(`[${filePath}] Updated attachment menu with ValueListenableBuilder`);
  }

  // 9. Wrap message bubbles in RepaintBoundary for CanvasKit Skia layer isolation
  const oldSystemReturn = `if (msg.type == 'system') {\n                        return _buildSystemMessage(msg, conv, provider.currentUser);\n                      }`;
  const newSystemReturn = `if (msg.type == 'system') {\n                        return RepaintBoundary(\n                          key: ValueKey('system_\${msg.id}'),\n                          child: _buildSystemMessage(msg, conv, provider.currentUser),\n                        );\n                      }`;
  if (content.includes(oldSystemReturn)) {
    content = content.replace(oldSystemReturn, newSystemReturn);
    console.log(`[${filePath}] Wrapped system messages in RepaintBoundary`);
  }

  const oldCallReturn = `if (isCallMsg) {\n                        return Column(`;
  const newCallReturn = `if (isCallMsg) {\n                        return RepaintBoundary(\n                          key: ValueKey('call_\${msg.id}'),\n                          child: Column(`;
  if (content.includes(oldCallReturn)) {
    content = content.replace(oldCallReturn, newCallReturn);
    content = content.replace(
      `;\n                      }\n\n                      return Column(`,
      `);\n                      }\n\n                      return RepaintBoundary(\n                        key: ValueKey('msg_\${msg.id}'),\n                        child: Column(`
    );
    content = content.replace(
      `                                  ],\n                                ),\n                              ),\n                            ),\n                          ],\n                        );\n                      },\n                    );`,
      `                                  ],\n                                ),\n                              ),\n                            ),\n                          ],\n                        ),\n                        );\n                      },\n                    );`
    );
    console.log(`[${filePath}] Wrapped regular & call messages in RepaintBoundary`);
  }

  // 10. Wrap typing indicator in RepaintBoundary
  const oldTypingReturn = `if (index == provider.messages.length) {\n                            return Padding(`;
  const newTypingReturn = `if (index == provider.messages.length) {\n                            return RepaintBoundary(\n                              key: const ValueKey('typing_indicator_active'),\n                              child: Padding(`;
  if (content.includes(oldTypingReturn)) {
    content = content.replace(oldTypingReturn, newTypingReturn);
    content = content.replace(
      `                                ],\n                              ),\n                            );\n                          }\n                          final msg = provider.messages[index];`,
      `                                ],\n                              ),\n                            ),\n                            );\n                          }\n                          final msg = provider.messages[index];`
    );
    console.log(`[${filePath}] Wrapped typing indicator in RepaintBoundary`);
  }

  // 11. Replace NetworkImage in avatars with getSafeAvatarProvider
  // Header avatar
  content = content.replace(
    /backgroundImage: \(conv\.avatar != null && conv\.avatar!\.isNotEmpty\)\s*\?\s*NetworkImage\(conv\.avatar!\)\s*:\s*null,/g,
    'backgroundImage: getSafeAvatarProvider(conv.avatar),'
  );

  // Conversation list item avatar
  content = content.replace(
    /image: NetworkImage\(ApiService\.formatImageUrl\(conv\.avatar!\)\),/g,
    'image: getSafeAvatarProvider(conv.avatar)!,'
  );

  // Message item avatar
  content = content.replace(
    /backgroundImage: \(conv\.avatar != null && conv\.avatar!\.isNotEmpty\)\s*\?\s*NetworkImage\(conv\.avatar!\)\s*:\s*null/g,
    'backgroundImage: getSafeAvatarProvider(conv.avatar)'
  );

  // Group member avatar
  content = content.replace(
    /\? NetworkImage\(member\.avatar!\)/g,
    '? getSafeAvatarProvider(member.avatar)'
  );

  // Profile avatar
  content = content.replace(
    /backgroundImage: fullAvatarUrl != null \? NetworkImage\(fullAvatarUrl\) : null,/g,
    'backgroundImage: getSafeAvatarProvider(fullAvatarUrl),'
  );

  // Dropping avatar
  content = content.replace(
    /backgroundImage: NetworkImage\(fullUrl\),/g,
    'backgroundImage: getSafeAvatarProvider(fullUrl),'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Finished applying optimizations to ${filePath}`);
});
