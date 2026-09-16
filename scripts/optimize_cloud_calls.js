const fs = require('fs');

console.log('=== FIX TRIỆT ĐỂ LỖI CALL TRÊN CLOUD / RENDER / PAGES.DEV ===');

// 1. TỐI ƯU SOCKET HANDLER (EMIT call_accepted NGAY LẬP TỨC TRONG 0ms)
const socketFiles = [
  'sockets/socketHandler.js',
  'backend/sockets/socketHandler.js'
];

for (const fp of socketFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');

  // Thay đoạn accept_call để emit call_accepted NGAY LẬP TỨC
  const oldAcceptBlockStart = 'console.log(`✅ [accept_call] Callee ${socket.userId} đã nghe máy từ Caller ${callerId} (callerSocketId: ${callerSocketId}, room: ${convId})`);';
  const oldAcceptBlockEnd = 'if (callerId) {\n          io.to(callerId).emit("call_accepted", { calleeInfo: null, isAccepted: true });\n        }\n      }\n    });';

  if (code.includes(oldAcceptBlockStart)) {
    const startIdx = code.indexOf(oldAcceptBlockStart);
    const endIdx = code.indexOf('socket.on("webrtc_signal"', startIdx);

    const newAcceptBlock = `console.log(\`✅ [accept_call] Callee \${socket.userId} đã nghe máy từ Caller \${callerId} (callerSocketId: \${callerSocketId}, room: \${convId})\`);

      const acceptEventData = {
        callerId: callerId,
        calleeId: socket.userId,
        calleeInfo: null,
        isAccepted: true,
        conversationId: convId,
      };

      // ⚡ PHÁT TÍN HIỆU NGAY TỨC THÌ (0ms) - BÊN GỌI DỪNG TÚT TÚT & NỐI THOẠI NGAY LẬP TỨC
      if (callerId) {
        io.to(callerId).emit("call_accepted", acceptEventData);
        if (callerSocketId && callerSocketId !== callerId) {
          io.to(callerSocketId).emit("call_accepted", acceptEventData);
        }
      }
      if (convId) {
        socket.to(convId).emit("call_accepted", acceptEventData);
      }

      // Lấy avatar & fullName async ở background (không block luồng nghe máy)
      prisma.users.findUnique({
        where: { id: socket.userId },
        select: { id: true, fullName: true },
      }).then((callee) => {
        if (callee && callerId) {
          const withInfo = {
            ...acceptEventData,
            calleeInfo: { ...callee, avatar: \`/api/users/\${callee.id}/avatar\` }
          };
          io.to(callerId).emit("call_accepted", withInfo);
        }
      }).catch(() => {});
    });\n\n    `;

    code = code.slice(0, startIdx) + newAcceptBlock + code.slice(endIdx);
    console.log(`✅ [socketHandler] Đã tăng tốc accept_call (0ms) trong: ${fp}`);
  }

  // Tối ưu webrtc_signal đa kênh
  if (code.includes('io.to(targetSocketId).emit("webrtc_signal", signalPayload);') && !code.includes('activeInfo.conversationId')) {
    code = code.replace(
      'io.to(targetSocketId).emit("webrtc_signal", signalPayload);\n      }',
      `io.to(targetSocketId).emit("webrtc_signal", signalPayload);\n      }\n      const activeInfo = activeCalls.get(socket.userId) || (connectedUserId ? activeCalls.get(connectedUserId) : null);\n      if (activeInfo && activeInfo.conversationId) {\n        socket.to(activeInfo.conversationId).emit("webrtc_signal", signalPayload);\n      }`
    );
    console.log(`✅ [socketHandler] Đã thêm multi-channel delivery cho webrtc_signal trong: ${fp}`);
  }

  fs.writeFileSync(fp, code, 'utf8');
}

// 2. DỌN SẠCH CÁC SERVER STUN/TURN CHẾT TRONG MAIN.DART.JS
const mainJsFiles = [
  'public/main.dart.js',
  'flutter_frontend/build/web/main.dart.js',
  'backend/flutter_frontend/build/web/main.dart.js'
];

for (const fp of mainJsFiles) {
  if (!fs.existsSync(fp)) continue;
  let js = fs.readFileSync(fp, 'utf8');

  // Thay thế openrelay.metered.ca bằng các server Google & Cloudflare STUN siêu tốc
  if (js.includes('openrelay.metered.ca')) {
    js = js.replace(/stun:openrelay\.metered\.ca:80/g, 'stun:stun.cloudflare.com:3478');
    js = js.replace(/turn:openrelay\.metered\.ca:80/g, 'stun:stun1.l.google.com:19302');
    js = js.replace(/turn:openrelay\.metered\.ca:443/g, 'stun:stun2.l.google.com:19302');
    console.log(`✅ [main.dart.js] Đã loại bỏ server chết openrelay.metered.ca trong: ${fp}`);
  }

  fs.writeFileSync(fp, js, 'utf8');
}

// 3. CẬP NHẬT CHAT_SCREEN.DART
const dartFiles = [
  'flutter_frontend/lib/screens/chat_screen.dart',
  'backend/flutter_frontend/lib/screens/chat_screen.dart'
];

for (const fp of dartFiles) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes('openrelay.metered.ca')) {
    code = code.replace(/'urls': 'stun:openrelay\.metered\.ca:80'/g, "'urls': 'stun:stun.cloudflare.com:3478'");
    code = code.replace(/'urls': 'turn:openrelay\.metered\.ca:80'[\s\S]*?'credential': 'openrelayproject'\s*\}/g, "{'urls': 'stun:stun1.l.google.com:19302'}");
    code = code.replace(/'urls': 'turn:openrelay\.metered\.ca:443'[\s\S]*?'credential': 'openrelayproject'\s*\}/g, "{'urls': 'stun:stun2.l.google.com:19302'}");
    console.log(`✅ [chat_screen.dart] Đã cập nhật STUN sạch trong: ${fp}`);
  }
  fs.writeFileSync(fp, code, 'utf8');
}

console.log('=== HOÀN TẤT OPTIMIZE CALL CLOUD/PAGES.DEV ===');
