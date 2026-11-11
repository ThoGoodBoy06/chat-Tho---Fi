const prisma = require("../prisma");
let sharp;
try { sharp = require("sharp"); } catch (_) {}

// Bộ nhớ đệm RAM lưu trữ binary avatar và cover photo giúp phản hồi siêu tốc (<1ms) mà không tốn DB Query
const avatarCache = new Map(); // id -> { buffer, contentType, timestamp }
const coverCache = new Map();  // id -> { buffer, contentType, timestamp }

const CACHE_TTL = 3600 * 1000; // 1 giờ

function clearUserImageCache(userId) {
  if (!userId) return;
  avatarCache.delete(userId);
  coverCache.delete(userId);
}
exports.clearUserImageCache = clearUserImageCache;

const AVATAR_PALETTE = [
  ["#0068FF", "#00C6FF"],
  ["#6366F1", "#8B5CF6"],
  ["#EC4899", "#F43F5E"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#EA580C"],
  ["#0EA5E9", "#2563EB"],
];

function getInitialsFromName(name) {
  const clean = (name || "U").toString().trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

async function generateInitialsPngBuffer(name) {
  const initials = getInitialsFromName(name)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  let hash = 0;
  const str = (name || "User").toString();
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const [c1, c2] = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="128" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-weight="700" font-size="96">${initials}</text>
  </svg>`;
  if (sharp) {
    return await sharp(Buffer.from(svg)).png().toBuffer();
  }
  return Buffer.from(svg);
}

function sendBinaryImage(res, buffer, contentType, maxAge = 86400) {
  res.writeHead(200, {
    "Content-Type": contentType || "image/jpeg",
    "Content-Length": buffer.length,
    "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  return res.end(buffer);
}

// Endpoint lấy ảnh đại diện của User dưới dạng file ảnh binary thực tế
exports.getUserAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === "null" || id === "undefined") {
      const fallbackBuf = await generateInitialsPngBuffer("U");
      return sendBinaryImage(res, fallbackBuf, sharp ? "image/png" : "image/svg+xml", 3600);
    }

    let cleanId = id.trim();
    if (cleanId.startsWith("@")) {
      cleanId = cleanId.substring(1).trim();
    }

    // 1. Kiểm tra RAM cache
    const cached = avatarCache.get(cleanId);
    if (cached && cached.buffer && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return sendBinaryImage(res, cached.buffer, cached.contentType);
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

    const rawAvatar = user && user.avatar ? user.avatar.trim() : "";
    // Ngăn vòng lặp tự trỏ vào /api/users/:id/avatar
    if (!user || !rawAvatar || rawAvatar.includes(`/api/users/`)) {
      const pngBuffer = await generateInitialsPngBuffer(user ? (user.fullName || "U") : "U");
      const contentType = sharp ? "image/png" : "image/svg+xml";
      const entry = { buffer: pngBuffer, contentType, timestamp: Date.now() };
      avatarCache.set(cleanId, entry);
      if (user && user.id) avatarCache.set(user.id, entry);
      return sendBinaryImage(res, pngBuffer, contentType, 3600);
    }

    // Nếu là đường dẫn URL http(s) (VD: Supabase Storage / Cloudflare R2) -> tải & lưu đệm binary vào RAM
    if (rawAvatar.startsWith("http://") || rawAvatar.startsWith("https://")) {
      try {
        const resp = await fetch(rawAvatar);
        if (resp.ok) {
          const contentType = resp.headers.get("content-type") || "image/jpeg";
          const buffer = Buffer.from(await resp.arrayBuffer());
          if (buffer.length > 0) {
            const entry = { buffer, contentType, timestamp: Date.now() };
            avatarCache.set(cleanId, entry);
            if (user.id) avatarCache.set(user.id, entry);
            return sendBinaryImage(res, buffer, contentType);
          }
        }
      } catch (_) {}
      const pngBuffer = await generateInitialsPngBuffer(user.fullName || "U");
      return sendBinaryImage(res, pngBuffer, sharp ? "image/png" : "image/svg+xml", 300);
    }

    // Nếu là đường dẫn file tĩnh cục bộ (/uploads/... hoặc /avatars/...)
    if (rawAvatar.startsWith("/")) {
      const path = require("path");
      const fs = require("fs");
      const rel = rawAvatar.replace(/^\/+/, "");
      const candidates = [
        path.join(__dirname, "..", rel),
        path.join(__dirname, "..", "public", rel),
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const buffer = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
          const entry = { buffer, contentType, timestamp: Date.now() };
          avatarCache.set(cleanId, entry);
          if (user.id) avatarCache.set(user.id, entry);
          return sendBinaryImage(res, buffer, contentType);
        }
      }
    }

    // Nếu là chuỗi Data URL Base64 (VD: data:image/png;base64,...)
    const matches = rawAvatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      const entry = { buffer, contentType, timestamp: Date.now() };
      avatarCache.set(cleanId, entry);
      if (user.id) avatarCache.set(user.id, entry);
      return sendBinaryImage(res, buffer, contentType);
    }

    // Trả về trực tiếp nếu là Base64 thuần không có tiền tố data:
    try {
      const buffer = Buffer.from(rawAvatar, "base64");
      const entry = { buffer, contentType: "image/jpeg", timestamp: Date.now() };
      avatarCache.set(cleanId, entry);
      if (user.id) avatarCache.set(user.id, entry);
      return sendBinaryImage(res, buffer, "image/jpeg");
    } catch (e) {
      const pngBuffer = await generateInitialsPngBuffer(user.fullName || "U");
      return sendBinaryImage(res, pngBuffer, sharp ? "image/png" : "image/svg+xml", 3600);
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

// Lookup user by ID (for QR scan / profile screen) - returns user info + relationship status
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

    // 1. Kiểm tra UUID regex để tránh lỗi khi tìm kiếm username/SĐT
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanId);
    let user = null;
    if (isUuid) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, "fullName", username, phone, email, "isOnline", bio,
                  (avatar IS NOT NULL AND LENGTH(TRIM(avatar)) > 0) AS "hasAvatar",
                  ("coverPhoto" IS NOT NULL AND LENGTH(TRIM("coverPhoto")) > 0) AS "hasCover"
           FROM "Users" WHERE id = $1 LIMIT 1`,
          cleanId
        );
        if (rows && rows.length > 0) user = rows[0];
      } catch (_) {}

      // Nếu cleanId là UUID nhưng không phải User ID, kiểm tra xem có phải mã phòng chat Conversation ID không
      if (!user) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT u.id, u."fullName", u.username, u.phone, u.email, u."isOnline", u.bio,
                    (u.avatar IS NOT NULL AND LENGTH(TRIM(u.avatar)) > 0) AS "hasAvatar",
                    (u."coverPhoto" IS NOT NULL AND LENGTH(TRIM(u."coverPhoto")) > 0) AS "hasCover"
             FROM "ConversationMembers" cm
             JOIN "Users" u ON u.id = cm."userId"
             WHERE cm."conversationId" = $1 AND ($2::text IS NULL OR cm."userId" <> $2)
             LIMIT 1`,
            cleanId,
            currentUserId || null
          );
          if (rows && rows.length > 0) user = rows[0];
        } catch (_) {}
      }
    }

    // 2. Fallback: Tra cứu theo username, phone hoặc email
    if (!user) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, "fullName", username, phone, email, "isOnline", bio,
                  (avatar IS NOT NULL AND LENGTH(TRIM(avatar)) > 0) AS "hasAvatar",
                  ("coverPhoto" IS NOT NULL AND LENGTH(TRIM("coverPhoto")) > 0) AS "hasCover"
           FROM "Users"
           WHERE LOWER(username) = LOWER($1) OR phone = $1 OR LOWER(email) = LOWER($1)
           LIMIT 1`,
          cleanId
        );
        if (rows && rows.length > 0) user = rows[0];
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
        const [fr, fRecord] = await Promise.all([
          prisma.friendRequests.findFirst({
            where: {
              OR: [
                { requesterId: currentUserId, receiverId: user.id },
                { receiverId: currentUserId, requesterId: user.id },
              ],
            },
          }),
          prisma.friends
            ? prisma.friends.findFirst({
                where: {
                  OR: [
                    { senderId: currentUserId, receiverId: user.id },
                    { receiverId: currentUserId, senderId: user.id },
                  ],
                },
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

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

    const hasAvatar = Boolean(user.hasAvatar);
    const hasCover = Boolean(user.hasCover);
    const avatarPath = `/api/users/${user.id}/avatar`;
    const coverPath = hasCover ? `/api/users/${user.id}/cover` : null;

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
        hasAvatar,
        hasCover,
        avatar: avatarPath,
        avatarUrl: avatarPath,
        coverPhoto: coverPath,
        coverImage: coverPath,
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

    // 1. Tìm các yêu cầu kết bạn đã ACCEPTED + kiểm tra bảng Friends song song
    const [acceptedRequests, friendsRecords] = await Promise.all([
      prisma.friendRequests.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: userId },
            { receiverId: userId },
          ],
        },
        select: {
          requesterId: true,
          receiverId: true,
        },
      }),
      prisma.friends
        ? prisma.friends.findMany({
            where: {
              OR: [{ senderId: userId }, { receiverId: userId }],
              status: { in: ["accepted", "ACCEPTED"] },
            },
            select: {
              senderId: true,
              receiverId: true,
            },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const friendIdsSet = new Set();
    for (const r of acceptedRequests) {
      const fid = r.requesterId === userId ? r.receiverId : r.requesterId;
      if (fid && fid !== userId) friendIdsSet.add(fid);
    }
    for (const f of friendsRecords) {
      const fid = f.senderId === userId ? f.receiverId : f.senderId;
      if (fid && fid !== userId) friendIdsSet.add(fid);
    }

    const friendIds = Array.from(friendIdsSet);
    if (friendIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const friendUsers = await prisma.$queryRawUnsafe(
      `SELECT id, "fullName", username, phone, email, "isOnline", "lastActive",
              (avatar IS NOT NULL AND LENGTH(TRIM(avatar)) > 0) AS "hasAvatar"
       FROM "Users"
       WHERE id = ANY($1::text[])`,
      friendIds
    );

    const friendsList = friendUsers.map((friend) => {
      const hasCustomAvatar = Boolean(friend.hasAvatar);
      return {
        id: friend.id,
        fullName: friend.fullName || friend.username,
        username: friend.username,
        phone: friend.phone,
        email: friend.email,
        isOnline: friend.isOnline,
        lastActive: friend.lastActive,
        avatar: hasCustomAvatar ? `/api/users/${friend.id}/avatar` : null,
        avatarUrl: hasCustomAvatar ? `/api/users/${friend.id}/avatar` : null,
        avatar_url: hasCustomAvatar ? `/api/users/${friend.id}/avatar` : null,
        hasAvatar: hasCustomAvatar,
        status: "FRIEND",
        relationship: "friends",
      };
    });

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

    // Hàm bỏ dấu Tiếng Việt chuẩn hóa
    function removeAccents(str) {
      if (!str) return "";
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "d")
        .toLowerCase();
    }

    const keyword = (q || "").trim();
    const hasQuery = keyword.length > 0;
    const lowerQ = keyword.toLowerCase();
    const cleanQ = removeAccents(lowerQ);

    // Query tất cả user mà KHÔNG kéo chuỗi Base64 avatar nặng nề từ DB
    const allUsers = await prisma.$queryRawUnsafe(
      `SELECT id, "fullName", username, phone, email, "isOnline",
              (avatar IS NOT NULL AND LENGTH(TRIM(avatar)) > 0) AS "hasAvatar"
       FROM "Users"
       LIMIT 200`
    );

    let scoredUsers = [];

    if (!hasQuery) {
      // Khi không nhập từ khóa: hiển thị tất cả user trừ bản thân
      scoredUsers = allUsers
        .filter((u) => u.id !== currentUserId)
        .map((u) => ({ user: u, score: 0 }));
    } else {
      // Khi có từ khóa: tính điểm xếp hạng thông minh
      for (const u of allUsers) {
        const name = (u.fullName || "").trim();
        const uname = (u.username || "").trim();
        const phone = (u.phone || "").trim();
        const email = (u.email || "").trim();

        const nLower = name.toLowerCase();
        const nClean = removeAccents(name);
        const uLower = uname.toLowerCase();
        const uClean = removeAccents(uname);

        let score = 0;

        if (nLower.startsWith(lowerQ) || nClean.startsWith(cleanQ)) {
          score += 1000;
        }

        const words = nClean.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (words[i].startsWith(cleanQ)) {
            score += 500;
            break;
          }
        }

        if (uLower.startsWith(lowerQ) || uClean.startsWith(cleanQ)) {
          score += 300;
        }

        if (cleanQ.length >= 2) {
          if (nClean.includes(cleanQ)) {
            score += 100;
          }
          if (uClean.includes(cleanQ)) {
            score += 50;
          }
        }

        if (phone && phone.includes(keyword)) {
          score += 40;
        } else if (email && email.toLowerCase().includes(lowerQ)) {
          score += 40;
        }

        if (score > 0) {
          scoredUsers.push({ user: u, score });
        }
      }

      scoredUsers.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const nameA = a.user.fullName || a.user.username || "";
        const nameB = b.user.fullName || b.user.username || "";
        return nameA.localeCompare(nameB, "vi");
      });
    }

    const users = scoredUsers.map((item) => item.user);
    const targetUserIds = users.map((u) => u.id);

    const [friendRequests, friendsRecords] = await Promise.all([
      targetUserIds.length > 0
        ? prisma.friendRequests.findMany({
            where: {
              OR: [
                { requesterId: currentUserId, receiverId: { in: targetUserIds } },
                { receiverId: currentUserId, requesterId: { in: targetUserIds } },
              ],
            },
          })
        : Promise.resolve([]),
      prisma.friends && targetUserIds.length > 0
        ? prisma.friends.findMany({
            where: {
              OR: [
                { senderId: currentUserId, receiverId: { in: targetUserIds } },
                { receiverId: currentUserId, senderId: { in: targetUserIds } },
              ],
            },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

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

      const hasCustomAvatar = Boolean(u.hasAvatar);
      return {
        id: u.id,
        fullName: u.fullName || u.username,
        username: u.username,
        phone: u.phone,
        email: u.email,
        isOnline: u.isOnline,
        avatar: hasCustomAvatar ? `/api/users/${u.id}/avatar` : null,
        hasAvatar: hasCustomAvatar,
        status,
        relationship,
      };
    });

    return res.status(200).json({
      success: true,
      data: mappedUsers,
    });
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

