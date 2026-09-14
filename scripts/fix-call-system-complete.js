const fs = require('fs');
const path = require('path');

console.log('🔧 Đang bắt đầu sửa toàn diện hệ thống Voice & Video Call...');

const ROOT = path.resolve(__dirname, '..');
const TIMESTAMP = Date.now();

// =========================================================================
// 1. ĐỒNG BỘ CÁC TỆP ÂM THANH MP3 VÀO TẤT CẢ THƯ MỤC WEB
// =========================================================================
const mp3Files = ['ringtone.mp3', 'tuttut.mp3', 'amthanhtat.mp3'];
const targetDirs = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web'),
  path.join(ROOT, 'flutter_frontend', 'web'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web'),
  path.join(ROOT, 'public'),
];

mp3Files.forEach((file) => {
  const src = path.join(ROOT, 'public', file);
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Nguồn ${src} không tồn tại`);
    return;
  }
  targetDirs.forEach((td) => {
    if (fs.existsSync(td)) {
      const dest = path.join(td, file);
      fs.copyFileSync(src, dest);
      console.log(`✅ Đã đồng bộ ${file} -> ${dest}`);
    }
  });
});

// =========================================================================
// 2. SỬA CHAT_SCREEN.DART (CẢ ROOT VÀ BACKEND)
// =========================================================================
const dartFiles = [
  path.join(ROOT, 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart'),
];

dartFiles.forEach((df) => {
  if (!fs.existsSync(df)) return;
  let code = fs.readFileSync(df, 'utf8');

  // a) Sửa phát chuông: Callee không phát ringtone khi đã ở trong màn hình active call
  const oldSoundTrigger = /if\s*\(isCaller\)\s*\{\s*SoundService\.playTutTut\(\);\s*\}\s*else\s*\{\s*SoundService\.playRingtone\(\);\s*\}/;
  const newSoundTrigger = `if (isCaller) {
      SoundService.playTutTut();
    } else {
      SoundService.stopAllCallSounds();
    }`;

  if (oldSoundTrigger.test(code)) {
    code = code.replace(oldSoundTrigger, newSoundTrigger);
    console.log(`✅ [Dart] Đã tắt phát ringtone cho Callee trong active call ở ${df}`);
  }

  // b) Sửa Video styling: thêm pointerEvents: none và zIndex hợp lý
  const oldLocalVideoStyle = /zIndex\s*=\s*['"]2147483646['"]\s*;\s*\.\.background\s*=\s*['"]#090D1A['"]/;
  const newLocalVideoStyle = `zIndex = '0'
          ..pointerEvents = 'none'
          ..background = '#090D1A'`;

  if (oldLocalVideoStyle.test(code)) {
    code = code.replace(oldLocalVideoStyle, newLocalVideoStyle);
    console.log(`✅ [Dart] Đã cập nhật pointerEvents & zIndex=0 cho remoteVideo trong ${df}`);
  }

  // c) Sửa remoteAudioPlayer id binding
  const oldRemoteAudioBlock = /final\s+existingAudio\s*=\s*html\.document\.getElementById\('remoteAudioPlayer'\)\s*as\s*html\.AudioElement\?;\s*if\s*\(existingAudio\s*!=\s*null\)\s*\{\s*remoteAudio\s*=\s*existingAudio;\s*\}\s*else\s*\{\s*remoteAudio\s*=\s*html\.AudioElement\(\)\.\.autoplay\s*=\s*true;\s*remoteAudio!\.style\.display\s*=\s*'none';\s*html\.document\.body\?\.children\.add\(remoteAudio!\);\s*\}/;
  const newRemoteAudioBlock = `var existingAudio = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;
                if (existingAudio != null) {
                  remoteAudio = existingAudio;
                } else {
                  remoteAudio = html.AudioElement()
                    ..id = 'remoteAudioPlayer'
                    ..autoplay = true
                    ..setAttribute('playsinline', 'true');
                  remoteAudio!.style.display = 'none';
                  html.document.body?.children.add(remoteAudio!);
                }`;

  if (oldRemoteAudioBlock.test(code)) {
    code = code.replace(oldRemoteAudioBlock, newRemoteAudioBlock);
    console.log(`✅ [Dart] Đã gán id="remoteAudioPlayer" trong ${df}`);
  }

  fs.writeFileSync(df, code, 'utf8');
});

// =========================================================================
// 3. SỬA INDEX.HTML (TẤT CẢ THƯ MỤC)
// =========================================================================
const htmlFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(ROOT, 'flutter_frontend', 'web', 'index.html'),
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
];

htmlFiles.forEach((hf) => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');

  // Đảm bảo không dismiss nếu đang trong active call
  const oldActiveDismiss = 'if (data && data.active === false) {';
  const newActiveDismiss = 'if (data && data.active === false) {\n              if (window._activeCallShowing) { _stopPoll(); return; }';
  if (html.includes(oldActiveDismiss) && !html.includes('window._activeCallShowing) { _stopPoll();')) {
    html = html.replace(oldActiveDismiss, newActiveDismiss);
    console.log(`✅ [HTML] Đã bảo vệ active call không bị dismiss nhầm trong ${hf}`);
  }

  // Cập nhật timestamp cache buster
  html = html.replace(/flutter_bootstrap\.js\?v=[^"']+/g, `flutter_bootstrap.js?v=${TIMESTAMP}`);

  fs.writeFileSync(hf, html, 'utf8');
});

// =========================================================================
// 4. SỬA MAIN.DART.JS (BUILD/WEB, PUBLIC, BACKEND)
// =========================================================================
const jsFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(ROOT, 'public', 'main.dart.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
];

jsFiles.forEach((jf) => {
  if (!fs.existsSync(jf)) return;
  let js = fs.readFileSync(jf, 'utf8');

  // a) Sửa phát âm thanh trong VI: Callee (b === false) không gọi A.FQ() mà gọi A.FS()
  const r1 = /if\(b\)A\.FR\(\)\r?\nelse A\.FQ\(\)/g;
  if (r1.test(js)) {
    js = js.replace(r1, 'if(b)A.FR()\r\nelse A.FS()');
    console.log(`✅ [JS] Đã sửa VI: Callee dừng chuông thay vì phát chuông trong ${jf}`);
  }

  // b) Sửa getOrCreateVideo (A.aw6.prototype.$2$isLocal)
  const r2 = /q\.zIndex="2147483646"\r?\nq\.background="#090D1A"/g;
  if (r2.test(js)) {
    js = js.replace(r2, 'q.zIndex="0"\r\nq.pointerEvents="none"\r\nq.background="#090D1A"');
    console.log(`✅ [JS] Đã cập nhật zIndex=0 và pointerEvents="none" cho remoteVideo trong ${jf}`);
  }

  const r3 = /q\.zIndex="2147483647"\r?\nB\.cn\.vB\(q,B\.cn\.uI\(q,"border-radius"\)/g;
  if (r3.test(js)) {
    js = js.replace(r3, 'q.zIndex="2147483647"\r\nq.pointerEvents="none"\r\nB.cn.vB(q,B.cn.uI(q,"border-radius")');
    console.log(`✅ [JS] Đã thêm pointerEvents="none" cho localVideo trong ${jf}`);
  }

  // c) Sửa remoteAudioPlayer id binding trong A.aw0.prototype
  const r4 = /a=A\.b_h\(null\)\r?\na\.autoplay=!0\r?\na6\.e=a/g;
  if (r4.test(js)) {
    js = js.replace(r4, 'a=A.b_h(null)\r\na.id="remoteAudioPlayer"\r\na.autoplay=!0\r\na.setAttribute("playsinline","true")\r\na6.e=a');
    console.log(`✅ [JS] Đã bind id="remoteAudioPlayer" và playsinline trong ${jf}`);
  }

  // d) SỬA WEBRTC RACE CONDITION:
  // 1) Khi thêm tracks xong trong A.aw0.prototype: đánh dấu a6.isLocalStreamReady = true
  const r5 = /a3\.addTrack\(h,a4\)\.toString\}catch\(b2\)\{\}\}\}a2=a6\.r/g;
  if (r5.test(js)) {
    js = js.replace(r5, 'a3.addTrack(h,a4).toString}catch(b2){}}}a6.isLocalStreamReady=!0;a2=a6.r');
    console.log(`✅ [JS] Đã thêm a6.isLocalStreamReady = true sau khi addTrack trong ${jf}`);
  }

  // 2) Trong A.aw2.prototype.a2N (processSignal): Nếu là offer mà localStream chưa sẵn sàng -> xếp vào hàng đợi pendingSignals
  const r6 = /case 0:c=J\.Z\(a0,"signal"\)\r?\nif\(c==null\)\{s=1\r?\nbreak\}g=n\.a\r?\nif\(g\.r==null\)\{n\.b\.push\(a0\)\r?\ns=1\r?\nbreak\}/g;
  if (r6.test(js)) {
    js = js.replace(r6, 'case 0:c=J.Z(a0,"signal")\r\nif(c==null){s=1\r\nbreak}g=n.a\r\nif(g.r==null||(!n.r&&!g.isLocalStreamReady&&J.e(J.Z(c,"type"),"offer"))){n.b.push(a0)\r\ns=1\r\nbreak}');
    console.log(`✅ [JS] Đã chống race condition: Hàng đợi offer nếu localStream chưa sẵn sàng trong ${jf}`);
  }

  // e) Cập nhật _startCallStatusPolling trong JS
  const oldPollJs = /fetch\("\/api\/call\/status\?callerId=" \+ encodeURIComponent\(cId\)/g;
  if (oldPollJs.test(js)) {
    js = js.replace(oldPollJs, 'if(window._activeCallShowing)return;\n    var bUrl = (window.location.hostname.includes("pages.dev") || window.location.hostname.includes("workers.dev") || window.location.hostname.includes("cloudflare")) ? "https://chat-tho-fi-vn-9s8u.onrender.com" : "";\n    fetch(bUrl + "/api/call/status?callerId=" + encodeURIComponent(cId)');
    console.log(`✅ [JS] Đã cập nhật bUrl và chặn dismiss active call trong ${jf}`);
  }

  fs.writeFileSync(jf, js, 'utf8');
});

// =========================================================================
// 5. CẬP NHẬT FLUTTER_BOOTSTRAP.JS CACHE BUSTER
// =========================================================================
const bootFiles = [
  path.join(ROOT, 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(ROOT, 'public', 'flutter_bootstrap.js'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
];

bootFiles.forEach((bf) => {
  if (!fs.existsSync(bf)) return;
  let boot = fs.readFileSync(bf, 'utf8');
  boot = boot.replace(/main\.dart\.js\?v=[^"']+/g, `main.dart.js?v=${TIMESTAMP}`);
  fs.writeFileSync(bf, boot, 'utf8');
  console.log(`✅ [Bootstrap] Đã cập nhật cache buster ${TIMESTAMP} trong ${bf}`);
});

console.log('\n🎉 HOÀN TẤT TẤT CẢ CÁC BƯỚC SỬA HỆ THỐNG VOICE & VIDEO CALL!');
