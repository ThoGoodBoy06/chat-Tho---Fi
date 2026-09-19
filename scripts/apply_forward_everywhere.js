const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu cập nhật tính năng chuyển tiếp tin nhắn và hình ảnh...');

// ════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT TẤT CẢ FILE MAIN.DART.JS
// ════════════════════════════════════════════════════════════════
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

const fwdTapDefinition = `
A.aFwdTap=function aFwdTap(a,b){this.a=a;this.b=b;};
A.aFwdTap.prototype={
$0(){
  A.b1(this.a,!1).bO(0,null);
  try{
    var m=this.b;
    var mid=m.a||m.id;
    var s=m.e||"";
    var f=m.f||"";
    var u=(f&&f.length>0)?f:s;
    if(!u||u==="[Hình ảnh]"||u==="[Ảnh]"){u=(f&&f.length>0)?f:(m.imageUrl||m.content||"");}
    var isImg=m.d==="image"||(typeof u==="string"&&(u.startsWith("data:image")||u.indexOf(".jpg")!==-1||u.indexOf(".png")!==-1||u.indexOf(".webp")!==-1||u.indexOf("/chat-media/")!==-1));
    var urls=[];
    if(isImg&&u){
      var _be=(window.location.origin.indexOf("localhost")!==-1||window.location.origin.indexOf("127.0.0.1")!==-1)?window.location.origin:"https://chat-tho-fi-vn-9s8u.onrender.com";
      if(typeof u==="string"&&u.startsWith("/")) u=_be+u;
      urls.push(u);
    }
    if(window.openForwardModal){
      window.openForwardModal({
        messageIds:mid?[mid]:[],
        urls:urls,
        content:m.e||m.content||""
      });
    }
  }catch(err){console.error("Lỗi khi mở modal chuyển tiếp:",err);}
},
$S:0};
`;

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // 1.1. Thêm định nghĩa A.aFwdTap nếu chưa có
  if (!content.includes('A.aFwdTap=function')) {
    const hookTarget = 'A.awu.prototype={';
    if (content.includes(hookTarget)) {
      content = content.replace(hookTarget, fwdTapDefinition + '\n' + hookTarget);
      console.log(`  [OK] Đã chèn A.aFwdTap vào: ${file}`);
    }
  }

  // 1.2. Thêm ListTile Chuyển tiếp vào menu context menu (i=A.b([...]))
  // Target:
  // A.eV(!1,B.i9,!0,d,!0,d,d,!1,d,d,new A.awu(p,l),!1,d,d,d,d,d,B.aya,B.abc,d),B.qn
  const copyTile = 'A.eV(!1,B.i9,!0,d,!0,d,d,!1,d,d,new A.awu(p,l),!1,d,d,d,d,d,B.aya,B.abc,d),B.qn';
  const fwdTile = 'A.eV(!1,B.i9,!0,d,!0,d,d,!1,d,d,new A.aFwdTap(p,l),!1,d,d,d,d,d,new A.ap("Chuy\\u1ec3n ti\\u1ebfp",null,B.Ef,null,null,null,null,null,null,null,null),new A.aJ(new A.ax(983294,!0),20,B.I,null,null),d),B.qn';

  if (content.includes(copyTile) && !content.includes('new A.aFwdTap(p,l)')) {
    content = content.replace(copyTile, copyTile + ',' + fwdTile);
    console.log(`  [OK] Đã thêm mục Chuyển tiếp vào context menu của: ${file}`);
  }

  // 1.3. Hiển thị nhãn "↪ Đã chuyển tiếp" trên bubble tin nhắn đơn (văn bản hoặc ảnh)
  // Target:
  // if(e!=null&&e.length!==0)B.b.M(f,A.b([new A.dL(new A.atO(d.e,a,d.f,k),c)],g))
  // f.push(d.a.aaY(a,k))
  const pushBubbleTarget = 'if(e!=null&&e.length!==0)B.b.M(f,A.b([new A.dL(new A.atO(d.e,a,d.f,k),c)],g))\nf.push(d.a.aaY(a,k))';
  const fwdBubbleCode = `if(e!=null&&e.length!==0)B.b.M(f,A.b([new A.dL(new A.atO(d.e,a,d.f,k),c)],g))
if(a&&(a.isForwarded===true||a.is_forwarded===true)){
  var _fwdCol=(m||!k)?new A.q(4284897131):B.f;
  var _fwdT=A.a2("\\u21aa \\u0110\\xe3 chuy\\u1ec3n ti\\u1ebfp",c,1,B.a9,c,c,A.ay(c,c,_fwdCol,c,c,c,c,c,c,c,c,11.5,c,c,c,c,c,!0,c,c,c,c,c,c,c,c),c,c,c);
  f.push(_fwdT);
}
f.push(d.a.aaY(a,k))`;

  if (content.includes(pushBubbleTarget)) {
    content = content.replace(pushBubbleTarget, fwdBubbleCode);
    console.log(`  [OK] Đã thêm nhãn ↪ Đã chuyển tiếp vào tin nhắn đơn trong: ${file}`);
  } else {
    // Thử match với CRLF nếu có
    const crlfTarget = 'if(e!=null&&e.length!==0)B.b.M(f,A.b([new A.dL(new A.atO(d.e,a,d.f,k),c)],g))\r\nf.push(d.a.aaY(a,k))';
    if (content.includes(crlfTarget)) {
      content = content.replace(crlfTarget, fwdBubbleCode.replace(/\n/g, '\r\n'));
      console.log(`  [OK] Đã thêm nhãn ↪ Đã chuyển tiếp (CRLF) vào tin nhắn đơn trong: ${file}`);
    }
  }

  // Syntax check
  try {
    new vm.Script(content);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`  [SUCCESS] Syntax check hợp lệ 100% cho: ${file}`);
  } catch (err) {
    console.error(`  [ERROR] Lỗi cú pháp JavaScript trong ${file}:`, err);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT CHAT_SCREEN.DART (CẢ 2 NƠI)
// ════════════════════════════════════════════════════════════════
const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

dartFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // 2.1. Thêm mục "Chuyển tiếp" vào _showMessengerStyleContextMenu
  const copyTileDart = `                              ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                title: const Text('Sao chép', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                                trailing: const Icon(Icons.copy_rounded, color: Color(0xFF0F172A), size: 20),
                                onTap: () {
                                  Navigator.pop(context);
                                  html.window.navigator.clipboard?.writeText(msg.content);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Đã sao chép tin nhắn')),
                                  );
                                },
                              ),`;

  const fwdTileDart = `                              ListTile(
                                dense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                title: const Text('Chuyển tiếp', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                                trailing: const Icon(Icons.shortcut_rounded, color: Color(0xFF0F172A), size: 20),
                                onTap: () {
                                  Navigator.pop(dialogContext);
                                  final mediaUrl = isVideo
                                      ? (msg.videoUrl != null && msg.videoUrl!.isNotEmpty ? msg.videoUrl! : msg.content)
                                      : (msg.imageUrl != null && msg.imageUrl!.isNotEmpty ? msg.imageUrl! : msg.content);
                                  final formatted = (isImg || isVideo) ? ApiService.formatImageUrl(mediaUrl) : '';
                                  if (kIsWeb) {
                                    html.window.callMethod('openForwardModal', [
                                      {
                                        'messageIds': [msg.id],
                                        'urls': formatted.isNotEmpty ? [formatted] : [],
                                        'content': msg.content,
                                      }
                                    ]);
                                  }
                                },
                              ),
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),`;

  if (content.includes(copyTileDart) && !content.includes("title: const Text('Chuyển tiếp'")) {
    content = content.replace(copyTileDart, copyTileDart + '\n' + fwdTileDart);
    console.log(`  [OK] Đã thêm mục Chuyển tiếp vào context menu Dart trong: ${file}`);
  }

  // 2.2. Cập nhật nút _buildDeckShareButton mở modal chuyển tiếp
  const oldDeckShare = `  Widget _buildDeckShareButton(BuildContext context, MessageModel msg) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        final provider = Provider.of<ChatProvider>(context, listen: false);
        _showMessengerStyleContextMenu(context, msg, provider, false);
      },`;

  const newDeckShare = `  Widget _buildDeckShareButton(BuildContext context, MessageModel msg) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () {
        if (kIsWeb) {
          final isImg = msg.type == 'image' || (msg.imageUrl != null && msg.imageUrl!.isNotEmpty) || msg.content.startsWith('data:image') || msg.content.toLowerCase().endsWith('.jpg') || msg.content.toLowerCase().endsWith('.png');
          final mediaUrl = isImg ? ApiService.formatImageUrl(msg.imageUrl ?? msg.content) : '';
          html.window.callMethod('openForwardModal', [
            {
              'messageIds': [msg.id],
              'urls': mediaUrl.isNotEmpty ? [mediaUrl] : [],
              'content': msg.content,
            }
          ]);
        }
      },`;

  if (content.includes(oldDeckShare)) {
    content = content.replace(oldDeckShare, newDeckShare);
    console.log(`  [OK] Đã cập nhật _buildDeckShareButton trong: ${file}`);
  }

  // 2.3. Thêm nhãn "↪ Đã chuyển tiếp" trong Column tin nhắn
  const bubbleContentTarget = `                                                              _buildMessageBubbleContent(msg, isMe),`;
  const fwdIndicatorDart = `                                                              if (msg.isForwarded) ...[
                                                                Padding(
                                                                  padding: const EdgeInsets.only(bottom: 4),
                                                                  child: Row(
                                                                    mainAxisSize: MainAxisSize.min,
                                                                    children: [
                                                                      Icon(
                                                                        Icons.shortcut_rounded,
                                                                        size: 13,
                                                                        color: isMe ? Colors.white.withOpacity(0.85) : const Color(0xFF65676B),
                                                                      ),
                                                                      const SizedBox(width: 4),
                                                                      Text(
                                                                        'Đã chuyển tiếp',
                                                                        style: TextStyle(
                                                                          fontSize: 11.5,
                                                                          fontStyle: FontStyle.italic,
                                                                          fontWeight: FontWeight.w500,
                                                                          color: isMe ? Colors.white.withOpacity(0.85) : const Color(0xFF65676B),
                                                                        ),
                                                                      ),
                                                                    ],
                                                                  ),
                                                                ),
                                                              ],
                                                              _buildMessageBubbleContent(msg, isMe),`;

  if (content.includes(bubbleContentTarget) && !content.includes("'Đã chuyển tiếp'")) {
    content = content.replace(bubbleContentTarget, fwdIndicatorDart);
    console.log(`  [OK] Đã thêm hiển thị ↪ Đã chuyển tiếp trong Dart của: ${file}`);
  }

  fs.writeFileSync(file, content, 'utf8');
});

console.log('✅ Hoàn tất nâng cấp tính năng chuyển tiếp tin nhắn và hình ảnh!');
