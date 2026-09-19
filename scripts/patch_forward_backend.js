const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'controllers', 'chat.controller.js'),
  path.join(__dirname, '..', 'backend', 'controllers', 'chat.controller.js')
];

const newForwardFunc = `exports.forwardMessage = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { messageId, messageIds, conversationIds } = req.body;

        const targetMessageIds = Array.isArray(messageIds) && messageIds.length > 0
            ? messageIds
            : (messageId ? [messageId] : []);

        if (targetMessageIds.length === 0 || !conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin tin nhắn hoặc danh sách hội thoại." });
        }

        // Lấy danh sách tin nhắn gốc cần forward (không lấy tin nhắn đã thu hồi)
        const originalMessages = await prisma.messages.findMany({
            where: {
                id: { in: targetMessageIds },
                isRecalled: false,
            },
            orderBy: { createdAt: "asc" },
        });

        if (!originalMessages || originalMessages.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn gốc hoặc tin nhắn đã bị thu hồi." });
        }

        const { v4: uuidv4 } = require("uuid");
        const io = req.app.get("io");
        const forwardedMessages = [];

        for (const convId of conversationIds) {
            // Lấy danh sách thành viên phòng nhận
            let convMembers = [];
            if (io) {
                convMembers = await prisma.conversationMembers.findMany({
                    where: { conversationId: convId },
                    select: { userId: true },
                });
            }

            for (const origMsg of originalMessages) {
                const isImage = origMsg.type === "image" || (origMsg.imageUrl && origMsg.imageUrl.trim() !== "");
                const isVideo = origMsg.type === "video" || (origMsg.videoUrl && origMsg.videoUrl.trim() !== "");
                const contentUrl = origMsg.content;

                const newMsg = await prisma.messages.create({
                    data: {
                        id: uuidv4(),
                        conversationId: convId,
                        senderId: userId,
                        content: origMsg.content,
                        type: origMsg.type || "text",
                        imageUrl: isImage ? (origMsg.imageUrl || contentUrl) : null,
                        videoUrl: isVideo ? (origMsg.videoUrl || contentUrl) : null,
                        audioUrl: origMsg.audioUrl || null,
                        fileUrl: origMsg.fileUrl || null,
                        isForwarded: true, // 🌟 Đánh dấu tin nhắn chuyển tiếp
                        isRead: false,
                        isDelivered: true,
                    },
                    include: { Users: { select: { id: true, fullName: true } } },
                });

                const mapped = {
                    ...newMsg,
                    imageUrl: isImage ? (newMsg.imageUrl || newMsg.content) : null,
                    videoUrl: isVideo ? (newMsg.videoUrl || newMsg.content) : null,
                    Users: newMsg.Users ? { ...newMsg.Users, avatar: \`/api/users/\${newMsg.Users.id}/avatar\` } : null,
                };

                forwardedMessages.push(mapped);

                // Phát socket event đến phòng nhận và từng thành viên
                if (io) {
                    io.to(convId).emit("receive_message", mapped);
                    convMembers.forEach((member) => {
                        io.to(member.userId).emit("receive_message", mapped);
                    });
                }
            }

            // Cập nhật thời gian cuộc trò chuyện
            try {
                await prisma.conversations.update({
                    where: { id: convId },
                    data: { updatedAt: new Date() },
                });
            } catch (e) {}
        }

        res.status(201).json({
            success: true,
            data: forwardedMessages,
            message: \`Đã chuyển tiếp \${originalMessages.length} tin nhắn tới \${conversationIds.length} cuộc hội thoại.\`,
        });
    } catch (error) {
        console.error("❌ Lỗi khi chuyển tiếp tin nhắn:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};`;

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Replace any forwardMessage block matching either old or new format
  const regex = /exports\.forwardMessage\s*=\s*async\s*\([^\)]*\)\s*=>\s*\{[\s\S]*?(?:res\.status\(201\)\.json\([\s\S]*?\}\);\s*\}\s*catch\s*\(error\)\s*\{[\s\S]*?\}\s*\};)/g;
  
  let count = 0;
  content = content.replace(regex, () => {
    count++;
    return newForwardFunc;
  });

  console.log(`File: ${file} - Replaced ${count} occurrence(s)`);
  fs.writeFileSync(file, content, 'utf8');
});

console.log('✅ Hoàn tất cập nhật tất cả forwardMessage!');
