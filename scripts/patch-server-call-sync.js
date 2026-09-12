const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'sockets', 'socketHandler.js'),
  path.join(__dirname, '..', 'backend', 'sockets', 'socketHandler.js'),
];

files.forEach((file) => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  const isCRLF = content.includes('\r\n');
  let norm = content.replace(/\r\n/g, '\n');

  // 1. Thêm activeCalls map
  const targetMap = `  // Cache để tránh gọi DB update isOnline liên tục trong thời gian ngắn (Debounce 60 giây)\n  const lastOnlineUpdateMap = new Map();`;
  const newMap = `  // Cache để tránh gọi DB update isOnline liên tục trong thời gian ngắn (Debounce 60 giây)\n  const lastOnlineUpdateMap = new Map();\n  // Lưu các cặp cuộc gọi đang diễn ra để tự động tắt cả 2 bên nếu 1 bên cúp máy hoặc mất mạng\n  const activeCalls = new Map();`;

  if (norm.includes(targetMap) && !norm.includes('const activeCalls = new Map();')) {
    norm = norm.replace(targetMap, newMap);
  }

  // 2. Ghi nhận activeCalls khi request_call thành công
  const targetReq = `        if (isCalleeOnline) {\n          console.log(\`📞 \${callerName} đang gọi cho \${calleeId}\`);`;
  const newReq = `        if (isCalleeOnline) {\n          console.log(\`📞 \${callerName} đang gọi cho \${calleeId}\`);\n          activeCalls.set(callerId, { partnerId: calleeId });\n          activeCalls.set(calleeId, { partnerId: callerId });`;

  if (norm.includes(targetReq) && !norm.includes('activeCalls.set(calleeId, { partnerId: callerId });')) {
    norm = norm.replace(targetReq, newReq);
  }

  // 3. Xóa activeCalls khi reject_call
  const targetRej = `    socket.on("reject_call", async ({ callerId, callType }) => {\n      io.to(callerId).emit("call_rejected", { reason: "rejected" });`;
  const newRej = `    socket.on("reject_call", async ({ callerId, callType }) => {\n      activeCalls.delete(callerId);\n      activeCalls.delete(socket.userId);\n      io.to(callerId).emit("call_rejected", { reason: "rejected" });`;

  if (norm.includes(targetRej) && !norm.includes('activeCalls.delete(callerId);')) {
    norm = norm.replace(targetRej, newRej);
  }

  // 4. Cập nhật activeCalls khi accept_call
  const targetAcc = `    socket.on("accept_call", async ({ callerId }) => {`;
  const newAcc = `    socket.on("accept_call", async ({ callerId }) => {\n      activeCalls.set(socket.userId, { partnerId: callerId });\n      activeCalls.set(callerId, { partnerId: socket.userId });`;

  if (norm.includes(targetAcc) && !norm.includes('activeCalls.set(socket.userId, { partnerId: callerId });')) {
    norm = norm.replace(targetAcc, newAcc);
  }

  // 5. Cải tiến end_call
  const targetEnd = `    // 9. Kết thúc cuộc gọi (gửi thông báo cho cả 2 phía để tự động đóng màn hình)
    socket.on("end_call", (data = {}) => {
      const targetId = data.connectedUserId || data.to || data.targetUserId || data.userId;
      const conversationId = data.conversationId;
      console.log(\`🔴 [end_call] Tắt cuộc gọi từ user \${socket.userId} -> partner \${targetId}, room \${conversationId}\`);

      if (targetId) {
        io.to(targetId).emit("call_ended");
      }
      if (conversationId) {
        io.to(conversationId).emit("call_ended");
      }
      if (socket.userId) {
        io.to(socket.userId).emit("call_ended");
      }
    });`;

  const newEnd = `    // 9. Kết thúc cuộc gọi (gửi thông báo cho cả 2 phía để tự động đóng màn hình)
    socket.on("end_call", (data = {}) => {
      const activeInfo = activeCalls.get(socket.userId);
      const targetId = data.connectedUserId || data.to || data.targetUserId || data.userId || activeInfo?.partnerId;
      const conversationId = data.conversationId || activeInfo?.conversationId;
      console.log(\`🔴 [end_call] Tắt cuộc gọi từ user \${socket.userId} -> partner \${targetId}, room \${conversationId}\`);

      if (targetId) {
        io.to(targetId).emit("call_ended");
        activeCalls.delete(targetId);
      }
      if (conversationId) {
        io.to(conversationId).emit("call_ended");
      }
      if (socket.userId) {
        io.to(socket.userId).emit("call_ended");
        activeCalls.delete(socket.userId);
      }
    });`;

  if (norm.includes(targetEnd)) {
    norm = norm.replace(targetEnd, newEnd);
  }

  // 6. Thêm xử lý disconnect
  const targetDisc = `  io.on("connection", async (socket) => {`;
  const newDisc = `  io.on("connection", async (socket) => {
    socket.on("disconnect", () => {
      if (socket.userId) {
        const activeInfo = activeCalls.get(socket.userId);
        if (activeInfo && activeInfo.partnerId) {
          console.log(\`🔴 [disconnect] User \${socket.userId} ngắt kết nối khi đang gọi -> Tự động kết thúc cuộc gọi cho \${activeInfo.partnerId}\`);
          io.to(activeInfo.partnerId).emit("call_ended");
          activeCalls.delete(activeInfo.partnerId);
          activeCalls.delete(socket.userId);
        }
      }
    });`;

  if (norm.includes(targetDisc) && !norm.includes('socket.on("disconnect"')) {
    norm = norm.replace(targetDisc, newDisc);
  }

  const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
  fs.writeFileSync(file, result, 'utf8');
  console.log('✅ Đã cập nhật thành công:', file);
});

console.log('🎉 Hoàn tất vá socketHandler!');
