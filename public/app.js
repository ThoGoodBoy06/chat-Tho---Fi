const SERVER_URL = window.location.origin;
const API_URL = `${SERVER_URL}/api`;

// Nuốt toàn bộ click giả (synthesized click) sinh ra ngay sau khi nhấc ngón tay khỏi cú nhấn giữ trên di động (toàn cục)
window.addEventListener("click", (e) => {
    if (typeof longPressJustOccurred !== "undefined" && longPressJustOccurred) {
        // Chỉ nuốt click nếu click xảy ra trên chính tin nhắn vừa được nhấn giữ
        if (e.target && e.target.closest && e.target.closest(".message")) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
        longPressJustOccurred = false; // Reset flag
    }
}, true); // Dùng capture phase ở cấp cao nhất để chặn mọi click giả ở bất kỳ element nào (kể cả overlay hay ảnh)

// Đóng bất kỳ .more-menu nào đang mở khi click ra ngoài (delegate 1 listener duy nhất, không rò rỉ)
document.addEventListener("click", (e) => {
    if (e.target && e.target.closest && (e.target.closest(".more-btn") || e.target.closest(".more-menu"))) return;
    document.querySelectorAll(".more-menu.show").forEach((m) => m.classList.remove("show"));
});

// --- PHÁT HIỆN NATIVE FLUTTER HEADER ---
document.addEventListener("DOMContentLoaded", () => {
    if (window.FlutterHeaderChannel || window.webkit?.messageHandlers?.FlutterHeaderChannel) {
        // Bỏ thêm class has-native-header để giữ nguyên giao diện gốc của web (bao gồm cả header)
        // document.body.classList.add("has-native-header");
        console.log("📱 Đã phát hiện Native Flutter Header Channel. Giữ nguyên giao diện web.");
    }
});

// --- NHẬN FCM TOKEN TỪ FLUTTER HYBRID BRIDGE ---
window.onFlutterFcmTokenReceived = function(fcmTokenVal) {
    console.log("🔥 Đã nhận native FCM Token từ Flutter:", fcmTokenVal);
    const userToken = localStorage.getItem("authToken");
    if (!userToken) {
        console.log("💾 Chưa đăng nhập, lưu tạm native FCM Token...");
        window.cachedFlutterFcmToken = fcmTokenVal;
        return;
    }
    console.log("💾 Đang gửi native FCM Token lên Server...");
    fetch(`${API_URL}/users/fcm-token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken
        },
        body: JSON.stringify({ fcmToken: fcmTokenVal }),
    })
    .then(res => res.json())
    .then(data => console.log("✅ Đã lưu native FCM Token thành công:", data))
    .catch(err => console.error("❌ Lỗi gửi native FCM Token:", err));
};
if (window.flutterFcmToken) {
    window.onFlutterFcmTokenReceived(window.flutterFcmToken);
}


function formatUrl(url) {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("data:image")) return url;
    return SERVER_URL + url;
}

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

// --- HỆ THỐNG ÂM THANH SYNTHETIC (WEB AUDIO API) ---
const ChatSounds = {
    _ctx: null,
    _unlocked: false, // FIX iOS: Đánh dấu đã unlock AudioContext bởi user gesture chưa

    _init() {
        if (!this._ctx) {
            this._ctx = new(window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === "suspended") {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    },

    // FIX iOS #9: Unlock AudioContext khi user tương tác lần đầu
    // iOS Safari/WKWebView yêu cầu user gesture để khởi tạo AudioContext
    unlock() {
        if (this._unlocked) return;
        try {
            const ctx = this._init();
            // Tạo buffer rỗng 1 sample để "đánh thức" AudioContext
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
            this._unlocked = true;
        } catch (e) {
            console.warn("Không thể unlock AudioContext:", e.message);
        }
    },

    playSend() {
        try {
            const ctx = this._init();
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = "sine";
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(750, now + 0.12);

            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.65, now + 0.02); // Tăng cường độ từ 0.18 lên 0.65 (siêu to)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            console.warn("Lỗi phát âm thanh gửi:", e.message);
        }
    },

    playReceive() {
        playWebAudio("message", false, 4.5);
    },

    playReact() {
        try {
            const ctx = this._init();
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);

            osc1.type = "sine";
            osc1.frequency.setValueAtTime(350, now);
            osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

            gain1.gain.setValueAtTime(0.01, now);
            gain1.gain.linearRampToValueAtTime(0.55, now + 0.02); // Tăng cường độ lên 0.55
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc1.start(now);
            osc1.stop(now + 0.09);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);

            osc2.type = "sine";
            osc2.frequency.setValueAtTime(1600, now + 0.03);

            gain2.gain.setValueAtTime(0.001, now + 0.03);
            gain2.gain.linearRampToValueAtTime(0.60, now + 0.04); // Tăng cường độ lên 0.60
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc2.start(now + 0.03);
            osc2.stop(now + 0.13);
        } catch (e) {
            console.warn("Lỗi phát âm thanh cảm xúc:", e.message);
        }
    }
};

// --- QUẢN LÝ APP STATE (CAPACITOR / TRÌNH DUYỆT) ---
let isAppInBackground = false;
document.addEventListener("visibilitychange", () => {
    isAppInBackground = document.visibilityState === "hidden";

    if (isAppInBackground) {
        // Gửi sự kiện chạy ngầm (go_offline) lên socket server
        if (typeof socket !== "undefined" && socket && socket.connected && myId) {
            socket.emit("go_offline");
        }
    } else {
        // Gửi sự kiện mở lại app (go_online) lên socket server
        if (typeof socket !== "undefined" && socket && socket.connected && myId) {
            socket.emit("go_online");
        }

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
let myUsername = "";
let currentConversationId = "";
let allConversations = []; // 🌟 Biến toàn cục chứa danh sách cuộc trò chuyện để chuyển tiếp
let currentChatPartnerId = null;
let socket = null;
let typingTimeout = null;
let lastTypingEmitTime = 0;
let pendingFriendRequests = [];
let notificationsList = [];
let replyingToMessage = null;
let editingMessage = null;
let currentChatMessages = [];
let currentNicknames = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let longPressJustOccurred = false; // Flag chặn click giả từ sự kiện long press di động
let activeOverlayMessageEl = null; // Quản lý tin nhắn đang hiển thị tùy chọn trên mobile

// --- PAGINATION STATE (Tối ưu hiệu năng) ---
let hasMoreMessages = false;
let isLoadingMoreMessages = false;

const typingSound = new Audio('/sounds/typing.mp3');
typingSound.loop = true;
typingSound.volume = 0.5;

const tabClickSound = new Audio('/click.mp3');
tabClickSound.volume = 0.4;

const readReceiptState = {
    conversationId: null,
    readBy: null,
    lastReadMessageId: null,
};

function isSameId(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Nén ảnh bằng Canvas ở Client-side trước khi tải lên server để tối ưu hóa RAM & băng thông
function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
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

// --- HỆ THỐNG PHÁT VÀ KHUẾCH ĐẠI ÂM THANH UNIFIED (WEB AUDIO API) ---
const AudioBuffers = {
    message: null,
    ringtone: null,
    dialtone: null,
    hangup: null
};

let audioCtx = null;
let activeSources = {
    message: null,
    ringtone: null,
    dialtone: null,
    hangup: null
};
let activeGains = {
    message: null,
    ringtone: null,
    dialtone: null,
    hangup: null
};

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

async function preloadSound(key, url) {
    if (AudioBuffers[key]) return AudioBuffers[key];
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = getAudioContext();
        AudioBuffers[key] = await ctx.decodeAudioData(arrayBuffer);
        console.log(`🎵 Đã giải mã và nạp bộ nhớ đệm âm thanh: ${key} (${url})`);
        return AudioBuffers[key];
    } catch (e) {
        console.warn(`Lỗi tải/giải mã âm thanh ${key}:`, e.message);
        return null;
    }
}

function preloadAllSounds() {
    preloadSound("message", "/amthanhtinnhan.mp3");
    preloadSound("ringtone", "/ringtone.mp3");
    preloadSound("dialtone", "/tuttut.mp3");
    preloadSound("hangup", "/amthanhtat.mp3");
}

function playWebAudio(key, loop = false, gainValue = 4.5) {
    try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const buffer = AudioBuffers[key];
        if (!buffer) {
            console.warn(`Âm thanh ${key} chưa tải xong, phát dự phòng bằng HTMLAudioElement`);
            let fallbackEl = null;
            if (key === "message") fallbackEl = document.getElementById("message-sound");
            else if (key === "ringtone") fallbackEl = document.getElementById("incoming-ringtone");
            else if (key === "dialtone") fallbackEl = document.getElementById("outgoing-ringtone");
            else if (key === "hangup") fallbackEl = document.getElementById("hangup-sound");

            if (fallbackEl) {
                fallbackEl.volume = 1.0;
                fallbackEl.currentTime = 0;
                fallbackEl.play().catch(e => console.warn(e));
            }
            return;
        }

        stopWebAudio(key);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;

        const gainNode = ctx.createGain();
        gainNode.gain.value = gainValue; // Khuếch đại âm lượng lên gấp gainValue lần (mức to vượt trần)

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);

        activeSources[key] = source;
        activeGains[key] = gainNode;
    } catch (e) {
        console.warn(`Lỗi phát Web Audio ${key}:`, e.message);
    }
}

function stopWebAudio(key) {
    try {
        if (activeSources[key]) {
            activeSources[key].stop();
            activeSources[key].disconnect();
            activeSources[key] = null;
        }
        if (activeGains[key]) {
            activeGains[key].disconnect();
            activeGains[key] = null;
        }

        let fallbackEl = null;
        if (key === "message") fallbackEl = document.getElementById("message-sound");
        else if (key === "ringtone") fallbackEl = document.getElementById("incoming-ringtone");
        else if (key === "dialtone") fallbackEl = document.getElementById("outgoing-ringtone");
        else if (key === "hangup") fallbackEl = document.getElementById("hangup-sound");

        if (fallbackEl) {
            fallbackEl.pause();
            fallbackEl.currentTime = 0;
        }
    } catch (e) {
        console.warn(`Lỗi dừng Web Audio ${key}:`, e.message);
    }
}

// --- MỞ KHÓA ÂM THANH TRÌNH DUYỆT (CHỐNG CHẶN AUTOPLAY) ---
let isAudioUnlocked = false;

function unlockBrowserAudio() {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;

    // FIX iOS #9: Unlock ChatSounds AudioContext cùng lúc
    if (typeof ChatSounds !== 'undefined' && ChatSounds.unlock) {
        ChatSounds.unlock();
    }

    // 1. Mở khóa AudioContext
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
        ctx.resume();
    }

    // 2. Tải trước toàn bộ âm thanh vào bộ nhớ đệm
    preloadAllSounds();

    const UNLOCK_EVENTS = ["click", "touchstart", "touchend", "mousedown", "keydown"];
    UNLOCK_EVENTS.forEach(event => {
        document.removeEventListener(event, unlockBrowserAudio);
    });
    console.log("🔊 Tất cả kênh âm thanh đã được mở khóa trực tiếp thành công!");
}

const UNLOCK_EVENTS = ["click", "touchstart", "touchend", "mousedown", "keydown"];
UNLOCK_EVENTS.forEach(event => {
    document.addEventListener(event, unlockBrowserAudio, { passive: true });
});

// Cơ chế unlock rung (Vibration Gesture Lock) cho thiết bị di động
let isVibrationUnlocked = false;

function unlockBrowserVibration() {
    if (isVibrationUnlocked) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
            navigator.vibrate(10); // Rung nhẹ 10ms để giải phóng Gesture Lock của trình duyệt
            isVibrationUnlocked = true;
        } catch (e) {
            console.warn("Lỗi unlock rung điện thoại:", e);
        }
    }
    document.removeEventListener("click", unlockBrowserVibration);
    document.removeEventListener("touchstart", unlockBrowserVibration);
}
document.addEventListener("click", unlockBrowserVibration);
document.addEventListener("touchstart", unlockBrowserVibration);

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
    icon.className = "far fa-check-circle sent-icon";
    statusEl.append(icon);
    statusEl.title = "Đã gửi";
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

// Cập nhật badge chưa đọc và kiểu chữ thường của Item Chat cục bộ khi nhận sự kiện đã đọc từ Socket
function updateConversationUnreadBadgeLocal(conversationId) {
    try {
        const li = document.querySelector(`li[data-conversation-id="${conversationId}"]`);
        if (li) {
            const badge = li.querySelector(".unread-badge");
            if (badge) badge.remove();

            const msgEl = li.querySelector(".chat-list-msg");
            if (msgEl) {
                msgEl.style.fontWeight = "";
                msgEl.style.color = "";
            }
        }
        updateTotalMessagesBadge();
    } catch (err) {
        console.error("[DOM Error] Lỗi cập nhật badge đã xem cục bộ:", err);
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
let pendingSignalsQueue = [];
let currentFacingMode = "user";
let callTimerInterval = null;
let callStartTime = 0;
let vibrateInterval = null;
let callTimeoutTimer = null;

// --- BIẾN TOÀN CỤC CHO CÁC TÍNH NĂNG TÙY CHỌN ---
let isScreenSharing = false;
let screenStream = null;
let isNoiseCancellationEnabled = true;

const stunServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:openrelay.metered.ca:80" },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
    iceCandidatePoolSize: 10,
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
    activeOverlayMessageEl = null;
    const overlay = document.getElementById("mobile-action-overlay");
    if (overlay) overlay.classList.remove("show");
    document.body.classList.remove("overlay-active");
    
    document.querySelectorAll(".message").forEach((m) => {
        m.classList.remove("show-mobile-actions");
        m.classList.remove("flip-up");
        
        const msgContent = m.querySelector(".message-content");
        if (msgContent) {
            // Đưa tin nhắn về vị trí ban đầu bằng transition trượt mượt mà
            msgContent.style.setProperty("transform", "translateY(0)", "important");
            
            // Chờ hiệu ứng trượt kết thúc (200ms) rồi mới dọn dẹp các thuộc tính CSS inline khác
            setTimeout(() => {
                // Kiểm tra xem tin nhắn này không bị kích hoạt lại overlay trong lúc chờ
                if (!m.classList.contains("show-mobile-actions")) {
                    msgContent.style.removeProperty("position");
                    msgContent.style.removeProperty("z-index");
                    msgContent.style.removeProperty("transform");
                    msgContent.style.removeProperty("transition");
                }
            }, 200);
        }
        
        const actions = m.querySelector(".message-actions");
        if (actions) {
            actions.style.removeProperty("display");
            actions.style.removeProperty("position");
            actions.style.removeProperty("top");
            actions.style.removeProperty("left");
            actions.style.removeProperty("width");
            actions.style.removeProperty("height");
            actions.style.removeProperty("pointer-events");
            actions.style.removeProperty("z-index");
            actions.style.removeProperty("background");
            actions.style.removeProperty("box-shadow");
            actions.style.removeProperty("margin");
            actions.style.removeProperty("padding");
        }
        
        m.querySelectorAll(".action-item").forEach((item) => {
            item.style.removeProperty("position");
            item.style.removeProperty("top");
            item.style.removeProperty("left");
            item.style.removeProperty("width");
            item.style.removeProperty("height");
            item.style.removeProperty("margin");
            item.style.removeProperty("padding");
            item.style.removeProperty("border");
            item.style.removeProperty("background");
            item.style.removeProperty("box-shadow");
            item.style.removeProperty("overflow");
            item.style.removeProperty("pointer-events");
            
            const icon = item.querySelector("i");
            if (icon) icon.style.removeProperty("display");
        });
        
        const palette = m.querySelector(".reaction-palette");
        if (palette) {
            palette.classList.remove("show");
            palette.style.removeProperty("position");
            palette.style.removeProperty("z-index");
            palette.style.removeProperty("display");
            palette.style.removeProperty("opacity");
            palette.style.removeProperty("visibility");
            palette.style.removeProperty("width");
            palette.style.removeProperty("background");
            palette.style.removeProperty("border-radius");
            palette.style.removeProperty("padding");
            palette.style.removeProperty("box-shadow");
            palette.style.removeProperty("gap");
            palette.style.removeProperty("pointer-events");
            palette.style.removeProperty("left");
            palette.style.removeProperty("right");
            palette.style.removeProperty("top");
            palette.style.removeProperty("bottom");
        }
        
        const moreMenu = m.querySelector(".more-menu");
        if (moreMenu) {
            moreMenu.classList.remove("show");
            moreMenu.style.removeProperty("position");
            moreMenu.style.removeProperty("z-index");
            moreMenu.style.removeProperty("display");
            moreMenu.style.removeProperty("flex-direction");
            moreMenu.style.removeProperty("opacity");
            moreMenu.style.removeProperty("visibility");
            moreMenu.style.removeProperty("width");
            moreMenu.style.removeProperty("background");
            moreMenu.style.removeProperty("border-radius");
            moreMenu.style.removeProperty("padding");
            moreMenu.style.removeProperty("box-shadow");
            moreMenu.style.removeProperty("pointer-events");
            moreMenu.style.removeProperty("left");
            moreMenu.style.removeProperty("right");
            moreMenu.style.removeProperty("top");
            moreMenu.style.removeProperty("bottom");
        }
    });
}

function showMobileOverlay(messageEl) {
    let overlay = document.getElementById("mobile-action-overlay");
    if (overlay && overlay.classList.contains("show")) {
        // Nếu overlay đang hiển thị rồi thì không làm gì cả để tránh reset dataset.shownAt (gây ra lỗi bấm 2 lần mới đóng)
        return;
    }
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "mobile-action-overlay";
        
        const closeOverlay = (e) => {
            const shownAt = parseInt(overlay.dataset.shownAt || "0", 10);
            if (Date.now() - shownAt < 300) {
                return;
            }
            hideMobileOverlay();
        };

        overlay.addEventListener("click", closeOverlay);
        overlay.addEventListener("touchstart", closeOverlay, { passive: false });

        overlay.addEventListener("touchmove", (e) => {
            if (e.cancelable) e.preventDefault();
        }, {
            passive: false,
        });
    }
    // Đặt overlay vào trong #messages để cùng stacking context với tin nhắn.
    // Nhờ đó, tin nhắn đang chọn (z-index 250) sẽ nổi lên trên overlay (z-index 200) và không bị mờ (blur).
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) {
        messagesDiv.appendChild(overlay);
    } else {
        const chatArea = document.querySelector(".chat-window") || document.body;
        chatArea.appendChild(overlay);
    }

    // Đặt overlay-active LÊN TRƯỚC để CSS content-visibility: visible !important
    // đã có hiệu lực khi hideMobileOverlay() dọn dẹp (tránh trình duyệt ẩn tin nhắn)
    document.body.classList.add("overlay-active");
    hideMobileOverlay();
    document.body.classList.add("overlay-active"); // Gán lại vì hideMobileOverlay() đã xóa
    messageEl.classList.add("show-mobile-actions");
    activeOverlayMessageEl = messageEl; // Thiết lập tin nhắn hiện tại hiển thị overlay
    overlay.classList.add("show");
    overlay.dataset.shownAt = Date.now().toString();

    // Lấy các element để ép style inline, tránh bị lưu cache CSS cũ trên thiết bị di động
    const msgContent = messageEl.querySelector(".message-content");
    const palette = messageEl.querySelector(".reaction-palette");
    const moreMenu = messageEl.querySelector(".more-menu");
    const actions = messageEl.querySelector(".message-actions");
    const isMyMessage = messageEl.classList.contains("my-message");

    // Hỗ trợ lướt chọn cảm xúc và menu chức năng kiểu Messenger: nhấn giữ -> kéo qua lại để chọn -> thả ra để thực thi
    window.dragSelectedEmoji = null;
    window.dragSelectedAction = null;

    if (msgContent) {
        msgContent.style.setProperty("position", "relative", "important");
        msgContent.style.setProperty("z-index", "251", "important");
    }

    if (actions) {
        actions.style.setProperty("display", "block", "important");
        actions.style.setProperty("position", "absolute", "important");
        actions.style.setProperty("top", "0", "important");
        actions.style.setProperty("left", "0", "important");
        actions.style.setProperty("width", "100%", "important");
        actions.style.setProperty("height", "100%", "important");
        actions.style.setProperty("pointer-events", "none", "important"); // FIX: Để chạm xuyên qua khung chứa nút đến ảnh/text
        actions.style.setProperty("z-index", "252", "important");
        actions.style.setProperty("background", "transparent", "important");
        actions.style.setProperty("box-shadow", "none", "important");
        actions.style.setProperty("margin", "0", "important");
        actions.style.setProperty("padding", "0", "important");
    }

    // Ẩn hoàn toàn các nút tròn trigger gốc của desktop (smiley & ba chấm) để tránh làm méo bong bóng chat
    const actionItems = messageEl.querySelectorAll(".action-item");
    actionItems.forEach((item) => {
        item.style.setProperty("position", "absolute", "important");
        item.style.setProperty("top", "0", "important");
        item.style.setProperty("left", "0", "important");
        item.style.setProperty("width", "100%", "important"); // Thay đổi từ 0 thành 100% để calc(100% + 8px) nhận chiều cao thực tế của tin nhắn
        item.style.setProperty("height", "100%", "important"); // Thay đổi từ 0 thành 100%
        item.style.setProperty("margin", "0", "important");
        item.style.setProperty("padding", "0", "important");
        item.style.setProperty("border", "none", "important");
        item.style.setProperty("background", "transparent", "important");
        item.style.setProperty("box-shadow", "none", "important");
        item.style.setProperty("overflow", "visible", "important");
        item.style.setProperty("pointer-events", "none", "important"); // FIX: để tap xuyên qua tới ảnh/text bên dưới

        const icon = item.querySelector("i");
        if (icon) {
            icon.style.setProperty("display", "none", "important");
        }
    });

    if (palette) {
        palette.style.setProperty("position", "absolute", "important");
        palette.style.setProperty("z-index", "253", "important");
        palette.style.setProperty("display", "flex", "important");
        palette.style.setProperty("opacity", "1", "important");
        palette.style.setProperty("visibility", "visible", "important");
        palette.style.setProperty("width", "max-content", "important");
        palette.style.setProperty("background", "rgba(30, 30, 30, 0.95)", "important");
        palette.style.setProperty("border-radius", "30px", "important");
        palette.style.setProperty("padding", "6px 12px", "important");
        palette.style.setProperty("box-shadow", "0 4px 16px rgba(0, 0, 0, 0.25)", "important");
        palette.style.setProperty("gap", "10px", "important");
        palette.style.setProperty("pointer-events", "auto", "important"); // Nhận tương tác click

        if (isMyMessage) {
            palette.style.setProperty("right", "0", "important");
            palette.style.setProperty("left", "auto", "important");
        } else {
            palette.style.setProperty("left", "0", "important"); // Căn đúng lề trái của bong bóng tin nhắn (không bị lệch do avatar)
            palette.style.setProperty("right", "auto", "important");
        }
    }

    if (moreMenu) {
        moreMenu.style.setProperty("position", "absolute", "important");
        moreMenu.style.setProperty("z-index", "252", "important");
        moreMenu.style.setProperty("display", "flex", "important");
        moreMenu.style.setProperty("flex-direction", "column", "important");
        moreMenu.style.setProperty("opacity", "1", "important");
        moreMenu.style.setProperty("visibility", "visible", "important");
        moreMenu.style.setProperty("width", "220px", "important");
        moreMenu.style.setProperty("background", "rgba(30, 30, 30, 0.95)", "important");
        moreMenu.style.setProperty("border-radius", "14px", "important");
        moreMenu.style.setProperty("padding", "4px 0", "important");
        moreMenu.style.setProperty("box-shadow", "0 8px 32px rgba(0, 0, 0, 0.3)", "important");
        moreMenu.style.setProperty("pointer-events", "auto", "important"); // Nhận tương tác click

        if (isMyMessage) {
            moreMenu.style.setProperty("right", "0", "important");
            moreMenu.style.setProperty("left", "auto", "important");
        } else {
            moreMenu.style.setProperty("left", "0", "important"); // Căn đúng lề trái của bong bóng tin nhắn (không bị lệch do avatar)
            moreMenu.style.setProperty("right", "auto", "important");
        }
    }

    // Cho phép click/tap vào phần nội dung tin nhắn (ảnh, text) nhưng không phải nút chức năng để đóng overlay
    if (msgContent) {
        // FIX: gỡ handler cũ (nếu có) từ lần mở overlay trước, tránh chồng chất listener
        if (msgContent._dismissHandler) {
            msgContent.removeEventListener("click", msgContent._dismissHandler);
            msgContent.removeEventListener("touchstart", msgContent._dismissHandler);
        }

        const dismissHandler = (e) => {
            // Nếu click vào bên trong .message-actions hoặc .reaction-palette thì bỏ qua
            if (e.target.closest('.message-actions, .reaction-palette, .more-menu')) return;
            
            const shownAt = parseInt(overlay.dataset.shownAt || "0", 10);
            if (Date.now() - shownAt < 300) {
                return;
            }

            hideMobileOverlay();
            msgContent.removeEventListener("click", dismissHandler);
            msgContent.removeEventListener("touchstart", dismissHandler);
            msgContent._dismissHandler = null;
        };
        msgContent._dismissHandler = dismissHandler;
        msgContent.addEventListener("click", dismissHandler);
        msgContent.addEventListener("touchstart", dismissHandler, { passive: true });
    }

    // Mặc định Emojis luôn ở trên đầu tin nhắn và Menu luôn ở dưới tin nhắn theo yêu cầu (không tự đảo chiều nữa)
    requestAnimationFrame(() => {
        messageEl.classList.remove("flip-up");
        
        const viewportWidth = window.innerWidth;
        const msgRect = msgContent ? msgContent.getBoundingClientRect() : null;

        if (palette && msgRect) {
            palette.style.setProperty("bottom", "calc(100% + 8px)", "important");
            palette.style.setProperty("top", "auto", "important");
            
            // 🌟 Căn giữa palette theo tin nhắn và chống tràn màn hình (cách cạnh tối thiểu 12px)
            const paletteWidth = palette.offsetWidth || 320;
            const msgCenterViewport = msgRect.left + msgRect.width / 2;
            let desiredLeftViewport = msgCenterViewport - paletteWidth / 2;
            desiredLeftViewport = Math.max(12, Math.min(viewportWidth - paletteWidth - 12, desiredLeftViewport));
            const leftOffset = desiredLeftViewport - msgRect.left;
            
            palette.style.setProperty("left", `${leftOffset}px`, "important");
            palette.style.setProperty("right", "auto", "important");
        }
        
        if (moreMenu && msgRect) {
            moreMenu.style.setProperty("top", "calc(100% + 8px)", "important");
            moreMenu.style.setProperty("bottom", "auto", "important");
            
            // 🌟 Căn lề moreMenu chống tràn viền màn hình di động
            const menuWidth = 220;
            let desiredLeftViewport;
            if (isMyMessage) {
                desiredLeftViewport = (msgRect.left + msgRect.width) - menuWidth;
            } else {
                desiredLeftViewport = msgRect.left;
            }
            desiredLeftViewport = Math.max(12, Math.min(viewportWidth - menuWidth - 12, desiredLeftViewport));
            const menuLeftOffset = desiredLeftViewport - msgRect.left;
            
            moreMenu.style.setProperty("left", `${menuLeftOffset}px`, "important");
            moreMenu.style.setProperty("right", "auto", "important");
        }

        // Tự động dịch chuyển tin nhắn theo chiều dọc để tránh bị cắt/đè ở cả cạnh trên và cạnh dưới màn hình
        if (msgContent) {
            const rect = msgContent.getBoundingClientRect();
            
            // Giới hạn phía trên (Header)
            const chatHeader = document.querySelector(".chat-header");
            const limitTop = chatHeader ? chatHeader.getBoundingClientRect().bottom : 60;
            const paletteHeight = 55; // Chiều cao ước tính của thanh cảm xúc
            const minAllowedTop = limitTop + paletteHeight + 12; // Cần trống tối thiểu khoảng này ở phía trên
            
            // Giới hạn phía dưới (Input Area / Cạnh dưới)
            const inputArea = document.getElementById("input-area");
            const limitBottom = inputArea ? inputArea.getBoundingClientRect().top : (window.innerHeight - 75);
            const menuHeight = moreMenu ? (moreMenu.getBoundingClientRect().height || 220) : 220;
            const maxAllowedBottom = limitBottom - menuHeight - 12; // Cần trống tối thiểu khoảng này ở phía dưới
            
            let translateY = 0;
            if (rect.top < minAllowedTop) {
                // Tin nhắn quá gần mép trên -> Dịch xuống dưới
                translateY = minAllowedTop - rect.top;
            } else if (rect.bottom > maxAllowedBottom) {
                // Tin nhắn quá gần mép dưới -> Dịch lên trên
                translateY = maxAllowedBottom - rect.bottom;
                
                // 🌟 BẢO VỆ CẠNH TRÊN (TOP PRIORITY): Sau khi dịch lên trên, nếu mép trên của tin nhắn
                // bị đẩy lên quá mức giới hạn trên (gây mất thanh Emojis), chúng ta sẽ ưu tiên giữ lề trên
                // và chấp nhận cho menu phía dưới bị đè/tràn lấn.
                if (rect.top + translateY < minAllowedTop) {
                    translateY = minAllowedTop - rect.top;
                }
            }
            
            if (translateY !== 0) {
                msgContent.style.setProperty("transition", "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)", "important");
                msgContent.style.setProperty("transform", `translateY(${translateY}px)`, "important");
            }
        }
    });
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
    myUsername = userData.username || "";

    // Gửi thông tin auth_sync lên Flutter native để phục vụ Chat Native
    if (window.FlutterHeaderChannel) {
        window.FlutterHeaderChannel.postMessage(JSON.stringify({
            event: 'auth_sync',
            token: userToken,
            myId: userData.id,
            myName: myName,
            myAvatar: userData.avatar || ""
        }));
    }

    if (window.cachedFlutterFcmToken) {
        window.onFlutterFcmTokenReceived(window.cachedFlutterFcmToken);
        window.cachedFlutterFcmToken = null;
    }

    // Cập nhật lời chào Trợ lý AI khi khởi tạo session
    const welcomeTitle = document.getElementById("ai-welcome-title");
    if (welcomeTitle) {
        welcomeTitle.innerText = `Hôm nay bạn thế nào, ${myUsername || "bạn"}?`;
    }

    document.getElementById("my-name").innerText = myName;
    document.getElementById("my-avatar").src = userData.avatar ?
        formatUrl(userData.avatar) :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=random`;

    // Đồng bộ thông tin sang Tab Cá nhân và các Modal liên quan
    if (document.getElementById("my-name-personal-tab"))
        document.getElementById("my-name-personal-tab").innerText = myName;
    if (document.getElementById("my-avatar-personal-tab"))
        document.getElementById("my-avatar-personal-tab").src = document.getElementById("my-avatar").src;

    // Đồng bộ thông tin sang Tab Hồ sơ
    document.getElementById("profile-name").innerText = myName;
    if (document.getElementById("my-avatar-profile"))
        document.getElementById("my-avatar-profile").src =
        document.getElementById("my-avatar").src;
    if (document.getElementById("profile-bio"))
        document.getElementById("profile-bio").innerText =
        userData.bio || "Chưa có tiểu sử";
    if (document.getElementById("my-cover")) {
        const coverUrl = userData.coverPhoto || userData.coverImage;
        if (coverUrl) {
            document.getElementById("my-cover").src = formatUrl(coverUrl);
        } else {
            document.getElementById("my-cover").src =
                "https://ui-avatars.com/api/?name=Cover&background=e9ecef&color=333&size=800&font-size=0.1";
        }
    }

    // Yêu cầu quyền gửi thông báo trên Trình duyệt Web (Nếu chưa cấp) và khởi tạo FCM
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    console.log("🔔 Quyền thông báo đã được cấp phép.");
                    setupFirebaseMessaging(userToken);
                } else {
                    console.warn("🔔 Quyền thông báo bị từ chối.");
                }
            });
        } else if (Notification.permission === "granted") {
            setupFirebaseMessaging(userToken);
        }
    }

    // Kết nối Socket.IO Real-time
    socket = io(SERVER_URL);
    initSocketPinListeners(socket); // 🌟 Kích hoạt các socket listener cho ghim & tự hủy
    socket.on("connect", () => {
        console.log("⚡ Kết nối Socket thành công, đang xác thực user_connected: " + myId);
        socket.emit("user_connected", myId);
        checkUrlParamsForCall(); // Tự động kiểm tra cuộc gọi chạy ngầm khi kết nối thành công
    });

    // Xử lý tái kết nối Socket (rất quan trọng trên di động iOS/Android)
    // Khi điện thoại mất mạng rồi kết nối lại, Socket.IO tự reconnect
    // nhưng server không biết user này online nếu không gửi lại user_connected
    socket.io.on("reconnect", (attemptNumber) => {
        console.log(`🔄 Socket đã tái kết nối sau ${attemptNumber} lần thử, đang gửi lại user_connected: ` + myId);
        socket.emit("user_connected", myId);
        // Kéo lại tin nhắn bị lỡ trong khi mất kết nối
        if (typeof loadConversations === "function") loadConversations();
        if (typeof reloadCurrentChat === "function" && currentConversationId) reloadCurrentChat();
    });

    // Log khi socket bị mất kết nối (debug di động)
    socket.on("disconnect", (reason) => {
        console.warn("🔴 Socket bị ngắt kết nối. Lý do:", reason);
    });

    // Nghe khi có tin tức mới Real-time
    socket.on("new_news_broadcast", (newsItem) => {
        if (typeof handleIncomingRealtimeNews === "function") {
            handleIncomingRealtimeNews(newsItem);
        }
    });

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
        // Tối ưu hóa: Cập nhật DOM cục bộ lập tức thay vì gọi API loadConversations() dư thừa gây lag
        updateConversationUnreadBadgeLocal(conversationId);
    });

    socket.on("receive_message", (msg) => {
        let shouldMarkAsRead = false;
        const isCurrentChat = isSameId(msg.conversationId, currentConversationId);
        const isFromMe = isSameId(msg.senderId, myId);

        if (isCurrentChat) {
            // 1. Render tin nhắn ngay lập tức bằng tốc độ của Socket
            displayMessage(msg);
            triggerWordEffects(msg.content);

            // 2. Cập nhật trạng thái "Đã gửi" sau khi render
            updateReadReceiptsDOM();

            // 3. Chỉ gửi "Đã xem" nếu mình là người NHẬN và ĐANG THỰC SỰ NHÌN VÀO KHUNG CHAT
            if (!isFromMe && isChatAreaVisible()) {
                emitMarkMessagesRead();
                shouldMarkAsRead = true;
            }

            // Xóa UI Typing và dừng âm thanh khi nhận được tin nhắn mới từ đối phương
            if (!isFromMe) {
                handleStopTyping();
            }
        }

        // 4. Phát âm thanh và Rung điện thoại khi có tin nhắn mới từ người khác (Foreground)
        if (!isFromMe) {
            // Chỉ phát âm thanh và rung nếu app ở Foreground (tránh phát trùng âm thanh hệ thống của iOS/Android)
            if (!isAppInBackground) {
                // Phát âm thanh nhận tin nhắn synthetic
                ChatSounds.playReceive();

                // Rung phản hồi nhịp mạnh và lâu hơn (Rung 400ms, nghỉ 100ms, rung 400ms, nghỉ 100ms, rung 600ms)
                if (navigator.vibrate) {
                    try {
                        navigator.vibrate([400, 100, 400, 100, 600]);
                    } catch (err) {
                        console.warn("Trình duyệt hoặc hệ điều hành từ chối cấp quyền rung:", err.message);
                    }
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

    // Hàm xử lý dừng gõ phím, ẩn UI và dừng nhạc
    function handleStopTyping() {
        const indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();

        try {
            typingSound.pause();
            typingSound.currentTime = 0;
        } catch (error) {
            console.error("Lỗi khi dừng phát nhạc typing:", error);
        }
    }

    // Nghe sự kiện "Đang gõ..." (typing)
    socket.on("typing", (info) => {
        // Kiểm tra xem có đúng là người nhận hoặc cuộc trò chuyện hiện tại đang mở không
        const isCurrentChat = (info.senderId && info.senderId === currentChatPartnerId) ||
            (info.conversationId && info.conversationId === currentConversationId);

        if (!isCurrentChat) return;

        let indicator = document.getElementById("typing-indicator");
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "typing-indicator";
            indicator.className = "typing-indicator";
            const displayName = info.senderName || (document.getElementById("chat-header-name") ? document.getElementById("chat-header-name").innerText : "Đối phương");
            indicator.innerHTML = `<span><b>${displayName}</b> đang gõ</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
            const messagesContainer = document.getElementById("messages");
            if (messagesContainer) {
                messagesContainer.appendChild(indicator);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        // Phát nhạc soạn tin nhắn
        try {
            typingSound.play().catch(err => {
                console.warn("DOMException: Trình duyệt chặn tự động phát âm thanh typing:", err.message);
            });
        } catch (error) {
            console.error("DOMException typingSound.play():", error);
        }
    });

    // Nghe sự kiện "Dừng gõ" mới (stop-typing)
    socket.on("stop-typing", (info) => {
        if (info.senderId === currentChatPartnerId) {
            handleStopTyping();
        }
    });

    // Nghe sự kiện "Dừng gõ" cũ (stop_typing)
    socket.on("stop_typing", (info) => {
        if (info.conversationId === currentConversationId) {
            handleStopTyping();
        }
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

    // Nghe sự kiện thay đổi trạng thái hoạt động (online/offline)
    socket.on("user_status_change", ({ userId, isOnline, lastActive }) => {
        // 1. Cập nhật trong danh sách chat (sidebar)
        const sidebarItem = document.querySelector(`#user-list li[data-user-id="${userId}"]`);
        if (sidebarItem) {
            sidebarItem.dataset.isOnline = isOnline ? "true" : "false";
            if (lastActive) sidebarItem.dataset.lastActive = lastActive;

            const dot = sidebarItem.querySelector(".online-dot");
            if (dot) {
                dot.style.display = isOnline ? "block" : "none";
            }
        }

        // 2. Cập nhật trong danh sách bạn bè (nếu có)
        const friendItem = document.querySelector(`.friend-request-item[data-user-id="${userId}"]`);
        if (friendItem) {
            friendItem.dataset.isOnline = isOnline ? "true" : "false";
            const dot = friendItem.querySelector(".online-dot");
            if (dot) {
                dot.style.display = isOnline ? "block" : "none";
            }
        }

        // 3. Cập nhật ở Chat Header nếu đang chat với user này
        if (typeof currentChatPartnerId !== "undefined" && isSameId(userId, currentChatPartnerId)) {
            updateHeaderStatusUI(isOnline, lastActive);
        }
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
                    content.style.boxShadow = "";
                    content.style.padding = "";

                    msgEl.classList.remove("emoji-only-message");
                    content.classList.remove("emoji-only-1", "emoji-only-2", "emoji-only-3");
                }
                const actions = msgEl.querySelector(".message-actions");
                if (actions) actions.remove();
            }
        }
        loadConversations();
    });

    // Nghe sự kiện chỉnh sửa tin nhắn
    socket.on("message_edited", ({ messageId, conversationId, newContent }) => {
        const msg = currentChatMessages.find((m) => m.id === messageId);
        if (msg) {
            msg.content = newContent;
            msg.isEdited = true;
        }

        if (conversationId === currentConversationId) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (msgEl) {
                const content = msgEl.querySelector(".message-content");
                if (content) {
                    content.innerText = newContent;

                    // Reset và tính toán lại các class emoji-only
                    msgEl.classList.remove("emoji-only-message");
                    content.classList.remove("emoji-only-1", "emoji-only-2", "emoji-only-3");

                    const emojiCount = getEmojiOnlyCount(newContent);
                    if (emojiCount > 0) {
                        msgEl.classList.add("emoji-only-message");
                        content.classList.add(`emoji-only-${emojiCount}`);
                    }

                    const editedLabel = document.createElement("span");
                    editedLabel.className = "edited-label";
                    editedLabel.innerText = " (đã chỉnh sửa)";
                    editedLabel.style.fontSize = "0.75rem";
                    editedLabel.style.color = "var(--text-light)";
                    editedLabel.style.fontStyle = "italic";
                    content.appendChild(editedLabel);
                }
            }
        }
        loadConversations();
    });

    // Nghe sự kiện cảm xúc
    socket.on("message_reacted", ({ messageId, reactions, reaction, isRemoved }) => {
        const msgEl = document.getElementById(`msg-${messageId}`);
        if (msgEl) {
            // Xác định ai là người thực hiện hành động thả/gỡ cảm xúc bằng cách so sánh dataset
            const oldReactions = msgEl.dataset.reactions ? JSON.parse(msgEl.dataset.reactions) : {};
            let changerId = null;

            // Chuyển đổi dữ liệu mới nếu ở dạng chuỗi
            let newReactions = reactions;
            if (typeof newReactions === "string") {
                try { newReactions = JSON.parse(newReactions); } catch (e) { newReactions = {}; }
            }
            newReactions = newReactions || {};

            const newKeys = Object.keys(newReactions);
            const oldKeys = Object.keys(oldReactions);

            for (const key of newKeys) {
                if (newReactions[key] !== oldReactions[key]) {
                    changerId = key;
                    break;
                }
            }
            if (!changerId) {
                for (const key of oldKeys) {
                    if (newReactions[key] === undefined) {
                        changerId = key;
                        break;
                    }
                }
            }

            // Render giao diện mới
            renderReactions(msgEl, newReactions);

            // Cuộn xuống cuối thông minh nếu người dùng đang ở gần đáy (tránh nảy/lệch giao diện do chiều cao tin nhắn tăng lên khi có reaction)
            if (typeof window.smartScrollToBottom === "function") {
                window.smartScrollToBottom();
            }

            // Chỉ phát âm thanh và nổ hiệu ứng nếu không phải mình làm và là hành động thả cảm xúc
            if (reaction && !isRemoved) {
                if (changerId && !isSameId(changerId, myId)) {
                    createReactionBurst(messageId, reaction);
                    ChatSounds.playReact();
                }
            }
        }
    });

    // Nghe sự kiện xoá cuộc trò chuyện
    socket.on("conversation_deleted", ({ conversationId }) => {
        if (isSameId(conversationId, currentConversationId)) {
            currentConversationId = "";
            currentChatPartnerId = null;
            document.getElementById("chat-header-container").style.display = "none";
            document.getElementById("input-area").style.display = "none";
            document.getElementById("chat-header-placeholder").style.display = "flex";
            document.getElementById("messages").innerHTML = "";
        }
        loadConversations();
    });

    // Nghe sự kiện thay đổi chủ đề chat
    socket.on("conversation_theme_changed", ({ conversationId, theme, systemMessage }) => {
        if (isSameId(conversationId, currentConversationId)) {
            applyChatTheme(theme);
            if (systemMessage) {
                displayMessage(systemMessage);
            }
        }
    });

    // Nghe sự kiện thay đổi biệt danh (Nickname)
    socket.on("nickname_changed", ({ conversationId, targetUserId, nickname, nicknames, systemMessage }) => {
        if (isSameId(conversationId, currentConversationId)) {
            currentNicknames = nicknames || {};
            updateUINames();
            if (systemMessage) {
                displayMessage(systemMessage);
            }
        }
        // Tải lại danh sách cuộc trò chuyện ở sidebar
        loadConversations();
    });

    // Gắn sự kiện cho các nút trong cuộc gọi
    document.getElementById("reject-call-btn").onclick = () => endCall(true);
    document.getElementById("end-call-btn").onclick = () => endCall(true);

    // Chuyển sang màn hình chat
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "flex";
    // Hiển thị Tab Bar (đã chuyển ra ngoài #chat-screen)
    const tabBar = document.getElementById("main-tab-bar");
    if (tabBar) tabBar.style.display = "";

    loadConversations();
    loadFriends();
    loadNotifications();
    updateNotificationPermissionUI();

    // ── Khởi tạo tab mặc định (Tin nhắn) và vị trí thanh trượt slider-pill (Fix lỗi khuất tab khi mới vào app) ──
    const defaultTab = document.querySelector('.sidebar .nav-item') || document.querySelector('.nav-item[title="Tin nhắn"]');
    if (defaultTab) {
        const originalSwitchingState = isSwitchingTab;
        isSwitchingTab = false;

        switchTab("tab-messages", defaultTab);

        isSwitchingTab = originalSwitchingState;

        setTimeout(() => {
            const pill = document.getElementById('nav-slider-pill');
            if (pill && window.innerWidth <= 768) {
                const sidebar = defaultTab.closest('.sidebar');
                if (sidebar) {
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const itemRect = defaultTab.getBoundingClientRect();
                    if (itemRect.width > 0) {
                        pill.style.transition = 'none';
                        pill.style.left = (itemRect.left - sidebarRect.left) + 'px';
                        pill.style.width = itemRect.width + 'px';
                        setTimeout(() => { pill.style.transition = ''; }, 50);
                    }
                }
            }
        }, 400);
    }
}

// Hàm hỗ trợ Flutter chủ động lấy thông tin xác thực để đồng bộ Chat Native
window.getAuthDataForMobile = function() {
    if (window.FlutterHeaderChannel && token && myId) {
        window.FlutterHeaderChannel.postMessage(JSON.stringify({
            event: 'auth_sync',
            token: token,
            myId: myId,
            myName: myName,
            myAvatar: (typeof myAvatarPath !== 'undefined') ? myAvatarPath : ""
        }));
    }
}

// --- ĐĂNG KÝ VÀ CẤU HÌNH FIREBASE CLOUD MESSAGING (LẤY FCM TOKEN) ---
function setupFirebaseMessaging(userToken) {
    if (typeof firebase !== "undefined") {
        try {
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

            // Lắng nghe FCM khi app đang mở (Foreground) — tránh bỏ lỡ hoặc trùng lặp thông báo
            messaging.onMessage((payload) => {
                console.log("📩 Nhận FCM notification khi app đang mở (foreground):", payload);
                // Không cần hiển thị notification vì Socket.IO đã xử lý real-time
                // Chỉ log để debug, tránh hiện notification trùng lặp
            });

            // Đăng ký Service Worker tường minh
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/firebase-messaging-sw.js')
                    .then((registration) => {
                        console.log("🔥 Service Worker FCM đã được đăng ký thành công!");
                        // Chủ động kiểm tra cập nhật mới để kích hoạt thay đổi tức thì
                        registration.update();
                        return messaging.getToken({
                            serviceWorkerRegistration: registration,
                            vapidKey: "BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0",
                        });
                    })
                    .then((currentToken) => {
                        if (currentToken) {
                            console.log("🔥 Đã lấy được FCM Token:", currentToken);
                            fetch(`${API_URL}/users/fcm-token`, {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${userToken}`,
                                    },
                                    body: JSON.stringify({ fcmToken: currentToken }),
                                })
                                .then(res => res.json())
                                .then(data => {
                                    console.log("💾 Đã lưu thành công FCM Token lên server:", data);
                                })
                                .catch(err => console.error("❌ Lỗi gửi FCM Token lên Server:", err));
                        } else {
                            console.warn("⚠️ Không lấy được token FCM. Vui lòng kiểm tra cấu hình.");
                        }
                    })
                    .catch((err) => {
                        console.error("❌ Lỗi khi đăng ký Service Worker hoặc lấy token FCM:", err);
                    });
            } else {
                // Fallback nếu trình duyệt không hỗ trợ Service Worker
                messaging.getToken({
                        vapidKey: "BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0",
                    })
                    .then((currentToken) => {
                        if (currentToken) {
                            console.log("🔥 Đã lấy được FCM Token (fallback):", currentToken);
                            fetch(`${API_URL}/users/fcm-token`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${userToken}`,
                                },
                                body: JSON.stringify({ fcmToken: currentToken }),
                            });
                        }
                    })
                    .catch((err) => console.error("❌ Lỗi khi lấy FCM token fallback:", err));
            }
        } catch (error) {
            console.error("Lỗi cấu hình Firebase Frontend:", error);
        }
    }
}

function renderConversationSkeletons(container) {
    container.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const li = document.createElement("li");
        li.className = "skeleton-chat-item";
        li.innerHTML = `
            <div class="skeleton-avatar"></div>
            <div class="skeleton-info">
                <div class="skeleton-line skeleton-title"></div>
                <div class="skeleton-line skeleton-text"></div>
            </div>
        `;
        container.appendChild(li);
    }
}

function renderMessageSkeletons(container) {
    container.innerHTML = "";
    const isMePatterns = [false, true, false, false, true];
    isMePatterns.forEach((isMe) => {
        const div = document.createElement("div");
        div.className = `message ${isMe ? "my-message" : "other-message"} skeleton-message-container`;
        const avatarHtml = !isMe ? `<div class="avatar skeleton-avatar"></div>` : "";
        div.innerHTML = `
            ${avatarHtml}
            <div class="message-body">
                <div class="message-content skeleton-message-bubble"></div>
            </div>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function renderFriendSkeletons(container) {
    container.innerHTML = "";
    for (let i = 0; i < 4; i++) {
        const div = document.createElement("div");
        div.className = "skeleton-friend-item";
        div.innerHTML = `
            <div class="friend-request-info" style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div class="avatar skeleton-avatar"></div>
                <div class="skeleton-line skeleton-title" style="width: 120px;"></div>
            </div>
            <div class="friend-request-actions" style="display: flex; gap: 8px;">
                <div class="skeleton-line" style="width: 70px; height: 32px; border-radius: 6px;"></div>
            </div>
        `;
        container.appendChild(div);
    }
}

// 2. Tải danh sách cuộc trò chuyện gần đây
async function loadConversations() {
    const userList = document.getElementById("user-list");
    // Chỉ hiển thị skeleton nếu danh sách hiện tại đang trống (lần đầu load hoặc sau khi clear) để tránh nháy giao diện khi cập nhật ngầm
    if (userList && (userList.children.length === 0 || userList.querySelector('.skeleton-chat-item'))) {
        renderConversationSkeletons(userList);
    }

    try {
        const res = await fetch(`${API_URL}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Không thể tải danh sách (HTTP ${res.status}): ${errorText.substring(0, 100) || "Máy chủ đang khởi động hoặc quá tải"}`);
        }
        const data = await res.json();
        const userList = document.getElementById("user-list");
        userList.innerHTML = "";

        // 🌟 Lưu danh sách cuộc trò chuyện vào biến toàn cục phục vụ tính năng Chuyển tiếp (Forward)
        allConversations = [];
        if (data.data) {
            data.data.forEach((item) => {
                const conv = item.Conversations;
                const otherMember = conv.ConversationMembers.find(m => m.userId !== myId);
                if (otherMember) {
                    const user = otherMember.Users;
                    allConversations.push({
                        id: conv.id,
                        partnerId: user.id,
                        partnerName: otherMember.nickname || user.fullName || "Người dùng",
                        partnerAvatar: user.avatar ? formatUrl(user.avatar) : ""
                    });
                }
            });
        }

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
                let timeStr = "";
                if (conv.Messages.length > 0) {
                    const firstMsg = conv.Messages[0];
                    const msgDate = firstMsg.createdAt ? new Date(firstMsg.createdAt) : new Date();
                    timeStr = `${msgDate.getHours().toString().padStart(2, "0")}:${msgDate.getMinutes().toString().padStart(2, "0")}`;
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
                    formatUrl(user.avatar) :
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        user.fullName || "User",
                    )}&background=random`;

                const unreadCount =
                    conv._count && conv._count.Messages ? conv._count.Messages : 0;
                const unreadBadgeHtml =
                    unreadCount > 0 ?
                    `<span class="unread-badge">${unreadCount > 99 ? "99+" : unreadCount
                        }</span>` :
                    "";
                const msgStyle =
                    unreadCount > 0 ? "font-weight: 600; color: var(--text-dark);" : "";

                const li = document.createElement("li");
                li.className = "conversation-item";
                li.dataset.conversationId = conv.id;

                // Lưu nicknames vào dataset để tra cứu sau này
                const nicksMap = {};
                if (conv.ConversationMembers) {
                    conv.ConversationMembers.forEach(m => {
                        if (m.nickname) nicksMap[m.userId] = m.nickname;
                    });
                }
                li.dataset.nicknames = JSON.stringify(nicksMap);
                li.dataset.userId = user.id;
                li.dataset.isOnline = user.isOnline ? "true" : "false";
                li.dataset.lastActive = user.lastActive || "";

                if (isSameId(conv.id, currentConversationId))
                    li.classList.add("active");
                li.onclick = () =>
                    startChat(user.id, otherMember.nickname || user.fullName || user.username, avatarUrl);
                li.innerHTML = `
          <div class="avatar" style="cursor: pointer;" onclick="event.stopPropagation(); showUserProfile('${user.id}')">
            <img src="${avatarUrl}" alt="Avatar">
            <div class="online-dot" style="display: ${user.isOnline ? 'block' : 'none'};"></div>
          </div>
          <div class="chat-list-content">
            <div class="chat-list-header">
              <span class="chat-list-name">${otherMember.nickname || user.fullName || "Người dùng"}</span>
              <div class="chat-list-right" style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span class="chat-list-time" style="font-size: 11px; color: var(--text-light);">${timeStr}</span>
                ${unreadBadgeHtml}
              </div>
            </div>
            <div class="chat-list-msg" style="${msgStyle}">${lastMsg}</div>
          </div>
          <div class="conv-actions-wrapper" onclick="event.stopPropagation();">
            <i class="fas fa-ellipsis-v conv-options-btn" onclick="toggleConversationMenu(event, '${conv.id}')"></i>
            <div class="conv-dropdown-menu" id="conv-menu-${conv.id}">
              <div class="conv-menu-item text-danger" onclick="confirmDeleteConversation(event, '${conv.id}')">
                <i class="fas fa-trash-alt"></i> Xóa cuộc trò chuyện
              </div>
            </div>
          </div>
        `;
                userList.appendChild(li);
            }
        });
    } catch (error) {
        alert("Lỗi tải danh sách câu chuyện: " + error.message);
    }
    updateTotalMessagesBadge();
}

function clearAndHideSearch() {
    const searchResults = document.getElementById("search-results");
    if (searchResults) {
        searchResults.style.display = "none";
        searchResults.innerHTML = "";
    }
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    const mobileSearchInput = document.getElementById("mobile-search-input");
    if (mobileSearchInput) mobileSearchInput.value = "";
}

// 2.5 Tìm kiếm người dùng bằng Tên
async function searchUser() {
    const searchEl = document.getElementById("search-input");
    const mobileSearchEl = document.getElementById("mobile-search-input");
    const q = ((mobileSearchEl && mobileSearchEl.value.trim()) || (searchEl && searchEl.value.trim()) || "").trim();
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
                formatUrl(user.avatar) :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.fullName,
                )}&background=random`;

            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="avatar" style="width:40px;height:40px;cursor:pointer;" onclick="showUserProfile('${user.id}'); clearAndHideSearch();"><img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;"></div>
          <span style="font-weight:600;cursor:pointer;" onclick="showUserProfile('${user.id}'); clearAndHideSearch();">${user.fullName}</span>
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
    if (!receiverId) {
        return alert("Lỗi: Không tìm thấy ID người nhận tin nhắn.");
    }
    try {
        // Đảm bảo chuyển tab về tab tin nhắn để ẩn hoàn toàn các tab danh bạ/tin tức khác ở chế độ nền
        const navMessages = document.querySelector('.nav-item[onclick*="tab-messages"]');
        if (navMessages) {
            switchTab("tab-messages", navMessages);
        } else {
            document.querySelectorAll(".tab-pane").forEach((tab) => tab.classList.remove("active"));
            document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
            const tabMessages = document.getElementById("tab-messages");
            if (tabMessages) tabMessages.classList.add("active");
            const navMessagesBtn = document.querySelectorAll(".nav-item")[0];
            if (navMessagesBtn) navMessagesBtn.classList.add("active");
        }

        document.getElementById("chat-screen").classList.add("mobile-chat-active");
        document.body.classList.add("mobile-chat-active");

        // FOCUS TỰ ĐỘNG đồng bộ ngay lập tức sau khi tab và khung chat đã hiển thị để mở bàn phím ảo thành công
        const messageInputInit = document.getElementById("message-input");
        if (messageInputInit) {
            messageInputInit.focus();
        }
        
        // Giữ nguyên header làm con của .chat-window để thừa hưởng vị trí và hiệu ứng chuyển động tự nhiên
        // Không di chuyển ra body để tránh bị trôi lệch hoặc bị che khuất bởi trình duyệt khi cuộn/keyboard hiển thị
        const mobileHeader = document.getElementById("chat-header-container");
        document.getElementById("chat-header-placeholder").style.display = "none";
        currentChatPartnerId = receiverId;

        // Gửi sự kiện mở phòng chat lên Flutter native
        if (window.FlutterHeaderChannel) {
            window.FlutterHeaderChannel.postMessage(JSON.stringify({
                event: 'open_chat',
                partnerId: receiverId,
                partnerName: receiverName,
                partnerAvatar: receiverAvatar
            }));
        }

        const headerContainer = document.getElementById("chat-header-container");
        headerContainer.style.display = "flex";

        const headerNameEl = document.getElementById("chat-header-name");
        headerNameEl.dataset.realName = receiverName;
        headerNameEl.innerText = receiverName;

        const infoNameEl = document.getElementById("chat-info-name");
        if (infoNameEl) {
            infoNameEl.dataset.realName = receiverName;
            infoNameEl.innerText = receiverName;
        }

        document.getElementById("current-chat-avatar").src =
            receiverAvatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                receiverName,
            )}&background=random`;

        // Đồng bộ trạng thái online/offline của đối phương lên header
        let partnerOnline = false;
        let partnerLastActive = null;

        const sidebarItem = document.querySelector(`#user-list li[data-user-id="${receiverId}"]`);
        if (sidebarItem) {
            partnerOnline = sidebarItem.dataset.isOnline === "true";
            partnerLastActive = sidebarItem.dataset.lastActive;
        }

        updateHeaderStatusUI(partnerOnline, partnerLastActive);

        // Luôn fetch profile mới nhất để đảm bảo trạng thái hoạt động chính xác nhất
        fetch(`/api/users/${receiverId}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(profileData => {
                if (profileData && isSameId(receiverId, currentChatPartnerId)) {
                    partnerOnline = profileData.status === "online";
                    partnerLastActive = profileData.lastActive;
                    updateHeaderStatusUI(partnerOnline, partnerLastActive);

                    // Đồng bộ lại vào sidebar dataset nếu có
                    if (sidebarItem) {
                        sidebarItem.dataset.isOnline = partnerOnline ? "true" : "false";
                        if (partnerLastActive) sidebarItem.dataset.lastActive = partnerLastActive;
                        const dot = sidebarItem.querySelector(".online-dot");
                        if (dot) dot.style.display = partnerOnline ? "block" : "none";
                    }
                }
            })
            .catch(e => console.warn("Không thể tải trạng thái hoạt động thời gian thực:", e));

        document.getElementById("input-area").style.display = "flex";

        // Reset ô nhập và trạng thái UI (thu gọn/Like) khi chuyển phòng chat
        const messageInput = document.getElementById("message-input");
        if (messageInput) {
            messageInput.value = "";
            messageInput.style.height = "auto";
        }
        const inputArea = document.getElementById("input-area");
        if (inputArea) {
            inputArea.classList.remove("is-typing");
            // CSS media query đã xử lý mobile layout, không cần JavaScript override
        }
        const likeBtn = document.getElementById('like-btn');
        const sendBtn = document.getElementById('send-btn');
        if (likeBtn) likeBtn.style.display = 'flex';
        if (sendBtn) sendBtn.style.display = 'none';

        const res = await fetch(`${API_URL}/chat/conversations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ receiverId }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Không thể kết nối phòng chat (HTTP ${res.status}): ${errorText.substring(0, 100)}`);
        }

        const data = await res.json();
        if (!data.success) return alert("Đã tạo phòng chat: " + data.message);

        currentConversationId = data.data.id;
        if (!currentConversationId || currentConversationId === "undefined" || currentConversationId === "null") {
            throw new Error("ID phòng chat nhận về không hợp lệ.");
        }

        resetReadReceiptState(currentConversationId);
        clearAndHideSearch();

        // Xóa unread-badge trên giao diện danh sách ngay lập tức (ẩn huy hiệu đi)
        const userList = document.getElementById("user-list");
        if (userList) {
            const activeItems = userList.querySelectorAll("li.active");
            activeItems.forEach((item) => item.classList.remove("active"));

            let chatItem = null;
            const items = userList.querySelectorAll("li");
            for (const item of items) {
                if (isSameId(item.dataset.conversationId, currentConversationId)) {
                    chatItem = item;
                    break;
                }
            }
            if (chatItem) {
                chatItem.classList.add("active");
                const badge = chatItem.querySelector(".unread-badge");
                if (badge) {
                    badge.remove();
                    updateTotalMessagesBadge();
                }
                const msgTextEl = chatItem.querySelector(".chat-list-msg");
                if (msgTextEl) {
                    msgTextEl.style.fontWeight = "normal";
                    msgTextEl.style.color = "var(--text-light)";
                }
            }
        }

        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) {
            renderMessageSkeletons(messagesDiv);
        }

        const resMsg = await fetch(
            `${API_URL}/chat/${currentConversationId}/messages?limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
            },
        );

        if (!resMsg.ok) {
            const errorText = await resMsg.text();
            throw new Error(`Không thể tải tin nhắn (HTTP ${resMsg.status}): ${errorText.substring(0, 100)}`);
        }

        const dataMsg = await resMsg.json();
        messagesDiv.innerHTML = "";

        // Lưu và áp dụng biệt danh
        currentNicknames = dataMsg.nicknames || {};
        updateUINames();

        // Áp dụng chủ đề trò chuyện
        applyChatTheme(dataMsg.theme || "default");

        // Cập nhật state phân trang
        hasMoreMessages = dataMsg.hasMore || false;
        isLoadingMoreMessages = false;

        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;

            // ⚡ BATCH RENDER: Dùng DocumentFragment để gom tất cả DOM nodes
            // rồi chèn 1 lần duy nhất → giảm reflow/repaint từ N lần xuống 1 lần
            const fragment = document.createDocumentFragment();
            dataMsg.data.forEach((msg) => displayMessage(msg, fragment));
            messagesDiv.appendChild(fragment);

            updateReadReceiptsDOM();
            emitMarkMessagesRead();

            // Cuộn xuống cuối ngay lập tức và cuộn lại sau khi kết xuất để đảm bảo luôn hiển thị tin nhắn mới nhất
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 50);
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 150);

            // Tự động đồng bộ tin nhắn cuối cùng vào sidebar khi mở phòng chat để tránh lệch giao diện
            if (dataMsg.data.length > 0) {
                const lastMsg = dataMsg.data[dataMsg.data.length - 1];
                updateChatListUI(lastMsg, true);
            }
        }

        // Gắn scroll listener cho infinite scroll ngược
        setupInfiniteScroll(messagesDiv);

        // 🌟 Tải danh sách tin nhắn ghim của cuộc trò chuyện
        loadPinnedMessages(currentConversationId);
    } catch (error) {
        alert("Lỗi khi mở phòng trò chuyện: " + error.message);
    }
}

function startChatAndSwitchTab(receiverId, receiverName, receiverAvatar) {
    startChat(receiverId, receiverName, receiverAvatar);
    const messagesTabNav = document.querySelector('.nav-item[title="Tin nhắn"]');
    if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
}

// --- HÀM CẬP NHẬT GIAO DIỆN CHAT LIST KHI CÓ TIN NHẮN MỚI ---
function updateChatListUI(msg, isRead = false) {
    try {
        const userList = document.getElementById("user-list");
        if (!userList) return;

        // Tìm item bằng isSameId để tránh lệch chữ hoa/thường hoặc khoảng trắng giữa các UUID
        const items = userList.querySelectorAll("li");
        let chatItem = null;
        for (const item of items) {
            if (isSameId(item.dataset.conversationId, msg.conversationId)) {
                chatItem = item;
                break;
            }
        }

        if (!chatItem) {
            // Nếu là cuộc trò chuyện mới tinh chưa có, tải lại toàn bộ danh sách
            loadConversations();
            return;
        }

        // 1. Cập nhật nội dung text snippet mới nhất
        const msgTextEl = chatItem.querySelector(".chat-list-msg");
        if (msgTextEl) {
            let snippet = msg.content || "";
            if (msg.isRecalled) snippet = "Tin nhắn đã bị thu hồi";
            else if (msg.type === "missed_call") snippet = "Cuộc gọi nhỡ";
            else if (msg.type === "file") {
                try {
                    const fileData = JSON.parse(msg.content);
                    snippet = `[ Tệp tin: ${fileData.fileName} ]`;
                } catch (e) {
                    snippet = "[ Tệp tin ]";
                }
            } else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
            else if (
                msg.content &&
                (msg.content.startsWith("data:image") ||
                    msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
            ) {
                snippet = "[ Hình ảnh ]";
            }

            msgTextEl.innerText = snippet;

            // In đậm nếu chưa đọc
            if (!isRead && msg.senderId !== myId) {
                msgTextEl.style.fontWeight = "600";
                msgTextEl.style.color = "var(--text-dark)";
            } else {
                msgTextEl.style.fontWeight = "normal";
                msgTextEl.style.color = "var(--text-light)";
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

        // 3. Cập nhật thời gian tin nhắn cuối cùng
        const timeEl = chatItem.querySelector(".chat-list-time");
        if (timeEl) {
            const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
            timeEl.innerText = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        }

        // 4. Đẩy item lên vị trí đầu tiên của danh sách
        userList.prepend(chatItem);
        updateTotalMessagesBadge();
    } catch (error) {
        console.error("Lỗi trong updateChatListUI:", error);
    }
}

// --- TẢI LẠI ĐOẠN CHAT ---
async function reloadCurrentChat() {
    if (!currentConversationId) return;
    try {
        const resMsg = await fetch(
            `${API_URL}/chat/${currentConversationId}/messages?limit=50`, {
                headers: { Authorization: `Bearer ${token}` },
            },
        );
        if (!resMsg.ok) {
            const errorText = await resMsg.text();
            throw new Error(`HTTP ${resMsg.status}: ${errorText.substring(0, 100)}`);
        }
        const dataMsg = await resMsg.json();
        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML = "";

        // Lưu và áp dụng biệt danh
        currentNicknames = dataMsg.nicknames || {};
        updateUINames();

        // Áp dụng chủ đề trò chuyện
        applyChatTheme(dataMsg.theme || "default");

        // Cập nhật state phân trang
        hasMoreMessages = dataMsg.hasMore || false;
        isLoadingMoreMessages = false;

        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;

            // ⚡ BATCH RENDER
            const fragment = document.createDocumentFragment();
            dataMsg.data.forEach((msg) => displayMessage(msg, fragment));
            messagesDiv.appendChild(fragment);

            updateReadReceiptsDOM();

            // Scroll xuống cuối 1 lần duy nhất
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
        }

        // Gắn scroll listener cho infinite scroll ngược
        setupInfiniteScroll(messagesDiv);
    } catch (error) {
        console.error("Lỗi reload chat:", error);
    }
}

// --- INFINITE SCROLL: Tải thêm tin nhắn cũ khi cuộn lên đầu ---
let _scrollListenerAttached = false;

function setupInfiniteScroll(messagesDiv) {
    if (_scrollListenerAttached) return; // Chỉ gắn 1 lần
    _scrollListenerAttached = true;

    messagesDiv.addEventListener("scroll", debounce(function() {
        // Khi cuộn gần đến đầu khung chat (cách top < 80px)
        if (messagesDiv.scrollTop < 80 && hasMoreMessages && !isLoadingMoreMessages) {
            loadOlderMessages();
        }
    }, 200));
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

async function loadOlderMessages() {
    if (!currentConversationId || !hasMoreMessages || isLoadingMoreMessages) return;
    isLoadingMoreMessages = true;

    try {
        // Lấy ID tin nhắn cũ nhất hiện tại làm cursor
        const oldestMsg = currentChatMessages[0];
        if (!oldestMsg) return;

        const messagesDiv = document.getElementById("messages");

        // Ghi nhớ chiều cao scroll hiện tại trước khi thêm tin nhắn cũ
        const prevScrollHeight = messagesDiv.scrollHeight;

        const res = await fetch(
            `${API_URL}/chat/${currentConversationId}/messages?limit=50&before=${oldestMsg.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            },
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        hasMoreMessages = data.hasMore || false;

        if (data.data && data.data.length > 0) {
            // Chèn tin nhắn cũ vào ĐẦU mảng
            currentChatMessages = [...data.data, ...currentChatMessages];

            // ⚡ BATCH RENDER: Gom tất cả vào DocumentFragment
            const fragment = document.createDocumentFragment();
            data.data.forEach((msg) => displayMessage(msg, fragment));

            // Chèn lên đầu khung chat (prepend)
            messagesDiv.insertBefore(fragment, messagesDiv.firstChild);

            // Giữ nguyên vị trí scroll (không nhảy lung tung)
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight - prevScrollHeight;
            });

            updateReadReceiptsDOM();
        }
    } catch (error) {
        console.error("Lỗi tải thêm tin nhắn cũ:", error);
    } finally {
        isLoadingMoreMessages = false;
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

// --- HỆ THỐNG BADGE TIN NHẮN CHƯA ĐỌC ---
function updateTotalMessagesBadge() {
    const badgeEl = document.getElementById("messages-badge");
    if (!badgeEl) return;

    let totalUnread = 0;
    const badges = document.querySelectorAll(".conversation-item .unread-badge");
    badges.forEach(b => {
        const text = b.innerText.trim();
        if (text === "99+") {
            totalUnread += 99;
        } else {
            const count = parseInt(text) || 0;
            totalUnread += count;
        }
    });

    if (totalUnread > 0) {
        badgeEl.innerText = totalUnread > 99 ? "99+" : totalUnread;
        badgeEl.style.display = "flex";
    } else {
        badgeEl.style.display = "none";
    }
}

// --- HỆ THỐNG BADGE TIN TỨC CHƯA ĐỌC ---
function updateNewsBadge() {
    const badgeEl = document.getElementById("news-badge");
    if (!badgeEl) return;

    // Chỉ tính số tin tức chưa đọc trong danh sách hiện tại
    const unreadCount = allNewsItems.filter(item => !readNewsIds.includes(item.id)).length;

    // Chỉ hiển thị badge nếu có tin tức chưa đọc
    if (unreadCount > 0) {
        // Hiển thị với giới hạn 99+ để badge luôn nhỏ gọn
        badgeEl.innerText = unreadCount > 99 ? "99+" : unreadCount;
        badgeEl.style.display = "flex";
    } else {
        badgeEl.style.display = "none";
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
            formatUrl(user.avatar) :
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                user.fullName,
            )}&background=random`;

        const itemEl = document.createElement("div");
        itemEl.className = "friend-request-item";
        itemEl.id = `request-${req.id}`;
        itemEl.innerHTML = `
      <div class="friend-request-info">
        <div class="avatar" style="cursor: pointer;" onclick="showUserProfile('${user.id}')"><img src="${avatarUrl}" alt="Avatar"></div>
        <span style="cursor: pointer;" onclick="showUserProfile('${user.id}')">${user.fullName}</span>
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
                formatUrl(user.avatar) :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.fullName,
                )}&background=random`;

            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
        <div class="friend-request-info">
          <div class="avatar" style="width:40px;height:40px;cursor:pointer;" onclick="showUserProfile('${user.id}')"><img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;"></div>
          <span style="cursor:pointer;" onclick="showUserProfile('${user.id}')">${user.fullName}</span>
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
    const listEl = document.getElementById("friends-list");
    if (!listEl) return;

    // Chỉ hiển thị skeleton nếu danh sách hiện tại đang trống để tránh nháy giao diện khi cập nhật ngầm
    if (listEl.children.length === 0 || listEl.querySelector('.skeleton-friend-item')) {
        renderFriendSkeletons(listEl);
    }

    try {
        const res = await fetch(`${API_URL}/users/friends`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Không thể tải bạn bè (HTTP ${res.status}): ${errorText.substring(0, 100) || "Lỗi máy chủ"}`);
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            listEl.innerHTML = `<p style="color: var(--text-light); text-align: center;">Chưa có bạn bè nào.</p>`;
            return;
        }

        listEl.innerHTML = "";
        data.data.forEach((user) => {
            const avatarUrl = user.avatar ?
                formatUrl(user.avatar) :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.fullName,
                )}&background=random`;

            const itemEl = document.createElement("div");
            itemEl.className = "friend-request-item";
            itemEl.dataset.userId = user.id;
            itemEl.dataset.isOnline = user.isOnline ? "true" : "false";
            itemEl.innerHTML = `
        <div class="friend-request-info">
          <div class="avatar" style="cursor: pointer;" onclick="showUserProfile('${user.id}')">
            <img src="${avatarUrl}" alt="Avatar">
            <div class="online-dot" style="display: ${user.isOnline ? 'block' : 'none'};"></div>
          </div>
          <span style="cursor: pointer;" onclick="showUserProfile('${user.id}')">${user.fullName}</span>
        </div>
        <div class="friend-request-actions">
          <button class="btn-chat-friend btn-outline" onclick="startChatAndSwitchTab('${user.id}', '${user.fullName
                }', '${avatarUrl}')"><i class="far fa-comment-dots"></i> Nhắn tin</button>
          <button class="btn-delete-friend" onclick="removeFriend('${user.id
                }')" title="Xóa bạn bè"><i class="fas fa-trash-alt"></i></button>
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
    const consent = await customConfirm("Xóa bạn bè", "Bạn có chắc chắn muốn xóa người này khỏi danh sách bạn bè?", "Xóa bạn", "Hủy", true);
    if (!consent) return;

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

// Đếm số lượng emoji nếu tin nhắn chỉ chứa toàn emoji (tối đa 3 emoji)
function getEmojiOnlyCount(text) {
    if (!text) return 0;
    const cleanText = text.trim();
    if (!cleanText) return 0;

    // Regex khớp chính xác các emoji bao gồm cả skin tones và ZWJ sequences
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})(\u200d\p{Extended_Pictographic})*/gu;
    const matches = cleanText.match(emojiRegex) || [];

    const joined = matches.join("");
    const cleanJoined = joined.replace(/[\s\uFE0F]/g, "");
    const cleanInput = cleanText.replace(/[\s\uFE0F]/g, "");

    if (cleanJoined === cleanInput && matches.length > 0 && matches.length <= 3) {
        return matches.length;
    }
    return 0;
}

// 4. Hiển thị tin nhắn lên màn hình
function displayMessage(msg, targetContainer = null) {
    // CHỐT CHẶN: Nếu tin nhắn đã được render (bởi Socket) thì bỏ qua để tránh trùng lặp
    if (document.getElementById(`msg-${msg.id}`)) return;

    // ✨ Hợp nhất tin nhắn tạm (optimistic UI) nếu có để tránh trùng lặp và kẹt spinner
    if (msg.senderId === myId && msg.id && !msg.id.toString().startsWith("optimistic-")) {
        const optMsg = currentChatMessages.find(m =>
            m.id &&
            m.id.toString().startsWith("optimistic-") &&
            m.senderId === msg.senderId &&
            m.content === msg.content
        );

        if (optMsg) {
            const optimisticEl = document.getElementById(`msg-${optMsg.id}`);
            if (optimisticEl) {
                console.log("✨ Hợp nhất thành công tin nhắn tạm:", optMsg.id, "->", msg.id);
                // Đổi ID và dataset
                optimisticEl.id = `msg-${msg.id}`;
                optimisticEl.dataset.messageId = msg.id;
                optimisticEl.style.opacity = "1";

                // Cập nhật trong mảng currentChatMessages
                const idx = currentChatMessages.indexOf(optMsg);
                if (idx !== -1) currentChatMessages[idx] = msg;

                return; // Trả về sớm, không tạo phần tử mới!
            }
        }
    }

    if (!currentChatMessages.some(m => m.id === msg.id)) {
        currentChatMessages.push(msg);
    }

    const messagesDiv = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.id = `msg-${msg.id}`;
    messageElement.className = `message ${msg.senderId === myId ? "my-message" : "other-message"}`;
    if (!targetContainer) {
        messageElement.classList.add("new-message");
    }
    messageElement.dataset.messageId = msg.id;
    messageElement.dataset.senderId = msg.senderId || "";
    messageElement.dataset.isRead = msg.isRead ? "true" : "false";

    // 🌟 Quản lý tin nhắn liên tiếp: Gộp thời gian và nhóm bong bóng chat
    messageElement.dataset.timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();

    const parentContainer = targetContainer || messagesDiv;
    // Tìm tin nhắn thực sự gần nhất (bỏ qua typing indicator và tin nhắn hệ thống)
    const messageElements = parentContainer ? parentContainer.querySelectorAll(".message:not(.system-message)") : [];
    const lastMessageEl = messageElements.length > 0 ? messageElements[messageElements.length - 1] : null;

    let isConsecutive = false;
    if (lastMessageEl && lastMessageEl.dataset.senderId === msg.senderId) {
        const lastMsgTime = parseInt(lastMessageEl.dataset.timestamp || "0");
        const currentMsgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
        if (lastMsgTime && Math.abs(currentMsgTime - lastMsgTime) < 300000) { // 5 phút
            isConsecutive = true;
        }
    }

    if (isConsecutive) {
        messageElement.classList.add("consecutive-message");
        if (lastMessageEl) {
            const prevAvatar = lastMessageEl.querySelector(".message-avatar");
            if (prevAvatar) {
                prevAvatar.style.visibility = "hidden"; // Ẩn avatar trước đó để chỉ hiện ở tin nhắn dưới cùng của nhóm
            }
        }
    }

    // Hiển thị Tin nhắn hệ thống (System message như thông báo đổi chủ đề)
    if (msg.type === "system") {
        messageElement.className = "message system-message";
        const messageBody = document.createElement("div");
        messageBody.className = "message-body";
        const messageContent = document.createElement("div");
        messageContent.className = "message-content";

        messageContent.innerText = msg.content;

        messageBody.appendChild(messageContent);
        messageElement.appendChild(messageBody);

        if (targetContainer) {
            targetContainer.appendChild(messageElement);
        } else {
            messagesDiv.appendChild(messageElement);
            if (typeof window.smartScrollToBottom === "function") {
                window.smartScrollToBottom();
            } else if (typeof window.scrollToBottomSmooth === "function") {
                window.scrollToBottomSmooth();
            } else {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        }
        return;
    }

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
        if (typeof window.smartScrollToBottom === "function") {
            window.smartScrollToBottom();
        } else if (typeof window.scrollToBottomSmooth === "function") {
            window.scrollToBottomSmooth();
        } else {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        return;
    }

    // 🌟 Ẩn tên người gửi trong chat 1-1 để tránh lặp lại giống Zalo/Messenger
    /*
    if (msg.senderId !== myId && msg.Users) {
        const senderName = document.createElement("div");
        senderName.className = "sender-name";
        senderName.dataset.realName = msg.Users.fullName;
        senderName.innerText = (currentNicknames && currentNicknames[msg.senderId]) || msg.Users.fullName;
        messageElement.appendChild(senderName);
    }
    */

    const messageBody = document.createElement("div");
    messageBody.className = "message-body";

    // 🌟 Thêm ảnh đại diện của đối phương cạnh bong bóng chat nhận được (giống Messenger)
    if (msg.senderId !== myId) {
        const avatarImg = document.createElement("img");
        avatarImg.className = "message-avatar";
        const partnerAvatarUrl = getPartnerAvatar() || "https://ui-avatars.com/api/?name=User&background=random";
        avatarImg.src = partnerAvatarUrl;
        avatarImg.alt = "Avatar";
        avatarImg.onerror = function() {
            this.src = "https://ui-avatars.com/api/?name=User&background=random";
        };
        messageBody.appendChild(avatarImg);
    }
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
                    link.href = fileData.url || fileData.base64;
                    link.download = fileData.fileName;
                    // Nếu là URL ngoài, mở tab mới thay vì tự động tạo click
                    if (fileData.url) {
                        link.target = "_blank";
                    }
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
            msg.type === "image" ||
            (msg.content &&
                (msg.content.startsWith("data:image/") ||
                    msg.content.startsWith("http") ||
                    msg.content.match(/\.(jpeg|jpg|gif|png)(\?.*)?$/i)))
        ) {
            messageContent.innerHTML = `<div class="message-img-container"><img src="${msg.content}" class="message-image" loading="lazy" onload="if(typeof window.scrollToBottomInstant === 'function') window.scrollToBottomInstant()" onclick="openLightbox(this.src)" draggable="false" oncontextmenu="return false;" alt="Ảnh tin nhắn" /></div>`;
            messageContent.style.background = "transparent";
            messageContent.style.padding = "0";
            messageContent.classList.add("image-message-content");
        } else {
            messageContent.innerText = msg.content;

            // Xử lý Emoji cỡ lớn nếu tin nhắn chỉ chứa từ 1 đến 3 emoji
            const emojiCount = getEmojiOnlyCount(msg.content);
            if (emojiCount > 0) {
                messageElement.classList.add("emoji-only-message");
                messageContent.classList.add(`emoji-only-${emojiCount}`);
            }

            if (msg.isEdited) {
                const editedLabel = document.createElement("span");
                editedLabel.className = "edited-label";
                editedLabel.innerText = " (đã chỉnh sửa)";
                editedLabel.style.fontSize = "0.75rem";
                editedLabel.style.color = "var(--text-light)";
                editedLabel.style.fontStyle = "italic";
                messageContent.appendChild(editedLabel);
            }


        }

        // Nâng cấp: Hiển thị tin nhắn trích dẫn (Replied Message Preview)
        if (msg.replyMessageId) {
            let parentMsg = msg.replyMessage;

            // Nếu chưa có đối tượng do backend đính kèm, tìm trong mảng cục bộ
            if (!parentMsg) {
                const localParent = currentChatMessages.find((m) => m.id === msg.replyMessageId);
                if (localParent) {
                    let parentSenderName = "Người dùng";
                    if (localParent.senderId === myId) {
                        parentSenderName = "Bạn";
                    } else if (localParent.Users) {
                        parentSenderName = localParent.Users.fullName;
                    } else {
                        const headerName = document.getElementById("chat-header-name");
                        if (headerName) parentSenderName = headerName.innerText;
                    }
                    parentMsg = {
                        content: localParent.content,
                        senderId: localParent.senderId,
                        type: localParent.type,
                        isRecalled: localParent.isRecalled || false,
                        senderName: parentSenderName
                    };
                }
            }

            if (parentMsg) {
                const replyBox = document.createElement("div");
                replyBox.className = "replied-message-box";

                let parentSenderName = parentMsg.senderName || "Người dùng";
                if (parentMsg.senderId === myId) {
                    parentSenderName = "Bạn";
                }

                let parentText = parentMsg.content;
                if (parentMsg.isRecalled) {
                    parentText = "Tin nhắn đã bị thu hồi";
                } else if (parentMsg.type === "file") {
                    try {
                        const fileData = JSON.parse(parentMsg.content);
                        parentText = `[ Tệp tin: ${fileData.fileName} ]`;
                    } catch (e) {
                        parentText = "[ Tệp tin ]";
                    }
                } else if (parentMsg.type === "audio") {
                    parentText = "[ Tin nhắn thoại ]";
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
                    const overlay = document.getElementById("mobile-action-overlay");
                    if (overlay && overlay.classList.contains("show")) {
                        return; // Chặn nhảy tin nhắn khi đang mở hoặc vừa mở menu di động
                    }
                    scrollToAndHighlightMessage(msg.replyMessageId);
                };

                messageContent.prepend(replyBox);
            }
        }

        // 🌟 Hiển thị nhãn chuyển tiếp nếu tin nhắn được chuyển tiếp
        if (msg.isForwarded) {
            const forwardedIndicator = document.createElement("div");
            forwardedIndicator.className = "forwarded-indicator";
            forwardedIndicator.innerHTML = '<i class="fas fa-share"></i> Chuyển tiếp';
            messageContent.prepend(forwardedIndicator);
        }

        // 🌟 Hiển thị nhãn/huy hiệu ghim tin nhắn
        if (msg.isPinned) {
            const pinBadge = document.createElement("div");
            pinBadge.className = "message-pin-badge";
            pinBadge.innerHTML = '<i class="fas fa-thumbtack"></i>';
            pinBadge.title = "Tin nhắn được ghim";
            messageContent.appendChild(pinBadge);
            messageElement.classList.add("pinned-message");
        }

        // TẠO NÚT THẢ CẢM XÚC (Reaction)
        const reactBtn = document.createElement("div");
        reactBtn.className = "action-item react-btn";
        reactBtn.innerHTML = '<i class="far fa-smile"></i>';
        const reactionPalette = document.createElement("div");
        reactionPalette.className = "reaction-palette";
        const EMOJIS = ["❤️", "😆", "😮", "😢", "😡", "👍"];
        EMOJIS.forEach((emoji) => {
            const emojiSpan = document.createElement("span");
            emojiSpan.innerText = emoji;
            emojiSpan.style.fontSize = "32px";
            emojiSpan.style.transition = "transform 0.15s";
            const handleReact = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const currentMsgId = messageElement.dataset.messageId;
                if (currentMsgId && currentMsgId.toString().startsWith("optimistic-")) return;
                reactToMessage(currentMsgId, emoji);
                reactionPalette.classList.remove("show");
                hideMobileOverlay();
            };
            emojiSpan.onclick = handleReact;
            reactionPalette.appendChild(emojiSpan);
        });

        // 📷 Nút camera màu xanh giống Messenger
        const cameraSpan = document.createElement("span");
        cameraSpan.innerHTML = `<span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #0084ff; border-radius: 50%; color: white; font-size: 12px;"><i class="fas fa-camera"></i></span>`;
        cameraSpan.style.cursor = "pointer";
        cameraSpan.style.display = "inline-flex";
        cameraSpan.style.alignItems = "center";
        cameraSpan.style.justifyContent = "center";
        cameraSpan.style.transition = "transform 0.15s";
        cameraSpan.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const imgInput = document.getElementById("image-upload");
            if (imgInput) imgInput.click();
            hideMobileOverlay();
        };
        reactionPalette.appendChild(cameraSpan);

        // ➕ Nút cộng để chọn các emoji khác giống Messenger
        const plusSpan = document.createElement("span");
        plusSpan.innerHTML = `<span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(255, 255, 255, 0.15); border-radius: 50%; color: white; font-size: 12px;"><i class="fas fa-plus"></i></span>`;
        plusSpan.style.cursor = "pointer";
        plusSpan.style.display = "inline-flex";
        plusSpan.style.alignItems = "center";
        plusSpan.style.justifyContent = "center";
        plusSpan.style.transition = "transform 0.15s";
        plusSpan.className = "reaction-plus-btn";
        
        const handlePlusReact = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const currentMsgId = messageElement.dataset.messageId;
            if (currentMsgId && currentMsgId.toString().startsWith("optimistic-")) return;
            openCustomReactionPicker(currentMsgId, e.clientX, e.clientY);
            reactionPalette.classList.remove("show");
        };
        plusSpan.onclick = handlePlusReact;
        reactionPalette.appendChild(plusSpan);

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
            const currentMsgId = messageElement.dataset.messageId;
            setReplyMode(currentMsgId);
            moreMenu.classList.remove("show");
            hideMobileOverlay();
        };
        moreMenu.appendChild(replyOption);

        if (!msg.isRecalled) {
            const isImageMsg = msg.type === "image" || (msg.content && (msg.content.startsWith("data:image/") || msg.content.startsWith("http") || msg.content.match(/\.(jpeg|jpg|gif|png)(\?.*)?$/i)));

            if (!isImageMsg) {
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

            // Lưu ảnh (Chỉ dành cho tin nhắn ảnh)
            if (isImageMsg) {
                const saveOption = document.createElement("div");
                saveOption.className = "menu-item save-image-action";
                saveOption.innerText = "Lưu ảnh";
                saveOption.onclick = async (e) => {
                    e.stopPropagation();
                    moreMenu.classList.remove("show");
                    hideMobileOverlay();
                    
                    try {
                        let imageUrl = msg.content;
                        if (imageUrl.startsWith("data:image/")) {
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = imageUrl;
                            a.download = `tho-fi-image-${Date.now()}.png`; 
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        } else {
                            const response = await fetch(imageUrl);
                            const blob = await response.blob();
                            const blobUrl = window.URL.createObjectURL(blob);

                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = blobUrl;
                            a.download = `tho-fi-image-${Date.now()}.jpg`; 
                            document.body.appendChild(a);
                            a.click();

                            window.URL.revokeObjectURL(blobUrl);
                            document.body.removeChild(a);
                        }
                        showToast("Đã lưu ảnh");
                    } catch (error) {
                        console.error('Lỗi khi tải ảnh:', error);
                        // Fallback: Mở ảnh trong tab mới nếu bị CORS chặn
                        window.open(imageUrl, '_blank');
                    }
                };
                moreMenu.appendChild(saveOption);
            }

            // Ghim tin nhắn
            const pinOption = document.createElement("div");
            pinOption.className = "menu-item pin-action";
            pinOption.innerText = msg.isPinned || messageElement.classList.contains("pinned-message") ? "Bỏ ghim" : "Ghim tin nhắn";
            pinOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                pinMessage(currentMsgId);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(pinOption);

            // Chuyển tiếp tin nhắn
            const forwardOption = document.createElement("div");
            forwardOption.className = "menu-item forward-action";
            forwardOption.innerText = "Chuyển tiếp";
            forwardOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                openForwardModal(currentMsgId);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(forwardOption);
        }

        if (msg.senderId === myId) {
            // Sửa tin nhắn (chỉ cho tin nhắn văn bản chưa thu hồi)
            if (!msg.isRecalled && (!msg.type || msg.type === "text")) {
                const editOption = document.createElement("div");
                editOption.className = "menu-item edit-action";
                editOption.innerText = "Sửa tin nhắn";
                editOption.onclick = (e) => {
                    e.stopPropagation();
                    const currentMsgId = messageElement.dataset.messageId;
                    const latestMsgObj = currentChatMessages.find(m => m.id === currentMsgId);
                    const latestContent = latestMsgObj ? latestMsgObj.content : msg.content;
                    startEditMode(currentMsgId, latestContent);
                    moreMenu.classList.remove("show");
                    hideMobileOverlay();
                };
                moreMenu.appendChild(editOption);
            }

            const recallOption = document.createElement("div");
            recallOption.className = "menu-item text-danger";
            recallOption.innerText = "Thu hồi tin nhắn";
            recallOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                recallMessage(currentMsgId);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(recallOption);

            const deleteOption = document.createElement("div");
            deleteOption.className = "menu-item delete-action";
            deleteOption.innerText = "Xóa ở phía tôi";
            deleteOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                openDeleteMessageMeModal(currentMsgId);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(deleteOption);
        } else {
            const deleteOption = document.createElement("div");
            deleteOption.className = "menu-item delete-action";
            deleteOption.innerText = "Xóa ở phía tôi";
            deleteOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                openDeleteMessageMeModal(currentMsgId);
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

        moreBtn.appendChild(moreMenu);

        const replyBtn = document.createElement("div");
        replyBtn.className = "action-item reply-btn";
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.title = "Trả lời";
        replyBtn.onclick = (e) => {
            e.stopPropagation();
            const currentMsgId = messageElement.dataset.messageId;
            setReplyMode(currentMsgId);
        };

        const actions = document.createElement("div");
        actions.className = "message-actions";
        actions.appendChild(replyBtn);
        actions.appendChild(reactBtn);
        actions.appendChild(moreBtn);

        messageContent.appendChild(actions);
        messageBody.appendChild(messageContent);

        renderReactions(messageBody, msg.reactions);

        // Vuốt kéo để trả lời (Swipe left/right to reply on mobile and desktop)
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let isHorizontalDrag = false;
        let dragX = 0;

        const swipeIndicator = document.createElement("div");
        swipeIndicator.className = "swipe-reply-indicator";
        swipeIndicator.innerHTML = '<i class="fas fa-reply"></i>';
        messageElement.appendChild(swipeIndicator);

        messageBody.addEventListener("pointerdown", (e) => {
            if (document.body.classList.contains("overlay-active")) return;
            if (e.button !== 0) return; // Chỉ nhận chuột trái
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            isHorizontalDrag = false;
            dragX = 0;
            messageBody.style.transition = "none";
        });

        messageBody.addEventListener("pointermove", (e) => {
            if (document.body.classList.contains("overlay-active")) {
                isDragging = false;
                return;
            }
            if (!isDragging) return;
            const diffX = e.clientX - startX;
            const diffY = e.clientY - startY;

            const _isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const swipeThreshold = _isIOSDevice ? 14 : 8;
            if (!isHorizontalDrag && Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                isHorizontalDrag = true;
                messageBody.setPointerCapture(e.pointerId); // Chỉ capture khi thực sự kéo ngang
            }

            if (isHorizontalDrag) {
                if (e.cancelable) e.preventDefault();

                // Công thức cản lực kéo vô hạn (rubber-banding) giống iOS / Messenger
                const maxDrag = 80;
                dragX = Math.sign(diffX) * (maxDrag * (1 - Math.exp(-Math.abs(diffX) / 65)));
                messageBody.style.transform = `translateX(${dragX}px)`;

                // Định vị indicator nằm bên trái hay bên phải dựa vào hướng kéo
                if (dragX > 0) {
                    swipeIndicator.style.left = "-45px";
                    swipeIndicator.style.right = "auto";
                } else {
                    swipeIndicator.style.left = "auto";
                    swipeIndicator.style.right = "-45px";
                }

                // Tăng kích thước phóng to dần của icon theo khoảng cách vuốt
                const scale = Math.min(1.1, Math.abs(dragX) / 40);
                swipeIndicator.style.transform = `translateY(-50%) scale(${scale})`;
                swipeIndicator.style.opacity = Math.min(1, Math.abs(dragX) / 30);

                if (Math.abs(dragX) >= 40) {
                    swipeIndicator.classList.add("active");
                } else {
                    swipeIndicator.classList.remove("active");
                }
            }
        });

        const endDrag = (e) => {
            if (document.body.classList.contains("overlay-active")) {
                isDragging = false;
                return;
            }
            if (!isDragging) return;
            isDragging = false;

            // Hiệu ứng đàn hồi nẩy lò xo cực mượt (easeOutBack)
            messageBody.style.transition = "transform 0.3s cubic-bezier(0.175, 0.885, 0.45, 1.4)";
            messageBody.style.transform = "translateX(0px)";

            swipeIndicator.classList.remove("active");
            swipeIndicator.style.opacity = "";
            swipeIndicator.style.transform = "";

            if (isHorizontalDrag && Math.abs(dragX) >= 40) {
                setReplyMode(msg.id);
                if (navigator.vibrate) {
                    try {
                        navigator.vibrate(30);
                    } catch (err) {}
                }
            }
        };

        messageBody.addEventListener("pointerup", endDrag);
        messageBody.addEventListener("pointercancel", endDrag);

        // Xử lý nhấn giữ trên di động
        let pressTimer;
        let isLongPress = false;
        let longPressStartY = 0;
        let longPressStartX = 0;

        messageContent.addEventListener(
            "touchstart",
            (e) => {
                if (window.innerWidth > 768) return;
                longPressStartY = e.touches[0].clientY;
                longPressStartX = e.touches[0].clientX;
                isLongPress = false;
                const _isIOSLp = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    showMobileOverlay(messageElement);
                    const palette = messageElement.querySelector(".reaction-palette");
                    if (palette) palette.classList.add("show");
                }, _isIOSLp ? 380 : 250);
            }, { passive: true },
        );

        const cancelPress = (e) => {
            if (e && e.type === "touchmove") {
                const diffY = Math.abs(e.touches[0].clientY - longPressStartY);
                const diffX = Math.abs(e.touches[0].clientX - longPressStartX);
                if (diffY > 10 || diffX > 10) {
                    clearTimeout(pressTimer);
                    clearTimeout(mouseTimer);
                }
            } else {
                if (isLongPress && e && e.type === "touchend") {
                    longPressJustOccurred = true; // Bật flag nuốt click giả khi người dùng nhấc ngón tay lên
                    setTimeout(() => { longPressJustOccurred = false; }, 500); // Tự động tắt sau 500ms
                    isLongPress = false;
                }
                clearTimeout(pressTimer);
                clearTimeout(mouseTimer);
            }
        };

        messageContent.addEventListener("touchend", cancelPress, { passive: false });
        messageContent.addEventListener("touchmove", cancelPress, {
            passive: true,
        });
        messageContent.addEventListener("touchcancel", cancelPress);
        


        messageContent.addEventListener("contextmenu", (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                showMobileOverlay(messageElement);
                const palette = messageElement.querySelector(".reaction-palette");
                if (palette) palette.classList.add("show");
            }
        });

        // Hỗ trợ nhấn giữ bằng chuột (cho môi trường Web responsive giả lập trên desktop)
        let mouseTimer;
        let isMouseLongPress = false;

        messageContent.addEventListener("mousedown", (e) => {
            if (window.innerWidth > 768) return;
            if (e.button !== 0) return; // Chỉ nhận chuột trái
            isMouseLongPress = false;
            mouseTimer = setTimeout(() => {
                isMouseLongPress = true;
                showMobileOverlay(messageElement);
                const palette = messageElement.querySelector(".reaction-palette");
                if (palette) palette.classList.add("show");
            }, 300);
        });

        const cancelMousePress = (e) => {
            clearTimeout(mouseTimer);
            if (isMouseLongPress && e && e.type === "mouseup") {
                e.preventDefault();
                e.stopImmediatePropagation();
                longPressJustOccurred = true; // Bật flag nuốt click sinh ra ngay sau khi thả chuột
                setTimeout(() => { longPressJustOccurred = false; }, 500);
                isMouseLongPress = false;
            }
        };

        messageContent.addEventListener("mouseup", cancelMousePress);
        messageContent.addEventListener("mousemove", (e) => {
            // Nếu di chuột thì huỷ nhấn giữ
            clearTimeout(mouseTimer);
        });
        messageContent.addEventListener("mouseleave", cancelMousePress);

        // Xử lý Double click / Double tap thả tim giống Messenger
        let lastTap = 0;

        const handleDoubleTap = (e) => {
            reactToMessage(msg.id, "❤️");

            // Hiển thị hiệu ứng trái tim bay giữa tin nhắn
            const heart = document.createElement("div");
            heart.className = "heart-pop-animation";
            heart.innerHTML = "❤️";
            messageContent.appendChild(heart);
            setTimeout(() => heart.remove(), 800);
        };

        // Cho mobile (Tránh trễ 300ms click và tránh zoom)
        messageContent.addEventListener("touchend", (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                e.preventDefault();
                e.stopPropagation(); // FIX iOS #7: Ngăn event bubble lên gây zoom
                handleDoubleTap(e);
            }
            lastTap = currentTime;
        }, { passive: false });

        // Cho desktop
        messageContent.addEventListener("dblclick", (e) => {
            e.preventDefault();
            handleDoubleTap(e);
        });
    }

    // Định dạng và hiển thị thời gian gửi tin nhắn
    const metaElement = document.createElement("div");
    metaElement.className = "message-meta";
    const timeElement = document.createElement("span");
    timeElement.className = "message-time";
    timeElement.style.display = "none"; // 🌟 Mặc định ẩn thời gian giống Messenger
    
    const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
    const now = new Date();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    
    let timeStr = `${hours}:${minutes}`;
    
    // Nếu qua 1 ngày khác (không phải hôm nay) thì hiện ngày tháng năm kèm giờ phút
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
                    
    if (!isToday) {
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        timeStr = `${hours}:${minutes} ${day}/${month}/${year}`;
    }
    
    timeElement.innerText = timeStr;
    metaElement.appendChild(timeElement);

    // Trạng thái "Đang gửi" hoặc "Đã gửi" chỉ dành cho tin nhắn của bản thân
    if (msg.senderId === myId) {
        const statusElement = document.createElement("span");
        statusElement.className = "message-status";
        if (msg.id.toString().startsWith("optimistic-")) {
            statusElement.classList.add("sending");
            statusElement.innerHTML = '<i class="far fa-circle sending-icon"></i>';
            statusElement.title = "Đang gửi...";
        }
        metaElement.appendChild(statusElement);
    }

    // 🌟 TÍNH NĂNG MESSENGER: Click vào bong bóng chat để ẩn/hiện thời gian
    messageContent.addEventListener("click", (e) => {
        // Tránh toggle khi click vào các nút điều khiển của audio, ảnh hoặc card tải file
        if (
            e.target.tagName === "AUDIO" || 
            e.target.tagName === "IMG" || 
            e.target.closest(".file-message-card") ||
            e.target.closest(".action-item") ||
            e.target.closest(".reaction-palette")
        ) {
            return;
        }
        e.stopPropagation();
        const timeEl = messageElement.querySelector(".message-time");
        if (timeEl) {
            const isHidden = window.getComputedStyle(timeEl).display === "none";
            timeEl.style.display = isHidden ? "inline" : "none";
        }
    });

    messageElement.appendChild(messageBody);
    messageElement.appendChild(metaElement);

    // Nếu có targetContainer (batch render) → chèn vào fragment, không chèn trực tiếp vào DOM
    if (targetContainer) {
        targetContainer.appendChild(messageElement);
    } else {
        // Render đơn lẻ (realtime socket) → chèn trực tiếp và scroll THÔNG MINH
        messagesDiv.appendChild(messageElement);
        // updateReadReceiptsDOM() được gọi một lần duy nhất sau khi toàn bộ tin nhắn đã render xong
        // (trong startChat / reloadCurrentChat / socket receive_message). Không gọi ở đây để tránh flicker.
        
        if (msg.senderId === myId) {
            // Tin nhắn của chính mình gửi đi: cuộn xuống đáy ngay lập tức để có cảm giác phản hồi nhanh
            if (typeof window.scrollToBottomInstant === "function") {
                window.scrollToBottomInstant();
            } else {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        } else {
            // Tin nhắn đối phương gửi tới: cuộn thông minh (chỉ cuộn nếu đang ở gần đáy)
            if (typeof window.smartScrollToBottom === "function") {
                window.smartScrollToBottom();
            } else if (typeof window.scrollToBottomSmooth === "function") {
                window.scrollToBottomSmooth();
            } else {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        }
    }
}
// 5. Gửi tin nhắn bất đồng bộ
function sendMessage(imageContent = null) {
    const input = document.getElementById("message-input");
    const content = imageContent || input.value.trim();

    if (!currentConversationId) {
        return alert("Bạn quên chưa chọn người để trò chuyện rồi (Cột danh sách bên trái)!");
    }

    if (!content) return;

    // Chặn để thực hiện sửa tin nhắn thay vì gửi mới (không áp dụng cho gửi Like)
    if (editingMessage && !imageContent && content !== '👍') {
        const messageIdToEdit = editingMessage.id;
        input.value = "";
        input.style.height = 'auto'; // Reset chiều cao

        // Trả UI về mặc định
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.remove('is-typing');
        if (document.getElementById('like-btn')) document.getElementById('like-btn').style.display = 'flex';
        if (document.getElementById('send-btn')) document.getElementById('send-btn').style.display = 'none';

        editMessageApi(messageIdToEdit, content);
        cancelReply();
        
        // 🌟 Giữ bàn phím mở sau khi sửa xong tin nhắn
        input.focus();
        return;
    }

    input.value = "";
    if (!imageContent || imageContent === '👍') {
        // Trả UI về mặc định
        input.style.height = 'auto';
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.remove('is-typing');
        if (document.getElementById('like-btn')) document.getElementById('like-btn').style.display = 'flex';
        if (document.getElementById('send-btn')) document.getElementById('send-btn').style.display = 'none';
    }

    if ((!imageContent || imageContent === '👍') && socket) {
        if (currentChatPartnerId) {
            socket.emit("stop-typing", { receiverId: currentChatPartnerId });
        }
        socket.emit("stop_typing", {
            conversationId: currentConversationId,
            senderId: myId,
        });
    }

    // ✨ OPTIMISTIC UI: Hiển thị tin nhắn ngay lập tức
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg = {
        id: optimisticId,
        conversationId: currentConversationId,
        senderId: myId,
        content: content,
        type: (imageContent && imageContent.startsWith("data:image")) ? "image" : "text",
        isRecalled: false,
        createdAt: new Date().toISOString(),
        replyMessageId: replyingToMessage ? replyingToMessage.id : null,
        Users: { id: myId, fullName: myName, avatar: null },
    };
    currentChatMessages.push(optimisticMsg);
    displayMessage(optimisticMsg);
    triggerWordEffects(content);
    ChatSounds.playSend();
    updateChatListUI(optimisticMsg, true);

    const payload = { content };
    if (replyingToMessage) {
        payload.replyMessageId = replyingToMessage.id;
    }
    cancelReply();

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
                const optimisticEl = document.getElementById(`msg-${optimisticId}`);
                if (optimisticEl) {
                    optimisticEl.id = `msg-${data.data.id}`;
                    optimisticEl.dataset.messageId = data.data.id;
                    optimisticEl.style.opacity = "1";
                }
                const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
                if (idx !== -1) currentChatMessages[idx] = data.data;
                // Cập nhật ngay trạng thái Đã gửi sau khi merge thành công
                updateReadReceiptsDOM();
            } else {
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

    // 🌟 Giữ bàn phím mở sau khi gửi bằng cách tự động lấy lại focus
    input.focus();
}

// 6. Bấm phím Enter để gửi & Sự kiện gõ phím
const messageInput = document.getElementById("message-input");
if (messageInput) {
    messageInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener("input", function() {
        // Tự động giãn dòng nhưng giới hạn tối đa
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 80); // Giới hạn max 80px
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > 80 ? 'scroll' : 'hidden';

        // Neo cuộn danh sách tin nhắn để không bị lệch khi chiều cao ô nhập thay đổi
        if (window.innerWidth <= 768) {
            scrollToBottomInstant();
        } else {
            scrollToBottomSmooth();
        }
        // Logic của Messenger: Thay Like thành Gửi, thu gọn menu trái
        const inputArea = document.getElementById('input-area');
        const likeBtn = document.getElementById('like-btn');
        const sendBtn = document.getElementById('send-btn');

        if (this.value.trim().length > 0) {
            if (inputArea) inputArea.classList.add('is-typing');
            if (likeBtn) likeBtn.style.display = 'none';
            if (sendBtn) sendBtn.style.display = 'flex';
        } else {
            if (document.activeElement === messageInput) {
                if (inputArea) inputArea.classList.add('is-typing');
            } else {
                if (inputArea) inputArea.classList.remove('is-typing');
            }
            if (likeBtn) likeBtn.style.display = 'flex';
            if (sendBtn) sendBtn.style.display = 'none';
        }

        // Phát sự kiện Socket Typing (Throttled: Tối đa 1 lần mỗi 2.5 giây)
        const nowTime = Date.now();
        if (socket && nowTime - lastTypingEmitTime > 2500) {
            lastTypingEmitTime = nowTime;
            if (currentChatPartnerId) {
                socket.emit("typing", { receiverId: currentChatPartnerId, senderName: myName });
            }
            if (currentConversationId) {
                socket.emit("typing", {
                    conversationId: currentConversationId,
                    senderId: myId,
                    senderName: myName,
                });
            }
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (currentChatPartnerId) {
                socket.emit("stop-typing", { receiverId: currentChatPartnerId });
            }
            if (currentConversationId) {
                socket.emit("stop_typing", {
                    conversationId: currentConversationId,
                    senderId: myId,
                });
            }
        }, 1500);
    });

    const scrollToBottomSmooth = () => {
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight,
                behavior: "smooth"
            });
        }
    };
    window.scrollToBottomSmooth = scrollToBottomSmooth;

    const scrollToBottomInstant = () => {
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    };
    window.scrollToBottomInstant = scrollToBottomInstant;

    // Khi người dùng bấm click vào ô nhập (Focus) -> thu gọn menu trái để nhường chỗ
    messageInput.addEventListener("focus", function() {
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.add('is-typing');
        if (typeof closeEmojiPicker === "function") closeEmojiPicker();

        // Trên mobile: KHÔNG tự gọi scrollToBottomInstant ở đây nữa.
        // Việc neo cuộn đã được visualViewport 'resize' (debounce 120ms) đảm nhiệm
        // sau khi bàn phím lên xong hẳn, tránh 2 nguồn gọi chồng chéo.
        if (window.innerWidth > 768) {
            scrollToBottomSmooth();
        }
    });

    // Đảm bảo click/tap vào ô nhập cũng lập tức thu gọn menu chức năng trái
    messageInput.addEventListener("click", function() {
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.add('is-typing');
        if (window.innerWidth > 768) {
            scrollToBottomSmooth();
        }
    });

    // Khi người dùng bấm ra ngoài (Blur) -> hiển thị lại menu trái nếu ô nhập trống
    messageInput.addEventListener("blur", function() {
        const inputArea = document.getElementById('input-area');
        if (this.value.trim().length === 0) {
            if (inputArea) inputArea.classList.remove('is-typing');
        }
        // Việc trả viewport về vị trí gốc đã do 'focusout' + visualViewport lo,
        // không cần window.scrollTo thủ công ở đây nữa.
    });

    // Tự động tắt bàn phím khi bấm vào vùng trống bất kỳ trên trang (giống Messenger)
    const dismissKeyboard = (e) => {
        const messageInput = document.getElementById("message-input");
        if (!messageInput || document.activeElement !== messageInput) return;
        
        // Tránh ẩn bàn phím nếu bấm vào các thẻ nhập liệu, nút bấm hoặc các bảng tùy chọn
        if (e.target.closest('a, button, input, textarea, .reaction-palette, .more-menu, #input-area, #emoji-picker-panel')) return;
        
        messageInput.blur();
    };

    document.addEventListener("click", dismissKeyboard);
}

// Xử lý nút mũi tên mở rộng lại cụm ảnh/file khi đang gõ
const expandBtnUI = document.getElementById('expand-btn');
if (expandBtnUI) {
    const handleExpand = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const inputArea = document.getElementById('input-area');
        if (inputArea) {
            inputArea.classList.remove('is-typing');
        }
        // Giữ tiêu điểm (focus) vào input để bàn phím không bị ẩn
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.focus();
        }
    };

    expandBtnUI.addEventListener('click', handleExpand);
    expandBtnUI.addEventListener('mousedown', handleExpand);
    expandBtnUI.addEventListener('touchstart', handleExpand, { passive: false });
}

// 10. Đóng khung trò chuyện trên di động
function closeChatMobile() {
    if (typeof hideMobileOverlay === "function") hideMobileOverlay(); // 🌟 Giải phóng các lớp phủ khoá click khi đóng màn hình chat
    document.getElementById("chat-screen").classList.remove("mobile-chat-active");
    document.body.classList.remove("mobile-chat-active");
    document.documentElement.style.removeProperty('--vv-height');
    document.documentElement.style.removeProperty('--vv-offset');
    document.documentElement.style.removeProperty('--keyboard-shift');
    
    // Gửi sự kiện đóng phòng chat lên Flutter native
    if (window.FlutterHeaderChannel) {
        window.FlutterHeaderChannel.postMessage(JSON.stringify({ event: 'close_chat' }));
    }

    // Trả header lại vào trong .chat-window để hiển thị bình thường trên desktop
    const mobileHeader = document.getElementById("chat-header-container");
    const mobileChatWindow = document.querySelector(".chat-window");
    if (mobileHeader && mobileChatWindow) {
        mobileChatWindow.insertBefore(mobileHeader, mobileChatWindow.firstChild);
    }
}

// 7. Sự kiện Gửi Hình ảnh
const imageUploadInput = document.getElementById("image-upload");
if (imageUploadInput) {
    imageUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Đang xử lý và nén ảnh...");
            const compressedBase64 = await compressImage(file, 1200, 1200, 0.85);
            hideLoading();
            sendMessage(compressedBase64);
        } catch (err) {
            console.error("Lỗi nén ảnh:", err);
            hideLoading();
            // Fallback gửi ảnh gốc nếu lỗi nén
            const reader = new FileReader();
            reader.onload = function(event) {
                sendMessage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Sự kiện Chụp và gửi hình ảnh qua Camera
const cameraUploadInput = document.getElementById("camera-upload");
if (cameraUploadInput) {
    cameraUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Đang xử lý và nén ảnh...");
            const compressedBase64 = await compressImage(file, 1200, 1200, 0.85);
            hideLoading();
            sendMessage(compressedBase64);
        } catch (err) {
            console.error("Lỗi nén ảnh từ camera:", err);
            hideLoading();
            // Fallback gửi ảnh gốc nếu lỗi nén
            const reader = new FileReader();
            reader.onload = function(event) {
                sendMessage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
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
// 9. Sự kiện Tải lên Avatar Mới
const avatarUploadInput = document.getElementById("avatar-upload");
if (avatarUploadInput) {
    avatarUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Đang xử lý và nén ảnh...");
            // Nén ảnh avatar xuống max 150x150 JPEG quality 0.8 (~15KB)
            const compressedBase64 = await compressImage(file, 150, 150, 0.8);

            const res = await fetch(`${API_URL}/users/avatar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ avatar: compressedBase64 }),
            });

            const data = await res.json();
            hideLoading();
            if (data.success) {
                // Tải lại ảnh bằng URL tĩnh mới (với cache buster)
                const avatarUrlWithVersion = `${data.avatarUrl}`;
                document.getElementById("my-avatar").src = avatarUrlWithVersion;
                if (document.getElementById("my-avatar-profile"))
                    document.getElementById("my-avatar-profile").src = avatarUrlWithVersion;
                if (document.getElementById("my-avatar-personal-tab"))
                    document.getElementById("my-avatar-personal-tab").src = avatarUrlWithVersion;
                showTempToast("Đã cập nhật ảnh đại diện mới thành công!");
            } else {
                alert("Lỗi tải ảnh: " + data.message);
            }
        } catch (error) {
            hideLoading();
            alert("Lỗi hệ thống khi tải ảnh lên!");
        }
    });
}

// 11. Thu hồi tin nhắn
async function recallMessage(messageId) {
    const consent = await customConfirm("Thu hồi tin nhắn", "Bạn có chắc chắn muốn thu hồi tin nhắn này không?", "Thu hồi", "Hủy", true);
    if (!consent) return;

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

// Biến lưu ID tin nhắn đang thực hiện xóa
let messageIdToDelete = null;

// Mở modal xác nhận xóa ở phía tôi
function openDeleteMessageMeModal(messageId) {
    messageIdToDelete = messageId;
    const modal = document.getElementById("delete-message-me-modal");
    if (!modal) return;
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

// Đóng modal xác nhận xóa ở phía tôi
function closeDeleteMessageMeModal() {
    const modal = document.getElementById("delete-message-me-modal");
    if (!modal) return;
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
        messageIdToDelete = null;
    }, 250);
}

// Gọi API và cập nhật DOM, bộ nhớ tạm
async function deleteMessageForMe(messageId) {
    closeDeleteMessageMeModal();
    try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/me`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();
        if (data.success) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (msgEl) {
                msgEl.remove();
            }
            // Cập nhật mảng currentChatMessages ở frontend
            currentChatMessages = currentChatMessages.filter(m => m.id !== messageId);
        } else {
            alert("Lỗi khi xóa tin nhắn: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối khi xóa tin nhắn: " + error.message);
    }
}

// 12. Gửi cảm xúc vào tin nhắn (Cập nhật Optimistic UI cho trải nghiệm tức thì)
async function reactToMessage(messageId, reaction) {
    ChatSounds.playReact();
    
    const msgEl = document.getElementById(`msg-${messageId}`);
    let oldReactions = null;
    
    if (msgEl) {
        // Lưu trữ trạng thái cũ để hoàn tác (revert) nếu xảy ra lỗi mạng/API
        oldReactions = msgEl.dataset.reactions ? JSON.parse(msgEl.dataset.reactions) : {};
        let reactions = { ...oldReactions };
        const wasReactedWithSame = reactions[myId] === reaction;

        // Cập nhật trạng thái mới ngay lập tức trên UI
        if (wasReactedWithSame) {
            delete reactions[myId];
        } else {
            reactions[myId] = reaction;
        }

        // Render giao diện mới ngay lập tức
        renderReactions(msgEl, reactions);

        // Hiệu ứng nổ hạt cảm xúc tức thì
        if (!wasReactedWithSame) {
            createReactionBurst(messageId, reaction);
        }
    }

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
            // Hoàn tác (Revert) lại trạng thái cũ do API báo lỗi
            if (msgEl && oldReactions) renderReactions(msgEl, oldReactions);
            alert("Lỗi gửi cảm xúc: " + data.message);
        }
    } catch (error) {
        // Hoàn tác (Revert) lại trạng thái cũ do lỗi kết nối mạng
        if (msgEl && oldReactions) renderReactions(msgEl, oldReactions);
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

    // Lưu trữ cảm xúc vào dataset của phần tử tin nhắn chính để so sánh sau này
    const msgEl = content.closest(".message");
    if (msgEl) {
        msgEl.dataset.reactions = JSON.stringify(reactions || {});
    }

    let reactionsContainer = content.querySelector(".message-reactions");
    if (!reactionsContainer) {
        reactionsContainer = document.createElement("div");
        reactionsContainer.className = "message-reactions";
        content.appendChild(reactionsContainer);
    }

    reactionsContainer.innerHTML = "";
    if (!reactions || Object.keys(reactions).length === 0) {
        reactionsContainer.style.display = "none";
        content.classList.remove("has-reactions");
        return;
    }

    reactionsContainer.style.display = "flex";
    content.classList.add("has-reactions");
    const uniqueEmojis = [...new Set(Object.values(reactions))];
    const count = Object.keys(reactions).length;
    reactionsContainer.innerText = `${uniqueEmojis.join("")} ${count}`;

    // Đăng ký click mở chi tiết cảm xúc giống Messenger
    reactionsContainer.onclick = (e) => {
        e.stopPropagation();
        openReactionsDetailModal(reactions);
    };
}

// --- HIỆU ỨNG NỔ CẢM XÚC GIỐNG MESSENGER ---
function createReactionBurst(messageId, emoji) {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (!msgEl) return;

    const contentEl = msgEl.querySelector(".message-content");
    if (!contentEl) return;

    // Lấy toạ độ bong bóng chat
    const rect = contentEl.getBoundingClientRect();
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) return;
    const containerRect = messagesContainer.getBoundingClientRect();

    // Tính toạ độ xuất phát (ở giữa bong bóng chat) tương đối với khung cuộn tin nhắn
    const startX = rect.left + rect.width / 2 - containerRect.left + messagesContainer.scrollLeft;
    const startY = rect.top + rect.height / 2 - containerRect.top + messagesContainer.scrollTop;

    const PARTICLE_COUNT = 8;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement("div");
        particle.className = "reaction-particle";
        particle.innerText = emoji;

        // Định vị toạ độ ban đầu
        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;

        // Tính toán góc và quãng đường bay ngẫu nhiên (dạng nổ hình tròn)
        const angle = (i * (360 / PARTICLE_COUNT) + Math.random() * 20) * (Math.PI / 180);
        const distance = 40 + Math.random() * 60; // Quãng đường bay xa từ 40px -> 100px
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 10; // Có xu hướng bay lên cao một chút
        const rot = -30 + Math.random() * 60; // Góc tự xoay nhẹ

        particle.style.setProperty("--dx", `${dx}px`);
        particle.style.setProperty("--dy", `${dy}px`);
        particle.style.setProperty("--rot", `${rot}deg`);

        messagesContainer.appendChild(particle);

        // Giải phóng thẻ khỏi DOM sau khi chạy xong animation (750ms)
        setTimeout(() => {
            particle.remove();
        }, 750);
    }
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

function getNicknameForUser(userId, conversationId) {
    if (isSameId(conversationId, currentConversationId) && currentNicknames && currentNicknames[userId]) {
        return currentNicknames[userId];
    }
    const userList = document.getElementById("user-list");
    if (userList) {
        const items = userList.querySelectorAll("li.conversation-item");
        for (const item of items) {
            if (isSameId(item.dataset.conversationId, conversationId)) {
                if (item.dataset.nicknames) {
                    try {
                        const nicks = JSON.parse(item.dataset.nicknames);
                        if (nicks[userId]) return nicks[userId];
                    } catch (e) {}
                }
            }
        }
    }
    return null;
}

function resolveSenderName(msg) {
    const defaultName = (msg.Users && msg.Users.fullName) || "Tin nhắn mới";
    const nick = getNicknameForUser(msg.senderId, msg.conversationId);
    return nick || defaultName;
}

function showNewMessageToast(msg) {
    let container = document.getElementById("top-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "top-toast-container";
        document.body.appendChild(container);
    }

    const sender = msg.Users || {};
    const senderName = resolveSenderName(msg);
    let avatarUrl = sender.avatar ?
        formatUrl(sender.avatar) :
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
    } else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
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
    const senderName = resolveSenderName(msg);

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
    } else if (msg.type === "audio") snippet = "[ Tin nhắn thoại ]";
    else if (
        msg.content &&
        (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
    ) {
        snippet = "[ Hình ảnh ]";
    }

    let avatarUrl = sender.avatar ?
        formatUrl(sender.avatar) :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            senderName,
        )}&background=random`;

    // HIỂN THỊ THÔNG BÁO HỆ THỐNG (SYSTEM NATIVE NOTIFICATION BANNER)
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            // Sử dụng Service Worker (Chuẩn nhất cho di động iOS/Android và tránh bị Chrome Mobile block)
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification(senderName, {
                        body: snippet,
                        icon: avatarUrl,
                        badge: "/icon.png",
                        tag: String(msg.conversationId || "message-notification"),
                        renotify: true
                    });
                });
            } else {
                // Fallback cho trình duyệt Desktop không hỗ trợ SW
                const notification = new Notification(senderName, {
                    body: snippet,
                    icon: avatarUrl,
                });
                notification.onclick = () => {
                    window.focus();
                    startChat(msg.senderId, senderName, avatarUrl);
                    const messagesTabNav = document.querySelector(
                        '.nav-item[title="Tin nhắn"]',
                    );
                    if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
                };
            }
        } catch (err) {
            console.warn("Lỗi khi hiển thị thông báo hệ thống:", err);
            showNewMessageToast(msg);
        }
    } else {
        // Fallback hiện Toast nổi trong app nếu không có quyền/không hỗ trợ thông báo hệ thống
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
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 24, max: 30 }
            },
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
    const overlay = document.getElementById("mobile-action-overlay");
    if (overlay && overlay.classList.contains("show")) {
        const shownAt = parseInt(overlay.dataset.shownAt || "0", 10);
        if (Date.now() - shownAt < 300) {
            return; // Bỏ qua click chuột phát sinh ngay sau khi mở overlay
        }
    }
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

    // Click outside profile modal to close it
    const profileModal = document.getElementById("user-profile-modal");
    if (profileModal) {
        profileModal.addEventListener("click", (e) => {
            if (e.target === profileModal) {
                closeUserProfile();
            }
        });
    }

    const otherProfileModal = document.getElementById("other-user-profile-modal");
    if (otherProfileModal) {
        otherProfileModal.addEventListener("click", (e) => {
            if (e.target === otherProfileModal) {
                closeOtherUserProfileModal();
            }
        });
    }

    const myProfileModal = document.getElementById("my-profile-modal");
    if (myProfileModal) {
        myProfileModal.addEventListener("click", (e) => {
            if (e.target === myProfileModal) {
                closeMyProfileModal();
            }
        });
    }

    const settingsModal = document.getElementById("tab-settings-modal");
    if (settingsModal) {
        settingsModal.addEventListener("click", (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // Thiết lập sự kiện cho modal Xóa tin nhắn ở phía tôi
    const deleteMeModal = document.getElementById("delete-message-me-modal");
    const deleteMeCancelBtn = document.getElementById("delete-message-me-cancel-btn");
    const deleteMeConfirmBtn = document.getElementById("delete-message-me-confirm-btn");

    if (deleteMeModal && deleteMeCancelBtn && deleteMeConfirmBtn) {
        deleteMeCancelBtn.onclick = () => {
            closeDeleteMessageMeModal();
        };

        deleteMeConfirmBtn.onclick = async () => {
            if (messageIdToDelete) {
                await deleteMessageForMe(messageIdToDelete);
            }
        };

        deleteMeModal.addEventListener("click", (e) => {
            if (e.target === deleteMeModal) {
                closeDeleteMessageMeModal();
            }
        });
    }

    // Click outside notifications dropdown to close it
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("notifications-dropdown");
        const bellBtn = document.getElementById("bell-notifications-btn");
        const mobileBellBtn = document.getElementById("mobile-bell-btn");
        if (dropdown && dropdown.classList.contains("active")) {
            const isClickInsideBell = (bellBtn && (e.target === bellBtn || bellBtn.contains(e.target))) ||
                (mobileBellBtn && (e.target === mobileBellBtn || mobileBellBtn.contains(e.target)));
            if (!dropdown.contains(e.target) && !isClickInsideBell) {
                dropdown.classList.remove("active");
            }
        }

        // Tự động đóng và xóa nội dung tìm kiếm khi click ra ngoài
        const searchResults = document.getElementById("search-results");
        const searchInput = document.getElementById("search-input");
        const mobileSearchInput = document.getElementById("mobile-search-input");
        if (searchResults && searchResults.style.display !== "none") {
            const isClickInsideSearch = (searchInput && (e.target === searchInput || searchInput.contains(e.target))) ||
                (mobileSearchInput && (e.target === mobileSearchInput || mobileSearchInput.contains(e.target)));
            if (!searchResults.contains(e.target) && !isClickInsideSearch) {
                clearAndHideSearch();
            }
        }
    });

    // Tự động đồng bộ vị trí slider-pill khi sidebar hiển thị hoặc thay đổi kích thước (Fix lỗi tab ẩn/tàng hình khi load app)
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
        const resizeObserver = new ResizeObserver(() => {
            const pill = document.getElementById('nav-slider-pill');
            const activeItem = sidebarEl.querySelector('.nav-item.active');
            if (pill && activeItem && window.innerWidth <= 768) {
                const sidebarRect = sidebarEl.getBoundingClientRect();
                const itemRect = activeItem.getBoundingClientRect();
                if (itemRect.width > 0) {
                    const originalTransition = pill.style.transition;
                    pill.style.transition = 'none';
                    pill.style.left = (itemRect.left - sidebarRect.left) + 'px';
                    pill.style.width = itemRect.width + 'px';
                    setTimeout(() => {
                        pill.style.transition = originalTransition;
                    }, 50);
                }
            }
        });
        resizeObserver.observe(sidebarEl);
    }
});

function openMyProfileModal() {
    const modal = document.getElementById("my-profile-modal");
    if (modal) {
        modal.classList.add("active");
    }
}

function closeMyProfileModal() {
    const modal = document.getElementById("my-profile-modal");
    if (modal) {
        modal.classList.remove("active");
    }
}

function openSettingsModal() {
    const modal = document.getElementById("tab-settings-modal");
    if (modal) {
        modal.classList.add("active");
        updateMediaDevicesList();
        updateNotificationPermissionUI();
    }
}

function closeSettingsModal() {
    const modal = document.getElementById("tab-settings-modal");
    if (modal) {
        modal.classList.remove("active");
    }
}

function toggleNotificationsDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById("notifications-dropdown");
    if (dropdown) {
        const isActive = dropdown.classList.toggle("active");
        if (isActive) {
            loadNotifications();
            // Đóng các modal khác cho gọn
            const myProfileModal = document.getElementById("my-profile-modal");
            if (myProfileModal) myProfileModal.classList.remove("active");
            const settingsModal = document.getElementById("tab-settings-modal");
            if (settingsModal) settingsModal.classList.remove("active");
        }
    }
}

async function markAllNotificationsAsRead() {
    let hasUnread = false;
    notificationsList.forEach(n => {
        if (!n.isRead) {
            n.isRead = true;
            hasUnread = true;
        }
    });
    if (hasUnread) {
        updateNotificationBadge();
        renderNotifications();
        try {
            await fetch(`${API_URL}/users/notifications/read-all`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (e) {
            console.error("Lỗi đánh dấu đã đọc tất cả:", e);
        }
    }
}

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
    // Cập nhật lại màu nền chủ đề chat tương ứng với chế độ sáng/tối mới
    if (typeof applyChatTheme === "function") {
        applyChatTheme(currentChatTheme);
    }
}

// =========================================
// TÍNH NĂNG MỚI: LIGHTBOX (XEM ẢNH PHÓNG TO)
// =========================================

function openLightbox(src) {
    const overlay = document.getElementById("mobile-action-overlay");
    if (overlay && overlay.classList.contains("show")) {
        return; // Đang hiện menu phản hồi di động, không kích hoạt xem ảnh!
    }

    const lightbox = document.getElementById("image-lightbox");
    const img = document.getElementById("lightbox-img");

    if (lightbox && img) {
        img.src = src;
        lightbox.style.display = "flex";

        // Ẩn khu vực tin nhắn để emoji/reaction không lọt lên trên lightbox
        // (do transform trên .message tạo stacking context riêng)
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) messagesDiv.style.visibility = "hidden";
        const chatHeader = document.querySelector(".chat-header");
        if (chatHeader) chatHeader.style.visibility = "hidden";
        const inputArea = document.getElementById("input-area");
        if (inputArea) inputArea.style.visibility = "hidden";

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

            // Khôi phục lại khu vực tin nhắn
            const messagesDiv = document.getElementById("messages");
            if (messagesDiv) messagesDiv.style.visibility = "";
            const chatHeader = document.querySelector(".chat-header");
            if (chatHeader) chatHeader.style.visibility = "";
            const inputArea = document.getElementById("input-area");
            if (inputArea) inputArea.style.visibility = "";
        }, 300);
    }
}

// --- XỬ LÝ HỒ SƠ NGƯỜI DÙNG (USER PROFILE MODAL) ---
async function showUserProfile(userId) {
    return openOtherUserProfileModal(userId);
}

async function openOtherUserProfileModal(userId) {
    if (!userId) return;
    try {
        showLoading("Đang tải hồ sơ...");
        const res = await fetch(`${API_URL}/users/${userId}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "Không thể tải thông tin hồ sơ.");
        }
        const user = await res.json();

        const modal = document.getElementById("other-user-profile-modal");
        if (!modal) return;

        // Cập nhật DOM
        const coverImg = modal.querySelector(".profile-cover-banner img");
        const avatarImg = modal.querySelector(".profile-avatar-circle img");
        const statusDot = modal.querySelector(".profile-avatar-circle .profile-status-dot");
        const nameEl = modal.querySelector(".profile-name");
        const bioEl = modal.querySelector(".profile-status-text");

        if (coverImg) coverImg.src = formatUrl(user.coverPhotoGroupUrl) + `?v=${Date.now()}`;
        if (avatarImg) avatarImg.src = formatUrl(user.profileAvatarUrl) + `?v=${Date.now()}`;

        if (statusDot) {
            statusDot.className = `profile-status-dot ${user.status}`;
            statusDot.title = user.status === "online" ? "Đang hoạt động" : "Ngoại tuyến";
        }

        if (nameEl) nameEl.innerText = user.name || "Người dùng";
        if (bioEl) bioEl.innerText = user.bio || "Chưa có tiểu sử";

        // Gán sự kiện click cho các nút hành động
        const chatBtn = modal.querySelector(".profile-action-item.btn-chat");
        const callBtn = modal.querySelector(".profile-action-item.btn-call");
        const videoBtn = modal.querySelector(".profile-action-item.btn-video");

        if (chatBtn) {
            chatBtn.onclick = () => {
                closeOtherUserProfileModal();
                startChat(user.id, user.name, formatUrl(user.profileAvatarUrl));
                const messagesTabNav = document.querySelector('.nav-item[title="Tin nhắn"]');
                if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
            };
        }

        if (callBtn) {
            callBtn.onclick = async() => {
                closeOtherUserProfileModal();
                await startChat(user.id, user.name, formatUrl(user.profileAvatarUrl));
                startCall("voice");
            };
        }

        if (videoBtn) {
            videoBtn.onclick = async() => {
                closeOtherUserProfileModal();
                await startChat(user.id, user.name, formatUrl(user.profileAvatarUrl));
                startCall("video");
            };
        }

        modal.classList.add("active");
    } catch (error) {
        alert("Lỗi tải hồ sơ người dùng: " + error.message);
    } finally {
        hideLoading();
    }
}

function closeOtherUserProfileModal() {
    const modal = document.getElementById("other-user-profile-modal");
    if (modal) {
        modal.classList.remove("active");
    }
}

function closeUserProfile() {
    const modal = document.getElementById("user-profile-modal");
    if (modal) {
        modal.classList.remove("active");
    }
}


// Biến cờ khóa chống spam click (Đã tối ưu hóa sang kiểm tra active để phản hồi ngay lập tức)
let isSwitchingTab = false;

// Chuyển đổi giữa các Tab
function switchTab(tabId, navElement) {
    if (typeof hideMobileOverlay === "function") hideMobileOverlay(); // 🌟 Giải phóng các lớp phủ khoá click khi chuyển tab
    // Nếu tab đã hiển thị sẵn rồi thì không làm gì (Tránh render lại dư thừa)
    const targetTab = document.getElementById(tabId);
    if (targetTab && targetTab.classList.contains("active")) return;

    // Phát âm thanh click ngắn khi chuyển tab thành công
    if (typeof tabClickSound !== "undefined" && tabClickSound) {
        tabClickSound.currentTime = 0;
        tabClickSound.play().catch(err => console.log("Âm thanh bị chặn phát tự động bởi trình duyệt:", err));
    }

    if (tabId === "tab-contacts") {
        navElement.classList.remove("shake");
    }
    if (tabId === "tab-settings") {
        updateMediaDevicesList();
        updateNotificationPermissionUI();
    }

    if (tabId === "tab-news" && !newsListLoaded) {
        loadInitialNews();
    }



    document
        .querySelectorAll(".tab-pane")
        .forEach((tab) => tab.classList.remove("active"));
    document
        .querySelectorAll(".nav-item")
        .forEach((nav) => nav.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    navElement.classList.add("active");

    // ── Trượt pill indicator ──
    const pill = document.getElementById('nav-slider-pill');
    if (pill && navElement && window.innerWidth <= 768) {
        const sidebar = navElement.closest('.sidebar');
        if (sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();
            const itemRect = navElement.getBoundingClientRect();
            if (itemRect.width > 0) {
                pill.style.left = (itemRect.left - sidebarRect.left) + 'px';
                pill.style.width = itemRect.width + 'px';
            }
        }
    }

    // ── Ripple effect khi chạm ──
    const ripple = document.createElement('span');
    ripple.classList.add('nav-ripple');
    const size = 30;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    ripple.style.marginLeft = ripple.style.marginTop = -(size / 2) + 'px';
    navElement.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
    // Khởi tạo/cập nhật thông tin chào mừng của tab AI
    if (tabId === "tab-ai") {
        const welcomeTitle = document.getElementById("ai-welcome-title");
        if (welcomeTitle) {
            welcomeTitle.innerText = `Hôm nay bạn thế nào, ${myUsername || "bạn"}?`;
        }
        loadAiChatHistory();
        updateAiQuotaBar(); // Cập nhật thanh hạn ngạch AI
    }

    // Xử lý ẩn/hiển thị mobile-header (thanh tìm kiếm trên mobile) khi đổi tab
    const mobileHeader = document.getElementById("mobile-header");
    if (mobileHeader) {
        if (tabId === "tab-messages") {
            mobileHeader.style.setProperty("display", "", "important");
        } else {
            mobileHeader.style.setProperty("display", "none", "important");
        }
    }

}

let isFetchingAiHistory = false;
// Tải lịch sử chat AI lưu trữ từ Database
async function loadAiChatHistory() {
    const welcomeEl = document.getElementById("ai-welcome-screen");
    const wrapperEl = document.getElementById("ai-chat-messages-wrapper");
    if (!wrapperEl) return;

    if (isFetchingAiHistory) return;
    isFetchingAiHistory = true;

    try {
        const res = await fetch("/api/ai/chat/history", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        const data = res.ok ? await res.json() : null;

        if (res.ok && data && data.success && data.messages && data.messages.length > 0) {
            if (welcomeEl) welcomeEl.style.display = "none";
            wrapperEl.style.display = "flex";
            wrapperEl.innerHTML = "";

            data.messages.forEach(msg => {
                const isUser = msg.role === "user";
                const avatarHtml = isUser ?
                    "" :
                    `<div class="ai-avatar">
                         <img src="tho_fi_logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='logo.jpg'" />
                       </div>`;

                const bubbleHtml = isUser ?
                    escapeHTML(msg.content) :
                    formatAiResponse(msg.content);

                const msgHtml = `
                  <div class="ai-message ${isUser ? 'ai-user' : 'ai-bot'}">
                    ${avatarHtml}
                    <div class="ai-bubble">${bubbleHtml}</div>
                  </div>
                `;
                wrapperEl.insertAdjacentHTML("beforeend", msgHtml);
            });

            // Cuộn xuống cuối
            scrollAiToBottom();
        } else {
            if (welcomeEl) welcomeEl.style.display = "flex";
            wrapperEl.style.display = "none";
            wrapperEl.innerHTML = "";
        }
    } catch (err) {
        console.error("Lỗi khi tải lịch sử chat AI:", err);
    } finally {
        isFetchingAiHistory = false;
    }
}

// Cuộn mượt và chính xác xuống cuối màn hình chat AI sau khi vẽ DOM xong
function scrollAiToBottom() {
    const historyEl = document.getElementById("ai-chat-history");
    if (!historyEl) return;
    // Sử dụng cả requestAnimationFrame và setTimeout để bảo đảm tương thích tốt nhất trên iOS/Android
    requestAnimationFrame(() => {
        historyEl.scrollTop = historyEl.scrollHeight;
        setTimeout(() => {
            historyEl.scrollTop = historyEl.scrollHeight;
        }, 50);
    });
}

// Reset cuộc hội thoại AI về màn hình chào mừng ban đầu
function resetAiChat() {
    const welcomeEl = document.getElementById("ai-welcome-screen");
    const wrapperEl = document.getElementById("ai-chat-messages-wrapper");
    const inputEl = document.getElementById("ai-message-input");

    if (welcomeEl) welcomeEl.style.display = "flex";
    if (wrapperEl) {
        wrapperEl.style.display = "none";
        wrapperEl.innerHTML = "";
    }
    if (inputEl) inputEl.value = "";

    // Gửi yêu cầu xóa lịch sử lưu trên RAM của server
    fetch("/api/ai/chat/history", {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    }).catch(err => console.error("Lỗi khi xóa lịch sử chat AI:", err));
}

// Gửi tin nhắn đến Gemini AI
async function sendAiMessage() {
    const inputEl = document.getElementById("ai-message-input");
    if (!inputEl) return;
    const prompt = inputEl.value.trim();
    if (!prompt) return;

    inputEl.value = "";

    const welcomeEl = document.getElementById("ai-welcome-screen");
    const wrapperEl = document.getElementById("ai-chat-messages-wrapper");
    if (welcomeEl) welcomeEl.style.display = "none";
    if (wrapperEl) wrapperEl.style.display = "flex";

    const historyEl = document.getElementById("ai-chat-history");
    if (!historyEl) return;

    // Hiển thị tin nhắn người dùng (phong cách tối giản/không avatar giống mockup)
    const userMsgHtml = `
      <div class="ai-message ai-user">
        <div class="ai-bubble">${escapeHTML(prompt)}</div>
      </div>
    `;
    wrapperEl.insertAdjacentHTML("beforeend", userMsgHtml);
    scrollAiToBottom();

    // Tạo ID duy nhất cho bong bóng tin nhắn của AI bot này
    const botMsgId = "ai-msg-" + Date.now();

    // Hiển thị bong bóng "Đang suy nghĩ..." với ảnh logo làm avatar
    const typingHtml = `
      <div class="ai-message ai-bot" id="${botMsgId}">
        <div class="ai-avatar">
          <img src="tho_fi_logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='logo.jpg'" />
        </div>
        <div class="ai-bubble" id="${botMsgId}-bubble">
          <div class="ai-typing-indicator" id="${botMsgId}-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;
    wrapperEl.insertAdjacentHTML("beforeend", typingHtml);
    scrollAiToBottom();

    try {
        const response = await fetch("/api/ai/chat/stream", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            let errorMsg = "Không thể kết nối hoặc tải phản hồi từ Gemini. Vui lòng thử lại sau!";
            if (response.status === 429) {
                errorMsg = "Tài khoản AI đã hết hạn ngạch (Token) hôm nay. Vui lòng thử lại sau hoặc cấu hình API Key mới!";
            } else {
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errorMsg = errData.error;
                } catch (e) {}
            }
            throw new Error(errorMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        // Nhận stream dữ liệu từ server
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // giữ phần tin nhắn chưa đầy đủ

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.text) {
                        // Xóa typing indicator ở chunk đầu tiên nhận được
                        const indicator = document.getElementById(`${botMsgId}-indicator`);
                        if (indicator) indicator.remove();

                        fullText += data.text;
                        const bubbleEl = document.getElementById(`${botMsgId}-bubble`);
                        if (bubbleEl) {
                            bubbleEl.innerHTML = formatAiResponse(fullText);
                        }
                        scrollAiToBottom();
                    }
                    if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (e) {
                    // Nếu lỗi do throw Error(data.error) tự định nghĩa ở trên thì chuyển tiếp ra ngoài catch chính
                    if (e.message && (e.message.includes("⚠️") || e.message.includes("hạn ngạch") || e.message.includes("Lỗi:"))) {
                        throw e;
                    }
                    console.error("Lỗi xử lý chunk stream:", e);
                }
            }
        }

        // Tăng số lượt gọi AI thành công lên 1
        incrementAiRequestCount();
    } catch (error) {
        // Xóa indicator nếu có lỗi xảy ra
        const indicator = document.getElementById(`${botMsgId}-indicator`);
        if (indicator) indicator.remove();

        const bubbleEl = document.getElementById(`${botMsgId}-bubble`);
        if (bubbleEl) {
            const msg = error.message || "Không thể kết nối hoặc tải phản hồi từ Gemini. Vui lòng thử lại sau!";
            bubbleEl.innerHTML = `
                <span style="color: #ef4444; font-weight: 500;">
                    ❌ ${msg.startsWith("Lỗi:") || msg.startsWith("⚠️") ? msg : `Lỗi: ${msg}`}
                </span>
            `;

            // Nếu lỗi do hết hạn ngạch hoặc token
            if (msg.includes("hạn ngạch") || msg.includes("Token") || msg.includes("429") || msg.includes("limit") || msg.includes("quota")) {
                updateAiQuotaBar(true); // Bắt buộc set thanh quota lên 100%
            }
        }
    }

    scrollAiToBottom();
}

// Định dạng văn bản trả về từ AI (chuyển đổi code, bold, list, heading, newline thành HTML)
function formatAiResponse(text) {
    if (!text) return "";
    let formatted = escapeHTML(text);
    const codeBlocks = [];

    // 1. Trích xuất và định dạng các khối code blocks trước
    formatted = formatted.replace(/```(\w+)?\s*\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang ? lang.trim() : "code";
        const displayCode = code.trim();
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;

        const codeBlockHtml = `
        <div class="ai-code-wrapper">
          <div class="ai-code-header">
            <span class="ai-code-header-lang">${language}</span>
            <button class="ai-code-copy-btn" onclick="copyCodeText(this)">
              <i class="fa-regular fa-copy"></i> Sao chép
            </button>
          </div>
          <div class="ai-code-block">
            <pre>${displayCode}</pre>
          </div>
        </div>`.trim();

        codeBlocks.push(codeBlockHtml);
        return placeholder;
    });

    // 2. Tách văn bản theo từng dòng để xử lý chính xác danh sách (ul/ol) và tiêu đề (h1-h6)
    const lines = formatted.split("\n");
    const resultLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Kiểm tra dòng có phải là tiêu đề Markdown không (bắt đầu bằng # và khoảng trắng)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        // Kiểm tra dòng có phải là phần tử danh sách không (bắt đầu bằng * hoặc - hoặc + và khoảng trắng)
        const listMatch = line.match(/^\s*[\-\*\+]\s+(.+)$/);

        if (headingMatch) {
            if (inList) {
                resultLines.push('</ul>');
                inList = false;
            }
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            let formattedContent = content
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); color: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

            // Định nghĩa kích thước font chữ và lề tương ứng cho từng cấp độ tiêu đề
            let fontSize = "15px";
            let marginTop = "12px";
            let marginBottom = "6px";
            if (level === 1) { fontSize = "20px"; marginTop = "18px"; marginBottom = "10px"; }
            else if (level === 2) { fontSize = "17px"; marginTop = "16px"; marginBottom = "8px"; }
            else if (level === 3) { fontSize = "15px"; marginTop = "14px"; marginBottom = "6px"; }

            resultLines.push(`<h${level} style="font-size: ${fontSize}; margin-top: ${marginTop}; margin-bottom: ${marginBottom}; font-weight: 600; line-height: 1.35; color: var(--text-dark); display: block;">${formattedContent}</h${level}>`);
        } else if (listMatch) {
            const content = listMatch[1];
            // Định dạng inline bold và inline code cho nội dung li trước
            let formattedContent = content
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); color: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

            if (!inList) {
                resultLines.push('<ul style="margin: 6px 0; padding-left: 20px; list-style-type: disc;">');
                inList = true;
            }
            resultLines.push(`<li style="margin-bottom: 4px; line-height: 1.5; color: var(--text-dark);">${formattedContent}</li>`);
        } else {
            if (inList) {
                resultLines.push('</ul>');
                inList = false;
            }

            // Định dạng inline bold và inline code cho các dòng thường
            let formattedLine = line
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); color: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

            resultLines.push(formattedLine);
        }
    }

    // Nếu kết thúc chuỗi vẫn đang ở trong thẻ ul thì đóng lại
    if (inList) {
        resultLines.push('</ul>');
    }

    // Nối các dòng lại, với các dòng không phải là ul/li/heading thì dùng <br> để xuống dòng
    // Tránh thêm <br> sau các thẻ <ul>, </ul>, <li>, </li>, <h1-6>
    let finalHtml = "";
    for (let i = 0; i < resultLines.length; i++) {
        const curr = resultLines[i];
        const next = resultLines[i + 1] || "";

        finalHtml += curr;

        // Thêm <br> nếu dòng hiện tại và dòng tiếp theo không phải là thẻ ul/li/heading hoặc trống
        const isCurrTag = curr.startsWith("<ul") || curr.startsWith("</ul>") || curr.startsWith("<li") || curr.startsWith("</li>") || curr.startsWith("<h");
        const isNextTag = next.startsWith("<ul") || next.startsWith("</ul>") || next.startsWith("<li") || next.startsWith("</li>") || next.startsWith("<h");

        if (i < resultLines.length - 1 && !isCurrTag && !isNextTag) {
            finalHtml += "<br>";
        }
    }

    // 3. Khôi phục các khối code blocks
    codeBlocks.forEach((codeBlockHtml, index) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${index}__`;
        finalHtml = finalHtml.split(placeholder).join(codeBlockHtml);
    });

    return finalHtml;
}

// Hàm sao chép code vào clipboard
function copyCodeText(btn) {
    const wrapper = btn.closest(".ai-code-wrapper");
    if (!wrapper) return;
    const pre = wrapper.querySelector("pre");
    if (!pre) return;

    const codeText = pre.textContent || pre.innerText;

    navigator.clipboard.writeText(codeText).then(() => {
        const origHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check" style="color: #10B981;"></i> Đã chép`;
        setTimeout(() => {
            btn.innerHTML = origHtml;
        }, 2000);
    }).catch(err => {
        console.error("Lỗi sao chép code:", err);
    });
}

// Đăng xuất
async function logout() {
    const consent = await customConfirm("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?", "Đăng xuất", "Hủy", true);
    if (!consent) return;

    localStorage.removeItem("authToken");
    token = "";
    myId = "";
    myName = "";
    myUsername = "";
    currentConversationId = "";
    currentChatPartnerId = null;

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    document.getElementById("chat-screen").style.display = "none";
    document.getElementById("chat-screen").classList.remove("mobile-chat-active");
    document.body.classList.remove("mobile-chat-active");
    
    // Trả header lại vào trong .chat-window để hiển thị bình thường trên desktop
    const mobileHeader = document.getElementById("chat-header-container");
    const mobileChatWindow = document.querySelector(".chat-window");
    if (mobileHeader && mobileChatWindow) {
        mobileChatWindow.insertBefore(mobileHeader, mobileChatWindow.firstChild);
    }
    // Ẩn Tab Bar (đã chuyển ra ngoài #chat-screen)
    const tabBarLogout = document.getElementById("main-tab-bar");
    if (tabBarLogout) tabBarLogout.style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";

    document.getElementById("login-password").value = "";

    const defaultTab = document.querySelector('.sidebar .nav-item') || document.querySelector('.nav-item[title="Tin nhắn"]');
    if (defaultTab) switchTab("tab-messages", defaultTab);

    // ── Khởi tạo pill đúng vị trí ngay khi load (không có animation) ──
    setTimeout(() => {
        const pill = document.getElementById('nav-slider-pill');
        const activeItem = document.querySelector('.sidebar .nav-item.active');
        if (pill && activeItem && window.innerWidth <= 768) {
            const sidebar = activeItem.closest('.sidebar');
            const sidebarRect = sidebar.getBoundingClientRect();
            const itemRect = activeItem.getBoundingClientRect();
            pill.style.transition = 'none';
            pill.style.left = (itemRect.left - sidebarRect.left) + 'px';
            pill.style.width = itemRect.width + 'px';
            setTimeout(() => { pill.style.transition = ''; }, 50);
        }
    }, 300);
}

// Cập nhật Ảnh bìa (Cover Image)
const coverUploadInput = document.getElementById("cover-upload");
if (coverUploadInput) {
    coverUploadInput.addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Đang xử lý và nén ảnh bìa...");
            // Nén ảnh bìa xuống max 800x400 JPEG quality 0.8 (~60KB)
            const compressedBase64 = await compressImage(file, 800, 400, 0.8);

            const res = await fetch(`${API_URL}/users/cover`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ coverPhoto: compressedBase64 }),
            });

            const data = await res.json();
            hideLoading();
            if (data.success) {
                const coverUrlWithVersion = `${data.coverUrl}`;
                document.getElementById("my-cover").src = coverUrlWithVersion;
                showTempToast("Đã cập nhật ảnh bìa mới thành công!");
            } else {
                alert("Lỗi tải ảnh bìa: " + data.message);
            }
        } catch (error) {
            hideLoading();
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
            if (document.getElementById("my-name-personal-tab"))
                document.getElementById("my-name-personal-tab").innerText = myName;
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
    if (!localStream || !peerConnection) {
        console.warn(
            "Không thể nâng cấp: cuộc gọi chưa kết nối.",
        );
        return;
    }

    if (localStream.getVideoTracks().length > 0) {
        console.log("Đã có video track trong localStream.");
        return;
    }

    try {
        console.log("Đang yêu cầu quyền truy cập camera để nâng cấp...");

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const videoConstraints = {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
            ...(isMobile ? { facingMode: currentFacingMode } : {})
        };
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

let callVibrationActive = false;

function triggerCallVibration() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.vibrate) {
        try {
            // Rung liên tục dài 30 giây (rung 1.2s, nghỉ 0.8s, lặp lại 15 lần)
            navigator.vibrate([
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800,
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800,
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800
            ]);
        } catch (e) {
            console.warn("Lỗi gọi navigator.vibrate:", e);
        }
    }
}

function handleUserInteractionVibrate() {
    if (callVibrationActive) {
        triggerCallVibration();
    }
}

function startVibration() {
    callVibrationActive = true;
    triggerCallVibration();

    // Đăng ký sự kiện chạm màn hình để giải phóng Gesture Lock của trình duyệt và kích hoạt rung ngay lập tức
    document.addEventListener("click", handleUserInteractionVibrate);
    document.addEventListener("touchstart", handleUserInteractionVibrate);

    if (vibrateInterval) clearInterval(vibrateInterval);
    vibrateInterval = setInterval(() => {
        if (callVibrationActive) {
            triggerCallVibration();
        }
    }, 25000); // Lặp lại sau mỗi 25s để phủ kín thời gian đổ chuông nếu chưa bắt máy
}

function stopVibration() {
    callVibrationActive = false;
    document.removeEventListener("click", handleUserInteractionVibrate);
    document.removeEventListener("touchstart", handleUserInteractionVibrate);
    if (vibrateInterval) {
        clearInterval(vibrateInterval);
        vibrateInterval = null;
    }
    if (navigator.vibrate) {
        try {
            navigator.vibrate(0);
        } catch (e) { }
    }
}

function playRingtone() {
    playWebAudio("ringtone", true, 4.5);
}

function stopRingtone() {
    stopWebAudio("ringtone");
}

function playOutgoingRingtone() {
    playWebAudio("dialtone", true, 4.5);
}

function stopOutgoingRingtone() {
    stopWebAudio("dialtone");
}

// 1. Bắt đầu cuộc gọi (Người gọi)
async function startCall(callType) {
    if (!currentChatPartnerId) return alert("Vui lòng chọn một người để gọi.");

    // Phát nhạc chờ cuộc gọi đi đồng bộ ngay lập tức để giữ gesture context trên di động
    playOutgoingRingtone();

    callTypeGlobal = callType;
    currentCallPartnerId = currentChatPartnerId;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Trình duyệt chặn Microphone do bạn không sử dụng HTTPS hoặc Localhost!",
            );
        }

        const selectedMicId = document.getElementById("setting-mic-select")?.value;
        const selectedCamId = document.getElementById("setting-cam-select")?.value;

        const mediaConstraints = {
            audio: {
                noiseSuppression: isNoiseCancellationEnabled,
                echoCancellation: true,
                ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {})
            },
            video: callTypeGlobal === "video" ? {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 24, max: 30 },
                ...(selectedCamId ? { deviceId: { exact: selectedCamId } } : {}),
                ...(isMobile ? { facingMode: currentFacingMode } : {})
            } : false,
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (error) {
            console.warn("Lỗi khi mở luồng Media với constraints gốc:", error);
            // Fallback 1: Nếu yêu cầu video mà không có camera, hãy thử chỉ lấy audio
            if (callTypeGlobal === "video") {
                try {
                    console.log("Thử lại: Yêu cầu cuộc gọi chỉ lấy audio do thiếu camera...");
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            noiseSuppression: isNoiseCancellationEnabled,
                            echoCancellation: true,
                        },
                        video: false
                    });
                    showTempToast("Không tìm thấy Camera. Cuộc gọi tiếp tục ở chế độ chỉ âm thanh.");
                } catch (audioOnlyErr) {
                    console.warn("Thử chỉ lấy audio thất bại:", audioOnlyErr);
                }
            }

            // Fallback 2: Thử lấy cấu hình siêu cơ bản (chỉ audio)
            if (!localStream) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                } catch (fallbackError) {
                    console.error("Lỗi hoàn toàn khi truy cập micro:", fallbackError);
                    if (fallbackError.name === "NotFoundError" || fallbackError.name === "DevicesNotFoundError") {
                        showTempToast("Không tìm thấy Microphone trên máy tính này. Cuộc gọi ở chế độ chỉ nghe.");
                    } else if (fallbackError.name === "NotAllowedError" || fallbackError.name === "PermissionDeniedError") {
                        showTempToast("Trình duyệt bị chặn quyền truy cập Microphone. Vui lòng cấp quyền ở ô địa chỉ!");
                    } else {
                        showTempToast("Không thể kết nối Microphone. Cuộc gọi ở chế độ chỉ nghe.");
                    }
                    localStream = null;
                }
            }
        }

        if (localStream && callTypeGlobal === "video") {
            const localVideo = document.getElementById("local-video");
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.muted = true; // Tránh vọng tiếng
            }
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
        document.body.classList.add("call-active");

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

        // Thiết lập timeout tự động hủy cuộc gọi sau 30 giây nếu đối phương không bắt máy
        if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
        callTimeoutTimer = setTimeout(() => {
            const callModal = document.getElementById("call-modal");
            if (callModal && callModal.style.display === "flex" && !callModal.classList.contains("in-call")) {
                console.log("⏱️ Cuộc gọi hết thời gian chờ phản hồi (30s). Tự động ngắt.");
                showTempToast("Không có phản hồi từ người nhận.");
                endCall(true);
            }
        }, 30000);

    } catch (err) {
        stopOutgoingRingtone();
        console.error("Lỗi trong startCall:", err);
        alert("Không thể thực hiện cuộc gọi: " + err.message);
    }
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
            safeAvatar = formatUrl(callerAvatar);
        } else {
            safeAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                callerName || "User",
            )}&background=random`;
        }

        document.getElementById("call-avatar").src = safeAvatar;
        document.getElementById("call-status").innerText = `${callType === "video" ? "video" : "điện thoại"
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

        document.getElementById("accept-call-btn").onclick = async () => {
            stopVibration();
            stopRingtone();

            // Mở khóa autoplay trình duyệt bằng AudioContext (iOS Safari cần user gesture)
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = ctx.createBuffer(1, 1, 22050);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
                // Đánh dấu remoteAudio sẵn sàng phát khi ontrack gán srcObject
                const remoteAudio = document.getElementById("remote-audio");
                if (remoteAudio) {
                    remoteAudio.muted = false;
                    remoteAudio.volume = 1.0;
                }
                const remoteVideo = document.getElementById("remote-video");
                if (remoteVideo) {
                    remoteVideo.muted = false;
                }
            } catch (e) {
                console.warn("Không thể mở khóa AudioContext:", e);
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
function handleCallRejected(data) {
    stopVibration();
    stopOutgoingRingtone();
    const reason = data ? data.reason : null;
    if (reason === "offline") {
        alert("Người dùng hiện không trực tuyến.");
    } else {
        alert("Người dùng đã từ chối cuộc gọi.");
    }
    endCall(false);
}

// 3. Cuộc gọi được chấp nhận (Người gọi)
async function handleCallAccepted(data) {
    try {
        stopOutgoingRingtone();

        if (callTimeoutTimer) {
            clearTimeout(callTimeoutTimer);
            callTimeoutTimer = null;
        }

        const calleeInfo = data ? data.calleeInfo : null;

        if (calleeInfo) {
            document.getElementById("call-name").innerText =
                calleeInfo.fullName || "Người dùng";

            let avatarUrl;
            if (calleeInfo.avatar && calleeInfo.avatar.trim() !== "") {
                avatarUrl = formatUrl(calleeInfo.avatar);
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
        remoteVideo.play().catch(() => { });
    }
}

// 4. Bắt đầu phiên bản WebRTC
async function startCallSession(isCaller, calleeInfo = null) {
    // Reset hàng đợi candidates khi bắt đầu cuộc gọi mới tránh lẫn candidates cũ
    iceCandidateQueue = [];
    document.getElementById("call-modal").classList.add("in-call");
    document.getElementById("call-status").innerText = "Trong cuộc gọi...";

    document
        .getElementById("incoming-call-actions")
        .setAttribute("style", "display: none !important");
    document
        .getElementById("active-call-actions")
        .setAttribute("style", "display: flex !important");

    try {
        // Để tránh xung đột âm thanh với nhạc chuông (dialtone/ringtone) làm micro bị ngắt/tắt tiếng trên thiết bị di động,
        // chúng tôi luôn tắt và xin cấp lại một localStream mới sạch sẽ ngay khi bắt đầu kết nối.
        if (localStream) {
            try {
                localStream.getTracks().forEach((track) => track.stop());
            } catch (e) {
                console.warn("Lỗi dừng stream cũ:", e);
            }
            localStream = null;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Trình duyệt chặn Microphone do bạn không dùng HTTPS hoặc Localhost!",
            );
        }

        try {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const selectedMicId = document.getElementById("setting-mic-select")?.value;
            const selectedCamId = document.getElementById("setting-cam-select")?.value;

            const mediaConstraints = {
                audio: {
                    noiseSuppression: isNoiseCancellationEnabled,
                    echoCancellation: true,
                    autoGainControl: true, // Kích hoạt tự động tăng âm lượng micro
                    ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {})
                },
                video: callTypeGlobal === "video" ? {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 24, max: 30 },
                    ...(selectedCamId ? { deviceId: { exact: selectedCamId } } : {}),
                    ...(isMobile ? { facingMode: currentFacingMode } : {})
                } : false,
            };

            try {
                localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
            } catch (err) {
                console.warn("Lỗi khi mở luồng Media trong session với constraints gốc:", err);
                // Fallback 1: Nếu yêu cầu video mà không có camera, hãy thử chỉ lấy audio
                if (callTypeGlobal === "video") {
                    try {
                        console.log("Thử lại trong session: Yêu cầu chỉ lấy audio do thiếu camera...");
                        localStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                noiseSuppression: isNoiseCancellationEnabled,
                                echoCancellation: true,
                                autoGainControl: true,
                            },
                            video: false
                        });
                        showTempToast("Không tìm thấy Camera. Thiết lập cuộc gọi ở chế độ chỉ âm thanh.");
                    } catch (audioOnlyErr) {
                        console.warn("Thử chỉ lấy audio trong session thất bại:", audioOnlyErr);
                    }
                }

                // Fallback 2: Thử lấy cấu hình siêu cơ bản (chỉ audio)
                if (!localStream) {
                    try {
                        localStream = await navigator.mediaDevices.getUserMedia({
                            audio: true,
                            video: false
                        });
                    } catch (fallbackErr) {
                        console.error("Lỗi hoàn toàn khi truy cập micro trong session:", fallbackErr);
                        if (fallbackErr.name === "NotFoundError" || fallbackErr.name === "DevicesNotFoundError") {
                            showTempToast("Không tìm thấy Microphone trên máy tính này. Bạn ở chế độ chỉ nghe.");
                        } else if (fallbackErr.name === "NotAllowedError" || fallbackErr.name === "PermissionDeniedError") {
                            showTempToast("Vui lòng cho phép quyền truy cập Microphone trên trình duyệt để nói!");
                        } else {
                            showTempToast("Không thể kết nối Microphone. Bạn ở chế độ chỉ nghe.");
                        }
                        localStream = null;
                    }
                }
            }

            if (localStream && callTypeGlobal === "video") {
                const localVideo = document.getElementById("local-video");
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.muted = true; // Tránh vọng tiếng
                }
            }
        } catch (error) {
            console.error("Lỗi không mong muốn khi chuẩn bị phương tiện:", error);
            localStream = null;
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
                    remoteAudio.volume = 1.0;

                    // Thử phát ngay lập tức
                    const playPromise = remoteAudio.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log("🔊 Phát âm thanh cuộc gọi thành công lập tức!");
                            })
                            .catch((e) => {
                                console.warn("Autoplay chặn âm thanh cuộc gọi lần đầu, đăng ký chạm màn hình để mở khóa...", e);
                                document.addEventListener("click", playRemoteAudioSafely);
                                document.addEventListener("touchstart", playRemoteAudioSafely);

                                // Thử lại sau 500ms
                                setTimeout(() => {
                                    if (remoteAudio.srcObject === stream) {
                                        remoteAudio.play().catch(() => { });
                                    }
                                }, 500);
                            });
                    }
                }
            } else if (event.track.kind === "video") {
                const remoteVideo = document.getElementById("remote-video");
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                    remoteVideo.muted = false;
                    remoteVideo.volume = 1.0;
                    const playPromise = remoteVideo.play();
                    if (playPromise !== undefined) {
                        playPromise.catch((e) => {
                            console.warn("Autoplay chặn video cuộc gọi lần đầu, thử lại sau 300ms...", e);
                            setTimeout(() => {
                                if (remoteVideo.srcObject === stream) {
                                    remoteVideo.play().catch(() => { });
                                }
                            }, 300);
                        });
                    }
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

        // Lắng nghe trạng thái kết nối ICE để tự động Restart ICE khi bị fail lần đầu
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection) {
                console.log("ICE Connection State:", peerConnection.iceConnectionState);
                if (
                    peerConnection.iceConnectionState === "failed" ||
                    peerConnection.iceConnectionState === "disconnected"
                ) {
                    console.warn("Kết nối cuộc gọi gặp trục trặc! Tự động kết nối lại (ICE Restart)...");
                    triggerIceRestart(isCaller);
                }
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
        } else {
            // Đối với người nhận, sau khi khởi tạo peerConnection thành công,
            // xử lý tất cả các tín hiệu (offer/ICE) đang chờ trong hàng đợi.
            await processPendingSignals();
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
async function processSignal(signal) {
    if (!peerConnection) return;
    try {
        if (signal.offer) {
            console.log("Xử lý offer WebRTC nhận được...");
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
            console.log("Xử lý answer WebRTC nhận được...");
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(signal.answer),
            );
            processIceQueue();
        } else if (signal.ice) {
            if (peerConnection.remoteDescription) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
                } catch (e) {
                    console.warn("Lỗi khi thêm ICE candidate trực tiếp:", e.message);
                }
            } else {
                iceCandidateQueue.push(signal.ice);
            }
        }
    } catch (error) {
        console.error("Lỗi khi xử lý tín hiệu WebRTC cụ thể:", error);
    }
}

async function handleWebRTCSignal({ signal, senderId }) {
    if (senderId) {
        currentCallPartnerId = senderId;
    }

    if (!peerConnection) {
        console.log("RTCPeerConnection chưa sẵn sàng, đưa tín hiệu vào hàng đợi:", signal);
        pendingSignalsQueue.push(signal);
        return;
    }

    await processSignal(signal);
}

async function processPendingSignals() {
    if (pendingSignalsQueue.length > 0) {
        console.log(`Đang xử lý ${pendingSignalsQueue.length} tín hiệu WebRTC trong hàng đợi...`);
        const queueToProcess = [...pendingSignalsQueue];
        pendingSignalsQueue = [];
        for (const signal of queueToProcess) {
            await processSignal(signal);
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

// Mở khóa âm thanh cuộc gọi từ tương tác chạm màn hình của người dùng (Bypass Autoplay của trình duyệt)
function playRemoteAudioSafely() {
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio && remoteAudio.srcObject) {
        console.log("🔊 Kích hoạt phát âm thanh cuộc gọi từ tương tác người dùng...");
        remoteAudio.play()
            .then(() => {
                console.log("🔊 Phát âm thanh cuộc gọi thành công!");
                document.removeEventListener("click", playRemoteAudioSafely);
                document.removeEventListener("touchstart", playRemoteAudioSafely);
            })
            .catch((err) => {
                console.warn("🔊 Chưa thể phát âm thanh cuộc gọi qua tương tác:", err);
            });
    }

    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.play().catch(() => { });
    }
}

// Tự động khởi động lại ICE khi gặp sự cố kết nối ở lần đầu
async function triggerIceRestart(isCaller) {
    try {
        if (peerConnection && isCaller) {
            const offer = await peerConnection.createOffer({ iceRestart: true });
            await peerConnection.setLocalDescription(offer);
            socket.emit("webrtc_signal", {
                connectedUserId: currentCallPartnerId,
                signal: { offer },
            });
            console.log("✈️ Đã kích hoạt và gửi yêu cầu kết nối lại (ICE Restart) sang đối phương!");
        }
    } catch (err) {
        console.error("Lỗi khi thực hiện ICE Restart:", err);
    }
}

// Tự động kiểm tra và chuyển tiếp sang màn hình cuộc gọi đầy đủ khi click thông báo chạy ngầm
function checkUrlParamsForCall() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "incoming_call") {
        const callerId = urlParams.get("callerId");
        const callerName = urlParams.get("callerName");
        const callType = urlParams.get("callType");
        const callerAvatar = urlParams.get("callerAvatar");
        const autoAccept = urlParams.get("autoAccept") === "true";
        const autoDecline = urlParams.get("autoDecline") === "true";
        const callTime = urlParams.get("t") || "";

        // 🌟 FIX: Ngăn chặn xử lý các URL cuộc gọi quá cũ (lớn hơn 1 phút) do khôi phục tab/lịch sử duyệt web của trình duyệt
        if (callTime && callTime.trim() !== "") {
            const callTimestamp = parseInt(callTime, 10);
            const now = Date.now();
            if (!isNaN(callTimestamp) && Math.abs(now - callTimestamp) > 60000) { // 60 giây
                console.log("🚫 URL cuộc gọi đã quá hạn (stale URL từ lịch sử/khôi phục tab), bỏ qua.");
                // Xóa query params để URL sạch sẽ
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
        }

        // 🌟 Chống trùng lặp cuộc gọi nhỡ do cơ chế khôi phục tab/tải lại URL của trình duyệt di động
        const callSignature = `${callerId}_${callType}_${autoAccept}_${autoDecline}_${callTime}`;
        const lastProcessedCall = localStorage.getItem("last_processed_call_signature");
        if (lastProcessedCall === callSignature) {
            console.log("🚫 Cuộc gọi này đã được xử lý từ trước (ngăn chặn trùng lặp cuộc gọi nhỡ do tải lại trang).");
            // Xóa query params để URL luôn sạch sẽ
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        localStorage.setItem("last_processed_call_signature", callSignature);

        // Xóa các query params để tránh việc kích hoạt lại khi refresh trang
        window.history.replaceState({}, document.title, window.location.pathname);

        if (autoDecline) {
            // Gửi từ chối cuộc gọi lập tức
            if (socket) socket.emit("reject_call", { callerId, callType });
            return;
        }

        // Bật giao diện cuộc gọi full màn hình
        callTypeGlobal = callType;
        currentCallPartnerId = callerId;

        const modal = document.getElementById("call-modal");
        if (modal) {
            modal.classList.remove("voice-call", "video-call", "in-call", "is-caller");
            modal.classList.add(`${callType}-call`);

            const nameEl = document.getElementById("call-name");
            if (nameEl) nameEl.innerText = callerName;

            const avatarEl = document.getElementById("call-avatar");
            if (avatarEl) {
                avatarEl.src = callerAvatar ? formatUrl(callerAvatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&background=random`;
            }

            document.getElementById("incoming-call-actions").setAttribute("style", "display: flex !important");
            document.getElementById("active-call-actions").setAttribute("style", "display: none !important");

            modal.style.display = "flex";
            document.body.classList.add("call-active");
            modal.style.zIndex = "99999";

            // Phát rung & nhạc chuông
            startVibration();
            playRingtone();

            // Gán lại các sự kiện click cho các nút Accept/Reject
            document.getElementById("accept-call-btn").onclick = async () => {
                stopVibration();
                stopRingtone();
                // Mở khóa autoplay trình duyệt bằng AudioContext (iOS Safari cần user gesture)
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const buf = ctx.createBuffer(1, 1, 22050);
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.connect(ctx.destination);
                    src.start(0);
                    const ra = document.getElementById("remote-audio");
                    if (ra) { ra.muted = false; ra.volume = 1.0; }
                    const rv = document.getElementById("remote-video");
                    if (rv) { rv.muted = false; }
                } catch (e) { console.warn("Không thể mở khóa AudioContext:", e); }
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

            // Nếu người dùng đã bấm nút Trả lời từ Notification banner
            if (autoAccept) {
                document.getElementById("accept-call-btn").click();
            }
        }
    }
}

// 6. Kết thúc cuộc gọi
function endCall(shouldEmit) {
    const modal = document.getElementById("call-modal");
    const isCallActive = modal && modal.style.display === "flex";

    stopCallTimer();
    stopVibration();
    stopRingtone();
    stopOutgoingRingtone();

    if (isCallActive) {
        playWebAudio("hangup", false, 4.5);
    }

    if (callTimeoutTimer) {
        clearTimeout(callTimeoutTimer);
        callTimeoutTimer = null;
    }

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
    pendingSignalsQueue = [];
    currentCallPartnerId = null;

    document.removeEventListener("click", playRemoteAudioSafely);
    document.removeEventListener("touchstart", playRemoteAudioSafely);

    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("voice-call", "video-call", "in-call", "is-caller");
    }
    document.body.classList.remove("call-active");

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
    micBtn.addEventListener("click", function () {
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
    camBtn.addEventListener("click", function () {
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
    spkBtn.addEventListener("click", function () {
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
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Không thể tải thông báo (HTTP ${res.status}): ${errorText.substring(0, 100) || "Lỗi máy chủ"}`);
        }
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
    const mobileBadge = document.getElementById("mobile-notifications-badge");
    const unreadCount = notificationsList.filter((n) => !n.isRead).length;

    const countText = unreadCount > 9 ? "9+" : unreadCount;
    const displayStyle = unreadCount > 0 ? "flex" : "none";

    if (badge) {
        badge.innerText = countText;
        badge.style.display = displayStyle;
    }
    if (mobileBadge) {
        mobileBadge.innerText = countText;
        mobileBadge.style.display = displayStyle;
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

    // Grouping by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
        today: { name: "Hôm nay", items: [] },
        yesterday: { name: "Hôm qua", items: [] },
        older: { name: "Cũ hơn", items: [] }
    };

    notificationsList.forEach((notif) => {
        const date = new Date(notif.createdAt);
        const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (dDate.getTime() === today.getTime()) {
            groups.today.items.push(notif);
        } else if (dDate.getTime() === yesterday.getTime()) {
            groups.yesterday.items.push(notif);
        } else {
            groups.older.items.push(notif);
        }
    });

    Object.keys(groups).forEach((key) => {
        const group = groups[key];
        if (group.items.length === 0) return;

        // Render header
        const headerEl = document.createElement("div");
        headerEl.className = "notification-group-title";
        headerEl.innerText = group.name;
        listEl.appendChild(headerEl);

        // Render group items
        group.items.forEach((notif) => {
            const sender = notif.Sender;
            const avatarUrl = sender.avatar ?
                formatUrl(sender.avatar) :
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    sender.fullName,
                )}&background=random`;
            const date = new Date(notif.createdAt);
            const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date
                .getMinutes()
                .toString()
                .padStart(2, "0")} - ${date.getDate()}/${date.getMonth() + 1}`;

            let iconClass = "fa-comments";
            if (notif.type && (notif.type.includes("FRIEND") || notif.type.includes("friend"))) {
                iconClass = "fa-user-plus";
            } else if (notif.content && (notif.content.includes("kết bạn") || notif.content.includes("lời mời") || notif.content.includes("chấp nhận"))) {
                iconClass = "fa-user-plus";
            }

            const itemEl = document.createElement("div");
            itemEl.className = `notification-item ${notif.isRead ? "" : "unread"}`;
            itemEl.onclick = () => markNotificationAsRead(notif.id);
            itemEl.innerHTML = `
          <div class="notification-avatar-container">
            <img src="${avatarUrl}" class="notification-avatar" alt="Avatar">
            <div class="notification-type-badge ${iconClass === 'fa-user-plus' ? 'friend' : 'msg'}">
              <i class="fas ${iconClass}"></i>
            </div>
          </div>
          <div class="notification-content">
            <p class="notification-text"><b>${sender.fullName}</b> ${notif.content}</p>
            <p class="notification-time">${timeStr}</p>
          </div>
        `;
            listEl.appendChild(itemEl);
        });
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
        } catch (e) { }
    }
}

function showToastNotification(notif) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const sender = notif.Sender;
    const avatarUrl = sender.avatar ?
        formatUrl(sender.avatar) :
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
    function (e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    },
    { passive: false }
);

// Chống zoom cử chỉ trên iOS Safari
document.addEventListener(
    "gesturestart",
    function (e) {
        e.preventDefault();
    },
    { passive: false }
);

let lastTouchEnd = 0;
document.addEventListener(
    "touchend",
    function (e) {
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
    function (e) {
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
    } else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            textPreview = `[Tệp tin: ${fileData.fileName}]`;
        } catch (e) {
            textPreview = "[Tệp tin]";
        }
    } else if (msg.type === "audio") {
        textPreview = "[Tin nhắn thoại]";
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

// Bắt đầu chế độ chỉnh sửa tin nhắn
function startEditMode(msgId, currentContent) {
    replyingToMessage = null;

    const msg = currentChatMessages.find(m => m.id === msgId);
    if (!msg) return;

    editingMessage = msg;

    const input = document.getElementById("message-input");
    if (input) {
        input.value = currentContent;
        input.focus();
        // Kích hoạt sự kiện input để tự động hiện nút Gửi (thay vì nút Like) và tự động căn chỉnh chiều cao ô nhập tin nhắn
        input.dispatchEvent(new Event("input"));
    }

    const previewContainer = document.getElementById("reply-preview-container");
    const previewSender = document.getElementById("reply-preview-sender");
    const previewText = document.getElementById("reply-preview-text");

    if (previewContainer && previewSender && previewText) {
        previewSender.innerHTML = '<i class="fas fa-edit" style="color: var(--primary-color); margin-right: 6px;"></i>Đang sửa tin nhắn';
        previewText.innerText = currentContent;
        previewContainer.style.display = "flex";

        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

// Gọi API gửi nội dung tin nhắn đã sửa lên server
async function editMessageApi(messageId, newContent) {
    try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/edit`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ newContent }),
        });

        const data = await res.json();
        if (!data.success) {
            alert("Lỗi khi chỉnh sửa tin nhắn: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối khi chỉnh sửa tin nhắn: " + error.message);
    }
}

// Hủy chế độ trả lời / chỉnh sửa tin nhắn
function cancelReply() {
    const wasEditing = editingMessage !== null;
    replyingToMessage = null;
    editingMessage = null;
    const previewContainer = document.getElementById("reply-preview-container");
    if (previewContainer) {
        previewContainer.style.display = "none";
    }
    if (wasEditing) {
        const input = document.getElementById("message-input");
        if (input) input.value = "";
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
                    reader.onload = function (event) {
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

// Override window.alert globally to use custom in-app alert modal
window.alert = function (message) {
    customAlert("Thông báo", message);
};

function customAlert(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("custom-alert-modal");
        const titleEl = document.getElementById("custom-alert-title");
        const msgEl = document.getElementById("custom-alert-message");
        const okBtn = document.getElementById("custom-alert-ok-btn");

        if (!modal || !titleEl || !msgEl || !okBtn) {
            console.warn("Custom alert DOM elements not found. Message: ", message);
            return resolve();
        }

        titleEl.innerText = title;
        msgEl.innerText = message;

        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("show"), 10);

        function cleanup() {
            modal.classList.remove("show");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
            okBtn.onclick = null;
            resolve();
        }

        okBtn.onclick = () => cleanup();
    });
}

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

// ==========================================================================
// MOBILE HAPTIC FEEDBACK FOR PWA (RUNG PHẢN HỒI KHI CHẠM NÚT)
// ==========================================================================

/**
 * Tạo độ rung nhẹ phản hồi (haptic feedback) trên các thiết bị di động hỗ trợ
 * @param {number|number[]} pattern - Thời gian rung tính bằng mili-giây (ví dụ: 15ms) hoặc mảng nhịp rung
 */
function triggerHapticFeedback(pattern = 30) {
    if (callVibrationActive) return; // KHÔNG ĐƯỢC RUNG PHẢN HỒI KHI ĐANG CÓ CUỘC GỌI ĐẾN (tránh ghi đè rung cuộc gọi)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn("Trình duyệt không hỗ trợ hoặc chặn cuộc gọi rung:", e);
        }
    }
}

// Tự động gán phản hồi xúc giác nhẹ khi click/tap các phần tử tương tác (button, link, tab...)
document.addEventListener("click", (e) => {
    const interactiveElement = e.target.closest(
        "button, .btn, .icon-btn, .nav-item, [role='button'], .sidebar-actions i, #send-btn, .chat-list-container li, .friend-action-btn"
    );
    if (interactiveElement) {
        triggerHapticFeedback(15); // Rung cực nhẹ 15ms tạo cảm giác như nhấn nút thật
    }
});

// Hàm xin quyền thông báo và lấy FCM Token
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("Trình duyệt này không hỗ trợ hiển thị thông báo.");
        updateNotificationPermissionUI();
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            console.log("Quyền thông báo đã được chấp thuận.");
            if (token) {
                setupFirebaseMessaging(token);
            }
        } else {
            console.warn("Người dùng từ chối cấp quyền thông báo.");
        }
        updateNotificationPermissionUI();
    } catch (error) {
        console.error("Lỗi trong quá trình xin quyền hoặc lấy FCM Token:", error);
        updateNotificationPermissionUI();
    }
}

// Cập nhật trạng thái giao diện nút xin quyền thông báo
function updateNotificationPermissionUI() {
    const btn = document.getElementById("notification-permission-btn");
    if (!btn) return;

    if (!("Notification" in window)) {
        btn.innerText = "Không hỗ trợ";
        btn.disabled = true;
        btn.style.background = "var(--border-color)";
        btn.style.color = "var(--text-light)";
        btn.style.border = "none";
        return;
    }

    if (Notification.permission === "granted") {
        btn.innerHTML = `<i class="fas fa-check"></i> Đã bật`;
        btn.disabled = true;
        btn.style.background = "rgba(16, 185, 129, 0.1)";
        btn.style.color = "#10b981";
        btn.style.border = "1px solid #10b981";
        btn.style.cursor = "default";
        btn.style.transform = "none";
    } else if (Notification.permission === "denied") {
        btn.innerText = "Bị từ chối";
        btn.disabled = true;
        btn.style.background = "rgba(239, 68, 68, 0.1)";
        btn.style.color = "#ef4444";
        btn.style.border = "1px solid #ef4444";
        btn.style.cursor = "default";
        btn.style.transform = "none";
    } else {
        btn.innerText = "Bật";
        btn.disabled = false;
        btn.style.background = "var(--primary-color)";
        btn.style.color = "white";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
    }
}

// Helper hiển thị popup tìm kiếm kết bạn trên giao diện Mobile
function searchUserMobilePrompt() {
    customPrompt("Tìm kiếm người dùng", "Nhập tên người dùng (Username/FullName) bạn muốn tìm kiếm để kết bạn:")
        .then((q) => {
            if (q && q.trim()) {
                const mobileSearchEl = document.getElementById("mobile-search-input");
                if (mobileSearchEl) {
                    mobileSearchEl.value = q.trim();
                }
                searchUser();
            }
        });
}

// Cập nhật danh sách thiết bị âm thanh/hình ảnh khả dụng
async function updateMediaDevicesList() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

        // Xin quyền trước để lấy được đầy đủ tên thiết bị thay vì nhãn rỗng
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callTypeGlobal === "video" });
            tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.warn("Xin quyền thiết bị tạm thời để liệt kê nhãn thất bại:", e);
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const micSelect = document.getElementById("setting-mic-select");
        const camSelect = document.getElementById("setting-cam-select");

        if (micSelect) {
            // Lưu lại thiết bị đã chọn trước đó (nếu có)
            const prevSelected = micSelect.value;
            micSelect.innerHTML = '<option value="">Thiết bị mặc định (Default)</option>';

            const micDevices = devices.filter((device) => device.kind === "audioinput");
            micDevices.forEach((device) => {
                const option = document.createElement("option");
                option.value = device.deviceId;
                option.innerText = device.label || `Microphone ${micSelect.options.length}`;
                micSelect.appendChild(option);
            });

            if (prevSelected && Array.from(micSelect.options).some(o => o.value === prevSelected)) {
                micSelect.value = prevSelected;
            }
        }

        if (camSelect) {
            const prevSelected = camSelect.value;
            camSelect.innerHTML = '<option value="">Thiết bị mặc định (Default)</option>';

            const camDevices = devices.filter((device) => device.kind === "videoinput");
            camDevices.forEach((device) => {
                const option = document.createElement("option");
                option.value = device.deviceId;
                option.innerText = device.label || `Camera ${camSelect.options.length}`;
                camSelect.appendChild(option);
            });

            if (prevSelected && Array.from(camSelect.options).some(o => o.value === prevSelected)) {
                camSelect.value = prevSelected;
            }
        }
    } catch (err) {
        console.error("Lỗi khi tải danh sách thiết bị phần cứng:", err);
    }
}

/**
 * AI SCROLL FIX v3
 * Thêm vào app.js hoặc paste vào cuối <script> trong HTML
 * Dùng JS để đảm bảo scroll dọc luôn hoạt động trong tab AI
 */
(function () {
    function initAiScrollFix() {
        const history = document.getElementById('ai-chat-history');
        if (!history) return;

        let startX = 0;
        let startY = 0;
        let startScrollTop = 0;
        let isScrollingY = false;
        let isScrollingChecked = false;

        // Khi bắt đầu chạm
        history.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startScrollTop = history.scrollTop;
            isScrollingY = false;
            isScrollingChecked = false;
        }, { passive: true });

        // Khi di chuyển ngón tay - forward scroll lên container nếu cần
        history.addEventListener('touchmove', function (e) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = startX - currentX;
            const deltaY = startY - currentY; // dương = kéo lên (scroll xuống)

            const target = e.target;
            const isInCodeBlock = target.closest('.ai-code-block') || target.closest('pre');

            if (isInCodeBlock) {
                if (!isScrollingChecked) {
                    // Nếu vuốt dọc nhiều hơn vuốt ngang, kích hoạt cuộn dọc
                    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
                        isScrollingY = true;
                    }
                    isScrollingChecked = true;
                }

                if (isScrollingY) {
                    // Chỉ cuộn dọc container AI nếu di chuyển ngón tay theo chiều dọc
                    history.scrollTop = startScrollTop + deltaY;
                }
            }
        }, { passive: true });

        // Theo dõi khi tab AI được mở, khởi động lại fix
        const observer = new MutationObserver(function () {
            const aiTab = document.getElementById('tab-ai');
            if (aiTab && aiTab.classList.contains('active')) {
                // Re-attach nếu cần
            }
        });

        const tabAi = document.getElementById('tab-ai');
        if (tabAi) {
            observer.observe(tabAi, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // Chạy khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAiScrollFix);
    } else {
        initAiScrollFix();
    }
})();

//thooooooooooooo
/* Paste vào cuối app.js */
(function () {
    const MIN_LINES = 8;

    function initWrapper(wrapper) {
        if (wrapper.dataset.init) return;
        wrapper.dataset.init = '1';

        const pre = wrapper.querySelector('pre');
        if (!pre) return;

        const lines = (pre.textContent.match(/\n/g) || []).length + 1;
        if (lines < MIN_LINES) {
            // Code ngắn: không thu gọn, chỉ để mở rộng hoàn toàn
            wrapper.classList.add('expanded');
            return;
        }

        wrapper.classList.add('collapsed');

        // Thêm nút toggle vào header
        const header = wrapper.querySelector('.ai-code-header');
        if (header) {
            const left = document.createElement('div');
            left.className = 'ai-code-header-left';
            const lang = header.querySelector('.ai-code-header-lang');
            const copy = header.querySelector('.ai-code-copy-btn');
            if (lang) left.appendChild(lang);

            const btn = document.createElement('button');
            btn.className = 'ai-code-toggle-btn';
            btn.innerHTML = '<span class="toggle-icon">▼</span>&nbsp;<span class="toggle-label">Xem thêm</span>';
            btn.onclick = function (e) { e.stopPropagation(); toggle(wrapper); };
            left.appendChild(btn);

            header.innerHTML = '';
            header.appendChild(left);
            if (copy) header.appendChild(copy);
            header.onclick = function (e) {
                if (!e.target.closest('.ai-code-copy-btn')) toggle(wrapper);
            };
        }

        // Nút ở dưới
        const expandBtn = document.createElement('button');
        expandBtn.className = 'ai-code-expand-btn';
        expandBtn.textContent = '▼  Xem thêm  (' + lines + ' dòng)';
        expandBtn.onclick = function () { toggle(wrapper); };
        wrapper.appendChild(expandBtn);
    }

    function toggle(wrapper) {
        const collapsed = wrapper.classList.contains('collapsed');
        const label = wrapper.querySelector('.toggle-label');
        const expandBtn = wrapper.querySelector('.ai-code-expand-btn');
        const pre = wrapper.querySelector('pre');
        const lines = pre ? (pre.textContent.match(/\n/g) || []).length + 1 : 0;

        if (collapsed) {
            wrapper.classList.replace('collapsed', 'expanded');
            if (label) label.textContent = 'Thu gọn';
            if (expandBtn) expandBtn.textContent = '▲  Thu gọn';
        } else {
            wrapper.classList.replace('expanded', 'collapsed');
            if (label) label.textContent = 'Xem thêm';
            if (expandBtn) expandBtn.textContent = '▼  Xem thêm  (' + lines + ' dòng)';
            setTimeout(function () {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 320);
        }
    }

    function scan(root) {
        (root || document).querySelectorAll('.ai-code-wrapper').forEach(initWrapper);
    }

    function start() {
        scan();
        const hist = document.getElementById('ai-chat-history');
        if (!hist) return;
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType !== 1) return;
                    if (n.classList && n.classList.contains('ai-code-wrapper')) initWrapper(n);
                    else n.querySelectorAll && n.querySelectorAll('.ai-code-wrapper').forEach(initWrapper);
                });
            });
        }).observe(hist, { childList: true, subtree: true });
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', start)
        : start();
})();

// Cập nhật thanh hạn ngạch sử dụng AI (Token progress bar)
function updateAiQuotaBar(forceMax = false) {
    const fillEl = document.getElementById("ai-quota-bar-fill");
    const percentageEl = document.getElementById("ai-quota-bar-percentage");
    if (!fillEl || !percentageEl) return;

    const limit = 20; // Giới hạn số lượt gọi miễn phí trong ngày (Google AI Studio free tier)
    const todayStr = new Date().toISOString().split('T')[0]; // Định dạng YYYY-MM-DD
    const countKey = `ai_request_count_${todayStr}`;

    let count = parseInt(localStorage.getItem(countKey) || "0", 10);

    if (forceMax) {
        count = limit;
        localStorage.setItem(countKey, String(limit));
    }

    const percentage = Math.min(Math.round((count / limit) * 100), 100);

    // Cập nhật UI
    fillEl.style.width = `${percentage}%`;
    percentageEl.innerText = `${percentage}%`;

    // Cập nhật màu sắc cảnh báo
    fillEl.classList.remove("warning", "danger");
    if (percentage >= 100) {
        fillEl.classList.add("danger");
        percentageEl.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Hết Token (100%)</span>`;
    } else if (percentage >= 70) {
        fillEl.classList.add("warning");
    }

    // Khởi động đồng hồ đếm ngược đến giờ reset
    startAiQuotaCountdown();
}

// Tăng số lượt gọi AI thành công khi hoàn thành stream
function incrementAiRequestCount() {
    const todayStr = new Date().toISOString().split('T')[0];
    const countKey = `ai_request_count_${todayStr}`;
    let count = parseInt(localStorage.getItem(countKey) || "0", 10);
    localStorage.setItem(countKey, String(count + 1));
    updateAiQuotaBar();
}

// Lấy mốc thời gian 7:00 AM tiếp theo (Giờ reset của Google AI Studio)
function getNextResetTime() {
    const now = new Date();
    const resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0); // 7:00 AM hôm nay
    if (now >= resetTime) {
        resetTime.setDate(resetTime.getDate() + 1); // 7:00 AM ngày mai
    }
    return resetTime;
}

// Quản lý interval và cập nhật đồng hồ đếm ngược
let aiQuotaTimerInterval = null;
function startAiQuotaCountdown() {
    if (aiQuotaTimerInterval) clearInterval(aiQuotaTimerInterval);

    function updateCountdown() {
        const countdownEl = document.getElementById("ai-quota-countdown");
        if (!countdownEl) return;

        const now = new Date();
        const nextReset = getNextResetTime();
        const diffMs = nextReset - now;

        if (diffMs <= 0) {
            updateAiQuotaBar();
            return;
        }

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        const pad = (num) => String(num).padStart(2, "0");
        countdownEl.innerText = `Tự động reset sau: ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }

    updateCountdown();
    aiQuotaTimerInterval = setInterval(updateCountdown, 1000);
}

// --- XOÁ CUỘC TRÒ CHUYỆN (GIAO DIỆN & API) ---
function toggleConversationMenu(event, conversationId) {
    event.stopPropagation();
    const menuId = `conv-menu-${conversationId}`;
    const menu = document.getElementById(menuId);
    if (!menu) return;

    // Đóng toàn bộ dropdown khác
    document.querySelectorAll(".conv-dropdown-menu").forEach((m) => {
        if (m.id !== menuId) m.style.display = "none";
    });

    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

async function confirmDeleteConversation(event, conversationId) {
    event.stopPropagation();
    const menu = document.getElementById(`conv-menu-${conversationId}`);
    if (menu) menu.style.display = "none";

    const isConfirmed = confirm("Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ cuộc trò chuyện này không? Tất cả tin nhắn sẽ bị xóa sạch.");
    if (!isConfirmed) return;

    try {
        const res = await fetch(`${API_URL}/chat/conversations/${conversationId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const data = await res.json();
        if (data.success) {
            alert("Đã xóa cuộc trò chuyện thành công.");
            if (isSameId(conversationId, currentConversationId)) {
                currentConversationId = "";
                currentChatPartnerId = null;
                document.getElementById("chat-header-container").style.display = "none";
                document.getElementById("input-area").style.display = "none";
                document.getElementById("chat-header-placeholder").style.display = "flex";
                document.getElementById("messages").innerHTML = "";
            }
            loadConversations();
        } else {
            alert("Lỗi: " + data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối server: " + error.message);
    }
}

// Đóng dropdown khi click ra ngoài màn hình
document.addEventListener("click", () => {
    document.querySelectorAll(".conv-dropdown-menu").forEach((m) => {
        m.style.display = "none";
    });
});

// --- CHỨC NĂNG THAY ĐỔI CHỦ ĐỀ CHAT (CHAT THEMES) ---
let currentChatTheme = "default";

function applyChatTheme(themeName) {
    currentChatTheme = themeName || "default";
    const root = document.documentElement;
    const isDark = document.body.getAttribute("data-theme") === "dark";

    const themeColors = {
        default: {
            start: "#0084ff", end: "#006eeb", accent: "#0084ff",
            bg: isDark ? "#151515" : "#f0f2f5"
        },
        ocean: {
            start: "#00c6ff", end: "#0072ff", accent: "#0072ff",
            bg: isDark ? "#081b22" : "#eef9fc"
        },
        sunset: {
            start: "#f12711", end: "#f5af19", accent: "#f12711",
            bg: isDark ? "#22110c" : "#fff6f5"
        },
        lavender: {
            start: "#a18cd1", end: "#fbc2eb", accent: "#a18cd1",
            bg: isDark ? "#171022" : "#faf5ff"
        },
        forest: {
            start: "#11998e", end: "#38ef7d", accent: "#11998e",
            bg: isDark ? "#081c12" : "#f2faf5"
        },
        rose: {
            start: "#ff758c", end: "#ff7eb3", accent: "#ff758c",
            bg: isDark ? "#240d15" : "#fff5f7"
        },
        cyberpunk: {
            start: "#8a2be2", end: "#ff007f", accent: "#ff007f",
            bg: isDark ? "#170824" : "#f9f2ff"
        },
        midnight: {
            start: "#0f2027", end: "#203a43", accent: "#203a43",
            bg: isDark ? "#090b0e" : "#e8eaed"
        }
    };

    const colors = themeColors[currentChatTheme] || themeColors.default;

    root.style.setProperty("--theme-primary-start", colors.start);
    root.style.setProperty("--theme-primary-end", colors.end);
    root.style.setProperty("--theme-accent", colors.accent);
    root.style.setProperty("--theme-bg-color", colors.bg);

    console.log("🎨 Đã áp dụng chủ đề chat thành công:", currentChatTheme, "Nền:", colors.bg);
}

// --- PANEL THÔNG TIN CUỘC TRÒ CHUYỆN (CHAT INFO) ---
function openChatInfoPanel() {
    if (!currentConversationId) return;

    // Lấy thông tin từ header chat hiện tại
    const avatarEl = document.getElementById("current-chat-avatar");
    const nameEl = document.getElementById("chat-header-name");

    const infoAvatar = document.getElementById("chat-info-avatar-img");
    const infoName = document.getElementById("chat-info-name");

    if (avatarEl && infoAvatar) {
        infoAvatar.src = avatarEl.src || "";
    }
    if (nameEl && infoName) {
        infoName.textContent = nameEl.textContent || "Người dùng";
    }

    const modal = document.getElementById("chat-info-panel");
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function closeChatInfoPanel() {
    const modal = document.getElementById("chat-info-panel");
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
    }, 250);
}

function openThemeModal() {
    if (!currentConversationId) return alert("Vui lòng mở một cuộc trò chuyện để đổi chủ đề!");

    const activeTheme = currentChatTheme || "default";
    document.querySelectorAll(".theme-option-item").forEach((item) => {
        if (item.getAttribute("data-theme") === activeTheme) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    const modal = document.getElementById("theme-modal");
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function closeThemeModal() {
    const modal = document.getElementById("theme-modal");
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
    }, 250); // Đồng bộ với thời gian transition CSS
}

async function selectChatTheme(themeName) {
    if (!currentConversationId) return;

    // ✨ Cập nhật giao diện và đóng Modal ngay lập tức (Optimistic UI) để tạo hiệu ứng mượt mà không độ trễ
    applyChatTheme(themeName);
    closeThemeModal();

    try {
        const res = await fetch(`${API_URL}/chat/conversations/${currentConversationId}/theme`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ theme: themeName })
        });

        const data = await res.json();
        if (!data.success) {
            console.error("Lỗi đồng bộ chủ đề với server:", data.message);
        }
    } catch (error) {
        console.error("Lỗi kết nối mạng khi đổi chủ đề:", error);
    }
}

// --- QUẢN LÝ BIỆT DANH (NICKNAMES) ---
function updateUINames() {
    if (!currentConversationId) return;

    const partnerNickname = currentNicknames[currentChatPartnerId];
    const partnerRealName = document.getElementById("chat-header-name")?.dataset.realName || "Người dùng";

    // 1. Cập nhật tên trong header chat
    const headerNameEl = document.getElementById("chat-header-name");
    if (headerNameEl) {
        headerNameEl.innerText = partnerNickname || partnerRealName;
    }

    // 2. Cập nhật tên hiển thị trong các dòng tin nhắn
    const messages = document.getElementById("messages");
    if (messages) {
        const messageElements = messages.querySelectorAll(".message.other-message");
        messageElements.forEach((el) => {
            const senderId = el.dataset.senderId;
            const senderNameEl = el.querySelector(".sender-name");
            if (senderNameEl && senderId) {
                if (currentNicknames[senderId]) {
                    senderNameEl.innerText = currentNicknames[senderId];
                } else {
                    senderNameEl.innerText = senderNameEl.dataset.realName || senderNameEl.innerText;
                }
            }
        });
    }

    // 3. Cập nhật thông tin trong Chat Info Panel
    const chatInfoNameEl = document.getElementById("chat-info-name");
    if (chatInfoNameEl) {
        chatInfoNameEl.innerText = partnerNickname || chatInfoNameEl.dataset.realName || "Người dùng";
    }
}

function openNicknameModal() {
    if (!currentConversationId) return;

    const partnerRealName = document.getElementById("chat-header-name")?.dataset.realName || "Đối phương";
    const partnerLabel = document.getElementById("nickname-partner-label");
    if (partnerLabel) {
        partnerLabel.innerText = `Biệt danh của ${partnerRealName}:`;
    }

    const selfInput = document.getElementById("nickname-self-input");
    const partnerInput = document.getElementById("nickname-partner-input");

    if (selfInput) selfInput.value = currentNicknames[myId] || "";
    if (partnerInput) partnerInput.value = currentNicknames[currentChatPartnerId] || "";

    const modal = document.getElementById("nickname-modal");
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function closeNicknameModal() {
    const modal = document.getElementById("nickname-modal");
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
    }, 250);
}

async function saveNickname(type) {
    if (!currentConversationId) return;

    let targetUserId = type === "self" ? myId : currentChatPartnerId;
    let inputId = type === "self" ? "nickname-self-input" : "nickname-partner-input";
    const nicknameVal = document.getElementById(inputId)?.value || "";

    try {
        const res = await fetch(`${API_URL}/chat/conversations/${currentConversationId}/nickname`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId, nickname: nicknameVal })
        });

        const data = await res.json();
        if (data.success) {
            currentNicknames = data.nicknames || {};
            updateUINames();
            closeNicknameModal();
        } else {
            alert("Lỗi lưu biệt danh: " + data.message);
        }
    } catch (error) {
        console.error("Lỗi mạng khi lưu biệt danh:", error);
        alert("Lỗi mạng khi lưu biệt danh.");
    }
}

async function removeNickname(type) {
    if (!currentConversationId) return;

    let targetUserId = type === "self" ? myId : currentChatPartnerId;
    let inputId = type === "self" ? "nickname-self-input" : "nickname-partner-input";

    const input = document.getElementById(inputId);
    if (input) input.value = "";

    try {
        const res = await fetch(`${API_URL}/chat/conversations/${currentConversationId}/nickname`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ targetUserId, nickname: "" })
        });

        const data = await res.json();
        if (data.success) {
            currentNicknames = data.nicknames || {};
            updateUINames();
            closeNicknameModal();
        } else {
            alert("Lỗi xóa biệt danh: " + data.message);
        }
    } catch (error) {
        console.error("Lỗi mạng khi xóa biệt danh:", error);
        alert("Lỗi mạng khi xóa biệt danh.");
    }
}

// Định dạng thời gian hoạt động cuối cùng (Online/Offline status format)
function formatLastActive(timestamp) {
    if (!timestamp) return "Không hoạt động";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;

    if (diffMs < 0) return "Vừa hoạt động";

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) {
        return "Vừa hoạt động";
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `Hoạt động ${diffMin} phút trước`;
    }

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
        return `Hoạt động ${diffHour} giờ trước`;
    }

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) {
        return "Hoạt động 1 ngày trước";
    }
    return `Hoạt động ${diffDay} ngày trước`;
}

// Cập nhật giao diện thanh Chat Header Status
function updateHeaderStatusUI(isOnline, lastActive) {
    const dot = document.getElementById("chat-header-status-dot");
    const statusText = document.getElementById("chat-header-status");
    if (!dot || !statusText) return;

    let textVal = "";
    if (isOnline) {
        dot.style.display = "block";
        textVal = "Đang hoạt động";
        statusText.innerText = textVal;
        statusText.classList.add("online");
    } else {
        dot.style.display = "none";
        textVal = formatLastActive(lastActive);
        statusText.innerText = textVal;
        statusText.classList.remove("online");
    }

    // Gửi trạng thái hoạt động lên Flutter native
    if (window.FlutterHeaderChannel) {
        window.FlutterHeaderChannel.postMessage(JSON.stringify({
            event: 'update_status',
            partnerStatus: textVal,
            partnerOnline: isOnline
        }));
    }
}

// Tự động quét và cập nhật hiển thị thời gian offline định kỳ mỗi 60 giây
setInterval(() => {
    // 1. Cập nhật dòng status trên chat header (nếu đang offline)
    if (currentChatPartnerId) {
        const sidebarItem = document.querySelector(`#user-list li[data-user-id="${currentChatPartnerId}"]`);
        if (sidebarItem && sidebarItem.dataset.isOnline === "false") {
            const lastActive = sidebarItem.dataset.lastActive;
            updateHeaderStatusUI(false, lastActive);
        }
    }
}, 60000);

// ============================================================
// EMOJI PICKER
// ============================================================
const EMOJI_DATA = [
    {
        name: "Mặt cười",
        icon: "😀",
        emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"]
    },
    {
        name: "Trái tim",
        icon: "❤️",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "💑", "💏", "❤️‍🔥", "❤️‍🩹", "🩷", "🩵", "🩶"]
    },
    {
        name: "Tay & Cử chỉ",
        icon: "👋",
        emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶"]
    },
    {
        name: "Con người",
        icon: "👤",
        emojis: ["👶", "👧", "🧒", "👦", "👩", "🧑", "👨", "👩‍🦱", "🧑‍🦱", "👨‍🦱", "👩‍🦰", "🧑‍🦰", "👨‍🦰", "👱‍♀️", "👱", "👱‍♂️", "👩‍🦳", "🧑‍🦳", "👨‍🦳", "👩‍🦲", "🧑‍🦲", "👨‍🦲", "🧔‍♀️", "🧔", "🧔‍♂️", "👵", "🧓", "👴", "👲", "👳‍♀️", "👳", "👳‍♂️", "🧕", "👮‍♀️", "👮", "👮‍♂️", "💂‍♀️", "💂", "💂‍♂️", "🥷", "👷‍♀️", "👷", "👷‍♂️", "🫅", "🤴", "👸", "👰‍♀️", "👰", "👰‍♂️", "🤵‍♀️", "🤵", "🤵‍♂️"]
    },
    {
        name: "Động vật",
        icon: "🐶",
        emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🪲", "🪳", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🪸", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮"]
    },
    {
        name: "Đồ ăn",
        icon: "🍔",
        emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🫛", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🫚", "🥔", "🍠", "🫘", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "🫖", "☕", "🍵", "🧃", "🥤", "🧋", "🫧", "🍶", "🍺", "🍻", "🥂", "🍷", "🫗", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊"]
    },
    {
        name: "Hoạt động",
        icon: "⚽",
        emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️‍♀️", "🏋️", "🏋️‍♂️", "🤸‍♀️", "🤸", "🤸‍♂️", "⛹️‍♀️", "⛹️", "⛹️‍♂️", "🤺", "🤾‍♀️", "🤾", "🤾‍♂️", "🏌️‍♀️", "🏌️", "🏌️‍♂️", "🏇", "🧘‍♀️", "🧘", "🧘‍♂️", "🏄‍♀️", "🏄", "🏄‍♂️", "🏊‍♀️", "🏊", "🏊‍♂️", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🕹️", "🎰"]
    },
    {
        name: "Du lịch",
        icon: "✈️",
        emojis: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🦯", "🦽", "🦼", "🛴", "🚲", "🛵", "🏍️", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🛞", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🛰️", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡", "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️", "🗻", "🏕️", "🛖", "🏠", "🏡", "🏗️", "🏢", "🏬", "🏣", "🏤", "🏥", "🏦", "🏨", "🏪", "🏫", "🏩", "💒", "🏛️", "⛪", "🕌", "🕍", "🛕", "🕋", "⛩️"]
    },
    {
        name: "Đồ vật",
        icon: "💡",
        emojis: ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🪫", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "🪙", "💰", "💴", "💵", "💶", "💷", "🪪", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🪚", "🔩", "⚙️", "🪤", "🧱", "⛓️", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "🪦", "⚱️", "🏺", "🔮", "📿", "🧿", "🪬", "💈", "⚗️", "🔭", "🔬", "🕳️", "🩹", "🩺", "🩻", "🩼", "💊", "💉", "🩸", "🧬", "🦠", "🧫", "🧪", "🌡️", "🧹", "🪠", "🧺", "🧻", "🧼", "🫧", "🪥", "🧽", "🧯", "🛒", "🚬"]
    }
];

let emojiPickerInitialized = false;
let currentEmojiCategory = 0;

function switchToTextKeyboard() {
    closeEmojiPicker();
    const input = document.getElementById("message-input");
    if (input) {
        input.focus();
    }
}

function deleteLastCharFromInput() {
    const input = document.getElementById("message-input");
    if (!input) return;
    const text = input.value;
    if (text.length === 0) return;

    // Sử dụng Array.from để tách ký tự/emoji surrogate pairs chuẩn xác
    const chars = Array.from(text);
    chars.pop();
    input.value = chars.join("");

    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Tránh tự động focus trên mobile để không làm nhảy bàn phím ảo
    if (window.innerWidth > 768) {
        input.focus();
    }
}

function initEmojiPicker() {
    if (emojiPickerInitialized) return;
    emojiPickerInitialized = true;

    const tabsContainer = document.getElementById("emoji-category-tabs");
    const gridContainer = document.getElementById("emoji-grid");

    if (!tabsContainer || !gridContainer) return;

    // 1. Thêm nút "ABC" vào đầu để tắt emoji quay về bàn phím chữ
    const abcTab = document.createElement("div");
    abcTab.className = "emoji-category-tab abc-tab";
    abcTab.innerText = "ABC";
    abcTab.onclick = (e) => {
        e.stopPropagation();
        switchToTextKeyboard();
    };
    tabsContainer.appendChild(abcTab);

    // 2. Tạo category tabs từ EMOJI_DATA
    EMOJI_DATA.forEach((cat, index) => {
        const tab = document.createElement("div");
        tab.className = "emoji-category-tab" + (index === 0 ? " active" : "");
        tab.innerText = cat.icon;
        tab.title = cat.name;
        tab.setAttribute("data-cat-index", index);
        tab.onclick = (e) => {
            e.stopPropagation();
            scrollToCategory(index);
            setActiveCategoryTab(index);
        };
        tabsContainer.appendChild(tab);
    });

    // 3. Thêm nút backspace (xóa chữ) vào cuối
    const deleteTab = document.createElement("div");
    deleteTab.className = "emoji-category-tab delete-tab";
    deleteTab.innerHTML = '<i class="fas fa-backspace"></i>';
    deleteTab.title = "Xóa";

    // Xử lý giữ nút để xóa nhanh (giống bàn phím thật)
    let deleteInterval = null;
    const startDelete = () => {
        deleteLastCharFromInput();
        deleteInterval = setInterval(deleteLastCharFromInput, 150);
    };
    const stopDelete = () => {
        if (deleteInterval) {
            clearInterval(deleteInterval);
            deleteInterval = null;
        }
    };
    deleteTab.onmousedown = (e) => { e.preventDefault(); startDelete(); };
    deleteTab.onmouseup = stopDelete;
    deleteTab.onmouseleave = stopDelete;
    deleteTab.ontouchstart = (e) => { e.preventDefault(); startDelete(); };
    deleteTab.ontouchend = stopDelete;

    tabsContainer.appendChild(deleteTab);

    // Tạo emoji grid
    renderAllEmojis(gridContainer);

    // Scroll detection to update active tab
    gridContainer.addEventListener("scroll", () => {
        const labels = gridContainer.querySelectorAll(".emoji-category-label");
        let activeIndex = 0;
        labels.forEach((label, i) => {
            if (label.offsetTop <= gridContainer.scrollTop + 40) {
                activeIndex = i;
            }
        });
        setActiveCategoryTab(activeIndex);
    });
}

function renderAllEmojis(container) {
    container.innerHTML = "";
    EMOJI_DATA.forEach((cat, catIndex) => {
        const label = document.createElement("div");
        label.className = "emoji-category-label";
        label.innerText = cat.name;
        label.id = "emoji-cat-" + catIndex;
        container.appendChild(label);

        const items = document.createElement("div");
        items.className = "emoji-items";
        cat.emojis.forEach(emoji => {
            const span = document.createElement("span");
            span.className = "emoji-item";
            span.innerText = emoji;
            span.onclick = (e) => {
                e.stopPropagation();
                insertEmojiToInput(emoji);
            };
            items.appendChild(span);
        });
        container.appendChild(items);
    });
}

function scrollToCategory(index) {
    const target = document.getElementById("emoji-cat-" + index);
    const grid = document.getElementById("emoji-grid");
    if (target && grid) {
        grid.scrollTo({
            top: target.offsetTop - grid.offsetTop,
            behavior: "smooth"
        });
    }
}

function setActiveCategoryTab(index) {
    if (currentEmojiCategory === index) return;
    currentEmojiCategory = index;
    const tabs = document.querySelectorAll(".emoji-category-tab");
    tabs.forEach((tab, i) => {
        // Cộng 1 để bỏ qua tab "ABC" ở vị trí đầu tiên
        tab.classList.toggle("active", i === (index + 1));
    });
}

function insertEmojiToInput(emoji) {
    const input = document.getElementById("message-input");
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    input.value = text.substring(0, start) + emoji + text.substring(end);

    // Set cursor position after emoji
    const newPos = start + emoji.length;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;

    // Trigger input event for any listeners (like show/hide send button)
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Chỉ focus lại trên Desktop (để tiếp tục gõ), trên mobile tránh gọi focus gây bật bàn phím ảo che mất emoji
    if (window.innerWidth > 768) {
        input.focus();
    }
}

function toggleEmojiPicker(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById("emoji-picker-panel");
    const btn = document.getElementById("emoji-toggle-btn");
    if (!panel) return;

    const isOpen = panel.classList.contains("show");
    if (isOpen) {
        closeEmojiPicker();
    } else {
        // Tắt bàn phím ảo trên mobile khi bật chọn emoji
        const input = document.getElementById("message-input");
        if (input) input.blur();

        initEmojiPicker();
        panel.classList.add("show");
        if (btn) btn.classList.add("active");

        // Thêm class emoji-open ở input-area
        const inputArea = document.getElementById("input-area");
        if (inputArea) inputArea.classList.add("emoji-open");

        // Clear search
        const searchInput = document.getElementById("emoji-search-input");
        if (searchInput) searchInput.value = "";

        // Reset to show all emojis
        const grid = document.getElementById("emoji-grid");
        if (grid) renderAllEmojis(grid);
        setActiveCategoryTab(0);

        // Tự động cuộn tin nhắn xuống cuối sau khi mở emoji picker
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) {
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 100);
        }
    }
}

function closeEmojiPicker() {
    const panel = document.getElementById("emoji-picker-panel");
    const btn = document.getElementById("emoji-toggle-btn");
    if (panel) panel.classList.remove("show");
    if (btn) btn.classList.remove("active");

    // Xóa class emoji-open ở input-area
    const inputArea = document.getElementById("input-area");
    if (inputArea) inputArea.classList.remove("emoji-open");
}

function filterEmojis(query) {
    const grid = document.getElementById("emoji-grid");
    if (!grid) return;

    if (!query || query.trim() === "") {
        renderAllEmojis(grid);
        return;
    }

    query = query.toLowerCase();
    grid.innerHTML = "";

    let hasResults = false;
    EMOJI_DATA.forEach(cat => {
        // Simple filter: match category name
        const catNameMatch = cat.name.toLowerCase().includes(query);
        const matchedEmojis = catNameMatch ? cat.emojis : [];

        if (matchedEmojis.length > 0) {
            hasResults = true;
            const label = document.createElement("div");
            label.className = "emoji-category-label";
            label.innerText = cat.name;
            grid.appendChild(label);

            const items = document.createElement("div");
            items.className = "emoji-items";
            matchedEmojis.forEach(emoji => {
                const span = document.createElement("span");
                span.className = "emoji-item";
                span.innerText = emoji;
                span.onclick = (e) => {
                    e.stopPropagation();
                    insertEmojiToInput(emoji);
                };
                items.appendChild(span);
            });
            grid.appendChild(items);
        }
    });

    if (!hasResults) {
        // Show all emojis flattened when no category matches
        const allEmojis = EMOJI_DATA.flatMap(c => c.emojis);
        const filtered = allEmojis; // Show all since emoji search by character isn't practical
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="emoji-no-results">Không tìm thấy emoji 😢</div>';
        } else {
            grid.innerHTML = '<div class="emoji-no-results">Không tìm thấy danh mục phù hợp 😢</div>';
        }
    }
}

// Close emoji picker when clicking outside
document.addEventListener("click", (e) => {
    const panel = document.getElementById("emoji-picker-panel");
    const wrapper = document.querySelector(".emoji-picker-wrapper");
    if (panel && panel.classList.contains("show")) {
        // Tránh đóng panel khi click vào trong chính panel hoặc vào nút bấm toggle
        if (wrapper && !wrapper.contains(e.target) && !panel.contains(e.target)) {
            closeEmojiPicker();
        }
    }
});

// Close emoji picker on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeEmojiPicker();
    }
});

// --- HỖ TRỢ CÀI ĐẶT ỨNG DỤNG (PWA INSTALLATION) ---
let deferredPrompt = null;

// Lắng nghe sự kiện trước khi cài đặt (chỉ kích hoạt trên Android / Chrome Desktop)
window.addEventListener("beforeinstallprompt", (e) => {
    // Ngăn chặn trình duyệt hiển thị banner mặc định
    e.preventDefault();
    // Lưu trữ sự kiện để kích hoạt sau
    deferredPrompt = e;

    // Hiển thị các nút cài đặt trên giao diện
    const installProfileItem = document.getElementById("install-app-profile-item");
    const installAuthBtn = document.getElementById("install-app-auth-btn");

    if (installProfileItem) installProfileItem.style.display = "flex";
    if (installAuthBtn) installAuthBtn.style.display = "flex";
});

// Hàm kích hoạt hộp thoại cài đặt của trình duyệt
async function triggerPwaInstall() {
    if (deferredPrompt) {
        // Hiện hộp thoại cài đặt
        deferredPrompt.prompt();
        // Nhận phản hồi từ người dùng
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Lựa chọn cài đặt của người dùng: ${outcome}`);
        // Xóa prompt đã lưu
        deferredPrompt = null;

        // Ẩn các nút cài đặt
        hideInstallButtons();
    } else {
        alert("Ứng dụng đã được cài đặt hoặc trình duyệt của bạn không hỗ trợ cài đặt tự động. Hãy sử dụng Google Chrome trên Android để cài đặt.");
    }
}

function hideInstallButtons() {
    const installProfileItem = document.getElementById("install-app-profile-item");
    const installAuthBtn = document.getElementById("install-app-auth-btn");
    if (installProfileItem) installProfileItem.style.display = "none";
    if (installAuthBtn) installAuthBtn.style.display = "none";
}

// Ẩn nút khi ứng dụng đã cài đặt thành công
window.addEventListener("appinstalled", () => {
    console.log("Ứng dụng đã được cài đặt thành công làm PWA!");
    hideInstallButtons();
});

// Gắn sự kiện click vào các nút bấm tương ứng sau khi DOM load xong
document.addEventListener("DOMContentLoaded", () => {
    // Đăng ký Service Worker toàn cục ngay khi tải trang để đảm bảo tính năng PWA (cài đặt app) hoạt động độc lập với Thông báo
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then((registration) => {
                console.log("PWA Service Worker đã được đăng ký toàn cục thành công!");
                // Chủ động cập nhật service worker nếu có phiên bản mới
                registration.update();
            })
            .catch((err) => {
                console.error("Lỗi đăng ký Service Worker toàn cục:", err);
            });
    }

    const installProfileItem = document.getElementById("install-app-profile-item");
    const installAuthBtn = document.getElementById("install-app-auth-btn");

    if (installProfileItem) {
        installProfileItem.addEventListener("click", triggerPwaInstall);
    }
    if (installAuthBtn) {
        installAuthBtn.addEventListener("click", triggerPwaInstall);
    }

    // --- NÚT CUỘN XUỐNG DƯỚI (SCROLL TO BOTTOM BUTTON) ---
    const messagesDiv = document.getElementById("messages");
    const scrollBtn = document.getElementById("scroll-to-bottom-btn");

    if (messagesDiv && scrollBtn) {
        let isThrottled = false;
        messagesDiv.addEventListener("scroll", () => {
            if (isThrottled) return;
            isThrottled = true;
            
            requestAnimationFrame(() => {
                const distanceFromBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
                if (distanceFromBottom > 300) {
                    scrollBtn.classList.add("visible");
                } else {
                    scrollBtn.classList.remove("visible");
                }
                isThrottled = false;
            });
        }, { passive: true });

        scrollBtn.addEventListener("click", () => {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight,
                behavior: "smooth"
            });
        });
    }

    // Không tự động kích hoạt trên iOS (chỉ hỗ trợ Android/Chrome thông qua event beforeinstallprompt)
});

// ==========================================================================
// TÍNH NĂNG TIN TỨC REAL-TIME (TECH & AI NEWS)
// ==========================================================================
let newsListLoaded = false;
let allNewsItems = [];
let currentNewsFilter = "all";
let readNewsIds = [];
try {
    const saved = localStorage.getItem("read_news_ids");
    if (saved) {
        readNewsIds = JSON.parse(saved);
    }
} catch (e) {
    console.error("Failed to load read news IDs:", e);
}

async function loadInitialNews() {
    const newsList = document.getElementById("news-list");
    const emptyState = document.getElementById("news-empty-state");

    if (emptyState) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="font-size: 36px; color: var(--text-light); margin-bottom: 12px; display: block;"></i>
            <p style="color: var(--text-light); font-size: 13.5px;">Đang tải tin tức mới nhất...</p>
        `;
    }

    try {
        const response = await fetch(`${API_URL}/news`);
        const json = await response.json();

        if (json.success && Array.isArray(json.data)) {
            allNewsItems = json.data;
            newsListLoaded = true;

            // Làm sạch readNewsIds: chỉ giữ lại IDs thuộc về tin tức hiện tại
            const validIds = new Set(allNewsItems.map(item => item.id));
            readNewsIds = readNewsIds.filter(id => validIds.has(id));
            try {
                localStorage.setItem("read_news_ids", JSON.stringify(readNewsIds));
            } catch (e) {
                console.error("Failed to save cleaned read news IDs:", e);
            }

            renderNews();
        } else {
            throw new Error(json.message || "Không thể tải dữ liệu.");
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách tin tức ban đầu:", error);
        if (emptyState) {
            emptyState.style.display = "block";
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
                <p style="color: #ef4444; font-size: 13.5px;">Không thể kết nối máy chủ tin tức. Vui lòng thử lại.</p>
            `;
        }
    }
    updateNewsBadge();
}

function renderNews() {
    const newsList = document.getElementById("news-list");
    const emptyState = document.getElementById("news-empty-state");

    if (!newsList) return;

    // Xóa các news-card cũ
    const cards = newsList.querySelectorAll(".news-card");
    cards.forEach(card => card.remove());

    // Lọc tin tức theo danh mục
    const filteredNews = allNewsItems.filter(item => {
        if (currentNewsFilter === "all") return true;
        return item.category === currentNewsFilter;
    });

    // Sắp xếp tin tức: Chưa đọc lên trên, Đã đọc xuống dưới. Cùng trạng thái thì tin mới hơn lên đầu.
    filteredNews.sort((a, b) => {
        const aRead = readNewsIds.includes(a.id);
        const bRead = readNewsIds.includes(b.id);
        if (aRead && !bRead) return 1;
        if (!aRead && bRead) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (filteredNews.length === 0) {
        if (emptyState) {
            emptyState.style.display = "block";
            emptyState.innerHTML = `
                <i class="fas fa-newspaper" style="font-size: 36px; color: var(--text-light); margin-bottom: 12px; display: block;"></i>
                <p style="color: var(--text-light); font-size: 13.5px;">Chưa có tin tức nào thuộc danh mục này.</p>
            `;
        }
    } else {
        if (emptyState) emptyState.style.display = "none";

        filteredNews.forEach(item => {
            const cardHtml = getNewsCardHtml(item);
            newsList.insertAdjacentHTML("beforeend", cardHtml);
        });
    }
}

function getCategoryDetails(category) {
    switch (category) {
        case "World":
            return { label: "Thế giới", badgeClass: "world-badge" };
        case "Vietnam":
            return { label: "Việt Nam", badgeClass: "vietnam-badge" };
        case "Tech_AI":
        default:
            return { label: "Công nghệ & AI", badgeClass: "tech-badge" };
    }
}

function getNewsCardHtml(newsItem, isNewRealtime = false) {
    const animationClass = isNewRealtime ? "realtime-news-animation" : "";
    const { label, badgeClass } = getCategoryDetails(newsItem.category);

    // Kiểm tra trạng thái đã đọc hay chưa
    const isRead = readNewsIds.includes(newsItem.id);
    const readClass = isRead ? "read" : "";

    // Tạo nhãn "Đã đọc" / "Chưa đọc"
    const statusBadge = isRead
        ? `<span class="read-status-badge read" id="status-badge-${newsItem.id}">Đã đọc</span>`
        : `<span class="read-status-badge unread" id="status-badge-${newsItem.id}">Chưa đọc</span>`;

    // Nhãn "Mới" cho tin cào trong vòng 6 tiếng gần đây
    const isNew = (Date.now() - new Date(newsItem.createdAt).getTime()) < 6 * 60 * 60 * 1000;
    const hotBadge = isNew ? `<span class="read-status-badge hot-new">MỚI</span>` : "";

    // Định dạng ngày giờ thân thiện
    const date = new Date(newsItem.createdAt);
    const formattedTime = date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) +
        " " + date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' });

    return `
        <div class="news-card ${animationClass} ${readClass}" id="news-card-${newsItem.id}" data-category="${newsItem.category}" onclick="showNewsDetail('${newsItem.id}')" style="cursor: pointer;">
            <div class="news-card-header">
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <span class="news-badge ${badgeClass}">${label}</span>
                    ${statusBadge}
                    ${hotBadge}
                </div>
                <span class="news-time">${formattedTime}</span>
            </div>
            <h4 class="news-title" style="margin-bottom: 0;">${newsItem.title}</h4>
        </div>
    `;
}

function handleIncomingRealtimeNews(newsItem) {
    // Lưu vào bộ nhớ cục bộ
    allNewsItems.unshift(newsItem);

    // Nếu tin tức mới khớp với bộ lọc hiện tại, chèn lên đầu danh sách kèm hiệu ứng
    if (currentNewsFilter === "all" || currentNewsFilter === newsItem.category) {
        const newsList = document.getElementById("news-list");
        const emptyState = document.getElementById("news-empty-state");

        if (emptyState) emptyState.style.display = "none";

        if (newsList) {
            const cardHtml = getNewsCardHtml(newsItem, true);
            newsList.insertAdjacentHTML("afterbegin", cardHtml);
        }
    }
    updateNewsBadge();
}

function filterNews(category, btnElement) {
    currentNewsFilter = category;

    // Cập nhật trạng thái active cho nút bấm lọc
    const filterButtons = document.querySelectorAll(".news-filter-btn");
    filterButtons.forEach(btn => btn.classList.remove("active"));

    if (btnElement) {
        btnElement.classList.add("active");
    }

    renderNews();
}

function openNewsLink(url) {
    if (url) {
        window.open(url, '_blank');
    }
}

async function showNewsDetail(newsId) {
    const detailView = document.getElementById("news-detail-view");
    const detailTitle = document.getElementById("news-detail-title");
    const detailBadge = document.getElementById("news-detail-badge");
    const detailTime = document.getElementById("news-detail-time");
    const detailBody = document.getElementById("news-detail-body");

    if (!detailView) return;

    // Tìm bài viết trong bộ nhớ cục bộ để hiện các thông tin cơ bản ngay lập tức
    const newsItem = allNewsItems.find(item => item.id === newsId);
    if (!newsItem) return;

    // Gán dữ liệu cơ bản
    const { label, badgeClass } = getCategoryDetails(newsItem.category);
    detailTitle.textContent = newsItem.title;
    detailBadge.textContent = label;
    detailBadge.className = `news-detail-badge ${badgeClass}`;

    const date = new Date(newsItem.createdAt);
    detailTime.textContent = date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) +
        " " + date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' });

    // Hiển thị màn hình chi tiết
    detailView.style.display = "flex";

    // Đánh dấu đã đọc bài viết
    if (!readNewsIds.includes(newsId)) {
        readNewsIds.push(newsId);
        try {
            localStorage.setItem("read_news_ids", JSON.stringify(readNewsIds));
        } catch (e) {
            console.error(e);
        }

        // Rerender lại toàn bộ danh sách để tự động đưa tin đã đọc xuống dưới và đẩy tin chưa đọc lên trên
        renderNews();
        updateNewsBadge();
    }

    // Hiển thị biểu tượng tải dữ liệu
    detailBody.innerHTML = `
        <div style="text-align: center; padding: 60px 0;">
            <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--primary-color); margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;"></i>
            <p style="color: var(--text-light); font-size: 13.5px;">Đang tải nội dung chi tiết...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/news/${newsId}/content`);
        const json = await response.json();

        if (json.success) {
            detailBody.innerHTML = json.data;
        } else {
            throw new Error(json.message);
        }
    } catch (error) {
        console.error("Lỗi khi tải chi tiết bài báo:", error);
        detailBody.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: #ef4444; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;"></i>
                <p style="color: #ef4444; font-size: 13.5px;">Không thể tải nội dung chi tiết. Bạn có thể đọc trực tiếp tại nguồn báo:</p>
                ${newsItem.link ? (() => {
                let hostName = "trang gốc";
                try { hostName = new URL(newsItem.link).hostname.replace("www.", ""); } catch (e) { }
                return `<a href="${newsItem.link}" target="_blank" style="color: var(--primary-color); font-weight: 600; text-decoration: underline; font-size: 14px; margin-top: 12px; display: inline-block;">Đọc bài viết gốc trên ${hostName} <i class="fas fa-external-link-alt"></i></a>`;
            })() : ""}
            </div>
        `;
    }
}

function closeNewsDetail() {
    const detailView = document.getElementById("news-detail-view");
    if (detailView) {
        detailView.style.display = "none";
    }
}

// Đăng ký toàn cục để các hàm inline onclick hoạt động được
window.filterNews = filterNews;
window.openNewsLink = openNewsLink;
window.showNewsDetail = showNewsDetail;
window.closeNewsDetail = closeNewsDetail;

// --- QUẢN LÝ CHI TIẾT CẢM XÚC (REACTIONS DETAIL MODAL) ---
function getUserNameFromCache(userId) {
    if (isSameId(userId, myId)) {
        return "Bạn";
    }
    if (currentChatPartnerId && isSameId(userId, currentChatPartnerId)) {
        const nickname = (currentNicknames && currentNicknames[currentChatPartnerId]);
        if (nickname) return nickname;
        const headerName = document.getElementById("chat-header-name");
        if (headerName) return headerName.innerText;
        return "Đối tác";
    }
    if (currentNicknames && currentNicknames[userId]) {
        return currentNicknames[userId];
    }
    for (let i = currentChatMessages.length - 1; i >= 0; i--) {
        const m = currentChatMessages[i];
        if (m.senderId && isSameId(m.senderId, userId) && m.Users && m.Users.fullName) {
            return m.Users.fullName;
        }
    }
    const chatListItems = document.querySelectorAll(".chat-list-container li");
    for (const li of chatListItems) {
        if (li.dataset.nicknames) {
            try {
                const nicks = JSON.parse(li.dataset.nicknames);
                if (nicks[userId]) return nicks[userId];
            } catch (err) { }
        }
    }
    return "Người dùng khác";
}

function getUserAvatarFromCache(userId) {
    if (isSameId(userId, myId)) {
        const myAv = document.getElementById("my-avatar");
        return myAv ? myAv.src : "/default-avatar.png";
    }
    if (currentChatPartnerId && isSameId(userId, currentChatPartnerId)) {
        const partnerAv = document.querySelector("#chat-header-avatar img");
        if (partnerAv) return partnerAv.src;
    }
    const li = document.querySelector(`.chat-list-container li[data-user-id="${userId}"] img`);
    if (li) return li.src;

    const messageLi = document.querySelector(`.message[data-sender-id="${userId}"] .avatar img`);
    if (messageLi) return messageLi.src;

    return "/default-avatar.png";
}

function openReactionsDetailModal(reactions) {
    const modal = document.getElementById("reactions-detail-modal");
    if (!modal) return;

    const tabsContainer = document.getElementById("reactions-modal-tabs");
    const listContainer = document.getElementById("reactions-modal-list");
    if (!tabsContainer || !listContainer) return;

    tabsContainer.innerHTML = "";
    listContainer.innerHTML = "";

    let reactionMap = reactions;
    if (typeof reactions === "string") {
        try {
            reactionMap = JSON.parse(reactions);
        } catch (e) {
            reactionMap = {};
        }
    }

    const entries = Object.entries(reactionMap);
    if (entries.length === 0) return;

    const emojiGroups = {};
    entries.forEach(([userId, emoji]) => {
        if (!emojiGroups[emoji]) emojiGroups[emoji] = [];
        emojiGroups[emoji].push({ userId, emoji });
    });

    const renderList = (filteredEntries) => {
        listContainer.innerHTML = "";
        filteredEntries.forEach(({ userId, emoji }) => {
            const name = getUserNameFromCache(userId);
            const avatar = getUserAvatarFromCache(userId);

            const item = document.createElement("div");
            item.className = "reactions-modal-item";
            item.innerHTML = `
                <div class="reactions-modal-user-info">
                    <img src="${avatar}" class="reactions-modal-avatar" onerror="this.src='/default-avatar.png'">
                    <span class="reactions-modal-name">${name}</span>
                </div>
                <span class="reactions-modal-emoji">${emoji}</span>
            `;
            listContainer.appendChild(item);
        });
    };

    const allTab = document.createElement("button");
    allTab.className = "reactions-modal-tab active";
    allTab.innerText = `Tất cả (${entries.length})`;
    allTab.onclick = () => {
        document.querySelectorAll(".reactions-modal-tab").forEach(t => t.classList.remove("active"));
        allTab.classList.add("active");
        renderList(entries.map(([userId, emoji]) => ({ userId, emoji })));
    };
    tabsContainer.appendChild(allTab);

    Object.entries(emojiGroups).forEach(([emoji, group]) => {
        const tab = document.createElement("button");
        tab.className = "reactions-modal-tab";
        tab.innerText = `${emoji} ${group.length}`;
        tab.onclick = () => {
            document.querySelectorAll(".reactions-modal-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            renderList(group);
        };
        tabsContainer.appendChild(tab);
    });

    renderList(entries.map(([userId, emoji]) => ({ userId, emoji })));
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function closeReactionsDetailModal(e) {
    const modal = document.getElementById("reactions-detail-modal");
    if (modal && (e === true || e.target === modal || e.type === "close")) {
        modal.classList.remove("show");
        setTimeout(() => {
            modal.style.display = "none";
        }, 250);
    }
}

window.closeReactionsDetailModal = closeReactionsDetailModal;

// --- OPTIMIZATION FOR MOBILE KEYBOARD (VISUAL VIEWPORT) ---
// Hàm kiểm tra người dùng có đang ở gần cuối danh sách tin nhắn không
// Ngưỡng 150px: nếu cách đáy <= 150px thì coi như "đang ở cuối"
window.isNearBottom = function(threshold) {
    const messagesDiv = document.getElementById("messages");
    if (!messagesDiv) return true;
    const t = threshold || 150;
    return (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) <= t;
};

// Smart scroll: Chỉ scroll xuống cuối nếu người dùng đang ở gần cuối
// Nếu họ đang kéo lên xem tin cũ → KHÔNG scroll
window.smartScrollToBottom = function() {
    if (window.isNearBottom(150)) {
        if (typeof window.scrollToBottomSmooth === "function") {
            window.scrollToBottomSmooth();
        } else {
            const messagesDiv = document.getElementById("messages");
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }
};

if (window.visualViewport) {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let rafId = null;
    let lastVvHeight = vv.height;

    // Phát hiện thiết bị iOS (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
        document.body.classList.add('is-ios');
    }

    const isMobileChatActive = () =>
        window.innerWidth <= 768 && document.body.classList.contains("mobile-chat-active");

    const applyViewportVars = () => {
        rafId = null;
        // Chỉ set --vv-height và --vv-offset trên iOS để tránh xung đột co giãn tự nhiên của Android
        if (isIOS) {
            root.style.setProperty('--vv-height', `${vv.height}px`);
            root.style.setProperty('--vv-offset', `${vv.offsetTop}px`);
        }

        const messageInput = document.getElementById('message-input');
        const isKeyboardOpening = document.activeElement === messageInput;

        // Nếu bàn phím đang mở ra (chiều cao giảm đi) hoặc đang ở gần cuối, tự động cuộn xuống cuối
        if ((vv.height < lastVvHeight && isKeyboardOpening) || window.isNearBottom(200)) {
            if (typeof window.scrollToBottomInstant === "function") {
                window.scrollToBottomInstant();
            }
        }
        lastVvHeight = vv.height;
    };

    const handleViewportChange = () => {
        if (!isMobileChatActive()) return;
        // Bỏ debounce 16ms: bám sát rAF để mượt theo từng frame bàn phím di chuyển
        if (rafId === null) {
            rafId = requestAnimationFrame(applyViewportVars);
        }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    // Các lớp bảo vệ chống tự cuộn trên tất cả thiết bị di động
    // Fallback cho trình duyệt cố cuộn layout viewport (window.scrollY lệch khỏi 0), ép về lại ngay lập tức
    const lockLayoutScroll = () => {
        if (!isMobileChatActive()) return;
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    };
    window.addEventListener('scroll', lockLayoutScroll, { passive: true });

    // Khoá ngay tại thời điểm focus, trước khi trình duyệt kịp thực hiện auto-scroll
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('focus', () => {
            if (!isMobileChatActive()) return;
            window.scrollTo(0, 0);
            requestAnimationFrame(() => window.scrollTo(0, 0));
        });
    }

    // Reset khi đóng bàn phím
    document.addEventListener('focusout', (e) => {
        if (e.target && e.target.id === 'message-input') {
            // FIX iOS #4: Tăng delay lên 300ms cho iOS để keyboard kịp đóng hoàn toàn
            // Trước đó là 100ms, quá ngắn cho animation keyboard trên iOS
            const _focusoutDelay = document.body.classList.contains('is-ios') ? 300 : 100;
            setTimeout(() => {
                window.scrollTo(0, 0);
                if (typeof window.smartScrollToBottom === "function") {
                    window.smartScrollToBottom();
                }
            }, _focusoutDelay);
        }
    });

    handleViewportChange();
}
// --- ÂM THANH CHÀO MỪNG NHẸ NHÀNG (Splash Screen Sound) ---
let splashSoundPlayed = false;

function playSingleSound(src, delay, volume) {
    setTimeout(() => {
        try {
            const audio = new Audio(src);
            audio.volume = volume;
            audio.play().catch(err => {
                console.log("Hệ thống chặn tự phát âm thanh " + src + ":", err);
            });
        } catch (e) {
            console.error("Lỗi âm thanh:", e);
        }
    }, delay);
}

function playSplashSound() {
    if (splashSoundPlayed) return;
    
    // Âm thanh 1: Khi logo bắt đầu rơi từ trên xuống (t = 100ms)
    playSingleSound("amthanhtinnhan.mp3", 100, 0.12);
    
    // Âm thanh 2: Khi chữ Chat Tho-Fi bắt đầu đẩy từ dưới lên (t = 700ms)
    playSingleSound("amthanhtinnhan.mp3", 700, 0.15);
    
    splashSoundPlayed = true;
    
    // Gỡ bỏ các trình lắng nghe chạm khi đã phát thành công
    document.removeEventListener("click", playSplashSoundFallback);
    document.removeEventListener("touchstart", playSplashSoundFallback);
}

function playSplashSoundFallback() {
    playSplashSound();
}

// Cơ chế fallback khi WebView di động chặn tự động phát âm thanh (autoplay policy)
// Nhạc sẽ phát ngay khi người dùng chạm ngón tay vào màn hình lần đầu tiên
document.addEventListener("click", playSplashSoundFallback, { once: true });
document.addEventListener("touchstart", playSplashSoundFallback, { once: true });

// --- ĐÓNG MÀN HÌNH CHÀO SPLASH SCREEN ---
function hideSplashScreen() {
    // Cố gắng phát âm thanh chào mừng ngay khi khởi động
    playSplashSound();
    
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.remove();
            }, 500);
        }
    }, 1800); // Hiển thị màn hình chào trong 1.8 giây giống Zalo
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hideSplashScreen);
} else {
    hideSplashScreen();
}

// ═══════════════════════════════════════════════════════════════════
// TÍNH NĂNG MỚI: GHIM TIN NHẮN (Pin Messages)
// ═══════════════════════════════════════════════════════════════════

let pinnedMessages = [];
let currentPinnedIndex = 0;

async function loadPinnedMessages(conversationId) {
    try {
        const res = await fetch(`/api/chat/${conversationId}/pins`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
            // Chuẩn hóa cấu trúc dữ liệu để luôn có cả 'id' và 'messageId'
            pinnedMessages = data.data.map(p => ({
                ...p,
                id: p.id || p.messageId,
                messageId: p.messageId || p.id
            }));
            currentPinnedIndex = 0;
            renderPinnedBar();
        } else {
            pinnedMessages = [];
            hidePinnedBar();
        }
    } catch (err) {
        console.error("Lỗi load pinned messages:", err);
    }
}

function renderPinnedBar() {
    const bar = document.getElementById("pinned-bar");
    const text = document.getElementById("pinned-bar-text");
    if (!bar || !text || pinnedMessages.length === 0) return;

    const pin = pinnedMessages[currentPinnedIndex];
    let preview = pin.content || "";
    if (pin.type === "image") preview = "[Hình ảnh]";
    else if (pin.type === "audio") preview = "[Tin nhắn thoại]";
    else if (pin.type === "file") preview = "[Tệp tin]";
    if (preview.length > 50) preview = preview.substring(0, 50) + "...";

    text.innerHTML = `<strong>${pin.senderName}:</strong> ${preview}`;
    bar.style.display = "flex";
    document.body.classList.add("has-pinned-bar"); // 🌟 Báo để dịch khung chat xuống trên mobile
}

function hidePinnedBar() {
    const bar = document.getElementById("pinned-bar");
    if (bar) bar.style.display = "none";
    document.body.classList.remove("has-pinned-bar"); // 🌟 Báo để dịch khung chat về bình thường trên mobile
}

// Event listeners cho pinned bar
const initPinnedBarEvents = () => {
    const prevBtn = document.getElementById("pinned-prev-btn");
    const nextBtn = document.getElementById("pinned-next-btn");
    const closeBtn = document.getElementById("pinned-close-btn");
    const barContent = document.querySelector(".pinned-bar-content");

    if (prevBtn) prevBtn.onclick = () => {
        if (pinnedMessages.length === 0) return;
        currentPinnedIndex = (currentPinnedIndex - 1 + pinnedMessages.length) % pinnedMessages.length;
        renderPinnedBar();
    };
    if (nextBtn) nextBtn.onclick = () => {
        if (pinnedMessages.length === 0) return;
        currentPinnedIndex = (currentPinnedIndex + 1) % pinnedMessages.length;
        renderPinnedBar();
    };
    if (closeBtn) closeBtn.onclick = () => hidePinnedBar();
    
    // Nút bỏ ghim tin nhắn này (trash icon)
    const unpinBtn = document.getElementById("pinned-unpin-btn");
    if (unpinBtn) {
        unpinBtn.onclick = () => {
            if (pinnedMessages.length === 0) return;
            const pin = pinnedMessages[currentPinnedIndex];
            pinMessage(pin.id);
        };
    }
    if (barContent) barContent.onclick = () => {
        if (pinnedMessages.length === 0) return;
        const pin = pinnedMessages[currentPinnedIndex];
        scrollToMessage(pin.id);
    };
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPinnedBarEvents);
} else {
    initPinnedBarEvents();
}

function scrollToMessage(messageId) {
    const el = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "background 0.3s";
        el.style.background = "rgba(255, 235, 59, 0.3)";
        setTimeout(() => { el.style.background = ""; }, 2000);
    }
}

async function pinMessage(messageId) {
    try {
        const res = await fetch(`/api/chat/messages/${messageId}/pin`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!data.success) {
            alert(data.message || "Lỗi khi ghim tin nhắn");
        }
    } catch (err) {
        console.error("Lỗi ghim tin nhắn:", err);
    }
}

// Socket listeners cho pin & tin nhắn tự hủy
const initSocketPinListeners = (socketInstance) => {
    if (!socketInstance) return;
    socketInstance.on("message_pinned", (data) => {
        // Chuẩn hóa dữ liệu
        const normalized = {
            ...data,
            id: data.id || data.messageId,
            messageId: data.messageId || data.id
        };
        pinnedMessages.unshift(normalized);
        if (pinnedMessages.length > 3) pinnedMessages = pinnedMessages.slice(0, 3);
        currentPinnedIndex = 0;
        renderPinnedBar();

        // 🌟 Đồng bộ cập nhật DOM của tin nhắn bong bóng ngay lập tức
        const msgId = normalized.id;
        const msgEl = document.querySelector(`.message[data-message-id="${msgId}"]`);
        if (msgEl) {
            msgEl.classList.add("pinned-message");
            const msgContent = msgEl.querySelector(".message-content");
            if (msgContent && !msgContent.querySelector(".message-pin-badge")) {
                const pinBadge = document.createElement("div");
                pinBadge.className = "message-pin-badge";
                pinBadge.innerHTML = '<i class="fas fa-thumbtack"></i>';
                pinBadge.title = "Tin nhắn được ghim";
                msgContent.appendChild(pinBadge);
            }
            const pinAction = msgEl.querySelector(".pin-action");
            if (pinAction) pinAction.innerText = "Bỏ ghim";
        }
        const msgIndex = currentChatMessages.findIndex(m => m.id === msgId);
        if (msgIndex !== -1) {
            currentChatMessages[msgIndex].isPinned = true;
        }
    });

    socketInstance.on("message_unpinned", (data) => {
        const unpinId = data.id || data.messageId;
        pinnedMessages = pinnedMessages.filter((p) => {
            const pId = p.id || p.messageId;
            return pId !== unpinId;
        });

        if (pinnedMessages.length === 0) {
            hidePinnedBar();
        } else {
            currentPinnedIndex = 0;
            renderPinnedBar();
        }

        // 🌟 Đồng bộ gỡ bỏ pin badge khỏi bong bóng tin nhắn DOM ngay lập tức
        const msgEl = document.querySelector(`.message[data-message-id="${unpinId}"]`);
        if (msgEl) {
            msgEl.classList.remove("pinned-message");
            const pinBadge = msgEl.querySelector(".message-pin-badge");
            if (pinBadge) pinBadge.remove();
            const pinAction = msgEl.querySelector(".pin-action");
            if (pinAction) pinAction.innerText = "Ghim tin nhắn";
        }
        const msgIndex = currentChatMessages.findIndex(m => m.id === unpinId);
        if (msgIndex !== -1) {
            currentChatMessages[msgIndex].isPinned = false;
        }
    });

    socketInstance.on("pin_error", (data) => {
        alert(data.message);
    });

    // Socket listener cho tin nhắn tự hủy
    socketInstance.on("message_self_destructed", (data) => {
        const el = document.querySelector(`.message[data-message-id="${data.messageId}"]`);
        if (el) {
            el.classList.add("message-self-destructing");
            setTimeout(() => el.remove(), 600);
        }
        // Cập nhật lại mảng tin nhắn
        if (typeof currentChatMessages !== "undefined") {
            const idx = currentChatMessages.findIndex((m) => m.id === data.messageId);
            if (idx !== -1) {
                currentChatMessages[idx].isRecalled = true;
                currentChatMessages[idx].content = "Tin nhắn tự hủy";
            }
        }
    });
};


// ═══════════════════════════════════════════════════════════════════
// TÍNH NĂNG MỚI: TÌM KIẾM TIN NHẮN (Search Messages)
// ═══════════════════════════════════════════════════════════════════

let searchResults = [];
let currentSearchIndex = -1;
let searchDebounceTimer = null;

function toggleSearchBar() {
    const bar = document.getElementById("search-bar");
    if (!bar) return;
    if (bar.style.display === "none" || !bar.style.display) {
        bar.style.display = "flex";
        document.getElementById("search-input").focus();
    } else {
        closeSearchBar();
    }
}

function closeSearchBar() {
    const bar = document.getElementById("search-bar");
    if (bar) bar.style.display = "none";
    document.getElementById("search-input").value = "";
    document.getElementById("search-result-count").textContent = "";
    clearSearchHighlights();
    searchResults = [];
    currentSearchIndex = -1;
}

function clearSearchHighlights() {
    document.querySelectorAll(".message-search-highlight, .message-search-active").forEach((el) => {
        el.classList.remove("message-search-highlight", "message-search-active");
    });
}

async function performSearch(query) {
    if (!query.trim() || !currentConversationId) return;

    try {
        const res = await fetch(`/api/chat/${currentConversationId}/search?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
            searchResults = data.data;
            currentSearchIndex = searchResults.length > 0 ? 0 : -1;
            document.getElementById("search-result-count").textContent =
                searchResults.length > 0 ? `1/${searchResults.length}` : "0 kết quả";

            clearSearchHighlights();
            // Highlight tất cả kết quả
            searchResults.forEach((r) => {
                const el = document.querySelector(`.message[data-message-id="${r.id}"]`);
                if (el) el.classList.add("message-search-highlight");
            });
            // Cuộn đến kết quả đầu tiên
            if (currentSearchIndex >= 0) {
                navigateSearchResult(currentSearchIndex);
            }
        }
    } catch (err) {
        console.error("Lỗi tìm kiếm tin nhắn:", err);
    }
}

function navigateSearchResult(index) {
    if (searchResults.length === 0 || index < 0 || index >= searchResults.length) return;

    // Bỏ active cũ
    document.querySelectorAll(".message-search-active").forEach((el) => {
        el.classList.remove("message-search-active");
    });

    const result = searchResults[index];
    const el = document.querySelector(`.message[data-message-id="${result.id}"]`);
    if (el) {
        el.classList.add("message-search-active");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    document.getElementById("search-result-count").textContent = `${index + 1}/${searchResults.length}`;
}

// Event listeners cho search bar
const initSearchEvents = () => {
    const searchInput = document.getElementById("search-input");
    const prevBtn = document.getElementById("search-prev-btn");
    const nextBtn = document.getElementById("search-next-btn");
    const closeBtn = document.getElementById("search-close-btn");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                performSearch(searchInput.value);
            }, 400);
        });
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeSearchBar();
            if (e.key === "Enter") {
                e.preventDefault();
                if (searchResults.length > 0) {
                    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
                    navigateSearchResult(currentSearchIndex);
                }
            }
        });
    }
    if (prevBtn) prevBtn.onclick = () => {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        navigateSearchResult(currentSearchIndex);
    };
    if (nextBtn) nextBtn.onclick = () => {
        if (searchResults.length === 0) return;
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
        navigateSearchResult(currentSearchIndex);
    };
    if (closeBtn) closeBtn.onclick = closeSearchBar;
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSearchEvents);
} else {
    initSearchEvents();
}


// ═══════════════════════════════════════════════════════════════════
// TÍNH NĂNG MỚI: CHUYỂN TIẾP TIN NHẮN (Forward Messages)
// ═══════════════════════════════════════════════════════════════════

let forwardMessageId = null;
let selectedForwardConversations = [];

function openForwardModal(messageId) {
    forwardMessageId = messageId;
    selectedForwardConversations = [];
    const overlay = document.getElementById("forward-modal-overlay");
    if (overlay) overlay.style.display = "flex";
    renderForwardList();
    updateForwardSendBtn();
}

function closeForwardModal() {
    const overlay = document.getElementById("forward-modal-overlay");
    if (overlay) overlay.style.display = "none";
    forwardMessageId = null;
    selectedForwardConversations = [];
}

function renderForwardList() {
    const list = document.getElementById("forward-conversation-list");
    if (!list) return;
    list.innerHTML = "";

    // Dùng danh sách conversation đã có trong bộ nhớ
    if (typeof allConversations === "undefined" || allConversations.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-light);">Không có cuộc trò chuyện nào</div>';
        return;
    }

    allConversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = "forward-item";
        item.dataset.convId = conv.id;

        const avatar = document.createElement("img");
        avatar.className = "forward-item-avatar";
        avatar.src = conv.partnerAvatar || "/api/users/" + conv.partnerId + "/avatar";
        avatar.alt = conv.partnerName || "Avatar";

        const name = document.createElement("div");
        name.className = "forward-item-name";
        name.textContent = conv.partnerName || conv.name || "Cuộc trò chuyện";

        const check = document.createElement("div");
        check.className = "forward-item-check";

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(check);

        item.onclick = () => {
            item.classList.toggle("selected");
            const convId = item.dataset.convId;
            if (item.classList.contains("selected")) {
                selectedForwardConversations.push(convId);
            } else {
                selectedForwardConversations = selectedForwardConversations.filter((id) => id !== convId);
            }
            updateForwardSendBtn();
        };

        list.appendChild(item);
    });
}

function filterForwardList() {
    const query = document.getElementById("forward-search-input").value.toLowerCase();
    const items = document.querySelectorAll(".forward-item");
    items.forEach((item) => {
        const name = item.querySelector(".forward-item-name").textContent.toLowerCase();
        item.style.display = name.includes(query) ? "flex" : "none";
    });
}

function updateForwardSendBtn() {
    const btn = document.getElementById("forward-send-btn");
    if (btn) {
        btn.disabled = selectedForwardConversations.length === 0;
        btn.textContent = selectedForwardConversations.length > 0
            ? `Gửi (${selectedForwardConversations.length})`
            : "Gửi";
    }
}

async function executeForward() {
    if (!forwardMessageId || selectedForwardConversations.length === 0) return;

    try {
        const res = await fetch("/api/chat/messages/forward", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messageId: forwardMessageId, conversationIds: selectedForwardConversations }),
        });
        const data = await res.json();
        if (data.success) {
            closeForwardModal();
        } else {
            alert(data.message || "Lỗi chuyển tiếp tin nhắn");
        }
    } catch (err) {
        console.error("Lỗi chuyển tiếp:", err);
        alert("Lỗi kết nối khi chuyển tiếp tin nhắn");
    }
}


// ═══════════════════════════════════════════════════════════════════
// TÍNH NĂNG MỚI: LINK PREVIEW (Xem Trước Liên Kết)
// ═══════════════════════════════════════════════════════════════════

const linkPreviewCache = {};

function extractFirstURL(text) {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
}

async function fetchLinkPreview(url) {
    if (linkPreviewCache[url]) return linkPreviewCache[url];

    try {
        const res = await fetch(`/api/chat/link-preview?url=${encodeURIComponent(url)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
            linkPreviewCache[url] = data.data;
            return data.data;
        }
    } catch (err) {
        console.error("Lỗi fetch link preview:", err);
    }
    return null;
}

function createLinkPreviewCard(preview) {
    const card = document.createElement("a");
    card.className = "link-preview-card";
    card.href = preview.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    let html = "";
    if (preview.image) {
        html += `<img class="link-preview-image" src="${preview.image}" alt="${preview.title || ''}" onerror="this.style.display='none'" />`;
    }
    html += `<div class="link-preview-info">`;
    if (preview.title) html += `<div class="link-preview-title">${preview.title}</div>`;
    if (preview.description) html += `<div class="link-preview-desc">${preview.description}</div>`;
    if (preview.siteName) html += `<div class="link-preview-site">${preview.siteName}</div>`;
    html += `</div>`;

    card.innerHTML = html;
    return card;
}

// Tự động thêm link preview khi render tin nhắn text có URL
async function attachLinkPreview(messageElement, textContent) {
    const url = extractFirstURL(textContent);
    if (!url) return;

    const preview = await fetchLinkPreview(url);
    if (!preview || (!preview.title && !preview.description)) return;

    const bubble = messageElement.querySelector(".message-content");
    if (bubble && !bubble.querySelector(".link-preview-card")) {
        const card = createLinkPreviewCard(preview);
        bubble.appendChild(card);
    }
}

// ═══════════════════════════════════════════════════════════════════
// TÍNH NĂNG MESSENGER: CUSTOM REACTION PICKER & WORD EFFECTS
// ═══════════════════════════════════════════════════════════════════

function openCustomReactionPicker(messageId, clientX, clientY) {
    const oldPicker = document.getElementById("custom-reaction-picker");
    if (oldPicker) oldPicker.remove();

    const picker = document.createElement("div");
    picker.id = "custom-reaction-picker";
    picker.className = "custom-reaction-picker";

    const popularEmojis = [
        "👍", "❤️", "😂", "😮", "😢", "😡", 
        "🔥", "🎉", "👏", "🙌", "🤔", "💯", 
        "👀", "🚀", "💡", "🤫", "💩", "🤡", 
        "🙏", "✨", "🤝", "🥳", "💔", "✔️"
    ];

    const pickerContent = document.createElement("div");
    pickerContent.className = "custom-reaction-picker-content";

    popularEmojis.forEach((emoji) => {
        const span = document.createElement("span");
        span.className = "custom-reaction-item";
        span.innerText = emoji;
        span.onclick = (e) => {
            e.stopPropagation();
            reactToMessage(messageId, emoji);
            picker.remove();
            hideMobileOverlay();
        };
        pickerContent.appendChild(span);
    });

    picker.appendChild(pickerContent);
    document.body.appendChild(picker);

    if (window.innerWidth <= 768) {
        picker.style.left = "50%";
        picker.style.top = "50%";
        picker.style.transform = "translate(-50%, -50%)";
        picker.style.position = "fixed";
    } else {
        const pickerWidth = 240;
        const pickerHeight = 160;
        let left = clientX - pickerWidth / 2;
        let top = clientY - pickerHeight - 10;
        if (left < 10) left = 10;
        if (left + pickerWidth > window.innerWidth) left = window.innerWidth - pickerWidth - 10;
        if (top < 10) top = clientY + 10;
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
        picker.style.position = "absolute";
    }

    const closeHandler = () => {
        picker.remove();
        document.removeEventListener("click", closeHandler);
        hideMobileOverlay();
    };
    setTimeout(() => {
        document.addEventListener("click", closeHandler);
    }, 50);
}

function triggerWordEffects(text) {
    if (!text) return;
    const lower = text.toLowerCase();
    
    let emoji = "";
    if (lower.includes("yêu") || lower.includes("love") || lower.includes("thương") || lower.includes("tim")) {
        emoji = "❤️";
    } else if (lower.includes("chúc mừng") || lower.includes("sinh nhật") || lower.includes("birthday") || lower.includes("congrat")) {
        emoji = "🎉";
    } else if (lower.includes("haha") || lower.includes("cười") || lower.includes("lmao") || lower.includes("lol")) {
        emoji = "😂";
    }

    if (emoji) {
        createFullScreenEmojiShower(emoji);
    }
}

function createFullScreenEmojiShower(emoji) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999999";
    document.body.appendChild(container);

    const count = 30;
    const isLove = emoji === "❤️";

    for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.innerText = emoji;
        el.style.position = "absolute";
        el.style.fontSize = `${Math.random() * 24 + 16}px`;
        el.style.userSelect = "none";
        
        const startLeft = Math.random() * 100;
        el.style.left = `${startLeft}vw`;

        if (isLove) {
            el.style.bottom = "-50px";
            const duration = Math.random() * 2 + 2;
            const delay = Math.random() * 1.5;
            el.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;
            el.style.opacity = "1";
            container.appendChild(el);

            setTimeout(() => {
                el.style.transform = `translateY(-110vh) translateX(${(Math.random() - 0.5) * 200}px) rotate(${Math.random() * 360}deg)`;
                el.style.opacity = "0";
            }, delay * 1000 + 50);
        } else {
            el.style.top = "-50px";
            const duration = Math.random() * 2 + 2.5;
            const delay = Math.random() * 1.5;
            el.style.transition = `transform ${duration}s linear, opacity ${duration}s linear`;
            el.style.opacity = "1";
            container.appendChild(el);

            setTimeout(() => {
                el.style.transform = `translateY(110vh) translateX(${(Math.random() - 0.5) * 200}px) rotate(${Math.random() * 360}deg)`;
                el.style.opacity = "0";
            }, delay * 1000 + 50);
        }
    }

    setTimeout(() => {
        container.remove();
    }, 6000);
}

// Đăng ký bộ lắng nghe sự kiện kéo thả di động một lần duy nhất tại cấp window để tránh lỗi không nhận sự kiện touchmove/touchend của WebKit/iOS.
window.addEventListener("touchmove", (e) => {
    if (!activeOverlayMessageEl) return;
    if (!e.touches || e.touches.length === 0) return;
    
    const palette = activeOverlayMessageEl.querySelector(".reaction-palette");
    const moreMenu = activeOverlayMessageEl.querySelector(".more-menu");
    if (!palette && !moreMenu) return;
    
    if (e.cancelable) e.preventDefault(); // Chặn cuộn màn hình khi đang kéo chọn
    
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    

    let activeEmojiChild = null;
    let activeActionChild = null;
    
    // 🌟 Định vị thông minh dựa trên khoảng cách (Proximity Distance Detection):
    // Cho phép người dùng trỏ gần đến icon/menu là có thể chọn được, tạo trải nghiệm mượt mà giống Messenger.
    const maxEmojiDistance = 75; // Bán kính nhận diện emoji (pixels)
    if (palette) {
        let minDistance = Infinity;
        Array.from(palette.children).forEach((child) => {
            const rect = child.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.hypot(x - centerX, y - centerY);
            if (dist < minDistance && dist < maxEmojiDistance) {
                minDistance = dist;
                activeEmojiChild = child;
            }
        });
    }

    const maxActionDistance = 60; // Bán kính nhận diện dòng menu (pixels)
    if (moreMenu) {
        let minDistance = Infinity;
        Array.from(moreMenu.children).forEach((child) => {
            const rect = child.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.hypot(x - centerX, y - centerY);
            if (dist < minDistance && dist < maxActionDistance) {
                minDistance = dist;
                activeActionChild = child;
            }
        });
    }
    

    if (palette) {
        Array.from(palette.children).forEach((child) => {
            if (child === activeEmojiChild) {
                child.classList.add("drag-hover");
                if (child.classList.contains("reaction-plus-btn")) {
                    window.dragSelectedEmoji = "PLUS";
                } else {
                    window.dragSelectedEmoji = child.innerText;
                }
            } else {
                child.classList.remove("drag-hover");
            }
        });
    }

    if (moreMenu) {
        Array.from(moreMenu.children).forEach((child) => {
            if (child === activeActionChild) {
                child.classList.add("drag-hover");
                window.dragSelectedAction = child;
            } else {
                child.classList.remove("drag-hover");
            }
        });
    }
    
    // Nếu đang lướt chọn ở khu vực này thì giải phóng highlight ở khu vực khác
    if (activeEmojiChild) {
        window.dragSelectedAction = null;
        if (moreMenu) {
            Array.from(moreMenu.children).forEach((child) => {
                child.classList.remove("drag-hover");
            });
        }
    } else if (activeActionChild) {
        window.dragSelectedEmoji = null;
        if (palette) {
            Array.from(palette.children).forEach((child) => {
                child.classList.remove("drag-hover");
            });
        }
    }
}, { passive: false });

window.addEventListener("touchend", (e) => {

    if (!activeOverlayMessageEl) return;
    
    const palette = activeOverlayMessageEl.querySelector(".reaction-palette");
    const moreMenu = activeOverlayMessageEl.querySelector(".more-menu");
    
    // Khôi phục kích thước các emoji về bình thường
    if (palette) {
        Array.from(palette.children).forEach((child) => {
            child.classList.remove("drag-hover");
        });
    }

    // Khôi phục menu chức năng về bình thường
    if (moreMenu) {
        Array.from(moreMenu.children).forEach((child) => {
            child.classList.remove("drag-hover");
        });
    }

    if (window.dragSelectedEmoji) {
        const currentMsgId = activeOverlayMessageEl.dataset.messageId;
        if (window.dragSelectedEmoji === "PLUS") {
            if (currentMsgId && !currentMsgId.startsWith("optimistic-")) {
                const touch = e.changedTouches ? e.changedTouches[0] : null;
                const clientX = touch ? touch.clientX : window.innerWidth / 2;
                const clientY = touch ? touch.clientY : window.innerHeight / 2;
                openCustomReactionPicker(currentMsgId, clientX, clientY);
                if (palette) palette.classList.remove("show");
            }
        } else {
            if (currentMsgId && !currentMsgId.startsWith("optimistic-")) {
                reactToMessage(currentMsgId, window.dragSelectedEmoji);
            }
            hideMobileOverlay();
        }
        window.dragSelectedEmoji = null;
    } else if (window.dragSelectedAction) {
        const actionToClick = window.dragSelectedAction;
        window.dragSelectedAction = null;
        
        // 🌟 Giải pháp khắc phục lỗi WebKit/iOS WebView chặn gọi click() trên thẻ div phi-tương-tác:
        // Chúng ta sẽ trực tiếp thực thi hàm onclick gán sẵn trên phần tử kèm một event giả lập
        if (typeof actionToClick.onclick === "function") {
            actionToClick.onclick({ stopPropagation: () => {} });
        } else {
            actionToClick.click();
        }
        hideMobileOverlay();
    }
});

