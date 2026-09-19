const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu triển khai chuẩn hóa Logic Bật/Tắt (Toggle) cảm xúc tin nhắn và hình ảnh...');

// ══════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT DART (flutter_frontend và backend/flutter_frontend)
// ══════════════════════════════════════════════════════════════════════════════
const dartProviderFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'providers', 'chat_provider.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'providers', 'chat_provider.dart')
];

dartProviderFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  const regex = /void reactToMessage\(String messageId, String emoji\) \{[\s\S]*?SocketService\.emitReactMessage\(messageId, selectedConversation!\.id, emoji\);[\s\S]*?debugPrint\('⚠️ Fallback react API error: \$e'\);\s*\}\);\s*\}/;

  const newReactMethod = `void reactToMessage(String messageId, String emoji) {
    if (selectedConversation == null) return;

    // Optimistic update locally for instant feedback
    final index = messages.indexWhere((m) => m.id == messageId);
    bool isRemoved = false;
    if (index != -1 && currentUser != null) {
      final msg = messages[index];
      final Map<String, String> updatedReactions = Map<String, String>.from(msg.reactions);
      final userId = currentUser!.id;

      // Logic toggle: nếu đã thả icon này rồi -> HỦY (xóa bỏ). Ngược lại -> thêm/đổi icon mới
      if (updatedReactions[userId] == emoji) {
        updatedReactions.remove(userId);
        isRemoved = true;
      } else {
        updatedReactions[userId] = emoji;
        isRemoved = false;
      }

      messages[index] = msg.copyWith(reactions: updatedReactions);
      notifyListeners();
    }

    // Phát âm thanh phản hồi
    SocketService.playReactSound();

    // Phát tín hiệu qua Socket nếu đang kết nối. Nếu không có socket mới fallback sang REST API
    // (Tránh gọi đồng thời cả hai gây xung đột toggle 2 lần liên tiếp)
    if (SocketService.isConnected) {
      SocketService.emitReactMessage(messageId, selectedConversation!.id, emoji, isRemoved: isRemoved);
    } else {
      ApiService.reactToMessage(messageId, emoji, isRemoved: isRemoved).catchError((e) {
        debugPrint('⚠️ Fallback react API error: $e');
      });
    }
  }`;

  if (regex.test(code)) {
    code = code.replace(regex, newReactMethod);
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`  [Dart Provider] Đã cập nhật reactToMessage: ${fp}`);
  }
});

// Cập nhật socket_service.dart và api_service.dart để nhận tham số isRemoved
const socketServiceFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'services', 'socket_service.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'services', 'socket_service.dart')
];

socketServiceFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');
  const oldFn = `  static void emitReactMessage(String messageId, String conversationId, String emoji) {
    if (socket != null && socket!.connected) {
      socket!.emit('react_message', {
        'messageId': messageId,
        'conversationId': conversationId,
        'emoji': emoji,
      });
      playReactSound();
    }
  }`;

  const newFn = `  static void emitReactMessage(String messageId, String conversationId, String emoji, {bool isRemoved = false}) {
    if (socket != null && socket!.connected) {
      socket!.emit('react_message', {
        'messageId': messageId,
        'conversationId': conversationId,
        'emoji': emoji,
        'isRemoved': isRemoved,
      });
      playReactSound();
    }
  }`;

  if (code.includes('static void emitReactMessage(String messageId, String conversationId, String emoji)')) {
    code = code.replace(
      'static void emitReactMessage(String messageId, String conversationId, String emoji) {',
      'static void emitReactMessage(String messageId, String conversationId, String emoji, {bool isRemoved = false}) {'
    );
    code = code.replace(
      "'emoji': emoji,",
      "'emoji': emoji,\n        'isRemoved': isRemoved,"
    );
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`  [Dart SocketService] Đã thêm tham số isRemoved: ${fp}`);
  }
});

const apiServiceFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'services', 'api_service.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'services', 'api_service.dart')
];

apiServiceFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes('static Future<Map<String, dynamic>> reactToMessage(String messageId, String emoji) async')) {
    code = code.replace(
      'static Future<Map<String, dynamic>> reactToMessage(String messageId, String emoji) async',
      'static Future<Map<String, dynamic>> reactToMessage(String messageId, String emoji, {bool isRemoved = false}) async'
    );
    code = code.replace(
      "body: jsonEncode({'reaction': emoji}),",
      "body: jsonEncode({'reaction': emoji, 'isRemoved': isRemoved}),"
    );
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`  [Dart ApiService] Đã thêm tham số isRemoved: ${fp}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT MAIN.DART.JS (Cả 4 bản build):
// ══════════════════════════════════════════════════════════════════════════════
const mainJsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

mainJsFiles.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let code = fs.readFileSync(fp, 'utf8');

  const regex = /a1l\(a,b\)\{var s,r,q,p,o,n,m,l=this[\s\S]*?A\.My\(a,b\)\.f_\(new A\.a7W\(\)\)\},/;

  const newA1l = `a1l(a,b){var s,r,q,p,o,n,m,l=this
if(l.c==null)return
s=B.b.h3(l.d,new A.a7V(a))
var _isRem=!1;
if(s!==-1&&l.a!=null){r=l.d[s]
q=t.N
p=A.cI(r.Q,q,q)
o=l.a.a
if(J.e(p.h(0,o),b)){p.E(0,o);_isRem=!0;}
else{p.n(0,o,b);_isRem=!1;}
l.d[s]=r.YM(p)
l.V()}A.jp()
q=l.c.a
n=$.bj
if(n!=null&&n.y){n.toString
m=t.N
n.cn("react_message",A.V(["messageId",a,"conversationId",q,"emoji",b,"isRemoved",_isRem],m,m))
A.jp()}
else{A.My(a,b).f_(new A.a7W())}},`;

  if (regex.test(code)) {
    code = code.replace(regex, newA1l);
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`  [main.dart.js] Đã cập nhật a1l loại bỏ race-condition: ${fp}`);

    try {
      new vm.Script(code);
      console.log(`  [main.dart.js] Kiểm tra VM script 100% PASS: ${fp}`);
    } catch(err) {
      console.error(`  [ERROR] main.dart.js syntax error:`, err);
    }
  }
});

console.log('✅ Hoàn tất toàn bộ cập nhật Toggle Logic!');
