const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🚀 Bắt đầu cập nhật tính năng: Bấm vào chỗ trống bất kì để tắt Menu Context tin nhắn...');

// ══════════════════════════════════════════════════════════════════════════════
// 1. CẬP NHẬT TẤT CẢ FILE MAIN.DART.JS
// ══════════════════════════════════════════════════════════════════════════════

const targetSnippet = `return A.hq(d,B.F,A.dt(B.aF,A.b([c,new A.eb(r,d,d,new A.bc(B.L_,A.xn(A.bm(A.b([n,B.hn,k,B.jT,A.a5(d,A.bm(i,B.l,B.m,B.G),B.h,d,d,new A.ak(B.f,d,d,j,o,d,B.t),d,d,d,d,d,d,220)],g),q,B.m,B.G),d,B.M,d,d,B.a0),d),d)],g),B.r,B.ap),d,!1)}`;

const replacementSnippet = `var _pop=new A.awq(a);
var _align=new A.eb(r,d,d,new A.bc(B.L_,A.xn(A.bm(A.b([n,B.hn,k,B.jT,A.a5(d,A.bm(i,B.l,B.m,B.G),B.h,d,d,new A.ak(B.f,d,d,j,o,d,B.t),d,d,d,d,d,d,220)],g),q,B.m,B.G),d,B.M,d,d,B.a0),d),d);
var _alignWrapped=A.dr(d,_align,B.db,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,_pop,d,d,d,d,d,d,!1,B.ao);
var _stack=A.dt(B.aF,A.b([c,_alignWrapped],g),B.r,B.ap);
var _stackWrapped=A.dr(d,_stack,B.M,!1,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,d,_pop,d,d,d,d,d,d,!1,B.ao);
return A.hq(d,B.F,_stackWrapped,d,!1);
}`;

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes(targetSnippet)) {
    code = code.replace(targetSnippet, replacementSnippet);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Đã cập nhật main.dart.js:', file);
  } else if (code.includes('var _alignWrapped=A.dr(')) {
    console.log('ℹ️ Đã có bản vá trước đó:', file);
  } else {
    console.warn('⚠️ Không tìm thấy targetSnippet trong:', file);
  }

  // Validate syntax
  try {
    new vm.Script(code);
    console.log('  [Syntax OK] vm.Script passed 100% cho:', file);
  } catch (err) {
    console.error('❌ Lỗi cú pháp trong:', file, err);
    process.exit(1);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. CẬP NHẬT CÁC FILE CHAT_SCREEN.DART
// ══════════════════════════════════════════════════════════════════════════════

const dartFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart')
];

const oldDartStart = `      pageBuilder: (dialogContext, anim1, anim2) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          body: Stack(
            children: [
              // Nền làm mờ toàn màn hình & Chạm để đóng
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.pop(dialogContext),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                    child: Container(
                      color: Colors.black.withOpacity(0.22),
                    ),
                  ),
                ),
              ),
              // Căn lề sát mép màn hình (Bên trái cho đối phương, Bên phải cho tin nhắn của mình)
              Align(`;

const newDartStart = `      pageBuilder: (dialogContext, anim1, anim2) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          body: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.pop(dialogContext),
            child: Stack(
              children: [
                // Nền làm mờ toàn màn hình & Chạm để đóng
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => Navigator.pop(dialogContext),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                      child: Container(
                        color: Colors.black.withOpacity(0.22),
                      ),
                    ),
                  ),
                ),
                // Căn lề sát mép màn hình (Bên trái cho đối phương, Bên phải cho tin nhắn của mình)
                GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: () => Navigator.pop(dialogContext),
                  child: Align(`;

const oldDartEnd = `                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },`;

const newDartEnd = `                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              ),
            ],
          ),
          ),
        );
      },`;

dartFiles.forEach(dfile => {
  if (!fs.existsSync(dfile)) return;
  let dcode = fs.readFileSync(dfile, 'utf8');
  let changed = false;

  if (dcode.includes(oldDartStart)) {
    dcode = dcode.replace(oldDartStart, newDartStart);
    changed = true;
  }
  if (dcode.includes(oldDartEnd)) {
    dcode = dcode.replace(oldDartEnd, newDartEnd);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(dfile, dcode, 'utf8');
    console.log('✅ Đã cập nhật chat_screen.dart:', dfile);
  } else {
    console.log('ℹ️ chat_screen.dart đã được cập nhật hoặc không khớp chuỗi gốc:', dfile);
  }
});

console.log('🎉 Hoàn tất áp dụng bản vá đóng Context Menu khi bấm vào chỗ trống bất kì!');
