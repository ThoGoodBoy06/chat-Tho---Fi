const prisma = require("../prisma");

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

    // Trả về thuộc tính coverImage tương đương cho tương thích client cũ
    const responseData = {
      ...updatedUser,
      coverImage: updatedUser.coverPhoto
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

    res.status(200).json({ success: true, coverUrl: coverPhoto });
  } catch (error) {
    console.error("!!! LỖI UPLOAD COVER:", error);
    res
      .status(500)
      .json({ message: "Lỗi upload ảnh bìa", error: error.message });
  }
};
