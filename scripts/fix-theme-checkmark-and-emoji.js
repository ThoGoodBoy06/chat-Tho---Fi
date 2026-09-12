const fs = require('fs');
const path = require('path');

console.log('🔧 BẮT ĐẦU SỬA TRIỆT ĐỂ 2 LỖI: DẤU TÍCH XANH & TỰ MỞ BẢNG ICON...');

const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý JS file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Export window.$ = $; window.A = A; window.B = B; để index.html có thể truy cập toàn cục
  const dollarDef = 'var w=[A,J,B]\nvar $={}';
  const dollarDefCrlf = 'var w=[A,J,B]\r\nvar $={}';
  const exportGlobals = 'var w=[A,J,B]\nvar $={};if(typeof window!=="undefined"){window.$=$;window.A=A;window.B=B;}';
  
  if (js.includes(dollarDef) && !js.includes('window.$=$')) {
    js = js.replace(dollarDef, exportGlobals);
    console.log('✅ Đã export window.$, window.A, window.B ra toàn cục (LF)');
  } else if (js.includes(dollarDefCrlf) && !js.includes('window.$=$')) {
    js = js.replace(dollarDefCrlf, exportGlobals);
    console.log('✅ Đã export window.$, window.A, window.B ra toàn cục (CRLF)');
  }

  // 2. Sửa A.atThemePicker.prototype: đóng dialog và đảm bảo c.Q = false trước khi mở theme modal
  const oldAtThemePicker = `A.atThemePicker.prototype={
$0(){
  try {
    A.b1(this.a,!1).bO(0,null);
  } catch(e) {}
  var convId = (this.b && this.b.a) ? this.b.a : ($._currentActiveChatConvId || '');
  var convName = (this.b && this.b.b) ? this.b.b : '';
  if (window._openMessengerThemePicker) {
    window._openMessengerThemePicker(convId, convName);
  }
},
$S:0};`;

  const newAtThemePicker = `A.atThemePicker.prototype={
$0(){
  try {
    A.b1(this.a,!1).bO(0,null);
  } catch(e) {}
  if ($._activeChatScreenState) {
    $._activeChatScreenState.Q = !1;
  }
  var convId = (this.b && this.b.a) ? this.b.a : ($._currentActiveChatConvId || '');
  var convName = (this.b && this.b.b) ? this.b.b : '';
  if (window._openMessengerThemePicker) {
    window._openMessengerThemePicker(convId, convName);
  }
},
$S:0};`;

  if (js.includes(oldAtThemePicker)) {
    js = js.replace(oldAtThemePicker, newAtThemePicker);
    console.log('✅ Đã cập nhật atThemePicker prototype (c.Q = false)');
  }

  // 3. Sửa A.atThemeSocketHandler.prototype: THAY THẾ triệt để việc gọi aoW() bằng K(new A.ax1())
  const oldSocketTarget = `        if ($._activeChatScreenState && typeof $._activeChatScreenState.aoW === 'function') {
          try { $._activeChatScreenState.aoW(); } catch(err) {}
        }`;

  const newSocketTarget = `        if ($._activeChatScreenState) {
          $._activeChatScreenState.Q = !1;
          if (typeof $._activeChatScreenState.K === 'function') {
            try { $._activeChatScreenState.K(new A.ax1()); } catch(err) {}
          }
        }`;

  if (js.includes(oldSocketTarget)) {
    js = js.replace(oldSocketTarget, newSocketTarget);
    console.log('✅ Đã thay thế aoW() trong atThemeSocketHandler bằng K(new A.ax1())');
  }

  // 4. Cập nhật Qr để đồng bộ cả localStorage vào $._convThemes và $._currentActiveChatTheme
  const oldQrThemeBlock = `if(!$._convThemes)$._convThemes={};
if(a.theme&&!$._convThemes[a.a])$._convThemes[a.a]=a.theme;
$._currentActiveChatTheme=$._convThemes[a.a]||a.theme||'classic';`;

  const newQrThemeBlock = `if(!$._convThemes)$._convThemes={};
var localTh = (a.a && typeof localStorage !== 'undefined') ? localStorage.getItem('chat_theme_' + a.a) : null;
if (!$._convThemes[a.a]) {
  if (localTh) $._convThemes[a.a] = localTh;
  else if (a.theme) $._convThemes[a.a] = a.theme;
}
$._currentActiveChatTheme = $._convThemes[a.a] || a.theme || localTh || 'classic';
if (a.a && typeof localStorage !== 'undefined' && $._currentActiveChatTheme) {
  localStorage.setItem('chat_theme_' + a.a, $._currentActiveChatTheme);
}`;

  if (js.includes(oldQrThemeBlock)) {
    js = js.replace(oldQrThemeBlock, newQrThemeBlock);
    console.log('✅ Đã cập nhật Qr đồng bộ localStorage');
  }

  fs.writeFileSync(filePath, js, 'utf8');
});

// 5. Cập nhật script Modal trong index.html
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const newThemeModalScript = `<script id="messenger-theme-picker-script">
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

  // 1. Xác định currentTheme chuẩn xác từ nhiều nguồn, ưu tiên theme đã lưu
  var savedLocal = (convId && localStorage.getItem('chat_theme_' + convId)) || localStorage.getItem('chat_current_theme');
  var currentTheme = (window.$ && window.$._convThemes && window.$._convThemes[convId]) ||
                     (window.$ && window.$._currentActiveChatTheme) ||
                     savedLocal ||
                     'classic';
  if (currentTheme === 'default' || !currentTheme) currentTheme = 'classic';
  console.log('🔍 [Theme Modal] currentTheme hiện tại:', currentTheme, 'cho phòng:', convId);

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
    var isSel = (t.id === currentTheme);
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

      // 1. Lưu ngay vào localStorage
      if (convId) {
        localStorage.setItem('chat_theme_' + convId, selectedTheme);
      }
      localStorage.setItem('chat_current_theme', selectedTheme);

      // 2. Cập nhật ngay trên bộ nhớ Dart/JS và kích hoạt Flutter State re-render tức thì
      if (window.$) {
        if (!window.$._convThemes) window.$._convThemes = {};
        if (convId) window.$._convThemes[convId] = selectedTheme;
        window.$._currentActiveChatTheme = selectedTheme;

        // Kích hoạt setState trên Flutter ChatScreen
        // TUYỆT ĐỐI KHÔNG gọi aoW() vì aoW() là toggle Emoji Picker!
        if (window.$._activeChatScreenState) {
          window.$._activeChatScreenState.Q = false; // Đảm bảo đóng bảng icon/emoji
          if (typeof window.$._activeChatScreenState.K === 'function' && window.A && window.A.ax1) {
            try {
              window.$._activeChatScreenState.K(new window.A.ax1());
              console.log('✅ Đã gọi Flutter ChatScreen setState (K) thành công!');
            } catch(e) {
              console.error('Lỗi khi gọi K setState:', e);
            }
          }
        }

        // 3. Phát socket realtime
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

      // 4. Gửi REST API lưu bền vững vào database
      try {
        var rawToken = localStorage.getItem('flutter.authToken') || 
                       localStorage.getItem('authToken') || 
                       localStorage.getItem('flutter.token') || 
                       localStorage.getItem('token') || '';
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
</script>`;

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  console.log(`\n📄 Cập nhật HTML file: ${hf}`);
  let html = fs.readFileSync(hf, 'utf8');

  // Tìm và thay thế khối messenger-theme-picker-script
  const scriptRegex = /<script id="messenger-theme-picker-script">[\s\S]*?<\/script>/;
  if (scriptRegex.test(html)) {
    html = html.replace(scriptRegex, newThemeModalScript);
    console.log('✅ Đã thay thế messenger-theme-picker-script');
  } else {
    // Nếu chưa có id này, tìm thẻ script trước </body>
    html = html.replace('</body>', newThemeModalScript + '\n</body>');
    console.log('✅ Đã chèn mới messenger-theme-picker-script trước </body>');
  }

  fs.writeFileSync(hf, html, 'utf8');
});

// 6. Nâng timestamp cache-busting
const newTs = Date.now().toString();
console.log(`\n🕒 Timestamp mới: ${newTs}`);

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  html = html.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(hf, html, 'utf8');
});

const bootstrapFiles = [
  path.join(__dirname, '..', 'public', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'flutter_bootstrap.js')
];

bootstrapFiles.forEach(bf => {
  if (!fs.existsSync(bf)) return;
  let bs = fs.readFileSync(bf, 'utf8');
  bs = bs.replace(/\?v=\d+/g, `?v=${newTs}`);
  fs.writeFileSync(bf, bs, 'utf8');
});

console.log('\n🎉 HOÀN TẤT VÁ 2 LỖI THEME CHECKMARK VÀ EMOJI PICKER!');
