const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dirs = [
  path.join(ROOT, 'public'),
  path.join(ROOT, 'flutter_frontend', 'build', 'web'),
  path.join(ROOT, 'backend', 'flutter_frontend', 'build', 'web')
];

const now = Date.now();
console.log('Timestamp mới:', now);

const vibrateScript = `
  <!-- Hỗ trợ rung cuộc gọi đến chu kỳ 1s rung - 0.5s nghỉ -->
  <script>
    window._callVibrateTimer = null;
    window._startCallVibration = function() {
      if (window._callVibrateTimer) clearInterval(window._callVibrateTimer);
      function doVib() {
        try {
          if (navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate([1000, 500]);
          }
        } catch(_) {}
      }
      doVib();
      window._callVibrateTimer = setInterval(doVib, 1500);
      console.log('📳 [Vibration] Đã bắt đầu rung chu kỳ cuộc gọi đến!');
    };
    window._stopCallVibration = function() {
      if (window._callVibrateTimer) {
        clearInterval(window._callVibrateTimer);
        window._callVibrateTimer = null;
      }
      try {
        if (navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(0);
        }
      } catch(_) {}
      console.log('📳 [Vibration] Đã dừng rung cuộc gọi.');
    };
  </script>
`;

dirs.forEach(dir => {
  // 1. Cập nhật index.html với script rung
  const indexPath = path.join(dir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    if (!indexHtml.includes('_startCallVibration')) {
      indexHtml = indexHtml.replace('</head>', `${vibrateScript}\n</head>`);
      console.log('✅ Đã thêm script rung vào index.html cho:', dir);
    }
    indexHtml = indexHtml.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    indexHtml = indexHtml.replace(/flutter_bootstrap\.js(\?v=\d+)?/g, `flutter_bootstrap.js?v=${now}`);
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
  }

  // 2. Cập nhật flutter_bootstrap.js
  const bootPath = path.join(dir, 'flutter_bootstrap.js');
  if (fs.existsSync(bootPath)) {
    let bootContent = fs.readFileSync(bootPath, 'utf8');
    bootContent = bootContent.replace(/main\.dart\.js(\?v=\d+)?/g, `main.dart.js?v=${now}`);
    fs.writeFileSync(bootPath, bootContent, 'utf8');
  }

  // 3. Cập nhật main.dart.js
  const mainJsPath = path.join(dir, 'main.dart.js');
  if (!fs.existsSync(mainJsPath)) return;

  let content = fs.readFileSync(mainJsPath, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  // Kích hoạt rung trong agj
  const agjTarget = 'window._incomingCallShowing=true;';
  const agjNew = 'window._incomingCallShowing=true;if(window._startCallVibration)window._startCallVibration();';
  if (norm.includes(agjTarget) && !norm.includes('_startCallVibration();')) {
    norm = norm.replace(agjTarget, agjNew);
    console.log('✅ Đã gắn _startCallVibration vào agj cho:', dir);
  }

  // Dừng rung trong A.ao2
  const ao2Target = 'A.bQ("🔴 Socket call_ended: Bắt đầu xử lý...");';
  const ao2New = 'A.bQ("🔴 Socket call_ended: Bắt đầu xử lý...");if(window._stopCallVibration)window._stopCallVibration();';
  if (norm.includes(ao2Target) && !norm.includes('_stopCallVibration();A.bQ')) {
    norm = norm.replace(ao2Target, ao2New);
    console.log('✅ Đã gắn _stopCallVibration vào A.ao2 cho:', dir);
  }

  // Dừng rung trong A.ave (Từ chối)
  const aveTarget = 'window._incomingCallShowing=false;window._incomingCallContext=null;';
  const aveNew = 'window._incomingCallShowing=false;if(window._stopCallVibration)window._stopCallVibration();window._incomingCallContext=null;';
  if (norm.includes(aveTarget) && !norm.includes('_stopCallVibration();window._incomingCallContext=null;')) {
    norm = norm.replace(aveTarget, aveNew);
    console.log('✅ Đã gắn _stopCallVibration vào A.ave cho:', dir);
  }

  // Dừng rung trong A.avf (Trả lời)
  const avfTarget = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nwindow._incomingCallShowing=false;';
  const avfNew = 'A.avf.prototype={\n$0(){var s,r,q=this,p=q.a.a\nwindow._incomingCallShowing=false;if(window._stopCallVibration)window._stopCallVibration();';
  if (norm.includes(avfTarget) && !norm.includes('_stopCallVibration();window._incomingCallContext=null;')) {
    norm = norm.replace(avfTarget, avfNew);
    console.log('✅ Đã gắn _stopCallVibration vào A.avf cho:', dir);
  }

  const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
  fs.writeFileSync(mainJsPath, result, 'utf8');
  console.log('🎉 Đã ghi main.dart.js thành công cho:', dir);
});

console.log('\n🌟 Hoàn tất cài đặt tính năng rung cuộc gọi!');
