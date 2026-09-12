const fs = require('fs');
const path = require('path');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Bắt đầu patch theme vào: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Thêm constructor A.atThemePicker và prototype
  if (!js.includes('atThemePicker:function')) {
    const classMarker = 'aug:function aug(a,b){this.a=a\nthis.b=b},';
    const classMarkerCrlf = 'aug:function aug(a,b){this.a=a\r\nthis.b=b},';
    const newClass = 'atThemePicker:function atThemePicker(a,b,c){this.a=a;this.b=b;this.c=c},' +
                     'atThemeSocketHandler:function atThemeSocketHandler(){},';

    if (js.includes(classMarkerCrlf)) {
      js = js.replace(classMarkerCrlf, newClass + '\r\n' + classMarkerCrlf);
      console.log('✅ Đã thêm constructor atThemePicker (CRLF)');
    } else if (js.includes(classMarker)) {
      js = js.replace(classMarker, newClass + '\n' + classMarker);
      console.log('✅ Đã thêm constructor atThemePicker (LF)');
    }
  }

  // 2. Thêm prototype cho atThemePicker và atThemeSocketHandler
  if (!js.includes('A.atThemePicker.prototype=')) {
    const protoMarker = 'A.aui.prototype={';
    const newProto = `A.atThemePicker.prototype={
$0(){
  A.b1(this.a,!1).bO(0,null);
  if(window._openMessengerThemePicker){ window._openMessengerThemePicker(this.b.a, this.b.b); }
},
$S:0};
A.atThemeSocketHandler.prototype={
$1(a){
  try {
    var d = a;
    var cid = (d && d.conversationId) || (d && d.h ? d.h(0, 'conversationId') : null);
    var th = (d && d.theme) || (d && d.h ? d.h(0, 'theme') : null);
    if (!cid && typeof a === 'object') {
      for (var k in a) {
        if (a[k] && a[k].conversationId) { cid = a[k].conversationId; th = a[k].theme; }
      }
    }
    console.log('🎨 [Web Socket] conversation_theme_updated:', cid, th);
    if (cid && th) {
      if (!$._convThemes) $._convThemes = {};
      $._convThemes[cid] = th;
      if ($._currentActiveChatConvId === cid) {
        $._currentActiveChatTheme = th;
        if ($._css) { $._css.K(new A.ax1()); }
      }
    }
  } catch(e) { console.error('Error in atThemeSocketHandler:', e); }
},
$S:2};
`;
    js = js.replace(protoMarker, newProto + protoMarker);
    console.log('✅ Đã thêm prototype atThemePicker & atThemeSocketHandler');
  }

  // 3. Khởi tạo hàm lấy Gradient theo Theme $.getThemeGradient()
  if (!js.includes('$.getThemeGradient=')) {
    const getThemeFn = `$.getThemeGradient=function(){
  var th = $._currentActiveChatTheme || 'classic';
  if (!$._themeGradients) {
    try {
      $._themeGradients = {
        classic: B.add,
        sunset: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4294922543), new A.q(4292674678)], t.W), null, null),
        ocean: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4278236379), new A.q(4278223792)], t.W), null, null),
        berry: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4287243143), new A.q(4293476439)], t.W), null, null),
        emerald: new A.eU(B.b5, B.bt, B.aU, A.b([new A.q(4279343502), new A.q(4281929597)], t.W), null, null)
      };
    } catch(e) { return B.add; }
  }
  return $._themeGradients[th] || B.add;
};
`;
    // Chèn sau B.add=new A.eU...
    const bAddMarker = 'B.add=new A.eU(B.b5,B.bt,B.aU,B.afh,null,null)';
    if (js.includes(bAddMarker)) {
      js = js.replace(bAddMarker, bAddMarker + '\n' + getThemeFn);
      console.log('✅ Đã thêm $.getThemeGradient vào sau B.add');
    }
  }

  // 4. Áp dụng Theme Gradient vào bong bóng tin nhắn (thay B.add bằng getThemeGradient)
  const oldBubbleCheck = 'j=k&&!q&&!m?B.add:c';
  const newBubbleCheck = 'j=k&&!q&&!m?($.getThemeGradient?$.getThemeGradient():B.add):c';
  if (js.includes(oldBubbleCheck)) {
    js = js.replace(oldBubbleCheck, newBubbleCheck);
    console.log('✅ Đã thay thế B.add thành $.getThemeGradient() trong trang trí bubble');
  } else if (js.includes(newBubbleCheck)) {
    console.log('ℹ️ Bubble check đã có getThemeGradient');
  }

  // 5. Cập nhật Qr (vào phòng chat thì đọc theme)
  const qrMarker = 'if(c._activeChatConvId!==a.a){c._activeChatConvId=a.a;if(c._tsMsgIds)c._tsMsgIds.clear();c.Q=!1}';
  const qrReplacement = `if(c._activeChatConvId!==a.a){
  c._activeChatConvId=a.a;
  if(c._tsMsgIds)c._tsMsgIds.clear();
  c.Q=!1;
}
$._currentActiveChatConvId=a.a;
if(!$._convThemes)$._convThemes={};
if(a.theme)$._convThemes[a.a]=a.theme;
$._currentActiveChatTheme=$._convThemes[a.a]||'classic';
if(!$._themeSocketRegistered&&$.bj){
  $._themeSocketRegistered=!0;
  $.bj.c6(0,"conversation_theme_updated",new A.atThemeSocketHandler());
}`;

  if (js.includes(qrMarker)) {
    js = js.replace(qrMarker, qrReplacement);
    console.log('✅ Đã cập nhật Qr để đồng bộ theme phòng chat');
  }

  // 6. Thêm nút "Chủ đề đoạn chat" vào Dialog Info (A.awd.prototype.$1)
  // Tạo widget nút Chủ đề có icon palette và viền bo tròn
  const oldDialogButtons = 'A.b([g,B.cY,q,B.cZ,h,B.cY,A.fN(!1,n,!0,A.a5(k,B.anE';
  // Chúng ta tạo 1 nút Theme đặt trước nút Đổi biệt danh
  const themeBtnWidget = `A.fN(!1,n,!0,A.a5(k,new A.fd(B.a7,B.bw,B.p,B.l,null,B.az,null,A.b([new A.aJ(new A.bE8(58210),18,new A.q(4278224127),null,null),B.aT,A.a2("Ch\u1ee7 \u0111\u1ec1 \u0111o\u1ea1n chat",k,k,k,k,k,new A.l(!0,new A.q(4278224127),null,null,null,null,14,B.am,null,null,null,null),k,k,k)],t.p),null),B.h,k,k,new A.ak(B.J0,k,A.dx(B.IO,1),m,k,k,B.t),k,k,k,B.qA,k,k,1/0),k,!0,k,k,k,k,k,k,k,k,k,new A.atThemePicker(a,r,p),k,k,k,k,k),B.cY,`;

  if (js.includes(oldDialogButtons) && !js.includes('new A.atThemePicker')) {
    js = js.replace(oldDialogButtons, 'A.b([g,B.cY,q,B.cZ,h,B.cY,' + themeBtnWidget + 'A.fN(!1,n,!0,A.a5(k,B.anE');
    console.log('✅ Đã chèn nút "Chủ đề đoạn chat" vào Dialog Info');
  } else {
    console.log('ℹ️ Nút Chủ đề trong Dialog Info đã tồn tại hoặc không khớp oldDialogButtons');
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Đã lưu bản vá theme thành công cho ${filePath}`);
});

// 7. Inject hàm UI BottomSheet _openMessengerThemePicker vào index.html (cả public/ và flutter_frontend/web/)
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html')
];

const themePickerScript = `
<script>
// --- CHAT THO-FI: MESSENGER THEME PICKER MODAL ---
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
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(10px);z-index:9999999;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.25s ease;';

  var sheet = document.createElement('div');
  sheet.style.cssText = 'background:#ffffff;width:100%;max-width:440px;border-top-left-radius:24px;border-top-right-radius:24px;padding:16px 20px 24px;box-shadow:0 -12px 35px rgba(0,0,0,0.25);transform:translateY(100%);transition:transform 0.25s cubic-bezier(0.16,1,0.3,1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;';

  var html = '<div style="display:flex;justify-content:center;margin-bottom:12px;"><div style="width:40px;height:4px;background:#E2E8F0;border-radius:2px;"></div></div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
  html += '<h3 style="margin:0;font-size:18px;font-weight:700;color:#0F172A;">Chủ đề đoạn chat</h3>';
  html += '<button id="close-theme-btn" style="border:none;background:#F1F5F9;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#64748B;font-size:16px;font-weight:bold;">✕</button>';
  html += '</div>';
  html += '<p style="margin:0 0 16px;font-size:13px;color:#64748B;">Chọn màu chủ đề để áp dụng ngay lập tức cho cả 2 bên</p>';
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

  // Trigger animation
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

  // Handle theme select
  var rows = sheet.querySelectorAll('.theme-row');
  rows.forEach(function(row) {
    row.addEventListener('click', function() {
      var selectedTheme = this.getAttribute('data-theme');
      console.log('🎯 Đã chọn theme:', selectedTheme, 'cho room:', convId);

      if (window.$) {
        if (!window.$._convThemes) window.$._convThemes = {};
        window.$._convThemes[convId] = selectedTheme;
        window.$._currentActiveChatTheme = selectedTheme;
        if (window.$._css && window.$._css.K) {
          try {
            window.$._css.K(new window.A.ax1());
          } catch(e) {}
        }
        // Emit Socket event
        if (window.$.bj && window.$.bj.cn) {
          try {
            window.$.bj.cn("update_conversation_theme", window.A.V(["conversationId", convId, "theme", selectedTheme], window.t.N, window.t.N));
          } catch(e) {
            console.error('Socket emit error:', e);
          }
        }
      }

      // Call REST API
      try {
        var token = localStorage.getItem('authToken') || '';
        fetch('/api/chat/conversations/' + convId + '/theme', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ theme: selectedTheme })
        }).then(function(res) { return res.json(); })
          .then(function(res) { console.log('✅ API cập nhật theme thành công:', res); })
          .catch(function(err) { console.error('⚠️ Lỗi gọi API theme:', err); });
      } catch(e) {}

      closeOverlay();
    });
  });
};
</script>
`;

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  let html = fs.readFileSync(hf, 'utf8');
  if (!html.includes('window._openMessengerThemePicker')) {
    html = html.replace('</body>', themePickerScript + '\n</body>');
    fs.writeFileSync(hf, html, 'utf8');
    console.log(`✅ Đã chèn modal script vào: ${hf}`);
  } else {
    // Cập nhật lại script mới nhất
    html = html.replace(/<script>[\s\S]*?window\._openMessengerThemePicker[\s\S]*?<\/script>/, themePickerScript);
    fs.writeFileSync(hf, html, 'utf8');
    console.log(`🔄 Đã cập nhật modal script mới nhất vào: ${hf}`);
  }
});

console.log('\n🌟 ĐÃ HOÀN TẤT TẤT CẢ BẢN VÁ CHO THEME (JS & HTML)!');
