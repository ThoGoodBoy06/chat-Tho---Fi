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

    // 1. Kiểm tra RAM cache
    const cached = avatarCache.get(id);
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

    // 2. Query DB nếu chưa có trong RAM
    const user = await prisma.users.findUnique({
      where: { id },
      select: { avatar: true, fullName: true }
    });

    if (!user || !user.avatar) {
      const name = encodeURIComponent(user ? user.fullName || "User" : "User");
      const redirectUrl = `https://ui-avatars.com/api/?name=${name}&background=random`;
      avatarCache.set(id, { isRedirect: true, redirectUrl, timestamp: Date.now() });
      return res.redirect(redirectUrl);
    }

    // Nếu là đường dẫn URL http hoặc file tĩnh
    if (user.avatar.startsWith("http") || user.avatar.startsWith("/")) {
      avatarCache.set(id, { isRedirect: true, redirectUrl: user.avatar, timestamp: Date.now() });
      return res.redirect(user.avatar);
    }

    // Nếu là chuỗi Data URL Base64 (VD: data:image/png;base64,...)
    const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      avatarCache.set(id, { buffer, contentType, timestamp: Date.now() });
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
      avatarCache.set(id, { buffer, contentType: "image/jpeg", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    } catch (e) {
      const name = encodeURIComponent(user.fullName || "User");
      const redirectUrl = `https://ui-avatars.com/api/?name=${name}&background=random`;
      avatarCache.set(id, { isRedirect: true, redirectUrl, timestamp: Date.now() });
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

    // 1. Kiểm tra RAM Cache
    const cached = coverCache.get(id);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      if (cached.isRedirect) return res.redirect(cached.redirectUrl);
      res.writeHead(200, {
        "Content-Type": cached.contentType,
        "Content-Length": cached.buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(cached.buffer);
    }

    // 2. Query DB
    const user = await prisma.users.findUnique({
      where: { id },
      select: { coverPhoto: true }
    });

    if (!user || !user.coverPhoto) {
      coverCache.set(id, { buffer: transparentPixel, contentType: "image/png", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(transparentPixel);
    }

    if (user.coverPhoto.startsWith("http") || user.coverPhoto.startsWith("/")) {
      coverCache.set(id, { isRedirect: true, redirectUrl: user.coverPhoto, timestamp: Date.now() });
      return res.redirect(user.coverPhoto);
    }

    const matches = user.coverPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      coverCache.set(id, { buffer, contentType, timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    }

    try {
      const buffer = Buffer.from(user.coverPhoto, "base64");
      coverCache.set(id, { buffer, contentType: "image/jpeg", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400, must-revalidate"
      });
      return res.end(buffer);
    } catch (e) {
      coverCache.set(id, { buffer: transparentPixel, contentType: "image/png", timestamp: Date.now() });
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
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
    const responseData = {
      ...updatedUser,
      avatar: `/api/users/${updatedUser.id}/avatar?v=${Date.now()}`,
      coverPhoto: `/api/users/${updatedUser.id}/cover?v=${Date.now()}`,
      coverImage: `/api/users/${updatedUser.id}/cover?v=${Date.now()}`
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error("!!! LỖI CẬP NHẬT PROFILE:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 2. Cập nhật ảnh bìa (Cover Image)
exports.updateCoverImage = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    const { coverPhoto } = req.body; // Base64 string from client
    if (!coverPhoto)
      return res.status(400).json({ message: "Vui lòng chọn ảnh bìa" });

    clearUserImageCache(userId);

    await prisma.users.update({
      where: { id: userId },
      data: { coverPhoto: coverPhoto },
    });

    res.status(200).json({ success: true, coverUrl: `/api/users/${userId}/cover?v=${Date.now()}` });
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

