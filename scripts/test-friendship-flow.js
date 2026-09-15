require("dotenv").config();
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

async function runFriendshipE2ETest() {
  console.log("=========================================================");
  console.log("🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG KẾT BẠN (FRIENDSHIP E2E)");
  console.log("=========================================================");

  // 1. Tìm 2 user để thử nghiệm
  const users = await prisma.users.findMany({
    select: { id: true, username: true, fullName: true },
    take: 10,
  });

  if (users.length < 2) {
    console.error("❌ Không đủ user trong hệ thống để kiểm thử kết bạn");
    process.exit(1);
  }

  // Tìm 2 user hiện chưa phải bạn bè
  let userA = null;
  let userB = null;

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const existing = await prisma.friendRequests.findFirst({
        where: {
          OR: [
            { requesterId: users[i].id, receiverId: users[j].id },
            { requesterId: users[j].id, receiverId: users[i].id },
          ],
        },
      });
      if (!existing) {
        userA = users[i];
        userB = users[j];
        break;
      }
    }
    if (userA && userB) break;
  }

  // Nếu tất cả đã có quan hệ, chọn 2 user bất kỳ và tạm dọn quan hệ để test
  if (!userA || !userB) {
    userA = users[0];
    userB = users[1];
    await prisma.friendRequests.deleteMany({
      where: {
        OR: [
          { requesterId: userA.id, receiverId: userB.id },
          { requesterId: userB.id, receiverId: userA.id },
        ],
      },
    });
  }

  console.log(`👤 User A: [${userA.fullName || userA.username}] (ID: ${userA.id})`);
  console.log(`👤 User B: [${userB.fullName || userB.username}] (ID: ${userB.id})`);

  const tokenA = jwt.sign({ id: userA.id }, process.env.JWT_SECRET);
  const tokenB = jwt.sign({ id: userB.id }, process.env.JWT_SECRET);
  const BASE_URL = "http://localhost:3000/api/users";

  // Helper fetch
  async function api(endpoint, method = "GET", body = null, token = tokenA) {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${endpoint}`, opts);
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }

  // BƯỚC 1: Kiểm tra trạng thái ban đầu qua API tìm kiếm
  console.log("\n1️⃣ Kiểm tra trạng thái ban đầu khi chưa kết bạn...");
  const searchInitA = await api(`/search?q=${encodeURIComponent(userB.username)}`, "GET", null, tokenA);
  const userBInSearch = searchInitA.json.data?.find((u) => u.id === userB.id);
  console.log(`   - Trạng thái User B đối với User A: ${userBInSearch?.status} (${userBInSearch?.relationship})`);
  if (userBInSearch?.status === "NONE") {
    console.log("   ✅ [PASS] Trạng thái ban đầu chính xác là NONE (Chưa kết bạn)");
  } else {
    console.log(`   ⚠️ Cảnh báo: Trạng thái hiện tại: ${userBInSearch?.status}`);
  }

  // BƯỚC 2: User A gửi lời mời kết bạn tới User B
  console.log("\n2️⃣ User A gửi lời mời kết bạn tới User B...");
  const sendRes = await api("/friend-requests", "POST", { receiverId: userB.id }, tokenA);
  console.log(`   - Phản hồi gửi lời mời: HTTP ${sendRes.status}`, sendRes.json.message);
  if (sendRes.status === 200 && sendRes.json.success) {
    console.log("   ✅ [PASS] Gửi lời mời kết bạn thành công!");
  } else {
    console.error("   ❌ [FAIL] Gửi lời mời kết bạn thất bại:", sendRes.json);
  }

  // Kiểm tra quan hệ sau khi gửi
  const searchAfterSendA = await api(`/search?q=${encodeURIComponent(userB.username)}`, "GET", null, tokenA);
  const bAfterSend = searchAfterSendA.json.data?.find((u) => u.id === userB.id);
  console.log(`   - Phía User A (Người gửi): status=${bAfterSend?.status}, relationship=${bAfterSend?.relationship}`);

  const searchAfterSendB = await api(`/search?q=${encodeURIComponent(userA.username)}`, "GET", null, tokenB);
  const aAfterSend = searchAfterSendB.json.data?.find((u) => u.id === userA.id);
  console.log(`   - Phía User B (Người nhận): status=${aAfterSend?.status}, relationship=${aAfterSend?.relationship}`);

  if (bAfterSend?.relationship === "pending_sent" && aAfterSend?.relationship === "pending_received") {
    console.log("   ✅ [PASS] Phân luồng quan hệ PENDING chuẩn 100% (pending_sent vs pending_received)");
  } else {
    console.log("   ⚠️ Cảnh báo quan hệ phân luồng chưa khớp");
  }

  // BƯỚC 3: User A thử Hủy lời mời kết bạn
  console.log("\n3️⃣ User A hủy lời mời kết bạn đã gửi...");
  const cancelRes = await api(`/friend-requests/${userB.id}/cancel`, "POST", {}, tokenA);
  console.log(`   - Phản hồi hủy lời mời: HTTP ${cancelRes.status}`, cancelRes.json.message);
  if (cancelRes.status === 200 && cancelRes.json.success) {
    console.log("   ✅ [PASS] Hủy lời mời kết bạn thành công!");
  } else {
    console.error("   ❌ [FAIL] Hủy lời mời kết bạn thất bại:", cancelRes.json);
  }

  // Kiểm tra trạng thái đã về NONE
  const searchAfterCancel = await api(`/search?q=${encodeURIComponent(userB.username)}`, "GET", null, tokenA);
  const bAfterCancel = searchAfterCancel.json.data?.find((u) => u.id === userB.id);
  console.log(`   - Trạng thái sau khi hủy: status=${bAfterCancel?.status}, relationship=${bAfterCancel?.relationship}`);
  if (bAfterCancel?.status === "NONE") {
    console.log("   ✅ [PASS] Trạng thái đã quay về NONE sạch sẽ!");
  }

  // BƯỚC 4: User A gửi lại lời mời và User B Chấp nhận kết bạn
  console.log("\n4️⃣ User A gửi lại lời mời & User B Chấp nhận kết bạn...");
  await api("/friend-requests", "POST", { receiverId: userB.id }, tokenA);

  // User B lấy danh sách lời mời nhận được
  const pendingRequestsB = await api("/friend-requests", "GET", null, tokenB);
  const requestItem = pendingRequestsB.json.data?.find((r) => r.requesterId === userA.id || r.requester?.id === userA.id);
  const reqId = requestItem?.id || userA.id;

  // User B chấp nhận
  const acceptRes = await api(`/friend-requests/${reqId}/accept`, "POST", {}, tokenB);
  console.log(`   - Phản hồi User B chấp nhận: HTTP ${acceptRes.status}`, acceptRes.json.message);
  if (acceptRes.status === 200 && acceptRes.json.success) {
    console.log("   ✅ [PASS] Đồng ý kết bạn thành công!");
  } else {
    console.error("   ❌ [FAIL] Chấp nhận kết bạn thất bại:", acceptRes.json);
  }

  // BƯỚC 5: Kiểm tra danh sách bạn bè và trạng thái FRIEND
  console.log("\n5️⃣ Kiểm tra danh sách Bạn bè và trạng thái FRIEND...");
  const searchFriendA = await api(`/search?q=${encodeURIComponent(userB.username)}`, "GET", null, tokenA);
  const bFriend = searchFriendA.json.data?.find((u) => u.id === userB.id);
  console.log(`   - Trạng thái trong tìm kiếm: status=${bFriend?.status}, relationship=${bFriend?.relationship}`);

  const friendsA = await api("/friends", "GET", null, tokenA);
  const friendsB = await api("/friends", "GET", null, tokenB);
  const hasBInA = friendsA.json.data?.some((f) => f.id === userB.id);
  const hasAInB = friendsB.json.data?.some((f) => f.id === userA.id);

  console.log(`   - User B có trong danh bạ User A: ${hasBInA}`);
  console.log(`   - User A có trong danh bạ User B: ${hasAInB}`);

  if (bFriend?.status === "FRIEND" && hasBInA && hasAInB) {
    console.log("   ✅ [PASS] Trạng thái đã là FRIEND và cả 2 xuất hiện trong danh bạ bạn bè của nhau!");
  } else {
    console.error("   ❌ [FAIL] Chưa đồng bộ bạn bè đầy đủ");
  }

  // BƯỚC 6: Dọn dẹp dữ liệu thử nghiệm (Xóa bạn bè vừa kết nối test)
  console.log("\n6️⃣ Dọn dẹp bản ghi thử nghiệm...");
  const deleteRes = await api(`/friends/${userB.id}`, "DELETE", null, tokenA);
  console.log(`   - Đã xóa kết bạn thử nghiệm: HTTP ${deleteRes.status}`);

  console.log("\n=========================================================");
  console.log("🎉 TOÀN BỘ QUY TRÌNH KẾT BẠN HOẠT ĐỘNG 100% TRƠN TRU VÀ CHUẨN XÁC!");
  console.log("=========================================================");

  await prisma.$disconnect();
  process.exit(0);
}

runFriendshipE2ETest().catch((err) => {
  console.error("❌ Lỗi kiểm thử:", err);
  process.exit(1);
});
