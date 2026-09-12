const fs = require('fs');
const path = require('path');

const dartFilePath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');

if (fs.existsSync(dartFilePath)) {
  let content = fs.readFileSync(dartFilePath, 'utf8');

  // 1. Update ListView.builder inside Builder
  const target1 = `builder: (context) {
                      final lastSentMessageIndex = provider.messages.lastIndexWhere((m) => m.senderId == provider.currentUser?.id);

                      return ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        itemCount: provider.messages.length,
                        itemBuilder: (context, index) {
                          final msg = provider.messages[index];`;

  const replacement1 = `builder: (context) {
                      final lastSentMessageIndex = provider.messages.lastIndexWhere((m) => m.senderId == provider.currentUser?.id);
                      final typingUser = provider.getTypingUserForSelectedConversation();
                      final hasTyping = typingUser != null && typingUser.isNotEmpty;

                      if (hasTyping) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (_scrollController.hasClients) {
                            final maxScroll = _scrollController.position.maxScrollExtent;
                            final currentScroll = _scrollController.offset;
                            if (maxScroll - currentScroll < 160) {
                              _scrollController.animateTo(
                                maxScroll,
                                duration: const Duration(milliseconds: 150),
                                curve: Curves.easeOut,
                              );
                            }
                          }
                        });
                      }

                      return ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        itemCount: provider.messages.length + (hasTyping ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == provider.messages.length) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8, top: 4),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: primaryColor,
                                    backgroundImage: (conv.avatar != null && conv.avatar!.isNotEmpty)
                                        ? NetworkImage(conv.avatar!)
                                        : null,
                                    child: (conv.avatar == null || conv.avatar!.isEmpty)
                                        ? Text(
                                            conv.name.isNotEmpty ? conv.name[0].toUpperCase() : 'U',
                                            style: const TextStyle(fontSize: 10, color: Colors.white),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF334155) : const Color(0xFFE4E6EB),
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          '$typingUser đang gõ ',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF65676B),
                                            fontWeight: FontWeight.w500,
                                            fontStyle: FontStyle.italic,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        const BouncingDotsIndicator(),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }
                          final msg = provider.messages[index];`;

  // 2. Remove outside typing indicator
  const target2 = `          // Typing Indicator Widget (Chuẩn Messenger: Bỏ icon phía trước, có chữ [Tên] đang gõ + 3 chấm chuyển động)
          Consumer<ChatProvider>(
            builder: (context, chatProv, child) {
              final typingUser = chatProv.getTypingUserForSelectedConversation();
              if (typingUser == null || typingUser.isEmpty) {
                return const SizedBox.shrink();
              }
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE4E6EB),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$typingUser đang gõ ',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF65676B),
                              fontWeight: FontWeight.w500,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const BouncingDotsIndicator(),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),`;

  const normContent = content.replace(/\r\n/g, '\n');
  const normTarget1 = target1.replace(/\r\n/g, '\n');
  const normTarget2 = target2.replace(/\r\n/g, '\n');

  let modified = false;
  let updatedNorm = normContent;

  if (updatedNorm.includes(normTarget1)) {
    updatedNorm = updatedNorm.replace(normTarget1, replacement1.replace(/\r\n/g, '\n'));
    modified = true;
    console.log('✅ Integrated typing indicator into ListView.builder');
  } else {
    console.log('ℹ️ target1 already updated or not found');
  }

  if (updatedNorm.includes(normTarget2)) {
    updatedNorm = updatedNorm.replace(normTarget2, '          // Typing indicator moved inside ListView.builder as last item');
    modified = true;
    console.log('✅ Removed outside typing indicator widget');
  } else {
    console.log('ℹ️ target2 already updated or not found');
  }

  if (modified) {
    const hasCRLF = content.includes('\r\n');
    fs.writeFileSync(dartFilePath, hasCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm, 'utf8');
    console.log('💾 Saved chat_screen.dart');
  }
}

// 3. Patch web bundles (main.dart.js)
const webFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

webFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let jsContent = fs.readFileSync(file, 'utf8');
  let jsModified = false;

  // A. In A.a7G.prototype (onUserTyping socket handler):
  // When typing starts, also trigger onNewMessageReceived callback to scroll down!
  const a7gTarget = /if\(p\)\{p=this\.a\r?\n\s*p\.w\.n\(0,n,r\)\r?\n\s*p\.V\(\)\}/g;
  if (a7gTarget.test(jsContent)) {
    jsContent = jsContent.replace(a7gTarget, 'if(p){p=this.a\r\np.w.n(0,n,r)\r\nif(p.cy!=null){try{p.cy.$0()}catch(e){}}\r\np.V()}');
    jsModified = true;
    console.log(`✅ Patched onUserTyping scroll trigger in ${path.basename(file)}`);
  }

  // B. In A.auk.prototype:
  // Render typing indicator AND auto-scroll so the last message is NEVER covered!
  const aukPattern = /A\.auk\.prototype=\{\r?\n\$3\(a,b,c\)\{[\s\S]*?\$C:"\$3"/;
  if (aukPattern.test(jsContent)) {
    jsContent = jsContent.replace(aukPattern, `A.auk.prototype={
$3(a,b,c){var s,r,q=null,p=b.a3p()
if(p==null||p.length===0)return B.au
if(b.cy!=null){setTimeout(function(){try{b.cy.$0()}catch(e){}},35);setTimeout(function(){try{b.cy.$0()}catch(e){}},120)}
s=A.ag(18)
r=t.p
return A.a5(q,A.b9(A.b([A.a5(q,A.b9(A.b([A.a2(A.f(p)+" \u0111ang g\xf5 ",q,q,q,q,q,B.av2,q,q,q),B.cW,B.FC],r),B.l,B.m,B.G),B.h,q,q,new A.ak(B.eg,q,q,s,q,q,B.t),q,q,q,B.fu,q,q,q)],r),B.l,B.m,B.p),B.h,q,q,q,q,q,q,B.lK,q,q,1/0)},
$C:"$3"`);
    jsModified = true;
    console.log(`✅ Patched A.auk with auto-scroll in ${path.basename(file)}`);
  }

  if (jsModified) {
    fs.writeFileSync(file, jsContent, 'utf8');
    console.log(`💾 Saved web bundle ${file}`);
  }
});
