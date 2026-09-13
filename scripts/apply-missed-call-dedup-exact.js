const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '../sockets/socketHandler.js'),
  path.join(__dirname, '../backend/sockets/socketHandler.js'),
];

targetFiles.forEach((file) => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  // 1. Thay thế trong global.endCallCore (lines 141-192)
  const target1 = `      // Tự động tạo tin nhắn cuộc gọi nhỡ nếu cúp máy trước khi người nghe bấm chấp nhận
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

  const repl1 = `      // Tự động tạo tin nhắn cuộc gọi nhỡ nếu cúp máy trước khi người nghe bấm chấp nhận
      if (!isAccepted && callerId && targetId) {
        await createMissedCallMessage({ callerId, targetId, conversationId: finalConvId, callType: finalCallType });
      }`;

  if (code.includes(target1)) {
    code = code.replace(target1, repl1);
    console.log(`  ✅ [1/3] Đã thay thế logic tạo cuộc gọi nhỡ trong endCallCore (${file})`);
  } else {
    console.log(`  ⚠️ target1 không tìm thấy trong ${file}`);
  }

  // 2. Thay thế trong reject_call (lines 1000-1060)
  const target2 = `      // Xử lý tạo tin nhắn "Cuộc gọi nhỡ" hệ thống
      try {
        const conversations = await prisma.conversationMembers.findMany({
          where: { userId: socket.userId },
        });
        const callerConversations = await prisma.conversationMembers.findMany({
          where: { userId: callerId },
        });
        const commonConv = conversations.find((c) =>
          callerConversations.some(
            (cc) => cc.conversationId === c.conversationId,
          ),
        );

        if (commonConv) {
          // Chặn spam cuộc gọi nhỡ: nếu trong vòng 15 giây qua đã có cuộc gọi nhỡ giữa 2 người thì bỏ qua không tạo trùng
          const recentMissedCall = await prisma.messages.findFirst({
            where: {
              conversationId: commonConv.conversationId,
              type: "missed_call",
              senderId: callerId,
              createdAt: { gte: new Date(Date.now() - 15000) },
            },
          });

          if (recentMissedCall) {
            console.log(\`⚠️ Đã có cuộc gọi nhỡ trong 15s qua cho room \${commonConv.conversationId}, bỏ qua tạo trùng lặp\`);
            return;
          }

          const contentText =
            callType === "video" ? "Cuộc gọi video nhỡ" : "Cuộc gọi nhỡ";
          const missedCallMsg = await prisma.messages.create({
            data: {
              id: uuidv4(),
              conversationId: commonConv.conversationId,
              senderId: callerId, // Người gọi sẽ là người để lại cuộc gọi nhỡ
              content: contentText,
              type: "missed_call",
            },
            include: {
              Users: { select: { id: true, fullName: true } },
            },
          });

          // Map avatar sang URL tĩnh
          const mappedMissedCallMsg = {
            ...missedCallMsg,
            Users: missedCallMsg.Users ? {
              ...missedCallMsg.Users,
              avatar: \`/api/users/\${missedCallMsg.Users.id}/avatar\`
            } : null
          };

          io.to(socket.userId).emit("receive_message", mappedMissedCallMsg);
          io.to(callerId).emit("receive_message", mappedMissedCallMsg);
        }
      } catch (error) {
        console.error("Lỗi tạo cuộc gọi nhỡ:", error);
      }`;

  const repl2 = `      // Xử lý tạo tin nhắn "Cuộc gọi nhỡ" hệ thống
      await createMissedCallMessage({ callerId, targetId: socket.userId, callType });`;

  if (code.includes(target2)) {
    code = code.replace(target2, repl2);
    console.log(`  ✅ [2/3] Đã thay thế logic tạo cuộc gọi nhỡ trong reject_call (${file})`);
  } else {
    console.log(`  ⚠️ target2 không tìm thấy trong ${file}`);
  }

  // 3. Thay thế trong end_call (lines 1154-1205)
  const target3 = `        // TẠO TIN NHẮN "CUỘC GỌI NHỠ" KHI CALLER CÚP MÁY TRƯỚC KHI CALLEE BẤM NGHE (CHƯA ACCEPT)
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

  const repl3 = `        // TẠO TIN NHẮN "CUỘC GỌI NHỠ" KHI CALLER CÚP MÁY TRƯỚC KHI CALLEE BẤM NGHE (CHƯA ACCEPT)
        if (!isAccepted && targetId) {
          await createMissedCallMessage({ callerId: socket.userId, targetId, conversationId, callType });
        }`;

  if (code.includes(target3)) {
    code = code.replace(target3, repl3);
    console.log(`  ✅ [3/3] Đã thay thế logic tạo cuộc gọi nhỡ trong end_call (${file})`);
  } else {
    console.log(`  ⚠️ target3 không tìm thấy trong ${file}`);
  }

  fs.writeFileSync(file, code, 'utf8');
});

console.log(`\n🎉 HOÀN TẤT THAY THẾ CHỐNG TRÙNG LẶP CUỘC GỌI NHỠ!`);
