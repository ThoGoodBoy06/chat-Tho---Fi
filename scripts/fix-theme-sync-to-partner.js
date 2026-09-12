const fs = require('fs');
const path = require('path');

console.log('🚀 BẮT ĐẦU FIX TRIỆT ĐỂ: ĐỒNG BỘ CHỦ ĐỀ CHO ĐỐI PHƯƠNG (CẢ REALTIME VÀ RELOAD)...');

// =========================================================================
// 1. VÁ MAIN.DART.JS
// =========================================================================
const jsFiles = [
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Xử lý JS: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // A. Đọc theme trong ConversationModel.fromJson
  const targetReturn = 'return new A.fo(c0,k,j,s,a4,q,c1.h(c2,b9)!=null?A.a9d(J.ai(c1.h(c2,b9))):a6,a,h)';
  const replacementReturn = 'var _th=c1.h(c2,"theme");var _parsedTh=(_th==null?null:J.ai(_th))||"classic";var _conv=new A.fo(c0,k,j,s,a4,q,c1.h(c2,b9)!=null?A.a9d(J.ai(c1.h(c2,b9))):a6,a,h);_conv.theme=_parsedTh;if(!$._convThemes)$._convThemes={};if(c0){$._convThemes[c0]=_parsedTh;if(typeof localStorage!=="undefined")localStorage.setItem("chat_theme_"+c0,_parsedTh);}return _conv';

  if (js.includes(targetReturn) && !js.includes('_conv.theme=_parsedTh')) {
    js = js.replace(targetReturn, replacementReturn);
    console.log('✅ Đã chèn giải mã theme trong ConversationModel.fromJson');
  }

  // B. Đăng ký lắng nghe conversation_theme_updated ngay khi Socket kết nối (cạnh receive_message)
  const targetSocketReg = 'a0=$.bj\nif(a0!=null)a0.c6(0,"receive_message",new A.anP())';
  const targetSocketRegCrlf = 'a0=$.bj\r\nif(a0!=null)a0.c6(0,"receive_message",new A.anP())';
  const newSocketReg = 'a0=$.bj\nif(a0!=null)a0.c6(0,"receive_message",new A.anP())\nif(a0!=null)a0.c6(0,"conversation_theme_updated",new A.atThemeSocketHandler())';

  if (js.includes(targetSocketReg) && !js.includes('a0.c6(0,"conversation_theme_updated"')) {
    js = js.replace(targetSocketReg, newSocketReg);
    console.log('✅ Đã đăng ký lắng nghe conversation_theme_updated ngay khi socket khởi tạo (LF)');
  } else if (js.includes(targetSocketRegCrlf) && !js.includes('a0.c6(0,"conversation_theme_updated"')) {
    js = js.replace(targetSocketRegCrlf, newSocketReg);
    console.log('✅ Đã đăng ký lắng nghe conversation_theme_updated ngay khi socket khởi tạo (CRLF)');
  }

  fs.writeFileSync(filePath, js, 'utf8');
});

// =========================================================================
// 2. CẬP NHẬT SOCKET HANDLER (sockets/socketHandler.js & backend)
// =========================================================================
const socketFiles = [
  path.join(__dirname, '..', 'sockets', 'socketHandler.js'),
  path.join(__dirname, '..', 'backend', 'sockets', 'socketHandler.js')
];

socketFiles.forEach(sf => {
  if (!fs.existsSync(sf)) return;
  console.log(`\n🔌 Cập nhật Socket Handler: ${sf}`);
  let sCode = fs.readFileSync(sf, 'utf8');

  // Đảm bảo broadcast tới conversationId VÀ từng userId thành viên
  const oldBroadcastTheme = `        io.to(conversationId).emit("conversation_theme_updated", {
          conversationId,
          theme: themeToSet,
        });
        console.log(\`🎨 Phòng chat \${conversationId} đã đổi chủ đề sang: \${themeToSet}\`);`;

  const newBroadcastTheme = `        // 1. Phát tới room cuộc trò chuyện
        io.to(conversationId).emit("conversation_theme_updated", {
          conversationId,
          theme: themeToSet,
        });
        console.log(\`🎨 Phòng chat \${conversationId} đã đổi chủ đề sang: \${themeToSet}\`);

        // 2. Phát trực tiếp tới từng thành viên (để đối phương nhận ngay cả khi đang ở danh sách chat)
        try {
          const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true },
          });
          members.forEach((m) => {
            io.to(m.userId).emit("conversation_theme_updated", {
              conversationId,
              theme: themeToSet,
            });
          });
        } catch(mErr) {
          console.error("Lỗi broadcast theme tới members:", mErr.message);
        }`;

  if (sCode.includes(oldBroadcastTheme) && !sCode.includes('members.forEach((m)')) {
    sCode = sCode.replace(oldBroadcastTheme, newBroadcastTheme);
    fs.writeFileSync(sf, sCode, 'utf8');
    console.log('✅ Đã thêm broadcast tới từng thành viên trong socketHandler');
  }
});

// =========================================================================
// 3. CẬP NHẬT INDEX.HTML
// =========================================================================
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'index.html')
];

const definitiveThemeModalScript = `<script id="messenger-theme-picker-script">
window._openMessengerThemePicker = function(convId, convName) {
  var oldOverlay = document.getElementById('messenger-theme-picker-overlay');
  if (oldOverlay) oldOverlay.remove();

  // Đảm bảo luôn lấy được convId chính xác
  if (!convId && window.$ && window.$._currentActiveChatConvId) {
    convId = window.$._currentActiveChatConvId;
  }
  if (!convId && window.$ && window.$._activeChatScreenState && window.$._activeChatScreenState._activeChatConvId) {
    convId = window.$._activeChatScreenState._activeChatConvId;
  }
  if (!convId && typeof localStorage !== 'undefined') {
    convId = localStorage.getItem('last_active_conv_id') || '';
  }

  var themes = [
    { id: 'classic', name: 'Mặc định (Classic)', color1: '#0084FF', color2: '#0068FF' },
    { id: 'sunset', name: 'Hoàng hôn (Sunset)', color1: '#FF512F', color2: '#DD2476' },
    { id: 'ocean', name: 'Đại dương (Ocean)', color1: '#00B4DB', color2: '#0083B0' },
    { id: 'berry', name: 'Quả mọng (Berry)', color1: '#8A2387', color2: '#E94057' },
    { id: 'emerald', name: 'Ngọc bích (Emerald)', color1: '#11998E', color2: '#38EF7D' }
  ];

  // 1. Xác định currentTheme chuẩn xác
  var savedLocal = (convId && localStorage.getItem('chat_theme_' + convId)) || localStorage.getItem('chat_current_theme');
  var currentTheme = (window.$ && window.$._convThemes && window.$._convThemes[convId]) ||
                     (window.$ && window.$._currentActiveChatTheme) ||
                     savedLocal ||
                     'classic';
  if (currentTheme === 'default' || !currentTheme) currentTheme = 'classic';
  console.log('🔍 [Theme Modal] convId:', convId, 'currentTheme:', currentTheme);

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
  html += '<p style="margin:0 0 16px;font-size:13px;color:#64748B;">Chọn màu chủ đề để áp dụng ngay lập tức cho cả hai bên</p>';
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
      console.log('🎯 [Client] Chọn theme:', selectedTheme, 'cho conversationId:', convId);

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
        if (window.$._activeChatScreenState) {
          window.$._activeChatScreenState.Q = false; // Đảm bảo đóng emoji
          if (typeof window.$._activeChatScreenState.K === 'function' && window.A && window.A.ax1) {
            try {
              window.$._activeChatScreenState.K(new window.A.ax1());
            } catch(e) {}
          }
        }
      }

      // 3. Phát socket realtime cho cả hai bên
      var socketPayload = null;
      if (window.A && typeof window.A.V === 'function' && window.t && window.t.N) {
        try {
          socketPayload = window.A.V(["conversationId", convId, "theme", selectedTheme], window.t.N, window.t.N);
        } catch(e) {}
      }
      if (!socketPayload) {
        socketPayload = { conversationId: convId, theme: selectedTheme };
      }

      if (window.$ && window.$.bj && typeof window.$.bj.cn === 'function') {
        try {
          window.$.bj.cn("update_conversation_theme", socketPayload);
          console.log('⚡ [Client] Đã phát socket update_conversation_theme thành công!');
        } catch(e) {
          console.error('Lỗi phát socket theme:', e);
        }
      }

      // 4. Gửi REST API lưu bền vững vào database
      try {
        var rawToken = localStorage.getItem('flutter.authToken') || 
                       localStorage.getItem('authToken') || 
                       localStorage.getItem('flutter.token') || 
                       localStorage.getItem('token') || '';
        var cleanToken = rawToken;
        try {
          cleanToken = JSON.parse(rawToken);
        } catch(e) {
          if (cleanToken.startsWith('"') && cleanToken.endsWith('"')) {
            cleanToken = cleanToken.slice(1, -1);
          }
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
  console.log(`\n📄 Cập nhật HTML: ${hf}`);
  let html = fs.readFileSync(hf, 'utf8');

  const scriptRegex = /<script id="messenger-theme-picker-script">[\s\S]*?<\/script>/;
  if (scriptRegex.test(html)) {
    html = html.replace(scriptRegex, definitiveThemeModalScript);
  } else {
    html = html.replace('</body>', definitiveThemeModalScript + '\n</body>');
  }

  fs.writeFileSync(hf, html, 'utf8');
});

// Nâng timestamp cache-busting
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

console.log('\n🎉 HOÀN TẤT ĐỒNG BỘ CHỦ ĐỀ CHO ĐỐI PHƯƠNG!');
