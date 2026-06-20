require("dotenv").config();
require("./firebaseConfig");
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();
const prisma = new PrismaClient();

// Tạo HTTP server từ app Express
const server = http.createServer(app);

// Khởi tạo Socket.IO
const io = new Server(server, { cors: { origin: "*" } });

// Chia sẻ biến 'io' cho toàn bộ ứng dụng (để Controller có thể dùng)
app.set("io", io);

// Cấu hình bảo mật và đọc dữ liệu JSON
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Mở thư mục 'public' để chứa file giao diện web (HTML/CSS/JS)
app.use(express.static("public"));

// Import Routes
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const userRoutes = require("./routes/user.routes");

// Tạo một API test thử xem server chạy chưa
app.get("/", async (req, res) => {
  try {
    // Thử đếm số lượng người dùng trong Database
    const userCount = await prisma.users.count();
    res.json({
      message: "🚀 Backend Chat App đang hoạt động tuyệt vời!",
      database: "Đã kết nối PostgreSQL", // Cập nhật cho đúng loại DB
      totalUsers: userCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi kết nối Database", details: error.message });
  }
});

// API phụ trợ (Danh bạ) để xem danh sách tất cả người dùng và lấy ID dễ dàng
app.get("/api/users", authMiddleware, async (req, res) => {
  const users = await prisma.users.findMany({
    select: { id: true, username: true, fullName: true },
  });
  res.json({ success: true, data: users });
});

// API Tìm kiếm người dùng bằng Tên (Tính năng kết bạn)
app.get("/api/users/search", authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: true, data: [] });

  const users = await prisma.users.findMany({
    where: {
      fullName: { contains: q }, // Tìm kiếm tương đối theo Họ và tên
    },
    select: { id: true, fullName: true, username: true },
  });
  res.json({ success: true, data: users });
});

// API Lấy danh sách bạn bè đã kết bạn
app.get("/api/users/friends", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const friendships = await prisma.friendRequests.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      include: {
        requester: {
          select: { id: true, fullName: true, avatar: true, isOnline: true },
        },
        receiver: {
          select: { id: true, fullName: true, avatar: true, isOnline: true },
        },
      },
    });

    const friends = friendships.map((f) =>
      f.requesterId === userId ? f.receiver : f.requester,
    );
    res.json({ success: true, data: friends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Xóa bạn bè
app.delete("/api/users/friends/:friendId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const friendId = req.params.friendId;

    const friendship = await prisma.friendRequests.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, receiverId: friendId },
          { requesterId: friendId, receiverId: userId },
        ],
      },
    });

    if (friendship) {
      // NÂNG CẤP: Tìm và xóa luôn cuộc trò chuyện 1-1 nếu có
      const conversations = await prisma.conversations.findMany({
        where: {
          AND: [
            { ConversationMembers: { some: { userId: userId } } },
            { ConversationMembers: { some: { userId: friendId } } },
          ],
        },
        include: {
          _count: {
            select: { ConversationMembers: true },
          },
        },
      });

      // Lọc ra đúng cuộc trò chuyện chỉ có 2 người
      const privateConversation = conversations.find(
        (c) => c._count.ConversationMembers === 2,
      );

      if (privateConversation) {
        // Xóa các bảng liên quan trước khi xóa phòng chat
        await prisma.messages.deleteMany({
          where: { conversationId: privateConversation.id },
        });
        await prisma.conversationMembers.deleteMany({
          where: { conversationId: privateConversation.id },
        });
        await prisma.conversations.delete({
          where: { id: privateConversation.id },
        });
      }

      // Xóa bản ghi bạn bè
      await prisma.friendRequests.delete({
        where: { id: friendship.id },
      });

      // Báo cho người bị xóa biết để cập nhật UI real-time (qua room)
      const io = req.app.get("io");
      io.to(friendId).emit("unfriended", { unfriendedBy: userId });

      res.json({ success: true, message: "Đã xóa bạn bè và cuộc trò chuyện." });
    } else {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bạn bè." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Lấy danh sách thông báo
app.get("/api/users/notifications", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const notifications = await prisma.notifications.findMany({
      where: { userId: decoded.id },
      orderBy: { createdAt: "desc" },
      include: {
        Sender: { select: { id: true, fullName: true, avatar: true } },
      },
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Đánh dấu đã đọc thông báo
app.patch("/api/users/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.notifications.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });
    if (result.count === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thông báo." });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API để xác thực token và lấy thông tin user (cho tính năng tự động đăng nhập)
app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Không tìm thấy token." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại." });
    res.json({ success: true, data: user });
  } catch (error) {
    res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn." });
  }
});

// Sử dụng Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes); // Mount các API user (profile, cover) vào đây

// --- TÍNH NĂNG UPLOAD AVATAR ---
// Đảm bảo thư mục lưu trữ tồn tại
const avatarDir = path.join(__dirname, "public", "avatars");
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) =>
    cb(null, `avatar_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

app.post("/api/users/avatar", upload.single("avatar"), async (req, res) => {
  try {
    // Xác thực Token thủ công
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;

    if (!token)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!req.file)
      return res.status(400).json({ message: "Vui lòng chọn ảnh" });

    const avatarUrl = `/avatars/${req.file.filename}`;

    // Lưu vào DB
    await prisma.users.update({
      where: { id: decoded.id },
      data: { avatar: avatarUrl },
    });

    res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi upload ảnh", details: error.message });
  }
});

// --- API LƯU FCM TOKEN CỦA THIẾT BỊ ---
app.post("/api/users/fcm-token", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;
    if (!token)
      return res.status(401).json({ message: "Không có quyền truy cập" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { fcmToken } = req.body;

    await prisma.users.update({
      where: { id: decoded.id },
      data: { fcmToken: fcmToken },
    });

    res.json({ success: true, message: "Lưu mã thiết bị thành công" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tích hợp Socket Handler
const socketHandler = require("./sockets/socketHandler");
socketHandler(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`=========================================`);

  // ============================================
  // KEEP-ALIVE: Ngăn Neon DB ngủ đông (cold start)
  // Neon DB free tier tự ngắt kết nối sau ~5 phút không hoạt động
  // Ping mỗi 4 phút để giữ kết nối luôn sẵn sàng
  // ============================================
  const DB_PING_INTERVAL = 4 * 60 * 1000; // 4 phút
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("🟢 [Keep-alive] DB ping thành công");
    } catch (err) {
      console.warn("🟡 [Keep-alive] DB ping thất bại:", err.message);
    }
  }, DB_PING_INTERVAL);

  // ============================================
  // KEEP-ALIVE: Ngăn Render.com ngủ đông (sleep)
  // Render free tier tự sleep sau 15 phút không có HTTP request
  // Self-ping mỗi 14 phút để server luôn thức
  // ============================================
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "";
  if (RENDER_URL) {
    const https = require("https");
    const http = require("http");
    const SELF_PING_INTERVAL = 14 * 60 * 1000; // 14 phút
    setInterval(() => {
      const client = RENDER_URL.startsWith("https") ? https : http;
      client.get(`${RENDER_URL}/health`, (res) => {
        console.log(`🟢 [Keep-alive] Self-ping Render: ${res.statusCode}`);
      }).on("error", (err) => {
        console.warn("🟡 [Keep-alive] Self-ping thất bại:", err.message);
      });
    }, SELF_PING_INTERVAL);
    console.log(`🔄 Keep-alive self-ping đã bật cho: ${RENDER_URL}`);
  }
});

// Health check endpoint (dùng bởi self-ping)
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
