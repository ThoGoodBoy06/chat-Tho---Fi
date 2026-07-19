const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { v4: uuidv4 } = require("uuid");

// 1. Tạo nhóm mới
exports.createGroup = async (req, res) => {
    try {
        const creatorId = req.user.id;
        const { groupName, userIds } = req.body; // userIds: mảng các id thành viên được chọn (không bao gồm creator)

        if (!groupName || !groupName.trim()) {
            return res.status(400).json({ success: false, message: "Tên nhóm không được để trống." });
        }

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: "Phải chọn ít nhất 1 thành viên để tạo nhóm." });
        }

        const creator = await prisma.users.findUnique({
            where: { id: creatorId },
            select: { fullName: true }
        });
        const creatorName = creator ? creator.fullName : "Người dùng";

        // Lọc trùng ID và loại bỏ creatorId nếu lỡ gửi kèm
        const uniqueUserIds = [...new Set(userIds.filter(id => id !== creatorId))];

        const conversationId = uuidv4();

        // Tạo phòng trò chuyện và các thành viên
        const newConversation = await prisma.conversations.create({
            data: {
                id: conversationId,
                type: "group",
                name: groupName.trim(),
                createdBy: creatorId,
                ConversationMembers: {
                    create: [
                        // Người tạo mặc định là Admin
                        { id: uuidv4(), userId: creatorId, role: "admin" },
                        // Các thành viên khác mặc định là member
                        ...uniqueUserIds.map(id => ({
                            id: uuidv4(),
                            userId: id,
                            role: "member"
                        }))
                    ]
                }
            },
            include: {
                ConversationMembers: {
                    include: {
                        Users: {
                            select: { id: true, fullName: true, avatar: true }
                        }
                    }
                }
            }
        });

        // Tạo tin nhắn hệ thống
        const systemContent = `${creatorName} đã tạo nhóm "${groupName.trim()}".`;
        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId: conversationId,
                senderId: creatorId,
                content: systemContent,
                type: "system"
            }
        });

        // Phát tín hiệu Socket cho tất cả thành viên của nhóm
        const io = req.app.get("io");
        if (io) {
            // Cho tất cả thành viên trong nhóm biết họ đã được vào nhóm mới
            const allMemberIds = [creatorId, ...uniqueUserIds];
            allMemberIds.forEach(memberId => {
                // Gửi sự kiện để tự động load lại danh sách chat bên sidebar
                io.to(memberId).emit("group:created", {
                    conversationId,
                    groupName: groupName.trim(),
                    systemMessage
                });
            });
        }

        res.status(200).json({
            success: true,
            message: "Tạo nhóm thành công.",
            conversation: newConversation,
            systemMessage
        });
    } catch (error) {
        console.error("❌ Lỗi khi tạo nhóm:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi tạo nhóm.", error: error.message });
    }
};

// 2. Thêm thành viên vào nhóm
exports.addMembers = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { conversationId, userIds } = req.body; // userIds: mảng các id cần thêm vào nhóm

        if (!conversationId) {
            return res.status(400).json({ success: false, message: "Thiếu ID cuộc trò chuyện." });
        }

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: "Phải chọn ít nhất 1 thành viên để thêm." });
        }

        // Kiểm tra quyền: Người yêu cầu phải là thành viên của nhóm đó
        const requesterMember = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId: adminId }
        });

        if (!requesterMember) {
            return res.status(403).json({ success: false, message: "Bạn không phải thành viên của nhóm này." });
        }

        // Lấy tên người thực hiện
        const adminUser = await prisma.users.findUnique({
            where: { id: adminId },
            select: { fullName: true }
        });
        const adminName = adminUser ? adminUser.fullName : "Thành viên";

        // Lấy danh sách thành viên hiện tại của nhóm
        const currentMembers = await prisma.conversationMembers.findMany({
            where: { conversationId },
            select: { userId: true }
        });
        const currentMemberIds = currentMembers.map(m => m.userId);

        // Lọc bỏ các ID đã có sẵn trong nhóm
        const toAddUserIds = userIds.filter(id => !currentMemberIds.includes(id));

        if (toAddUserIds.length === 0) {
            return res.status(400).json({ success: false, message: "Tất cả người dùng đã là thành viên của nhóm." });
        }

        // Lấy thông tin người dùng được thêm để tạo tin nhắn hệ thống
        const addedUsers = await prisma.users.findMany({
            where: { id: { in: toAddUserIds } },
            select: { id: true, fullName: true }
        });

        // Thêm thành viên vào Database
        await prisma.conversationMembers.createMany({
            data: toAddUserIds.map(userId => ({
                id: uuidv4(),
                conversationId,
                userId,
                role: "member"
            }))
        });

        // Tạo tin nhắn hệ thống cho hành động thêm người
        const addedNames = addedUsers.map(u => u.fullName).join(", ");
        const systemContent = `${adminName} đã thêm ${addedNames} vào nhóm.`;
        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId,
                senderId: adminId,
                content: systemContent,
                type: "system"
            }
        });

        // Emit socket events
        const io = req.app.get("io");
        if (io) {
            // Lấy danh sách thành viên mới (bao gồm các thành viên vừa thêm) để broadcast
            const allMembersAfterAdd = await prisma.conversationMembers.findMany({
                where: { conversationId },
                include: {
                    Users: {
                        select: { id: true, fullName: true, avatar: true }
                    }
                }
            });

            // Gửi tín hiệu realtime
            const memberDetails = allMembersAfterAdd.map(m => ({
                userId: m.userId,
                name: m.Users ? m.Users.fullName : "Người dùng",
                role: m.role
            }));

            // Báo cho các người dùng cũ và người dùng mới
            // Người dùng mới cần join vào room socket
            toAddUserIds.forEach(newUserId => {
                io.to(newUserId).emit("group:added_to_group", { conversationId, systemMessage });
            });

            // Báo cho toàn phòng cập nhật danh sách thành viên
            io.to(conversationId).emit("group:member_added", {
                conversationId,
                members: memberDetails,
                systemMessage
            });
            io.to(conversationId).emit("receive_message", systemMessage);
        }

        res.status(200).json({ success: true, message: "Đã thêm thành viên vào nhóm thành công.", systemMessage });
    } catch (error) {
        console.error("❌ Lỗi khi thêm thành viên vào nhóm:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

// 3. Xóa thành viên khỏi nhóm (Kick)
exports.kickMember = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { conversationId, targetUserId } = req.body;

        if (!conversationId || !targetUserId) {
            return res.status(400).json({ success: false, message: "Thiếu ID cuộc trò chuyện hoặc ID người dùng mục tiêu." });
        }

        if (adminId === targetUserId) {
            return res.status(400).json({ success: false, message: "Bạn không thể tự kích chính mình ra khỏi nhóm." });
        }

        // Kiểm tra quyền của người yêu cầu (phải là ADMIN của nhóm)
        const requesterMember = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId: adminId }
        });

        if (!requesterMember || requesterMember.role !== "admin") {
            return res.status(403).json({ success: false, message: "Chỉ quản trị viên mới được quyền kích thành viên." });
        }

        // Lấy thông tin
        const adminUser = await prisma.users.findUnique({
            where: { id: adminId },
            select: { fullName: true }
        });
        const targetUser = await prisma.users.findUnique({
            where: { id: targetUserId },
            select: { fullName: true }
        });

        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Người dùng cần xóa không tồn tại." });
        }

        const adminName = adminUser ? adminUser.fullName : "Quản trị viên";
        const targetName = targetUser.fullName;

        // Xóa thành viên khỏi DB
        await prisma.conversationMembers.deleteMany({
            where: { conversationId, userId: targetUserId }
        });

        // Tạo tin nhắn hệ thống thông báo kích
        const systemContent = `${adminName} đã xóa ${targetName} khỏi cuộc trò chuyện.`;
        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId,
                senderId: adminId,
                content: systemContent,
                type: "system"
            }
        });

        // Gửi tín hiệu Socket
        const io = req.app.get("io");
        if (io) {
            // Gửi tin nhắn hệ thống vào phòng
            io.to(conversationId).emit("receive_message", systemMessage);

            // Báo cho người dùng bị kích
            io.to(targetUserId).emit("group:kicked", { conversationId, userId: targetUserId });

            // Báo cho các thành viên còn lại cập nhật danh sách
            const allMembersLeft = await prisma.conversationMembers.findMany({
                where: { conversationId },
                include: {
                    Users: {
                        select: { id: true, fullName: true }
                    }
                }
            });

            const memberDetails = allMembersLeft.map(m => ({
                userId: m.userId,
                name: m.Users ? m.Users.fullName : "Người dùng",
                role: m.role
            }));

            io.to(conversationId).emit("group:member_kicked", {
                conversationId,
                userId: targetUserId,
                members: memberDetails
            });
        }

        res.status(200).json({ success: true, message: "Đã kích thành viên khỏi nhóm.", systemMessage });
    } catch (error) {
        console.error("❌ Lỗi khi kích thành viên:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống khi kích thành viên.", error: error.message });
    }
};

// 4. Thay đổi chức vụ thành viên (Phân quyền)
exports.changeMemberRole = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { conversationId, targetUserId, newRole } = req.body; // newRole: 'admin' hoặc 'member'

        if (!conversationId || !targetUserId || !newRole) {
            return res.status(400).json({ success: false, message: "Thiếu dữ liệu phân quyền." });
        }

        if (!["admin", "member"].includes(newRole.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Chức vụ không hợp lệ." });
        }

        const roleFormatted = newRole.toLowerCase();

        // Kiểm tra quyền của người yêu cầu (phải là ADMIN của nhóm)
        const requesterMember = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId: adminId }
        });

        if (!requesterMember || requesterMember.role !== "admin") {
            return res.status(403).json({ success: false, message: "Chỉ quản trị viên mới được quyền phân quyền thành viên." });
        }

        // Cập nhật chức vụ trong Database
        const targetMember = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId: targetUserId }
        });

        if (!targetMember) {
            return res.status(404).json({ success: false, message: "Người dùng không thuộc nhóm này." });
        }

        await prisma.conversationMembers.updateMany({
            where: { conversationId, userId: targetUserId },
            data: { role: roleFormatted }
        });

        // Lấy tên
        const adminUser = await prisma.users.findUnique({
            where: { id: adminId },
            select: { fullName: true }
        });
        const targetUser = await prisma.users.findUnique({
            where: { id: targetUserId },
            select: { fullName: true }
        });

        const adminName = adminUser ? adminUser.fullName : "Quản trị viên";
        const targetName = targetUser ? targetUser.fullName : "Người dùng";
        const roleName = roleFormatted === "admin" ? "Quản trị viên (Admin)" : "Thành viên (Member)";

        // Tạo tin nhắn hệ thống
        const systemContent = `${adminName} đã đặt quyền của ${targetName} thành ${roleName}.`;
        const systemMessage = await prisma.messages.create({
            data: {
                id: uuidv4(),
                conversationId,
                senderId: adminId,
                content: systemContent,
                type: "system"
            }
        });

        // Emit Socket event
        const io = req.app.get("io");
        if (io) {
            io.to(conversationId).emit("receive_message", systemMessage);

            // Báo cho toàn phòng cập nhật danh sách thành viên mới
            const allMembers = await prisma.conversationMembers.findMany({
                where: { conversationId },
                include: {
                    Users: {
                        select: { id: true, fullName: true }
                    }
                }
            });

            const memberDetails = allMembers.map(m => ({
                userId: m.userId,
                name: m.Users ? m.Users.fullName : "Người dùng",
                role: m.role
            }));

            io.to(conversationId).emit("group:role_changed", {
                conversationId,
                userId: targetUserId,
                role: roleFormatted,
                members: memberDetails
            });
        }

        res.status(200).json({ success: true, message: "Phân quyền thành viên thành công.", systemMessage });
    } catch (error) {
        console.error("❌ Lỗi khi phân quyền thành viên:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};

// 5. Lấy danh sách thành viên nhóm
exports.getGroupMembers = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;

        // Xác thực người yêu cầu là thành viên nhóm
        const isMember = await prisma.conversationMembers.findFirst({
            where: { conversationId, userId }
        });

        if (!isMember) {
            return res.status(403).json({ success: false, message: "Bạn không thể xem thành viên của nhóm này." });
        }

        const members = await prisma.conversationMembers.findMany({
            where: { conversationId },
            include: {
                Users: {
                    select: { id: true, fullName: true, avatar: true, isOnline: true }
                }
            },
            orderBy: {
                joinedAt: "asc"
            }
        });

        const mappedMembers = members.map(m => ({
            userId: m.userId,
            name: m.Users ? m.Users.fullName : "Người dùng",
            avatar: m.Users && m.Users.avatar ? `/api/users/${m.userId}/avatar` : null,
            role: m.role,
            isOnline: m.Users ? m.Users.isOnline : false
        }));

        res.status(200).json({
            success: true,
            members: mappedMembers,
            myRole: isMember.role
        });
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách thành viên nhóm:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống.", error: error.message });
    }
};
