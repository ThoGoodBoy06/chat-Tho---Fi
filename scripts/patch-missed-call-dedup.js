const fs = require('fs');
const path = require('path');

console.log(`🚀 BẮT ĐẦU VÁ CHỐNG TRÙNG LẶP CUỘC GỌI NHỠ`);

const targetFiles = [
  path.join(__dirname, '../sockets/socketHandler.js'),
  path.join(__dirname, '../backend/sockets/socketHandler.js'),
];

targetFiles.forEach((file) => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Thêm missedCallDebounceLock và createMissedCallMessage ngay trên global.endCallCore
  const helperCode = `  // 🔒 Map khóa đồng bộ in-memory: Chống race condition khi nhiều event (end_call socket, end_call http, reject_call) chạy song song
  const missedCallDebounceLock = new Map();

  async function createMissedCallMessage({ callerId, targetId, conversationId, callType }) {
    if (!callerId || !targetId) return;

    const now = Date.now();
    const pairKey = [callerId, targetId].sort().join("_");

    // Khóa đồng bộ NGAY LẬP TỨC TRƯỚC KHI AWAIT để triệt tiêu race condition (15 giây)
    const lastTime = missedCallDebounceLock.get(pairKey);
    if (lastTime && (now - lastTime < 15000)) {
      console.log(\`⚠️ [createMissedCall] Đã có cuộc gọi nhỡ trong 15s giữa \${callerId.slice(0,8)} và \${targetId.slice(0,8)}, bỏ qua tạo trùng lặp!\`);
      return;
    }
    missedCallDebounceLock.set(pairKey, now);

    try {
      let convToUse = conversationId;
      if (!convToUse) {
        const c1 = await prisma.conversationMembers.findMany({ where: { userId: callerId } });
        const c2 = await prisma.conversationMembers.findMany({ where: { userId: targetId } });
        const common = c1.find(c => c2.some(cc => cc.conversationId === c.conversationId));
        if (common) convToUse = common.conversationId;
      }

      if (!convToUse) {
        console.warn(\`⚠️ [createMissedCall] Không tìm thấy phòng chat giữa \${callerId} và \${targetId}\`);
        return;
      }

      // Khóa thêm theo convId
      const lastConvTime = missedCallDebounceLock.get(convToUse);
      if (lastConvTime && (now - lastConvTime < 15000)) {
        console.log(\`⚠️ [createMissedCall] Đã có cuộc gọi nhỡ trong 15s cho phòng \${convToUse}, bỏ qua!\`);
        return;
      }
      missedCallDebounceLock.set(convToUse, now);

      // Kiểm tra thêm cả Database
      const recent = await prisma.messages.findFirst({
        where: {
          conversationId: convToUse,
          type: "missed_call",
          senderId: callerId,
          createdAt: { gte: new Date(now - 15000) }
        }
      });

      if (recent) {
        console.log(\`⚠️ [createMissedCall] DB đã có cuộc gọi nhỡ trong 15s, bỏ qua!\`);
        return;
      }

      const contentText = callType === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi nhỡ";
      const missedMsg = await prisma.messages.create({
        data: {
          id: uuidv4(),
          conversationId: convToUse,
          senderId: callerId,
          content: contentText,
          type: "missed_call",
        },
        include: {
          Users: { select: { id: true, fullName: true } }
        }
      });

      const mappedMissed = {
        ...missedMsg,
        Users: missedMsg.Users ? {
          ...missedMsg.Users,
          avatar: \`/api/users/\${missedMsg.Users.id}/avatar\`
        } : null
      };

      io.to(callerId).emit("receive_message", mappedMissed);
      io.to(targetId).emit("receive_message", mappedMissed);
      io.to(convToUse).emit("receive_message", mappedMissed);
      console.log(\`📞 [createMissedCall] Đã tạo 1 tin nhắn "\${contentText}" duy nhất cho phòng \${convToUse}\`);
    } catch (err) {
      console.error("Lỗi createMissedCallMessage:", err);
    }
  }

  // 🌟 Hàm toàn cục hỗ trợ HTTP Fallback khi client cúp máy`;

  if (!code.includes('createMissedCallMessage')) {
    code = code.replace('  // 🌟 Hàm toàn cục hỗ trợ HTTP Fallback khi client cúp máy', helperCode);
    console.log(`  ✅ Đã thêm helper createMissedCallMessage vào ${file}`);
  }

  // 2. Thay thế trong global.endCallCore
  const oldEndCallCoreBlock = `      // Tự động tạo tin nhắn cuộc gọi nhỡ nếu cúp máy trước khi người nghe bấm chấp nhận
      if (!isAccepted && callerId) {
        try {
          let convToUse = finalConvId;
          if (!convToUse) {
            const c1 = await prisma.conversationMembers.findMany({ where: { userId: callerId } });
            const c2 = await prisma.conversationMembers.findMany({ where: { userId: targetId } });
            const common = c1.find(c => c2.some(cc => cc.conversationId === c.conversationId));
            if (common) convToUse = common.conversationId;
          }

          if (convToUse) {
            const recent = await prisma.messages.findFirst({
              where: {
                conversationId: convToUse,
                type: "missed_call",
                senderId: callerId,
                createdAt: { gte: new Date(Date.now() - 10000) }
              }
            });

            if (!recent) {
              const contentText = finalCallType === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi nhỡ";
              const missedMsg = await prisma.messages.create({
                data: {
                  id: uuidv4(),
                  conversationId: convToUse,
                  senderId: callerId,
                  content: contentText,
                  type: "missed_call",
                },
                include: {
                  Users: { select: { id: true, fullName: true } }
                }
              });
              const mappedMissed = {
                ...missedMsg,
                Users: missedMsg.Users ? {
                  ...missedMsg.Users,
                  avatar: \`/api/users/\${missedMsg.Users.id}/avatar\`
                } : null
              };
              io.to(callerId).emit("receive_message", mappedMissed);
              io.to(targetId).emit("receive_message", mappedMissed);
              io.to(convToUse).emit("receive_message", mappedMissed);
              console.log(\`📞 [endCallCore] Đã tạo tin nhắn "\${contentText}" cho phòng \${convToUse}\`);
            }
          }
        } catch (missedErr) {
          console.error("Lỗi tạo cuộc gọi nhỡ trong endCallCore:", missedErr);
        }
      }`;

  const newEndCallCoreBlock = `      // Tự động tạo tin nhắn cuộc gọi nhỡ nếu cúp máy trước khi người nghe bấm chấp nhận
      if (!isAccepted && callerId && targetId) {
        await createMissedCallMessage({ callerId, targetId, conversationId: finalConvId, callType: finalCallType });
      }`;

  if (code.includes(oldEndCallCoreBlock)) {
    code = code.replace(oldEndCallCoreBlock, newEndCallCoreBlock);
    console.log(`  ✅ Đã thay thế logic tạo cuộc gọi nhỡ trong global.endCallCore của ${file}`);
  }

  // 3. Thay thế trong socket.on("reject_call")
  const startRejIdx = code.indexOf('// Xử lý tạo tin nhắn "Cuộc gọi nhỡ" hệ thống');
  if (startRejIdx !== -1) {
    const endRejMarker = 'io.to(callerId).emit("receive_message", mappedMissedCallMsg);\n        }\n      } catch (error) {\n        console.error("Lỗi tạo cuộc gọi nhỡ:", error);\n      }\n    });';
    const endRejIdx = code.indexOf(endRejMarker, startRejIdx);
    if (endRejIdx !== -1) {
      const newRejBlock = `// Xử lý tạo tin nhắn "Cuộc gọi nhỡ" hệ thống
      await createMissedCallMessage({ callerId, targetId: socket.userId, callType });
    });`;
      code = code.slice(0, startRejIdx) + newRejBlock + code.slice(endRejIdx + endRejMarker.length);
      console.log(`  ✅ Đã thay thế logic tạo cuộc gọi nhỡ trong socket.on("reject_call") của ${file}`);
    }
  }

  // 4. Thay thế trong socket.on("end_call")
  const oldEndCallBlock = `        // TẠO TIN NHẮN "CUỘC GỌI NHỠ" KHI CALLER CÚP MÁY TRƯỚC KHI CALLEE BẤM NGHE (CHƯA ACCEPT)
        if (!isAccepted) {
          try {
            let convToUse = conversationId;
            if (!convToUse) {
              const c1 = await prisma.conversationMembers.findMany({ where: { userId: socket.userId } });
              const c2 = await prisma.conversationMembers.findMany({ where: { userId: targetId } });
              const common = c1.find(c => c2.some(cc => cc.conversationId === c.conversationId));
              if (common) convToUse = common.conversationId;
            }

            if (convToUse) {
              const recent = await prisma.messages.findFirst({
                where: {
                  conversationId: convToUse,
                  type: "missed_call",
                  senderId: socket.userId,
                  createdAt: { gte: new Date(Date.now() - 10000) }
                }
              });

              if (!recent) {
                const contentText = callType === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi nhỡ";
                const missedMsg = await prisma.messages.create({
                  data: {
                    id: uuidv4(),
                    conversationId: convToUse,
                    senderId: socket.userId,
                    content: contentText,
                    type: "missed_call",
                  },
                  include: {
                    Users: { select: { id: true, fullName: true } }
                  }
                });
                const mappedMissed = {
                  ...missedMsg,
                  Users: missedMsg.Users ? {
                    ...missedMsg.Users,
                    avatar: \`/api/users/\${missedMsg.Users.id}/avatar\`
                  } : null
                };
                io.to(socket.userId).emit("receive_message", mappedMissed);
                io.to(targetId).emit("receive_message", mappedMissed);
                io.to(convToUse).emit("receive_message", mappedMissed);
                console.log(\`📞 [end_call] Đã tạo tin nhắn "\${contentText}" cho phòng \${convToUse}\`);
              }
            }
          } catch (missedErr) {
            console.error("Lỗi tạo cuộc gọi nhỡ trong end_call:", missedErr);
          }
        }`;

  const newEndCallBlock = `        // TẠO TIN NHẮN "CUỘC GỌI NHỠ" KHI CALLER CÚP MÁY TRƯỚC KHI CALLEE BẤM NGHE (CHƯA ACCEPT)
        if (!isAccepted && targetId) {
          await createMissedCallMessage({ callerId: socket.userId, targetId, conversationId, callType });
        }`;

  if (code.includes(oldEndCallBlock)) {
    code = code.replace(oldEndCallBlock, newEndCallBlock);
    console.log(`  ✅ Đã thay thế logic tạo cuộc gọi nhỡ trong socket.on("end_call") của ${file}`);
  }

  fs.writeFileSync(file, code, 'utf8');
});

console.log(`\n🎉 HOÀN THÀNH VÁ CHỐNG TRÙNG CUỘC GỌI NHỠ!`);
