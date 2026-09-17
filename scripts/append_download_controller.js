const fs = require('fs');

const codeToAppend = `

// ═══════════════════════════════════════════════════════
// 12. TẢI TRỰC TIẾP MEDIA VÀO MÁY (Direct Media Download Proxy)
// ═══════════════════════════════════════════════════════
exports.downloadMediaProxy = async (req, res) => {
    try {
        let { url, filename } = req.query;
        if (!url) {
            return res.status(400).send("Thiếu tham số URL");
        }

        // Tên tệp an toàn
        let safeFilename = filename ? path.basename(filename) : ("media_" + Date.now());
        safeFilename = safeFilename.replace(/[^a-zA-Z0-9._-]/g, "_");

        // Nếu là tệp cục bộ
        if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
            const relPath = url.startsWith("/") ? url.slice(1) : url;
            const localPath = path.join(__dirname, "..", relPath);
            if (fs.existsSync(localPath)) {
                return res.download(localPath, safeFilename);
            }
        }

        // Tải từ URL từ xa (Cloudflare R2, Supabase, Render...)
        let targetUrl = url;
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
            const port = process.env.PORT || 5000;
            targetUrl = "http://localhost:" + port + (targetUrl.startsWith("/") ? "" : "/") + targetUrl;
        }

        const response = await fetch(targetUrl);
        if (!response.ok) {
            return res.status(response.status).send("Không thể tải tệp từ nguồn: HTTP " + response.status);
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Disposition", 'attachment; filename="' + safeFilename + '"');
        res.setHeader("Content-Type", contentType);

        const contentLength = response.headers.get("content-length");
        if (contentLength) {
            res.setHeader("Content-Length", contentLength);
        }

        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("❌ Lỗi downloadMediaProxy:", err);
        return res.status(500).send("Lỗi máy chủ khi tải tệp: " + err.message);
    }
};
`;

['controllers/chat.controller.js', 'backend/controllers/chat.controller.js'].forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('exports.downloadMediaProxy')) {
      fs.appendFileSync(file, codeToAppend, 'utf8');
      console.log(`✅ Appended downloadMediaProxy to ${file}`);
    } else {
      console.log(`ℹ️ downloadMediaProxy already in ${file}`);
    }
  }
});
