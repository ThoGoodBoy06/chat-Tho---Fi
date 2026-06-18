const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. Cập nhật thông tin Profile (Tên, Bio)
exports.updateProfile = async (req, res) => {
  try {
    // Giả định bạn có authMiddleware gắn userId vào req.user.id
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
        coverImage: true,
      },
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("!!! LỖI CẬP NHẬT PROFILE:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// 2. Cập nhật ảnh bìa (Cover Image)
exports.updateCoverImage = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.userId;
    if (!req.file)
      return res.status(400).json({ message: "Vui lòng chọn ảnh bìa" });

    const coverUrl = `/covers/${req.file.filename}`;
    await prisma.users.update({
      where: { id: userId },
      data: { coverImage: coverUrl },
    });

    res.status(200).json({ success: true, coverUrl });
  } catch (error) {
    console.error("!!! LỖI UPLOAD COVER:", error);
    res
      .status(500)
      .json({ message: "Lỗi upload ảnh bìa", error: error.message });
  }
};
