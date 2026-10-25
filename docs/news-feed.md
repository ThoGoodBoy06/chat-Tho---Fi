# Tin tức và trạng thái tải

Tab Tin tức dùng RSS công khai, không dùng dữ liệu mẫu và không cần API key.

- Việt Nam: VnExpress Thời sự, Dân trí Thời sự.
- Thế giới: VnExpress Thế giới, Dân trí Thế giới.
- Công nghệ: VnExpress Khoa học công nghệ, Dân trí Công nghệ, Tinh tế.

Danh sách RSS chính thức: https://vnexpress.net/rss và https://dantri.com.vn/rss.htm.
RSS Tinh tế: https://tinhte.vn/rss.

## Luồng dữ liệu

`NewsTab` → `NewsService` → `GET /api/news` → `news_feed.service.js` → RSS của báo.

API trả tiêu đề, tóm tắt ngắn, tên báo, ngày xuất bản, ảnh và liên kết bài gốc. Bấm bài mở `NewsArticleScreen` ngay trong app, không tự mở tab ngoài. Tham số `category` chỉ nhận `Vietnam`, `World`, `Tech_AI`.

Backend chia sẻ một lần tải giữa các yêu cầu đồng thời, lưu đệm 10 phút, giới hạn thời gian 8 giây/nguồn và tối đa 2 MB/nguồn. Nếu một nguồn lỗi, giữ lại dữ liệu đã tải và tiếp tục dùng các nguồn khác; khi chưa có dữ liệu, trả lỗi có thể thử lại. Không đọc/quét/xóa bảng News trong database. Tác vụ cào tin cũ và tác vụ xóa lịch sử khi khởi động server đã được bỏ.

Frontend giữ tin trong bộ nhớ và SharedPreferences, tải lại khi quay lại tab nếu hết thời hạn, hoặc mỗi 10 phút khi tab còn hiển thị. Có kéo để làm mới và nút làm mới; mất mạng giữ các tiêu đề đã lưu.

## Ảnh trên Flutter Web

`GET /api/news/image/:id` chỉ xử lý ảnh của bài đã có trong RSS. Không nhận URL tùy ý. Chỉ chấp nhận HTTPS từ các CDN VnExpress, Dân trí, Tinh tế; không theo chuyển hướng. Ảnh được giới hạn 5 MB/20 triệu điểm ảnh, thu nhỏ tối đa 264×264, đổi sang WebP và trả CORS cho frontend Cloudflare Pages. Bộ đệm tối đa 10 MB/100 ảnh, tối đa ba ảnh xử lý cùng lúc. GIF trong RSS không được tải vào danh sách để tránh tải hoạt ảnh lớn. `sharp` và `fast-xml-parser` là dependency chạy thật của cả hai gói backend/root.

## Đọc bài trong app

`GET /api/news/:id/content` dùng ID của RSS hiện tại, không tra bảng News cũ. Backend lấy trang gốc từ danh sách nguồn cố định rồi phân tích thành các khối văn bản, tiêu đề, ảnh và chú thích. Client chỉ hiển thị dữ liệu có cấu trúc, không thực thi HTML, script hoặc iframe của nguồn.

- VnExpress: `article.fck_detail`.
- Dân trí: nội dung `#articleContent [data-slot="content"]` và sapo, có selector dự phòng cho bố cục cũ.
- Tinh tế: bài chính `.xfBody.big`, không lấy các bình luận bên dưới.

Giới hạn 3 MB/trang, timeout 12 giây, cache tối đa 60 bài/8 MB trong 30 phút, gộp các yêu cầu trùng. Nguồn bị chặn hoặc không cung cấp nội dung sẽ hiện tóm tắt và nút thử lại trong app; không giả báo đã tải đủ nội dung và không vượt đăng nhập/paywall.

`GET /api/news/:id/images/:imageId` chỉ trả ảnh thuộc bài đã phân tích, tối đa 1440 px mỗi chiều, giữ tỷ lệ, không crop. Chỉ các CDN đã cho phép mới được tải; ảnh gốc tối đa 12 MB và 20 triệu điểm ảnh. Ảnh có khung chờ và nút thử lại. Chạm ảnh mở màn hình xem lớn, hỗ trợ kéo/phóng to bằng `InteractiveViewer`, quay lại về bài đang đọc.

Frontend giữ tối đa tám bài trong bộ nhớ để mở lại nhanh. Nút quay lại bài viết giữ nguyên mục tin và vị trí danh sách. Có nút tải lại bài, nút quay lại luôn hoạt động cả khi nguồn lỗi.

## Skeleton

`SkeletonBox` chỉ thay đổi độ mờ, giữ nguyên hình học và dừng khi tắt chuyển động trong cài đặt hệ thống hoặc TickerMode bị tắt.

- `AppAvatar`: giữ đúng đường kính, khung tròn chờ ảnh; ảnh lỗi/không có ảnh chuyển sang chữ hoặc biểu tượng.
- `LoadingPhoto`: khung chữ nhật khớp ảnh bìa.
- `NewsArticleRow`: dùng chung các ô ảnh, tiêu đề, nguồn và tóm tắt cho cả lúc tải và lúc có dữ liệu.
- Danh sách hội thoại/danh bạ và màn hình trang cá nhân dùng đúng khoảng cách, kích thước, vị trí của nội dung thật.
- Ảnh tin nhắn giữ ô 240×180 cả trước và sau giải mã.

## Kiểm tra và phát hành

```powershell
node --test scripts/test-news-feed.cjs scripts/test-news-article.cjs
# Trong flutter_frontend:
flutter test --no-pub test/news_tab_test.dart test/app_avatar_test.dart test/skeleton_positions_test.dart test/news_article_screen_test.dart
```

`scripts/test-news-ui.cjs` kiểm tra Chrome/WebKit với RSS thật, ba mục, ảnh qua backend và màn hình đọc trong app, xem ảnh lớn và quay lại. Cần Playwright, browser binaries và fixture được biên dịch bằng `scripts/prepare-mobile-call-test.cjs`; fixture chỉ ở scratch, không dùng để publish.

Sau khi cập nhật phải triển khai cả backend (Render) và bundle Flutter (Cloudflare Pages); bản frontend mới gọi `/api/news/image/:id`, `/api/news/:id/content` và `/api/news/:id/images/:imageId`. Không cần migrate database hay cấu hình khóa mới.
