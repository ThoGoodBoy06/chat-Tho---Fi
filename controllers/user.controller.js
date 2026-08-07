const prisma = require("../prisma");

// Bộ nhớ đệm RAM lưu trữ binary avatar và cover photo giúp phản hồi siêu tốc (<1ms) mà không tốn DB Query
const avatarCache = new Map(); // id -> { buffer, contentType, isRedirect, redirectUrl, timestamp }
const coverCache = new Map();  // id -> { buffer, contentType, isRedirect, redirectUrl, timestamp }

const CACHE_TTL = 3600 * 1000; // 1 giờ

function clearUserImageCache(userId) {
  if (!userId) return;
  avatarCache.delete(userId);
  coverCache.delete(userId);
}
exports.clearUserImageCache = clearUserImageCache;

// Endpoint lấy ảnh đại diện của User dưới dạng file ảnh binary thực tế
exports.getUserAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      return res.redirect(`https://ui-avatars.com/api/?name=User&background=random`);
    }

    let cleanId = id.trim();
    if (cleanId.startsWith("@")) {
      cleanId = cleanId.substring(1).trim();
    }

    // 1. Kiểm tra RAM cache
    const cached = avatarCache.get(cleanId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      if (cached.isRedirect) {
        return res.redirect(cached.redirectUrl);
      }
      res.writeHead(200, {
        "Content-Type": cached.contentType,
        "Content-Length": cached.buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(cached.buffer);
    }

    // 2. Query DB theo UUID hoặc username / phone / email
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    let user = null;

    if (isUuid) {
      try {
        user = await prisma.users.findUnique({
          where: { id: cleanId },
          select: { id: true, avatar: true, fullName: true }
        });
      } catch (_) {}
    }

    if (!user) {
      try {
        user = await prisma.users.findFirst({
          where: {
            OR: [
              { username: { equals: cleanId, mode: "insensitive" } },
              { phone: cleanId },
              { email: { equals: cleanId, mode: "insensitive" } }
            ]
          },
          select: { id: true, avatar: true, fullName: true }
        });
      } catch (_) {}
    }

    if (!user || !user.avatar) {
      const name = encodeURIComponent(user ? user.fullName || "User" : "User");
      const redirectUrl = `https://ui-avatars.com/api/?name=${name}&background=random`;
      avatarCache.set(cleanId, { isRedirect: true, redirectUrl, timestamp: Date.now() });
      return res.redirect(redirectUrl);
    }

    // Nếu là đường dẫn URL http hoặc file tĩnh
    if (user.avatar.startsWith("http") || user.avatar.startsWith("/")) {
      avatarCache.set(cleanId, { isRedirect: true, redirectUrl: user.avatar, timestamp: Date.now() });
      return res.redirect(user.avatar);
    }

    // Nếu là chuỗi Data URL Base64 (VD: data:image/png;base64,...)
    const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      avatarCache.set(cleanId, { buffer, contentType, timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    }

    // Trả về trực tiếp nếu là Base64 thuần không có tiền tố data:
    try {
      const buffer = Buffer.from(user.avatar, "base64");
      avatarCache.set(cleanId, { buffer, contentType: "image/jpeg", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    } catch (e) {
      const name = encodeURIComponent(user.fullName || "User");
      const redirectUrl = `https://ui-avatars.com/api/?name=${name}&background=random`;
      avatarCache.set(cleanId, { isRedirect: true, redirectUrl, timestamp: Date.now() });
      return res.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Lỗi khi tải avatar:", error.message);
    return res.status(500).send("Lỗi server");
  }
};

// Endpoint lấy ảnh bìa (Cover Photo) dưới dạng file ảnh binary thực tế
exports.getUserCover = async (req, res) => {
  try {
    const { id } = req.params;
    const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

    if (!id || id === "null" || id === "undefined") {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(transparentPixel);
    }

    let cleanId = id.trim();
    if (cleanId.startsWith("@")) {
      cleanId = cleanId.substring(1).trim();
    }

    // 1. Kiểm tra RAM Cache
    const cached = coverCache.get(cleanId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      if (cached.isRedirect) return res.redirect(cached.redirectUrl);
      res.writeHead(200, {
        "Content-Type": cached.contentType,
        "Content-Length": cached.buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(cached.buffer);
    }

    // 2. Query DB theo UUID hoặc Username / Phone / Email
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    let user = null;

    if (isUuid) {
      try {
        user = await prisma.users.findUnique({
          where: { id: cleanId },
          select: { id: true, coverPhoto: true }
        });
      } catch (_) {}
    }

    if (!user) {
      try {
        user = await prisma.users.findFirst({
          where: {
            OR: [
              { username: { equals: cleanId, mode: "insensitive" } },
              { phone: cleanId },
              { email: { equals: cleanId, mode: "insensitive" } }
            ]
          },
          select: { id: true, coverPhoto: true }
        });
      } catch (_) {}
    }

    if (!user || !user.coverPhoto) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache"
      });
      return res.end(transparentPixel);
    }

    if (user.coverPhoto.startsWith("http") || user.coverPhoto.startsWith("/")) {
      coverCache.set(cleanId, { isRedirect: true, redirectUrl: user.coverPhoto, timestamp: Date.now() });
      return res.redirect(user.coverPhoto);
    }

    const matches = user.coverPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      coverCache.set(cleanId, { buffer, contentType, timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    }

    try {
      const buffer = Buffer.from(user.coverPhoto, "base64");
      coverCache.set(cleanId, { buffer, contentType: "image/jpeg", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    } catch (e) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache"
      });
      return res.end(transparentPixel);
    }
  } catch (error) {
    console.error("Lỗi khi tải cover photo:", error.message);
    return res.status(500).send("Lỗi server");
  }
};

// 1. Cập nhật thông tin Profile (Tên, Bio)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const { fullName, bio } = req.body;

    clearUserImageCache(userId);

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        fullName: fullName || undefined,
        bio: bio !== undefined ? bio : undefined, // Cho phép bio rỗng
      },
      select: {
        id: true,
        fullName: true,
        bio: true,
      },
    });

    // Map avatar và coverPhoto sang URL tĩnh để trả về client
    const timestamp = Date.now();
    const responseData = {
      ...updatedUser,
      avatar: `/api/users/${updatedUser.id}/avatar?v=${timestamp}`,
      coverPhoto: `/api/users/${updatedUser.id}/cover?v=${timestamp}`,
      coverImage: `/api/users/${updatedUser.id}/cover?v=${timestamp}`
    };

    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("user_profile_updated", responseData);
      }
    } catch (e) {
      console.warn("Lỗi emit socket user_profile_updated:", e.message);
    }

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error("!!! LỖI CẬP NHẬT PROFILE:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 2. Cập nhật ảnh đại diện (Avatar)
exports.updateAvatar = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const avatar = req.body.avatar || req.body.avatarUrl || req.body.image;
    if (!avatar)
      return res.status(400).json({ message: "Vui lòng chọn ảnh đại diện" });

    clearUserImageCache(userId);

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { avatar: avatar },
      select: { id: true, fullName: true, username: true, bio: true }
    });

    const timestamp = Date.now();
    const avatarUrl = `/api/users/${userId}/avatar?v=${timestamp}`;
    const coverUrl = `/api/users/${userId}/cover?v=${timestamp}`;

    const payload = {
      ...updatedUser,
      avatar: avatarUrl,
      coverPhoto: coverUrl,
      coverImage: coverUrl
    };

    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("user_profile_updated", payload);
      }
    } catch (e) {}

    res.status(200).json({ success: true, avatarUrl, data: payload });
  } catch (error) {
    console.error("!!! LỖI UPLOAD AVATAR:", error);
    res.status(500).json({ message: "Lỗi upload ảnh đại diện", error: error.message });
  }
};

// 3. Cập nhật ảnh bìa (Cover Image)
exports.updateCoverImage = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const coverPhoto = req.body.coverPhoto || req.body.coverImage || req.body.cover;
    if (!coverPhoto)
      return res.status(400).json({ message: "Vui lòng chọn ảnh bìa" });

    clearUserImageCache(userId);

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { coverPhoto: coverPhoto },
      select: { id: true, fullName: true, username: true, bio: true }
    });

    const timestamp = Date.now();
    const coverUrl = `/api/users/${userId}/cover?v=${timestamp}`;
    const avatarUrl = `/api/users/${userId}/avatar?v=${timestamp}`;

    const payload = {
      ...updatedUser,
      avatar: avatarUrl,
      coverPhoto: coverUrl,
      coverImage: coverUrl
    };

    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("user_profile_updated", payload);
      }
    } catch (e) {}

    res.status(200).json({ success: true, coverUrl, data: payload });
  } catch (error) {
    console.error("!!! LỖI UPLOAD COVER:", error);
    res
      .status(500)
      .json({ message: "Lỗi upload ảnh bìa", error: error.message });
  }
};

// 3. Lấy thông tin Hồ sơ người dùng an toàn dựa trên ID
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        bio: true,
        isOnline: true,
        lastActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      id: user.id,
      name: user.fullName,
      avatarUrl: `/api/users/${user.id}/avatar`,
      coverUrl: `/api/users/${user.id}/cover`,
      bio: user.bio || "Chưa có tiểu sử",
      status: user.isOnline ? "online" : "offline",
      lastActive: user.lastActive,
    });
  } catch (error) {
    console.error("Lỗi khi lấy hồ sơ người dùng:", error.message);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lookup user by ID (for QR scan) - returns user info + relationship status
exports.lookupUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user ? (req.user.id || req.user.userId) : null;

    if (!id || id === "null" || id === "undefined") {
      return res.status(400).json({ success: false, message: "ID người dùng không hợp lệ" });
    }

    let cleanId = id.trim();
    if (cleanId.startsWith("@")) {
      cleanId = cleanId.substring(1).trim();
    }

    // 1. Kiểm tra UUID regex để tránh Prisma ném lỗi 500 Malformed UUID khi tìm kiếm username/SĐT
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    let user = null;
    if (isUuid) {
      try {
        user = await prisma.users.findUnique({
          where: { id: cleanId },
          select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, bio: true, avatar: true, coverPhoto: true },
        });
      } catch (_) {}

      // Nếu cleanId là UUID nhưng không phải User ID, kiểm tra xem có phải mã phòng chat Conversation ID không
      if (!user) {
        try {
          const convMember = await prisma.conversationMembers.findFirst({
            where: {
              conversationId: cleanId,
              userId: currentUserId ? { not: currentUserId } : undefined,
            },
            select: {
              Users: {
                select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, bio: true, avatar: true, coverPhoto: true },
              },
            },
          });
          if (convMember && convMember.Users) {
            user = convMember.Users;
          }
        } catch (_) {}
      }
    }

    // 2. Fallback: Tra cứu theo username, phone hoặc email
    if (!user) {
      try {
        user = await prisma.users.findFirst({
          where: {
            OR: [
              { username: { equals: cleanId, mode: "insensitive" } },
              { phone: cleanId },
              { email: { equals: cleanId, mode: "insensitive" } },
            ],
          },
          select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, bio: true, avatar: true, coverPhoto: true },
        });
      } catch (_) {}
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    let status = "NONE";
    let relationship = "none";

    if (currentUserId && user.id === currentUserId) {
      status = "SELF";
      relationship = "self";
    } else if (currentUserId) {
      try {
        // Check FriendRequests
        const fr = await prisma.friendRequests.findFirst({
          where: {
            OR: [
              { requesterId: currentUserId, receiverId: user.id },
              { receiverId: currentUserId, requesterId: user.id },
            ],
          },
        });

        // Check Friends table
        let fRecord = null;
        try {
          if (prisma.friends) {
            fRecord = await prisma.friends.findFirst({
              where: {
                OR: [
                  { senderId: currentUserId, receiverId: user.id },
                  { receiverId: currentUserId, senderId: user.id },
                ],
              },
            });
          }
        } catch (_) {}

        if ((fr && fr.status === "ACCEPTED") || (fRecord && (fRecord.status === "accepted" || fRecord.status === "ACCEPTED"))) {
          status = "FRIEND";
          relationship = "friends";
        } else if (fr && fr.status === "PENDING") {
          status = "PENDING";
          relationship = fr.requesterId === currentUserId ? "pending_sent" : "pending_received";
        } else if (fRecord && (fRecord.status === "pending" || fRecord.status === "PENDING")) {
          status = "PENDING";
          relationship = "pending_sent";
        }
      } catch (e) {
        console.warn("⚠️ Relationship check soft fail:", e.message);
      }
    }

    const ts = Date.now();
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName || user.username,
        username: user.username,
        phone: user.phone,
        email: user.email,
        isOnline: user.isOnline,
        bio: user.bio,
        avatar: `/api/users/${user.id}/avatar?v=${ts}`,
        coverPhoto: `/api/users/${user.id}/cover?v=${ts}`,
        coverImage: `/api/users/${user.id}/cover?v=${ts}`,
        status,
        relationship,
      },
    });
  } catch (error) {
    console.error("Lỗi lookupUserById:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 4. Lấy thông tin Hồ sơ người dùng khác đầy đủ cho modal mới
exports.getOtherUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        bio: true,
        isOnline: true,
        lastActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      id: user.id,
      name: user.fullName,
      profileAvatarUrl: `/api/users/${user.id}/avatar`,
      coverPhotoGroupUrl: `/api/users/${user.id}/cover`,
      bio: user.bio || "Chưa có tiểu sử",
      status: user.isOnline ? "online" : "offline",
      lastActive: user.lastActive,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin hồ sơ chi tiết:", error.message);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 5. Lấy danh sách lời mời kết bạn đang chờ (status = 'PENDING') gửi đến user hiện tại
exports.getPendingFriendRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await prisma.friendRequests.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true,
            isOnline: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      requester: {
        ...r.requester,
        avatar: `/api/users/${r.requester.id}/avatar`,
      },
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi lấy danh sách lời mời kết bạn:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 6. Chấp nhận lời mời kết bạn
exports.acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    let request = await prisma.friendRequests.findUnique({
      where: { id },
    }).catch(() => null);

    if (!request) {
      request = await prisma.friendRequests.findFirst({
        where: {
          requesterId: id,
          receiverId: userId,
          status: "PENDING",
        },
      });
    }

    if (!request) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.receiverId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xử lý yêu cầu này" });
    }

    const updatedRequest = await prisma.friendRequests.update({
      where: { id: request.id },
      data: { status: "ACCEPTED" },
      include: {
        requester: { select: { id: true, fullName: true } },
      },
    });

    try {
      if (prisma.friends) {
        await prisma.friends.create({
          data: {
            senderId: request.requesterId,
            receiverId: request.receiverId,
            status: "accepted",
          },
        });
      }
    } catch (e) {
      console.warn("Lỗi phụ khi tạo record Friends:", e.message);
    }

    try {
      if (prisma.notifications) {
        await prisma.notifications.create({
          data: {
            userId: request.requesterId,
            senderId: userId,
            type: "FRIEND_ACCEPTED",
            content: "đã chấp nhận lời mời kết bạn của bạn",
          },
        });
      }
    } catch (e) {
      console.warn("Lỗi phụ khi tạo notification:", e.message);
    }

    // Tự động kiểm tra & tạo cuộc trò chuyện 1-1 riêng nếu chưa có
    try {
      const existingConvs = await prisma.conversations.findMany({
        where: {
          type: "private",
          AND: [
            { ConversationMembers: { some: { userId: request.requesterId } } },
            { ConversationMembers: { some: { userId: request.receiverId } } },
          ],
        },
      });

      if (existingConvs.length === 0) {
        await prisma.conversations.create({
          data: {
            type: "private",
            createdBy: userId,
            ConversationMembers: {
              create: [
                { userId: request.requesterId, role: "member" },
                { userId: request.receiverId, role: "member" },
              ],
            },
          },
        });
      }
    } catch (e) {
      console.warn("Lỗi phụ khi tự động tạo cuộc trò chuyện 1-1:", e.message);
    }

    // Bắn Socket notification tới cả 2 người để làm mới danh sách chat & danh bạ real-time
    try {
      const io = req.app.get("io");
      if (io) {
        io.to(request.requesterId).emit("friend_request_accepted", { userId });
        io.to(request.receiverId).emit("friend_request_accepted", { userId: request.requesterId });
      }
    } catch (e) {
      console.warn("Lỗi phụ emit socket friend_request_accepted:", e.message);
    }

    return res.status(200).json({
      success: true,
      message: "Đã chấp nhận lời mời kết bạn",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Lỗi chấp nhận lời mời kết bạn:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 7. Từ chối lời mời kết bạn
exports.rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    let request = await prisma.friendRequests.findUnique({
      where: { id },
    }).catch(() => null);

    if (!request) {
      request = await prisma.friendRequests.findFirst({
        where: {
          requesterId: id,
          receiverId: userId,
          status: "PENDING",
        },
      });
    }

    if (!request) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời kết bạn" });
    }

    if (request.receiverId !== userId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xử lý yêu cầu này" });
    }

    const updatedRequest = await prisma.friendRequests.update({
      where: { id: request.id },
      data: { status: "REJECTED" },
    });

    try {
      const io = req.app.get("io");
      if (io) {
        io.to(request.requesterId).emit("new_friend_request", { rejected: true });
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: "Đã từ chối lời mời kết bạn",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Lỗi từ chối lời mời kết bạn:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 8. Gửi lời mời kết bạn
exports.sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, targetUserId } = req.body;
    const targetId = receiverId || targetUserId;

    if (!targetId || targetId === senderId) {
      return res.status(400).json({ success: false, message: "ID người nhận không hợp lệ" });
    }

    const existing = await prisma.friendRequests.findFirst({
      where: {
        OR: [
          { requesterId: senderId, receiverId: targetId },
          { requesterId: targetId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "Đã gửi lời mời hoặc đã là bạn bè" });
    }

    const newRequest = await prisma.friendRequests.create({
      data: {
        requesterId: senderId,
        receiverId: targetId,
        status: "PENDING",
      },
    });

    try {
      const io = req.app.get("io");
      if (io) {
        io.to(targetId).emit("new_friend_request", { senderId });
        io.to(targetId).emit("friend_request_updated", { type: "SEND", senderId });
      }
    } catch (e) {
      console.warn("Lỗi phụ emit socket sendFriendRequest:", e.message);
    }

    return res.status(200).json({
      success: true,
      message: "Đã gửi lời mời kết bạn",
      data: newRequest,
    });
  } catch (error) {
    console.error("Lỗi khi gửi lời mời kết bạn API:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 9. Xóa bạn bè
exports.deleteFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const targetId = friendId || req.body?.friendId || req.body?.targetUserId;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "ID bạn bè không hợp lệ" });
    }

    // 1. Xóa tất cả bản ghi liên quan trong FriendRequests
    await prisma.friendRequests.deleteMany({
      where: {
        OR: [
          { requesterId: userId, receiverId: targetId },
          { requesterId: targetId, receiverId: userId },
        ],
      },
    });

    // 2. Xóa bản ghi trong Friends nếu bảng tồn tại
    try {
      if (prisma.friends) {
        await prisma.friends.deleteMany({
          where: {
            OR: [
              { senderId: userId, receiverId: targetId },
              { senderId: targetId, receiverId: userId },
            ],
          },
        });
      }
    } catch (e) {
      console.warn("Lỗi phụ khi xóa record Friends:", e.message);
    }

    // 3. Tìm và xóa cuộc trò chuyện 1-1 riêng giữa 2 người nếu có
    try {
      const conversations = await prisma.conversations.findMany({
        where: {
          type: "private",
          AND: [
            { ConversationMembers: { some: { userId: userId } } },
            { ConversationMembers: { some: { userId: targetId } } },
          ],
        },
        include: {
          _count: { select: { ConversationMembers: true } },
        },
      });

      const privateConversation = conversations.find(
        (c) => c._count.ConversationMembers === 2
      );

      if (privateConversation) {
        await prisma.messages.deleteMany({
          where: { conversationId: privateConversation.id },
        });
        await prisma.conversationMembers.deleteMany({
          where: { conversationId: privateConversation.id },
        });
        await prisma.conversations.delete({
          where: { id: privateConversation.id },
        });
        console.log("🗑️ Đã xóa cuộc trò chuyện 1-1 riêng khi xóa bạn bè:", privateConversation.id);
      }
    } catch (e) {
      console.warn("Lỗi phụ khi xóa cuộc trò chuyện 1-1:", e.message);
    }

    // 4. Phát Socket.IO real-time tới CẢ HÀI thiết bị
    try {
      const io = req.app.get("io");
      if (io) {
        io.to(targetId).emit("user_unfriended", { userId: userId, friendId: userId });
        io.to(userId).emit("user_unfriended", { userId: targetId, friendId: targetId });
        io.to(targetId).emit("unfriended", { unfriendedBy: userId });
        io.to(userId).emit("unfriended", { unfriendedBy: targetId });
      }
    } catch (e) {
      console.warn("Lỗi phụ emit socket unfriend:", e.message);
    }

    return res.status(200).json({ success: true, message: "Đã xóa bạn bè và phòng chat thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bạn bè API:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// Lấy danh sách bạn bè đã kết bạn (status = ACCEPTED)
exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Tìm các yêu cầu kết bạn đã ACCEPTED
    const acceptedRequests = await prisma.friendRequests.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        requester: {
          select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, lastActive: true, avatar: true },
        },
        receiver: {
          select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, lastActive: true, avatar: true },
        },
      },
    });

    const friendMap = new Map();

    acceptedRequests.forEach((r) => {
      const friend = r.requesterId === userId ? r.receiver : r.requester;
      if (friend && friend.id !== userId) {
        friendMap.set(friend.id, {
          id: friend.id,
          fullName: friend.fullName || friend.username,
          username: friend.username,
          phone: friend.phone,
          email: friend.email,
          isOnline: friend.isOnline,
          lastActive: friend.lastActive,
          avatar: `/api/users/${friend.id}/avatar`,
          status: "FRIEND",
          relationship: "friends",
        });
      }
    });

    // 2. Check bảng Friends nếu có
    try {
      if (prisma.friends) {
        const friendsRecords = await prisma.friends.findMany({
          where: {
            OR: [{ senderId: userId }, { receiverId: userId }],
            status: { in: ["accepted", "ACCEPTED"] },
          },
          include: {
            sender: { select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, lastActive: true } },
            receiver: { select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, lastActive: true } },
          },
        });

        for (const f of friendsRecords) {
          const friend = f.senderId === userId ? f.receiver : f.sender;
          if (friend && friend.id !== userId && !friendMap.has(friend.id)) {
            friendMap.set(friend.id, {
              id: friend.id,
              fullName: friend.fullName || friend.username,
              username: friend.username,
              phone: friend.phone,
              email: friend.email,
              isOnline: friend.isOnline,
              lastActive: friend.lastActive,
              avatar: `/api/users/${friend.id}/avatar`,
              status: "FRIEND",
              relationship: "friends",
            });
          }
        }
      }
    } catch (_) {}

    const friendsList = Array.from(friendMap.values());
    return res.status(200).json({ success: true, data: friendsList });
  } catch (error) {
    console.error("Lỗi lấy danh sách bạn bè:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 10. Tìm kiếm người dùng bằng Tên, Username, SĐT, Email (Trả về status: FRIEND, PENDING, NONE, SELF)
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || !q.trim()) return res.json({ success: true, data: [] });
    const keyword = q.trim();

    // Query tất cả user
    const allUsers = await prisma.users.findMany({
      select: { id: true, fullName: true, username: true, phone: true, email: true, isOnline: true, avatar: true },
      take: 200,
    });

    // Hàm bỏ dấu Tiếng Việt
    function removeAccents(str) {
      if (!str) return "";
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase();
    }

    const lowerQ = keyword.toLowerCase();
    const cleanQ = removeAccents(lowerQ);

    const users = allUsers.filter((u) => {
      const name = u.fullName || "";
      const uname = u.username || "";
      const phone = u.phone || "";
      const email = u.email || "";

      const nLower = name.toLowerCase();
      const nClean = removeAccents(name);
      const uLower = uname.toLowerCase();
      const uClean = removeAccents(uname);

      return (
        nLower.includes(lowerQ) ||
        nClean.includes(cleanQ) ||
        uLower.includes(lowerQ) ||
        uClean.includes(cleanQ) ||
        phone.includes(keyword) ||
        email.toLowerCase().includes(lowerQ)
      );
    });

    const targetUserIds = users.map((u) => u.id);

    // 1. Kiểm tra trong FriendRequests (ACCEPTED hoặc PENDING)
    const friendRequests = targetUserIds.length > 0 ? await prisma.friendRequests.findMany({
      where: {
        OR: [
          { requesterId: currentUserId, receiverId: { in: targetUserIds } },
          { receiverId: currentUserId, requesterId: { in: targetUserIds } },
        ],
      },
    }) : [];

    // 2. Kiểm tra trong bảng Friends nếu có
    let friendsRecords = [];
    try {
      if (prisma.friends && targetUserIds.length > 0) {
        friendsRecords = await prisma.friends.findMany({
          where: {
            OR: [
              { senderId: currentUserId, receiverId: { in: targetUserIds } },
              { receiverId: currentUserId, senderId: { in: targetUserIds } },
            ],
          },
        });
      }
    } catch (_) {}

    const mappedUsers = users.map((u) => {
      let status = "NONE";
      let relationship = "none";

      if (u.id === currentUserId) {
        status = "SELF";
        relationship = "self";
      } else {
        const fr = friendRequests.find(
          (r) =>
            (r.requesterId === currentUserId && r.receiverId === u.id) ||
            (r.receiverId === currentUserId && r.requesterId === u.id)
        );

        const fRecord = friendsRecords.find(
          (f) =>
            (f.senderId === currentUserId && f.receiverId === u.id) ||
            (f.receiverId === currentUserId && f.senderId === u.id)
        );

        if ((fr && fr.status === "ACCEPTED") || (fRecord && (fRecord.status === "accepted" || fRecord.status === "ACCEPTED"))) {
          status = "FRIEND";
          relationship = "friends";
        } else if (fr && fr.status === "PENDING") {
          status = "PENDING";
          relationship = fr.requesterId === currentUserId ? "pending_sent" : "pending_received";
        } else if (fRecord && (fRecord.status === "pending" || fRecord.status === "PENDING")) {
          status = "PENDING";
          relationship = "pending_sent";
        }
      }

      return {
        id: u.id,
        fullName: u.fullName || u.username,
        username: u.username,
        phone: u.phone,
        email: u.email,
        isOnline: u.isOnline,
        avatar: `/api/users/${u.id}/avatar`,
        status, // "FRIEND", "PENDING", "NONE", "SELF"
        relationship,
      };
    });

    return res.status(200).json({ success: true, data: mappedUsers });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm người dùng controller:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 11. Hủy lời mời kết bạn đã gửi
exports.cancelFriendRequest = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { receiverId } = req.params;
    const targetId = receiverId || req.body.receiverId;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "ID người nhận không hợp lệ" });
    }

    const existing = await prisma.friendRequests.findFirst({
      where: {
        requesterId: requesterId,
        receiverId: targetId,
        status: "PENDING",
      },
    });

    if (existing) {
      await prisma.friendRequests.delete({
        where: { id: existing.id },
      });

      try {
        const io = req.app.get("io");
        if (io) {
          io.to(targetId).emit("new_friend_request", { canceled: true });
        }
      } catch (e) {
        console.warn("Lỗi phụ socket cancel friend request:", e.message);
      }

      return res.status(200).json({ success: true, message: "Đã hủy lời mời kết bạn" });
    } else {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời kết bạn để hủy" });
    }
  } catch (error) {
    console.error("Lỗi khi hủy lời mời kết bạn API:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 12. Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, currentPassword, newPassword } = req.body;
    const oldPass = oldPassword || currentPassword;

    if (!oldPass || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin mật khẩu" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const bcrypt = require("bcrypt");
    const isMatch = await bcrypt.compare(oldPass, user.passwordHash || user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không chính xác" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        password: newHash,
      },
    });

    return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
  }
};

