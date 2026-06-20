const prisma = require("../prisma");

// Endpoint lấy ảnh đại diện của User dưới dạng file ảnh binary thực tế
exports.getUserAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      return res.redirect(`https://ui-avatars.com/api/?name=User&background=random`);
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: { avatar: true, fullName: true }
    });

    if (!user || !user.avatar) {
      const name = encodeURIComponent(user ? user.fullName || "User" : "User");
      return res.redirect(`https://ui-avatars.com/api/?name=${name}&background=random`);
    }

    // Nếu là đường dẫn URL http hoặc file tĩnh
    if (user.avatar.startsWith("http") || user.avatar.startsWith("/")) {
      return res.redirect(user.avatar);
    }

    // Nếu là chuỗi Data URL Base64 (VD: data:image/png;base64,...)
    const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400" // Trình duyệt cache 1 ngày
      });
      return res.end(buffer);
    }

    // Trả về trực tiếp nếu là Base64 thuần không có tiền tố data:
    try {
      const buffer = Buffer.from(user.avatar, "base64");
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(buffer);
    } catch (e) {
      const name = encodeURIComponent(user.fullName || "User");
      return res.redirect(`https://ui-avatars.com/api/?name=${name}&background=random`);
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
    if (!id || id === "null" || id === "undefined") {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
      });
      const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
      return res.end(transparentPixel);
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: { coverPhoto: true }
    });

    if (!user || !user.coverPhoto) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
      });
      const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
      return res.end(transparentPixel);
    }

    if (user.coverPhoto.startsWith("http") || user.coverPhoto.startsWith("/")) {
      return res.redirect(user.coverPhoto);
    }

    const matches = user.coverPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(buffer);
    }

    try {
      const buffer = Buffer.from(user.coverPhoto, "base64");
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=86400"
      });
      return res.end(buffer);
    } catch (e) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400"
      });
      const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
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
        avatar: true,
        coverPhoto: true,
      },
    });

    // Map avatar và coverPhoto sang URL tĩnh để trả về client
    const responseData = {
      ...updatedUser,
      avatar: updatedUser.avatar ? `/api/users/${updatedUser.id}/avatar?v=${Date.now()}` : null,
      coverPhoto: updatedUser.coverPhoto ? `/api/users/${updatedUser.id}/cover?v=${Date.now()}` : null,
      coverImage: updatedUser.coverPhoto ? `/api/users/${updatedUser.id}/cover?v=${Date.now()}` : null
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
