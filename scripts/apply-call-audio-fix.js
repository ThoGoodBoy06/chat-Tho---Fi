const fs = require('fs');
const path = require('path');
const cp = require('child_process');

console.log('🚀 Bắt đầu cập nhật hệ thống âm thanh WebRTC & nhạc chuông (hỗ trợ CRLF)...');

// 1. CẬP NHẬT index.html TRÊN TẤT CẢ CÁC THƯ MỤC
const indexFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'public', 'index.html')
];

const callAudioEngineScript = `
<!-- Thẻ audio chuyên biệt cho WebRTC và chuông cuộc gọi -->
<audio id="remoteAudioPlayer" autoplay playsinline style="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;"></audio>
<audio id="callRingtoneAudio" loop preload="auto" src="/ringtone.mp3" style="display:none;"></audio>
<audio id="callTutTutAudio" loop preload="auto" src="/tuttut.mp3" style="display:none;"></audio>
<audio id="callEndAudio" preload="auto" src="/amthanhtat.mp3" style="display:none;"></audio>

<script id="call-audio-engine-script">
(function() {
  var audioCtx = null;
  var remoteSourceNode = null;

  function getAudioCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function() {});
    }
    return audioCtx;
  }

  // Tự động unlock âm thanh ngay khi người dùng chạm / bấm vào màn hình
  function unlockAudio() {
    var ctx = getAudioCtx();
    ['remoteAudioPlayer', 'callRingtoneAudio', 'callTutTutAudio', 'callEndAudio'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.muted = false;
        var p = el.play();
        if (p && p.then) {
          p.then(function() {
            if (id !== 'remoteAudioPlayer') el.pause();
          }).catch(function() {});
        }
      }
    });
  }
  ['click', 'touchstart', 'keydown'].forEach(function(evt) {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  window._callAudioEngine = {
    playIncomingRingtone: function() {
      console.log('🔔 [_callAudioEngine] Bắt đầu phát chuông gọi đến: ringtone.mp3');
      this.stopAllCallSounds();
      var el = document.getElementById('callRingtoneAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) { console.warn('Ringtone play deferred:', e); });
      }
    },
    playWaitingTutTut: function() {
      console.log('📞 [_callAudioEngine] Bắt đầu phát âm thanh chờ: tuttut.mp3');
      this.stopAllCallSounds();
      var el = document.getElementById('callTutTutAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) { console.warn('TutTut play deferred:', e); });
      }
    },
    playCallEndSound: function() {
      console.log('🔴 [_callAudioEngine] Phát âm thanh tắt cuộc gọi: amthanhtat.mp3');
      this.stopAllCallSounds();
      var el = document.getElementById('callEndAudio');
      if (el) {
        el.currentTime = 0;
        el.muted = false;
        el.volume = 1.0;
        var p = el.play();
        if (p && p.catch) p.catch(function(e) { console.warn('End call sound deferred:', e); });
      }
    },
    stopAllCallSounds: function() {
      var ring = document.getElementById('callRingtoneAudio');
      if (ring) { ring.pause(); ring.currentTime = 0; }
      var tut = document.getElementById('callTutTutAudio');
      if (tut) { tut.pause(); tut.currentTime = 0; }
    },
    playRemoteStream: function(stream) {
      if (!stream) return;
      console.log('🔊 [_callAudioEngine] Đang kết nối luồng âm thanh đàm thoại 2 chiều...');
      try {
        var audioEl = document.getElementById('remoteAudioPlayer');
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = 'remoteAudioPlayer';
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        var p = audioEl.play();
        if (p && p.catch) p.catch(function(err) { console.warn('Audio tag play deferred:', err); });
      } catch(e) {
        console.error('AudioElement error:', e);
      }

      // Kênh phần cứng Web Audio API: Bơm trực tiếp vào loa hệ điều hành
      try {
        var ctx = getAudioCtx();
        if (ctx) {
          if (remoteSourceNode) {
            try { remoteSourceNode.disconnect(); } catch(_) {}
          }
          remoteSourceNode = ctx.createMediaStreamSource(stream);
          remoteSourceNode.connect(ctx.destination);
          console.log('✅ [_callAudioEngine] Web Audio API đã kết nối trực tiếp ra loa ngoài!');
        }
      } catch(ctxErr) {
        console.warn('Web Audio Context bridge note:', ctxErr);
      }
    }
  };
})();
</script>
`;

for (const p of indexFiles) {
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, 'utf8');
  if (!html.includes('id="call-audio-engine-script"')) {
    html = html.replace('</body>', `${callAudioEngineScript}\n</body>`);
    fs.writeFileSync(p, html, 'utf8');
    console.log('✅ Đã gắn Call Audio Engine vào:', p);
  } else {
    const startIdx = html.indexOf('<audio id="remoteAudioPlayer"');
    const endIdx = html.indexOf('</script>', html.indexOf('id="call-audio-engine-script"')) + 9;
    if (startIdx !== -1 && endIdx !== -1) {
      html = html.slice(0, startIdx) + callAudioEngineScript + html.slice(endIdx);
      fs.writeFileSync(p, html, 'utf8');
      console.log('✅ Đã cập nhật Call Audio Engine trong:', p);
    }
  }
}

// 2. CẬP NHẬT main.dart.js TRÊN TẤT CẢ CÁC THƯ MỤC
const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js')
];

for (const p of jsFiles) {
  if (!fs.existsSync(p)) continue;
  let js = fs.readFileSync(p, 'utf8');

  // A. Thẻ remoteVideoPlayer phải muted = true để không chặn Autoplay Policy và không xung đột âm thanh
  js = js.replace(
    /else\{q=p\.style\r?\nq\.position="fixed"\r?\nq\.top="0"\r?\nq\.left="0"\r?\nq\.width="100vw"/g,
    'else{p.muted=!0;q=p.style\nq.position="fixed"\nq.top="0"\nq.left="0"\nq.width="100vw"'
  );

  // B. Thẻ remoteAudioPlayer không dùng display="none"
  js = js.replace(
    /a0\.display="none"\r?\nb=b\.body/g,
    'a0.position="fixed";a0.left="-9999px";a0.width="1px";a0.height="1px";a0.opacity="0";a0.pointerEvents="none"\nb=b.body'
  );

  // C. Khi nhận track (A.avX) -> Gửi vào window._callAudioEngine.playRemoteStream(s)
  if (!js.includes('window._callAudioEngine.playRemoteStream(s)')) {
    js = js.replace(
      /if\(s!=null\)\{p=this\.a\r?\nq=p\.e/g,
      'if(s!=null){try{if(window._callAudioEngine)window._callAudioEngine.playRemoteStream(s);}catch(_){}p=this.a\nq=p.e'
    );
    console.log('✅ [main.dart.js] Đã nối luồng onTrack vào _callAudioEngine.playRemoteStream!');
  }

  // D. Khi nhận addstream (A.avW) -> Gửi vào window._callAudioEngine.playRemoteStream(p)
  if (!js.includes('window._callAudioEngine.playRemoteStream(p)')) {
    js = js.replace(
      /if\(p!=null\)\{r=this\.a\r?\nq=r\.e/g,
      'if(p!=null){try{if(window._callAudioEngine)window._callAudioEngine.playRemoteStream(p);}catch(_){}r=this.a\nq=r.e'
    );
    console.log('✅ [main.dart.js] Đã nối luồng onAddStream vào _callAudioEngine.playRemoteStream!');
  }

  // E. Khi có cuộc gọi đến -> Kích hoạt window._callAudioEngine.playIncomingRingtone()
  if (!js.includes('window._callAudioEngine.playIncomingRingtone()')) {
    js = js.replace(
      /try\{A\.FQ\(\);\}catch\(_\)\{\}/g,
      'try{if(window._callAudioEngine)window._callAudioEngine.playIncomingRingtone();else A.FQ();}catch(_){}'
    );
    console.log('✅ [main.dart.js] Đã gắn playIncomingRingtone vào hộp thoại cuộc gọi đến!');
  }

  // F. Khi gọi đi (chờ bắt máy) -> Kích hoạt window._callAudioEngine.playWaitingTutTut()
  if (!js.includes('window._callAudioEngine.playWaitingTutTut()')) {
    js = js.replace(
      /if\(b\)A\.FR\(\)\r?\nelse A\.FS\(\)/g,
      'if(b){try{if(window._callAudioEngine)window._callAudioEngine.playWaitingTutTut();else A.FR();}catch(_){}}else{try{if(window._callAudioEngine)window._callAudioEngine.stopAllCallSounds();else A.FS();}catch(_){}}'
    );
    console.log('✅ [main.dart.js] Đã gắn playWaitingTutTut vào màn hình gọi đi!');
  }

  // G. Khi kết thúc cuộc gọi (cúp máy, đối phương tắt máy, từ chối) -> Kích hoạt playCallEndSound()
  if (!js.includes('window._callAudioEngine.playCallEndSound()')) {
    js = js.replace(
      /try \{ A\.FS\(\); \} catch\(_\) \{\}/g,
      'try { if(window._callAudioEngine) window._callAudioEngine.playCallEndSound(); else A.FS(); } catch(_) {}'
    );
  }

  if (!js.includes('playCallEndSound();}\\nthis.a.$0()')) {
    js = js.replace(
      /A\.bQ\("\\ud83d\\udd34 \\u0110\\u1ed1i ph\\u01b0\\u01a1ng \\u0111\\xe3 t\\u1eaft m\\xe1y -> T\\u1ef1 \\u0111\\u1ed9ng \\u0111\\xf3ng m\\xe0n h\\xecnh g\\u1ecdi!"\);\r?\nthis\.a\.\$0\(\)/g,
      'A.bQ("\\ud83d\\udd34 \\u0110\\u1ed1i ph\\u01b0\\u01a1ng \\u0111\\xe3 t\\u1eaft m\\xe1y -> T\\u1ef1 \\u0111\\u1ed9ng \\u0111\\xf3ng m\\xe0n h\\xecnh g\\u1ecdi!");try{if(window._callAudioEngine)window._callAudioEngine.playCallEndSound();}catch(_){}\nthis.a.$0()'
    );
  }

  // H. Cập nhật Audio Constraints cho getUserMedia để âm thanh trong trẻo, to rõ:
  js = js.replace(
    /B\.mN\.F4\(b,A\.V\(\["audio",!0,"video",n\.b&&A\.V\(\["facingMode","user"\],a7,a7\)\],a0,a0\)\)/g,
    'B.mN.F4(b,A.V(["audio",A.V(["echoCancellation",!0,"noiseSuppression",!0,"autoGainControl",!0],a7,a0),"video",n.b&&A.V(["facingMode","user"],a7,a7)],a0,a0))'
  );

  fs.writeFileSync(p, js, 'utf8');

  // Kiểm tra cú pháp ngay lập tức bằng node --check
  cp.execSync(`node --check "${p}"`);
  console.log(`✅ [SYNTAX OK] ${path.basename(p)} hợp lệ 100%!`);
}

console.log('🎉 Hoàn tất nâng cấp toàn diện hệ thống âm thanh WebRTC & Nhạc chuông cuộc gọi 100%!');
