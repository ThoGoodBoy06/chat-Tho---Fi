const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu áp dụng toàn diện bản sửa lỗi tính năng Thả cảm xúc (Tin nhắn & Hình ảnh)...');

// ══════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT WEBRTC_AUDIO_HELPER.JS (Hỗ trợ thả cảm xúc trong Gallery + Chặn chuột phải trình duyệt)
// ══════════════════════════════════════════════════════════════════════════════

const helperFiles = [
  path.join(__dirname, '..', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'public', 'webrtc_audio_helper.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'webrtc_audio_helper.js')
];

const reactionHelperCode = `
  // ══════════════════════════════════════════════════════════════════════════════
  // HỆ THỐNG THẢ CẢM XÚC (REACTION SYSTEM)
  // ══════════════════════════════════════════════════════════════════════════════
  window.reactToMessage = function (messageId, emoji) {
    if (!messageId || !emoji) return;
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (prov && typeof prov.a1l === 'function') {
        prov.a1l(messageId, emoji);
        console.log('✅ Reacted via prov.a1l:', messageId, emoji);
        return;
      }
    } catch (e) {
      console.warn('prov react error:', e);
    }

    // Fallback qua API trực tiếp
    try {
      var token = localStorage.getItem('authToken') || (localStorage.getItem('flutter.authToken') ? JSON.parse(localStorage.getItem('flutter.authToken')) : null);
      if (token) {
        fetch('/api/chat/messages/' + encodeURIComponent(messageId) + '/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ reaction: emoji })
        }).then(function (res) { return res.json(); }).then(function (data) {
          console.log('✅ Reacted via API:', data);
        }).catch(function (err) {
          console.error('Lỗi gọi API react:', err);
        });
      }
    } catch (err2) {
      console.error('Fallback react error:', err2);
    }
  };

  // Ngăn chặn menu chuột phải mặc định của trình duyệt để nhường cho menu cảm xúc của app
  if (!window._contextMenuGuarded) {
    window._contextMenuGuarded = true;
    window.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
    }, { passive: false });
  }
`;

helperFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  // Đảm bảo có reactionHelperCode
  if (!code.includes('window.reactToMessage = function')) {
    code = reactionHelperCode + '\n' + code;
  }

  // Thêm thanh thả cảm xúc vào openAlbumGalleryModal
  if (!code.includes('galleryReactionRow')) {
    const targetAnchor = "actionsDiv.appendChild(closeBtn);";
    const reactionBarHtml = `actionsDiv.appendChild(closeBtn);

      // Thanh thả cảm xúc nhanh trên thanh công cụ Gallery
      var reactBtn = document.createElement('button');
      reactBtn.id = 'galleryReactBtn';
      reactBtn.innerHTML = '❤️ Thả cảm xúc';
      reactBtn.style.cssText = 'background:rgba(255,255,255,0.22);color:#fff;border:none;border-radius:22px;padding:8px 14px;font-size:13px;font-family:sans-serif;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;';
      
      var emojiBar = document.createElement('div');
      emojiBar.id = 'galleryReactionRow';
      emojiBar.style.cssText = 'display:none;position:absolute;top:60px;right:20px;background:rgba(255,255,255,0.98);padding:6px 10px;border-radius:30px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:200;align-items:center;gap:8px;backdrop-filter:blur(10px);animation:fadeIn 0.2s ease;';
      
      var emojiList = ['❤️', '😆', '😮', '😢', '😡', '👍'];
      emojiList.forEach(function(em) {
        var emBtn = document.createElement('span');
        emBtn.textContent = em;
        emBtn.style.cssText = 'font-size:24px;cursor:pointer;transition:transform 0.15s cubic-bezier(0.175,0.885,0.32,1.275);user-select:none;padding:2px;';
        emBtn.onmouseenter = function() { emBtn.style.transform = 'scale(1.35)'; };
        emBtn.onmouseleave = function() { emBtn.style.transform = 'scale(1)'; };
        emBtn.onclick = function(e) {
          e.stopPropagation();
          var curUrl = list[currentIndex];
          var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
          var targetMsgId = null;
          if (prov && prov.d) {
            for (var mIdx = prov.d.length - 1; mIdx >= 0; mIdx--) {
              var m = prov.d[mIdx];
              var u = m.imageUrl || m.f || m.content || m.e;
              if (u && (u === curUrl || (typeof u === 'string' && u.includes(curUrl)) || (typeof curUrl === 'string' && curUrl.includes(u)))) {
                targetMsgId = m.id || m.a;
                break;
              }
            }
          }
          if (!targetMsgId && prov && prov.d && prov.d.length > 0) {
            targetMsgId = prov.d[prov.d.length - 1].id || prov.d[prov.d.length - 1].a;
          }
          if (targetMsgId) {
            window.reactToMessage(targetMsgId, em);
            // Hiệu ứng bay cảm xúc trong modal
            var flying = document.createElement('div');
            flying.textContent = em;
            flying.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.5);font-size:80px;z-index:999999;pointer-events:none;transition:all 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28);opacity:1;';
            document.body.appendChild(flying);
            setTimeout(function() {
              flying.style.transform = 'translate(-50%,-120%) scale(1.4)';
              flying.style.opacity = '0';
            }, 30);
            setTimeout(function() { flying.remove(); }, 650);
          }
          emojiBar.style.display = 'none';
        };
        emojiBar.appendChild(emBtn);
      });
      
      reactBtn.onclick = function(e) {
        e.stopPropagation();
        emojiBar.style.display = emojiBar.style.display === 'none' ? 'flex' : 'none';
      };
      
      actionsDiv.appendChild(reactBtn);
      modal.appendChild(emojiBar);`;

    if (code.includes(targetAnchor)) {
      code = code.replace(targetAnchor, reactionBarHtml);
      console.log(`  [webrtc_audio_helper] Đã thêm thanh thả cảm xúc vào Gallery: ${fp}`);
    }
  }

  fs.writeFileSync(fp, code, 'utf8');
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT DART (flutter_frontend và backend/flutter_frontend)
// ══════════════════════════════════════════════════════════════════════════════

const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  // A. Thêm _buildQuickReactionButton nếu chưa có
  if (!code.includes('_buildQuickReactionButton(')) {
    const targetBeforeContext = 'void _showMessengerStyleContextMenu(';
    const quickBtnCode = `  Widget _buildQuickReactionButton(BuildContext context, MessageModel msg, ChatProvider provider, bool isMe) {
    if (msg.isRecalled) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Tooltip(
        message: 'Bày tỏ cảm xúc',
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _showMessengerStyleContextMenu(context, msg, provider, isMe),
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.05),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.sentiment_satisfied_alt_outlined,
              size: 17,
              color: Color(0xFF65676B),
            ),
          ),
        ),
      ),
    );
  }

  `;
    code = code.replace(targetBeforeContext, quickBtnCode + targetBeforeContext);
    console.log(`  [Dart] Đã thêm _buildQuickReactionButton vào ${fp}`);
  }

  // B. Thêm nút _buildQuickReactionButton vào hai bên bong bóng tin nhắn (dòng 2638)
  const oldRowStart = `                                  Row(
                                    mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      if (!isMe) ...[
                                        GestureDetector(
                                          onTap: () {
                                            final senderId = msg.senderId;
                                            if (senderId != null && senderId.isNotEmpty) {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(
                                                  builder: (_) => OtherUserProfileScreen(userId: senderId),
                                                ),
                                              );
                                            }
                                          },
                                          child: CircleAvatar(
                                            radius: 14,
                                            backgroundColor: primaryColor,
                                            backgroundImage: getSafeAvatarProvider(conv.avatar),
                                            child: (conv.avatar == null || conv.avatar!.isEmpty)
                                                ? Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10, color: Colors.white))
                                                : null,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                      ],
                                      Flexible(`;

  const newRowStart = `                                  Row(
                                    mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      if (!isMe) ...[
                                        GestureDetector(
                                          onTap: () {
                                            final senderId = msg.senderId;
                                            if (senderId != null && senderId.isNotEmpty) {
                                              Navigator.push(
                                                context,
                                                MaterialPageRoute(
                                                  builder: (_) => OtherUserProfileScreen(userId: senderId),
                                                ),
                                              );
                                            }
                                          },
                                          child: CircleAvatar(
                                            radius: 14,
                                            backgroundColor: primaryColor,
                                            backgroundImage: getSafeAvatarProvider(conv.avatar),
                                            child: (conv.avatar == null || conv.avatar!.isEmpty)
                                                ? Text(conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 10, color: Colors.white))
                                                : null,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                      ],
                                      if (isMe) ...[
                                        _buildQuickReactionButton(context, msg, provider, isMe),
                                      ],
                                      Flexible(`;

  if (code.includes(oldRowStart)) {
    code = code.replace(oldRowStart, newRowStart);
  }

  // Thêm _buildQuickReactionButton cho !isMe sau Flexible
  const oldAfterFlex = `                                      Flexible(
                                        child: GestureDetector(
                                          onTap: () {
                                            setState(() {
                                              if (_expandedTimestampMessageIds.contains(msg.id)) {
                                                _expandedTimestampMessageIds.remove(msg.id);
                                              } else {
                                                _expandedTimestampMessageIds.add(msg.id);
                                              }
                                            });
                                          },
                                          onLongPress: () => _showMessengerStyleContextMenu(context, msg, provider, isMe),
                                          onSecondaryTapDown: (details) => _showMessengerStyleContextMenu(context, msg, provider, isMe),
                                          onDoubleTapDown: (details) {
                                            _showFlyingEmoji(context, details.globalPosition, '❤️');
                                          },
                                          onDoubleTap: () => provider.reactToMessage(msg.id, '❤️'),
                                          child: Column(
                                            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                            children: [
                                              Stack(
                                                clipBehavior: Clip.none,
                                                children: [
                                                  Builder(
                                                    builder: (context) {
                                                      final isEmojiMsg = !msg.isRecalled && msg.type == null || msg.type == 'text' ? _isEmojiOnly(msg.content) : false;
                                                      final isSpecialType = msg.type == 'image' || msg.type == 'audio' || msg.type == 'file' || msg.type == 'missed_call' || msg.type == 'call'
                                                          || msg.content.startsWith('data:image') || msg.content.startsWith('data:audio')
                                                          || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty);
                                                      final lowerMsgContent = msg.content.toLowerCase();
                                                       final hasImgUrl = lowerMsgContent.endsWith('.jpg') || lowerMsgContent.endsWith('.jpeg') ||
                                                           lowerMsgContent.endsWith('.png') || lowerMsgContent.endsWith('.webp') ||
                                                           lowerMsgContent.endsWith('.gif') || lowerMsgContent.contains('/chat-media/') ||
                                                           lowerMsgContent.contains('.jpg?') || lowerMsgContent.contains('.png?');
                                                       final isPureImage = (msg.type == 'image' || msg.content.startsWith('data:image') || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || hasImgUrl || (isVideo && msg.imageUrl != null && msg.imageUrl!.isNotEmpty));

                                                      // Emoji-only: hiển thị to, không nền (giống Messenger)
                                                      if (isEmojiMsg && !msg.isRecalled) {
                                                        return Container(
                                                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                                                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                          child: Text(
                                                            msg.content,
                                                            style: const TextStyle(fontSize: 40),
                                                          ),
                                                        );
                                                      }

                                                      return Container(
                                                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * (isPureImage ? 0.76 : 0.72)),
                                                        decoration: isPureImage
                                                            ? null
                                                            : BoxDecoration(
                                                                gradient: isMe
                                                                    ? LinearGradient(
                                                                        colors: currentThemeGradients,
                                                                        begin: Alignment.topLeft,
                                                                        end: Alignment.bottomRight,
                                                                      )
                                                                    : null,
                                                                color: isMe
                                                                    ? null
                                                                    : (isDark ? const Color(0xFF3A3B3C) : const Color(0xFFE4E6EB)),
                                                                borderRadius: BorderRadius.only(
                                                                  topLeft: const Radius.circular(18),
                                                                  topRight: const Radius.circular(18),
                                                                  bottomLeft: Radius.circular(isMe ? 18 : 4),
                                                                  bottomRight: Radius.circular(isMe ? 4 : 18),
                                                                ),
                                                              ),
                                                        padding: isPureImage ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                                        child: _buildMessageBubbleContent(msg, isMe),
                                                      );
                                                    },
                                                  ),
                                                  if (msg.reactions.isNotEmpty && !msg.isRecalled)
                                                    Positioned(
                                                      right: -4,
                                                      bottom: -8,
                                                      child: AnimatedSwitcher(
                                                        duration: const Duration(milliseconds: 200),
                                                        transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                                                        child: KeyedSubtree(
                                                          key: ValueKey('chat_reactions_\${msg.reactions.hashCode}'),
                                                          child: _buildReactionBadges(
                                                            msg.reactions,
                                                            fontSize: 10,
                                                            isOwnMessage: isMe,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                ],
                                              ),
                                              if (_expandedTimestampMessageIds.contains(msg.id)) ...[
                                                Padding(
                                                  padding: const EdgeInsets.only(top: 3, bottom: 2, left: 4, right: 4),
                                                  child: Text(
                                                    _formatMessageTimestamp(msg.createdAt),
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
                                                _buildMessageStatusIndicator(msg, conv, isLastSentMessage),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ),`;

  const newAfterFlex = oldAfterFlex + `
                                      if (!isMe) ...[
                                        _buildQuickReactionButton(context, msg, provider, isMe),
                                      ],`;

  if (code.includes(oldAfterFlex) && !code.includes(newAfterFlex)) {
    code = code.replace(oldAfterFlex, newAfterFlex);
    console.log(`  [Dart] Đã thêm quick reaction button cho đối phương vào ${fp}`);
  }

  // C. Cập nhật GestureDetector của ảnh đơn trong _buildMessageBubbleContent
  const oldImageGesture = `      return GestureDetector(
        onTap: () {
          if (isSending) return;
          final targetMediaUrl = imageUrl ?? (content.startsWith('data:image') ? content : '');
          if (kIsWeb && targetMediaUrl.isNotEmpty) {
            try {
              html.window.callMethod('openImageModal', [targetMediaUrl]);
              return;
            } catch (_) {}
          }
          showDialog(`;

  const newImageGesture = `      return GestureDetector(
        onTap: () {
          if (isSending) return;
          final targetMediaUrl = imageUrl ?? (content.startsWith('data:image') ? content : '');
          if (kIsWeb && targetMediaUrl.isNotEmpty) {
            try {
              html.window.callMethod('openImageModal', [targetMediaUrl, msg.id]);
              return;
            } catch (_) {}
          }
          showDialog(`;

  if (code.includes(oldImageGesture)) {
    code = code.replace(oldImageGesture, newImageGesture);
  }

  // Thêm onDoubleTap, onLongPress, onSecondaryTapDown cho ảnh đơn
  const oldImageClosing = `        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),`;

  const newImageClosing = `        onDoubleTapDown: (details) {
          _showFlyingEmoji(context, details.globalPosition, '❤️');
        },
        onDoubleTap: () => provider.reactToMessage(msg.id, '❤️'),
        onLongPress: () => _showMessengerStyleContextMenu(context, msg, provider, isMe),
        onSecondaryTapDown: (details) => _showMessengerStyleContextMenu(context, msg, provider, isMe),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),`;

  if (code.includes(oldImageClosing) && !code.includes('onDoubleTap: () => provider.reactToMessage(msg.id, \'❤️\'),\n        onLongPress: () => _showMessengerStyleContextMenu')) {
    code = code.replace(oldImageClosing, newImageClosing);
    console.log(`  [Dart] Đã gắn đầy đủ cử chỉ thả cảm xúc (DoubleTap, LongPress, RightClick) vào ảnh đơn trong ${fp}`);
  }

  // D. Thêm _buildAlbumMessageItem nếu chưa có
  if (!code.includes('Widget _buildAlbumMessageItem(')) {
    const albumItemMethod = `  Widget _buildAlbumMessageItem(
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
                if (isMe) ...[
                  _buildQuickReactionButton(context, headMsg, provider, isMe),
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
                            _buildPhotoDeckAlbum(context, cluster, isMe),
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
                if (!isMe) ...[
                  _buildQuickReactionButton(context, headMsg, provider, isMe),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

`;
    const targetAnchor = '  Widget _buildPhotoDeckAlbum(';
    code = code.replace(targetAnchor, albumItemMethod + targetAnchor);
    console.log(`  [Dart] Đã định nghĩa _buildAlbumMessageItem vào ${fp}`);
  }

  fs.writeFileSync(fp, code, 'utf8');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. CẬP NHẬT MAIN.DART.JS (Web Bundle)
// ══════════════════════════════════════════════════════════════════════════════

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

// Helper classes cho image gesture trong main.dart.js
const imgGestureClasses = `
A.aImgDoubleTap = function aImgDoubleTap(msgId) {
  this.msgId = msgId;
};
A.aImgDoubleTap.prototype = {
  $0: function() {
    var mid = this.msgId;
    if (window.reactToMessage) {
      window.reactToMessage(mid, "\\u2764\\ufe0f");
    } else {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (prov && typeof prov.a1l === 'function') prov.a1l(mid, "\\u2764\\ufe0f");
    }
  },
  $S: 0
};

A.aImgDoubleTapDown = function aImgDoubleTapDown(msgId) {
  this.msgId = msgId;
};
A.aImgDoubleTapDown.prototype = {
  $1: function(details) {
    try {
      if (details && details.a) {
        var px = details.a.a, py = details.a.b;
        var fly = document.createElement('div');
        fly.textContent = "\\u2764\\ufe0f";
        fly.style.cssText = 'position:fixed;left:' + px + 'px;top:' + py + 'px;transform:translate(-50%,-50%) scale(0.5);font-size:60px;z-index:999999;pointer-events:none;transition:all 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);opacity:1;';
        document.body.appendChild(fly);
        setTimeout(function() {
          fly.style.transform = 'translate(-50%,-100%) scale(1.3)';
          fly.style.opacity = '0';
        }, 20);
        setTimeout(function() { fly.remove(); }, 550);
      }
    } catch(e) {}
  },
  $S: 31
};

A.aImgLongPress = function aImgLongPress(state, msg, isMe) {
  this.state = state;
  this.msg = msg;
  this.isMe = isMe;
};
A.aImgLongPress.prototype = {
  $0: function() {
    try {
      var prov = window._activeChatProvider || (window.$ && window.$._activeChatProvider);
      if (this.state && typeof this.state.VK === 'function') {
        var ctx = this.state.d || this.state.cx || (window.$ && window.$._activeChatContext);
        this.state.VK(ctx, this.msg, prov, this.isMe);
      }
    } catch(e) { console.warn("aImgLongPress error:", e); }
  },
  $1: function(details) {
    this.$0();
  },
  $S: 31
};
`;

jsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  console.log(`Processing JS bundle: ${fp}`);
  let js = fs.readFileSync(fp, 'utf8');

  // Thêm các class A.aImgDoubleTap, A.aImgDoubleTapDown, A.aImgLongPress nếu chưa có
  if (!js.includes('A.aImgDoubleTap = function')) {
    js = imgGestureClasses + '\n' + js;
    console.log(`  [JS] Đã thêm helper classes phản hồi cử chỉ ảnh vào ${fp}`);
  }

  // Thay thế GestureDetector của ảnh đơn để gắn param 5, param 6, param 12, param 24
  // Target: return A.dr(d,A.aP5(A.ag(12),A.a5(d,o,B.h,d,B.FH,d,d,d,d,d,d,d,d)),B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.auR(c,this),d,d,d,d,d,d,!1,B.ao)
  const targetImageDr = 'return A.dr(d,A.aP5(A.ag(12),A.a5(d,o,B.h,d,B.FH,d,d,d,d,d,d,d,d)),B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,new A.auR(c,this),d,d,d,d,d,d,!1,B.ao)';
  const replacementImageDr = 'return A.dr(d,A.aP5(A.ag(12),A.a5(d,o,B.h,d,B.FH,d,d,d,d,d,d,d,d)),B.M,!1,d,new A.aImgDoubleTap(a.a),new A.aImgDoubleTapDown(a.a),d,d,d,d,d,new A.aImgLongPress(this,a,b),d,d,d,d,d,d,d,d,d,d,new A.aImgLongPress(this,a,b),d,new A.auR(c,this),d,d,d,d,d,d,!1,B.ao)';

  if (js.includes(targetImageDr)) {
    js = js.replace(targetImageDr, replacementImageDr);
    console.log(`  [JS] Đã gắn cử chỉ thả cảm xúc (DoubleTap, LongPress, SecondaryTap) vào ảnh đơn: ${fp}`);
  }

  // Cập nhật A.aAlbumDeckTap để lưu messageId vào photo
  const oldDeckTap = 'var targetIdx = targetUrl ? urls.indexOf(targetUrl) : 0;';
  const newDeckTap = 'var targetIdx = targetUrl ? urls.indexOf(targetUrl) : 0;\n      if(window.reactToMessage&&this.cluster&&this.cluster[this.index]){window._lastClickedAlbumMsg=this.cluster[this.index];}';
  if (js.includes(oldDeckTap) && !js.includes('window._lastClickedAlbumMsg')) {
    js = js.replace(oldDeckTap, newDeckTap);
    console.log(`  [JS] Đã cập nhật _lastClickedAlbumMsg cho Album Deck: ${fp}`);
  }

  fs.writeFileSync(fp, js, 'utf8');

  try {
    new vm.Script(js);
    console.log(`  [PASS] Cú pháp JS hợp lệ: ${fp}`);
  } catch (synErr) {
    console.error(`  [FAIL] Lỗi cú pháp JS: ${fp}`, synErr);
  }
});

console.log('🏁 Hoàn tất áp dụng các bản sửa lỗi Thả cảm xúc!');
