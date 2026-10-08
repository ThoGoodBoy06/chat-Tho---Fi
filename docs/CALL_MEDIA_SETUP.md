# Gọi thoại và video trên web/PWA

## Triển khai bản sửa hiện tại

### 1. Backend Render

Mở dashboard Render và chọn backend đang phục vụ
`chat-tho-fi-vn-9s8u.onrender.com`. Kiểm tra repo và branch `main`.
Nếu auto-deploy đang bật, đợi commit mới được deploy. Nếu chưa cập nhật,
chọn **Manual Deploy → Deploy latest commit**, đợi trạng thái **Live**.
Không chỉ chọn Restart service, vì thao tác đó có thể chạy lại commit cũ.

Nguồn: https://render.com/docs/deploys

### 2. Cấu hình TURN bằng dịch vụ cung cấp username/password

Có thể dùng Metered hoặc nhà cung cấp TURN tương thích. Kiểm tra gói và hạn
mức băng thông của nhà cung cấp trước khi đăng ký.

Với Metered: đăng nhập dashboard, mở **TURN Server → Credentials**, tạo
credential và chọn **ICE / Show ICE Servers Array**. Lấy username, password
(trường `credential`) và các URL bắt đầu bằng `turn:` hoặc `turns:`.

Trong Render → backend → **Environment**, thêm ba biến:

| Biến | Giá trị |
|---|---|
| `TURN_URLS` | Các URL TURN lấy từ dashboard, cách nhau bằng dấu phẩy; giữ nguyên cổng và `?transport=...` |
| `TURN_USERNAME` | Username của TURN credential |
| `TURN_CREDENTIAL` | Password, tức trường `credential` của TURN |

Ưu tiên có cả URL UDP và URL TCP/TLS mà nhà cung cấp hỗ trợ để phục vụ các
mạng hạn chế UDP. Với cách này không đặt `TURN_SHARED_SECRET`: shared secret
chỉ dành cho máy chủ hỗ trợ cơ chế coturn bên dưới.

Chọn **Save, rebuild, and deploy**, đợi **Live**. Điền giá trị vào Render;
không cần gửi password qua chat hoặc lưu vào Git.

Nguồn:
- https://www.metered.ca/docs/turn-server-service/creating-turn-credentials/
- https://www.metered.ca/docs/dashboard/new-dashboard/
- https://render.com/docs/configure-environment-variables

### 3. Frontend Cloudflare Pages

Mở Cloudflare → **Workers & Pages → chat-tho-fi**.

Nếu dự án dùng Direct Upload, chọn **Create a new deployment**, môi trường
**Production**, tải lên toàn bộ thư mục
`C:\Du_an_nhantin_goidien\flutter_frontend\build\web`, rồi deploy.
Thư mục này phải chứa `index.html` ngay ở cấp đầu tiên; không tải cả thư mục
repo hoặc chỉ riêng `main.dart.js`.

Nếu dự án liên kết Git, dashboard không hỗ trợ kéo thả. Kiểm tra lần deploy
từ branch `main` đã sử dụng bản build mới, với thư mục đầu ra
`flutter_frontend/build/web` (hoặc đường dẫn tương ứng theo root directory
của dự án). Không đổi cấu hình Flutter hiện có khi chưa kiểm tra build log.

Sau deploy, mở `https://chat-tho-fi.pages.dev/release.json`. Bản đang chuẩn bị
phải có version `48c44e8fcaa501b7`. Nếu version khác, kiểm tra deployment
Production. Đóng rồi mở lại PWA để service worker nhận bản mới.

Nguồn: https://developers.cloudflare.com/pages/get-started/direct-upload/

### 4. Xác nhận TURN

Sau khi đăng nhập app, request `/api/call/ice-config` phải thành công và có
`relayConfigured: true`. Có thể xem trong Network của trình duyệt máy tính
khi bắt đầu cuộc gọi. Không chia sẻ phần username/credential trong response.
Mở trực tiếp endpoint trên thanh địa chỉ có thể nhận 401 vì thiếu header
Authorization; điều đó không chứng minh TURN bị lỗi.

`relayConfigured: true` chỉ xác nhận đã cấp cấu hình. Cần kiểm tra cuộc gọi
thật và ICE candidate loại `relay` để xác nhận máy chủ TURN hoạt động.

Trang phải dùng HTTPS, người dùng cho phép micro và camera khi gọi video.
Chrome/Safari kiểm soát quyền và việc tự phát âm thanh. Nếu bị chặn phát tiếng,
app hiện nút để người dùng chạm bật âm thanh.

## TURN cho hai điện thoại khác mạng

STUN không đủ cho mọi mạng di động hoặc NAT. Cấu hình TURN trên Render bằng:

- `TURN_URLS`: danh sách URL cách nhau bởi dấu phẩy, ví dụ các URL của máy chủ
  TURN bạn quản lý (UDP và TLS/TCP theo cấu hình máy chủ).
- `TURN_SHARED_SECRET`: shared secret của coturn với `use-auth-secret`.
  Backend cấp credential tạm thời một giờ qua `/api/call/ice-config`, yêu cầu
  đăng nhập và không cache. Secret không gửi xuống frontend.
- Nếu nhà cung cấp dùng credential cố định, thay shared secret bằng
  `TURN_USERNAME` và `TURN_CREDENTIAL`.

Không đưa secret vào mã nguồn. Endpoint chỉ cấp credential; nó không tự tạo
dịch vụ TURN. Nếu chưa cấu hình, app tiếp tục dùng STUN, chưa bảo đảm gọi được
giữa mọi mạng 4G/5G.

## Kiểm tra trên thiết bị thật sau triển khai

1. Hai tài khoản trên hai điện thoại, cho phép micro/camera.
2. Gọi thoại cả hai chiều, kiểm tra nói/nghe, tắt và bật lại micro.
3. Gọi video: camera hai bên, nút điều khiển, tắt/bật camera và kết thúc gọi.
4. Thử Wi-Fi chung, Wi-Fi khác nhau và Wi-Fi ↔ 4G/5G với TURN.
5. Từ chối quyền: phải có thông báo lỗi, không tiếp tục cuộc gọi im lặng.

Kiểm thử với thiết bị giả trong Chrome không chứng minh micro vật lý hoặc
định tuyến loa trên iOS/Android hoạt động; vẫn cần bước kiểm tra trên.
