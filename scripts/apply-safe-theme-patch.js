const fs = require('fs');
const path = require('path');

const jsFiles = [
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'main.dart.js'),
  path.join(__dirname, '..', 'public', 'main.dart.js'),
  path.join(__dirname, '..', 'backend', 'flutter_frontend', 'build', 'web', 'main.dart.js')
];

jsFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`\n📦 Patching JS file: ${filePath}`);
  let js = fs.readFileSync(filePath, 'utf8');

  // 1. Thêm constructor atThemePicker & atThemeSocketHandler
  if (!js.includes('atThemePicker:function')) {
    const classMarker = 'aug:function aug(a,b){this.a=a\r\nthis.b=b},';
    const classMarkerLf = 'aug:function aug(a,b){this.a=a\nthis.b=b},';
    const newClass = 'atThemePicker:function atThemePicker(a,b){this.a=a;this.b=b},' +
                     'atThemeSocketHandler:function atThemeSocketHandler(){},';

    if (js.includes(classMarker)) {
      js = js.replace(classMarker, newClass + '\r\n' + classMarker);
      console.log('✅ Đã thêm constructor atThemePicker (CRLF)');
    } else if (js.includes(classMarkerLf)) {
      js = js.replace(classMarkerLf, newClass + '\n' + classMarkerLf);
      console.log('✅ Đã thêm constructor atThemePicker (LF)');
    }
  }

  // 2. Thêm atThemePicker vào inheritMany(A.NP, [..., A.atThemePicker, A.aw7, ...])
  if (!js.includes('A.atThemePicker,A.aw7,')) {
    if (js.includes('A.aw7,')) {
      js = js.replace('A.aw7,', 'A.atThemePicker,A.aw7,');
      console.log('✅ Đã thêm A.atThemePicker vào danh sách thừa kế A.NP');
    }
  }

  // 3. Thêm prototype cho atThemePicker & atThemeSocketHandler
  if (!js.includes('A.atThemePicker.prototype=')) {
    const protoMarker = 'A.aui.prototype={';
    const newProto = `A.atThemePicker.prototype={
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

  // 4. Khởi tạo B.atThemeRow ngay sau B.anE
  if (!js.includes('B.atThemeRow=')) {
    const bAnEMarker = 'B.anE=new A.fd(B.a7,B.bw,B.p,B.l,null,B.az,null,B.aih,null)';
    const newThemeRowDef = `B.anE=new A.fd(B.a7,B.bw,B.p,B.l,null,B.az,null,B.aih,null)
B.atThemeIcon=new A.aJ(new A.ax(58378,!1),20,B.o,null,null)
B.atThemeText=new A.ap("Ch\u1ee7 \u0111\u1ec1 \u0111o\u1ea1n chat",null,B.aw8,null,null,null,null,null,null,null,null)
B.atThemeRow=new A.fd(B.a7,B.bw,B.p,B.l,null,B.az,null,A.b(s([B.atThemeIcon,B.aT,B.atThemeText]),t.p),null)`;

    if (js.includes(bAnEMarker)) {
      js = js.replace(bAnEMarker, newThemeRowDef);
      console.log('✅ Đã khởi tạo B.atThemeRow');
    }
  }

  // 5. Hàm lấy Gradient $.getThemeGradient()
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
    const bAddMarker = 'B.add=new A.eU(B.b5,B.bt,B.aU,B.afh,null,null)';
    if (js.includes(bAddMarker)) {
      js = js.replace(bAddMarker, bAddMarker + '\n' + getThemeFn);
      console.log('✅ Đã thêm $.getThemeGradient');
    }
  }

  // 6. Áp dụng Theme Gradient vào bubble decoration
  const oldBubbleCheck = 'j=k&&!q&&!m?B.add:c';
  const newBubbleCheck = 'j=k&&!q&&!m?($.getThemeGradient?$.getThemeGradient():B.add):c';
  if (js.includes(oldBubbleCheck)) {
    js = js.replace(oldBubbleCheck, newBubbleCheck);
    console.log('✅ Đã áp dụng $.getThemeGradient() cho bong bóng tin nhắn');
  }

  // 7. Đồng bộ theme phòng chat và đăng ký socket trong Qr
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
    console.log('✅ Đã cập nhật Qr đồng bộ theme và socket');
  }

  // 8. Chèn nút Chủ đề đoạn chat vào Dialog Info
  const oldDialogChildren = 'A.b([g,B.cY,q,B.cZ,h,B.cY,A.fN(!1,n,!0,A.a5(k,B.anE';
  const themeBtnCall = 'A.fN(!1,n,!0,A.a5(k,B.atThemeRow,B.h,k,k,new A.ak(B.J0,k,A.dx(B.IO,1),m,k,k,B.t),k,k,k,B.qA,k,k,1/0),k,!0,k,k,k,k,k,k,k,k,k,new A.atThemePicker(a,r),k,k,k,k,k),B.cY,';

  if (js.includes(oldDialogChildren) && !js.includes('new A.atThemePicker')) {
    js = js.replace(oldDialogChildren, 'A.b([g,B.cY,q,B.cZ,h,B.cY,' + themeBtnCall + 'A.fN(!1,n,!0,A.a5(k,B.anE');
    console.log('✅ Đã chèn nút Chủ đề đoạn chat vào Dialog Info');
  }

  fs.writeFileSync(filePath, js, 'utf8');
  console.log(`🎉 Hoàn tất vá file JS: ${filePath}`);
});

// 9. Thêm Theme Picker Modal Script vào index.html AN TOÀN (chỉ chèn trước </body>)
const htmlFiles = [
  path.join(__dirname, '..', 'public', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'build', 'web', 'index.html'),
  path.join(__dirname, '..', 'flutter_frontend', 'web', 'index.html')
];

const themeModalSnippet = `
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
        if (window.$.bj && window.$.bj.cn) {
          try {
            window.$.bj.cn("update_conversation_theme", window.A.V(["conversationId", convId, "theme", selectedTheme], window.t.N, window.t.N));
          } catch(e) {
            console.error('Socket emit error:', e);
          }
        }
      }

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
  if (!html.includes('id="messenger-theme-picker-script"')) {
    html = html.replace('</body>', themeModalSnippet + '\n</body>');
    fs.writeFileSync(hf, html, 'utf8');
    console.log(`✅ Đã chèn an toàn modal script vào: ${hf}`);
  }
});

console.log('\n🌟 ĐÃ HOÀN TẤT BẢN VÁ AN TOÀN TUYỆT ĐỐI!');
