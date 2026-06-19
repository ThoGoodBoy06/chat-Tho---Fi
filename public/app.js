const SERVER_URL = window.location.origin;
const API_URL = `${SERVER_URL}/api`;

// TỰ ĐỘNG THAY THẾ ẢNH LỖI (404) BẰNG ẢNH MẶC ĐỊNH
document.addEventListener(
    "error",
    function(e) {
        if (e.target.tagName && e.target.tagName.toLowerCase() === "img") {
            const fallback =
                "https://ui-avatars.com/api/?name=User&background=random";
            if (
                e.target.src !== fallback &&
                !e.target.src.includes("ui-avatars.com")
            ) {
                e.target.src = fallback;
            }
        }
    },
    true,
);

// --- QUẢN LÝ APP STATE (CAPACITOR / TRÌNH DUYỆT) ---
let isAppInBackground = false;
document.addEventListener("visibilitychange", () => {
    isAppInBackground = document.visibilityState === "hidden";

    if (!isAppInBackground) {
        // 1. Kéo lại tin nhắn bị lỡ trong lúc trình duyệt ngủ đông (mất kết nối Socket)
        if (typeof loadConversations === "function") loadConversations();
        if (typeof reloadCurrentChat === "function" && currentConversationId)
            reloadCurrentChat();

        // 2. Dọn dẹp các thông báo Toast cũ bị kẹt
        setTimeout(() => {
            document.querySelectorAll(".new-message-toast").forEach((toast) => {
                toast.classList.add("hiding");
                setTimeout(() => toast.remove(), 300);
            });
        }, 4000);
    }
});

let token = "";
let myId = "";
let myName = "";
let currentConversationId = "";
let currentChatPartnerId = null;
let socket = null;
let typingTimeout = null;
let pendingFriendRequests = [];
let notificationsList = [];
let replyingToMessage = null;
let currentChatMessages = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

const readReceiptState = {
    conversationId: null,
    readBy: null,
    lastReadMessageId: null,
};

function isSameId(a, b) {
    return String(a || "") === String(b || "");
}

// Kiểm tra xem người dùng có đang thực sự nhìn vào khung chat không
function isChatAreaVisible() {
    if (!document.hasFocus()) return false;

    const tabMessages = document.getElementById("tab-messages");
    const isMessagesTabActive = tabMessages ?
        tabMessages.classList.contains("active") :
        false;
    if (!isMessagesTabActive) return false;

    if (window.innerWidth <= 768) {
        const chatScreen = document.getElementById("chat-screen");
        const isMobileChatActive = chatScreen ?
            chatScreen.classList.contains("mobile-chat-active") :
            false;
        if (!isMobileChatActive) return false;
    }

    return true;
}

// --- MỞ KHÓA ÂM THANH TRÌNH DUYỆT (CHỐNG CHẶN AUTOPLAY) ---
let isAudioUnlocked = false;

function unlockBrowserAudio() {
    if (isAudioUnlocked) return;
    const audioIds = [
        "incoming-ringtone",
        "outgoing-ringtone",
        "remote-audio",
        "message-sound",
    ];
    audioIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.play()
                .then(() => {
                    el.pause();
                    el.currentTime = 0;
                })
                .catch(() => {});
        }
    });
    isAudioUnlocked = true;
    document.removeEventListener("click", unlockBrowserAudio);
    document.removeEventListener("touchstart", unlockBrowserAudio);
}
document.addEventListener("click", unlockBrowserAudio);
document.addEventListener("touchstart", unlockBrowserAudio);

function resetReadReceiptState(conversationId = currentConversationId) {
    readReceiptState.conversationId = conversationId || null;
    readReceiptState.readBy = null;
    readReceiptState.lastReadMessageId = null;
}

function setReadReceiptState(readInfo = {}) {
    if (!readInfo.conversationId || isSameId(readInfo.readBy, myId)) return;

    readReceiptState.conversationId = readInfo.conversationId;
    readReceiptState.readBy = readInfo.readBy;
    readReceiptState.lastReadMessageId = readInfo.lastReadMessageId || null;
}

function createReadReceiptAvatar() {
    const avatar = document.createElement("img");
    avatar.src =
        getPartnerAvatar() ||
        "https://ui-avatars.com/api/?name=User&background=random";
    avatar.className = "read-receipt-avatar";
    avatar.title = "Đã xem";
    avatar.alt = "Đã xem";
    return avatar;
}

function clearMessageStatus(statusEl) {
    if (!statusEl) return;
    statusEl.className = "message-status";
    statusEl.textContent = "";
}

function renderSentStatus(statusEl) {
    if (!statusEl) return;

    clearMessageStatus(statusEl);
    statusEl.classList.add("unread");

    const icon = document.createElement("i");
    icon.className = "fas fa-check-circle sent-icon";
    statusEl.append(icon, document.createTextNode(" Đã gửi"));
}

function getMessageStatus(messageEl) {
    return messageEl ? messageEl.querySelector(".message-status") : null;
}

function getReadReceiptTarget(myMessages) {
    const hasLiveReceipt =
        isSameId(readReceiptState.conversationId, currentConversationId) &&
        readReceiptState.lastReadMessageId;

    if (hasLiveReceipt) {
        const target = document.getElementById(
            `msg-${readReceiptState.lastReadMessageId}`,
        );
        if (target && target.classList.contains("my-message")) return target;
        // Nếu lastReadMessageId không khớp DOM (tin nhắn chưa render), lấy tin cuối có isRead=true
    }

    // Fallback: tìm tin nhắn của mình được đọc cuối cùng theo data attribute
    return (
        [...myMessages]
        .reverse()
        .find((message) => message.dataset.isRead === "true") || null
    );
}

function markMessagesReadThrough(myMessages, targetMessage) {
    const targetIndex = myMessages.indexOf(targetMessage);
    if (targetIndex === -1) return;

    myMessages.forEach((message, index) => {
        if (index <= targetIndex) message.dataset.isRead = "true";
    });
}

function updateReadReceiptsDOM(readInfo = null) {
    try {
        if (readInfo) setReadReceiptState(readInfo);

        const messagesDiv = document.getElementById("messages");
        if (!messagesDiv) return;

        // Guard: chỉ cập nhật nếu readReceiptState thuộc conversation hiện tại
        if (
            readReceiptState.conversationId &&
            !isSameId(readReceiptState.conversationId, currentConversationId)
        )
            return;

        const myMessages = [...messagesDiv.querySelectorAll(".my-message")];
        if (myMessages.length === 0) return;

        const targetMessage = getReadReceiptTarget(myMessages);

        // Bước 1: Xóa sạch toàn bộ trạng thái cũ trên tất cả tin nhắn của mình
        myMessages.forEach((message) =>
            clearMessageStatus(getMessageStatus(message)),
        );

        if (targetMessage) {
            // Bước 2: Đánh dấu dataset cho các tin nhắn đã được đọc
            markMessagesReadThrough(myMessages, targetMessage);

            // Bước 3: Hiển thị avatar "Đã xem" ngay bên dưới tin nhắn được đọc cuối cùng
            const targetStatusEl = getMessageStatus(targetMessage);
            if (targetStatusEl) {
                targetStatusEl.classList.add("read");
                targetStatusEl.appendChild(createReadReceiptAvatar());
            }

            // Bước 4: Hiển thị "Đã gửi" cho TẤT CẢ tin nhắn của mình SAU targetMessage
            const targetIndex = myMessages.indexOf(targetMessage);
            myMessages.forEach((message, index) => {
                if (index > targetIndex) {
                    renderSentStatus(getMessageStatus(message));
                }
            });
        } else {
            // Chưa có ai đọc: chỉ hiển thị "Đã gửi" ở tin nhắn CUỐI CÙNG
            const lastMyMessage = myMessages[myMessages.length - 1];
            if (lastMyMessage) {
                renderSentStatus(getMessageStatus(lastMyMessage));
            }
        }
    } catch (error) {
        console.error("[DOM Error] Lỗi khi cập nhật avatar Đã xem:", error);
    }
}

function emitMarkMessagesRead() {
    if (!currentConversationId || !socket || !myId) return;
    socket.emit("mark_messages_read", {
        conversationId: currentConversationId,
        userId: myId,
    });
}

// --- BIẾN TOÀN CỤC CHO WEBRTC ---
let peerConnection;
let localStream;
let callTypeGlobal;
let currentCallPartnerId = null;
let iceCandidateQueue = [];
let currentFacingMode = "user";
let callTimerInterval = null;
let callStartTime = 0;
let vibrateInterval = null;

// --- BIẾN TOÀN CỤC CHO CÁC TÍNH NĂNG TÙY CHỌN ---
let isScreenSharing = false;
let screenStream = null;
let isNoiseCancellationEnabled = true;

const stunServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

// --- QUẢN LÝ OVERLAY LOADING TOÀN CỤC ---
function showLoading(text = "Đang xử lý...") {
    const loadingEl = document.getElementById("global-loading");
    const textEl = document.getElementById("loading-text");
    if (textEl) textEl.innerText = text;
    if (loadingEl) loadingEl.style.display = "flex";
}

function hideLoading() {
    const loadingEl = document.getElementById("global-loading");
    if (loadingEl) loadingEl.style.display = "none";
}

// --- HÀM HỖ TRỢ: Lấy Avatar đối tác an toàn tuyệt đối ---
function getPartnerAvatar() {
    const avatarEl = document.getElementById("current-chat-avatar");
    if (avatarEl) {
        const rawSrc = avatarEl.getAttribute("src");
        if (rawSrc && rawSrc.trim() !== "" && !rawSrc.includes("undefined")) {
            return avatarEl.src;
        }
    }
    const nameEl = document.getElementById("chat-header-name");
    const name = nameEl ? nameEl.innerText : "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=random`;
}

// --- QUẢN LÝ OVERLAY TRÊN MOBILE ---
function hideMobileOverlay() {
    const overlay = document.getElementById("mobile-action-overlay");
    if (overlay) overlay.classList.remove("show");
    document
        .querySelectorAll(".message.show-mobile-actions")
        .forEach((m) => m.classList.remove("show-mobile-actions"));
    document
        .querySelectorAll(".reaction-palette.show")
        .forEach((p) => p.classList.remove("show"));
    document
        .querySelectorAll(".more-menu.show")
        .forEach((m) => m.classList.remove("show"));
}

function showMobileOverlay(messageEl) {
    let overlay = document.getElementById("mobile-action-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "mobile-action-overlay";
        const chatArea = document.querySelector(".chat-area") || document.body;
        chatArea.appendChild(overlay);
        overlay.addEventListener("click", hideMobileOverlay);
        overlay.addEventListener("touchstart", hideMobileOverlay, {
            passive: true,
        });
        overlay.addEventListener("touchmove", (e) => e.preventDefault(), {
            passive: false,
        });
    }
    hideMobileOverlay();
    messageEl.classList.add("show-mobile-actions");
    overlay.classList.add("show");
}

// Hệ thống gài quét lỗi toàn cục
window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (
        typeof msg === "string" &&
        (msg.includes("ResizeObserver") ||
            msg.includes("zaloJSV2") ||
            msg.includes("zaloJS"))
    ) {
        return true;
    }
    console.error("Lỗi hệ thống:", msg);
    return false;
};

// 0. Chuyển đổi giữa Đăng nhập / Đăng ký
function toggleAuth(type) {
    if (type === "register") {
        document.getElementById("login-form").style.display = "none";
        document.getElementById("register-form").style.display = "block";
    } else {
        document.getElementById("login-form").style.display = "block";
        document.getElementById("register-form").style.display = "none";
    }
}

// 0.6 Ẩn/hiển thị mật khẩu
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }
}

// 0.5 Xử lý đăng ký
async function register() {
    const fullName = document.getElementById("reg-fullname").value;
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;

    if (!fullName || !username || !password)
        return alert("Vui lòng nhập đầy đủ thông tin!");

    showLoading("Đăng ký...");
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, username, password }),
        });
        const data = await res.json();
        if (data.success) {
            alert("Đăng ký thành công! Đang tự động đăng nhập...");
            document.getElementById("login-username").value = username;
            document.getElementById("login-password").value = password;
            login();
        } else {
            alert("Lỗi đăng ký: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ khi đăng ký: " + error.message);
    } finally {
        hideLoading();
    }
}

// 1. Khởi tạo phiên làm việc (sau khi đăng nhập hoặc tự động đăng nhập thành công)
function initizeChatSession(userData, userToken) {
    token = userToken;
    myId = userData.id;
    myName = userData.fullName || userData.username;

    document.getElementById("my-name").innerText = myName;
    document.getElementById("my-avatar").src = userData.avatar ?
        userData.avatar.startsWith("http") ?
        userData.avatar :
        SERVER_URL + userData.avatar :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
        myName,
      )}&background=random`;

    // Đồng bộ thông tin sang Tab Hồ sơ
    document.getElementById("profile-name").innerText = myName;
    if (document.getElementById("my-avatar-profile"))
        document.getElementById("my-avatar-profile").src =
        document.getElementById("my-avatar").src;
    if (document.getElementById("profile-bio"))
        document.getElementById("profile-bio").innerText =
        userData.bio || "Chưa có tiểu sử";
    if (document.getElementById("my-cover")) {
        if (userData.coverImage) {
            document.getElementById("my-cover").src = userData.coverImage.startsWith(
                    "http",
                ) ?
                userData.coverImage :
                SERVER_URL + userData.coverImage;
        } else {
            document.getElementById("my-cover").src =
                "https://ui-avatars.com/api/?name=Cover&background=e9ecef&color=333&size=800&font-size=0.1";
        }
    }

    // Yêu cầu quyền gửi thông báo trên Trình duyệt Web (Nếu chưa cấp)
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    // --- CÀI ĐẶT FIREBASE CLOUD MESSAGING (Lấy FCM Token) ---
    if (typeof firebase !== "undefined") {
        try {
            // TODO 1: Dán firebaseConfig của bạn vào đây (Giống hệt file sw.js)
            const firebaseConfig = {
                apiKey: "AIzaSyDk6fayVDs0YbbhwldYxgHcN4nnjnPwmRc",
                authDomain: "chat-tho-fi.firebaseapp.com",
                projectId: "chat-tho-fi",
                storageBucket: "chat-tho-fi.firebasestorage.app",
                messagingSenderId: "513501588929",
                appId: "1:513501588929:web:54fd6c5fab227868bfd340",
            };

            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            const messaging = firebase.messaging();

            // TODO 2: Dán VAPID Key của bạn vào đây
            messaging
                .getToken({
                    vapidKey: "BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0",
                })
                .then((currentToken) => {
                    if (currentToken) {
                        console.log("🔥 Đã lấy được FCM Token:", currentToken);
                        fetch(`${API_URL}/users/fcm-token`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ fcmToken: currentToken }),
                        });
                    }
                })
                .catch((err) => console.log("Lỗi khi lấy FCM token:", err));
        } catch (error) {
            console.error("Lỗi khởi tạo Firebase Frontend:", error);
        }
    }

    // Kết nối Socket.IO Real-time
    socket = io(SERVER_URL);
    socket.emit("user_connected", myId);

    // Nghe danh sách lời mời bạn bè ban đầu
    socket.on("initial_friend_requests", (requests) => {
        pendingFriendRequests = requests || [];
        renderFriendRequests();
        updateFriendRequestBadge();
    });

    // Nghe khi có lời mời kết bạn mới
    socket.on("new_friend_request", (request) => {
        pendingFriendRequests.unshift(request);
        renderFriendRequests();
        updateFriendRequestBadge(true);
    });

    // Nghe khi mình chấp nhận lời mời của ai đó
    socket.on("you_accepted_friend_request", async(newFriend) => {
        alert(`Bạn và ${newFriend.fullName} đã trở thành bạn bè!`);
        try {
            await fetch(`${API_URL}/chat/conversations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ receiverId: newFriend.id }),
            });
        } catch (e) {}
        loadConversations();
        loadFriends();
    });

    // Nghe khi lời mời của mình được chấp nhận
    socket.on("friend_request_accepted", async(userWhoAccepted) => {
        alert(`${userWhoAccepted.fullName} đã chấp nhận lời mời của bạn!`);
        try {
            await fetch(`${API_URL}/chat/conversations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ receiverId: userWhoAccepted.id }),
            });
        } catch (e) {}
        loadConversations();
    });

    // Nghe thông báo toàn cục
    socket.on("new_global_notification", (notification) => {
        notificationsList.unshift(notification);
        updateNotificationBadge();
        renderNotifications();
        showToastNotification(notification);
    });

    socket.on("messages_read", (readInfo) => {
        const { conversationId, readBy } = readInfo;
        if (
            isSameId(conversationId, currentConversationId) &&
            !isSameId(readBy, myId)
        ) {
            updateReadReceiptsDOM(readInfo);
        }
        loadConversations();
    });

    socket.on("receive_message", (msg) => {
        let shouldMarkAsRead = false;
        const isCurrentChat = isSameId(msg.conversationId, currentConversationId);
        const isFromMe = isSameId(msg.senderId, myId);

        if (isCurrentChat) {
            // 1. Render tin nhắn ngay lập tức bằng tốc độ của Socket
            displayMessage(msg);

            // 2. Cập nhật trạng thái "Đã gửi" sau khi render
            updateReadReceiptsDOM();

            // 3. Chỉ gửi "Đã xem" nếu mình là người NHẬN và ĐANG THỰC SỰ NHÌN VÀO KHUNG CHAT
            if (!isFromMe && isChatAreaVisible()) {
                emitMarkMessagesRead();
                shouldMarkAsRead = true;
            }
        }

        // 4. Phát âm thanh và Rung điện thoại khi có tin nhắn mới từ người khác
        if (!isFromMe) {
            // Phụ trợ 1: Phát âm thanh "Ting" (tăng khả năng nhận biết)
            try {
                const msgSound = document.getElementById("message-sound");
                if (msgSound) {
                    msgSound.currentTime = 0;
                    msgSound
                        .play()
                        .catch((e) => console.warn("Trình duyệt chặn âm thanh:", e));
                } else {
                    const fallbackSound = new Audio("amthanhtinnhan.mp3");
                    fallbackSound.play().catch((e) => {});
                }
            } catch (err) {}

            // Phụ trợ 2: Lệnh Rung
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile && navigator.vibrate) {
                try {
                    // Dùng 1 lệnh duy nhất để tránh xung đột làm trình duyệt hủy rung
                    const canVibrate = navigator.vibrate([400, 200, 400]); // Rung mạnh: 400ms - nghỉ 200 - 400ms
                    if (!canVibrate) console.warn("Hệ thống từ chối rung.");
                } catch (error) {
                    console.warn("Trình duyệt chặn quyền rung:", error);
                }
            }

            // TÍNH NĂNG MỚI: TOAST IN-APP VÀ NATIVE NOTIFICATION (CAPACITOR)
            if (!isCurrentChat || isAppInBackground) {
                if (isAppInBackground) {
                    sendNativeNotification(msg);
                } else {
                    showNewMessageToast(msg);
                }
            }
        }

        // Cập nhật DOM của danh sách trò chuyện (Chat List Item) thay vì gọi API
        updateChatListUI(msg, shouldMarkAsRead);
    });

    // Gửi sự kiện Đã xem khi click vào ô nhập tin nhắn
    const msgInput = document.getElementById("message-input");
    if (msgInput) {
        msgInput.addEventListener("focus", () => {
            emitMarkMessagesRead();
        });
    }

    // Nghe khi lời mời của mình bị từ chối
    socket.on("friend_request_rejected", ({ userId }) => {
        console.log(`Người dùng ${userId} đã từ chối lời mời của bạn.`);
    });

    // Nghe sự kiện "Đang gõ..."
    socket.on("typing", (info) => {
        if (info.conversationId !== currentConversationId) return;
        let indicator = document.getElementById("typing-indicator");
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "typing-indicator";
            indicator.className = "typing-indicator";
            indicator.innerHTML = `<span><b>${info.senderName}</b> đang gõ</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
            document.getElementById("messages").appendChild(indicator);
            document.getElementById("messages").scrollTop =
                document.getElementById("messages").scrollHeight;
        }
    });

    // Nghe sự kiện "Dừng gõ"
    socket.on("stop_typing", (info) => {
        if (info.conversationId !== currentConversationId) return;
        const indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();
    });

    // Nghe các sự kiện WebRTC
    socket.on("incoming_call", handleIncomingCall);
    socket.on("did_upgrade_to_video", handleUpgradeToVideo);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("webrtc_signal", handleWebRTCSignal);
    socket.on("call_ended", () => {
        endCall(false);
    });

    // Nghe sự kiện thu hồi tin nhắn
    socket.on("message_recalled", ({ messageId, conversationId }) => {
        if (conversationId === currentConversationId) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (msgEl) {
                const content = msgEl.querySelector(".message-content");
                if (content) {
                    content.innerText = "Tin nhắn đã bị thu hồi";
                    content.style.fontStyle = "italic";
                    content.style.color = "var(--text-light)";
                    content.style.background = "transparent";
                    content.style.border = "1px solid var(--border-color)";
                }
                const actions = msgEl.querySelector(".message-actions");
                if (actions) actions.remove();
            }
        }
        loadConversations();
    });

    // Nghe sự kiện cảm xúc
    socket.on("message_reacted", ({ messageId, reactions }) => {
        const msgEl = document.getElementById(`msg-${messageId}`);
        if (msgEl) {
            renderReactions(msgEl, reactions);
        }
    });

    // Gắn sự kiện cho các nút trong cuộc gọi
    document.getElementById("reject-call-btn").onclick = () => endCall(true);
    document.getElementById("end-call-btn").onclick = () => endCall(true);

    // Chuyển sang màn hình chat
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "flex";

    loadConversations();
    loadFriends();
    loadNotifications();
}

// 2. Tải danh sách cuộc trò chuyện gần đây
async function loadConversations() {
    try {
        const res = await fetch(`${API_URL}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const userList = document.getElementById("user-list");
        userList.innerHTML = "";

        if (!data.data || data.data.length === 0) {
            return (userList.innerHTML =
                "<li style='color:#666; font-weight:normal; padding: 20px;'>Chưa có cuộc trò chuyện nào.<br><br>Hãy dùng ô tìm kiếm ở trên để tìm bạn bè theo Tên nhé!</li>");
        }

        data.data.forEach((item) => {
            const conv = item.Conversations;
            const otherMember = conv.ConversationMembers.find(
                (m) => m.userId !== myId,
            );

            if (otherMember) {
                const user = otherMember.Users;
                let lastMsg = "Bắt đầu trò chuyện!";
                if (conv.Messages.length > 0) {
                    const firstMsg = conv.Messages[0];
                    if (firstMsg.isRecalled) {
                        lastMsg = "Tin nhắn đã bị thu hồi";
                    } else if (firstMsg.type === "file") {
                        try {
                            const fileData = JSON.parse(firstMsg.content);
                            lastMsg = `[ Tệp tin: ${fileData.fileName} ]`;
                        } catch (e) {
                            lastMsg = "[ Tệp tin ]";
                        }
                    } else if (firstMsg.type === "audio") {
                        lastMsg = "[ Tin nhắn thoại ]";
                    } else if (
                        firstMsg.content &&
                        (firstMsg.content.startsWith("data:image") ||
                            firstMsg.content.match(/\.(jpeg|jpg|gif|png)$/i))
                    ) {
                        lastMsg = "[ Hình ảnh ]";
                    } else {
                        lastMsg = firstMsg.content;
                    }
                }

                const avatarUrl = user.avatar ?
                    user.avatar.startsWith("http") ?
                    user.avatar :
                    SERVER_URL + user.avatar :
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
              user.fullName || "User",
            )}&background=random`;

                const unreadCount =
                    conv._count && conv._count.Messages ? conv._count.Messages : 0;
                const unreadBadgeHtml =
                    unreadCount > 0 ?
                    `<span class="unread-badge">${
                unreadCount > 99 ? "99+" : unreadCount
              }</span>` :
                    "";
                const msgStyle =
                    unreadCount > 0 ? "font-weight: 600; color: var(--text-dark);" : "";

                const li = document.createElement("li");
                li.dataset.conversationId = conv.id;
                if (isSameId(conv.id, currentConversationId))
                    li.classList.add("active");
                li.onclick = () =>
                    startChat(user.id, user.fullName || user.username, avatarUrl);
                li.innerHTML = `
          <div class="avatar">
            <img src="${avatarUrl}" alt="Avatar">
            ${user.isOnline ? '<div class="online-dot"></div>' : ""}
          </div>
          <div class="chat-list-content">
            <div class="chat-list-header">
              <span class="chat-list-name">${
                user.fullName || "Người dùng"
              }</span>
              <div class="chat-list-right" style="display: flex; align-items: center; gap: 8px;">
                ${unreadBadgeHtml}
              </div>
            </div>
            <div class="chat-list-msg" style="${msgStyle}">${lastMsg}</div>
          </div>
        `;
                userList.appendChild(li);
            }
        });
    } catch (error) {
        alert("Lỗi tải danh sách câu chuyện: " + error.message);
    }
}

// 2.5 Tìm kiếm người dùng bằng Tên
async function searchUser() {
    const q = document.getElementById("search-input").value.trim();
    if (!q) return alert("Xin vui lòng nhập Tên để tìm!");

    try {
        const res = await fetch(`${API_URL}/users/search?q=${q}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const resultsDiv = document.getElementById("search-results");
        resultsDiv.style.display = "block";
        resultsDiv.innerHTML =
            "<h4 style='margin:0 0 10px 0;'>Kết quả tìm kiếm:</h4>";

        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML +=
                "<p style='margin:0;color:red;'>Không tìm thấy ai!</p>";
            setTimeout(() => (resultsDiv.style.display = "none"), 3000);
            return;
        }

        data.data.forEach((user) => {
            if (user.id === myId) return;

            const avatarUrl = user.avatar ?
                user.avatar.startsWith("http") ?
                user.avatar :
                SERVER_URL + user.avatar :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.fullName,
          )}&background=random`;

            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="avatar" style="width:40px;height:40px;"><img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;"></div>
          <span style="font-weight:600;">${user.fullName}</span>
        </div>
        <button onclick="startChat('${user.id}', '${user.fullName}', '${avatarUrl}')" style="margin-top:12px;padding:8px;width:100%;background:var(--primary-color);color:white;border:none;border-radius:6px;cursor:pointer;">Nhắn tin</button>
      `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        alert("Lỗi tìm kiếm: " + error.message);
    }
}

// 3. Bắt đầu trò chuyện với ai đó
async function startChat(receiverId, receiverName, receiverAvatar) {
    try {
        document.getElementById("chat-screen").classList.add("mobile-chat-active");
        document.getElementById("chat-header-placeholder").style.display = "none";
        currentChatPartnerId = receiverId;

        const headerContainer = document.getElementById("chat-header-container");
        headerContainer.style.display = "flex";
        document.getElementById("chat-header-name").innerText = receiverName;
        document.getElementById("current-chat-avatar").src =
            receiverAvatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
        receiverName,
      )}&background=random`;
        document.getElementById("input-area").style.display = "flex";

        const res = await fetch(`${API_URL}/chat/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ receiverId }),
        });

        const data = await res.json();
        if (!data.success) return alert("Đã tạo phòng chat: " + data.message);

        currentConversationId = data.data.id;
        resetReadReceiptState(currentConversationId);
        document.getElementById("search-results").style.display = "none";
        document.getElementById("search-input").value = "";

        const mobileSearch = document.getElementById("mobile-search-input");
        if (mobileSearch) mobileSearch.value = "";

        // Xóa unread-badge trên giao diện danh sách ngay lập tức (ẩn huy hiệu đi)
        const userList = document.getElementById("user-list");
        if (userList) {
            const activeItems = userList.querySelectorAll("li.active");
            activeItems.forEach((item) => item.classList.remove("active"));

            const chatItem = userList.querySelector(
                `li[data-conversation-id="${currentConversationId}"]`,
            );
            if (chatItem) {
                chatItem.classList.add("active");
                const badge = chatItem.querySelector(".unread-badge");
                if (badge) badge.remove();
                const msgTextEl = chatItem.querySelector(".chat-list-msg");
                if (msgTextEl) {
                    msgTextEl.style.fontWeight = "normal";
                    msgTextEl.style.color = "var(--text-light)";
                }
            }
        }

        const resMsg = await fetch(
            `${API_URL}/chat/${currentConversationId}/messages`, {
                headers: { Authorization: `Bearer ${token}` },
            },
        );

        const dataMsg = await resMsg.json();
        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML = "";

        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;
            dataMsg.data.forEach((msg) => displayMessage(msg));
            updateReadReceiptsDOM();
            emitMarkMessagesRead();
        }
    } catch (error) {
        alert("Lỗi khi mở phòng trò chuyện: " + error.message);
    }
}

// --- HÀM CẬP NHẬT GIAO DIỆN CHAT LIST KHI CÓ TIN NHẮN MỚI ---
function updateChatListUI(msg, isRead = false) {
    const userList = document.getElementById("user-list");
    if (!userList) return;
    const chatItem = userList.querySelector(
        `li[data-conversation-id="${msg.conversationId}"]`,
    );

    if (!chatItem) {
        // Nếu là cuộc trò chuyện mới tinh chưa có, tải lại toàn bộ danh sách
        loadConversations();
        return;
    }

    // 1. Cập nhật nội dung text snippet mới nhất
    const msgTextEl = chatItem.querySelector(".chat-list-msg");
    if (msgTextEl) {
        let snippet = msg.content;
        if (msg.isRecalled) snippet = "Tin nhắn đã bị thu hồi";
        else if (msg.type === "missed_call") snippet = "Cuộc gọi nhỡ";
        else if (msg.type === "file") {
            try {
                const fileData = JSON.parse(msg.content);
                snippet = `[ Tệp tin: ${fileData.fileName} ]`;
            } catch (e) {
                snippet = "[ Tệp tin ]";
            }
        }
        else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
        else if (
            msg.content &&
            (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
        )
            snippet = "[ Hình ảnh ]";

        msgTextEl.innerText = snippet;

        // In đậm nếu chưa đọc
        if (!isRead && msg.senderId !== myId) {
            msgTextEl.style.fontWeight = "600";
            msgTextEl.style.color = "var(--text-dark)";
        }
    }

    // 2. Tăng số đếm Badge nếu mình là người nhận và phòng chat đang đóng
    if (!isRead && msg.senderId !== myId) {
        const rightContainer = chatItem.querySelector(".chat-list-right");
        let badge = chatItem.querySelector(".unread-badge");

        if (badge) {
            let currentCount = parseInt(badge.innerText.replace("+", "")) || 0;
            if (badge.innerText === "99+") currentCount = 99;
            currentCount++;
            badge.innerText = currentCount > 99 ? "99+" : currentCount;
        } else if (rightContainer) {
            badge = document.createElement("span");
            badge.className = "unread-badge";
            badge.innerText = "1";
            rightContainer.appendChild(badge);
        }
    }

    // 3. Đẩy item lên vị trí đầu tiên của danh sách
    userList.prepend(chatItem);
}

// --- TẢI LẠI ĐOẠN CHAT ---
async function reloadCurrentChat() {
    if (!currentConversationId) return;
    try {
        const resMsg = await fetch(
            `${API_URL}/chat/${currentConversationId}/messages`, {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        const dataMsg = await resMsg.json();
        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML = "";
        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;
            dataMsg.data.forEach((msg) => displayMessage(msg));
            updateReadReceiptsDOM();
        }
    } catch (error) {
        console.error("Lỗi reload chat:", error);
    }
}

// 1.5 Xử lý Đăng nhập thủ công
async function login() {
    try {
        const username = document.getElementById("login-username").value;
        const password = document.getElementById("login-password").value;

        if (!username || !password) {
            return alert("Bạn ơi, nhập đủ tên người dùng và mật khẩu nhé!");
        }

        showLoading("Đăng nhập...");

        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: username, password }),
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem("authToken", data.token);
            initizeChatSession(data.data, data.token);
        } else {
            alert("Đăng nhập thất bại: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ khi đăng nhập: " + error.message);
    } finally {
        hideLoading();
    }
}

// --- HỆ THỐNG YÊU CẦU BẠN BÈ ---
function updateFriendRequestBadge(shouldAnimate = false) {
    const badge = document.getElementById("contacts-badge");
    const navItem = badge.parentElement;
    const count = pendingFriendRequests.length;

    if (count > 0) {
        badge.innerText = count;
        badge.style.display = "flex";
        if (shouldAnimate) {
            navItem.classList.add("shake");
        }
    } else {
        badge.style.display = "none";
        navItem.classList.remove("shake");
    }
}

function renderFriendRequests() {
    const listEl = document.getElementById("friend-requests-list");
    if (!listEl) return;

    if (pendingFriendRequests.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-light); text-align: center;">Không có lời mời kết bạn nào.</p>`;
        return;
    }

    listEl.innerHTML = "";
    pendingFriendRequests.forEach((req) => {
        const user = req.requester;
        const avatarUrl = user.avatar ?
            user.avatar.startsWith("http") ?
            user.avatar :
            SERVER_URL + user.avatar :
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.fullName,
        )}&background=random`;

        const itemEl = document.createElement("div");
        itemEl.className = "friend-request-item";
        itemEl.id = `request-${req.id}`;
        itemEl.innerHTML = `
      <div class="friend-request-info">
        <div class="avatar"><img src="${avatarUrl}" alt="Avatar"></div>
        <span>${user.fullName}</span>
      </div>
      <div class="friend-request-actions">
        <button class="btn-decline" onclick="rejectFriendRequest('${req.id}')">Từ chối</button>
        <button class="btn-accept" onclick="acceptFriendRequest('${req.id}')">Chấp nhận</button>
      </div>
    `;
        listEl.appendChild(itemEl);
    });
}

async function searchUserForFriend() {
    const q = document.getElementById("friend-search-input").value.trim();
    if (!q) return;

    try {
        const res = await fetch(`${API_URL}/users/search?q=${q}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const resultsDiv = document.getElementById("friend-search-results");
        resultsDiv.innerHTML = "";

        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML =
                "<p style='margin:0;color:red;'> Không tìm thấy ai!</p>";
            return;
        }

        data.data.forEach((user) => {
            if (user.id === myId) return;

            const avatarUrl = user.avatar ?
                user.avatar.startsWith("http") ?
                user.avatar :
                SERVER_URL + user.avatar :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.fullName,
          )}&background=random`;

            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
        <div class="friend-request-info">
          <div class="avatar" style="width:40px;height:40px;"><img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;"></div>
          <span>${user.fullName}</span>
        </div>
        <button class="btn-send-request" id="send-req-btn-${user.id}" onclick="sendFriendRequest('${user.id}')">Gửi lời mời</button>
      `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        alert("Lỗi tìm kiếm: " + error.message);
    }
}

function sendFriendRequest(receiverId) {
    if (!socket) return alert("Chưa kết nối tới server!");
    socket.emit("send_friend_request", { receiverId });
    const btn = document.getElementById(`send-req-btn-${receiverId}`);
    if (btn) {
        btn.innerText = "Đã gửi";
        btn.disabled = true;
    }
}

function acceptFriendRequest(requestId) {
    if (!socket) return alert("Chưa kết nối tới server!");
    socket.emit("accept_friend_request", { requestId });
    pendingFriendRequests = pendingFriendRequests.filter(
        (req) => req.id !== requestId,
    );
    renderFriendRequests();
    updateFriendRequestBadge();
}

function rejectFriendRequest(requestId) {
    if (!socket) return alert("Chưa kết nối tới server!");
    socket.emit("reject_friend_request", { requestId });
    pendingFriendRequests = pendingFriendRequests.filter(
        (req) => req.id !== requestId,
    );
    renderFriendRequests();
    updateFriendRequestBadge();
}

// --- TẢI DANH SÁCH BẠN BÈ ---
async function loadFriends() {
    try {
        const res = await fetch(`${API_URL}/users/friends`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const listEl = document.getElementById("friends-list");
        if (!listEl) return;

        if (!data.data || data.data.length === 0) {
            listEl.innerHTML = `<p style="color: var(--text-light); text-align: center;">Chưa có bạn bè nào.</p>`;
            return;
        }

        listEl.innerHTML = "";
        data.data.forEach((user) => {
            const avatarUrl = user.avatar ?
                user.avatar.startsWith("http") ?
                user.avatar :
                SERVER_URL + user.avatar :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.fullName,
          )}&background=random`;

            const itemEl = document.createElement("div");
            itemEl.className = "friend-request-item";
            itemEl.innerHTML = `
        <div class="friend-request-info">
          <div class="avatar"><img src="${avatarUrl}" alt="Avatar">${
        user.isOnline ? '<div class="online-dot"></div>' : ""
      }</div>
          <span>${user.fullName}</span>
        </div>
        <div class="friend-request-actions">
              <button class="btn-decline" onclick="removeFriend('${
                user.id
              }')" style="margin-right: 8px;">Xóa</button>
          <button class="btn-accept" onclick="startChat('${user.id}', '${
        user.fullName
      }', '${avatarUrl}')">Nhắn tin</button>
        </div>
      `;
            listEl.appendChild(itemEl);
        });
    } catch (err) {
        console.error("Lỗi tải danh sách bạn bè", err);
    }
}

// --- XÓA BẠN BÈ ---
async function removeFriend(friendId) {
    if (!confirm("Bạn có chắc chắn muốn xóa người này khỏi danh sách bạn bè?"))
        return;

    try {
        const res = await fetch(`${API_URL}/users/friends/${friendId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
            loadFriends();
            loadConversations(); // Tải lại cả danh sách chat

            // Nếu đang chat với người vừa xóa, đóng cửa sổ chat lại
            if (currentChatPartnerId === friendId) {
                closeChatMobile();
                document.getElementById("chat-header-placeholder").style.display =
                    "flex";
                document.getElementById("chat-header-container").style.display = "none";
                document.getElementById("input-area").style.display = "none";
                document.getElementById("messages").innerHTML = "";
                currentConversationId = "";
                currentChatPartnerId = null;
            }
        } else {
            alert("Lỗi khi xóa bạn: " + data.message);
        }
    } catch (err) {
        alert("Lỗi kết nối khi xóa bạn bè!");
    }
}

// 4. Hiển thị tin nhắn lên màn hình
function displayMessage(msg) {
    // CHỐT CHẶN: Nếu tin nhắn đã được render (bởi Socket) thì bỏ qua để tránh trùng lặp
    if (document.getElementById(`msg-${msg.id}`)) return;

    if (!currentChatMessages.some(m => m.id === msg.id)) {
        currentChatMessages.push(msg);
    }

    const messagesDiv = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.id = `msg-${msg.id}`;
    messageElement.className = `message ${
    msg.senderId === myId ? "my-message" : "other-message"
  }`;
    messageElement.dataset.messageId = msg.id;
    messageElement.dataset.senderId = msg.senderId || "";
    messageElement.dataset.isRead = msg.isRead ? "true" : "false";

    // Hiển thị giao diện Cuộc gọi nhỡ (Tin nhắn hệ thống)
    if (msg.type === "missed_call") {
        messageElement.className = "message system-message";
        const messageBody = document.createElement("div");
        messageBody.className = "message-body";
        const messageContent = document.createElement("div");
        messageContent.className = "message-content";

        const callText = msg.content || "Cuộc gọi nhỡ";
        messageContent.innerHTML = `<div class="missed-call-icon"><i class="fas fa-phone-slash"></i></div><span>${callText}</span>`;

        messageBody.appendChild(messageContent);
        messageElement.appendChild(messageBody);

        const metaElement = document.createElement("div");
        metaElement.className = "message-meta";
        metaElement.style.justifyContent = "center";
        const timeElement = document.createElement("span");
        const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
        timeElement.innerText = `${date
      .getHours()
      .toString()
      .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        metaElement.appendChild(timeElement);
        messageElement.appendChild(metaElement);

        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }

    if (msg.senderId !== myId && msg.Users) {
        const senderName = document.createElement("div");
        senderName.className = "sender-name";
        senderName.innerText = msg.Users.fullName;
        messageElement.appendChild(senderName);
    }

    const messageBody = document.createElement("div");
    messageBody.className = "message-body";
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    if (msg.isRecalled) {
        messageContent.innerText = "Tin nhắn đã bị thu hồi";
        messageContent.style.fontStyle = "italic";
        messageContent.style.color = "var(--text-light)";
        messageContent.style.background = "transparent";
        messageContent.style.border = "1px solid var(--border-color)";
        messageBody.appendChild(messageContent);
    } else {
        if (msg.type === "file") {
            try {
                const fileData = JSON.parse(msg.content);
                const fileExt = fileData.fileName.split(".").pop().toLowerCase();

                let iconClass = "far fa-file";
                if (["pdf"].includes(fileExt)) iconClass = "far fa-file-pdf text-danger";
                else if (["doc", "docx"].includes(fileExt)) iconClass = "far fa-file-word text-primary";
                else if (["xls", "xlsx"].includes(fileExt)) iconClass = "far fa-file-excel text-success";
                else if (["zip", "rar", "7z"].includes(fileExt)) iconClass = "far fa-file-archive text-warning";
                else if (["txt"].includes(fileExt)) iconClass = "far fa-file-alt";

                let sizeStr = `${(fileData.fileSize / 1024).toFixed(1)} KB`;
                if (fileData.fileSize > 1024 * 1024) {
                    sizeStr = `${(fileData.fileSize / (1024 * 1024)).toFixed(1)} MB`;
                }

                messageContent.innerHTML = `
                    <div class="file-message-card">
                        <div class="file-icon-wrapper">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="file-info-wrapper">
                            <div class="file-name-text">${fileData.fileName}</div>
                            <div class="file-size-text">${sizeStr}</div>
                        </div>
                    </div>
                `;

                messageContent.onclick = (e) => {
                    e.stopPropagation();
                    const link = document.createElement("a");
                    link.href = fileData.base64;
                    link.download = fileData.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                messageContent.style.background = "transparent";
                messageContent.style.padding = "0";
            } catch (err) {
                console.error("Lỗi parse file message:", err);
                messageContent.innerText = "[ Tệp tin bị lỗi ]";
            }
        } else if (msg.type === "audio") {
            messageContent.innerHTML = `
                <audio src="${msg.content}" controls class="voice-message-player"></audio>
            `;
            messageContent.style.background = "transparent";
            messageContent.style.padding = "0";
        } else if (
            msg.content &&
            (msg.content.startsWith("data:image/") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
        ) {
            messageContent.innerHTML = `<img src="${msg.content}" class="message-image" onclick="openLightbox(this.src)" alt="Ảnh tin nhắn" />`;
            messageContent.style.background = "transparent";
            messageContent.style.padding = "0";
        } else {
            messageContent.innerText = msg.content;
        }

        // Nâng cấp: Hiển thị tin nhắn trích dẫn (Replied Message Preview)
        if (msg.replyMessageId) {
            const parentMsg = currentChatMessages.find((m) => m.id === msg.replyMessageId);
            if (parentMsg) {
                const replyBox = document.createElement("div");
                replyBox.className = "replied-message-box";

                let parentSenderName = "Người dùng";
                if (parentMsg.senderId === myId) {
                    parentSenderName = "Bạn";
                } else if (parentMsg.Users) {
                    parentSenderName = parentMsg.Users.fullName;
                } else {
                    const headerName = document.getElementById("chat-header-name");
                    if (headerName) parentSenderName = headerName.innerText;
                }

                let parentText = parentMsg.content;
                if (parentMsg.isRecalled) {
                    parentText = "Tin nhắn đã bị thu hồi";
                } else if (
                    parentMsg.content &&
                    (parentMsg.content.startsWith("data:image/") ||
                    parentMsg.content.match(/\.(jpeg|jpg|gif|png)$/i))
                ) {
                    parentText = "[ Hình ảnh ]";
                } else if (parentMsg.type === "missed_call") {
                    parentText = "[ Cuộc gọi nhỡ ]";
                }

                replyBox.innerHTML = `
                    <div class="replied-sender-name">${parentSenderName}</div>
                    <div class="replied-message-text">${parentText}</div>
                `;

                replyBox.onclick = (e) => {
                    e.stopPropagation();
                    scrollToAndHighlightMessage(msg.replyMessageId);
                };

                messageContent.prepend(replyBox);
            }
        }

        // TẠO NÚT THẢ CẢM XÚC (Reaction)
        const reactBtn = document.createElement("div");
        reactBtn.className = "action-item react-btn";
        reactBtn.innerHTML = '<i class="far fa-smile"></i>';
        const reactionPalette = document.createElement("div");
        reactionPalette.className = "reaction-palette";
        const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
        EMOJIS.forEach((emoji) => {
            const emojiSpan = document.createElement("span");
            emojiSpan.innerText = emoji;
            emojiSpan.onclick = (e) => {
                e.stopPropagation();
                reactToMessage(msg.id, emoji);
                reactionPalette.classList.remove("show");
                hideMobileOverlay();
            };
            reactionPalette.appendChild(emojiSpan);
        });
        reactBtn.appendChild(reactionPalette);
        reactBtn.onclick = (e) => {
            e.stopPropagation();
            document
                .querySelectorAll(".more-menu.show")
                .forEach((m) => m.classList.remove("show"));
            document.querySelectorAll(".reaction-palette.show").forEach((p) => {
                if (p !== reactionPalette) p.classList.remove("show");
            });
            reactionPalette.classList.toggle("show");
        };

        // MENU TÙY CHỌN
        const moreBtn = document.createElement("div");
        moreBtn.className = "action-item more-btn";
        moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
        const moreMenu = document.createElement("div");
        moreMenu.className = "more-menu";

        const replyOption = document.createElement("div");
        replyOption.className = "menu-item reply-action";
        replyOption.innerText = "Trả lời";
        replyOption.onclick = (e) => {
            e.stopPropagation();
            setReplyMode(msg.id);
            moreMenu.classList.remove("show");
            hideMobileOverlay();
        };
        moreMenu.appendChild(replyOption);

        if (!msg.isRecalled) {
            const copyOption = document.createElement("div");
            copyOption.className = "menu-item copy-action";
            copyOption.innerText = "Sao chép";
            copyOption.onclick = (e) => {
                e.stopPropagation();
                copyMessageText(msg.content);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(copyOption);
        }

        if (msg.senderId === myId) {
            const recallOption = document.createElement("div");
            recallOption.className = "menu-item text-danger";
            recallOption.innerText = "Thu hồi tin nhắn";
            recallOption.onclick = (e) => {
                e.stopPropagation();
                recallMessage(msg.id);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(recallOption);
        } else {
            const deleteOption = document.createElement("div");
            deleteOption.className = "menu-item";
            deleteOption.innerText = "Xóa ở phía tôi";
            deleteOption.onclick = (e) => {
                e.stopPropagation();
                alert("Xác suất 'Xóa ở phía tôi' đang được phát triển.");
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(deleteOption);
        }

        moreBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll(".reaction-palette.show").forEach((p) => {
                p.classList.remove("show");
            });
            document.querySelectorAll(".more-menu.show").forEach((m) => {
                if (m !== moreMenu) m.classList.remove("show");
            });
            moreMenu.classList.toggle("show");
        };

        document.addEventListener("click", () => moreMenu.classList.remove("show"));

        moreBtn.appendChild(moreMenu);

        const replyBtn = document.createElement("div");
        replyBtn.className = "action-item reply-btn";
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.title = "Trả lời";
        replyBtn.onclick = (e) => {
            e.stopPropagation();
            setReplyMode(msg.id);
        };

        const actions = document.createElement("div");
        actions.className = "message-actions";
        actions.appendChild(replyBtn);
        actions.appendChild(reactBtn);
        actions.appendChild(moreBtn);

        messageBody.appendChild(messageContent);
        messageBody.appendChild(actions);

        renderReactions(messageBody, msg.reactions);

        // Vuốt kéo để trả lời trên Mobile (Swipe right to reply)
        let swipeStartX = 0;
        let swipeStartY = 0;
        let isHorizontalSwipe = false;
        let lastTranslateX = 0;
        
        const swipeIndicator = document.createElement("div");
        swipeIndicator.className = "swipe-reply-indicator";
        swipeIndicator.innerHTML = '<i class="fas fa-reply"></i>';
        messageElement.appendChild(swipeIndicator);

        messageBody.addEventListener("touchstart", (e) => {
            if (window.innerWidth > 768) return;
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
            isHorizontalSwipe = false;
            lastTranslateX = 0;
            messageBody.style.transition = "none";
        }, { passive: true });

        messageBody.addEventListener("touchmove", (e) => {
            if (window.innerWidth > 768) return;
            const diffX = e.touches[0].clientX - swipeStartX;
            const diffY = e.touches[0].clientY - swipeStartY;

            if (!isHorizontalSwipe && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                isHorizontalSwipe = true;
            }

            if (isHorizontalSwipe) {
                if (diffX > 0) {
                    e.preventDefault();
                    lastTranslateX = Math.min(diffX, 70);
                    messageBody.style.transform = `translateX(${lastTranslateX}px)`;
                    
                    if (lastTranslateX >= 45) {
                        swipeIndicator.classList.add("active");
                    } else {
                        swipeIndicator.classList.remove("active");
                    }
                }
            }
        }, { passive: false });

        messageBody.addEventListener("touchend", () => {
            if (window.innerWidth > 768) return;
            messageBody.style.transition = "transform 0.2s ease-out";
            messageBody.style.transform = "translateX(0px)";
            swipeIndicator.classList.remove("active");

            if (isHorizontalSwipe && lastTranslateX >= 45) {
                setReplyMode(msg.id);
                if (navigator.vibrate) {
                    try {
                        navigator.vibrate(30);
                    } catch (err) {}
                }
            }
        });

        // Xử lý nhấn giữ trên di động
        let pressTimer;
        let isLongPress = false;
        let startY = 0;

        messageContent.addEventListener(
            "touchstart",
            (e) => {
                if (window.innerWidth > 768) return;
                startY = e.touches[0].clientY;
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    showMobileOverlay(messageElement);
                    const palette = messageElement.querySelector(".reaction-palette");
                    if (palette) palette.classList.add("show");
                }, 250);
            }, { passive: true },
        );

        const cancelPress = (e) => {
            if (e && e.type === "touchmove") {
                if (Math.abs(e.touches[0].clientY - startY) > 10) {
                    clearTimeout(pressTimer);
                }
            } else {
                clearTimeout(pressTimer);
            }
        };

        messageContent.addEventListener("touchend", cancelPress);
        messageContent.addEventListener("touchmove", cancelPress, {
            passive: true,
        });
        messageContent.addEventListener("touchcancel", cancelPress);
        messageContent.addEventListener("contextmenu", (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
            }
        });
    }

    // Định dạng và hiển thị thời gian gửi tin nhắn
    const metaElement = document.createElement("div");
    metaElement.className = "message-meta";
    const timeElement = document.createElement("span");
    const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    timeElement.innerText = `${hours}:${minutes}`;
    metaElement.appendChild(timeElement);

    // Trạng thái "Đã gửi" chỉ dành cho tin nhắn của bản thân
    if (msg.senderId === myId) {
        const statusElement = document.createElement("span");
        statusElement.className = "message-status";
        metaElement.appendChild(statusElement);
    }

    messageElement.appendChild(messageBody);
    messageElement.appendChild(metaElement);
    messagesDiv.appendChild(messageElement);
    // updateReadReceiptsDOM() được gọi một lần duy nhất sau khi toàn bộ tin nhắn đã render xong
    // (trong startChat / reloadCurrentChat / socket receive_message). Không gọi ở đây để tránh flicker.
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 5. Gửi tin nhắn bất đồng bộ
function sendMessage(imageContent = null) {
    const input = document.getElementById("message-input");
    const content = imageContent || input.value.trim();

    if (!currentConversationId) {
        return alert(
            "Bạn quên chưa chọn người để trò chuyện rồi (Cột danh sách bên trái)!",
        );
    }

    if (!content) return;

    input.value = "";

    if (!imageContent && socket) {
        socket.emit("stop_typing", {
            conversationId: currentConversationId,
            senderId: myId,
        });
    }

    // ✨ OPTIMISTIC UI: Hiển thị tin nhắn ngay lập tức, không chờ server
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg = {
        id: optimisticId,
        conversationId: currentConversationId,
        senderId: myId,
        content: content,
        type: imageContent && imageContent.startsWith("data:image") ? "image" : "text",
        isRecalled: false,
        createdAt: new Date().toISOString(),
        replyMessageId: replyingToMessage ? replyingToMessage.id : null,
        Users: { id: myId, fullName: myName, avatar: null },
    };
    currentChatMessages.push(optimisticMsg);
    displayMessage(optimisticMsg);

    // Cập nhật sidebar ngay không chờ server
    updateChatListUI(optimisticMsg, true);

    cancelReply();

    const payload = { content };
    if (replyingToMessage) {
        payload.replyMessageId = replyingToMessage.id;
    }

    fetch(`${API_URL}/chat/${currentConversationId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.success) {
            // Thay thế tin nhắn optimistic bằng tin nhắn thật từ server
            const optimisticEl = document.getElementById(`msg-${optimisticId}`);
            if (optimisticEl) {
                // Cập nhật id để khớp với id thật và socket sẽ nhận biết không hiển thị trùng
                optimisticEl.id = `msg-${data.data.id}`;
                optimisticEl.dataset.messageId = data.data.id;
            }
            // Cập nhật trong mảng currentChatMessages
            const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
            if (idx !== -1) currentChatMessages[idx] = data.data;
        } else {
            // Nếu gửi thất bại, xóa tin nhắn optimistic
            alert("Server từ chối gửi tin nhắn: " + data.message);
            const optimisticEl = document.getElementById(`msg-${optimisticId}`);
            if (optimisticEl) optimisticEl.remove();
            const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
            if (idx !== -1) currentChatMessages.splice(idx, 1);
        }
    })
    .catch((err) => {
        alert("Lỗi kết nối mạng: " + err.message);
        const optimisticEl = document.getElementById(`msg-${optimisticId}`);
        if (optimisticEl) optimisticEl.remove();
        const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
        if (idx !== -1) currentChatMessages.splice(idx, 1);
    });
}

// 6. Bấm phím Enter để gửi tin nhắn
const messageInput = document.getElementById("message-input");
if (messageInput) {
    messageInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
}

// 10. Đóng khung trò chuyện trên di động
function closeChatMobile() {
    document.getElementById("chat-screen").classList.remove("mobile-chat-active");
}

// 7. Sự kiện Gửi Hình ảnh
const imageUploadInput = document.getElementById("image-upload");
if (imageUploadInput) {
    imageUploadInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Image = event.target.result;
            sendMessage(base64Image);
        };
        reader.readAsDataURL(file);
    });
}

// Sự kiện Gửi Tệp tin (File/Document)
const fileUploadInput = document.getElementById("file-upload");
if (fileUploadInput) {
    fileUploadInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Giới hạn tệp tin dưới 10MB để không quá tải dữ liệu Base64 trong database
        if (file.size > 10 * 1024 * 1024) {
            return alert("Vui lòng chọn tệp tin có dung lượng dưới 10MB.");
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Data = event.target.result;
            const filePayload = {
                fileName: file.name,
                fileSize: file.size,
                base64: base64Data
            };
            sendFileOrAudioMessage(JSON.stringify(filePayload), "file");
            fileUploadInput.value = "";
        };
        reader.readAsDataURL(file);
    });
}

// 8. Sự kiện Nhập phím "Đang gõ..."
if (messageInput) {
    messageInput.addEventListener("input", () => {
        if (!currentConversationId || !socket) return;

        socket.emit("typing", {
            conversationId: currentConversationId,
            senderId: myId,
            senderName: myName,
        });

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit("stop_typing", {
                conversationId: currentConversationId,
                senderId: myId,
            });
        }, 1500);
    });
}

// 9. Sự kiện Tải lên Avatar Mới
const avatarUploadInput = document.getElementById("avatar-upload");
if (avatarUploadInput) {
    avatarUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const res = await fetch(`${API_URL}/users/avatar`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                document.getElementById("my-avatar").src = SERVER_URL + data.avatarUrl;
                if (document.getElementById("my-avatar-profile"))
                    document.getElementById("my-avatar-profile").src =
                    SERVER_URL + data.avatarUrl;
            } else {
                alert("Lỗi tải ảnh: " + data.message);
            }
        } catch (error) {
            alert("Lỗi hệ thống khi tải ảnh lên!");
        }
    });
}

// 11. Thu hồi tin nhắn
async function recallMessage(messageId) {
    if (!confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) return;

    try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/recall`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!data.success) {
            alert("Lỗi thu hồi: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối khi thu hồi: " + error.message);
    }
}

// 12. Gửi cảm xúc vào tin nhắn
async function reactToMessage(messageId, reaction) {
    try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/react`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ reaction }),
        });

        const data = await res.json();
        if (!data.success) {
            alert("Lỗi gửi cảm xúc: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối khi gửi cảm xúc: " + error.message);
    }
}

// 13. Hiển thị các icon cảm xúc dưới tin nhắn
function renderReactions(messageElement, reactions) {
    if (typeof reactions === "string") {
        try {
            reactions = JSON.parse(reactions);
        } catch (e) {
            reactions = {};
        }
    }

    let content = messageElement.classList.contains("message-content") ?
        messageElement :
        messageElement.querySelector(".message-content");

    if (!content) return;

    let reactionsContainer = content.querySelector(".message-reactions");
    if (!reactionsContainer) {
        reactionsContainer = document.createElement("div");
        reactionsContainer.className = "message-reactions";
        content.appendChild(reactionsContainer);
    }

    reactionsContainer.innerHTML = "";
    if (!reactions || Object.keys(reactions).length === 0) {
        reactionsContainer.style.display = "none";
        return;
    }

    reactionsContainer.style.display = "flex";
    const uniqueEmojis = [...new Set(Object.values(reactions))];
    const count = Object.keys(reactions).length;
    reactionsContainer.innerText = `${uniqueEmojis.join("")} ${count}`;
}

// ===========================================
// LÁ CHẮN CHỐNG ZOOM TRÊN MOBILE (PWA)
// ===========================================

// 1. Chống chụm ngón tay (Pinch Zoom)
document.addEventListener(
    "touchmove",
    function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false },
);

// =========================================
// THÔNG BÁO TIN NHẮN MỚI (IN-APP TOAST & NATIVE)
// =========================================

function showNewMessageToast(msg) {
    let container = document.getElementById("top-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "top-toast-container";
        document.body.appendChild(container);
    }

    const sender = msg.Users || {};
    const senderName = sender.fullName || "Tin nhắn mới";
    let avatarUrl = sender.avatar ?
        sender.avatar.startsWith("http") ?
        sender.avatar :
        SERVER_URL + sender.avatar :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
        senderName,
      )}&background=random`;

    let snippet = msg.content;
    if (msg.isRecalled) snippet = "Tin nhắn đã bị thu hồi";
    else if (msg.type === "missed_call") snippet = "Cuộc gọi nhỡ";
    else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            snippet = `[ Tệp tin: ${fileData.fileName} ]`;
        } catch (e) {
            snippet = "[ Tệp tin ]";
        }
    }
    else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
    else if (
        msg.content &&
        (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
    ) {
        snippet = "[ Hình ảnh ]";
    }

    const safeName = escapeHTML(senderName);
    const safeAvatar = escapeHTML(avatarUrl);
    const safeSnippet = escapeHTML(snippet);

    const toast = document.createElement("div");
    toast.className = "new-message-toast";
    toast.innerHTML = `
    <img src="${safeAvatar}" alt="Avatar">
    <div class="toast-content">
      <div class="toast-name">${safeName}</div>
      <div class="toast-msg-text">${safeSnippet}</div>
    </div>
  `;

    // Tương tác: Bấm vào Toast để mở thẳng phòng chat
    toast.onclick = () => {
        toast.classList.add("hiding");
        setTimeout(() => toast.remove(), 300);

        startChat(msg.senderId, senderName, avatarUrl);

        // Chuyển tab về menu tin nhắn nếu user đang lướt tab khác
        const messagesTabNav = document.querySelector(
            '.nav-item[title="Tin nhắn"]',
        );
        if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
    };

    container.appendChild(toast);

    // Tự động ẩn Toast mượt mà sau 4 giây (NGOẠI TRỪ lúc app đang tắt/nằm dưới nền)
    setTimeout(() => {
        if (toast.parentElement && !isAppInBackground) {
            toast.classList.add("hiding");
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

async function sendNativeNotification(msg) {
    const sender = msg.Users || {};
    const senderName = sender.fullName || "Tin nhắn mới";

    let snippet = msg.content;
    if (msg.isRecalled) snippet = "Tin nhắn đã bị thu hồi";
    else if (msg.type === "missed_call") snippet = "Cuộc gọi nhỡ";
    else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            snippet = `[ Tệp tin: ${fileData.fileName} ]`;
        } catch (e) {
            snippet = "[ Tệp tin ]";
        }
    }
    else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
    else if (
        msg.content &&
        (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
    ) {
        snippet = "[ Hình ảnh ]";
    }

    let avatarUrl = sender.avatar ?
        sender.avatar.startsWith("http") ?
        sender.avatar :
        SERVER_URL + sender.avatar :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
        senderName,
      )}&background=random`;

    // DÀNH CHO TRÌNH DUYỆT WEB (CHROME, SAFARI, EDGE TRÊN MÁY TÍNH & ĐIỆN THOẠI)
    if ("Notification" in window && Notification.permission === "granted") {
        const isMobileWeb = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobileWeb) {
            showNewMessageToast(msg);
        } else {
            try {
                const notification = new Notification(senderName, {
                    body: snippet,
                    icon: avatarUrl,
                });
                notification.onclick = () => {
                    window.focus(); // Đánh thức tab trình duyệt lên trên cùng
                    startChat(msg.senderId, senderName, avatarUrl);
                    const messagesTabNav = document.querySelector(
                        '.nav-item[title="Tin nhắn"]',
                    );
                    if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
                };
            } catch (err) {
                console.warn(
                    "Trình duyệt di động chặn Notification, chuyển sang dùng Toast.",
                    err,
                );
                showNewMessageToast(msg);
            }
        }
    } else {
        showNewMessageToast(msg);
    }
}

// ==========================================
// CẬP NHẬT "ĐÃ XEM" KHI QUAY LẠI TRÌNH DUYỆT
// ==========================================
window.addEventListener("focus", () => {
    if (currentConversationId && socket && isChatAreaVisible()) {
        emitMarkMessagesRead();
    }
});

// =========================================
// TÍNH NĂNG ĐẢO CAMERA (TRƯỚC/SAU)
// =========================================

async function flipCamera() {
    if (!localStream || callTypeGlobal !== "video") return;

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;

    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false,
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        videoTracks[0].stop();
        localStream.removeTrack(videoTracks[0]);
        localStream.addTrack(newVideoTrack);

        if (peerConnection) {
            const sender = peerConnection
                .getSenders()
                .find((s) => s.track && s.track.kind === "video");
            if (sender) sender.replaceTrack(newVideoTrack);
        }

        document.getElementById("local-video").srcObject = null;
        document.getElementById("local-video").srcObject = localStream;
    } catch (error) {
        console.error("Lỗi đảo Camera:", error);
        alert("Không thể di chuyển Camera. Thiết bị có thể không hỗ trợ.");
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// Đóng tất cả bảng cảm xúc & menu khi chạm ngoài
document.addEventListener("click", () => {
    document
        .querySelectorAll(".reaction-palette.show")
        .forEach((p) => p.classList.remove("show"));
    document
        .querySelectorAll(".more-menu.show")
        .forEach((m) => m.classList.remove("show"));
});

// ===========================================
// LOGIC GIAO DIỆN & HỒ SƠ
// ===========================================

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.setAttribute("data-theme", "dark");
        const toggle = document.getElementById("dark-mode-toggle");
        if (toggle) toggle.checked = true;
    }

    tryAutoLogin();
});

async function tryAutoLogin() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "none";

    showLoading("Đăng nhập tự động...");

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.success) {
            initizeChatSession(data.data, token);
        } else {
            localStorage.removeItem("authToken");
            if (loginForm) loginForm.style.display = "block";
        }
    } catch (error) {
        console.error("Lỗi đăng nhập tự động:", error);
        if (loginForm) loginForm.style.display = "block";
    } finally {
        hideLoading();
    }
}

function toggleDarkMode(checkbox) {
    if (checkbox.checked) {
        document.body.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    } else {
        document.body.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
    }
}

// =========================================
// TÍNH NĂNG MỚI: LIGHTBOX (XEM ẢNH PHÓNG TO)
// =========================================

function openLightbox(src) {
    const lightbox = document.getElementById("image-lightbox");
    const img = document.getElementById("lightbox-img");

    if (lightbox && img) {
        img.src = src;
        lightbox.style.display = "flex";
        setTimeout(() => {
            lightbox.style.opacity = "1";
            img.style.transform = "scale(1)";
        }, 10);
    }
}

function closeLightbox() {
    const lightbox = document.getElementById("image-lightbox");
    const img = document.getElementById("lightbox-img");

    if (lightbox && img) {
        lightbox.style.opacity = "0";
        img.style.transform = "scale(0.8)";
        setTimeout(() => {
            lightbox.style.display = "none";
            img.src = "";
        }, 300);
    }
}

// Chuyển đổi giữa các Tab
function switchTab(tabId, navElement) {
    if (tabId === "tab-contacts") {
        navElement.classList.remove("shake");
    }

    document
        .querySelectorAll(".tab-pane")
        .forEach((tab) => tab.classList.remove("active"));
    document
        .querySelectorAll(".nav-item")
        .forEach((nav) => nav.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    navElement.classList.add("active");
}

// Đăng xuất
async function logout() {
    const consent = await customConfirm("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?", "Đăng xuất", "Hủy", true);
    if (!consent) return;

    localStorage.removeItem("authToken");
    token = "";
    myId = "";
    myName = "";
    currentConversationId = "";
    currentChatPartnerId = null;

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    document.getElementById("chat-screen").style.display = "none";
    document.getElementById("chat-screen").classList.remove("mobile-chat-active");
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("login-password").value = "";

    const defaultTab = document.querySelector('.nav-item[title="Tin nhắn"]');
    if (defaultTab) switchTab("tab-messages", defaultTab);
}

// Cập nhật Ảnh bìa (Cover Image)
const coverUploadInput = document.getElementById("cover-upload");
if (coverUploadInput) {
    coverUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("coverImage", file);

        try {
            const res = await fetch(`${API_URL}/users/cover`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                document.getElementById("my-cover").src = SERVER_URL + data.coverUrl;
            } else {
                alert("Lỗi tải ảnh bìa: " + data.message);
            }
        } catch (error) {
            alert("Lỗi hệ thống khi tải ảnh bìa lên!");
        }
    });
}

// Cập nhật Thông tin Hồ sơ (Tên & Tiểu sử)
async function openEditProfileModal() {
    const currentName = document.getElementById("profile-name").innerText;
    const currentBio = document.getElementById("profile-bio").innerText;

    const newName = await customPrompt("Đổi tên hiển thị", "Nhập tên hiển thị mới của bạn:", currentName, "Tên hiển thị");
    if (newName === null) return;

    const newBio = await customPrompt(
        "Đổi tiểu sử",
        "Nhập dòng trạng thái/tiểu sử mới:",
        currentBio !== "Chưa có tiểu sử" ? currentBio : "",
        "Tiểu sử / Dòng trạng thái"
    );
    if (newBio === null) return;

    if (!newName.trim()) return alert("Tên hiển thị không được để trống!");

    try {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fullName: newName, bio: newBio }),
        });

        const data = await res.json();
        if (data.success) {
            myName = data.data.fullName;
            document.getElementById("my-name").innerText = myName;
            document.getElementById("profile-name").innerText = myName;
            document.getElementById("profile-bio").innerText =
                data.data.bio || "Chưa có tiểu sử";
            alert("Cập nhật thông tin thành công!");
        } else {
            alert("Cập nhật bị lỗi: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối mạng khi cập nhật thông tin!");
    }
}

// ==========================================
// LOGIC GỌI VIDEO / THOẠI (WEBRTC)
// ==========================================

async function upgradeToVideoCall() {
    if (callTypeGlobal !== "voice" || !localStream || !peerConnection) {
        console.warn(
            "Không thể nâng cấp: cuộc gọi không phải di động hoặc chưa kết nối.",
        );
        return;
    }

    try {
        console.log("Đang yêu cầu quyền truy cập camera để nâng cấp...");

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const videoConstraints = isMobile ? { facingMode: currentFacingMode } :
            true;
        const videoStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);

        const sender = peerConnection.addTrack(videoTrack, localStream);
        if (!sender) {
            throw new Error("Không thể thêm video track vào PeerConnection.");
        }

        callTypeGlobal = "video";
        const modal = document.getElementById("call-modal");
        modal.classList.remove("voice-call");
        modal.classList.add("video-call");

        document.getElementById("local-video").srcObject = null;
        document.getElementById("local-video").srcObject = localStream;

        const flipBtn = document.getElementById("flip-cam-btn");
        if (flipBtn && isMobile) {
            flipBtn.style.display = "block";
        }

        const camBtn = document.getElementById("toggle-cam-btn");
        if (camBtn) {
            camBtn.style.backgroundColor = "#3a3a3c";
            camBtn.innerHTML = '<i class="fas fa-video"></i>';
        }

        socket.emit("did_upgrade_to_video", { to: currentCallPartnerId });

        console.log("Bắt đầu renegotiate để gửi video luồng...");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("webrtc_signal", {
            connectedUserId: currentCallPartnerId,
            signal: { offer },
        });
    } catch (error) {
        console.error("Lỗi khi nâng cấp cuộc gọi video:", error);
        alert(
            "Không thể bật video. Vui lòng kiểm tra lại quyền truy cập camera của bạn.",
        );
    }
}

function startCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);

    callStartTime = Date.now();
    const statusEl = document.getElementById("call-status");
    if (statusEl) statusEl.innerText = "00:00";

    callTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const secs = String(elapsed % 60).padStart(2, "0");
        if (statusEl) statusEl.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
}

// ==========================================
// QUẢN LÝ HIỆU ỨNG RUNG TRÊN ĐIỆN THOẠI
// ==========================================

function startVibration() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.vibrate) {
        navigator.vibrate([1000, 500, 1000, 500, 1000]);
        vibrateInterval = setInterval(() => {
            navigator.vibrate([1000, 500, 1000, 500, 1000]);
        }, 4500);
    }
}

function stopVibration() {
    if (vibrateInterval) clearInterval(vibrateInterval);
    vibrateInterval = null;
    if (navigator.vibrate) navigator.vibrate(0);
}

function playRingtone() {
    const ringtone = document.getElementById("incoming-ringtone");
    if (ringtone) {
        ringtone.currentTime = 0;
        ringtone
            .play()
            .catch((e) => console.warn("Trình duyệt chặn tự động phát âm thanh:", e));
    }
}

function stopRingtone() {
    const ringtone = document.getElementById("incoming-ringtone");
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
}

function playOutgoingRingtone() {
    const ringtone = document.getElementById("outgoing-ringtone");
    if (ringtone) {
        ringtone.volume = 1.0;
        ringtone.currentTime = 0;
        const playPromise = ringtone.play();
        if (playPromise !== undefined) {
            playPromise.catch((e) =>
                console.warn("Trình duyệt chặn tự động phát âm thanh:", e),
            );
        }
    } else {
        console.error("Không tìm thấy thẻ <audio id='outgoing-ringtone'>!");
    }
}

function stopOutgoingRingtone() {
    const ringtone = document.getElementById("outgoing-ringtone");
    if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
    }
}

// 1. Bắt đầu cuộc gọi (Người gọi)
async function startCall(callType) {
    if (!currentChatPartnerId) return alert("Vui lòng chọn một người để gọi.");

    const outRing = document.getElementById("outgoing-ringtone");
    if (outRing) {
        outRing.play().catch(() => {});
        outRing.pause();
    }

    const remoteAudioEl = document.getElementById("remote-audio");
    if (remoteAudioEl) {
        remoteAudioEl.play().catch(() => {});
        remoteAudioEl.pause();
    }

    callTypeGlobal = callType;
    currentCallPartnerId = currentChatPartnerId;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Trình duyệt chặn Microphone do bạn không sử dụng HTTPS hoặc Localhost!",
            );
        }

        const mediaConstraints = {
            audio: {
                noiseSuppression: isNoiseCancellationEnabled,
                echoCancellation: true,
            },
            video: callTypeGlobal === "video" ?
                isMobile ? { facingMode: currentFacingMode } :
                true : false,
        };

        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        if (callTypeGlobal === "video") {
            document.getElementById("local-video").srcObject = localStream;
        }
    } catch (error) {
        const errorMsg = error.message;
        if (
            error.name === "NotFoundError" ||
            errorMsg.includes("Không tìm thấy thiết bị được yêu cầu")
        ) {
            console.warn(
                "Không tìm thấy Camera/Microphone! Cuộc gọi tiếp tục ở chế độ chỉ xem/nghe.",
            );
        } else if (
            error.name === "NotAllowedError" ||
            errorMsg.includes("Quyền bị từ chối")
        ) {
            console.warn("Trình duyệt đã chặn quyền truy cập Camera/Microphone!");
        } else {
            console.error("Lỗi truy cập thiết bị nghe nhìn: " + errorMsg);
        }
        localStream = null;
    }

    const modal = document.getElementById("call-modal");
    modal.classList.remove("voice-call", "video-call", "in-call", "is-caller");
    modal.classList.add(`${callType}-call`, "is-caller");

    const partnerName = document.getElementById("chat-header-name").innerText;
    document.getElementById("call-name").innerText = partnerName;

    const currentChatAvatarEl = document.getElementById("current-chat-avatar");
    let partnerAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    partnerName,
  )}&background=random`;

    if (currentChatAvatarEl && currentChatAvatarEl.src) {
        partnerAvatarUrl = currentChatAvatarEl.src;
    }

    document.getElementById("call-avatar").src = partnerAvatarUrl;
    document.getElementById("call-status").innerText = "Đang gọi...";

    const flipBtn = document.getElementById("flip-cam-btn");
    if (flipBtn)
        flipBtn.style.display = callType === "video" && isMobile ? "block" : "none";

    document
        .getElementById("incoming-call-actions")
        .setAttribute("style", "display: none !important");
    document
        .getElementById("active-call-actions")
        .setAttribute("style", "display: flex !important");

    modal.style.display = "flex";

    let myAvatarUrl = document.getElementById("my-avatar").src;
    if (myAvatarUrl && myAvatarUrl.startsWith(window.location.origin)) {
        myAvatarUrl = myAvatarUrl.replace(window.location.origin, "");
    }

    socket.emit("request_call", {
        callerId: myId,
        callerName: myName,
        calleeId: currentChatPartnerId,
        callerAvatar: myAvatarUrl,
        callType,
    });

    playOutgoingRingtone();
}

// 2. Xử lý khi có cuộc gọi đến (Callee)
function handleIncomingCall(data) {
    try {
        if (!data) return;

        const { callerId, callerName, callType, callerAvatar } = data;
        callTypeGlobal = callType;
        currentCallPartnerId = callerId;

        const modal = document.getElementById("call-modal");
        if (!modal) return;

        modal.classList.remove("voice-call", "video-call", "in-call", "is-caller");
        modal.classList.add(`${callType}-call`);

        document.getElementById("call-name").innerText = callerName || "Người dùng";

        let safeAvatar;
        if (callerAvatar && callerAvatar.trim() !== "") {
            safeAvatar = callerAvatar.startsWith("http") ?
                callerAvatar :
                SERVER_URL + callerAvatar;
        } else {
            safeAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        callerName || "User",
      )}&background=random`;
        }

        document.getElementById("call-avatar").src = safeAvatar;
        document.getElementById("call-status").innerText = `${
      callType === "video" ? "video" : "điện thoại"
    } cho bạn...`;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const flipBtn = document.getElementById("flip-cam-btn");
        if (flipBtn)
            flipBtn.style.display =
            callType === "video" && isMobile ? "block" : "none";

        document
            .getElementById("incoming-call-actions")
            .setAttribute("style", "display: flex !important");
        document
            .getElementById("active-call-actions")
            .setAttribute("style", "display: none !important");

        modal.style.display = "flex";
        modal.style.zIndex = "99999";

        startVibration();
        playRingtone();

        document.getElementById("accept-call-btn").onclick = async() => {
            stopVibration();
            stopRingtone();

            const remoteAudio = document.getElementById("remote-audio");
            if (remoteAudio) {
                remoteAudio.play().catch(() => {});
                remoteAudio.pause();
            }

            const remoteVideo = document.getElementById("remote-video");
            if (remoteVideo) {
                remoteVideo.play().catch(() => {});
                remoteVideo.pause();
            }

            const success = await startCallSession(false);
            if (success) {
                socket.emit("accept_call", { callerId });
                startCallTimer();
            }
        };

        document.getElementById("reject-call-btn").onclick = () => {
            stopVibration();
            stopRingtone();
            socket.emit("reject_call", { callerId, callType: callTypeGlobal });
            endCall(false);
        };
    } catch (error) {
        console.error("Lỗi khi hiển thị cuộc gọi đến:", error);
    }
}

// 2.5 Xử lý khi cuộc gọi bị từ chối (Người gọi)
function handleCallRejected() {
    stopVibration();
    stopOutgoingRingtone();
    alert("Người dùng đã từ chối cuộc gọi.");
    endCall(false);
}

// 3. Cuộc gọi được chấp nhận (Người gọi)
async function handleCallAccepted(data) {
    try {
        stopOutgoingRingtone();

        const calleeInfo = data ? data.calleeInfo : null;

        if (calleeInfo) {
            document.getElementById("call-name").innerText =
                calleeInfo.fullName || "Người dùng";

            let avatarUrl;
            if (calleeInfo.avatar && calleeInfo.avatar.trim() !== "") {
                avatarUrl = calleeInfo.avatar.startsWith("http") ?
                    calleeInfo.avatar :
                    SERVER_URL + calleeInfo.avatar;
            } else {
                avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          calleeInfo.fullName || "User",
        )}&background=random`;
            }

            document.getElementById("call-avatar").src = avatarUrl;
        }

        await startCallSession(true, calleeInfo);
        startCallTimer();
    } catch (error) {
        console.error("Lỗi khi xử lý chấp nhận cuộc gọi:", error);
        alert("Có thể xảy ra lỗi khi kết nối cuộc gọi.");
        endCall(true);
    }
}

// 3.5. Đối phương nâng cấp lên Video Call
function handleUpgradeToVideo() {
    if (callTypeGlobal === "video") return;

    console.log("Đối phương đã bật video. Nâng cấp cuộc gọi...");
    callTypeGlobal = "video";

    const modal = document.getElementById("call-modal");
    if (modal) {
        modal.classList.remove("voice-call");
        modal.classList.add("video-call");
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const flipBtn = document.getElementById("flip-cam-btn");
    if (flipBtn && isMobile) {
        flipBtn.style.display = "block";
    }

    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo && remoteVideo.srcObject) {
        const stream = remoteVideo.srcObject;
        remoteVideo.srcObject = null;
        remoteVideo.srcObject = stream;
        remoteVideo.play().catch(() => {});
    }
}

// 4. Bắt đầu phiên bản WebRTC
async function startCallSession(isCaller, calleeInfo = null) {
    document.getElementById("call-modal").classList.add("in-call");
    document.getElementById("call-status").innerText = "Trong cuộc gọi...";

    document
        .getElementById("incoming-call-actions")
        .setAttribute("style", "display: none !important");
    document
        .getElementById("active-call-actions")
        .setAttribute("style", "display: flex !important");

    try {
        if (!localStream && !isCaller) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error(
                    "Trình duyệt chặn Microphone do bạn không dùng HTTPS hoặc Localhost!",
                );
            }

            try {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const mediaConstraints = {
                    audio: {
                        noiseSuppression: isNoiseCancellationEnabled,
                        echoCancellation: true,
                    },
                    video: callTypeGlobal === "video" ?
                        isMobile ? { facingMode: currentFacingMode } :
                        true : false,
                };

                localStream = await navigator.mediaDevices.getUserMedia(
                    mediaConstraints,
                );

                if (callTypeGlobal === "video") {
                    document.getElementById("local-video").srcObject = localStream;
                }
            } catch (err) {
                const errorMsg = err.message;
                if (
                    err.name === "NotFoundError" ||
                    errorMsg.includes("Requested device not found")
                ) {
                    console.warn("Không tìm thấy Camera/Microphone!");
                    localStream = null;
                } else if (
                    err.name === "NotAllowedError" ||
                    errorMsg.includes("Quyền bị từ chối")
                ) {
                    console.warn("Chưa được cấp quyền sử dụng Camera/Microphone!");
                    localStream = null;
                } else {
                    console.error("Lỗi Microphone:", errorMsg);
                    localStream = null;
                }
            }
        }

        peerConnection = new RTCPeerConnection(stunServers);

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });
        }

        peerConnection.ontrack = (event) => {
            const stream =
                event.streams && event.streams.length > 0 ?
                event.streams[0] :
                new MediaStream([event.track]);

            if (event.track.kind === "audio") {
                const remoteAudio = document.getElementById("remote-audio");
                if (remoteAudio) {
                    remoteAudio.srcObject = stream;
                    remoteAudio.muted = false;
                    remoteAudio
                        .play()
                        .catch((e) => console.error("Lỗi phát âm thanh từ xa:", e));
                }
            } else if (event.track.kind === "video") {
                const remoteVideo = document.getElementById("remote-video");
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                    remoteVideo
                        .play()
                        .catch((e) => console.error("Lỗi phát video từ xa:", e));
                }
            }
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("webrtc_signal", {
                    connectedUserId: currentCallPartnerId,
                    signal: { ice: event.candidate },
                });
            }
        };

        if (isCaller) {
            if (!localStream) {
                peerConnection.addTransceiver("audio", { direction: "recvonly" });
                if (callTypeGlobal === "video") {
                    peerConnection.addTransceiver("video", { direction: "recvonly" });
                }
            }

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit("webrtc_signal", {
                connectedUserId: currentCallPartnerId,
                signal: { offer },
            });
        }

        return true;
    } catch (error) {
        console.error("Lỗi khi bắt đầu phiên gọi:", error);
        alert("Lỗi cuộc gọi: " + error.message);
        endCall(true);
        return false;
    }
}

// 5. Xử lý tín hiệu WebRTC nhận được
async function handleWebRTCSignal({ signal, senderId }) {
    if (senderId) {
        currentCallPartnerId = senderId;
    }

    if (!peerConnection) {
        if (signal.ice) {
            iceCandidateQueue.push(signal.ice);
        }
        return;
    }

    if (signal.offer) {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(signal.offer),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("webrtc_signal", {
            connectedUserId: currentCallPartnerId,
            signal: { answer },
        });
        processIceQueue();
    } else if (signal.answer) {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(signal.answer),
        );
        processIceQueue();
    } else if (signal.ice) {
        if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
        } else {
            iceCandidateQueue.push(signal.ice);
        }
    }
}

// 5.5 Hàm xử lý hàng đợi ICE
async function processIceQueue() {
    for (const ice of iceCandidateQueue) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(ice));
        } catch (e) {
            console.error("Lỗi khi thêm ICE:", e);
        }
    }
    iceCandidateQueue = [];
}

// 6. Kết thúc cuộc gọi
function endCall(shouldEmit) {
    stopCallTimer();
    stopVibration();
    stopRingtone();
    stopOutgoingRingtone();

    if (shouldEmit && currentCallPartnerId) {
        socket.emit("end_call", { connectedUserId: currentCallPartnerId });
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    stopScreenShare();
    iceCandidateQueue = [];
    currentCallPartnerId = null;

    const modal = document.getElementById("call-modal");
    modal.style.display = "none";
    modal.classList.remove("voice-call", "video-call", "in-call", "is-caller");

    document.getElementById("local-video").srcObject = null;
    document.getElementById("remote-video").srcObject = null;

    const remoteAudioEl = document.getElementById("remote-audio");
    if (remoteAudioEl) remoteAudioEl.srcObject = null;

    const flipBtn = document.getElementById("flip-cam-btn");
    if (flipBtn) flipBtn.style.display = "none";

    currentFacingMode = "user";

    document.getElementById("reject-call-btn").onclick = () => endCall(true);
    document.getElementById("accept-call-btn").onclick = null;

    const micBtn = document.getElementById("toggle-mic-btn");
    if (micBtn) {
        micBtn.style.backgroundColor = "#3a3a3c";
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }

    const camBtn = document.getElementById("toggle-cam-btn");
    if (camBtn) {
        camBtn.style.backgroundColor = "#3a3a3c";
        camBtn.innerHTML = '<i class="fas fa-video"></i>';
    }

    const spkBtn = document.getElementById("toggle-speaker-btn");
    if (spkBtn) {
        spkBtn.style.backgroundColor = "#3a3a3c";
        spkBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

// ===========================================
// KÍCH HOẠT CÁC NÚT ĐIỀU KHIỂN CUỘC GỌI
// ===========================================

const micBtn = document.getElementById("toggle-mic-btn");
if (micBtn) {
    micBtn.addEventListener("click", function() {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                if (!audioTrack.enabled) {
                    this.style.backgroundColor = "#ff3b30";
                    this.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                } else {
                    this.style.backgroundColor = "#3a3a3c";
                    this.innerHTML = '<i class="fas fa-microphone"></i>';
                }
            }
        } else {
            alert("Bật kết nối Micro!");
        }
    });
}

const camBtn = document.getElementById("toggle-cam-btn");
if (camBtn) {
    camBtn.addEventListener("click", function() {
        if (!localStream) {
            return alert("Cuộc gọi chưa được kết nối!");
        }

        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            if (!videoTrack.enabled) {
                this.style.backgroundColor = "#ff3b30";
                this.innerHTML = '<i class="fas fa-video-slash"></i>';
            } else {
                this.style.backgroundColor = "#3a3a3c";
                this.innerHTML = '<i class="fas fa-video"></i>';
            }
        } else {
            upgradeToVideoCall();
        }
    });
}

const spkBtn = document.getElementById("toggle-speaker-btn");
if (spkBtn) {
    spkBtn.addEventListener("click", function() {
        const remoteAudio = document.getElementById("remote-audio");
        if (remoteAudio) {
            remoteAudio.muted = !remoteAudio.muted;
            if (remoteAudio.muted) {
                this.style.backgroundColor = "#ff3b30";
                this.innerHTML = '<i class="fas fa-volume-mute"></i>';
            } else {
                this.style.backgroundColor = "#3a3a3c";
                this.innerHTML = '<i class="fas fa-volume-up"></i>';
            }
        }
    });
}

// =========================================
// TÍNH NĂNG TÙY CHỌN 3 CHẤM (BOTTOM SHEET)
// =========================================

function toggleCallOptionsMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("call-options-menu");
    if (menu) menu.classList.toggle("show");
}

async function toggleNoiseCancellation() {
    const toggle = document.getElementById("noise-cancel-toggle");
    const newState = !isNoiseCancellationEnabled;

    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            try {
                await audioTrack.applyConstraints({
                    noiseSuppression: newState,
                    echoCancellation: true,
                });
                isNoiseCancellationEnabled = newState;
                if (toggle) toggle.checked = isNoiseCancellationEnabled;
            } catch (e) {
                console.error("Lỗi không hỗ trợ đổi tiếng ồn trực tiếp:", e);
                if (toggle) toggle.checked = isNoiseCancellationEnabled;
            }
        }
    } else {
        isNoiseCancellationEnabled = newState;
        if (toggle) toggle.checked = isNoiseCancellationEnabled;
    }
}

async function toggleScreenShare() {
    if (isScreenSharing) {
        stopScreenShare();
        return;
    }

    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenShare();

        const localVideo = document.getElementById("local-video");
        localVideo.style.display = "block";
        localVideo.srcObject = screenStream;

        if (peerConnection) {
            peerConnection.addTrack(screenTrack, screenStream);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit("webrtc_signal", {
                connectedUserId: currentCallPartnerId,
                signal: { offer },
            });
        }

        isScreenSharing = true;
        const btnText = document.querySelector("#btn-share-screen .sheet-text p");
        if (btnText) btnText.innerText = "Đang chia sẻ...";
        const btnIcon = document.querySelector("#btn-share-screen .sheet-icon");
        if (btnIcon) btnIcon.style.color = "#05a060";

        toggleCallOptionsMenu();
    } catch (e) {
        console.error("Lỗi chia sẻ màn hình:", e);
    }
}

async function stopScreenShare() {
    if (!isScreenSharing) return;

    if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
    }

    const localVideo = document.getElementById("local-video");
    localVideo.srcObject = null;
    localVideo.style.display = "none";

    if (peerConnection) {
        const videoSender = peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
            peerConnection.removeTrack(videoSender);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit("webrtc_signal", {
                connectedUserId: currentCallPartnerId,
                signal: { offer },
            });
        }
    }

    isScreenSharing = false;
    const modal = document.getElementById("call-modal");
    if (callTypeGlobal === "voice") modal.classList.add("voice-call");

    const textEl = document.querySelector("#btn-share-screen .sheet-text p");
    if (textEl) textEl.innerText = "Chia sẻ màn hình của bạn";
    const iconEl = document.querySelector("#btn-share-screen .sheet-icon");
    if (iconEl) iconEl.style.color = "";
}

// =========================================
// TÍNH NĂNG THÔNG BÁO & TOAST
// =========================================

async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/users/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
            notificationsList = data.data;
            updateNotificationBadge();
            renderNotifications();
        }
    } catch (e) {
        console.error("Lỗi tải thông báo:", e);
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById("notifications-badge");
    if (!badge) return;
    const unreadCount = notificationsList.filter((n) => !n.isRead).length;
    if (unreadCount > 0) {
        badge.innerText = unreadCount > 9 ? "9+" : unreadCount;
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

function renderNotifications() {
    const listEl = document.getElementById("notifications-list");
    if (!listEl) return;

    if (notificationsList.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-light); text-align: center; margin-top: 20px;">Chưa có thông báo nào.</p>`;
        return;
    }

    listEl.innerHTML = "";
    notificationsList.forEach((notif) => {
        const sender = notif.Sender;
        const avatarUrl = sender.avatar ?
            sender.avatar.startsWith("http") ?
            sender.avatar :
            SERVER_URL + sender.avatar :
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
          sender.fullName,
        )}&background=random`;
        const date = new Date(notif.createdAt);
        const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")} - ${date.getDate()}/${date.getMonth() + 1}`;

        const itemEl = document.createElement("div");
        itemEl.className = `notification-item ${notif.isRead ? "" : "unread"}`;
        itemEl.onclick = () => markNotificationAsRead(notif.id);
        itemEl.innerHTML = `
      <img src="${avatarUrl}" class="notification-avatar" alt="Avatar">
      <div class="notification-content">
        <p class="notification-text"><b>${sender.fullName}</b> ${notif.content}</p>
        <p class="notification-time">${timeStr}</p>
      </div>
    `;
        listEl.appendChild(itemEl);
    });
}

async function markNotificationAsRead(notifId) {
    const notif = notificationsList.find((n) => n.id === notifId);
    if (notif && !notif.isRead) {
        notif.isRead = true;
        updateNotificationBadge();
        renderNotifications();
        try {
            await fetch(`${API_URL}/users/notifications/${notifId}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (e) {}
    }
}

function showToastNotification(notif) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const sender = notif.Sender;
    const avatarUrl = sender.avatar ?
        sender.avatar.startsWith("http") ?
        sender.avatar :
        SERVER_URL + sender.avatar :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
        sender.fullName,
      )}&background=random`;

    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.innerHTML = `
    <img src="${avatarUrl}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 14px; color: var(--text-dark);">${sender.fullName}</div>
      <div style="font-size: 12px; color: var(--text-light);">${notif.content}</div>
    </div>
  `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// CHỐNG ZOOM VÀ DOUBLE-TAP TRÊN MOBILE
// ==========================================

// Chống pinch-to-zoom (phóng to/thu nhỏ bằng nhiều ngón tay) trên Android/iOS
document.addEventListener(
    "touchmove",
    function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    },
    { passive: false }
);

// Chống zoom cử chỉ trên iOS Safari
document.addEventListener(
    "gesturestart",
    function(e) {
        e.preventDefault();
    },
    { passive: false }
);

let lastTouchEnd = 0;
document.addEventListener(
    "touchend",
    function(e) {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
            if (!e.target.closest("input, textarea, button, a")) {
                e.preventDefault();
            }
        }
        lastTouchEnd = now;
    }, { passive: false },
);

// Chống zoom bằng con lăn chuột
document.addEventListener(
    "wheel",
    function(e) {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false },
);

// =========================================
// HỖ TRỢ TÍNH NĂNG TRẢ LỜI TIN NHẮN (REPLY)
// =========================================

// Thiết lập chế độ trả lời tin nhắn
function setReplyMode(msgId) {
    const msg = currentChatMessages.find(m => m.id === msgId);
    if (!msg) return;

    replyingToMessage = msg;
    
    // Tìm tên người gửi
    let senderName = "Người dùng";
    if (msg.senderId === myId) {
        senderName = "chính mình";
    } else if (msg.Users) {
        senderName = msg.Users.fullName;
    } else {
        const headerName = document.getElementById("chat-header-name");
        if (headerName) senderName = headerName.innerText;
    }

    // Thiết lập nội dung trích dẫn
    let textPreview = msg.content;
    if (msg.isRecalled) {
        textPreview = "Tin nhắn đã bị thu hồi";
    } else if (msg.content && (msg.content.startsWith("data:image/") || msg.content.match(/\.(jpeg|jpg|gif|png)$/i))) {
        textPreview = "[Hình ảnh]";
    } else if (msg.type === "missed_call") {
        textPreview = "[Cuộc gọi nhỡ]";
    }

    // Hiển thị thanh preview
    const previewContainer = document.getElementById("reply-preview-container");
    const previewSender = document.getElementById("reply-preview-sender");
    const previewText = document.getElementById("reply-preview-text");

    if (previewContainer && previewSender && previewText) {
        previewSender.innerText = senderName;
        previewText.innerText = textPreview;
        previewContainer.style.display = "flex";
        
        // Cuộn xuống để không bị che khuất ô nhập
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Focus vào input để gõ luôn
    const input = document.getElementById("message-input");
    if (input) input.focus();
}

// Hủy chế độ trả lời tin nhắn
function cancelReply() {
    replyingToMessage = null;
    const previewContainer = document.getElementById("reply-preview-container");
    if (previewContainer) {
        previewContainer.style.display = "none";
    }
}

// Cuộn đến tin nhắn gốc và nháy sáng highlight
function scrollToAndHighlightMessage(msgId) {
    const targetEl = document.getElementById(`msg-${msgId}`);
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Thêm class highlight
        targetEl.classList.remove("message-highlight");
        // Force reflow
        void targetEl.offsetWidth;
        targetEl.classList.add("message-highlight");
        
        // Xóa class highlight sau khi chạy xong animation
        setTimeout(() => {
            targetEl.classList.remove("message-highlight");
        }, 1500);
    } else {
        alert("Tin nhắn gốc đã quá cũ hoặc không tìm thấy trong giao diện hiện tại.");
    }
}

// Sao chép văn bản tin nhắn vào Clipboard
function copyMessageText(content) {
    if (!content) return;
    
    // Kiểm tra nếu là hình ảnh (base64 hoặc đường dẫn hình ảnh)
    if (content.startsWith("data:image/") || content.match(/\.(jpeg|jpg|gif|png)$/i)) {
        showTempToast("Không thể sao chép hình ảnh dưới dạng văn bản.");
        return;
    }
    
    navigator.clipboard.writeText(content)
        .then(() => {
            showTempToast("Đã sao chép tin nhắn.");
        })
        .catch((err) => {
            console.error("Lỗi sao chép:", err);
            // Fallback cho môi trường không có HTTPS hoặc thiết bị cũ
            const textarea = document.createElement("textarea");
            textarea.value = content;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand("copy");
                showTempToast("Đã sao chép tin nhắn.");
            } catch (e) {
                showTempToast("Không thể sao chép tin nhắn.");
            }
            document.body.removeChild(textarea);
        });
}

// Hiển thị Toast thông báo nhanh (dành riêng cho sao chép)
function showTempToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.style.padding = "10px 18px";
    toast.style.background = "rgba(0, 0, 0, 0.85)";
    toast.style.color = "#ffffff";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "13px";
    toast.style.fontWeight = "500";
    toast.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    toast.style.textAlign = "center";
    toast.style.zIndex = "99999";
    toast.innerText = message;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Gửi tin nhắn chứa tệp tin hoặc tin nhắn thoại
function sendFileOrAudioMessage(content, type) {
    if (!currentConversationId) {
        return alert("Bạn chưa chọn cuộc hội thoại!");
    }

    try {
        const payload = {
            content,
            type
        };
        if (replyingToMessage) {
            payload.replyMessageId = replyingToMessage.id;
        }

        const res = fetch(`${API_URL}/chat/${currentConversationId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        cancelReply();

        res
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    displayMessage(data.data);
                    // Cập nhật sidebar nhẹ hơn, không reload toàn bộ danh sách
                    updateChatListUI(data.data, true);
                } else {
                    alert("Gửi thất bại: " + data.message);
                }
            });
    } catch (err) {
        alert("Lỗi mạng: " + err.message);
    }
}

// Bật/tắt trạng thái ghi âm tin nhắn thoại
function toggleVoiceRecording() {
    const recordBtn = document.getElementById("voice-record-btn");
    const input = document.getElementById("message-input");

    if (!recordBtn || !input) return;

    if (!isRecording) {
        // Bắt đầu ghi âm
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return alert("Trình duyệt của bạn không hỗ trợ ghi âm.");
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                isRecording = true;
                audioChunks = [];
                
                recordBtn.classList.remove("fa-microphone");
                recordBtn.classList.add("fa-stop", "recording");
                
                input.placeholder = "Đang ghi âm... Nhấp nút Stop để gửi.";
                input.disabled = true;

                // Khởi tạo MediaRecorder
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const base64Audio = event.target.result;
                        sendFileOrAudioMessage(base64Audio, "audio");
                    };
                    reader.readAsDataURL(audioBlob);

                    // Tắt tất cả các track trong stream để giải phóng mic
                    stream.getTracks().forEach((track) => track.stop());
                };

                mediaRecorder.start();
            })
            .catch((err) => {
                console.error("Lỗi truy cập Micro:", err);
                alert("Không thể truy cập Micro. Vui lòng cấp quyền ghi âm.");
            });
    } else {
        // Dừng ghi âm và gửi
        isRecording = false;
        
        recordBtn.classList.remove("fa-stop", "recording");
        recordBtn.classList.add("fa-microphone");
        
        input.placeholder = "Nhập tin nhắn...";
        input.disabled = false;

        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
    }
}

// ==========================================
// CUSTOM DIALOG SYSTEM (MODALS)
// ==========================================

function customConfirm(title, message, okText = "Xác nhận", cancelText = "Hủy", isDanger = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById("custom-confirm-modal");
        const titleEl = document.getElementById("custom-confirm-title");
        const msgEl = document.getElementById("custom-confirm-message");
        const okBtn = document.getElementById("custom-confirm-ok-btn");
        const cancelBtn = document.getElementById("custom-confirm-cancel-btn");

        if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
            return resolve(confirm(message));
        }

        titleEl.innerText = title;
        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.innerText = cancelText;

        if (isDanger) {
            okBtn.className = "custom-btn btn-danger";
        } else {
            okBtn.className = "custom-btn btn-primary";
        }

        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("show"), 10);

        function cleanup(result) {
            modal.classList.remove("show");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        }

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

function customPrompt(title, message, defaultValue = "", placeholder = "Nhập vào đây...") {
    return new Promise((resolve) => {
        const modal = document.getElementById("custom-prompt-modal");
        const titleEl = document.getElementById("custom-prompt-title");
        const msgEl = document.getElementById("custom-prompt-message");
        const inputEl = document.getElementById("custom-prompt-input");
        const okBtn = document.getElementById("custom-prompt-ok-btn");
        const cancelBtn = document.getElementById("custom-prompt-cancel-btn");

        if (!modal || !titleEl || !msgEl || !inputEl || !okBtn || !cancelBtn) {
            return resolve(prompt(message, defaultValue));
        }

        titleEl.innerText = title;
        msgEl.innerText = message;
        inputEl.value = defaultValue;
        inputEl.placeholder = placeholder;
        
        modal.style.display = "flex";
        setTimeout(() => {
            modal.classList.add("show");
            inputEl.focus();
        }, 10);

        function cleanup(result) {
            modal.classList.remove("show");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        }

        okBtn.onclick = () => {
            const val = inputEl.value;
            cleanup(val);
        };
        cancelBtn.onclick = () => cleanup(null);

        inputEl.onkeypress = (e) => {
            if (e.key === "Enter") {
                okBtn.click();
            }
        };
    });
}
