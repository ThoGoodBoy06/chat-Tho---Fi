const fs = require('fs');
const path = require('path');

console.log('🚀 Đang triển khai tính năng Quản lý Thông báo & Web Push cho iOS...');

const modalHtmlAndJs = `
  <!-- Modal Quản Lý Thông Báo & Web Push iOS -->
  <style>
    #notif-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #notif-modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    #notif-modal-sheet {
      width: 100%;
      max-width: 500px;
      max-height: 88vh;
      background: #ffffff;
      border-top-left-radius: 26px;
      border-top-right-radius: 26px;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.22);
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #notif-modal-overlay.active #notif-modal-sheet {
      transform: translateY(0);
    }
    .notif-drag-bar {
      width: 40px;
      height: 4px;
      background: #cbd5e1;
      border-radius: 2px;
      margin: 12px auto 6px;
    }
    .notif-header {
      padding: 10px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
    }
    .notif-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .notif-header-icon {
      width: 42px;
      height: 42px;
      border-radius: 13px;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 20px;
    }
    .notif-header-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    .notif-header-sub {
      font-size: 12.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .notif-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      border: none;
      font-size: 16px;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .notif-content {
      padding: 18px 20px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .notif-status-box {
      padding: 14px 16px;
      border-radius: 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border: 1px solid transparent;
    }
    .notif-status-box.active {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }
    .notif-status-box.inactive {
      background: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }
    .notif-btn-main {
      width: 100%;
      height: 48px;
      background: #0068ff;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      border: none;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .notif-btn-main:active {
      transform: scale(0.98);
      background: #0056d6;
    }
    .notif-btn-outline {
      width: 100%;
      height: 44px;
      background: transparent;
      color: #0068ff;
      font-size: 14px;
      font-weight: 600;
      border: 1.5px solid #0068ff;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .notif-btn-outline:active {
      background: rgba(0, 104, 255, 0.08);
    }
    .notif-test-row {
      display: flex;
      gap: 10px;
    }
    .notif-test-btn {
      flex: 1;
      height: 42px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }
    .notif-guide-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 12.5px;
    }
    .notif-guide-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .notif-guide-step {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      line-height: 1.35;
      color: #475569;
    }
    .notif-step-badge {
      width: 18px;
      height: 18px;
      background: #0068ff;
      color: #fff;
      border-radius: 50%;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
  </style>

  <div id="notif-modal-overlay">
    <div id="notif-modal-sheet">
      <div class="notif-drag-bar"></div>
      <div class="notif-header">
        <div class="notif-header-left">
          <div class="notif-header-icon">🔔</div>
          <div>
            <div class="notif-header-title">Thông báo & Âm thanh</div>
            <div class="notif-header-sub">Nhận chuông gọi & tin nhắn khi khóa máy</div>
          </div>
        </div>
        <button class="notif-close-btn" onclick="window.closeNotificationModal()">✕</button>
      </div>

      <div class="notif-content">
        <!-- Status Box -->
        <div id="notif-status-box" class="notif-status-box inactive">
          <div style="font-size: 22px;" id="notif-status-icon">⚠️</div>
          <div>
            <div id="notif-status-title" style="font-weight: 700; font-size: 14.5px;">Chưa kích hoạt thông báo</div>
            <div id="notif-status-desc" style="font-size: 12.5px; margin-top: 2px;">
              Bấm nút bên dưới để bật chuông cuộc gọi và tin nhắn khi thoát app.
            </div>
          </div>
        </div>

        <!-- Button Kích hoạt -->
        <button id="notif-activate-btn" class="notif-btn-main" onclick="window.handleActivateNotificationClick()">
          <span id="notif-activate-icon">🔔</span>
          <span id="notif-activate-text">Bật thông báo trên thiết bị này</span>
        </button>

        <!-- Button Gửi Test Push -->
        <button id="notif-test-push-btn" class="notif-btn-outline" onclick="window.handleTestPushClick()">
          <span>📲</span> Gửi thông báo đẩy thử nghiệm (Test Push)
        </button>

        <!-- Hàng nút Test Âm thanh & Rung -->
        <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-top: 4px;">
          KIỂM TRA ÂM THANH & RUNG
        </div>
        <div class="notif-test-row">
          <button id="notif-test-call-btn" class="notif-test-btn" onclick="window.handleToggleTestCallSound()">
            <span id="notif-test-call-icon">📞</span>
            <span id="notif-test-call-text">Thử chuông gọi</span>
          </button>
          <button class="notif-test-btn" onclick="window.handleTestMessageSound()">
            <span>💬</span> Thử âm tin nhắn
          </button>
        </div>

        <!-- Hướng dẫn iOS -->
        <div class="notif-guide-card">
          <div class="notif-guide-title">
            <span>🍎</span> Hướng dẫn quan trọng cho iPhone / iOS
          </div>
          <div class="notif-guide-step">
            <div class="notif-step-badge">1</div>
            <div>Mở bằng <b>Safari</b> trên iPhone (chỉ Safari hỗ trợ Web Push).</div>
          </div>
          <div class="notif-guide-step">
            <div class="notif-step-badge">2</div>
            <div>Bấm nút <b>Chia sẻ (⎋)</b> ở thanh dưới ➔ Chọn <b>"Thêm vào MH chính"</b>.</div>
          </div>
          <div class="notif-guide-step">
            <div class="notif-step-badge">3</div>
            <div>Mở app từ Màn hình chính và bấm nút <b>"Bật thông báo"</b> ở trên.</div>
          </div>
          <div class="notif-guide-step">
            <div class="notif-step-badge">4</div>
            <div>Vào <b>Cài đặt iPhone ➔ Thông báo ➔ Chat Tho-Fi</b> ➔ Bật Màn hình khóa, Biểu ngữ & Âm thanh.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let _testRingtoneAudio = null;
    let _testVibrationInterval = null;

    window.showNotificationModal = function() {
      const overlay = document.getElementById('notif-modal-overlay');
      if (!overlay) return;
      window.updateNotificationModalState();
      overlay.classList.add('active');
    };

    window.closeNotificationModal = function() {
      const overlay = document.getElementById('notif-modal-overlay');
      if (overlay) overlay.classList.remove('active');
      window.stopTestCallSound();
    };

    // Đóng khi bấm ra ngoài vùng đen
    document.addEventListener('click', function(e) {
      const overlay = document.getElementById('notif-modal-overlay');
      if (overlay && e.target === overlay) {
        window.closeNotificationModal();
      }
    });

    window.updateNotificationModalState = function() {
      const isGranted = ('Notification' in window) && (Notification.permission === 'granted');
      const statusBox = document.getElementById('notif-status-box');
      const statusIcon = document.getElementById('notif-status-icon');
      const statusTitle = document.getElementById('notif-status-title');
      const statusDesc = document.getElementById('notif-status-desc');
      const btnText = document.getElementById('notif-activate-text');

      if (isGranted) {
        if (statusBox) {
          statusBox.className = 'notif-status-box active';
          statusIcon.textContent = '✅';
          statusTitle.textContent = 'Thông báo đang BẬT';
          statusDesc.textContent = 'Thiết bị này đã sẵn sàng nhận chuông cuộc gọi & tin nhắn khi bạn khóa màn hình hoặc ra ngoài.';
        }
        if (btnText) btnText.textContent = 'Cập nhật lại quyền thông báo';
      } else {
        if (statusBox) {
          statusBox.className = 'notif-status-box inactive';
          statusIcon.textContent = '⚠️';
          statusTitle.textContent = 'Thông báo CHƯA BẬT';
          statusDesc.textContent = 'Vui lòng bấm nút bên dưới để cấp quyền nhận cuộc gọi và tin nhắn khi thoát app.';
        }
        if (btnText) btnText.textContent = 'Bật thông báo trên thiết bị này';
      }
    };

    window.handleActivateNotificationClick = async function() {
      const btn = document.getElementById('notif-activate-btn');
      const btnText = document.getElementById('notif-activate-text');
      const originalText = btnText ? btnText.textContent : '';

      try {
        if (btnText) btnText.textContent = 'Đang kích hoạt...';
        if (btn) btn.disabled = true;

        if (!('Notification' in window)) {
          alert('Trình duyệt hiện tại chưa hỗ trợ Web Push. Nếu bạn dùng iPhone, hãy bấm nút Chia sẻ (⎋) -> "Thêm vào MH chính" rồi mở từ màn hình chính!');
          return;
        }

        // Kích hoạt ngay trong User Gesture context của click này
        const token = await window.registerFCMAndGetToken();

        if (token) {
          // Lưu token lên server
          const authToken = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken');
          const deviceId = window.getWebDeviceId ? window.getWebDeviceId() : 'web_device';

          if (authToken) {
            await fetch('/api/users/fcm-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken.replace(/"/g, '')
              },
              body: JSON.stringify({
                fcmToken: token,
                platform: 'web',
                deviceId: deviceId
              })
            }).catch(e => console.warn('Lưu fcm-token lỗi:', e));
          }

          window.updateNotificationModalState();
          alert('🎉 Đã bật thông báo thành công! Bây giờ bạn có thể thử khóa màn hình hoặc thoát ra ngoài màn hình chính để kiểm tra.');
        } else {
          window.updateNotificationModalState();
          alert('⚠️ Chưa thể kích hoạt thông báo. Nếu bạn đang dùng iPhone, hãy chắc chắn rằng bạn đã "Thêm vào MH chính" bằng Safari và mở ứng dụng từ màn hình chính!');
        }
      } catch (err) {
        console.error('Lỗi kích hoạt:', err);
        alert('Lỗi kích hoạt thông báo: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = originalText;
      }
    };

    window.handleTestPushClick = async function() {
      const btn = document.getElementById('notif-test-push-btn');
      const originalHtml = btn ? btn.innerHTML : '';
      try {
        if (btn) {
          btn.innerHTML = '<span>⏳</span> Đang gửi thông báo...';
          btn.disabled = true;
        }

        const authToken = localStorage.getItem('flutter.authToken') || localStorage.getItem('authToken');
        if (!authToken) {
          alert('Bạn cần đăng nhập để gửi thông báo thử nghiệm.');
          return;
        }

        const res = await fetch('/api/users/test-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken.replace(/"/g, '')
          }
        });
        const data = await res.json();

        if (data.success) {
          alert('🔔 Đã bắn thông báo thử nghiệm! Bạn hãy thử khóa màn hình điện thoại hoặc thoát ra ngoài màn hình chính để kiểm tra.');
        } else {
          alert('⚠️ Gửi thông báo test thất bại: ' + (data.message || 'Chưa đăng ký thiết bị'));
        }
      } catch (err) {
        alert('Lỗi gửi thông báo: ' + err.message);
      } finally {
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }
      }
    };

    window.handleToggleTestCallSound = function() {
      const btnText = document.getElementById('notif-test-call-text');
      const btnIcon = document.getElementById('notif-test-call-icon');
      const btn = document.getElementById('notif-test-call-btn');

      if (_testRingtoneAudio && !_testRingtoneAudio.paused) {
        window.stopTestCallSound();
      } else {
        try {
          if (!_testRingtoneAudio) {
            _testRingtoneAudio = new Audio('/ringtone.mp3');
            _testRingtoneAudio.loop = true;
          }
          _testRingtoneAudio.currentTime = 0;
          _testRingtoneAudio.play().catch(() => {});

          // Rung chu kỳ 1000ms rung, 500ms nghỉ
          if (navigator.vibrate) {
            navigator.vibrate([1000, 500, 1000, 500]);
            clearInterval(_testVibrationInterval);
            _testVibrationInterval = setInterval(() => {
              if (_testRingtoneAudio && !_testRingtoneAudio.paused) {
                navigator.vibrate([1000, 500]);
              } else {
                clearInterval(_testVibrationInterval);
              }
            }, 1500);
          }

          if (btnText) btnText.textContent = 'Dừng chuông';
          if (btnIcon) btnIcon.textContent = '⏹️';
          if (btn) btn.style.background = '#fee2e2';
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.stopTestCallSound = function() {
      if (_testRingtoneAudio) {
        _testRingtoneAudio.pause();
        _testRingtoneAudio.currentTime = 0;
      }
      clearInterval(_testVibrationInterval);
      if (navigator.vibrate) navigator.vibrate(0);

      const btnText = document.getElementById('notif-test-call-text');
      const btnIcon = document.getElementById('notif-test-call-icon');
      const btn = document.getElementById('notif-test-call-btn');
      if (btnText) btnText.textContent = 'Thử chuông gọi';
      if (btnIcon) btnIcon.textContent = '📞';
      if (btn) btn.style.background = '#f8fafc';
    };

    window.handleTestMessageSound = function() {
      try {
        const audio = new Audio('/amthanhtinnhan.mp3');
        audio.play().catch(() => {});
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
      } catch (e) {
        console.error(e);
      }
    };
  </script>
`;

// 1. Chèn modal vào public/index.html & flutter_frontend/web/index.html
['public/index.html', 'flutter_frontend/web/index.html'].forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Tránh chèn trùng lặp
  if (!content.includes('id="notif-modal-overlay"')) {
    content = content.replace('</body>', `${modalHtmlAndJs}\n</body>`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Đã chèn Notification Modal vào ${relPath}`);
  } else {
    console.log(`ℹ️ ${relPath} đã có Notification Modal`);
  }
});

// 2. Chắp nối onTap của SettingsScreen trong public/main.dart.js & backend/flutter_frontend/build/web/main.dart.js
['public/main.dart.js', 'backend/flutter_frontend/build/web/main.dart.js'].forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  let bundle = fs.readFileSync(filePath, 'utf8');

  const targetRegex = /A\.aEp\.prototype\s*=\s*\{\s*\$0\(\)\s*\{var s=this\.a\.Y\(t\.q\)/;
  const replacement = 'A.aEp.prototype={\\r\\n$0(){if(typeof window.showNotificationModal==="function"){window.showNotificationModal();return}var s=this.a.Y(t.q)';

  if (targetRegex.test(bundle)) {
    bundle = bundle.replace(targetRegex, replacement);
    fs.writeFileSync(filePath, bundle, 'utf8');
    console.log(`✅ Đã kết nối nút Cài đặt Thông báo tới Notification Modal trong ${relPath}`);
  } else if (bundle.includes('if(typeof window.showNotificationModal==="function")')) {
    console.log(`ℹ️ ${relPath} đã được kết nối tới Notification Modal`);
  } else {
    console.warn(`⚠️ Không tìm thấy targetPattern trong ${relPath}`);
  }
});

console.log('🎯 Hoàn tất triển khai tính năng Quản lý Thông báo cho iOS!');
