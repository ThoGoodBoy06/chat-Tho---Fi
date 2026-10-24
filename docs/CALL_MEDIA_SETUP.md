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

## Chẩn đoán mất tiếng và kiểm thử hồi quy (19/10/2026)

Đã tái hiện lỗi bằng Dart biên dịch chạy trong Chrome, thay vì chỉ dùng mock:

- `MediaStream.getAudioTracks()` trả danh sách JS có kiểu phần tử động; `.any()` với callback kiểu `MediaStreamTrack` có thể ném lỗi kiểu. Duyệt track bằng vòng lặp để tránh lỗi này.
- Binding `dart:html` của SDK hiện tại ép kết quả Promise từ `createOffer`/`createAnswer` sang `RTCSessionDescription`, trong khi trình duyệt trả SDP dictionary. `createCallDescription` nhận dictionary qua `dart:js_util` và trả về map.
- `dart:js` bọc đối tượng stream khi gọi helper: kiểm thử nhận RTP nhưng `remoteAudioPlayer.srcObject` vẫn null. Bridge dùng `dart:js_util.callMethod` để giữ nguyên đối tượng `MediaStream` gốc.
- Chỉ `remoteAudioPlayer` phát tiếng. Video luôn mute; không phát thêm cùng stream qua AudioContext. Bỏ các video tĩnh trùng ID với video do Flutter quản lý.

Kiểm thử browser: `scripts/fixtures/call_transport.dart` dùng đúng helper production, xin micro/camera giả lập, gửi một tone đã biết qua hai peer, kiểm tra RTP cả hai chiều, RMS của âm thanh sau giải mã và trạng thái thẻ audio. Đây là kiểm thử loopback trên máy, chưa thay thế kiểm tra hai điện thoại trên hai mạng thực tế.

Chạy từ thư mục gốc, thay `$FlutterSdk` bằng SDK cục bộ và cài Playwright hoặc đặt `NODE_PATH` tới nơi đã cài Playwright:

```powershell
& "$FlutterSdk/bin/cache/dart-sdk/bin/dart.exe" --disable-dart-dev "$FlutterSdk/bin/cache/dart-sdk/bin/snapshots/dart2js.dart.snapshot" "--platform-binaries=$FlutterSdk/bin/cache/flutter_web_sdk/kernel" --invoker=flutter_tool --packages=flutter_frontend/.dart_tool/package_config.json -O4 -o scratch/call-transport.js scripts/fixtures/call_transport.dart
node scripts/test-call-browser.cjs
node scripts/test-call-audio-engine.js
node scripts/test-call-media.js
```

Không xem username/password OpenRelay công cộng cũ là cấu hình TURN hợp lệ. Probe relay tại thời điểm kiểm tra không cấp được relay candidate. Backend chỉ báo `relayConfigured: true` khi có cấu hình riêng; cờ này vẫn chưa chứng minh server truy cập được. Tài liệu Metered hiện yêu cầu tài khoản/API key để lấy thông tin TURN: https://www.metered.ca/tools/openrelay/

Trên Render, đặt `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` từ dịch vụ TURN của bạn, hoặc `TURN_URLS` và `TURN_SHARED_SECRET` cho coturn. Chưa có TURN thì gọi trực tiếp vẫn có thể chạy ở mạng cho phép P2P, nhưng không bảo đảm qua 4G/NAT. Không lưu credentials vào Git.

## Nhận cuộc gọi trên điện thoại (19/10/2026)

- Gọi đi: xin micro/camera từ thao tác bấm nút, xác nhận track còn live rồi mới gửi `request_call`. Máy không có micro sẽ báo lỗi tại chỗ, không làm máy đối phương đổ chuông rồi tự đóng khi bấm nhận.
- Nhận cuộc gọi: giữ nguyên màn hình đến khi quyền/thiết bị sẵn sàng, rồi mới gửi `accept_call`. Lỗi quyền/thiết bị hiện ngay trên màn hình đến và có thể thử nhận lại; track trả về sau khi caller đã cúp được dừng.
- Bỏ việc đóng route trên cùng theo `Navigator.pop` trong callback cũ. `dismissCallRoute` chỉ xóa route sở hữu callback; callback lặp và context hết hiệu lực không đóng route đang gọi.
- Server chờ 15 giây sau khi socket của thiết bị gọi bị mất. Kết nối lại hủy timer và cập nhật socket sở hữu cuộc gọi. Timer từ cuộc gọi cũ không kết thúc cuộc gọi mới; mất kết nối thật quá thời gian chờ vẫn kết thúc bình thường.
- Kiểm thử: 14 Flutter tests (media, navigation, SDP/ICE queue/inbox), 7 tests server cho disconnect/reconnect, yêu cầu trùng và gọi đồng thời, và browser test Dart tối ưu `-O4` đo RTP/RMS hai chiều ở cả voice/video. Đây chưa phải xác nhận trực tiếp trên hai điện thoại thật.

Lệnh kiểm thử server mới: `node scripts/test-call-disconnect.js`.

## PWA iPhone: chuyển màn hình nhận và cập nhật mã (19/10/2026)

- Mở màn hình đang gọi trước, đợi frame đầu rồi mới xóa màn hình cuộc gọi đến. Không tạo khoảng trống giữa hai route khi màn hình/quyền thiết bị thay đổi.
- Gắn callId cho yêu cầu, SDP/ICE, nhận/từ chối/kết thúc và status. Client/server bỏ sự kiện trễ của phiên cũ. Không xóa hàng đợi SDP chỉ vì nhận bất kỳ call_ended nào.
- Worker cũ dùng pathname nên bỏ qua ?v= của JavaScript. Loader xác nhận release online rồi xóa ba file code cũ trong cache công khai; giữ font/tài nguyên/dữ liệu khác. Nếu không lấy được release, giữ code offline hiện có.
- 16 Flutter tests và 9 server tests qua. Test ChatScreen thực ở viewport mobile: nhận thoại/video, thu nhỏ viewport trong khi xin media, bỏ tín hiệu kết thúc cũ, kiểm tra RTP/âm thanh giải mã hai chiều, gác máy. Micro/camera của test là thiết bị giả trên Chromium.
- Kiểm thử cập nhật PWA với worker cũ và fallback khi release không truy cập được đều qua trên Chromium và WebKit Windows. WebKit Windows không cung cấp RTCPeerConnection, nên không dùng nó để kết luận cuộc gọi iPhone đã hoạt động. Chưa kiểm thử trên iPhone/PWA vật lý.

Tạo bundle kiểm thử riêng (không xuất bản):

```powershell
node scripts/prepare-mobile-call-test.cjs "$FlutterSdk"
node scripts/test-mobile-call-ui.cjs
node scripts/test-pwa-code-update.cjs
# Có thể đặt TEST_WEBKIT=1 và PLAYWRIGHT_BROWSERS_PATH cho test cache WebKit.
```

Các browser tests cần Playwright trong node_modules hoặc NODE_PATH. Build production từ lib/main.dart; build script từ chối dependency scripts/fixtures để tránh phát hành app test tự đăng nhập.

## Sửa phiên gọi và giao diện mobile (24/10/2026)

- Backend giữ chỗ cặp gọi đồng bộ trước khi đợi DB/push; hủy trong lúc DB chờ không tạo lại phiên ma. Phát chuông qua socket trước khi lấy token/gửi push. Push không chặn việc bắt máy.
- accept_call có acknowledgement: màn hình đến chỉ chuyển khi máy chủ xác nhận; chờ socket kết nối lại tối đa 10 giây khi quyền thiết bị làm gián đoạn. Không xóa SDP đã đến sớm trong lúc chờ xác nhận.
- Lưu tối đa 128 SDP/ICE khi đối phương tạm mất socket và phát lại một lần khi kết nối lại. Thiết bị khác không được từ chối phiên đã nhận. Dọn dẹp bất đồng bộ của cuộc gọi cũ không xóa phiên mới.
- HTTP status/end yêu cầu đăng nhập và kiểm tra đúng người tham gia; frontend dùng API có Authorization để đọc status.
- CallSurface dùng chung cho thoại/video/chuông/kết thúc, có safe area, nút 60px, trạng thái lỗi giữ lại để đọc. Khi kết nối, timer hiện 00:00 ngay; tính bằng thời gian trôi qua thay vì đếm callback, giữ tổng thời gian khi kết thúc, hỗ trợ HH:MM:SS.
- Khi micro bị hệ thống mute, hiển thị nút thử lại; thao tác này xin micro mới và replaceTrack, giữ video/phiên hiện có. Lỗi mở thiết bị hiển thị trên màn hình thay vì tự biến mất.
- 17 Flutter tests, 15 tests server qua. Browser test ChatScreen thực: voice/video, đổi viewport khi nhận, timer, mute/unmute, replaceTrack sau sự kiện mute, âm thanh giải mã hai chiều và hangup. Ép lỗi tạo peer cho thấy lỗi được giữ trên màn hình và phiên máy chủ được giải phóng. Camera xanh/tone trong browser test là thiết bị giả, không xuất bản fixture.
- Full-system script truy cập được DB, Supabase/R2, dispatcher và cấu hình Firebase. Kiểm tra HTTP localhost không đạt vì không chạy server local; dòng kết luận chung của script không chứng minh cuộc gọi trên thiết bị thật.

Kiểm tra hosting ngày 24/10: Cloudflare Workers & Pages chỉ có hai dự án Pages (chat-tho-fi và hotrosinhvien-dnc); chưa có Worker backend của app. TURN Server chuyển tới trang Get Started, chưa kích hoạt. Render vẫn trả release.json và frontend vẫn nối API/Socket.IO tới Render. Chưa di chuyển backend sang Cloudflare và chưa xác thực TURN thật. Không bảo đảm gọi qua hai mạng khác nhau khi chưa có relay. Cần kiểm tra hai điện thoại thật trước khi kết luận lỗi mobile đã hết hoàn toàn.

## Gọi lại và nâng cuộc gọi thoại lên video (24/10/2026)

- Đã tái hiện trên cùng ChatScreen: gác máy, đóng màn hình kết thúc, bấm Gọi Video nhưng không có request_call mới. Cờ _isCallRoomShowing chỉ được gỡ trong Future của showGeneralDialog; SDK Flutter hiện dùng removeRoute mà không hoàn tất popped Future. Gỡ cờ ngay khi đóng route và gắn owner riêng để callback cũ không thay đổi cờ của phiên mới.
- Bỏ header Tho-Fi / Cuộc gọi thoại-video theo yêu cầu. Giữ tên đối phương, trạng thái, thời gian và nút điều khiển.
- Nút Bật video trong cuộc gọi thoại chỉ xin camera, giữ microphone và thời gian. Thêm track vào peer hiện có, thương lượng lại SDP. Bên nhận nhìn thấy video và tự bấm Bật video nếu muốn mở camera của mình. Từ chối quyền camera giữ nguyên cuộc gọi thoại.
- Xử lý offer va chạm khi hai bên cùng nâng video: một phía rollback, trả lời offer của bên kia rồi gửi lại thay đổi local đang chờ. Server cập nhật callType cho cả cặp đang gọi, giữ cùng callId.
- Browser test kiểm tra framesDecoded, videoWidth và readyState của video hiển thị ở hai phía; âm thanh vẫn nhận sau khi chuyển video. Gọi trực tiếp video và gọi lại liên tiếp theo cả hai hướng trên cùng hai trang; bài test giữ hai offer rồi phát cùng lúc để kiểm tra va chạm thật.
- 17 Flutter tests và 16 tests server qua. Voice/video browser scenarios qua, gồm gọi lại, camera bị từ chối, nâng video và nâng video đồng thời. Thiết bị camera/micro là giả lập của Chrome; chưa thay thế xác nhận trên hai điện thoại thật.

## Thông báo PWA khi khóa màn hình / thoát app (24/10/2026)

- Firebase dry-run: 3 device tokens (2 web_mobile, 1 web_desktop) được chấp nhận. Dry-run của payload incoming_call, call_ended và chat_message thực từ helper đều được Firebase chấp nhận; không gửi thông báo thật tới tài khoản khác và không ghi tokens ra log.
- Sửa cuộc gọi chỉ gửi tới Users.fcmToken gần nhất: gọi sendPushNotification bằng userId để lấy toàn bộ UserDevices. Không kết luận offline chỉ vì legacy token trống. Kiểm tra phiên còn tồn tại ngay trước khi gửi để tránh thông báo gọi sau khi đã hủy.
- Push cuộc gọi có callId, conversationId, thời điểm hết hạn, TTL 60 giây và tag theo phiên; end-update TTL 120 giây, không làm rung lại. Push kết thúc vẫn có thông báo hiển thị, tránh mô hình silent web push bị Safari thu hồi quyền. Không đóng mọi banner của các phiên khác.
- Khi bấm banner: PWA đang mở nhận intent và focus, không reload làm ngắt cuộc gọi. Khi app đã đóng, mở URL cùng origin với conversationId / callId; ChatScreen yêu cầu sync_pending_call sau khi đã cài listener. Máy chủ phát lại phiên chưa nhận, dùng trạng thái xác thực trên server thay vì tự nhận cuộc gọi theo URL.
- Tự cập nhật lại đăng ký đã được cấp quyền khi load, online hoặc resume (giới hạn 1 lần/phút); không tự bật hộp xin quyền. Chỉ thao tác Bật thông báo mới xin quyền. Loader tải web_notifications.js sau khi vô hiệu cache code cũ, đã kiểm tra fallback offline.
- 12 push tests, 17 call-server tests qua; cold-start ChatScreen browser test qua: đóng trang nhận trước khi gọi, mở lại như từ push, nhận cuộc gọi, RTP/audio/video frames, nâng video và gọi lại. Cache online/offline qua cả Chromium và WebKit Windows.
- Chưa xác nhận nhận push thực trên màn hình khóa iOS/Android. Kiểm thử code và Firebase dry-run không chứng minh OS đã hiển thị. Mở PWA > Cài đặt > Thông báo > Bật/Cập nhật > Thử gửi thông báo; sau đó khóa màn hình và thử tin nhắn/cuộc gọi từ tài khoản thứ hai.
- iOS hỗ trợ Web Push cho app thêm vào màn hình chính từ iOS 16.4, cần cho phép thông báo. Khóa/tắt màn hình hoặc ra khỏi app khác với tắt nguồn. PWA không tích hợp màn hình cuộc gọi hệ thống như CallKit; bấm thông báo mở app rồi nhận cuộc gọi.

Nguồn: https://webkit.org/blog/13878/ và https://firebase.google.com/docs/cloud-messaging/web/receive-messages

## Thông báo nền khởi động nguội và video bị cắt (25/10/2026)

- Worker push-5 xử lý trực tiếp sự kiện Push API, giữ nguyên URL/scope và token FCM hiện có. Không tải Firebase SDK từ CDN khi iOS đánh thức worker. Chỉ worker này sở hữu việc hiện thông báo, cả payload notification và data-only đều hiển thị đúng một lần; không cần trang app hoặc Socket.IO hoạt động.
- Gọi showNotification ngay trong push và đăng ký event.waitUntil đồng bộ. Đồng bộ trạng thái kết thúc cuộc gọi với cửa sổ chạy song song, không trì hoãn hiển thị khi cửa sổ bị treo. Payload hỏng vẫn có thông báo dự phòng để tránh silent push trên Safari.
- Cả video đối phương lẫn preview camera dùng object-fit:contain, căn giữa, nền tối; giữ nguyên tỉ lệ và toàn bộ khung camera, không cắt thành khung dọc gây cảm giác zoom. Preview chỉ lật ngang, không phóng hình.
- scripts/test-push-cold-worker.cjs khởi chạy Chrome thật, đăng ký đúng worker/scope, đóng trang app, dừng worker rồi bơm envelope FCM qua CDP. Tin nhắn và cuộc gọi đều hiển thị đúng một thông báo sau cold start. Đây là kiểm thử vòng đời worker; không phải gửi qua APNs hay xác nhận trên màn hình khóa iPhone thật.
- scripts/test-mobile-call-ui.cjs kiểm tra framesDecoded cùng computed object-fit của cả hai video trên khung mobile. Chưa có thiết bị iOS thật để xác nhận hành vi hệ điều hành; không coi kiểm thử Chrome hoặc Firebase dry-run là bằng chứng giao nhận trên iPhone.

## Khôi phục đăng ký push iOS (25/10/2026)

- Kiểm tra lại dữ liệu đăng ký: có 2 web_mobile và 1 web_desktop, Firebase dry-run chấp nhận cả 3. Payload thực trong sendMessage (khác helper dùng cho cuộc gọi/test) cũng được Firebase chấp nhận. Chưa đủ bằng chứng xác định nguyên nhân iPhone không nhận.
- Nút làm mới trước đây chỉ lấy lại token từ cache. Nay thao tác chủ động này xóa token/subscription cũ qua Firebase rồi đăng ký lại; khởi động/resume bình thường vẫn giữ nguyên subscription. Tuần tự hóa yêu cầu lấy token với thao tác làm mới.
- Chỉ trả token để lưu sau khi xác nhận PushSubscription có endpoint, p256dh và auth; đăng ký rỗng của WebKit hiện lỗi thay vì báo bật thành công. Không ghi endpoint/key/token ra log.
- 15 tests thông báo qua, gồm làm mới thủ công, giữ subscription khi tự khởi động, đăng ký rỗng và yêu cầu đồng thời. Cold-worker Chrome và cập nhật cache online/offline qua. Chưa kiểm chứng giao nhận APNs trên iPhone thật; cần kết quả “Thử gửi” của chính thiết bị để phân biệt đăng ký với giao nhận.
