require("dotenv").config();

// Tự động đồng bộ hóa cấu trúc Database khi khởi chạy ứng dụng (ví dụ trên Render)
try {
  const { execSync } = require("child_process");
  console.log("🔄 Đang tiến hành đồng bộ hóa cấu trúc Database (Prisma generate & db push)...");
  execSync("npx prisma generate && npx prisma db push --accept-data-loss", { stdio: "inherit" });
  console.log("✅ Đồng bộ hóa Database thành công!");
} catch (err) {
  console.error("⚠️ Cảnh báo: Lỗi tự động đồng bộ hóa Database:", err.message);
}

require("./firebaseConfig");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/auth.middleware");

const app = express();
const prisma = require("./prisma");

// Nén dữ liệu truyền tải (Gzip compression)
app.use(compression());

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
app.use(express.static(path.join(__dirname, "public")));

// Import Routes
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const userRoutes = require("./routes/user.routes");
const aiRoutes = require("./routes/ai.routes");

// Tạo một API test thử xem server chạy chưa (nếu từ trình duyệt thì trả về file index.html giao diện)
app.get("/", async (req, res) => {
  if (req.headers.accept && req.headers.accept.includes("text/html")) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }

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
          select: { id: true, fullName: true, isOnline: true },
        },
        receiver: {
          select: { id: true, fullName: true, isOnline: true },
        },
      },
    });

    const friends = friendships.map((f) => {
      const u = f.requesterId === userId ? f.receiver : f.requester;
      return {
        ...u,
        avatar: `/api/users/${u.id}/avatar`,
      };
    });
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
        Sender: { select: { id: true, fullName: true } },
      },
    });
    const mappedNotifications = notifications.map((n) => {
      if (n.Sender) {
        return {
          ...n,
          Sender: {
            ...n.Sender,
            avatar: `/api/users/${n.Sender.id}/avatar`,
          },
        };
      }
      return n;
    });
    res.json({ success: true, data: mappedNotifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Đánh dấu đã đọc tất cả thông báo
app.patch("/api/users/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await prisma.notifications.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
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
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        bio: true,
        isOnline: true,
        lastActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User không tồn tại." });
    // Map avatar & coverPhoto sang URL tĩnh để trả về client
    const mappedUser = {
      ...user,
      avatar: `/api/users/${user.id}/avatar`,
      coverPhoto: `/api/users/${user.id}/cover`,
    };
    res.json({ success: true, data: mappedUser });
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
app.use("/api/ai", aiRoutes);

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

app.post("/api/users/avatar", async (req, res) => {
  try {
    // Xác thực Token thủ công
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;

    if (!token)
      return res.status(401).json({ message: "Không có quyền truy cập" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { avatar } = req.body; // Base64 string from client
    if (!avatar)
      return res.status(400).json({ message: "Vui lòng chọn ảnh đại diện" });

    // Lưu thẳng Base64 string vào DB Neon
    await prisma.users.update({
      where: { id: decoded.id },
      data: { avatar: avatar },
    });

    res.json({ success: true, avatarUrl: `/api/users/${decoded.id}/avatar?v=${Date.now()}` });
  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi lưu ảnh đại diện", details: error.message });
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

// Middleware xử lý lỗi chung (Global Error Handler)
app.use((err, req, res, next) => {
  console.error("🔥 [Global Error] Lỗi Server:", err);
  res.status(err.status || 500).json({
    success: false,
    message: "Đã xảy ra lỗi hệ thống ở phía server.",
    error: err.message
  });
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
