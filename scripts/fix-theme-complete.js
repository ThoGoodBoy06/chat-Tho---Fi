const fs = require('fs');
const path = require('path');

console.log('🚀 BẮT ĐẦU FIX TRIỆT ĐỂ CHỦ ĐỀ ĐOẠN CHAT (CHAT THEME)...');

// 1. Vá các file main.dart.js
const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Đang vá file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // A. Lưu reference tới State của ChatScreen và convId vào biến global $
  // Tìm khối code trong Qr() nơi activeChatConvId được cập nhật
  const qrTarget = '$._currentActiveChatConvId=a.a;';
  if (js.includes(qrTarget) && !js.includes('$._activeChatScreenState=c;')) {
    js = js.replace(qrTarget, qrTarget + '\n$._activeChatScreenState=c;');
    console.log('✅ Đã thêm lưu $._activeChatScreenState = c trong Qr()');
  }

  // B. Vá $.getThemeGradient để sử dụng B.afh.$ti một cách an toàn tuyệt đối
  // Tìm vị trí B.add=new A.eU(B.b5,B.bt,B.aU,B.afh,null,null)
  const bAddMarker = 'B.add=new A.eU(B.b5,B.bt,B.aU,B.afh,null,null)';
  const robustGradientsDef = `B.add=new A.eU(B.b5,B.bt,B.aU,B.afh,null,null)
$.getThemeGradient=function(){
  var th = $._currentActiveChatTheme || 'classic';
  if (!$._themeGradients) {
    try {
      var ti = B.afh ? B.afh.$ti : null;
      $._themeGradients = {
        classic: B.add,
        sunset: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4294922543), new A.q(4292674678)], ti), null, null),
        ocean: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4278236379), new A.q(4278223792)], ti), null, null),
        berry: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4287243143), new A.q(4293476439)], ti), null, null),
        emerald: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4279343502), new A.q(4281929597)], ti), null, null)
      };
    } catch(e) {
      console.warn('Fallback theme gradient error:', e);
      return B.add;
    }
  }
  return ($._themeGradients && $._themeGradients[th]) ? $._themeGradients[th] : B.add;
};`;

  // Thay thế định nghĩa cũ nếu có
  if (js.includes('$.getThemeGradient=')) {
    // Regex thay thế toàn bộ hàm $.getThemeGradient cũ
    js = js.replace(/B\.add=new A\.eU\(B\.b5,B\.bt,B\.aU,B\.afh,null,null\)[\s\S]*?\n\};\n/m, robustGradientsDef + '\n');
    console.log('✅ Đã cập nhật lại hàm $.getThemeGradient dùng ti=B.afh.$ti');
  } else if (js.includes(bAddMarker)) {
    js = js.replace(bAddMarker, robustGradientsDef);
    console.log('✅ Đã chèn hàm $.getThemeGradient');
  }

  // C. Vá A.atThemeSocketHandler để gọi aoW() kích hoạt Flutter rebuild
  const oldSocketHandler = `if ($._currentActiveChatConvId === cid) {
        $._currentActiveChatTheme = th;
        if ($._css) { $._css.K(new A.ax1()); }
      }`;
  const newSocketHandler = `if ($._currentActiveChatConvId === cid) {
        $._currentActiveChatTheme = th;
        if ($._activeChatScreenState && typeof $._activeChatScreenState.aoW === 'function') {
          try { $._activeChatScreenState.aoW(); } catch(err) {}
        }
      }`;
  if (js.includes(oldSocketHandler)) {
    js = js.replace(oldSocketHandler, newSocketHandler);
    console.log('✅ Đã cập nhật atThemeSocketHandler gọi aoW()');
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Vá xong file: ${filePath}`);
});

// 2. Vá index.html với logic lấy Token và Socket.emit chuẩn xác
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const modernModalScript = `
<script id="messenger-theme-picker-script">
window._openMessengerThemePicker = function(convId, convName) {
  var oldOverlay = document.getElementById('messenger-theme-picker-overlay');
  if (oldOverlay) oldOverlay.remove();

  var themes = [
    { id: 'classic', name: 'Mặc định (Classic)', color1: '#0084FF', color2: '#0068FF' },
    { id: 'sunset', name: 'Hoàng hôn (Sunset)', color1: '#FF512F', color2: '#DD2476' },
    { id: 'ocean', name: 'Đại dương (Ocean)', color1: '#00B4DB', color2: '#0083B0' },
    { id: 'berry', name: 'Quả mọng (Berry)', color1: '#8A2387', color2: '#E94057' },
    { id: 'emerald', name: 'Ngọc bích (Emerald)', color1: '#11998E', color2: '#38EF7D' }
  ];

  var currentTheme = (window.$ && window.$._currentActiveChatTheme) || 'classic';

  var overlay = document.createElement('div');
  overlay.id = 'messenger-theme-picker-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);z-index:9999999;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.25s ease;';

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#ffffff;width:100%;max-width:440px;border-top-left-radius:24px;border-top-right-radius:24px;padding:16px 20px 28px;box-shadow:0 -12px 35px rgba(0,0,0,0.25);transform:translateY(100%);transition:transform 0.25s cubic-bezier(0.16,1,0.3,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;';

  var html = '<div style="display:flex;justify-content:center;margin-bottom:12px;"><div style="width:40px;height:4px;background:#E2E8F0;border-radius:2px;"></div></div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
  html += '<h3 style="margin:0;font-size:18px;font-weight:700;color:#0F172A;">Chủ đề đoạn chat</h3>';
  html += '<button id="close-theme-btn" style="border:none;background:#F1F5F9;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;font-size:16px;font-weight:bold;">✕</button>';
  html += '</div>';
  html += '<p style="margin:0 0 16px;font-size:13px;color:#64748B;">Chọn màu chủ đề để áp dụng ngay lập tức cho đoạn chat</p>';
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';

  themes.forEach(function(t) {
    var isSel = (t.id === currentTheme) || (currentTheme === 'default' && t.id === 'classic');
    html += '<div class="theme-row" data-theme="' + t.id + '" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:16px;cursor:pointer;transition:background 0.15s;background:' + (isSel ? '#F8FAFC' : 'transparent') + ';border:' + (isSel ? '1.5px solid #0084FF' : '1.5px solid transparent') + ';">';
    html += '<div style="display:flex;align-items:center;gap:14px;">';
    html += '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,' + t.color1 + ',' + t.color2 + ');box-shadow:0 3px 8px ' + t.color1 + '55;border:2px solid #fff;"></div>';
    html += '<span style="font-size:15px;font-weight:' + (isSel ? '700' : '500') + ';color:#0F172A;">' + t.name + '</span>';
    html += '</div>';
    if (isSel) {
      html += '<div style="width:24px;height:24px;border-radius:50%;background:#0084FF;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;">✓</div>';
    } else {
      html += '<div style="width:24px;height:24px;"></div>';
    }
    html += '</div>';
  });
  html += '</div>';

  sheet.innerHTML = html;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    sheet.style.transform = 'translateY(0)';
  });

  function closeOverlay() {
    overlay.style.opacity = '0';
    sheet.style.transform = 'translateY(100%)';
    setTimeout(function() { overlay.remove(); }, 250);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeOverlay();
  });
  document.getElementById('close-theme-btn').addEventListener('click', closeOverlay);

  var rows = sheet.querySelectorAll('.theme-row');
  rows.forEach(function(row) {
    row.addEventListener('click', function() {
      var selectedTheme = this.getAttribute('data-theme');
      console.log('🎯 [Client] Đã chọn theme:', selectedTheme, 'cho phòng:', convId);

      // 1. Cập nhật ngay trên bộ nhớ Dart/JS và kích hoạt Flutter State re-render tức thì
      if (window.$) {
        if (!window.$._convThemes) window.$._convThemes = {};
        window.$._convThemes[convId] = selectedTheme;
        window.$._currentActiveChatTheme = selectedTheme;

        // Kích hoạt setState trên Flutter ChatScreen
        if (window.$._activeChatScreenState && typeof window.$._activeChatScreenState.aoW === 'function') {
          try {
            window.$._activeChatScreenState.aoW();
            console.log('✅ Đã gọi Flutter ChatScreen setState thành công!');
          } catch(e) {
            console.error('Lỗi khi gọi aoW setState:', e);
          }
        }

        // 2. Phát socket realtime
        if (window.$.bj && typeof window.$.bj.cn === 'function') {
          try {
            window.$.bj.cn("update_conversation_theme", {
              conversationId: convId,
              theme: selectedTheme
            });
            console.log('⚡ Đã gửi socket update_conversation_theme!');
          } catch(e) {
            console.error('Lỗi phát socket theme:', e);
          }
        }
      }

      // 3. Gửi REST API lưu bền vững vào database (lấy token chính xác từ flutter.authToken)
      try {
        var rawToken = localStorage.getItem('flutter.authToken') || 
                       localStorage.getItem('authToken') || 
                       localStorage.getItem('flutter.token') || 
                       localStorage.getItem('token') || '';
        // Loại bỏ dấu nháy kép nếu SharedPreferences lưu chuỗi dạng JSON ("token_abc")
        var cleanToken = rawToken;
        if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
          cleanToken = cleanToken.slice(1, -1);
        }

        if (cleanToken && convId) {
          fetch('/api/chat/conversations/' + convId + '/theme', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + cleanToken
            },
            body: JSON.stringify({ theme: selectedTheme })
          }).then(function(res) { return res.json(); })
            .then(function(data) { console.log('✅ API theme response:', data); })
            .catch(function(err) { console.error('⚠️ Lỗi API theme:', err); });
        }
      } catch(e) {
        console.error('Lỗi token/fetch:', e);
      }

      closeOverlay();
    });
  });
};
</script>
`;

// Cập nhật timestamp mới nhất
const newTimestamp = Date.now().toString();
console.log(`\n🕒 Timestamp Cache-Busting mới: ${newTimestamp}`);

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');

  // Cập nhật modal script
  if (html.includes('id="messenger-theme-picker-script"')) {
    html = html.replace(/<script id="messenger-theme-picker-script">[\s\S]*?<\/script>/, modernModalScript.trim());
    console.log(`✅ Đã cập nhật modal script trong: ${hf}`);
  } else {
    html = html.replace('</body>', modernModalScript.trim() + '\n</body>');
    console.log(`✅ Đã chèn modal script vào: ${hf}`);
  }

  // Cập nhật timestamp cache-busting trong index.html
  html = html.replace(/\?v=\d+/g, `?v=${newTimestamp}`);
  fs.writeFileSync(hf, html, 'utf8');
});

// Cập nhật timestamp trong flutter_bootstrap.js
const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/\?v=\d+/g, `?v=${newTimestamp}`);
  fs.writeFileSync(bf, bs, 'utf8');
  console.log(`✅ Đã cập nhật timestamp trong: ${bf}`);
});

console.log('\n🌟 ĐÃ HOÀN TẤT BẢN FIX TOÀN DIỆN!');
