const SERVER_URL = window.location.origin;
const API_URL = `${SERVER_URL}/api`;

// --- NHáº¬N FCM TOKEN Tá»ª FLUTTER HYBRID BRIDGE ---
window.onFlutterFcmTokenReceived = function(fcmTokenVal) {
    console.log("ðŸ”¥ ÄÃ£ nháº­n native FCM Token tá»« Flutter:", fcmTokenVal);
    const userToken = localStorage.getItem("authToken");
    if (!userToken) {
        console.log("ðŸ’¾ ChÆ°a Ä‘Äƒng nháº­p, lÆ°u táº¡m native FCM Token...");
        window.cachedFlutterFcmToken = fcmTokenVal;
        return;
    }
    console.log("ðŸ’¾ Äang gá»­i native FCM Token lÃªn Server...");
    fetch(`${API_URL}/users/fcm-token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + userToken
        },
        body: JSON.stringify({ fcmToken: fcmTokenVal }),
    })
    .then(res => res.json())
    .then(data => console.log("âœ… ÄÃ£ lÆ°u native FCM Token thÃ nh cÃ´ng:", data))
    .catch(err => console.error("âŒ Lá»—i gá»­i native FCM Token:", err));
};
if (window.flutterFcmToken) {
    window.onFlutterFcmTokenReceived(window.flutterFcmToken);
}


function formatUrl(url) {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("data:image")) return url;
    return SERVER_URL + url;
}

// Tá»° Äá»˜NG THAY THáº¾ áº¢NH Lá»–I (404) Báº°NG áº¢NH Máº¶C Äá»ŠNH
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

// --- Há»† THá»NG Ã‚M THANH SYNTHETIC (WEB AUDIO API) ---
const ChatSounds = {
    _ctx: null,
    _unlocked: false, // FIX iOS: ÄÃ¡nh dáº¥u Ä‘Ã£ unlock AudioContext bá»Ÿi user gesture chÆ°a

    _init() {
        if (!this._ctx) {
            this._ctx = new(window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === "suspended") {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    },

    // FIX iOS #9: Unlock AudioContext khi user tÆ°Æ¡ng tÃ¡c láº§n Ä‘áº§u
    // iOS Safari/WKWebView yÃªu cáº§u user gesture Ä‘á»ƒ khá»Ÿi táº¡o AudioContext
    unlock() {
        if (this._unlocked) return;
        try {
            const ctx = this._init();
            // Táº¡o buffer rá»—ng 1 sample Ä‘á»ƒ "Ä‘Ã¡nh thá»©c" AudioContext
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
            this._unlocked = true;
        } catch (e) {
            console.warn("KhÃ´ng thá»ƒ unlock AudioContext:", e.message);
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
            gain.gain.linearRampToValueAtTime(0.65, now + 0.02); // TÄƒng cÆ°á»ng Ä‘á»™ tá»« 0.18 lÃªn 0.65 (siÃªu to)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            console.warn("Lá»—i phÃ¡t Ã¢m thanh gá»­i:", e.message);
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
            gain1.gain.linearRampToValueAtTime(0.55, now + 0.02); // TÄƒng cÆ°á»ng Ä‘á»™ lÃªn 0.55
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
            gain2.gain.linearRampToValueAtTime(0.60, now + 0.04); // TÄƒng cÆ°á»ng Ä‘á»™ lÃªn 0.60
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc2.start(now + 0.03);
            osc2.stop(now + 0.13);
        } catch (e) {
            console.warn("Lá»—i phÃ¡t Ã¢m thanh cáº£m xÃºc:", e.message);
        }
    }
};

// --- QUáº¢N LÃ APP STATE (CAPACITOR / TRÃŒNH DUYá»†T) ---
let isAppInBackground = false;
document.addEventListener("visibilitychange", () => {
    isAppInBackground = document.visibilityState === "hidden";

    if (isAppInBackground) {
        // Gá»­i sá»± kiá»‡n cháº¡y ngáº§m (go_offline) lÃªn socket server
        if (typeof socket !== "undefined" && socket && socket.connected && myId) {
            socket.emit("go_offline");
        }
    } else {
        // Gá»­i sá»± kiá»‡n má»Ÿ láº¡i app (go_online) lÃªn socket server
        if (typeof socket !== "undefined" && socket && socket.connected && myId) {
            socket.emit("go_online");
        }

        // 1. KÃ©o láº¡i tin nháº¯n bá»‹ lá»¡ trong lÃºc trÃ¬nh duyá»‡t ngá»§ Ä‘Ã´ng (máº¥t káº¿t ná»‘i Socket)
        if (typeof loadConversations === "function") loadConversations();
        if (typeof reloadCurrentChat === "function" && currentConversationId)
            reloadCurrentChat();

        // 2. Dá»n dáº¹p cÃ¡c thÃ´ng bÃ¡o Toast cÅ© bá»‹ káº¹t
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
let currentChatPartnerId = null;
let socket = null;
let typingTimeout = null;
let pendingFriendRequests = [];
let notificationsList = [];
let replyingToMessage = null;
let editingMessage = null;
let currentChatMessages = [];
let currentNicknames = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// --- PAGINATION STATE (Tá»‘i Æ°u hiá»‡u nÄƒng) ---
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

// NÃ©n áº£nh báº±ng Canvas á»Ÿ Client-side trÆ°á»›c khi táº£i lÃªn server Ä‘á»ƒ tá»‘i Æ°u hÃ³a RAM & bÄƒng thÃ´ng
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

// Kiá»ƒm tra xem ngÆ°á»i dÃ¹ng cÃ³ Ä‘ang thá»±c sá»± nhÃ¬n vÃ o khung chat khÃ´ng
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

// --- Há»† THá»NG PHÃT VÃ€ KHUáº¾CH Äáº I Ã‚M THANH UNIFIED (WEB AUDIO API) ---
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
        console.log(`ðŸŽµ ÄÃ£ giáº£i mÃ£ vÃ  náº¡p bá»™ nhá»› Ä‘á»‡m Ã¢m thanh: ${key} (${url})`);
        return AudioBuffers[key];
    } catch (e) {
        console.warn(`Lá»—i táº£i/giáº£i mÃ£ Ã¢m thanh ${key}:`, e.message);
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
            console.warn(`Ã‚m thanh ${key} chÆ°a táº£i xong, phÃ¡t dá»± phÃ²ng báº±ng HTMLAudioElement`);
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
        gainNode.gain.value = gainValue; // Khuáº¿ch Ä‘áº¡i Ã¢m lÆ°á»£ng lÃªn gáº¥p gainValue láº§n (má»©c to vÆ°á»£t tráº§n)

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);

        activeSources[key] = source;
        activeGains[key] = gainNode;
    } catch (e) {
        console.warn(`Lá»—i phÃ¡t Web Audio ${key}:`, e.message);
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
        console.warn(`Lá»—i dá»«ng Web Audio ${key}:`, e.message);
    }
}

// --- Má»ž KHÃ“A Ã‚M THANH TRÃŒNH DUYá»†T (CHá»NG CHáº¶N AUTOPLAY) ---
let isAudioUnlocked = false;

function unlockBrowserAudio() {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;
    // FIX iOS #9: Unlock ChatSounds AudioContext cÃ¹ng lÃºc
    if (typeof ChatSounds !== 'undefined' && ChatSounds.unlock) {
        ChatSounds.unlock();
    }
    
    // 1. Má»Ÿ khÃ³a AudioContext
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
        ctx.resume();
    }

    // 2. Táº£i trÆ°á»›c toÃ n bá»™ Ã¢m thanh vÃ o bá»™ nhá»› Ä‘á»‡m
    preloadAllSounds();

    const UNLOCK_EVENTS = ["click", "touchstart", "touchend", "mousedown", "keydown"];
    UNLOCK_EVENTS.forEach(event => {
        document.removeEventListener(event, unlockBrowserAudio);
    });
    console.log("ðŸ”Š Táº¥t cáº£ kÃªnh Ã¢m thanh Ä‘Ã£ Ä‘Æ°á»£c má»Ÿ khÃ³a trá»±c tiáº¿p thÃ nh cÃ´ng!");
}

const UNLOCK_EVENTS = ["click", "touchstart", "touchend", "mousedown", "keydown"];
UNLOCK_EVENTS.forEach(event => {
    document.addEventListener(event, unlockBrowserAudio, { passive: true });
});

// CÆ¡ cháº¿ unlock rung (Vibration Gesture Lock) cho thiáº¿t bá»‹ di Ä‘á»™ng
let isVibrationUnlocked = false;

function unlockBrowserVibration() {
    if (isVibrationUnlocked) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
            navigator.vibrate(10); // Rung nháº¹ 10ms Ä‘á»ƒ giáº£i phÃ³ng Gesture Lock cá»§a trÃ¬nh duyá»‡t
            isVibrationUnlocked = true;
        } catch (e) {
            console.warn("Lá»—i unlock rung Ä‘iá»‡n thoáº¡i:", e);
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
    avatar.title = "ÄÃ£ xem";
    avatar.alt = "ÄÃ£ xem";
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
    statusEl.append(icon, document.createTextNode(" ÄÃ£ gá»­i"));
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
        // Náº¿u lastReadMessageId khÃ´ng khá»›p DOM (tin nháº¯n chÆ°a render), láº¥y tin cuá»‘i cÃ³ isRead=true
    }

    // Fallback: tÃ¬m tin nháº¯n cá»§a mÃ¬nh Ä‘Æ°á»£c Ä‘á»c cuá»‘i cÃ¹ng theo data attribute
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

        // Guard: chá»‰ cáº­p nháº­t náº¿u readReceiptState thuá»™c conversation hiá»‡n táº¡i
        if (
            readReceiptState.conversationId &&
            !isSameId(readReceiptState.conversationId, currentConversationId)
        )
            return;

        const myMessages = [...messagesDiv.querySelectorAll(".my-message")];
        if (myMessages.length === 0) return;

        const targetMessage = getReadReceiptTarget(myMessages);

        // BÆ°á»›c 1: XÃ³a sáº¡ch toÃ n bá»™ tráº¡ng thÃ¡i cÅ© trÃªn táº¥t cáº£ tin nháº¯n cá»§a mÃ¬nh
        myMessages.forEach((message) =>
            clearMessageStatus(getMessageStatus(message)),
        );

        if (targetMessage) {
            // BÆ°á»›c 2: ÄÃ¡nh dáº¥u dataset cho cÃ¡c tin nháº¯n Ä‘Ã£ Ä‘Æ°á»£c Ä‘á»c
            markMessagesReadThrough(myMessages, targetMessage);

            // BÆ°á»›c 3: Hiá»ƒn thá»‹ avatar "ÄÃ£ xem" ngay bÃªn dÆ°á»›i tin nháº¯n Ä‘Æ°á»£c Ä‘á»c cuá»‘i cÃ¹ng
            const targetStatusEl = getMessageStatus(targetMessage);
            if (targetStatusEl) {
                targetStatusEl.classList.add("read");
                targetStatusEl.appendChild(createReadReceiptAvatar());
            }

            // BÆ°á»›c 4: Hiá»ƒn thá»‹ "ÄÃ£ gá»­i" cho Táº¤T Cáº¢ tin nháº¯n cá»§a mÃ¬nh SAU targetMessage
            const targetIndex = myMessages.indexOf(targetMessage);
            myMessages.forEach((message, index) => {
                if (index > targetIndex) {
                    renderSentStatus(getMessageStatus(message));
                }
            });
        } else {
            // ChÆ°a cÃ³ ai Ä‘á»c: chá»‰ hiá»ƒn thá»‹ "ÄÃ£ gá»­i" á»Ÿ tin nháº¯n CUá»I CÃ™NG
            const lastMyMessage = myMessages[myMessages.length - 1];
            if (lastMyMessage) {
                renderSentStatus(getMessageStatus(lastMyMessage));
            }
        }
    } catch (error) {
        console.error("[DOM Error] Lá»—i khi cáº­p nháº­t avatar ÄÃ£ xem:", error);
    }
}

// Cáº­p nháº­t badge chÆ°a Ä‘á»c vÃ  kiá»ƒu chá»¯ thÆ°á»ng cá»§a Item Chat cá»¥c bá»™ khi nháº­n sá»± kiá»‡n Ä‘Ã£ Ä‘á»c tá»« Socket
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
        console.error("[DOM Error] Lá»—i cáº­p nháº­t badge Ä‘Ã£ xem cá»¥c bá»™:", err);
    }
}

function emitMarkMessagesRead() {
    if (!currentConversationId || !socket || !myId) return;
    socket.emit("mark_messages_read", {
        conversationId: currentConversationId,
        userId: myId,
    });
}

// --- BIáº¾N TOÃ€N Cá»¤C CHO WEBRTC ---
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

// --- BIáº¾N TOÃ€N Cá»¤C CHO CÃC TÃNH NÄ‚NG TÃ™Y CHá»ŒN ---
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

// --- QUáº¢N LÃ OVERLAY LOADING TOÃ€N Cá»¤C ---
function showLoading(text = "Äang xá»­ lÃ½...") {
    const loadingEl = document.getElementById("global-loading");
    const textEl = document.getElementById("loading-text");
    if (textEl) textEl.innerText = text;
    if (loadingEl) loadingEl.style.display = "flex";
}

function hideLoading() {
    const loadingEl = document.getElementById("global-loading");
    if (loadingEl) loadingEl.style.display = "none";
}

// --- HÃ€M Há»– TRá»¢: Láº¥y Avatar Ä‘á»‘i tÃ¡c an toÃ n tuyá»‡t Ä‘á»‘i ---
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

// --- QUáº¢N LÃ OVERLAY TRÃŠN MOBILE ---
function hideMobileOverlay() {
    const overlay = document.getElementById("mobile-action-overlay");
    if (overlay) overlay.classList.remove("show");
    document.body.classList.remove("overlay-active");
    document
        .querySelectorAll(".message.show-mobile-actions")
        .forEach((m) => {
            m.classList.remove("show-mobile-actions");
            m.classList.remove("flip-up");
        });
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
        overlay.addEventListener("click", hideMobileOverlay);
        overlay.addEventListener("touchstart", hideMobileOverlay, {
            passive: true,
        });
        overlay.addEventListener("touchmove", (e) => e.preventDefault(), {
            passive: false,
        });
    }
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) {
        messagesDiv.appendChild(overlay);
    } else {
        const chatArea = document.querySelector(".chat-window") || document.body;
        chatArea.appendChild(overlay);
    }

    hideMobileOverlay();
    document.body.classList.add("overlay-active");
    messageEl.classList.add("show-mobile-actions");
    overlay.classList.add("show");

    // Kiem tra vi tri tin nhan: neu gan day man hinh, dao nguoc action panel len tren
    requestAnimationFrame(() => {
        // Cuá»™n tin nháº¯n vÃ o vá»‹ trÃ­ hiá»ƒn thá»‹ tá»‘t nháº¥t (á»Ÿ giá»¯a mÃ n hÃ¬nh) Ä‘á»ƒ trÃ¡nh bá»‹ che khuáº¥t bá»Ÿi bÃ n phÃ­m hoáº·c input area
        messageEl.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
            const rect = messageEl.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Cáº§n Ã­t nháº¥t 270px cho reaction palette + menu
            if (spaceBelow < 270) {
                messageEl.classList.add("flip-up");
            } else {
                messageEl.classList.remove("flip-up");
            }
        }, 150);
    });
}

// Há»‡ thá»‘ng gÃ i quÃ©t lá»—i toÃ n cá»¥c
window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (
        typeof msg === "string" &&
        (msg.includes("ResizeObserver") ||
            msg.includes("zaloJSV2") ||
            msg.includes("zaloJS"))
    ) {
        return true;
    }
    console.error("Lá»—i há»‡ thá»‘ng:", msg);
    return false;
};

// 0. Chuyá»ƒn Ä‘á»•i giá»¯a ÄÄƒng nháº­p / ÄÄƒng kÃ½
function toggleAuth(type) {
    if (type === "register") {
        document.getElementById("login-form").style.display = "none";
        document.getElementById("register-form").style.display = "block";
    } else {
        document.getElementById("login-form").style.display = "block";
        document.getElementById("register-form").style.display = "none";
    }
}

// 0.6 áº¨n/hiá»ƒn thá»‹ máº­t kháº©u
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

// 0.5 Xá»­ lÃ½ Ä‘Äƒng kÃ½
async function register() {
    const fullName = document.getElementById("reg-fullname").value;
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;

    if (!fullName || !username || !password)
        return alert("Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin!");

    showLoading("ÄÄƒng kÃ½...");
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, username, password }),
        });
        const data = await res.json();
        if (data.success) {
            alert("ÄÄƒng kÃ½ thÃ nh cÃ´ng! Äang tá»± Ä‘á»™ng Ä‘Äƒng nháº­p...");
            document.getElementById("login-username").value = username;
            document.getElementById("login-password").value = password;
            login();
        } else {
            alert("Lá»—i Ä‘Äƒng kÃ½: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i mÃ¡y chá»§ khi Ä‘Äƒng kÃ½: " + error.message);
    } finally {
        hideLoading();
    }
}

// 1. Khá»Ÿi táº¡o phiÃªn lÃ m viá»‡c (sau khi Ä‘Äƒng nháº­p hoáº·c tá»± Ä‘á»™ng Ä‘Äƒng nháº­p thÃ nh cÃ´ng)
function initizeChatSession(userData, userToken) {
    token = userToken;
    myId = userData.id;
    myName = userData.fullName || userData.username;
    myUsername = userData.username || "";

    if (window.cachedFlutterFcmToken) {
        window.onFlutterFcmTokenReceived(window.cachedFlutterFcmToken);
        window.cachedFlutterFcmToken = null;
    }

    // Cáº­p nháº­t lá»i chÃ o Trá»£ lÃ½ AI khi khá»Ÿi táº¡o session
    const welcomeTitle = document.getElementById("ai-welcome-title");
    if (welcomeTitle) {
        welcomeTitle.innerText = `HÃ´m nay báº¡n tháº¿ nÃ o, ${myUsername || "báº¡n"}?`;
    }

    document.getElementById("my-name").innerText = myName;
    document.getElementById("my-avatar").src = userData.avatar ?
        formatUrl(userData.avatar) :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=random`;

    // Äá»“ng bá»™ thÃ´ng tin sang Tab CÃ¡ nhÃ¢n vÃ  cÃ¡c Modal liÃªn quan
    if (document.getElementById("my-name-personal-tab"))
        document.getElementById("my-name-personal-tab").innerText = myName;
    if (document.getElementById("my-avatar-personal-tab"))
        document.getElementById("my-avatar-personal-tab").src = document.getElementById("my-avatar").src;

    // Äá»“ng bá»™ thÃ´ng tin sang Tab Há»“ sÆ¡
    document.getElementById("profile-name").innerText = myName;
    if (document.getElementById("my-avatar-profile"))
        document.getElementById("my-avatar-profile").src =
        document.getElementById("my-avatar").src;
    if (document.getElementById("profile-bio"))
        document.getElementById("profile-bio").innerText =
        userData.bio || "ChÆ°a cÃ³ tiá»ƒu sá»­";
    if (document.getElementById("my-cover")) {
        const coverUrl = userData.coverPhoto || userData.coverImage;
        if (coverUrl) {
            document.getElementById("my-cover").src = formatUrl(coverUrl);
        } else {
            document.getElementById("my-cover").src =
                "https://ui-avatars.com/api/?name=Cover&background=e9ecef&color=333&size=800&font-size=0.1";
        }
    }

    // YÃªu cáº§u quyá»n gá»­i thÃ´ng bÃ¡o trÃªn TrÃ¬nh duyá»‡t Web (Náº¿u chÆ°a cáº¥p) vÃ  khá»Ÿi táº¡o FCM
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    console.log("ðŸ”” Quyá»n thÃ´ng bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c cáº¥p phÃ©p.");
                    setupFirebaseMessaging(userToken);
                } else {
                    console.warn("ðŸ”” Quyá»n thÃ´ng bÃ¡o bá»‹ tá»« chá»‘i.");
                }
            });
        } else if (Notification.permission === "granted") {
            setupFirebaseMessaging(userToken);
        }
    }

    // Káº¿t ná»‘i Socket.IO Real-time
    socket = io(SERVER_URL);
    socket.on("connect", () => {
        console.log("âš¡ Káº¿t ná»‘i Socket thÃ nh cÃ´ng, Ä‘ang xÃ¡c thá»±c user_connected: " + myId);
        socket.emit("user_connected", myId);
        checkUrlParamsForCall(); // Tá»± Ä‘á»™ng kiá»ƒm tra cuá»™c gá»i cháº¡y ngáº§m khi káº¿t ná»‘i thÃ nh cÃ´ng
    });

    // Xá»­ lÃ½ tÃ¡i káº¿t ná»‘i Socket (ráº¥t quan trá»ng trÃªn di Ä‘á»™ng iOS/Android)
    // Khi Ä‘iá»‡n thoáº¡i máº¥t máº¡ng rá»“i káº¿t ná»‘i láº¡i, Socket.IO tá»± reconnect
    // nhÆ°ng server khÃ´ng biáº¿t user nÃ y online náº¿u khÃ´ng gá»­i láº¡i user_connected
    socket.io.on("reconnect", (attemptNumber) => {
        console.log(`ðŸ”„ Socket Ä‘Ã£ tÃ¡i káº¿t ná»‘i sau ${attemptNumber} láº§n thá»­, Ä‘ang gá»­i láº¡i user_connected: ` + myId);
        socket.emit("user_connected", myId);
        // KÃ©o láº¡i tin nháº¯n bá»‹ lá»¡ trong khi máº¥t káº¿t ná»‘i
        if (typeof loadConversations === "function") loadConversations();
        if (typeof reloadCurrentChat === "function" && currentConversationId) reloadCurrentChat();
    });

    // Log khi socket bá»‹ máº¥t káº¿t ná»‘i (debug di Ä‘á»™ng)
    socket.on("disconnect", (reason) => {
        console.warn("ðŸ”´ Socket bá»‹ ngáº¯t káº¿t ná»‘i. LÃ½ do:", reason);
    });

    // Nghe khi cÃ³ tin tá»©c má»›i Real-time
    socket.on("new_news_broadcast", (newsItem) => {
        if (typeof handleIncomingRealtimeNews === "function") {
            handleIncomingRealtimeNews(newsItem);
        }
    });

    // Nghe danh sÃ¡ch lá»i má»i báº¡n bÃ¨ ban Ä‘áº§u
    socket.on("initial_friend_requests", (requests) => {
        pendingFriendRequests = requests || [];
        renderFriendRequests();
        updateFriendRequestBadge();
    });

    // Nghe khi cÃ³ lá»i má»i káº¿t báº¡n má»›i
    socket.on("new_friend_request", (request) => {
        pendingFriendRequests.unshift(request);
        renderFriendRequests();
        updateFriendRequestBadge(true);
    });

    // Nghe khi mÃ¬nh cháº¥p nháº­n lá»i má»i cá»§a ai Ä‘Ã³
    socket.on("you_accepted_friend_request", async(newFriend) => {
        alert(`Báº¡n vÃ  ${newFriend.fullName} Ä‘Ã£ trá»Ÿ thÃ nh báº¡n bÃ¨!`);
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

    // Nghe khi lá»i má»i cá»§a mÃ¬nh Ä‘Æ°á»£c cháº¥p nháº­n
    socket.on("friend_request_accepted", async(userWhoAccepted) => {
        alert(`${userWhoAccepted.fullName} Ä‘Ã£ cháº¥p nháº­n lá»i má»i cá»§a báº¡n!`);
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

    // Nghe thÃ´ng bÃ¡o toÃ n cá»¥c
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
        // Tá»‘i Æ°u hÃ³a: Cáº­p nháº­t DOM cá»¥c bá»™ láº­p tá»©c thay vÃ¬ gá»i API loadConversations() dÆ° thá»«a gÃ¢y lag
        updateConversationUnreadBadgeLocal(conversationId);
    });

    socket.on("receive_message", (msg) => {
        let shouldMarkAsRead = false;
        const isCurrentChat = isSameId(msg.conversationId, currentConversationId);
        const isFromMe = isSameId(msg.senderId, myId);

        if (isCurrentChat) {
            // 1. Render tin nháº¯n ngay láº­p tá»©c báº±ng tá»‘c Ä‘á»™ cá»§a Socket
            displayMessage(msg);

            // 2. Cáº­p nháº­t tráº¡ng thÃ¡i "ÄÃ£ gá»­i" sau khi render
            updateReadReceiptsDOM();

            // 3. Chá»‰ gá»­i "ÄÃ£ xem" náº¿u mÃ¬nh lÃ  ngÆ°á»i NHáº¬N vÃ  ÄANG THá»°C Sá»° NHÃŒN VÃ€O KHUNG CHAT
            if (!isFromMe && isChatAreaVisible()) {
                emitMarkMessagesRead();
                shouldMarkAsRead = true;
            }

            // XÃ³a UI Typing vÃ  dá»«ng Ã¢m thanh khi nháº­n Ä‘Æ°á»£c tin nháº¯n má»›i tá»« Ä‘á»‘i phÆ°Æ¡ng
            if (!isFromMe) {
                handleStopTyping();
            }
        }

        // 4. PhÃ¡t Ã¢m thanh vÃ  Rung Ä‘iá»‡n thoáº¡i khi cÃ³ tin nháº¯n má»›i tá»« ngÆ°á»i khÃ¡c (Foreground)
        if (!isFromMe) {
            // Chá»‰ phÃ¡t Ã¢m thanh vÃ  rung náº¿u app á»Ÿ Foreground (trÃ¡nh phÃ¡t trÃ¹ng Ã¢m thanh há»‡ thá»‘ng cá»§a iOS/Android)
            if (!isAppInBackground) {
                // PhÃ¡t Ã¢m thanh nháº­n tin nháº¯n synthetic
                ChatSounds.playReceive();

                // Rung pháº£n há»“i nhá»‹p máº¡nh vÃ  lÃ¢u hÆ¡n (Rung 400ms, nghá»‰ 100ms, rung 400ms, nghá»‰ 100ms, rung 600ms)
                if (navigator.vibrate) {
                    try {
                        navigator.vibrate([400, 100, 400, 100, 600]);
                    } catch (err) {
                        console.warn("TrÃ¬nh duyá»‡t hoáº·c há»‡ Ä‘iá»u hÃ nh tá»« chá»‘i cáº¥p quyá»n rung:", err.message);
                    }
                }
            }

            // TÃNH NÄ‚NG Má»šI: TOAST IN-APP VÃ€ NATIVE NOTIFICATION (CAPACITOR)
            if (!isCurrentChat || isAppInBackground) {
                if (isAppInBackground) {
                    sendNativeNotification(msg);
                } else {
                    showNewMessageToast(msg);
                }
            }
        }

        // Cáº­p nháº­t DOM cá»§a danh sÃ¡ch trÃ² chuyá»‡n (Chat List Item) thay vÃ¬ gá»i API
        updateChatListUI(msg, shouldMarkAsRead);
    });

    // Gá»­i sá»± kiá»‡n ÄÃ£ xem khi click vÃ o Ã´ nháº­p tin nháº¯n
    const msgInput = document.getElementById("message-input");
    if (msgInput) {
        msgInput.addEventListener("focus", () => {
            emitMarkMessagesRead();
        });
    }

    // Nghe khi lá»i má»i cá»§a mÃ¬nh bá»‹ tá»« chá»‘i
    socket.on("friend_request_rejected", ({ userId }) => {
        console.log(`NgÆ°á»i dÃ¹ng ${userId} Ä‘Ã£ tá»« chá»‘i lá»i má»i cá»§a báº¡n.`);
    });

    // HÃ m xá»­ lÃ½ dá»«ng gÃµ phÃ­m, áº©n UI vÃ  dá»«ng nháº¡c
    function handleStopTyping() {
        const indicator = document.getElementById("typing-indicator");
        if (indicator) indicator.remove();

        try {
            typingSound.pause();
            typingSound.currentTime = 0;
        } catch (error) {
            console.error("Lá»—i khi dá»«ng phÃ¡t nháº¡c typing:", error);
        }
    }

    // Nghe sá»± kiá»‡n "Äang gÃµ..." (typing)
    socket.on("typing", (info) => {
        // Kiá»ƒm tra xem cÃ³ Ä‘Ãºng lÃ  ngÆ°á»i nháº­n hoáº·c cuá»™c trÃ² chuyá»‡n hiá»‡n táº¡i Ä‘ang má»Ÿ khÃ´ng
        const isCurrentChat = (info.senderId && info.senderId === currentChatPartnerId) ||
            (info.conversationId && info.conversationId === currentConversationId);

        if (!isCurrentChat) return;

        let indicator = document.getElementById("typing-indicator");
        if (!indicator) {
            indicator = document.createElement("div");
            indicator.id = "typing-indicator";
            indicator.className = "typing-indicator";
            const displayName = info.senderName || (document.getElementById("chat-header-name") ? document.getElementById("chat-header-name").innerText : "Äá»‘i phÆ°Æ¡ng");
            indicator.innerHTML = `<span><b>${displayName}</b> Ä‘ang gÃµ</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
            const messagesContainer = document.getElementById("messages");
            if (messagesContainer) {
                messagesContainer.appendChild(indicator);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        // PhÃ¡t nháº¡c soáº¡n tin nháº¯n
        try {
            typingSound.play().catch(err => {
                console.warn("DOMException: TrÃ¬nh duyá»‡t cháº·n tá»± Ä‘á»™ng phÃ¡t Ã¢m thanh typing:", err.message);
            });
        } catch (error) {
            console.error("DOMException typingSound.play():", error);
        }
    });

    // Nghe sá»± kiá»‡n "Dá»«ng gÃµ" má»›i (stop-typing)
    socket.on("stop-typing", (info) => {
        if (info.senderId === currentChatPartnerId) {
            handleStopTyping();
        }
    });

    // Nghe sá»± kiá»‡n "Dá»«ng gÃµ" cÅ© (stop_typing)
    socket.on("stop_typing", (info) => {
        if (info.conversationId === currentConversationId) {
            handleStopTyping();
        }
    });

    // Nghe cÃ¡c sá»± kiá»‡n WebRTC
    socket.on("incoming_call", handleIncomingCall);
    socket.on("did_upgrade_to_video", handleUpgradeToVideo);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("webrtc_signal", handleWebRTCSignal);
    socket.on("call_ended", () => {
        endCall(false);
    });

    // Nghe sá»± kiá»‡n thay Ä‘á»•i tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng (online/offline)
    socket.on("user_status_change", ({ userId, isOnline, lastActive }) => {
        // 1. Cáº­p nháº­t trong danh sÃ¡ch chat (sidebar)
        const sidebarItem = document.querySelector(`#user-list li[data-user-id="${userId}"]`);
        if (sidebarItem) {
            sidebarItem.dataset.isOnline = isOnline ? "true" : "false";
            if (lastActive) sidebarItem.dataset.lastActive = lastActive;

            const dot = sidebarItem.querySelector(".online-dot");
            if (dot) {
                dot.style.display = isOnline ? "block" : "none";
            }
        }

        // 2. Cáº­p nháº­t trong danh sÃ¡ch báº¡n bÃ¨ (náº¿u cÃ³)
        const friendItem = document.querySelector(`.friend-request-item[data-user-id="${userId}"]`);
        if (friendItem) {
            friendItem.dataset.isOnline = isOnline ? "true" : "false";
            const dot = friendItem.querySelector(".online-dot");
            if (dot) {
                dot.style.display = isOnline ? "block" : "none";
            }
        }

        // 3. Cáº­p nháº­t á»Ÿ Chat Header náº¿u Ä‘ang chat vá»›i user nÃ y
        if (typeof currentChatPartnerId !== "undefined" && isSameId(userId, currentChatPartnerId)) {
            updateHeaderStatusUI(isOnline, lastActive);
        }
    });

    // Nghe sá»± kiá»‡n thu há»“i tin nháº¯n
    socket.on("message_recalled", ({ messageId, conversationId }) => {
        if (conversationId === currentConversationId) {
            const msgEl = document.getElementById(`msg-${messageId}`);
            if (msgEl) {
                const content = msgEl.querySelector(".message-content");
                if (content) {
                    content.innerText = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
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

    // Nghe sá»± kiá»‡n chá»‰nh sá»­a tin nháº¯n
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

                    // Reset vÃ  tÃ­nh toÃ¡n láº¡i cÃ¡c class emoji-only
                    msgEl.classList.remove("emoji-only-message");
                    content.classList.remove("emoji-only-1", "emoji-only-2", "emoji-only-3");

                    const emojiCount = getEmojiOnlyCount(newContent);
                    if (emojiCount > 0) {
                        msgEl.classList.add("emoji-only-message");
                        content.classList.add(`emoji-only-${emojiCount}`);
                    }

                    const editedLabel = document.createElement("span");
                    editedLabel.className = "edited-label";
                    editedLabel.innerText = " (Ä‘Ã£ chá»‰nh sá»­a)";
                    editedLabel.style.fontSize = "0.75rem";
                    editedLabel.style.color = "var(--text-light)";
                    editedLabel.style.fontStyle = "italic";
                    content.appendChild(editedLabel);
                }
            }
        }
        loadConversations();
    });

    // Nghe sá»± kiá»‡n cáº£m xÃºc
    socket.on("message_reacted", ({ messageId, reactions, reaction, isRemoved }) => {
        const msgEl = document.getElementById(`msg-${messageId}`);
        if (msgEl) {
            // XÃ¡c Ä‘á»‹nh ai lÃ  ngÆ°á»i thá»±c hiá»‡n hÃ nh Ä‘á»™ng tháº£/gá»¡ cáº£m xÃºc báº±ng cÃ¡ch so sÃ¡nh dataset
            const oldReactions = msgEl.dataset.reactions ? JSON.parse(msgEl.dataset.reactions) : {};
            let changerId = null;

            // Chuyá»ƒn Ä‘á»•i dá»¯ liá»‡u má»›i náº¿u á»Ÿ dáº¡ng chuá»—i
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

            // Render giao diá»‡n má»›i
            renderReactions(msgEl, newReactions);

            // Chá»‰ phÃ¡t Ã¢m thanh vÃ  ná»• hiá»‡u á»©ng náº¿u khÃ´ng pháº£i mÃ¬nh lÃ m vÃ  lÃ  hÃ nh Ä‘á»™ng tháº£ cáº£m xÃºc
            if (reaction && !isRemoved) {
                if (changerId && !isSameId(changerId, myId)) {
                    createReactionBurst(messageId, reaction);
                    ChatSounds.playReact();
                }
            }
        }
    });

    // Nghe sá»± kiá»‡n xoÃ¡ cuá»™c trÃ² chuyá»‡n
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

    // Nghe sá»± kiá»‡n thay Ä‘á»•i chá»§ Ä‘á» chat
    socket.on("conversation_theme_changed", ({ conversationId, theme, systemMessage }) => {
        if (isSameId(conversationId, currentConversationId)) {
            applyChatTheme(theme);
            if (systemMessage) {
                displayMessage(systemMessage);
            }
        }
    });

    // Nghe sá»± kiá»‡n thay Ä‘á»•i biá»‡t danh (Nickname)
    socket.on("nickname_changed", ({ conversationId, targetUserId, nickname, nicknames, systemMessage }) => {
        if (isSameId(conversationId, currentConversationId)) {
            currentNicknames = nicknames || {};
            updateUINames();
            if (systemMessage) {
                displayMessage(systemMessage);
            }
        }
        // Táº£i láº¡i danh sÃ¡ch cuá»™c trÃ² chuyá»‡n á»Ÿ sidebar
        loadConversations();
    });

    // Gáº¯n sá»± kiá»‡n cho cÃ¡c nÃºt trong cuá»™c gá»i
    document.getElementById("reject-call-btn").onclick = () => endCall(true);
    document.getElementById("end-call-btn").onclick = () => endCall(true);

    // Chuyá»ƒn sang mÃ n hÃ¬nh chat
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "flex";
    // Hiá»ƒn thá»‹ Tab Bar (Ä‘Ã£ chuyá»ƒn ra ngoÃ i #chat-screen)
    const tabBar = document.getElementById("main-tab-bar");
    if (tabBar) tabBar.style.display = "";

    loadConversations();
    loadFriends();
    loadNotifications();
    updateNotificationPermissionUI();

    // â”€â”€ Khá»Ÿi táº¡o tab máº·c Ä‘á»‹nh (Tin nháº¯n) vÃ  vá»‹ trÃ­ thanh trÆ°á»£t slider-pill (Fix lá»—i khuáº¥t tab khi má»›i vÃ o app) â”€â”€
    const defaultTab = document.querySelector('.sidebar .nav-item') || document.querySelector('.nav-item[title="Tin nháº¯n"]');
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

// --- ÄÄ‚NG KÃ VÃ€ Cáº¤U HÃŒNH FIREBASE CLOUD MESSAGING (Láº¤Y FCM TOKEN) ---
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

            // Láº¯ng nghe FCM khi app Ä‘ang má»Ÿ (Foreground) â€” trÃ¡nh bá» lá»¡ hoáº·c trÃ¹ng láº·p thÃ´ng bÃ¡o
            messaging.onMessage((payload) => {
                console.log("ðŸ“© Nháº­n FCM notification khi app Ä‘ang má»Ÿ (foreground):", payload);
                // KhÃ´ng cáº§n hiá»ƒn thá»‹ notification vÃ¬ Socket.IO Ä‘Ã£ xá»­ lÃ½ real-time
                // Chá»‰ log Ä‘á»ƒ debug, trÃ¡nh hiá»‡n notification trÃ¹ng láº·p
            });

            // ÄÄƒng kÃ½ Service Worker tÆ°á»ng minh
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/firebase-messaging-sw.js')
                    .then((registration) => {
                        console.log("ðŸ”¥ Service Worker FCM Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ thÃ nh cÃ´ng!");
                        // Chá»§ Ä‘á»™ng kiá»ƒm tra cáº­p nháº­t má»›i Ä‘á»ƒ kÃ­ch hoáº¡t thay Ä‘á»•i tá»©c thÃ¬
                        registration.update();
                        return messaging.getToken({
                            serviceWorkerRegistration: registration,
                            vapidKey: "BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0",
                        });
                    })
                    .then((currentToken) => {
                        if (currentToken) {
                            console.log("ðŸ”¥ ÄÃ£ láº¥y Ä‘Æ°á»£c FCM Token:", currentToken);
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
                                    console.log("ðŸ’¾ ÄÃ£ lÆ°u thÃ nh cÃ´ng FCM Token lÃªn server:", data);
                                })
                                .catch(err => console.error("âŒ Lá»—i gá»­i FCM Token lÃªn Server:", err));
                        } else {
                            console.warn("âš ï¸ KhÃ´ng láº¥y Ä‘Æ°á»£c token FCM. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh.");
                        }
                    })
                    .catch((err) => {
                        console.error("âŒ Lá»—i khi Ä‘Äƒng kÃ½ Service Worker hoáº·c láº¥y token FCM:", err);
                    });
            } else {
                // Fallback náº¿u trÃ¬nh duyá»‡t khÃ´ng há»— trá»£ Service Worker
                messaging.getToken({
                        vapidKey: "BBtraQSvar7RExe_T8aVhoA3TebgLw0S-ucoMcuV-Oef-H7ULkJGWyBctnxfY5tLnawpWQ9Wn8Aihi-wJaLiGu0",
                    })
                    .then((currentToken) => {
                        if (currentToken) {
                            console.log("ðŸ”¥ ÄÃ£ láº¥y Ä‘Æ°á»£c FCM Token (fallback):", currentToken);
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
                    .catch((err) => console.error("âŒ Lá»—i khi láº¥y FCM token fallback:", err));
            }
        } catch (error) {
            console.error("Lá»—i cáº¥u hÃ¬nh Firebase Frontend:", error);
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

// 2. Táº£i danh sÃ¡ch cuá»™c trÃ² chuyá»‡n gáº§n Ä‘Ã¢y
async function loadConversations() {
    const userList = document.getElementById("user-list");
    // Chá»‰ hiá»ƒn thá»‹ skeleton náº¿u danh sÃ¡ch hiá»‡n táº¡i Ä‘ang trá»‘ng (láº§n Ä‘áº§u load hoáº·c sau khi clear) Ä‘á»ƒ trÃ¡nh nhÃ¡y giao diá»‡n khi cáº­p nháº­t ngáº§m
    if (userList && (userList.children.length === 0 || userList.querySelector('.skeleton-chat-item'))) {
        renderConversationSkeletons(userList);
    }

    try {
        const res = await fetch(`${API_URL}/chat/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`KhÃ´ng thá»ƒ táº£i danh sÃ¡ch (HTTP ${res.status}): ${errorText.substring(0, 100) || "MÃ¡y chá»§ Ä‘ang khá»Ÿi Ä‘á»™ng hoáº·c quÃ¡ táº£i"}`);
        }
        const data = await res.json();
        const userList = document.getElementById("user-list");
        userList.innerHTML = "";

        if (!data.data || data.data.length === 0) {
            return (userList.innerHTML =
                "<li style='color:#666; font-weight:normal; padding: 20px;'>ChÆ°a cÃ³ cuá»™c trÃ² chuyá»‡n nÃ o.<br><br>HÃ£y dÃ¹ng Ã´ tÃ¬m kiáº¿m á»Ÿ trÃªn Ä‘á»ƒ tÃ¬m báº¡n bÃ¨ theo TÃªn nhÃ©!</li>");
        }

        data.data.forEach((item) => {
            const conv = item.Conversations;
            const otherMember = conv.ConversationMembers.find(
                (m) => m.userId !== myId,
            );

            if (otherMember) {
                const user = otherMember.Users;
                let lastMsg = "Báº¯t Ä‘áº§u trÃ² chuyá»‡n!";
                let timeStr = "";
                if (conv.Messages.length > 0) {
                    const firstMsg = conv.Messages[0];
                    const msgDate = firstMsg.createdAt ? new Date(firstMsg.createdAt) : new Date();
                    timeStr = `${msgDate.getHours().toString().padStart(2, "0")}:${msgDate.getMinutes().toString().padStart(2, "0")}`;
                    if (firstMsg.isRecalled) {
                        lastMsg = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
                    } else if (firstMsg.type === "file") {
                        try {
                            const fileData = JSON.parse(firstMsg.content);
                            lastMsg = `[ Tá»‡p tin: ${fileData.fileName} ]`;
                        } catch (e) {
                            lastMsg = "[ Tá»‡p tin ]";
                        }
                    } else if (firstMsg.type === "audio") {
                        lastMsg = "[ Tin nháº¯n thoáº¡i ]";
                    } else if (
                        firstMsg.content &&
                        (firstMsg.content.startsWith("data:image") ||
                            firstMsg.content.match(/\.(jpeg|jpg|gif|png)$/i))
                    ) {
                        lastMsg = "[ HÃ¬nh áº£nh ]";
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

                // LÆ°u nicknames vÃ o dataset Ä‘á»ƒ tra cá»©u sau nÃ y
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
              <span class="chat-list-name">${otherMember.nickname || user.fullName || "NgÆ°á»i dÃ¹ng"}</span>
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
                <i class="fas fa-trash-alt"></i> XÃ³a cuá»™c trÃ² chuyá»‡n
              </div>
            </div>
          </div>
        `;
                userList.appendChild(li);
            }
        });
    } catch (error) {
        alert("Lá»—i táº£i danh sÃ¡ch cÃ¢u chuyá»‡n: " + error.message);
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

// 2.5 TÃ¬m kiáº¿m ngÆ°á»i dÃ¹ng báº±ng TÃªn
async function searchUser() {
    const searchEl = document.getElementById("search-input");
    const mobileSearchEl = document.getElementById("mobile-search-input");
    const q = ((mobileSearchEl && mobileSearchEl.value.trim()) || (searchEl && searchEl.value.trim()) || "").trim();
    if (!q) return alert("Xin vui lÃ²ng nháº­p TÃªn Ä‘á»ƒ tÃ¬m!");

    try {
        const res = await fetch(`${API_URL}/users/search?q=${q}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const resultsDiv = document.getElementById("search-results");
        resultsDiv.style.display = "block";
        resultsDiv.innerHTML =
            "<h4 style='margin:0 0 10px 0;'>Káº¿t quáº£ tÃ¬m kiáº¿m:</h4>";

        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML +=
                "<p style='margin:0;color:red;'>KhÃ´ng tÃ¬m tháº¥y ai!</p>";
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
        <button onclick="startChat('${user.id}', '${user.fullName}', '${avatarUrl}')" style="margin-top:12px;padding:8px;width:100%;background:var(--primary-color);color:white;border:none;border-radius:6px;cursor:pointer;">Nháº¯n tin</button>
      `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        alert("Lá»—i tÃ¬m kiáº¿m: " + error.message);
    }
}

// 3. Báº¯t Ä‘áº§u trÃ² chuyá»‡n vá»›i ai Ä‘Ã³
async function startChat(receiverId, receiverName, receiverAvatar) {
    if (!receiverId) {
        return alert("Lá»—i: KhÃ´ng tÃ¬m tháº¥y ID ngÆ°á»i nháº­n tin nháº¯n.");
    }
    try {
        // Äáº£m báº£o chuyá»ƒn tab vá» tab tin nháº¯n Ä‘á»ƒ áº©n hoÃ n toÃ n cÃ¡c tab danh báº¡/tin tá»©c khÃ¡c á»Ÿ cháº¿ Ä‘á»™ ná»n
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
        
        // Giá»¯ nguyÃªn header lÃ m con cá»§a .chat-window Ä‘á»ƒ thá»«a hÆ°á»Ÿng vá»‹ trÃ­ vÃ  hiá»‡u á»©ng chuyá»ƒn Ä‘á»™ng tá»± nhiÃªn
        // KhÃ´ng di chuyá»ƒn ra body Ä‘á»ƒ trÃ¡nh bá»‹ trÃ´i lá»‡ch hoáº·c bá»‹ che khuáº¥t bá»Ÿi trÃ¬nh duyá»‡t khi cuá»™n/keyboard hiá»ƒn thá»‹
        const mobileHeader = document.getElementById("chat-header-container");
        document.getElementById("chat-header-placeholder").style.display = "none";
        currentChatPartnerId = receiverId;

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

        // Äá»“ng bá»™ tráº¡ng thÃ¡i online/offline cá»§a Ä‘á»‘i phÆ°Æ¡ng lÃªn header
        let partnerOnline = false;
        let partnerLastActive = null;

        const sidebarItem = document.querySelector(`#user-list li[data-user-id="${receiverId}"]`);
        if (sidebarItem) {
            partnerOnline = sidebarItem.dataset.isOnline === "true";
            partnerLastActive = sidebarItem.dataset.lastActive;
        }

        updateHeaderStatusUI(partnerOnline, partnerLastActive);

        // LuÃ´n fetch profile má»›i nháº¥t Ä‘á»ƒ Ä‘áº£m báº£o tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng chÃ­nh xÃ¡c nháº¥t
        fetch(`/api/users/${receiverId}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(profileData => {
                if (profileData && isSameId(receiverId, currentChatPartnerId)) {
                    partnerOnline = profileData.status === "online";
                    partnerLastActive = profileData.lastActive;
                    updateHeaderStatusUI(partnerOnline, partnerLastActive);

                    // Äá»“ng bá»™ láº¡i vÃ o sidebar dataset náº¿u cÃ³
                    if (sidebarItem) {
                        sidebarItem.dataset.isOnline = partnerOnline ? "true" : "false";
                        if (partnerLastActive) sidebarItem.dataset.lastActive = partnerLastActive;
                        const dot = sidebarItem.querySelector(".online-dot");
                        if (dot) dot.style.display = partnerOnline ? "block" : "none";
                    }
                }
            })
            .catch(e => console.warn("KhÃ´ng thá»ƒ táº£i tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng thá»i gian thá»±c:", e));

        document.getElementById("input-area").style.display = "flex";

        // Reset Ã´ nháº­p vÃ  tráº¡ng thÃ¡i UI (thu gá»n/Like) khi chuyá»ƒn phÃ²ng chat
        const messageInput = document.getElementById("message-input");
        if (messageInput) {
            messageInput.value = "";
            messageInput.style.height = "auto";
        }
        const inputArea = document.getElementById("input-area");
        if (inputArea) {
            inputArea.classList.remove("is-typing");
            // CSS media query Ä‘Ã£ xá»­ lÃ½ mobile layout, khÃ´ng cáº§n JavaScript override
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
            throw new Error(`KhÃ´ng thá»ƒ káº¿t ná»‘i phÃ²ng chat (HTTP ${res.status}): ${errorText.substring(0, 100)}`);
        }

        const data = await res.json();
        if (!data.success) return alert("ÄÃ£ táº¡o phÃ²ng chat: " + data.message);

        currentConversationId = data.data.id;
        if (!currentConversationId || currentConversationId === "undefined" || currentConversationId === "null") {
            throw new Error("ID phÃ²ng chat nháº­n vá» khÃ´ng há»£p lá»‡.");
        }

        resetReadReceiptState(currentConversationId);
        clearAndHideSearch();

        // XÃ³a unread-badge trÃªn giao diá»‡n danh sÃ¡ch ngay láº­p tá»©c (áº©n huy hiá»‡u Ä‘i)
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
            throw new Error(`KhÃ´ng thá»ƒ táº£i tin nháº¯n (HTTP ${resMsg.status}): ${errorText.substring(0, 100)}`);
        }

        const dataMsg = await resMsg.json();
        messagesDiv.innerHTML = "";

        // LÆ°u vÃ  Ã¡p dá»¥ng biá»‡t danh
        currentNicknames = dataMsg.nicknames || {};
        updateUINames();

        // Ãp dá»¥ng chá»§ Ä‘á» trÃ² chuyá»‡n
        applyChatTheme(dataMsg.theme || "default");

        // Cáº­p nháº­t state phÃ¢n trang
        hasMoreMessages = dataMsg.hasMore || false;
        isLoadingMoreMessages = false;

        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;

            // âš¡ BATCH RENDER: DÃ¹ng DocumentFragment Ä‘á»ƒ gom táº¥t cáº£ DOM nodes
            // rá»“i chÃ¨n 1 láº§n duy nháº¥t â†’ giáº£m reflow/repaint tá»« N láº§n xuá»‘ng 1 láº§n
            const fragment = document.createDocumentFragment();
            dataMsg.data.forEach((msg) => displayMessage(msg, fragment));
            messagesDiv.appendChild(fragment);

            updateReadReceiptsDOM();
            emitMarkMessagesRead();

            // Cuá»™n xuá»‘ng cuá»‘i ngay láº­p tá»©c vÃ  cuá»™n láº¡i sau khi káº¿t xuáº¥t Ä‘á»ƒ Ä‘áº£m báº£o luÃ´n hiá»ƒn thá»‹ tin nháº¯n má»›i nháº¥t
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

            // Tá»± Ä‘á»™ng Ä‘á»“ng bá»™ tin nháº¯n cuá»‘i cÃ¹ng vÃ o sidebar khi má»Ÿ phÃ²ng chat Ä‘á»ƒ trÃ¡nh lá»‡ch giao diá»‡n
            if (dataMsg.data.length > 0) {
                const lastMsg = dataMsg.data[dataMsg.data.length - 1];
                updateChatListUI(lastMsg, true);
            }
        }

        // Gáº¯n scroll listener cho infinite scroll ngÆ°á»£c
        setupInfiniteScroll(messagesDiv);
    } catch (error) {
        alert("Lá»—i khi má»Ÿ phÃ²ng trÃ² chuyá»‡n: " + error.message);
    }
}

function startChatAndSwitchTab(receiverId, receiverName, receiverAvatar) {
    startChat(receiverId, receiverName, receiverAvatar);
    const messagesTabNav = document.querySelector('.nav-item[title="Tin nháº¯n"]');
    if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
}

// --- HÃ€M Cáº¬P NHáº¬T GIAO DIá»†N CHAT LIST KHI CÃ“ TIN NHáº®N Má»šI ---
function updateChatListUI(msg, isRead = false) {
    try {
        const userList = document.getElementById("user-list");
        if (!userList) return;

        // TÃ¬m item báº±ng isSameId Ä‘á»ƒ trÃ¡nh lá»‡ch chá»¯ hoa/thÆ°á»ng hoáº·c khoáº£ng tráº¯ng giá»¯a cÃ¡c UUID
        const items = userList.querySelectorAll("li");
        let chatItem = null;
        for (const item of items) {
            if (isSameId(item.dataset.conversationId, msg.conversationId)) {
                chatItem = item;
                break;
            }
        }

        if (!chatItem) {
            // Náº¿u lÃ  cuá»™c trÃ² chuyá»‡n má»›i tinh chÆ°a cÃ³, táº£i láº¡i toÃ n bá»™ danh sÃ¡ch
            loadConversations();
            return;
        }

        // 1. Cáº­p nháº­t ná»™i dung text snippet má»›i nháº¥t
        const msgTextEl = chatItem.querySelector(".chat-list-msg");
        if (msgTextEl) {
            let snippet = msg.content || "";
            if (msg.isRecalled) snippet = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
            else if (msg.type === "missed_call") snippet = "Cuá»™c gá»i nhá»¡";
            else if (msg.type === "file") {
                try {
                    const fileData = JSON.parse(msg.content);
                    snippet = `[ Tá»‡p tin: ${fileData.fileName} ]`;
                } catch (e) {
                    snippet = "[ Tá»‡p tin ]";
                }
            } else if (msg.type === "audio") snippet = "[ Tin nháº¯n thoáº¡i ]";
            else if (
                msg.content &&
                (msg.content.startsWith("data:image") ||
                    msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
            ) {
                snippet = "[ HÃ¬nh áº£nh ]";
            }

            msgTextEl.innerText = snippet;

            // In Ä‘áº­m náº¿u chÆ°a Ä‘á»c
            if (!isRead && msg.senderId !== myId) {
                msgTextEl.style.fontWeight = "600";
                msgTextEl.style.color = "var(--text-dark)";
            } else {
                msgTextEl.style.fontWeight = "normal";
                msgTextEl.style.color = "var(--text-light)";
            }
        }

        // 2. TÄƒng sá»‘ Ä‘áº¿m Badge náº¿u mÃ¬nh lÃ  ngÆ°á»i nháº­n vÃ  phÃ²ng chat Ä‘ang Ä‘Ã³ng
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

        // 3. Cáº­p nháº­t thá»i gian tin nháº¯n cuá»‘i cÃ¹ng
        const timeEl = chatItem.querySelector(".chat-list-time");
        if (timeEl) {
            const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
            timeEl.innerText = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        }

        // 4. Äáº©y item lÃªn vá»‹ trÃ­ Ä‘áº§u tiÃªn cá»§a danh sÃ¡ch
        userList.prepend(chatItem);
        updateTotalMessagesBadge();
    } catch (error) {
        console.error("Lá»—i trong updateChatListUI:", error);
    }
}

// --- Táº¢I Láº I ÄOáº N CHAT ---
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

        // LÆ°u vÃ  Ã¡p dá»¥ng biá»‡t danh
        currentNicknames = dataMsg.nicknames || {};
        updateUINames();

        // Ãp dá»¥ng chá»§ Ä‘á» trÃ² chuyá»‡n
        applyChatTheme(dataMsg.theme || "default");

        // Cáº­p nháº­t state phÃ¢n trang
        hasMoreMessages = dataMsg.hasMore || false;
        isLoadingMoreMessages = false;

        if (dataMsg.data) {
            currentChatMessages = dataMsg.data;

            // âš¡ BATCH RENDER
            const fragment = document.createDocumentFragment();
            dataMsg.data.forEach((msg) => displayMessage(msg, fragment));
            messagesDiv.appendChild(fragment);

            updateReadReceiptsDOM();

            // Scroll xuá»‘ng cuá»‘i 1 láº§n duy nháº¥t
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
        }

        // Gáº¯n scroll listener cho infinite scroll ngÆ°á»£c
        setupInfiniteScroll(messagesDiv);
    } catch (error) {
        console.error("Lá»—i reload chat:", error);
    }
}

// --- INFINITE SCROLL: Táº£i thÃªm tin nháº¯n cÅ© khi cuá»™n lÃªn Ä‘áº§u ---
let _scrollListenerAttached = false;

function setupInfiniteScroll(messagesDiv) {
    if (_scrollListenerAttached) return; // Chá»‰ gáº¯n 1 láº§n
    _scrollListenerAttached = true;

    messagesDiv.addEventListener("scroll", debounce(function() {
        // Khi cuá»™n gáº§n Ä‘áº¿n Ä‘áº§u khung chat (cÃ¡ch top < 80px)
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
        // Láº¥y ID tin nháº¯n cÅ© nháº¥t hiá»‡n táº¡i lÃ m cursor
        const oldestMsg = currentChatMessages[0];
        if (!oldestMsg) return;

        const messagesDiv = document.getElementById("messages");

        // Ghi nhá»› chiá»u cao scroll hiá»‡n táº¡i trÆ°á»›c khi thÃªm tin nháº¯n cÅ©
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
            // ChÃ¨n tin nháº¯n cÅ© vÃ o Äáº¦U máº£ng
            currentChatMessages = [...data.data, ...currentChatMessages];

            // âš¡ BATCH RENDER: Gom táº¥t cáº£ vÃ o DocumentFragment
            const fragment = document.createDocumentFragment();
            data.data.forEach((msg) => displayMessage(msg, fragment));

            // ChÃ¨n lÃªn Ä‘áº§u khung chat (prepend)
            messagesDiv.insertBefore(fragment, messagesDiv.firstChild);

            // Giá»¯ nguyÃªn vá»‹ trÃ­ scroll (khÃ´ng nháº£y lung tung)
            requestAnimationFrame(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight - prevScrollHeight;
            });

            updateReadReceiptsDOM();
        }
    } catch (error) {
        console.error("Lá»—i táº£i thÃªm tin nháº¯n cÅ©:", error);
    } finally {
        isLoadingMoreMessages = false;
    }
}

// 1.5 Xá»­ lÃ½ ÄÄƒng nháº­p thá»§ cÃ´ng
async function login() {
    try {
        const username = document.getElementById("login-username").value;
        const password = document.getElementById("login-password").value;

        if (!username || !password) {
            return alert("Báº¡n Æ¡i, nháº­p Ä‘á»§ tÃªn ngÆ°á»i dÃ¹ng vÃ  máº­t kháº©u nhÃ©!");
        }

        showLoading("ÄÄƒng nháº­p...");

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
            alert("ÄÄƒng nháº­p tháº¥t báº¡i: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i mÃ¡y chá»§ khi Ä‘Äƒng nháº­p: " + error.message);
    } finally {
        hideLoading();
    }
}

// --- Há»† THá»NG BADGE TIN NHáº®N CHÆ¯A Äá»ŒC ---
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

// --- Há»† THá»NG BADGE TIN Tá»¨C CHÆ¯A Äá»ŒC ---
function updateNewsBadge() {
    const badgeEl = document.getElementById("news-badge");
    if (!badgeEl) return;

    // Chá»‰ tÃ­nh sá»‘ tin tá»©c chÆ°a Ä‘á»c trong danh sÃ¡ch hiá»‡n táº¡i
    const unreadCount = allNewsItems.filter(item => !readNewsIds.includes(item.id)).length;

    // Chá»‰ hiá»ƒn thá»‹ badge náº¿u cÃ³ tin tá»©c chÆ°a Ä‘á»c
    if (unreadCount > 0) {
        // Hiá»ƒn thá»‹ vá»›i giá»›i háº¡n 99+ Ä‘á»ƒ badge luÃ´n nhá» gá»n
        badgeEl.innerText = unreadCount > 99 ? "99+" : unreadCount;
        badgeEl.style.display = "flex";
    } else {
        badgeEl.style.display = "none";
    }
}

// --- Há»† THá»NG YÃŠU Cáº¦U Báº N BÃˆ ---
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
        listEl.innerHTML = `<p style="color: var(--text-light); text-align: center;">KhÃ´ng cÃ³ lá»i má»i káº¿t báº¡n nÃ o.</p>`;
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
        <button class="btn-decline" onclick="rejectFriendRequest('${req.id}')">Tá»« chá»‘i</button>
        <button class="btn-accept" onclick="acceptFriendRequest('${req.id}')">Cháº¥p nháº­n</button>
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
                "<p style='margin:0;color:red;'> KhÃ´ng tÃ¬m tháº¥y ai!</p>";
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
        <button class="btn-send-request" id="send-req-btn-${user.id}" onclick="sendFriendRequest('${user.id}')">Gá»­i lá»i má»i</button>
      `;
            resultsDiv.appendChild(div);
        });
    } catch (error) {
        alert("Lá»—i tÃ¬m kiáº¿m: " + error.message);
    }
}

function sendFriendRequest(receiverId) {
    if (!socket) return alert("ChÆ°a káº¿t ná»‘i tá»›i server!");
    socket.emit("send_friend_request", { receiverId });
    const btn = document.getElementById(`send-req-btn-${receiverId}`);
    if (btn) {
        btn.innerText = "ÄÃ£ gá»­i";
        btn.disabled = true;
    }
}

function acceptFriendRequest(requestId) {
    if (!socket) return alert("ChÆ°a káº¿t ná»‘i tá»›i server!");
    socket.emit("accept_friend_request", { requestId });
    pendingFriendRequests = pendingFriendRequests.filter(
        (req) => req.id !== requestId,
    );
    renderFriendRequests();
    updateFriendRequestBadge();
}

function rejectFriendRequest(requestId) {
    if (!socket) return alert("ChÆ°a káº¿t ná»‘i tá»›i server!");
    socket.emit("reject_friend_request", { requestId });
    pendingFriendRequests = pendingFriendRequests.filter(
        (req) => req.id !== requestId,
    );
    renderFriendRequests();
    updateFriendRequestBadge();
}

// --- Táº¢I DANH SÃCH Báº N BÃˆ ---
async function loadFriends() {
    const listEl = document.getElementById("friends-list");
    if (!listEl) return;

    // Chá»‰ hiá»ƒn thá»‹ skeleton náº¿u danh sÃ¡ch hiá»‡n táº¡i Ä‘ang trá»‘ng Ä‘á»ƒ trÃ¡nh nhÃ¡y giao diá»‡n khi cáº­p nháº­t ngáº§m
    if (listEl.children.length === 0 || listEl.querySelector('.skeleton-friend-item')) {
        renderFriendSkeletons(listEl);
    }

    try {
        const res = await fetch(`${API_URL}/users/friends`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`KhÃ´ng thá»ƒ táº£i báº¡n bÃ¨ (HTTP ${res.status}): ${errorText.substring(0, 100) || "Lá»—i mÃ¡y chá»§"}`);
        }
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            listEl.innerHTML = `<p style="color: var(--text-light); text-align: center;">ChÆ°a cÃ³ báº¡n bÃ¨ nÃ o.</p>`;
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
                }', '${avatarUrl}')"><i class="far fa-comment-dots"></i> Nháº¯n tin</button>
          <button class="btn-delete-friend" onclick="removeFriend('${user.id
                }')" title="XÃ³a báº¡n bÃ¨"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
            listEl.appendChild(itemEl);
        });
    } catch (err) {
        console.error("Lá»—i táº£i danh sÃ¡ch báº¡n bÃ¨", err);
    }
}

// --- XÃ“A Báº N BÃˆ ---
async function removeFriend(friendId) {
    const consent = await customConfirm("XÃ³a báº¡n bÃ¨", "Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a ngÆ°á»i nÃ y khá»i danh sÃ¡ch báº¡n bÃ¨?", "XÃ³a báº¡n", "Há»§y", true);
    if (!consent) return;

    try {
        const res = await fetch(`${API_URL}/users/friends/${friendId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
            loadFriends();
            loadConversations(); // Táº£i láº¡i cáº£ danh sÃ¡ch chat

            // Náº¿u Ä‘ang chat vá»›i ngÆ°á»i vá»«a xÃ³a, Ä‘Ã³ng cá»­a sá»• chat láº¡i
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
            alert("Lá»—i khi xÃ³a báº¡n: " + data.message);
        }
    } catch (err) {
        alert("Lá»—i káº¿t ná»‘i khi xÃ³a báº¡n bÃ¨!");
    }
}

// Äáº¿m sá»‘ lÆ°á»£ng emoji náº¿u tin nháº¯n chá»‰ chá»©a toÃ n emoji (tá»‘i Ä‘a 3 emoji)
function getEmojiOnlyCount(text) {
    if (!text) return 0;
    const cleanText = text.trim();
    if (!cleanText) return 0;

    // Regex khá»›p chÃ­nh xÃ¡c cÃ¡c emoji bao gá»“m cáº£ skin tones vÃ  ZWJ sequences
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

// 4. Hiá»ƒn thá»‹ tin nháº¯n lÃªn mÃ n hÃ¬nh
function displayMessage(msg, targetContainer = null) {
    // CHá»T CHáº¶N: Náº¿u tin nháº¯n Ä‘Ã£ Ä‘Æ°á»£c render (bá»Ÿi Socket) thÃ¬ bá» qua Ä‘á»ƒ trÃ¡nh trÃ¹ng láº·p
    if (document.getElementById(`msg-${msg.id}`)) return;

    // âœ¨ Há»£p nháº¥t tin nháº¯n táº¡m (optimistic UI) náº¿u cÃ³ Ä‘á»ƒ trÃ¡nh trÃ¹ng láº·p vÃ  káº¹t spinner
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
                console.log("âœ¨ Há»£p nháº¥t thÃ nh cÃ´ng tin nháº¯n táº¡m:", optMsg.id, "->", msg.id);
                // Äá»•i ID vÃ  dataset
                optimisticEl.id = `msg-${msg.id}`;
                optimisticEl.dataset.messageId = msg.id;
                optimisticEl.style.opacity = "1";

                // Cáº­p nháº­t trong máº£ng currentChatMessages
                const idx = currentChatMessages.indexOf(optMsg);
                if (idx !== -1) currentChatMessages[idx] = msg;

                return; // Tráº£ vá» sá»›m, khÃ´ng táº¡o pháº§n tá»­ má»›i!
            }
        }
    }

    if (!currentChatMessages.some(m => m.id === msg.id)) {
        currentChatMessages.push(msg);
    }

    const messagesDiv = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.id = `msg-${msg.id}`;
    messageElement.className = `message ${msg.senderId === myId ? "my-message" : "other-message"
        }`;
    messageElement.dataset.messageId = msg.id;
    messageElement.dataset.senderId = msg.senderId || "";
    messageElement.dataset.isRead = msg.isRead ? "true" : "false";

    // Hiá»ƒn thá»‹ Tin nháº¯n há»‡ thá»‘ng (System message nhÆ° thÃ´ng bÃ¡o Ä‘á»•i chá»§ Ä‘á»)
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

    // Hiá»ƒn thá»‹ giao diá»‡n Cuá»™c gá»i nhá»¡ (Tin nháº¯n há»‡ thá»‘ng)
    if (msg.type === "missed_call") {
        messageElement.className = "message system-message";
        const messageBody = document.createElement("div");
        messageBody.className = "message-body";
        const messageContent = document.createElement("div");
        messageContent.className = "message-content";

        const callText = msg.content || "Cuá»™c gá»i nhá»¡";
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

    if (msg.senderId !== myId && msg.Users) {
        const senderName = document.createElement("div");
        senderName.className = "sender-name";
        senderName.dataset.realName = msg.Users.fullName;
        senderName.innerText = (currentNicknames && currentNicknames[msg.senderId]) || msg.Users.fullName;
        messageElement.appendChild(senderName);
    }

    const messageBody = document.createElement("div");
    messageBody.className = "message-body";
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    if (msg.isRecalled) {
        messageContent.innerText = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
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
                    // Náº¿u lÃ  URL ngoÃ i, má»Ÿ tab má»›i thay vÃ¬ tá»± Ä‘á»™ng táº¡o click
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
                console.error("Lá»—i parse file message:", err);
                messageContent.innerText = "[ Tá»‡p tin bá»‹ lá»—i ]";
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
            messageContent.innerHTML = `<img src="${msg.content}" class="message-image" loading="lazy" onload="if(typeof window.scrollToBottomInstant === 'function') window.scrollToBottomInstant()" onclick="openLightbox(this.src)" alt="áº¢nh tin nháº¯n" />`;
            messageContent.style.background = "transparent";
            messageContent.style.padding = "0";
        } else {
            messageContent.innerText = msg.content;

            // Xá»­ lÃ½ Emoji cá»¡ lá»›n náº¿u tin nháº¯n chá»‰ chá»©a tá»« 1 Ä‘áº¿n 3 emoji
            const emojiCount = getEmojiOnlyCount(msg.content);
            if (emojiCount > 0) {
                messageElement.classList.add("emoji-only-message");
                messageContent.classList.add(`emoji-only-${emojiCount}`);
            }

            if (msg.isEdited) {
                const editedLabel = document.createElement("span");
                editedLabel.className = "edited-label";
                editedLabel.innerText = " (Ä‘Ã£ chá»‰nh sá»­a)";
                editedLabel.style.fontSize = "0.75rem";
                editedLabel.style.color = "var(--text-light)";
                editedLabel.style.fontStyle = "italic";
                messageContent.appendChild(editedLabel);
            }
        }

        // NÃ¢ng cáº¥p: Hiá»ƒn thá»‹ tin nháº¯n trÃ­ch dáº«n (Replied Message Preview)
        if (msg.replyMessageId) {
            let parentMsg = msg.replyMessage;

            // Náº¿u chÆ°a cÃ³ Ä‘á»‘i tÆ°á»£ng do backend Ä‘Ã­nh kÃ¨m, tÃ¬m trong máº£ng cá»¥c bá»™
            if (!parentMsg) {
                const localParent = currentChatMessages.find((m) => m.id === msg.replyMessageId);
                if (localParent) {
                    let parentSenderName = "NgÆ°á»i dÃ¹ng";
                    if (localParent.senderId === myId) {
                        parentSenderName = "Báº¡n";
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

                let parentSenderName = parentMsg.senderName || "NgÆ°á»i dÃ¹ng";
                if (parentMsg.senderId === myId) {
                    parentSenderName = "Báº¡n";
                }

                let parentText = parentMsg.content;
                if (parentMsg.isRecalled) {
                    parentText = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
                } else if (parentMsg.type === "file") {
                    try {
                        const fileData = JSON.parse(parentMsg.content);
                        parentText = `[ Tá»‡p tin: ${fileData.fileName} ]`;
                    } catch (e) {
                        parentText = "[ Tá»‡p tin ]";
                    }
                } else if (parentMsg.type === "audio") {
                    parentText = "[ Tin nháº¯n thoáº¡i ]";
                } else if (
                    parentMsg.content &&
                    (parentMsg.content.startsWith("data:image/") ||
                        parentMsg.content.match(/\.(jpeg|jpg|gif|png)$/i))
                ) {
                    parentText = "[ HÃ¬nh áº£nh ]";
                } else if (parentMsg.type === "missed_call") {
                    parentText = "[ Cuá»™c gá»i nhá»¡ ]";
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

        // Táº O NÃšT THáº¢ Cáº¢M XÃšC (Reaction)
        const reactBtn = document.createElement("div");
        reactBtn.className = "action-item react-btn";
        reactBtn.innerHTML = '<i class="far fa-smile"></i>';
        const reactionPalette = document.createElement("div");
        reactionPalette.className = "reaction-palette";
        const EMOJIS = ["ðŸ‘", "â¤ï¸", "ðŸ˜‚", "ðŸ˜®", "ðŸ˜¢", "ðŸ˜¡"];
        EMOJIS.forEach((emoji) => {
            const emojiSpan = document.createElement("span");
            emojiSpan.innerText = emoji;
            const handleReact = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const currentMsgId = messageElement.dataset.messageId;
                reactToMessage(currentMsgId, emoji);
                reactionPalette.classList.remove("show");
                hideMobileOverlay();
            };
            emojiSpan.onclick = handleReact;
            emojiSpan.addEventListener("touchend", handleReact, { passive: false });
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

        // MENU TÃ™Y CHá»ŒN
        const moreBtn = document.createElement("div");
        moreBtn.className = "action-item more-btn";
        moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
        const moreMenu = document.createElement("div");
        moreMenu.className = "more-menu";

        const replyOption = document.createElement("div");
        replyOption.className = "menu-item reply-action";
        replyOption.innerText = "Tráº£ lá»i";
        replyOption.onclick = (e) => {
            e.stopPropagation();
            const currentMsgId = messageElement.dataset.messageId;
            setReplyMode(currentMsgId);
            moreMenu.classList.remove("show");
            hideMobileOverlay();
        };
        moreMenu.appendChild(replyOption);

        if (!msg.isRecalled) {
            const copyOption = document.createElement("div");
            copyOption.className = "menu-item copy-action";
            copyOption.innerText = "Sao chÃ©p";
            copyOption.onclick = (e) => {
                e.stopPropagation();
                copyMessageText(msg.content);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(copyOption);
        }

        if (msg.senderId === myId) {
            // Sá»­a tin nháº¯n (chá»‰ cho tin nháº¯n vÄƒn báº£n chÆ°a thu há»“i)
            if (!msg.isRecalled && (!msg.type || msg.type === "text")) {
                const editOption = document.createElement("div");
                editOption.className = "menu-item edit-action";
                editOption.innerText = "Sá»­a tin nháº¯n";
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
            recallOption.innerText = "Thu há»“i tin nháº¯n";
            recallOption.onclick = (e) => {
                e.stopPropagation();
                const currentMsgId = messageElement.dataset.messageId;
                recallMessage(currentMsgId);
                moreMenu.classList.remove("show");
                hideMobileOverlay();
            };
            moreMenu.appendChild(recallOption);

            const deleteOption = document.createElement("div");
            deleteOption.className = "menu-item";
            deleteOption.innerText = "XÃ³a á»Ÿ phÃ­a tÃ´i";
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
            deleteOption.className = "menu-item";
            deleteOption.innerText = "XÃ³a á»Ÿ phÃ­a tÃ´i";
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

        document.addEventListener("click", () => moreMenu.classList.remove("show"));

        moreBtn.appendChild(moreMenu);

        const replyBtn = document.createElement("div");
        replyBtn.className = "action-item reply-btn";
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.title = "Tráº£ lá»i";
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

        messageBody.appendChild(messageContent);
        messageBody.appendChild(actions);

        renderReactions(messageBody, msg.reactions);

        // Vuá»‘t kÃ©o Ä‘á»ƒ tráº£ lá»i (Swipe left/right to reply on mobile and desktop)
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
            if (e.button !== 0) return; // Chá»‰ nháº­n chuá»™t trÃ¡i
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            isHorizontalDrag = false;
            dragX = 0;
            messageBody.style.transition = "none";
        });

        messageBody.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const diffX = e.clientX - startX;
            const diffY = e.clientY - startY;

            // FIX iOS #5: TÄƒng threshold kÃ©o ngang cho iOS WKWebView Ä‘á»ƒ trÃ¡nh káº¹t scroll
            const _isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const swipeThreshold = _isIOSDevice ? 14 : 8;
            if (!isHorizontalDrag && Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                isHorizontalDrag = true;
                messageBody.setPointerCapture(e.pointerId); // Chá»‰ capture khi thá»±c sá»± kÃ©o ngang
            }

            if (isHorizontalDrag) {
                if (e.cancelable) e.preventDefault();

                // CÃ´ng thá»©c cáº£n lá»±c kÃ©o vÃ´ háº¡n (rubber-banding) giá»‘ng iOS / Messenger
                const maxDrag = 80;
                dragX = Math.sign(diffX) * (maxDrag * (1 - Math.exp(-Math.abs(diffX) / 65)));
                messageBody.style.transform = `translateX(${dragX}px)`;

                // Äá»‹nh vá»‹ indicator náº±m bÃªn trÃ¡i hay bÃªn pháº£i dá»±a vÃ o hÆ°á»›ng kÃ©o
                if (dragX > 0) {
                    swipeIndicator.style.left = "-45px";
                    swipeIndicator.style.right = "auto";
                } else {
                    swipeIndicator.style.left = "auto";
                    swipeIndicator.style.right = "-45px";
                }

                // TÄƒng kÃ­ch thÆ°á»›c phÃ³ng to dáº§n cá»§a icon theo khoáº£ng cÃ¡ch vuá»‘t
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
            if (!isDragging) return;
            isDragging = false;

            // Hiá»‡u á»©ng Ä‘Ã n há»“i náº©y lÃ² xo cá»±c mÆ°á»£t (easeOutBack)
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

        // Xá»­ lÃ½ nháº¥n giá»¯ trÃªn di Ä‘á»™ng
        let pressTimer;
        let isLongPress = false;
        let longPressStartY = 0;

        messageContent.addEventListener(
            "touchstart",
            (e) => {
                if (window.innerWidth > 768) return;
                longPressStartY = e.touches[0].clientY;
                isLongPress = false;
                // FIX iOS #6: Long-press 250ms quÃ¡ ngáº¯n cho iOS, dá»… trigger nháº§m khi scroll cháº­m
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
                if (Math.abs(e.touches[0].clientY - longPressStartY) > 10) {
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

        // Xá»­ lÃ½ Double click / Double tap tháº£ tim giá»‘ng Messenger
        let lastTap = 0;

        const handleDoubleTap = (e) => {
            reactToMessage(msg.id, "â¤ï¸");

            // Hiá»ƒn thá»‹ hiá»‡u á»©ng trÃ¡i tim bay giá»¯a tin nháº¯n
            const heart = document.createElement("div");
            heart.className = "heart-pop-animation";
            heart.innerHTML = "â¤ï¸";
            messageContent.appendChild(heart);
            setTimeout(() => heart.remove(), 800);
        };

        // Cho mobile (TrÃ¡nh trá»… 300ms click vÃ  trÃ¡nh zoom)
        messageContent.addEventListener("touchend", (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                e.preventDefault();
                e.stopPropagation(); // FIX iOS #7: NgÄƒn event bubble lÃªn gÃ¢y zoom
                handleDoubleTap(e);
            }
            lastTap = currentTime;
        }, { passive: false }); // FIX iOS #7: passive: false Ä‘á»ƒ preventDefault hoáº¡t Ä‘á»™ng cháº¯c cháº¯n

        // Cho desktop
        messageContent.addEventListener("dblclick", (e) => {
            e.preventDefault();
            handleDoubleTap(e);
        });
    }

    // Äá»‹nh dáº¡ng vÃ  hiá»ƒn thá»‹ thá»i gian gá»­i tin nháº¯n
    const metaElement = document.createElement("div");
    metaElement.className = "message-meta";
    const timeElement = document.createElement("span");
    const date = msg.createdAt ? new Date(msg.createdAt) : new Date();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    timeElement.innerText = `${hours}:${minutes}`;
    metaElement.appendChild(timeElement);

    // Tráº¡ng thÃ¡i "ÄÃ£ gá»­i" chá»‰ dÃ nh cho tin nháº¯n cá»§a báº£n thÃ¢n
    if (msg.senderId === myId) {
        const statusElement = document.createElement("span");
        statusElement.className = "message-status";
        metaElement.appendChild(statusElement);
    }

    messageElement.appendChild(messageBody);
    messageElement.appendChild(metaElement);

    // Náº¿u cÃ³ targetContainer (batch render) â†’ chÃ¨n vÃ o fragment, khÃ´ng chÃ¨n trá»±c tiáº¿p vÃ o DOM
    if (targetContainer) {
        targetContainer.appendChild(messageElement);
    } else {
        // Render Ä‘Æ¡n láº» (realtime socket) â†’ chÃ¨n trá»±c tiáº¿p vÃ  scroll THÃ”NG MINH
        messagesDiv.appendChild(messageElement);
        // updateReadReceiptsDOM() Ä‘Æ°á»£c gá»i má»™t láº§n duy nháº¥t sau khi toÃ n bá»™ tin nháº¯n Ä‘Ã£ render xong
        // (trong startChat / reloadCurrentChat / socket receive_message). KhÃ´ng gá»i á»Ÿ Ä‘Ã¢y Ä‘á»ƒ trÃ¡nh flicker.
        
        // CHá»ˆ auto-scroll náº¿u ngÆ°á»i dÃ¹ng Ä‘ang á»Ÿ gáº§n cuá»‘i danh sÃ¡ch tin nháº¯n
        // Náº¿u há» Ä‘ang kÃ©o lÃªn xem tin cÅ© â†’ KHÃ”NG scroll Ä‘á»ƒ khÃ´ng gÃ¢y khÃ³ chá»‹u
        if (typeof window.smartScrollToBottom === "function") {
            window.smartScrollToBottom();
        } else if (typeof window.scrollToBottomSmooth === "function") {
            window.scrollToBottomSmooth();
        } else {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }
}
// 5. Gá»­i tin nháº¯n báº¥t Ä‘á»“ng bá»™
function sendMessage(imageContent = null) {
    const input = document.getElementById("message-input");
    const content = imageContent || input.value.trim();

    if (!currentConversationId) {
        return alert("Báº¡n quÃªn chÆ°a chá»n ngÆ°á»i Ä‘á»ƒ trÃ² chuyá»‡n rá»“i (Cá»™t danh sÃ¡ch bÃªn trÃ¡i)!");
    }

    if (!content) return;

    // Cháº·n Ä‘á»ƒ thá»±c hiá»‡n sá»­a tin nháº¯n thay vÃ¬ gá»­i má»›i (khÃ´ng Ã¡p dá»¥ng cho gá»­i Like)
    if (editingMessage && !imageContent && content !== 'ðŸ‘') {
        const messageIdToEdit = editingMessage.id;
        input.value = "";
        input.style.height = 'auto'; // Reset chiá»u cao

        // Tráº£ UI vá» máº·c Ä‘á»‹nh
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.remove('is-typing');
        if (document.getElementById('like-btn')) document.getElementById('like-btn').style.display = 'flex';
        if (document.getElementById('send-btn')) document.getElementById('send-btn').style.display = 'none';

        editMessageApi(messageIdToEdit, content);
        cancelReply();
        return;
    }

    input.value = "";
    if (!imageContent || imageContent === 'ðŸ‘') {
        // Tráº£ UI vá» máº·c Ä‘á»‹nh
        input.style.height = 'auto';
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.remove('is-typing');
        if (document.getElementById('like-btn')) document.getElementById('like-btn').style.display = 'flex';
        if (document.getElementById('send-btn')) document.getElementById('send-btn').style.display = 'none';
    }

    if ((!imageContent || imageContent === 'ðŸ‘') && socket) {
        if (currentChatPartnerId) {
            socket.emit("stop-typing", { receiverId: currentChatPartnerId });
        }
        socket.emit("stop_typing", {
            conversationId: currentConversationId,
            senderId: myId,
        });
    }

    // âœ¨ OPTIMISTIC UI: Hiá»ƒn thá»‹ tin nháº¯n ngay láº­p tá»©c
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
            } else {
                alert("Server tá»« chá»‘i gá»­i tin nháº¯n: " + data.message);
                const optimisticEl = document.getElementById(`msg-${optimisticId}`);
                if (optimisticEl) optimisticEl.remove();
                const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
                if (idx !== -1) currentChatMessages.splice(idx, 1);
            }
        })
        .catch((err) => {
            alert("Lá»—i káº¿t ná»‘i máº¡ng: " + err.message);
            const optimisticEl = document.getElementById(`msg-${optimisticId}`);
            if (optimisticEl) optimisticEl.remove();
            const idx = currentChatMessages.findIndex(m => m.id === optimisticId);
            if (idx !== -1) currentChatMessages.splice(idx, 1);
        });
}

// 6. Báº¥m phÃ­m Enter Ä‘á»ƒ gá»­i & Sá»± kiá»‡n gÃµ phÃ­m
const messageInput = document.getElementById("message-input");
if (messageInput) {
    messageInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener("input", function() {
        // Tá»± Ä‘á»™ng giÃ£n dÃ²ng nhÆ°ng giá»›i háº¡n tá»‘i Ä‘a
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 80); // Giá»›i háº¡n max 80px
        this.style.height = newHeight + 'px';
        this.style.overflowY = this.scrollHeight > 80 ? 'scroll' : 'hidden';

        // Neo cuá»™n danh sÃ¡ch tin nháº¯n Ä‘á»ƒ khÃ´ng bá»‹ lá»‡ch khi chiá»u cao Ã´ nháº­p thay Ä‘á»•i
        if (window.innerWidth <= 768) {
            scrollToBottomInstant();
        } else {
            scrollToBottomSmooth();
        }
        // Logic cá»§a Messenger: Thay Like thÃ nh Gá»­i, thu gá»n menu trÃ¡i
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

        // PhÃ¡t sá»± kiá»‡n Socket Typing
        if (!socket) return;
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

    let scrollAnimationId = null;
    const scrollToBottomSmooth = () => {
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) {
            if (scrollAnimationId) {
                cancelAnimationFrame(scrollAnimationId);
            }
            let start = Date.now();
            const scrollLoop = () => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                if (Date.now() - start < 350) {
                    scrollAnimationId = requestAnimationFrame(scrollLoop);
                } else {
                    scrollAnimationId = null;
                }
            };
            scrollAnimationId = requestAnimationFrame(scrollLoop);
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

    // Khi ngÆ°á»i dÃ¹ng báº¥m click vÃ o Ã´ nháº­p (Focus) -> thu gá»n menu trÃ¡i Ä‘á»ƒ nhÆ°á»ng chá»—
    messageInput.addEventListener("focus", function() {
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.add('is-typing');
        if (typeof closeEmojiPicker === "function") closeEmojiPicker();

        // TrÃªn mobile: KHÃ”NG tá»± gá»i scrollToBottomInstant á»Ÿ Ä‘Ã¢y ná»¯a.
        // Viá»‡c neo cuá»™n Ä‘Ã£ Ä‘Æ°á»£c visualViewport 'resize' (debounce 120ms) Ä‘áº£m nhiá»‡m
        // sau khi bÃ n phÃ­m lÃªn xong háº³n, trÃ¡nh 2 nguá»“n gá»i chá»“ng chÃ©o.
        if (window.innerWidth > 768) {
            scrollToBottomSmooth();
        }
    });

    // Äáº£m báº£o click/tap vÃ o Ã´ nháº­p cÅ©ng láº­p tá»©c thu gá»n menu chá»©c nÄƒng trÃ¡i
    messageInput.addEventListener("click", function() {
        const inputArea = document.getElementById('input-area');
        if (inputArea) inputArea.classList.add('is-typing');
        if (window.innerWidth > 768) {
            scrollToBottomSmooth();
        }
    });

    // Khi ngÆ°á»i dÃ¹ng báº¥m ra ngoÃ i (Blur) -> hiá»ƒn thá»‹ láº¡i menu trÃ¡i náº¿u Ã´ nháº­p trá»‘ng
    messageInput.addEventListener("blur", function() {
        const inputArea = document.getElementById('input-area');
        if (this.value.trim().length === 0) {
            if (inputArea) inputArea.classList.remove('is-typing');
        }
        // Viá»‡c tráº£ viewport vá» vá»‹ trÃ­ gá»‘c Ä‘Ã£ do 'focusout' + visualViewport lo,
        // khÃ´ng cáº§n window.scrollTo thá»§ cÃ´ng á»Ÿ Ä‘Ã¢y ná»¯a.
    });
}

// Xá»­ lÃ½ nÃºt mÅ©i tÃªn má»Ÿ rá»™ng láº¡i cá»¥m áº£nh/file khi Ä‘ang gÃµ
const expandBtnUI = document.getElementById('expand-btn');
if (expandBtnUI) {
    expandBtnUI.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const inputArea = document.getElementById('input-area');
        if (inputArea) {
            inputArea.classList.remove('is-typing');
        }
    });
}

// 10. ÄÃ³ng khung trÃ² chuyá»‡n trÃªn di Ä‘á»™ng
function closeChatMobile() {
    document.getElementById("chat-screen").classList.remove("mobile-chat-active");
    document.body.classList.remove("mobile-chat-active");
    document.documentElement.style.removeProperty('--vv-height');
    document.documentElement.style.removeProperty('--vv-offset');
    document.documentElement.style.removeProperty('--keyboard-shift');
    
    // Tráº£ header láº¡i vÃ o trong .chat-window Ä‘á»ƒ hiá»ƒn thá»‹ bÃ¬nh thÆ°á»ng trÃªn desktop
    const mobileHeader = document.getElementById("chat-header-container");
    const mobileChatWindow = document.querySelector(".chat-window");
    if (mobileHeader && mobileChatWindow) {
        mobileChatWindow.insertBefore(mobileHeader, mobileChatWindow.firstChild);
    }
}

// 7. Sá»± kiá»‡n Gá»­i HÃ¬nh áº£nh
const imageUploadInput = document.getElementById("image-upload");
if (imageUploadInput) {
    imageUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Äang xá»­ lÃ½ vÃ  nÃ©n áº£nh...");
            const compressedBase64 = await compressImage(file, 1200, 1200, 0.85);
            hideLoading();
            sendMessage(compressedBase64);
        } catch (err) {
            console.error("Lá»—i nÃ©n áº£nh:", err);
            hideLoading();
            // Fallback gá»­i áº£nh gá»‘c náº¿u lá»—i nÃ©n
            const reader = new FileReader();
            reader.onload = function(event) {
                sendMessage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Sá»± kiá»‡n Chá»¥p vÃ  gá»­i hÃ¬nh áº£nh qua Camera
const cameraUploadInput = document.getElementById("camera-upload");
if (cameraUploadInput) {
    cameraUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Äang xá»­ lÃ½ vÃ  nÃ©n áº£nh...");
            const compressedBase64 = await compressImage(file, 1200, 1200, 0.85);
            hideLoading();
            sendMessage(compressedBase64);
        } catch (err) {
            console.error("Lá»—i nÃ©n áº£nh tá»« camera:", err);
            hideLoading();
            // Fallback gá»­i áº£nh gá»‘c náº¿u lá»—i nÃ©n
            const reader = new FileReader();
            reader.onload = function(event) {
                sendMessage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Sá»± kiá»‡n Gá»­i Tá»‡p tin (File/Document)
const fileUploadInput = document.getElementById("file-upload");
if (fileUploadInput) {
    fileUploadInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Giá»›i háº¡n tá»‡p tin dÆ°á»›i 10MB Ä‘á»ƒ khÃ´ng quÃ¡ táº£i dá»¯ liá»‡u Base64 trong database
        if (file.size > 10 * 1024 * 1024) {
            return alert("Vui lÃ²ng chá»n tá»‡p tin cÃ³ dung lÆ°á»£ng dÆ°á»›i 10MB.");
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
// 9. Sá»± kiá»‡n Táº£i lÃªn Avatar Má»›i
const avatarUploadInput = document.getElementById("avatar-upload");
if (avatarUploadInput) {
    avatarUploadInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Äang xá»­ lÃ½ vÃ  nÃ©n áº£nh...");
            // NÃ©n áº£nh avatar xuá»‘ng max 150x150 JPEG quality 0.8 (~15KB)
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
                // Táº£i láº¡i áº£nh báº±ng URL tÄ©nh má»›i (vá»›i cache buster)
                const avatarUrlWithVersion = `${data.avatarUrl}`;
                document.getElementById("my-avatar").src = avatarUrlWithVersion;
                if (document.getElementById("my-avatar-profile"))
                    document.getElementById("my-avatar-profile").src = avatarUrlWithVersion;
                if (document.getElementById("my-avatar-personal-tab"))
                    document.getElementById("my-avatar-personal-tab").src = avatarUrlWithVersion;
                showTempToast("ÄÃ£ cáº­p nháº­t áº£nh Ä‘áº¡i diá»‡n má»›i thÃ nh cÃ´ng!");
            } else {
                alert("Lá»—i táº£i áº£nh: " + data.message);
            }
        } catch (error) {
            hideLoading();
            alert("Lá»—i há»‡ thá»‘ng khi táº£i áº£nh lÃªn!");
        }
    });
}

// 11. Thu há»“i tin nháº¯n
async function recallMessage(messageId) {
    const consent = await customConfirm("Thu há»“i tin nháº¯n", "Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n thu há»“i tin nháº¯n nÃ y khÃ´ng?", "Thu há»“i", "Há»§y", true);
    if (!consent) return;

    try {
        const res = await fetch(`${API_URL}/chat/messages/${messageId}/recall`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!data.success) {
            alert("Lá»—i thu há»“i: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i khi thu há»“i: " + error.message);
    }
}

// Biáº¿n lÆ°u ID tin nháº¯n Ä‘ang thá»±c hiá»‡n xÃ³a
let messageIdToDelete = null;

// Má»Ÿ modal xÃ¡c nháº­n xÃ³a á»Ÿ phÃ­a tÃ´i
function openDeleteMessageMeModal(messageId) {
    messageIdToDelete = messageId;
    const modal = document.getElementById("delete-message-me-modal");
    if (!modal) return;
    modal.style.display = "flex";
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

// ÄÃ³ng modal xÃ¡c nháº­n xÃ³a á»Ÿ phÃ­a tÃ´i
function closeDeleteMessageMeModal() {
    const modal = document.getElementById("delete-message-me-modal");
    if (!modal) return;
    modal.classList.remove("show");
    setTimeout(() => {
        modal.style.display = "none";
        messageIdToDelete = null;
    }, 250);
}

// Gá»i API vÃ  cáº­p nháº­t DOM, bá»™ nhá»› táº¡m
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
            // Cáº­p nháº­t máº£ng currentChatMessages á»Ÿ frontend
            currentChatMessages = currentChatMessages.filter(m => m.id !== messageId);
        } else {
            alert("Lá»—i khi xÃ³a tin nháº¯n: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i khi xÃ³a tin nháº¯n: " + error.message);
    }
}

// 12. Gá»­i cáº£m xÃºc vÃ o tin nháº¯n
async function reactToMessage(messageId, reaction) {
    ChatSounds.playReact();
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
            alert("Lá»—i gá»­i cáº£m xÃºc: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i khi gá»­i cáº£m xÃºc: " + error.message);
    }
}

// 13. Hiá»ƒn thá»‹ cÃ¡c icon cáº£m xÃºc dÆ°á»›i tin nháº¯n
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

    // LÆ°u trá»¯ cáº£m xÃºc vÃ o dataset cá»§a pháº§n tá»­ tin nháº¯n chÃ­nh Ä‘á»ƒ so sÃ¡nh sau nÃ y
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

    // ÄÄƒng kÃ½ click má»Ÿ chi tiáº¿t cáº£m xÃºc giá»‘ng Messenger
    reactionsContainer.onclick = (e) => {
        e.stopPropagation();
        openReactionsDetailModal(reactions);
    };
}

// --- HIá»†U á»¨NG Ná»” Cáº¢M XÃšC GIá»NG MESSENGER ---
function createReactionBurst(messageId, emoji) {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (!msgEl) return;

    const contentEl = msgEl.querySelector(".message-content");
    if (!contentEl) return;

    // Láº¥y toáº¡ Ä‘á»™ bong bÃ³ng chat
    const rect = contentEl.getBoundingClientRect();
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) return;
    const containerRect = messagesContainer.getBoundingClientRect();

    // TÃ­nh toáº¡ Ä‘á»™ xuáº¥t phÃ¡t (á»Ÿ giá»¯a bong bÃ³ng chat) tÆ°Æ¡ng Ä‘á»‘i vá»›i khung cuá»™n tin nháº¯n
    const startX = rect.left + rect.width / 2 - containerRect.left + messagesContainer.scrollLeft;
    const startY = rect.top + rect.height / 2 - containerRect.top + messagesContainer.scrollTop;

    const PARTICLE_COUNT = 8;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement("div");
        particle.className = "reaction-particle";
        particle.innerText = emoji;

        // Äá»‹nh vá»‹ toáº¡ Ä‘á»™ ban Ä‘áº§u
        particle.style.left = `${startX}px`;
        particle.style.top = `${startY}px`;

        // TÃ­nh toÃ¡n gÃ³c vÃ  quÃ£ng Ä‘Æ°á»ng bay ngáº«u nhiÃªn (dáº¡ng ná»• hÃ¬nh trÃ²n)
        const angle = (i * (360 / PARTICLE_COUNT) + Math.random() * 20) * (Math.PI / 180);
        const distance = 40 + Math.random() * 60; // QuÃ£ng Ä‘Æ°á»ng bay xa tá»« 40px -> 100px
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 10; // CÃ³ xu hÆ°á»›ng bay lÃªn cao má»™t chÃºt
        const rot = -30 + Math.random() * 60; // GÃ³c tá»± xoay nháº¹

        particle.style.setProperty("--dx", `${dx}px`);
        particle.style.setProperty("--dy", `${dy}px`);
        particle.style.setProperty("--rot", `${rot}deg`);

        messagesContainer.appendChild(particle);

        // Giáº£i phÃ³ng tháº» khá»i DOM sau khi cháº¡y xong animation (750ms)
        setTimeout(() => {
            particle.remove();
        }, 750);
    }
}

// ===========================================
// LÃ CHáº®N CHá»NG ZOOM TRÃŠN MOBILE (PWA)
// ===========================================

// 1. Chá»‘ng chá»¥m ngÃ³n tay (Pinch Zoom)
document.addEventListener(
    "touchmove",
    function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false },
);

// =========================================
// THÃ”NG BÃO TIN NHáº®N Má»šI (IN-APP TOAST & NATIVE)
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
    const defaultName = (msg.Users && msg.Users.fullName) || "Tin nháº¯n má»›i";
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
    if (msg.isRecalled) snippet = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
    else if (msg.type === "missed_call") snippet = "Cuá»™c gá»i nhá»¡";
    else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            snippet = `[ Tá»‡p tin: ${fileData.fileName} ]`;
        } catch (e) {
            snippet = "[ Tá»‡p tin ]";
        }
    } else if (msg.type === "audio") snippet = "[ Tin nháº¯n thoáº¡i ]";
    else if (
        msg.content &&
        (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
    ) {
        snippet = "[ HÃ¬nh áº£nh ]";
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

    // TÆ°Æ¡ng tÃ¡c: Báº¥m vÃ o Toast Ä‘á»ƒ má»Ÿ tháº³ng phÃ²ng chat
    toast.onclick = () => {
        toast.classList.add("hiding");
        setTimeout(() => toast.remove(), 300);

        startChat(msg.senderId, senderName, avatarUrl);

        // Chuyá»ƒn tab vá» menu tin nháº¯n náº¿u user Ä‘ang lÆ°á»›t tab khÃ¡c
        const messagesTabNav = document.querySelector(
            '.nav-item[title="Tin nháº¯n"]',
        );
        if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
    };

    container.appendChild(toast);

    // Tá»± Ä‘á»™ng áº©n Toast mÆ°á»£t mÃ  sau 4 giÃ¢y (NGOáº I TRá»ª lÃºc app Ä‘ang táº¯t/náº±m dÆ°á»›i ná»n)
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
    if (msg.isRecalled) snippet = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
    else if (msg.type === "missed_call") snippet = "Cuá»™c gá»i nhá»¡";
    else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            snippet = `[ Tá»‡p tin: ${fileData.fileName} ]`;
        } catch (e) {
            snippet = "[ Tá»‡p tin ]";
        }
    } else if (msg.type === "audio") snippet = "[ Tin nháº¯n thoáº¡i ]";
    else if (
        msg.content &&
        (msg.content.startsWith("data:image") ||
            msg.content.match(/\.(jpeg|jpg|gif|png)$/i))
    ) {
        snippet = "[ HÃ¬nh áº£nh ]";
    }

    let avatarUrl = sender.avatar ?
        formatUrl(sender.avatar) :
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            senderName,
        )}&background=random`;

    // HIá»‚N THá»Š THÃ”NG BÃO Há»† THá»NG (SYSTEM NATIVE NOTIFICATION BANNER)
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            // Sá»­ dá»¥ng Service Worker (Chuáº©n nháº¥t cho di Ä‘á»™ng iOS/Android vÃ  trÃ¡nh bá»‹ Chrome Mobile block)
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
                // Fallback cho trÃ¬nh duyá»‡t Desktop khÃ´ng há»— trá»£ SW
                const notification = new Notification(senderName, {
                    body: snippet,
                    icon: avatarUrl,
                });
                notification.onclick = () => {
                    window.focus();
                    startChat(msg.senderId, senderName, avatarUrl);
                    const messagesTabNav = document.querySelector(
                        '.nav-item[title="Tin nháº¯n"]',
                    );
                    if (messagesTabNav) switchTab("tab-messages", messagesTabNav);
                };
            }
        } catch (err) {
            console.warn("Lá»—i khi hiá»ƒn thá»‹ thÃ´ng bÃ¡o há»‡ thá»‘ng:", err);
            showNewMessageToast(msg);
        }
    } else {
        // Fallback hiá»‡n Toast ná»•i trong app náº¿u khÃ´ng cÃ³ quyá»n/khÃ´ng há»— trá»£ thÃ´ng bÃ¡o há»‡ thá»‘ng
        showNewMessageToast(msg);
    }
}

// ==========================================
// Cáº¬P NHáº¬T "ÄÃƒ XEM" KHI QUAY Láº I TRÃŒNH DUYá»†T
// ==========================================
window.addEventListener("focus", () => {
    if (currentConversationId && socket && isChatAreaVisible()) {
        emitMarkMessagesRead();
    }
});

// =========================================
// TÃNH NÄ‚NG Äáº¢O CAMERA (TRÆ¯á»šC/SAU)
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
        console.error("Lá»—i Ä‘áº£o Camera:", error);
        alert("KhÃ´ng thá»ƒ di chuyá»ƒn Camera. Thiáº¿t bá»‹ cÃ³ thá»ƒ khÃ´ng há»— trá»£.");
        currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    }
}

// ÄÃ³ng táº¥t cáº£ báº£ng cáº£m xÃºc & menu khi cháº¡m ngoÃ i
document.addEventListener("click", () => {
    document
        .querySelectorAll(".reaction-palette.show")
        .forEach((p) => p.classList.remove("show"));
    document
        .querySelectorAll(".more-menu.show")
        .forEach((m) => m.classList.remove("show"));
});

// ===========================================
// LOGIC GIAO DIá»†N & Há»’ SÆ 
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

    // Thiáº¿t láº­p sá»± kiá»‡n cho modal XÃ³a tin nháº¯n á»Ÿ phÃ­a tÃ´i
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

        // Tá»± Ä‘á»™ng Ä‘Ã³ng vÃ  xÃ³a ná»™i dung tÃ¬m kiáº¿m khi click ra ngoÃ i
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

    // Tá»± Ä‘á»™ng Ä‘á»“ng bá»™ vá»‹ trÃ­ slider-pill khi sidebar hiá»ƒn thá»‹ hoáº·c thay Ä‘á»•i kÃ­ch thÆ°á»›c (Fix lá»—i tab áº©n/tÃ ng hÃ¬nh khi load app)
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
            // ÄÃ³ng cÃ¡c modal khÃ¡c cho gá»n
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
            console.error("Lá»—i Ä‘Ã¡nh dáº¥u Ä‘Ã£ Ä‘á»c táº¥t cáº£:", e);
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

    showLoading("ÄÄƒng nháº­p tá»± Ä‘á»™ng...");

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
        console.error("Lá»—i Ä‘Äƒng nháº­p tá»± Ä‘á»™ng:", error);
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
    // Cáº­p nháº­t láº¡i mÃ u ná»n chá»§ Ä‘á» chat tÆ°Æ¡ng á»©ng vá»›i cháº¿ Ä‘á»™ sÃ¡ng/tá»‘i má»›i
    if (typeof applyChatTheme === "function") {
        applyChatTheme(currentChatTheme);
    }
}

// =========================================
// TÃNH NÄ‚NG Má»šI: LIGHTBOX (XEM áº¢NH PHÃ“NG TO)
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

// --- Xá»¬ LÃ Há»’ SÆ  NGÆ¯á»œI DÃ™NG (USER PROFILE MODAL) ---
async function showUserProfile(userId) {
    return openOtherUserProfileModal(userId);
}

async function openOtherUserProfileModal(userId) {
    if (!userId) return;
    try {
        showLoading("Äang táº£i há»“ sÆ¡...");
        const res = await fetch(`${API_URL}/users/${userId}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || "KhÃ´ng thá»ƒ táº£i thÃ´ng tin há»“ sÆ¡.");
        }
        const user = await res.json();

        const modal = document.getElementById("other-user-profile-modal");
        if (!modal) return;

        // Cáº­p nháº­t DOM
        const coverImg = modal.querySelector(".profile-cover-banner img");
        const avatarImg = modal.querySelector(".profile-avatar-circle img");
        const statusDot = modal.querySelector(".profile-avatar-circle .profile-status-dot");
        const nameEl = modal.querySelector(".profile-name");
        const bioEl = modal.querySelector(".profile-status-text");

        if (coverImg) coverImg.src = formatUrl(user.coverPhotoGroupUrl) + `?v=${Date.now()}`;
        if (avatarImg) avatarImg.src = formatUrl(user.profileAvatarUrl) + `?v=${Date.now()}`;

        if (statusDot) {
            statusDot.className = `profile-status-dot ${user.status}`;
            statusDot.title = user.status === "online" ? "Äang hoáº¡t Ä‘á»™ng" : "Ngoáº¡i tuyáº¿n";
        }

        if (nameEl) nameEl.innerText = user.name || "NgÆ°á»i dÃ¹ng";
        if (bioEl) bioEl.innerText = user.bio || "ChÆ°a cÃ³ tiá»ƒu sá»­";

        // GÃ¡n sá»± kiá»‡n click cho cÃ¡c nÃºt hÃ nh Ä‘á»™ng
        const chatBtn = modal.querySelector(".profile-action-item.btn-chat");
        const callBtn = modal.querySelector(".profile-action-item.btn-call");
        const videoBtn = modal.querySelector(".profile-action-item.btn-video");

        if (chatBtn) {
            chatBtn.onclick = () => {
                closeOtherUserProfileModal();
                startChat(user.id, user.name, formatUrl(user.profileAvatarUrl));
                const messagesTabNav = document.querySelector('.nav-item[title="Tin nháº¯n"]');
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
        alert("Lá»—i táº£i há»“ sÆ¡ ngÆ°á»i dÃ¹ng: " + error.message);
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


// Biáº¿n cá» khÃ³a chá»‘ng spam click (ÄÃ£ tá»‘i Æ°u hÃ³a sang kiá»ƒm tra active Ä‘á»ƒ pháº£n há»“i ngay láº­p tá»©c)
let isSwitchingTab = false;

// Chuyá»ƒn Ä‘á»•i giá»¯a cÃ¡c Tab
function switchTab(tabId, navElement) {
    // Náº¿u tab Ä‘Ã£ hiá»ƒn thá»‹ sáºµn rá»“i thÃ¬ khÃ´ng lÃ m gÃ¬ (TrÃ¡nh render láº¡i dÆ° thá»«a)
    const targetTab = document.getElementById(tabId);
    if (targetTab && targetTab.classList.contains("active")) return;

    // PhÃ¡t Ã¢m thanh click ngáº¯n khi chuyá»ƒn tab thÃ nh cÃ´ng
    if (typeof tabClickSound !== "undefined" && tabClickSound) {
        tabClickSound.currentTime = 0;
        tabClickSound.play().catch(err => console.log("Ã‚m thanh bá»‹ cháº·n phÃ¡t tá»± Ä‘á»™ng bá»Ÿi trÃ¬nh duyá»‡t:", err));
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

    // â”€â”€ TrÆ°á»£t pill indicator â”€â”€
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

    // â”€â”€ Ripple effect khi cháº¡m â”€â”€
    const ripple = document.createElement('span');
    ripple.classList.add('nav-ripple');
    const size = 30;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    ripple.style.marginLeft = ripple.style.marginTop = -(size / 2) + 'px';
    navElement.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
    // Khá»Ÿi táº¡o/cáº­p nháº­t thÃ´ng tin chÃ o má»«ng cá»§a tab AI
    if (tabId === "tab-ai") {
        const welcomeTitle = document.getElementById("ai-welcome-title");
        if (welcomeTitle) {
            welcomeTitle.innerText = `HÃ´m nay báº¡n tháº¿ nÃ o, ${myUsername || "báº¡n"}?`;
        }
        loadAiChatHistory();
        updateAiQuotaBar(); // Cáº­p nháº­t thanh háº¡n ngáº¡ch AI
    }

    // Xá»­ lÃ½ áº©n/hiá»ƒn thá»‹ mobile-header (thanh tÃ¬m kiáº¿m trÃªn mobile) khi Ä‘á»•i tab
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
// Táº£i lá»‹ch sá»­ chat AI lÆ°u trá»¯ tá»« Database
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

            // Cuá»™n xuá»‘ng cuá»‘i
            scrollAiToBottom();
        } else {
            if (welcomeEl) welcomeEl.style.display = "flex";
            wrapperEl.style.display = "none";
            wrapperEl.innerHTML = "";
        }
    } catch (err) {
        console.error("Lá»—i khi táº£i lá»‹ch sá»­ chat AI:", err);
    } finally {
        isFetchingAiHistory = false;
    }
}

// Cuá»™n mÆ°á»£t vÃ  chÃ­nh xÃ¡c xuá»‘ng cuá»‘i mÃ n hÃ¬nh chat AI sau khi váº½ DOM xong
function scrollAiToBottom() {
    const historyEl = document.getElementById("ai-chat-history");
    if (!historyEl) return;
    // Sá»­ dá»¥ng cáº£ requestAnimationFrame vÃ  setTimeout Ä‘á»ƒ báº£o Ä‘áº£m tÆ°Æ¡ng thÃ­ch tá»‘t nháº¥t trÃªn iOS/Android
    requestAnimationFrame(() => {
        historyEl.scrollTop = historyEl.scrollHeight;
        setTimeout(() => {
            historyEl.scrollTop = historyEl.scrollHeight;
        }, 50);
    });
}

// Reset cuá»™c há»™i thoáº¡i AI vá» mÃ n hÃ¬nh chÃ o má»«ng ban Ä‘áº§u
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

    // Gá»­i yÃªu cáº§u xÃ³a lá»‹ch sá»­ lÆ°u trÃªn RAM cá»§a server
    fetch("/api/ai/chat/history", {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    }).catch(err => console.error("Lá»—i khi xÃ³a lá»‹ch sá»­ chat AI:", err));
}

// Gá»­i tin nháº¯n Ä‘áº¿n Gemini AI
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

    // Hiá»ƒn thá»‹ tin nháº¯n ngÆ°á»i dÃ¹ng (phong cÃ¡ch tá»‘i giáº£n/khÃ´ng avatar giá»‘ng mockup)
    const userMsgHtml = `
      <div class="ai-message ai-user">
        <div class="ai-bubble">${escapeHTML(prompt)}</div>
      </div>
    `;
    wrapperEl.insertAdjacentHTML("beforeend", userMsgHtml);
    scrollAiToBottom();

    // Táº¡o ID duy nháº¥t cho bong bÃ³ng tin nháº¯n cá»§a AI bot nÃ y
    const botMsgId = "ai-msg-" + Date.now();

    // Hiá»ƒn thá»‹ bong bÃ³ng "Äang suy nghÄ©..." vá»›i áº£nh logo lÃ m avatar
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
            let errorMsg = "KhÃ´ng thá»ƒ káº¿t ná»‘i hoáº·c táº£i pháº£n há»“i tá»« Gemini. Vui lÃ²ng thá»­ láº¡i sau!";
            if (response.status === 429) {
                errorMsg = "TÃ i khoáº£n AI Ä‘Ã£ háº¿t háº¡n ngáº¡ch (Token) hÃ´m nay. Vui lÃ²ng thá»­ láº¡i sau hoáº·c cáº¥u hÃ¬nh API Key má»›i!";
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

        // Nháº­n stream dá»¯ liá»‡u tá»« server
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop(); // giá»¯ pháº§n tin nháº¯n chÆ°a Ä‘áº§y Ä‘á»§

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.text) {
                        // XÃ³a typing indicator á»Ÿ chunk Ä‘áº§u tiÃªn nháº­n Ä‘Æ°á»£c
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
                    // Náº¿u lá»—i do throw Error(data.error) tá»± Ä‘á»‹nh nghÄ©a á»Ÿ trÃªn thÃ¬ chuyá»ƒn tiáº¿p ra ngoÃ i catch chÃ­nh
                    if (e.message && (e.message.includes("âš ï¸") || e.message.includes("háº¡n ngáº¡ch") || e.message.includes("Lá»—i:"))) {
                        throw e;
                    }
                    console.error("Lá»—i xá»­ lÃ½ chunk stream:", e);
                }
            }
        }

        // TÄƒng sá»‘ lÆ°á»£t gá»i AI thÃ nh cÃ´ng lÃªn 1
        incrementAiRequestCount();
    } catch (error) {
        // XÃ³a indicator náº¿u cÃ³ lá»—i xáº£y ra
        const indicator = document.getElementById(`${botMsgId}-indicator`);
        if (indicator) indicator.remove();

        const bubbleEl = document.getElementById(`${botMsgId}-bubble`);
        if (bubbleEl) {
            const msg = error.message || "KhÃ´ng thá»ƒ káº¿t ná»‘i hoáº·c táº£i pháº£n há»“i tá»« Gemini. Vui lÃ²ng thá»­ láº¡i sau!";
            bubbleEl.innerHTML = `
                <span style="color: #ef4444; font-weight: 500;">
                    âŒ ${msg.startsWith("Lá»—i:") || msg.startsWith("âš ï¸") ? msg : `Lá»—i: ${msg}`}
                </span>
            `;

            // Náº¿u lá»—i do háº¿t háº¡n ngáº¡ch hoáº·c token
            if (msg.includes("háº¡n ngáº¡ch") || msg.includes("Token") || msg.includes("429") || msg.includes("limit") || msg.includes("quota")) {
                updateAiQuotaBar(true); // Báº¯t buá»™c set thanh quota lÃªn 100%
            }
        }
    }

    scrollAiToBottom();
}

// Äá»‹nh dáº¡ng vÄƒn báº£n tráº£ vá» tá»« AI (chuyá»ƒn Ä‘á»•i code, bold, list, heading, newline thÃ nh HTML)
function formatAiResponse(text) {
    if (!text) return "";
    let formatted = escapeHTML(text);
    const codeBlocks = [];

    // 1. TrÃ­ch xuáº¥t vÃ  Ä‘á»‹nh dáº¡ng cÃ¡c khá»‘i code blocks trÆ°á»›c
    formatted = formatted.replace(/```(\w+)?\s*\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang ? lang.trim() : "code";
        const displayCode = code.trim();
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;

        const codeBlockHtml = `
        <div class="ai-code-wrapper">
          <div class="ai-code-header">
            <span class="ai-code-header-lang">${language}</span>
            <button class="ai-code-copy-btn" onclick="copyCodeText(this)">
              <i class="fa-regular fa-copy"></i> Sao chÃ©p
            </button>
          </div>
          <div class="ai-code-block">
            <pre>${displayCode}</pre>
          </div>
        </div>`.trim();

        codeBlocks.push(codeBlockHtml);
        return placeholder;
    });

    // 2. TÃ¡ch vÄƒn báº£n theo tá»«ng dÃ²ng Ä‘á»ƒ xá»­ lÃ½ chÃ­nh xÃ¡c danh sÃ¡ch (ul/ol) vÃ  tiÃªu Ä‘á» (h1-h6)
    const lines = formatted.split("\n");
    const resultLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Kiá»ƒm tra dÃ²ng cÃ³ pháº£i lÃ  tiÃªu Ä‘á» Markdown khÃ´ng (báº¯t Ä‘áº§u báº±ng # vÃ  khoáº£ng tráº¯ng)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        // Kiá»ƒm tra dÃ²ng cÃ³ pháº£i lÃ  pháº§n tá»­ danh sÃ¡ch khÃ´ng (báº¯t Ä‘áº§u báº±ng * hoáº·c - hoáº·c + vÃ  khoáº£ng tráº¯ng)
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

            // Äá»‹nh nghÄ©a kÃ­ch thÆ°á»›c font chá»¯ vÃ  lá» tÆ°Æ¡ng á»©ng cho tá»«ng cáº¥p Ä‘á»™ tiÃªu Ä‘á»
            let fontSize = "15px";
            let marginTop = "12px";
            let marginBottom = "6px";
            if (level === 1) { fontSize = "20px"; marginTop = "18px"; marginBottom = "10px"; }
            else if (level === 2) { fontSize = "17px"; marginTop = "16px"; marginBottom = "8px"; }
            else if (level === 3) { fontSize = "15px"; marginTop = "14px"; marginBottom = "6px"; }

            resultLines.push(`<h${level} style="font-size: ${fontSize}; margin-top: ${marginTop}; margin-bottom: ${marginBottom}; font-weight: 600; line-height: 1.35; color: var(--text-dark); display: block;">${formattedContent}</h${level}>`);
        } else if (listMatch) {
            const content = listMatch[1];
            // Äá»‹nh dáº¡ng inline bold vÃ  inline code cho ná»™i dung li trÆ°á»›c
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

            // Äá»‹nh dáº¡ng inline bold vÃ  inline code cho cÃ¡c dÃ²ng thÆ°á»ng
            let formattedLine = line
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); color: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

            resultLines.push(formattedLine);
        }
    }

    // Náº¿u káº¿t thÃºc chuá»—i váº«n Ä‘ang á»Ÿ trong tháº» ul thÃ¬ Ä‘Ã³ng láº¡i
    if (inList) {
        resultLines.push('</ul>');
    }

    // Ná»‘i cÃ¡c dÃ²ng láº¡i, vá»›i cÃ¡c dÃ²ng khÃ´ng pháº£i lÃ  ul/li/heading thÃ¬ dÃ¹ng <br> Ä‘á»ƒ xuá»‘ng dÃ²ng
    // TrÃ¡nh thÃªm <br> sau cÃ¡c tháº» <ul>, </ul>, <li>, </li>, <h1-6>
    let finalHtml = "";
    for (let i = 0; i < resultLines.length; i++) {
        const curr = resultLines[i];
        const next = resultLines[i + 1] || "";

        finalHtml += curr;

        // ThÃªm <br> náº¿u dÃ²ng hiá»‡n táº¡i vÃ  dÃ²ng tiáº¿p theo khÃ´ng pháº£i lÃ  tháº» ul/li/heading hoáº·c trá»‘ng
        const isCurrTag = curr.startsWith("<ul") || curr.startsWith("</ul>") || curr.startsWith("<li") || curr.startsWith("</li>") || curr.startsWith("<h");
        const isNextTag = next.startsWith("<ul") || next.startsWith("</ul>") || next.startsWith("<li") || next.startsWith("</li>") || next.startsWith("<h");

        if (i < resultLines.length - 1 && !isCurrTag && !isNextTag) {
            finalHtml += "<br>";
        }
    }

    // 3. KhÃ´i phá»¥c cÃ¡c khá»‘i code blocks
    codeBlocks.forEach((codeBlockHtml, index) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${index}__`;
        finalHtml = finalHtml.split(placeholder).join(codeBlockHtml);
    });

    return finalHtml;
}

// HÃ m sao chÃ©p code vÃ o clipboard
function copyCodeText(btn) {
    const wrapper = btn.closest(".ai-code-wrapper");
    if (!wrapper) return;
    const pre = wrapper.querySelector("pre");
    if (!pre) return;

    const codeText = pre.textContent || pre.innerText;

    navigator.clipboard.writeText(codeText).then(() => {
        const origHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check" style="color: #10B981;"></i> ÄÃ£ chÃ©p`;
        setTimeout(() => {
            btn.innerHTML = origHtml;
        }, 2000);
    }).catch(err => {
        console.error("Lá»—i sao chÃ©p code:", err);
    });
}

// ÄÄƒng xuáº¥t
async function logout() {
    const consent = await customConfirm("ÄÄƒng xuáº¥t", "Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n Ä‘Äƒng xuáº¥t khá»i tÃ i khoáº£n khÃ´ng?", "ÄÄƒng xuáº¥t", "Há»§y", true);
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
    
    // Tráº£ header láº¡i vÃ o trong .chat-window Ä‘á»ƒ hiá»ƒn thá»‹ bÃ¬nh thÆ°á»ng trÃªn desktop
    const mobileHeader = document.getElementById("chat-header-container");
    const mobileChatWindow = document.querySelector(".chat-window");
    if (mobileHeader && mobileChatWindow) {
        mobileChatWindow.insertBefore(mobileHeader, mobileChatWindow.firstChild);
    }
    // áº¨n Tab Bar (Ä‘Ã£ chuyá»ƒn ra ngoÃ i #chat-screen)
    const tabBarLogout = document.getElementById("main-tab-bar");
    if (tabBarLogout) tabBarLogout.style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";

    document.getElementById("login-password").value = "";

    const defaultTab = document.querySelector('.sidebar .nav-item') || document.querySelector('.nav-item[title="Tin nháº¯n"]');
    if (defaultTab) switchTab("tab-messages", defaultTab);

    // â”€â”€ Khá»Ÿi táº¡o pill Ä‘Ãºng vá»‹ trÃ­ ngay khi load (khÃ´ng cÃ³ animation) â”€â”€
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

// Cáº­p nháº­t áº¢nh bÃ¬a (Cover Image)
const coverUploadInput = document.getElementById("cover-upload");
if (coverUploadInput) {
    coverUploadInput.addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading("Äang xá»­ lÃ½ vÃ  nÃ©n áº£nh bÃ¬a...");
            // NÃ©n áº£nh bÃ¬a xuá»‘ng max 800x400 JPEG quality 0.8 (~60KB)
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
                showTempToast("ÄÃ£ cáº­p nháº­t áº£nh bÃ¬a má»›i thÃ nh cÃ´ng!");
            } else {
                alert("Lá»—i táº£i áº£nh bÃ¬a: " + data.message);
            }
        } catch (error) {
            hideLoading();
            alert("Lá»—i há»‡ thá»‘ng khi táº£i áº£nh bÃ¬a lÃªn!");
        }
    });
}

// Cáº­p nháº­t ThÃ´ng tin Há»“ sÆ¡ (TÃªn & Tiá»ƒu sá»­)
async function openEditProfileModal() {
    const currentName = document.getElementById("profile-name").innerText;
    const currentBio = document.getElementById("profile-bio").innerText;

    const newName = await customPrompt("Äá»•i tÃªn hiá»ƒn thá»‹", "Nháº­p tÃªn hiá»ƒn thá»‹ má»›i cá»§a báº¡n:", currentName, "TÃªn hiá»ƒn thá»‹");
    if (newName === null) return;

    const newBio = await customPrompt(
        "Äá»•i tiá»ƒu sá»­",
        "Nháº­p dÃ²ng tráº¡ng thÃ¡i/tiá»ƒu sá»­ má»›i:",
        currentBio !== "ChÆ°a cÃ³ tiá»ƒu sá»­" ? currentBio : "",
        "Tiá»ƒu sá»­ / DÃ²ng tráº¡ng thÃ¡i"
    );
    if (newBio === null) return;

    if (!newName.trim()) return alert("TÃªn hiá»ƒn thá»‹ khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng!");

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
                data.data.bio || "ChÆ°a cÃ³ tiá»ƒu sá»­";
            alert("Cáº­p nháº­t thÃ´ng tin thÃ nh cÃ´ng!");
        } else {
            alert("Cáº­p nháº­t bá»‹ lá»—i: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i máº¡ng khi cáº­p nháº­t thÃ´ng tin!");
    }
}

// ==========================================
// LOGIC Gá»ŒI VIDEO / THOáº I (WEBRTC)
// ==========================================

async function upgradeToVideoCall() {
    if (callTypeGlobal !== "voice" || !localStream || !peerConnection) {
        console.warn(
            "KhÃ´ng thá»ƒ nÃ¢ng cáº¥p: cuá»™c gá»i khÃ´ng pháº£i di Ä‘á»™ng hoáº·c chÆ°a káº¿t ná»‘i.",
        );
        return;
    }

    try {
        console.log("Äang yÃªu cáº§u quyá»n truy cáº­p camera Ä‘á»ƒ nÃ¢ng cáº¥p...");

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
            throw new Error("KhÃ´ng thá»ƒ thÃªm video track vÃ o PeerConnection.");
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

        console.log("Báº¯t Ä‘áº§u renegotiate Ä‘á»ƒ gá»­i video luá»“ng...");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("webrtc_signal", {
            connectedUserId: currentCallPartnerId,
            signal: { offer },
        });
    } catch (error) {
        console.error("Lá»—i khi nÃ¢ng cáº¥p cuá»™c gá»i video:", error);
        alert(
            "KhÃ´ng thá»ƒ báº­t video. Vui lÃ²ng kiá»ƒm tra láº¡i quyá»n truy cáº­p camera cá»§a báº¡n.",
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
// QUáº¢N LÃ HIá»†U á»¨NG RUNG TRÃŠN ÄIá»†N THOáº I
// ==========================================

let callVibrationActive = false;

function triggerCallVibration() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.vibrate) {
        try {
            // Rung liÃªn tá»¥c dÃ i 30 giÃ¢y (rung 1.2s, nghá»‰ 0.8s, láº·p láº¡i 15 láº§n)
            navigator.vibrate([
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800,
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800,
                1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800
            ]);
        } catch (e) {
            console.warn("Lá»—i gá»i navigator.vibrate:", e);
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

    // ÄÄƒng kÃ½ sá»± kiá»‡n cháº¡m mÃ n hÃ¬nh Ä‘á»ƒ giáº£i phÃ³ng Gesture Lock cá»§a trÃ¬nh duyá»‡t vÃ  kÃ­ch hoáº¡t rung ngay láº­p tá»©c
    document.addEventListener("click", handleUserInteractionVibrate);
    document.addEventListener("touchstart", handleUserInteractionVibrate);

    if (vibrateInterval) clearInterval(vibrateInterval);
    vibrateInterval = setInterval(() => {
        if (callVibrationActive) {
            triggerCallVibration();
        }
    }, 25000); // Láº·p láº¡i sau má»—i 25s Ä‘á»ƒ phá»§ kÃ­n thá»i gian Ä‘á»• chuÃ´ng náº¿u chÆ°a báº¯t mÃ¡y
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

// 1. Báº¯t Ä‘áº§u cuá»™c gá»i (NgÆ°á»i gá»i)
async function startCall(callType) {
    if (!currentChatPartnerId) return alert("Vui lÃ²ng chá»n má»™t ngÆ°á»i Ä‘á»ƒ gá»i.");

    // PhÃ¡t nháº¡c chá» cuá»™c gá»i Ä‘i Ä‘á»“ng bá»™ ngay láº­p tá»©c Ä‘á»ƒ giá»¯ gesture context trÃªn di Ä‘á»™ng
    playOutgoingRingtone();

    callTypeGlobal = callType;
    currentCallPartnerId = currentChatPartnerId;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "TrÃ¬nh duyá»‡t cháº·n Microphone do báº¡n khÃ´ng sá»­ dá»¥ng HTTPS hoáº·c Localhost!",
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
            video: callTypeGlobal === "video" ?
                (selectedCamId ? { deviceId: { exact: selectedCamId } } :
                    (isMobile ? { facingMode: currentFacingMode } : true)) : false,
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (error) {
            console.warn("Lá»—i khi má»Ÿ luá»“ng Media vá»›i constraints gá»‘c:", error);
            // Fallback 1: Náº¿u yÃªu cáº§u video mÃ  khÃ´ng cÃ³ camera, hÃ£y thá»­ chá»‰ láº¥y audio
            if (callTypeGlobal === "video") {
                try {
                    console.log("Thá»­ láº¡i: YÃªu cáº§u cuá»™c gá»i chá»‰ láº¥y audio do thiáº¿u camera...");
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            noiseSuppression: isNoiseCancellationEnabled,
                            echoCancellation: true,
                        },
                        video: false
                    });
                    showTempToast("KhÃ´ng tÃ¬m tháº¥y Camera. Cuá»™c gá»i tiáº¿p tá»¥c á»Ÿ cháº¿ Ä‘á»™ chá»‰ Ã¢m thanh.");
                } catch (audioOnlyErr) {
                    console.warn("Thá»­ chá»‰ láº¥y audio tháº¥t báº¡i:", audioOnlyErr);
                }
            }

            // Fallback 2: Thá»­ láº¥y cáº¥u hÃ¬nh siÃªu cÆ¡ báº£n (chá»‰ audio)
            if (!localStream) {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                } catch (fallbackError) {
                    console.error("Lá»—i hoÃ n toÃ n khi truy cáº­p micro:", fallbackError);
                    if (fallbackError.name === "NotFoundError" || fallbackError.name === "DevicesNotFoundError") {
                        showTempToast("KhÃ´ng tÃ¬m tháº¥y Microphone trÃªn mÃ¡y tÃ­nh nÃ y. Cuá»™c gá»i á»Ÿ cháº¿ Ä‘á»™ chá»‰ nghe.");
                    } else if (fallbackError.name === "NotAllowedError" || fallbackError.name === "PermissionDeniedError") {
                        showTempToast("TrÃ¬nh duyá»‡t bá»‹ cháº·n quyá»n truy cáº­p Microphone. Vui lÃ²ng cáº¥p quyá»n á»Ÿ Ã´ Ä‘á»‹a chá»‰!");
                    } else {
                        showTempToast("KhÃ´ng thá»ƒ káº¿t ná»‘i Microphone. Cuá»™c gá»i á»Ÿ cháº¿ Ä‘á»™ chá»‰ nghe.");
                    }
                    localStream = null;
                }
            }
        }

        if (localStream && callTypeGlobal === "video") {
            const localVideo = document.getElementById("local-video");
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.muted = true; // TrÃ¡nh vá»ng tiáº¿ng
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
        document.getElementById("call-status").innerText = "Äang gá»i...";

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

        // Thiáº¿t láº­p timeout tá»± Ä‘á»™ng há»§y cuá»™c gá»i sau 30 giÃ¢y náº¿u Ä‘á»‘i phÆ°Æ¡ng khÃ´ng báº¯t mÃ¡y
        if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
        callTimeoutTimer = setTimeout(() => {
            const callModal = document.getElementById("call-modal");
            if (callModal && callModal.style.display === "flex" && !callModal.classList.contains("in-call")) {
                console.log("â±ï¸ Cuá»™c gá»i háº¿t thá»i gian chá» pháº£n há»“i (30s). Tá»± Ä‘á»™ng ngáº¯t.");
                showTempToast("KhÃ´ng cÃ³ pháº£n há»“i tá»« ngÆ°á»i nháº­n.");
                endCall(true);
            }
        }, 30000);

    } catch (err) {
        stopOutgoingRingtone();
        console.error("Lá»—i trong startCall:", err);
        alert("KhÃ´ng thá»ƒ thá»±c hiá»‡n cuá»™c gá»i: " + err.message);
    }
}

// 2. Xá»­ lÃ½ khi cÃ³ cuá»™c gá»i Ä‘áº¿n (Callee)
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

        document.getElementById("call-name").innerText = callerName || "NgÆ°á»i dÃ¹ng";

        let safeAvatar;
        if (callerAvatar && callerAvatar.trim() !== "") {
            safeAvatar = formatUrl(callerAvatar);
        } else {
            safeAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                callerName || "User",
            )}&background=random`;
        }

        document.getElementById("call-avatar").src = safeAvatar;
        document.getElementById("call-status").innerText = `${callType === "video" ? "video" : "Ä‘iá»‡n thoáº¡i"
            } cho báº¡n...`;

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

            // Má»Ÿ khÃ³a autoplay trÃ¬nh duyá»‡t báº±ng AudioContext (iOS Safari cáº§n user gesture)
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = ctx.createBuffer(1, 1, 22050);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
                // ÄÃ¡nh dáº¥u remoteAudio sáºµn sÃ ng phÃ¡t khi ontrack gÃ¡n srcObject
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
                console.warn("KhÃ´ng thá»ƒ má»Ÿ khÃ³a AudioContext:", e);
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
        console.error("Lá»—i khi hiá»ƒn thá»‹ cuá»™c gá»i Ä‘áº¿n:", error);
    }
}

// 2.5 Xá»­ lÃ½ khi cuá»™c gá»i bá»‹ tá»« chá»‘i (NgÆ°á»i gá»i)
function handleCallRejected(data) {
    stopVibration();
    stopOutgoingRingtone();
    const reason = data ? data.reason : null;
    if (reason === "offline") {
        alert("NgÆ°á»i dÃ¹ng hiá»‡n khÃ´ng trá»±c tuyáº¿n.");
    } else {
        alert("NgÆ°á»i dÃ¹ng Ä‘Ã£ tá»« chá»‘i cuá»™c gá»i.");
    }
    endCall(false);
}

// 3. Cuá»™c gá»i Ä‘Æ°á»£c cháº¥p nháº­n (NgÆ°á»i gá»i)
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
                calleeInfo.fullName || "NgÆ°á»i dÃ¹ng";

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
        console.error("Lá»—i khi xá»­ lÃ½ cháº¥p nháº­n cuá»™c gá»i:", error);
        alert("CÃ³ thá»ƒ xáº£y ra lá»—i khi káº¿t ná»‘i cuá»™c gá»i.");
        endCall(true);
    }
}

// 3.5. Äá»‘i phÆ°Æ¡ng nÃ¢ng cáº¥p lÃªn Video Call
function handleUpgradeToVideo() {
    if (callTypeGlobal === "video") return;

    console.log("Äá»‘i phÆ°Æ¡ng Ä‘Ã£ báº­t video. NÃ¢ng cáº¥p cuá»™c gá»i...");
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

// 4. Báº¯t Ä‘áº§u phiÃªn báº£n WebRTC
async function startCallSession(isCaller, calleeInfo = null) {
    // Reset hÃ ng Ä‘á»£i candidates khi báº¯t Ä‘áº§u cuá»™c gá»i má»›i trÃ¡nh láº«n candidates cÅ©
    iceCandidateQueue = [];
    document.getElementById("call-modal").classList.add("in-call");
    document.getElementById("call-status").innerText = "Trong cuá»™c gá»i...";

    document
        .getElementById("incoming-call-actions")
        .setAttribute("style", "display: none !important");
    document
        .getElementById("active-call-actions")
        .setAttribute("style", "display: flex !important");

    try {
        // Äá»ƒ trÃ¡nh xung Ä‘á»™t Ã¢m thanh vá»›i nháº¡c chuÃ´ng (dialtone/ringtone) lÃ m micro bá»‹ ngáº¯t/táº¯t tiáº¿ng trÃªn thiáº¿t bá»‹ di Ä‘á»™ng,
        // chÃºng tÃ´i luÃ´n táº¯t vÃ  xin cáº¥p láº¡i má»™t localStream má»›i sáº¡ch sáº½ ngay khi báº¯t Ä‘áº§u káº¿t ná»‘i.
        if (localStream) {
            try {
                localStream.getTracks().forEach((track) => track.stop());
            } catch (e) {
                console.warn("Lá»—i dá»«ng stream cÅ©:", e);
            }
            localStream = null;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "TrÃ¬nh duyá»‡t cháº·n Microphone do báº¡n khÃ´ng dÃ¹ng HTTPS hoáº·c Localhost!",
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
                    autoGainControl: true, // KÃ­ch hoáº¡t tá»± Ä‘á»™ng tÄƒng Ã¢m lÆ°á»£ng micro
                    ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {})
                },
                video: callTypeGlobal === "video" ?
                    (selectedCamId ? { deviceId: { exact: selectedCamId } } :
                        (isMobile ? { facingMode: currentFacingMode } : true)) : false,
            };

            try {
                localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
            } catch (err) {
                console.warn("Lá»—i khi má»Ÿ luá»“ng Media trong session vá»›i constraints gá»‘c:", err);
                // Fallback 1: Náº¿u yÃªu cáº§u video mÃ  khÃ´ng cÃ³ camera, hÃ£y thá»­ chá»‰ láº¥y audio
                if (callTypeGlobal === "video") {
                    try {
                        console.log("Thá»­ láº¡i trong session: YÃªu cáº§u chá»‰ láº¥y audio do thiáº¿u camera...");
                        localStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                noiseSuppression: isNoiseCancellationEnabled,
                                echoCancellation: true,
                                autoGainControl: true,
                            },
                            video: false
                        });
                        showTempToast("KhÃ´ng tÃ¬m tháº¥y Camera. Thiáº¿t láº­p cuá»™c gá»i á»Ÿ cháº¿ Ä‘á»™ chá»‰ Ã¢m thanh.");
                    } catch (audioOnlyErr) {
                        console.warn("Thá»­ chá»‰ láº¥y audio trong session tháº¥t báº¡i:", audioOnlyErr);
                    }
                }

                // Fallback 2: Thá»­ láº¥y cáº¥u hÃ¬nh siÃªu cÆ¡ báº£n (chá»‰ audio)
                if (!localStream) {
                    try {
                        localStream = await navigator.mediaDevices.getUserMedia({
                            audio: true,
                            video: false
                        });
                    } catch (fallbackErr) {
                        console.error("Lá»—i hoÃ n toÃ n khi truy cáº­p micro trong session:", fallbackErr);
                        if (fallbackErr.name === "NotFoundError" || fallbackErr.name === "DevicesNotFoundError") {
                            showTempToast("KhÃ´ng tÃ¬m tháº¥y Microphone trÃªn mÃ¡y tÃ­nh nÃ y. Báº¡n á»Ÿ cháº¿ Ä‘á»™ chá»‰ nghe.");
                        } else if (fallbackErr.name === "NotAllowedError" || fallbackErr.name === "PermissionDeniedError") {
                            showTempToast("Vui lÃ²ng cho phÃ©p quyá»n truy cáº­p Microphone trÃªn trÃ¬nh duyá»‡t Ä‘á»ƒ nÃ³i!");
                        } else {
                            showTempToast("KhÃ´ng thá»ƒ káº¿t ná»‘i Microphone. Báº¡n á»Ÿ cháº¿ Ä‘á»™ chá»‰ nghe.");
                        }
                        localStream = null;
                    }
                }
            }

            if (localStream && callTypeGlobal === "video") {
                const localVideo = document.getElementById("local-video");
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.muted = true; // TrÃ¡nh vá»ng tiáº¿ng
                }
            }
        } catch (error) {
            console.error("Lá»—i khÃ´ng mong muá»‘n khi chuáº©n bá»‹ phÆ°Æ¡ng tiá»‡n:", error);
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

                    // Thá»­ phÃ¡t ngay láº­p tá»©c
                    const playPromise = remoteAudio.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                console.log("ðŸ”Š PhÃ¡t Ã¢m thanh cuá»™c gá»i thÃ nh cÃ´ng láº­p tá»©c!");
                            })
                            .catch((e) => {
                                console.warn("Autoplay cháº·n Ã¢m thanh cuá»™c gá»i láº§n Ä‘áº§u, Ä‘Äƒng kÃ½ cháº¡m mÃ n hÃ¬nh Ä‘á»ƒ má»Ÿ khÃ³a...", e);
                                document.addEventListener("click", playRemoteAudioSafely);
                                document.addEventListener("touchstart", playRemoteAudioSafely);

                                // Thá»­ láº¡i sau 500ms
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
                            console.warn("Autoplay cháº·n video cuá»™c gá»i láº§n Ä‘áº§u, thá»­ láº¡i sau 300ms...", e);
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

        // Láº¯ng nghe tráº¡ng thÃ¡i káº¿t ná»‘i ICE Ä‘á»ƒ tá»± Ä‘á»™ng Restart ICE khi bá»‹ fail láº§n Ä‘áº§u
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection) {
                console.log("ICE Connection State:", peerConnection.iceConnectionState);
                if (
                    peerConnection.iceConnectionState === "failed" ||
                    peerConnection.iceConnectionState === "disconnected"
                ) {
                    console.warn("Káº¿t ná»‘i cuá»™c gá»i gáº·p trá»¥c tráº·c! Tá»± Ä‘á»™ng káº¿t ná»‘i láº¡i (ICE Restart)...");
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
            // Äá»‘i vá»›i ngÆ°á»i nháº­n, sau khi khá»Ÿi táº¡o peerConnection thÃ nh cÃ´ng,
            // xá»­ lÃ½ táº¥t cáº£ cÃ¡c tÃ­n hiá»‡u (offer/ICE) Ä‘ang chá» trong hÃ ng Ä‘á»£i.
            await processPendingSignals();
        }

        return true;
    } catch (error) {
        console.error("Lá»—i khi báº¯t Ä‘áº§u phiÃªn gá»i:", error);
        alert("Lá»—i cuá»™c gá»i: " + error.message);
        endCall(true);
        return false;
    }
}

// 5. Xá»­ lÃ½ tÃ­n hiá»‡u WebRTC nháº­n Ä‘Æ°á»£c
async function processSignal(signal) {
    if (!peerConnection) return;
    try {
        if (signal.offer) {
            console.log("Xá»­ lÃ½ offer WebRTC nháº­n Ä‘Æ°á»£c...");
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
            console.log("Xá»­ lÃ½ answer WebRTC nháº­n Ä‘Æ°á»£c...");
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(signal.answer),
            );
            processIceQueue();
        } else if (signal.ice) {
            if (peerConnection.remoteDescription) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
                } catch (e) {
                    console.warn("Lá»—i khi thÃªm ICE candidate trá»±c tiáº¿p:", e.message);
                }
            } else {
                iceCandidateQueue.push(signal.ice);
            }
        }
    } catch (error) {
        console.error("Lá»—i khi xá»­ lÃ½ tÃ­n hiá»‡u WebRTC cá»¥ thá»ƒ:", error);
    }
}

async function handleWebRTCSignal({ signal, senderId }) {
    if (senderId) {
        currentCallPartnerId = senderId;
    }

    if (!peerConnection) {
        console.log("RTCPeerConnection chÆ°a sáºµn sÃ ng, Ä‘Æ°a tÃ­n hiá»‡u vÃ o hÃ ng Ä‘á»£i:", signal);
        pendingSignalsQueue.push(signal);
        return;
    }

    await processSignal(signal);
}

async function processPendingSignals() {
    if (pendingSignalsQueue.length > 0) {
        console.log(`Äang xá»­ lÃ½ ${pendingSignalsQueue.length} tÃ­n hiá»‡u WebRTC trong hÃ ng Ä‘á»£i...`);
        const queueToProcess = [...pendingSignalsQueue];
        pendingSignalsQueue = [];
        for (const signal of queueToProcess) {
            await processSignal(signal);
        }
    }
}

// 5.5 HÃ m xá»­ lÃ½ hÃ ng Ä‘á»£i ICE
async function processIceQueue() {
    for (const ice of iceCandidateQueue) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(ice));
        } catch (e) {
            console.error("Lá»—i khi thÃªm ICE:", e);
        }
    }
    iceCandidateQueue = [];
}

// Má»Ÿ khÃ³a Ã¢m thanh cuá»™c gá»i tá»« tÆ°Æ¡ng tÃ¡c cháº¡m mÃ n hÃ¬nh cá»§a ngÆ°á»i dÃ¹ng (Bypass Autoplay cá»§a trÃ¬nh duyá»‡t)
function playRemoteAudioSafely() {
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio && remoteAudio.srcObject) {
        console.log("ðŸ”Š KÃ­ch hoáº¡t phÃ¡t Ã¢m thanh cuá»™c gá»i tá»« tÆ°Æ¡ng tÃ¡c ngÆ°á»i dÃ¹ng...");
        remoteAudio.play()
            .then(() => {
                console.log("ðŸ”Š PhÃ¡t Ã¢m thanh cuá»™c gá»i thÃ nh cÃ´ng!");
                document.removeEventListener("click", playRemoteAudioSafely);
                document.removeEventListener("touchstart", playRemoteAudioSafely);
            })
            .catch((err) => {
                console.warn("ðŸ”Š ChÆ°a thá»ƒ phÃ¡t Ã¢m thanh cuá»™c gá»i qua tÆ°Æ¡ng tÃ¡c:", err);
            });
    }

    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.play().catch(() => { });
    }
}

// Tá»± Ä‘á»™ng khá»Ÿi Ä‘á»™ng láº¡i ICE khi gáº·p sá»± cá»‘ káº¿t ná»‘i á»Ÿ láº§n Ä‘áº§u
async function triggerIceRestart(isCaller) {
    try {
        if (peerConnection && isCaller) {
            const offer = await peerConnection.createOffer({ iceRestart: true });
            await peerConnection.setLocalDescription(offer);
            socket.emit("webrtc_signal", {
                connectedUserId: currentCallPartnerId,
                signal: { offer },
            });
            console.log("âœˆï¸ ÄÃ£ kÃ­ch hoáº¡t vÃ  gá»­i yÃªu cáº§u káº¿t ná»‘i láº¡i (ICE Restart) sang Ä‘á»‘i phÆ°Æ¡ng!");
        }
    } catch (err) {
        console.error("Lá»—i khi thá»±c hiá»‡n ICE Restart:", err);
    }
}

// Tá»± Ä‘á»™ng kiá»ƒm tra vÃ  chuyá»ƒn tiáº¿p sang mÃ n hÃ¬nh cuá»™c gá»i Ä‘áº§y Ä‘á»§ khi click thÃ´ng bÃ¡o cháº¡y ngáº§m
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

        // XÃ³a cÃ¡c query params Ä‘á»ƒ trÃ¡nh viá»‡c kÃ­ch hoáº¡t láº¡i khi refresh trang
        window.history.replaceState({}, document.title, window.location.pathname);

        if (autoDecline) {
            // Gá»­i tá»« chá»‘i cuá»™c gá»i láº­p tá»©c
            if (socket) socket.emit("reject_call", { callerId, callType });
            return;
        }

        // Báº­t giao diá»‡n cuá»™c gá»i full mÃ n hÃ¬nh
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

            // PhÃ¡t rung & nháº¡c chuÃ´ng
            startVibration();
            playRingtone();

            // GÃ¡n láº¡i cÃ¡c sá»± kiá»‡n click cho cÃ¡c nÃºt Accept/Reject
            document.getElementById("accept-call-btn").onclick = async () => {
                stopVibration();
                stopRingtone();
                // Má»Ÿ khÃ³a autoplay trÃ¬nh duyá»‡t báº±ng AudioContext (iOS Safari cáº§n user gesture)
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
                } catch (e) { console.warn("KhÃ´ng thá»ƒ má»Ÿ khÃ³a AudioContext:", e); }
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

            // Náº¿u ngÆ°á»i dÃ¹ng Ä‘Ã£ báº¥m nÃºt Tráº£ lá»i tá»« Notification banner
            if (autoAccept) {
                document.getElementById("accept-call-btn").click();
            }
        }
    }
}

// 6. Káº¿t thÃºc cuá»™c gá»i
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
// KÃCH HOáº T CÃC NÃšT ÄIá»€U KHIá»‚N CUá»˜C Gá»ŒI
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
            alert("Báº­t káº¿t ná»‘i Micro!");
        }
    });
}

const camBtn = document.getElementById("toggle-cam-btn");
if (camBtn) {
    camBtn.addEventListener("click", function () {
        if (!localStream) {
            return alert("Cuá»™c gá»i chÆ°a Ä‘Æ°á»£c káº¿t ná»‘i!");
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
// TÃNH NÄ‚NG TÃ™Y CHá»ŒN 3 CHáº¤M (BOTTOM SHEET)
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
                console.error("Lá»—i khÃ´ng há»— trá»£ Ä‘á»•i tiáº¿ng á»“n trá»±c tiáº¿p:", e);
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
        if (btnText) btnText.innerText = "Äang chia sáº»...";
        const btnIcon = document.querySelector("#btn-share-screen .sheet-icon");
        if (btnIcon) btnIcon.style.color = "#05a060";

        toggleCallOptionsMenu();
    } catch (e) {
        console.error("Lá»—i chia sáº» mÃ n hÃ¬nh:", e);
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
    if (textEl) textEl.innerText = "Chia sáº» mÃ n hÃ¬nh cá»§a báº¡n";
    const iconEl = document.querySelector("#btn-share-screen .sheet-icon");
    if (iconEl) iconEl.style.color = "";
}

// =========================================
// TÃNH NÄ‚NG THÃ”NG BÃO & TOAST
// =========================================

async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/users/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`KhÃ´ng thá»ƒ táº£i thÃ´ng bÃ¡o (HTTP ${res.status}): ${errorText.substring(0, 100) || "Lá»—i mÃ¡y chá»§"}`);
        }
        const data = await res.json();
        if (data.success) {
            notificationsList = data.data;
            updateNotificationBadge();
            renderNotifications();
        }
    } catch (e) {
        console.error("Lá»—i táº£i thÃ´ng bÃ¡o:", e);
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
        listEl.innerHTML = `<p style="color: var(--text-light); text-align: center; margin-top: 20px;">ChÆ°a cÃ³ thÃ´ng bÃ¡o nÃ o.</p>`;
        return;
    }

    listEl.innerHTML = "";

    // Grouping by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
        today: { name: "HÃ´m nay", items: [] },
        yesterday: { name: "HÃ´m qua", items: [] },
        older: { name: "CÅ© hÆ¡n", items: [] }
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
            } else if (notif.content && (notif.content.includes("káº¿t báº¡n") || notif.content.includes("lá»i má»i") || notif.content.includes("cháº¥p nháº­n"))) {
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
// CHá»NG ZOOM VÃ€ DOUBLE-TAP TRÃŠN MOBILE
// ==========================================

// Chá»‘ng pinch-to-zoom (phÃ³ng to/thu nhá» báº±ng nhiá»u ngÃ³n tay) trÃªn Android/iOS
document.addEventListener(
    "touchmove",
    function (e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    },
    { passive: false }
);

// Chá»‘ng zoom cá»­ chá»‰ trÃªn iOS Safari
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

// Chá»‘ng zoom báº±ng con lÄƒn chuá»™t
document.addEventListener(
    "wheel",
    function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false },
);

// =========================================
// Há»– TRá»¢ TÃNH NÄ‚NG TRáº¢ Lá»œI TIN NHáº®N (REPLY)
// =========================================

// Thiáº¿t láº­p cháº¿ Ä‘á»™ tráº£ lá»i tin nháº¯n
function setReplyMode(msgId) {
    const msg = currentChatMessages.find(m => m.id === msgId);
    if (!msg) return;

    replyingToMessage = msg;

    // TÃ¬m tÃªn ngÆ°á»i gá»­i
    let senderName = "NgÆ°á»i dÃ¹ng";
    if (msg.senderId === myId) {
        senderName = "chÃ­nh mÃ¬nh";
    } else if (msg.Users) {
        senderName = msg.Users.fullName;
    } else {
        const headerName = document.getElementById("chat-header-name");
        if (headerName) senderName = headerName.innerText;
    }

    // Thiáº¿t láº­p ná»™i dung trÃ­ch dáº«n
    let textPreview = msg.content;
    if (msg.isRecalled) {
        textPreview = "Tin nháº¯n Ä‘Ã£ bá»‹ thu há»“i";
    } else if (msg.type === "file") {
        try {
            const fileData = JSON.parse(msg.content);
            textPreview = `[Tá»‡p tin: ${fileData.fileName}]`;
        } catch (e) {
            textPreview = "[Tá»‡p tin]";
        }
    } else if (msg.type === "audio") {
        textPreview = "[Tin nháº¯n thoáº¡i]";
    } else if (msg.content && (msg.content.startsWith("data:image/") || msg.content.match(/\.(jpeg|jpg|gif|png)$/i))) {
        textPreview = "[HÃ¬nh áº£nh]";
    } else if (msg.type === "missed_call") {
        textPreview = "[Cuá»™c gá»i nhá»¡]";
    }

    // Hiá»ƒn thá»‹ thanh preview
    const previewContainer = document.getElementById("reply-preview-container");
    const previewSender = document.getElementById("reply-preview-sender");
    const previewText = document.getElementById("reply-preview-text");

    if (previewContainer && previewSender && previewText) {
        previewSender.innerText = senderName;
        previewText.innerText = textPreview;
        previewContainer.style.display = "flex";

        // Cuá»™n xuá»‘ng Ä‘á»ƒ khÃ´ng bá»‹ che khuáº¥t Ã´ nháº­p
        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Focus vÃ o input Ä‘á»ƒ gÃµ luÃ´n
    const input = document.getElementById("message-input");
    if (input) input.focus();
}

// Báº¯t Ä‘áº§u cháº¿ Ä‘á»™ chá»‰nh sá»­a tin nháº¯n
function startEditMode(msgId, currentContent) {
    replyingToMessage = null;

    const msg = currentChatMessages.find(m => m.id === msgId);
    if (!msg) return;

    editingMessage = msg;

    const input = document.getElementById("message-input");
    if (input) {
        input.value = currentContent;
        input.focus();
        // KÃ­ch hoáº¡t sá»± kiá»‡n input Ä‘á»ƒ tá»± Ä‘á»™ng hiá»‡n nÃºt Gá»­i (thay vÃ¬ nÃºt Like) vÃ  tá»± Ä‘á»™ng cÄƒn chá»‰nh chiá»u cao Ã´ nháº­p tin nháº¯n
        input.dispatchEvent(new Event("input"));
    }

    const previewContainer = document.getElementById("reply-preview-container");
    const previewSender = document.getElementById("reply-preview-sender");
    const previewText = document.getElementById("reply-preview-text");

    if (previewContainer && previewSender && previewText) {
        previewSender.innerHTML = '<i class="fas fa-edit" style="color: var(--primary-color); margin-right: 6px;"></i>Äang sá»­a tin nháº¯n';
        previewText.innerText = currentContent;
        previewContainer.style.display = "flex";

        const messagesDiv = document.getElementById("messages");
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

// Gá»i API gá»­i ná»™i dung tin nháº¯n Ä‘Ã£ sá»­a lÃªn server
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
            alert("Lá»—i khi chá»‰nh sá»­a tin nháº¯n: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i khi chá»‰nh sá»­a tin nháº¯n: " + error.message);
    }
}

// Há»§y cháº¿ Ä‘á»™ tráº£ lá»i / chá»‰nh sá»­a tin nháº¯n
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

// Cuá»™n Ä‘áº¿n tin nháº¯n gá»‘c vÃ  nhÃ¡y sÃ¡ng highlight
function scrollToAndHighlightMessage(msgId) {
    const targetEl = document.getElementById(`msg-${msgId}`);
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

        // ThÃªm class highlight
        targetEl.classList.remove("message-highlight");
        // Force reflow
        void targetEl.offsetWidth;
        targetEl.classList.add("message-highlight");

        // XÃ³a class highlight sau khi cháº¡y xong animation
        setTimeout(() => {
            targetEl.classList.remove("message-highlight");
        }, 1500);
    } else {
        alert("Tin nháº¯n gá»‘c Ä‘Ã£ quÃ¡ cÅ© hoáº·c khÃ´ng tÃ¬m tháº¥y trong giao diá»‡n hiá»‡n táº¡i.");
    }
}

// Sao chÃ©p vÄƒn báº£n tin nháº¯n vÃ o Clipboard
function copyMessageText(content) {
    if (!content) return;

    // Kiá»ƒm tra náº¿u lÃ  hÃ¬nh áº£nh (base64 hoáº·c Ä‘Æ°á»ng dáº«n hÃ¬nh áº£nh)
    if (content.startsWith("data:image/") || content.match(/\.(jpeg|jpg|gif|png)$/i)) {
        showTempToast("KhÃ´ng thá»ƒ sao chÃ©p hÃ¬nh áº£nh dÆ°á»›i dáº¡ng vÄƒn báº£n.");
        return;
    }

    navigator.clipboard.writeText(content)
        .then(() => {
            showTempToast("ÄÃ£ sao chÃ©p tin nháº¯n.");
        })
        .catch((err) => {
            console.error("Lá»—i sao chÃ©p:", err);
            // Fallback cho mÃ´i trÆ°á»ng khÃ´ng cÃ³ HTTPS hoáº·c thiáº¿t bá»‹ cÅ©
            const textarea = document.createElement("textarea");
            textarea.value = content;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand("copy");
                showTempToast("ÄÃ£ sao chÃ©p tin nháº¯n.");
            } catch (e) {
                showTempToast("KhÃ´ng thá»ƒ sao chÃ©p tin nháº¯n.");
            }
            document.body.removeChild(textarea);
        });
}

// Hiá»ƒn thá»‹ Toast thÃ´ng bÃ¡o nhanh (dÃ nh riÃªng cho sao chÃ©p)
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

// Gá»­i tin nháº¯n chá»©a tá»‡p tin hoáº·c tin nháº¯n thoáº¡i
function sendFileOrAudioMessage(content, type) {
    if (!currentConversationId) {
        return alert("Báº¡n chÆ°a chá»n cuá»™c há»™i thoáº¡i!");
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
                    // Cáº­p nháº­t sidebar nháº¹ hÆ¡n, khÃ´ng reload toÃ n bá»™ danh sÃ¡ch
                    updateChatListUI(data.data, true);
                } else {
                    alert("Gá»­i tháº¥t báº¡i: " + data.message);
                }
            });
    } catch (err) {
        alert("Lá»—i máº¡ng: " + err.message);
    }
}

// Báº­t/táº¯t tráº¡ng thÃ¡i ghi Ã¢m tin nháº¯n thoáº¡i
function toggleVoiceRecording() {
    const recordBtn = document.getElementById("voice-record-btn");
    const input = document.getElementById("message-input");

    if (!recordBtn || !input) return;

    if (!isRecording) {
        // Báº¯t Ä‘áº§u ghi Ã¢m
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return alert("TrÃ¬nh duyá»‡t cá»§a báº¡n khÃ´ng há»— trá»£ ghi Ã¢m.");
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                isRecording = true;
                audioChunks = [];

                recordBtn.classList.remove("fa-microphone");
                recordBtn.classList.add("fa-stop", "recording");

                input.placeholder = "Äang ghi Ã¢m... Nháº¥p nÃºt Stop Ä‘á»ƒ gá»­i.";
                input.disabled = true;

                // Khá»Ÿi táº¡o MediaRecorder
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

                    // Táº¯t táº¥t cáº£ cÃ¡c track trong stream Ä‘á»ƒ giáº£i phÃ³ng mic
                    stream.getTracks().forEach((track) => track.stop());
                };

                mediaRecorder.start();
            })
            .catch((err) => {
                console.error("Lá»—i truy cáº­p Micro:", err);
                alert("KhÃ´ng thá»ƒ truy cáº­p Micro. Vui lÃ²ng cáº¥p quyá»n ghi Ã¢m.");
            });
    } else {
        // Dá»«ng ghi Ã¢m vÃ  gá»­i
        isRecording = false;

        recordBtn.classList.remove("fa-stop", "recording");
        recordBtn.classList.add("fa-microphone");

        input.placeholder = "Nháº­p tin nháº¯n...";
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
    customAlert("ThÃ´ng bÃ¡o", message);
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

function customConfirm(title, message, okText = "XÃ¡c nháº­n", cancelText = "Há»§y", isDanger = true) {
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

function customPrompt(title, message, defaultValue = "", placeholder = "Nháº­p vÃ o Ä‘Ã¢y...") {
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
// MOBILE HAPTIC FEEDBACK FOR PWA (RUNG PHáº¢N Há»’I KHI CHáº M NÃšT)
// ==========================================================================

/**
 * Táº¡o Ä‘á»™ rung nháº¹ pháº£n há»“i (haptic feedback) trÃªn cÃ¡c thiáº¿t bá»‹ di Ä‘á»™ng há»— trá»£
 * @param {number|number[]} pattern - Thá»i gian rung tÃ­nh báº±ng mili-giÃ¢y (vÃ­ dá»¥: 15ms) hoáº·c máº£ng nhá»‹p rung
 */
function triggerHapticFeedback(pattern = 30) {
    if (callVibrationActive) return; // KHÃ”NG ÄÆ¯á»¢C RUNG PHáº¢N Há»’I KHI ÄANG CÃ“ CUá»˜C Gá»ŒI Äáº¾N (trÃ¡nh ghi Ä‘Ã¨ rung cuá»™c gá»i)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn("TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ hoáº·c cháº·n cuá»™c gá»i rung:", e);
        }
    }
}

// Tá»± Ä‘á»™ng gÃ¡n pháº£n há»“i xÃºc giÃ¡c nháº¹ khi click/tap cÃ¡c pháº§n tá»­ tÆ°Æ¡ng tÃ¡c (button, link, tab...)
document.addEventListener("click", (e) => {
    const interactiveElement = e.target.closest(
        "button, .btn, .icon-btn, .nav-item, [role='button'], .sidebar-actions i, #send-btn, .chat-list-container li, .friend-action-btn"
    );
    if (interactiveElement) {
        triggerHapticFeedback(15); // Rung cá»±c nháº¹ 15ms táº¡o cáº£m giÃ¡c nhÆ° nháº¥n nÃºt tháº­t
    }
});

// HÃ m xin quyá»n thÃ´ng bÃ¡o vÃ  láº¥y FCM Token
async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("TrÃ¬nh duyá»‡t nÃ y khÃ´ng há»— trá»£ hiá»ƒn thá»‹ thÃ´ng bÃ¡o.");
        updateNotificationPermissionUI();
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            console.log("Quyá»n thÃ´ng bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c cháº¥p thuáº­n.");
            if (token) {
                setupFirebaseMessaging(token);
            }
        } else {
            console.warn("NgÆ°á»i dÃ¹ng tá»« chá»‘i cáº¥p quyá»n thÃ´ng bÃ¡o.");
        }
        updateNotificationPermissionUI();
    } catch (error) {
        console.error("Lá»—i trong quÃ¡ trÃ¬nh xin quyá»n hoáº·c láº¥y FCM Token:", error);
        updateNotificationPermissionUI();
    }
}

// Cáº­p nháº­t tráº¡ng thÃ¡i giao diá»‡n nÃºt xin quyá»n thÃ´ng bÃ¡o
function updateNotificationPermissionUI() {
    const btn = document.getElementById("notification-permission-btn");
    if (!btn) return;

    if (!("Notification" in window)) {
        btn.innerText = "KhÃ´ng há»— trá»£";
        btn.disabled = true;
        btn.style.background = "var(--border-color)";
        btn.style.color = "var(--text-light)";
        btn.style.border = "none";
        return;
    }

    if (Notification.permission === "granted") {
        btn.innerHTML = `<i class="fas fa-check"></i> ÄÃ£ báº­t`;
        btn.disabled = true;
        btn.style.background = "rgba(16, 185, 129, 0.1)";
        btn.style.color = "#10b981";
        btn.style.border = "1px solid #10b981";
        btn.style.cursor = "default";
        btn.style.transform = "none";
    } else if (Notification.permission === "denied") {
        btn.innerText = "Bá»‹ tá»« chá»‘i";
        btn.disabled = true;
        btn.style.background = "rgba(239, 68, 68, 0.1)";
        btn.style.color = "#ef4444";
        btn.style.border = "1px solid #ef4444";
        btn.style.cursor = "default";
        btn.style.transform = "none";
    } else {
        btn.innerText = "Báº­t";
        btn.disabled = false;
        btn.style.background = "var(--primary-color)";
        btn.style.color = "white";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
    }
}

// Helper hiá»ƒn thá»‹ popup tÃ¬m kiáº¿m káº¿t báº¡n trÃªn giao diá»‡n Mobile
function searchUserMobilePrompt() {
    customPrompt("TÃ¬m kiáº¿m ngÆ°á»i dÃ¹ng", "Nháº­p tÃªn ngÆ°á»i dÃ¹ng (Username/FullName) báº¡n muá»‘n tÃ¬m kiáº¿m Ä‘á»ƒ káº¿t báº¡n:")
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

// Cáº­p nháº­t danh sÃ¡ch thiáº¿t bá»‹ Ã¢m thanh/hÃ¬nh áº£nh kháº£ dá»¥ng
async function updateMediaDevicesList() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

        // Xin quyá»n trÆ°á»›c Ä‘á»ƒ láº¥y Ä‘Æ°á»£c Ä‘áº§y Ä‘á»§ tÃªn thiáº¿t bá»‹ thay vÃ¬ nhÃ£n rá»—ng
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callTypeGlobal === "video" });
            tempStream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.warn("Xin quyá»n thiáº¿t bá»‹ táº¡m thá»i Ä‘á»ƒ liá»‡t kÃª nhÃ£n tháº¥t báº¡i:", e);
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const micSelect = document.getElementById("setting-mic-select");
        const camSelect = document.getElementById("setting-cam-select");

        if (micSelect) {
            // LÆ°u láº¡i thiáº¿t bá»‹ Ä‘Ã£ chá»n trÆ°á»›c Ä‘Ã³ (náº¿u cÃ³)
            const prevSelected = micSelect.value;
            micSelect.innerHTML = '<option value="">Thiáº¿t bá»‹ máº·c Ä‘á»‹nh (Default)</option>';

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
            camSelect.innerHTML = '<option value="">Thiáº¿t bá»‹ máº·c Ä‘á»‹nh (Default)</option>';

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
        console.error("Lá»—i khi táº£i danh sÃ¡ch thiáº¿t bá»‹ pháº§n cá»©ng:", err);
    }
}

/**
 * AI SCROLL FIX v3
 * ThÃªm vÃ o app.js hoáº·c paste vÃ o cuá»‘i <script> trong HTML
 * DÃ¹ng JS Ä‘á»ƒ Ä‘áº£m báº£o scroll dá»c luÃ´n hoáº¡t Ä‘á»™ng trong tab AI
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

        // Khi báº¯t Ä‘áº§u cháº¡m
        history.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startScrollTop = history.scrollTop;
            isScrollingY = false;
            isScrollingChecked = false;
        }, { passive: true });

        // Khi di chuyá»ƒn ngÃ³n tay - forward scroll lÃªn container náº¿u cáº§n
        history.addEventListener('touchmove', function (e) {
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = startX - currentX;
            const deltaY = startY - currentY; // dÆ°Æ¡ng = kÃ©o lÃªn (scroll xuá»‘ng)

            const target = e.target;
            const isInCodeBlock = target.closest('.ai-code-block') || target.closest('pre');

            if (isInCodeBlock) {
                if (!isScrollingChecked) {
                    // Náº¿u vuá»‘t dá»c nhiá»u hÆ¡n vuá»‘t ngang, kÃ­ch hoáº¡t cuá»™n dá»c
                    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
                        isScrollingY = true;
                    }
                    isScrollingChecked = true;
                }

                if (isScrollingY) {
                    // Chá»‰ cuá»™n dá»c container AI náº¿u di chuyá»ƒn ngÃ³n tay theo chiá»u dá»c
                    history.scrollTop = startScrollTop + deltaY;
                }
            }
        }, { passive: true });

        // Theo dÃµi khi tab AI Ä‘Æ°á»£c má»Ÿ, khá»Ÿi Ä‘á»™ng láº¡i fix
        const observer = new MutationObserver(function () {
            const aiTab = document.getElementById('tab-ai');
            if (aiTab && aiTab.classList.contains('active')) {
                // Re-attach náº¿u cáº§n
            }
        });

        const tabAi = document.getElementById('tab-ai');
        if (tabAi) {
            observer.observe(tabAi, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // Cháº¡y khi DOM sáºµn sÃ ng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAiScrollFix);
    } else {
        initAiScrollFix();
    }
})();

//thooooooooooooo
/* Paste vÃ o cuá»‘i app.js */
(function () {
    const MIN_LINES = 8;

    function initWrapper(wrapper) {
        if (wrapper.dataset.init) return;
        wrapper.dataset.init = '1';

        const pre = wrapper.querySelector('pre');
        if (!pre) return;

        const lines = (pre.textContent.match(/\n/g) || []).length + 1;
        if (lines < MIN_LINES) {
            // Code ngáº¯n: khÃ´ng thu gá»n, chá»‰ Ä‘á»ƒ má»Ÿ rá»™ng hoÃ n toÃ n
            wrapper.classList.add('expanded');
            return;
        }

        wrapper.classList.add('collapsed');

        // ThÃªm nÃºt toggle vÃ o header
        const header = wrapper.querySelector('.ai-code-header');
        if (header) {
            const left = document.createElement('div');
            left.className = 'ai-code-header-left';
            const lang = header.querySelector('.ai-code-header-lang');
            const copy = header.querySelector('.ai-code-copy-btn');
            if (lang) left.appendChild(lang);

            const btn = document.createElement('button');
            btn.className = 'ai-code-toggle-btn';
            btn.innerHTML = '<span class="toggle-icon">â–¼</span>&nbsp;<span class="toggle-label">Xem thÃªm</span>';
            btn.onclick = function (e) { e.stopPropagation(); toggle(wrapper); };
            left.appendChild(btn);

            header.innerHTML = '';
            header.appendChild(left);
            if (copy) header.appendChild(copy);
            header.onclick = function (e) {
                if (!e.target.closest('.ai-code-copy-btn')) toggle(wrapper);
            };
        }

        // NÃºt á»Ÿ dÆ°á»›i
        const expandBtn = document.createElement('button');
        expandBtn.className = 'ai-code-expand-btn';
        expandBtn.textContent = 'â–¼  Xem thÃªm  (' + lines + ' dÃ²ng)';
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
            if (label) label.textContent = 'Thu gá»n';
            if (expandBtn) expandBtn.textContent = 'â–²  Thu gá»n';
        } else {
            wrapper.classList.replace('expanded', 'collapsed');
            if (label) label.textContent = 'Xem thÃªm';
            if (expandBtn) expandBtn.textContent = 'â–¼  Xem thÃªm  (' + lines + ' dÃ²ng)';
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

// Cáº­p nháº­t thanh háº¡n ngáº¡ch sá»­ dá»¥ng AI (Token progress bar)
function updateAiQuotaBar(forceMax = false) {
    const fillEl = document.getElementById("ai-quota-bar-fill");
    const percentageEl = document.getElementById("ai-quota-bar-percentage");
    if (!fillEl || !percentageEl) return;

    const limit = 20; // Giá»›i háº¡n sá»‘ lÆ°á»£t gá»i miá»…n phÃ­ trong ngÃ y (Google AI Studio free tier)
    const todayStr = new Date().toISOString().split('T')[0]; // Äá»‹nh dáº¡ng YYYY-MM-DD
    const countKey = `ai_request_count_${todayStr}`;

    let count = parseInt(localStorage.getItem(countKey) || "0", 10);

    if (forceMax) {
        count = limit;
        localStorage.setItem(countKey, String(limit));
    }

    const percentage = Math.min(Math.round((count / limit) * 100), 100);

    // Cáº­p nháº­t UI
    fillEl.style.width = `${percentage}%`;
    percentageEl.innerText = `${percentage}%`;

    // Cáº­p nháº­t mÃ u sáº¯c cáº£nh bÃ¡o
    fillEl.classList.remove("warning", "danger");
    if (percentage >= 100) {
        fillEl.classList.add("danger");
        percentageEl.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Háº¿t Token (100%)</span>`;
    } else if (percentage >= 70) {
        fillEl.classList.add("warning");
    }

    // Khá»Ÿi Ä‘á»™ng Ä‘á»“ng há»“ Ä‘áº¿m ngÆ°á»£c Ä‘áº¿n giá» reset
    startAiQuotaCountdown();
}

// TÄƒng sá»‘ lÆ°á»£t gá»i AI thÃ nh cÃ´ng khi hoÃ n thÃ nh stream
function incrementAiRequestCount() {
    const todayStr = new Date().toISOString().split('T')[0];
    const countKey = `ai_request_count_${todayStr}`;
    let count = parseInt(localStorage.getItem(countKey) || "0", 10);
    localStorage.setItem(countKey, String(count + 1));
    updateAiQuotaBar();
}

// Láº¥y má»‘c thá»i gian 7:00 AM tiáº¿p theo (Giá» reset cá»§a Google AI Studio)
function getNextResetTime() {
    const now = new Date();
    const resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0); // 7:00 AM hÃ´m nay
    if (now >= resetTime) {
        resetTime.setDate(resetTime.getDate() + 1); // 7:00 AM ngÃ y mai
    }
    return resetTime;
}

// Quáº£n lÃ½ interval vÃ  cáº­p nháº­t Ä‘á»“ng há»“ Ä‘áº¿m ngÆ°á»£c
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
        countdownEl.innerText = `Tá»± Ä‘á»™ng reset sau: ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }

    updateCountdown();
    aiQuotaTimerInterval = setInterval(updateCountdown, 1000);
}

// --- XOÃ CUá»˜C TRÃ’ CHUYá»†N (GIAO DIá»†N & API) ---
function toggleConversationMenu(event, conversationId) {
    event.stopPropagation();
    const menuId = `conv-menu-${conversationId}`;
    const menu = document.getElementById(menuId);
    if (!menu) return;

    // ÄÃ³ng toÃ n bá»™ dropdown khÃ¡c
    document.querySelectorAll(".conv-dropdown-menu").forEach((m) => {
        if (m.id !== menuId) m.style.display = "none";
    });

    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

async function confirmDeleteConversation(event, conversationId) {
    event.stopPropagation();
    const menu = document.getElementById(`conv-menu-${conversationId}`);
    if (menu) menu.style.display = "none";

    const isConfirmed = confirm("Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a vÄ©nh viá»…n toÃ n bá»™ cuá»™c trÃ² chuyá»‡n nÃ y khÃ´ng? Táº¥t cáº£ tin nháº¯n sáº½ bá»‹ xÃ³a sáº¡ch.");
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
            alert("ÄÃ£ xÃ³a cuá»™c trÃ² chuyá»‡n thÃ nh cÃ´ng.");
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
            alert("Lá»—i: " + data.message);
        }
    } catch (error) {
        alert("Lá»—i káº¿t ná»‘i server: " + error.message);
    }
}

// ÄÃ³ng dropdown khi click ra ngoÃ i mÃ n hÃ¬nh
document.addEventListener("click", () => {
    document.querySelectorAll(".conv-dropdown-menu").forEach((m) => {
        m.style.display = "none";
    });
});

// --- CHá»¨C NÄ‚NG THAY Äá»”I CHá»¦ Äá»€ CHAT (CHAT THEMES) ---
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

    console.log("ðŸŽ¨ ÄÃ£ Ã¡p dá»¥ng chá»§ Ä‘á» chat thÃ nh cÃ´ng:", currentChatTheme, "Ná»n:", colors.bg);
}

// --- PANEL THÃ”NG TIN CUá»˜C TRÃ’ CHUYá»†N (CHAT INFO) ---
function openChatInfoPanel() {
    if (!currentConversationId) return;

    // Láº¥y thÃ´ng tin tá»« header chat hiá»‡n táº¡i
    const avatarEl = document.getElementById("current-chat-avatar");
    const nameEl = document.getElementById("chat-header-name");

    const infoAvatar = document.getElementById("chat-info-avatar-img");
    const infoName = document.getElementById("chat-info-name");

    if (avatarEl && infoAvatar) {
        infoAvatar.src = avatarEl.src || "";
    }
    if (nameEl && infoName) {
        infoName.textContent = nameEl.textContent || "NgÆ°á»i dÃ¹ng";
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
    if (!currentConversationId) return alert("Vui lÃ²ng má»Ÿ má»™t cuá»™c trÃ² chuyá»‡n Ä‘á»ƒ Ä‘á»•i chá»§ Ä‘á»!");

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
    }, 250); // Äá»“ng bá»™ vá»›i thá»i gian transition CSS
}

async function selectChatTheme(themeName) {
    if (!currentConversationId) return;

    // âœ¨ Cáº­p nháº­t giao diá»‡n vÃ  Ä‘Ã³ng Modal ngay láº­p tá»©c (Optimistic UI) Ä‘á»ƒ táº¡o hiá»‡u á»©ng mÆ°á»£t mÃ  khÃ´ng Ä‘á»™ trá»…
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
            console.error("Lá»—i Ä‘á»“ng bá»™ chá»§ Ä‘á» vá»›i server:", data.message);
        }
    } catch (error) {
        console.error("Lá»—i káº¿t ná»‘i máº¡ng khi Ä‘á»•i chá»§ Ä‘á»:", error);
    }
}

// --- QUáº¢N LÃ BIá»†T DANH (NICKNAMES) ---
function updateUINames() {
    if (!currentConversationId) return;

    const partnerNickname = currentNicknames[currentChatPartnerId];
    const partnerRealName = document.getElementById("chat-header-name")?.dataset.realName || "NgÆ°á»i dÃ¹ng";

    // 1. Cáº­p nháº­t tÃªn trong header chat
    const headerNameEl = document.getElementById("chat-header-name");
    if (headerNameEl) {
        headerNameEl.innerText = partnerNickname || partnerRealName;
    }

    // 2. Cáº­p nháº­t tÃªn hiá»ƒn thá»‹ trong cÃ¡c dÃ²ng tin nháº¯n
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

    // 3. Cáº­p nháº­t thÃ´ng tin trong Chat Info Panel
    const chatInfoNameEl = document.getElementById("chat-info-name");
    if (chatInfoNameEl) {
        chatInfoNameEl.innerText = partnerNickname || chatInfoNameEl.dataset.realName || "NgÆ°á»i dÃ¹ng";
    }
}

function openNicknameModal() {
    if (!currentConversationId) return;

    const partnerRealName = document.getElementById("chat-header-name")?.dataset.realName || "Äá»‘i phÆ°Æ¡ng";
    const partnerLabel = document.getElementById("nickname-partner-label");
    if (partnerLabel) {
        partnerLabel.innerText = `Biá»‡t danh cá»§a ${partnerRealName}:`;
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
            alert("Lá»—i lÆ°u biá»‡t danh: " + data.message);
        }
    } catch (error) {
        console.error("Lá»—i máº¡ng khi lÆ°u biá»‡t danh:", error);
        alert("Lá»—i máº¡ng khi lÆ°u biá»‡t danh.");
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
            alert("Lá»—i xÃ³a biá»‡t danh: " + data.message);
        }
    } catch (error) {
        console.error("Lá»—i máº¡ng khi xÃ³a biá»‡t danh:", error);
        alert("Lá»—i máº¡ng khi xÃ³a biá»‡t danh.");
    }
}

// Äá»‹nh dáº¡ng thá»i gian hoáº¡t Ä‘á»™ng cuá»‘i cÃ¹ng (Online/Offline status format)
function formatLastActive(timestamp) {
    if (!timestamp) return "KhÃ´ng hoáº¡t Ä‘á»™ng";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;

    if (diffMs < 0) return "Vá»«a hoáº¡t Ä‘á»™ng";

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) {
        return "Vá»«a hoáº¡t Ä‘á»™ng";
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `Hoáº¡t Ä‘á»™ng ${diffMin} phÃºt trÆ°á»›c`;
    }

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
        return `Hoáº¡t Ä‘á»™ng ${diffHour} giá» trÆ°á»›c`;
    }

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) {
        return "Hoáº¡t Ä‘á»™ng 1 ngÃ y trÆ°á»›c";
    }
    return `Hoáº¡t Ä‘á»™ng ${diffDay} ngÃ y trÆ°á»›c`;
}

// Cáº­p nháº­t giao diá»‡n thanh Chat Header Status
function updateHeaderStatusUI(isOnline, lastActive) {
    const dot = document.getElementById("chat-header-status-dot");
    const statusText = document.getElementById("chat-header-status");
    if (!dot || !statusText) return;

    if (isOnline) {
        dot.style.display = "block";
        statusText.innerText = "Äang hoáº¡t Ä‘á»™ng";
        statusText.classList.add("online");
    } else {
        dot.style.display = "none";
        statusText.innerText = formatLastActive(lastActive);
        statusText.classList.remove("online");
    }
}

// Tá»± Ä‘á»™ng quÃ©t vÃ  cáº­p nháº­t hiá»ƒn thá»‹ thá»i gian offline Ä‘á»‹nh ká»³ má»—i 60 giÃ¢y
setInterval(() => {
    // 1. Cáº­p nháº­t dÃ²ng status trÃªn chat header (náº¿u Ä‘ang offline)
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
        name: "Máº·t cÆ°á»i",
        icon: "ðŸ˜€",
        emojis: ["ðŸ˜€", "ðŸ˜ƒ", "ðŸ˜„", "ðŸ˜", "ðŸ˜†", "ðŸ˜…", "ðŸ¤£", "ðŸ˜‚", "ðŸ™‚", "ðŸ™ƒ", "ðŸ˜‰", "ðŸ˜Š", "ðŸ˜‡", "ðŸ¥°", "ðŸ˜", "ðŸ¤©", "ðŸ˜˜", "ðŸ˜—", "ðŸ˜š", "ðŸ˜™", "ðŸ¥²", "ðŸ˜‹", "ðŸ˜›", "ðŸ˜œ", "ðŸ¤ª", "ðŸ˜", "ðŸ¤‘", "ðŸ¤—", "ðŸ¤­", "ðŸ¤«", "ðŸ¤”", "ðŸ«¡", "ðŸ¤", "ðŸ¤¨", "ðŸ˜", "ðŸ˜‘", "ðŸ˜¶", "ðŸ«¥", "ðŸ˜", "ðŸ˜’", "ðŸ™„", "ðŸ˜¬", "ðŸ¤¥", "ðŸ˜Œ", "ðŸ˜”", "ðŸ˜ª", "ðŸ¤¤", "ðŸ˜´", "ðŸ˜·", "ðŸ¤’", "ðŸ¤•", "ðŸ¤¢", "ðŸ¤®", "ðŸ¥µ", "ðŸ¥¶", "ðŸ¥´", "ðŸ˜µ", "ðŸ¤¯", "ðŸ¤ ", "ðŸ¥³", "ðŸ¥¸", "ðŸ˜Ž", "ðŸ¤“", "ðŸ§", "ðŸ˜•", "ðŸ«¤", "ðŸ˜Ÿ", "ðŸ™", "ðŸ˜®", "ðŸ˜¯", "ðŸ˜²", "ðŸ˜³", "ðŸ¥º", "ðŸ¥¹", "ðŸ˜¦", "ðŸ˜§", "ðŸ˜¨", "ðŸ˜°", "ðŸ˜¥", "ðŸ˜¢", "ðŸ˜­", "ðŸ˜±", "ðŸ˜–", "ðŸ˜£", "ðŸ˜ž", "ðŸ˜“", "ðŸ˜©", "ðŸ˜«", "ðŸ¥±", "ðŸ˜¤", "ðŸ˜¡", "ðŸ˜ ", "ðŸ¤¬", "ðŸ˜ˆ", "ðŸ‘¿", "ðŸ’€", "â˜ ï¸", "ðŸ’©", "ðŸ¤¡", "ðŸ‘¹", "ðŸ‘º", "ðŸ‘»", "ðŸ‘½", "ðŸ‘¾", "ðŸ¤–"]
    },
    {
        name: "TrÃ¡i tim",
        icon: "â¤ï¸",
        emojis: ["â¤ï¸", "ðŸ§¡", "ðŸ’›", "ðŸ’š", "ðŸ’™", "ðŸ’œ", "ðŸ–¤", "ðŸ¤", "ðŸ¤Ž", "ðŸ’”", "â£ï¸", "ðŸ’•", "ðŸ’ž", "ðŸ’“", "ðŸ’—", "ðŸ’–", "ðŸ’˜", "ðŸ’", "ðŸ’Ÿ", "â™¥ï¸", "ðŸ«¶", "ðŸ’‘", "ðŸ’", "â¤ï¸â€ðŸ”¥", "â¤ï¸â€ðŸ©¹", "ðŸ©·", "ðŸ©µ", "ðŸ©¶"]
    },
    {
        name: "Tay & Cá»­ chá»‰",
        icon: "ðŸ‘‹",
        emojis: ["ðŸ‘‹", "ðŸ¤š", "ðŸ–ï¸", "âœ‹", "ðŸ––", "ðŸ«±", "ðŸ«²", "ðŸ«³", "ðŸ«´", "ðŸ‘Œ", "ðŸ¤Œ", "ðŸ¤", "âœŒï¸", "ðŸ¤ž", "ðŸ«°", "ðŸ¤Ÿ", "ðŸ¤˜", "ðŸ¤™", "ðŸ‘ˆ", "ðŸ‘‰", "ðŸ‘†", "ðŸ–•", "ðŸ‘‡", "â˜ï¸", "ðŸ«µ", "ðŸ‘", "ðŸ‘Ž", "âœŠ", "ðŸ‘Š", "ðŸ¤›", "ðŸ¤œ", "ðŸ‘", "ðŸ™Œ", "ðŸ«¶", "ðŸ‘", "ðŸ¤²", "ðŸ¤", "ðŸ™", "âœï¸", "ðŸ’…", "ðŸ¤³", "ðŸ’ª", "ðŸ¦¾", "ðŸ¦¿", "ðŸ¦µ", "ðŸ¦¶"]
    },
    {
        name: "Con ngÆ°á»i",
        icon: "ðŸ‘¤",
        emojis: ["ðŸ‘¶", "ðŸ‘§", "ðŸ§’", "ðŸ‘¦", "ðŸ‘©", "ðŸ§‘", "ðŸ‘¨", "ðŸ‘©â€ðŸ¦±", "ðŸ§‘â€ðŸ¦±", "ðŸ‘¨â€ðŸ¦±", "ðŸ‘©â€ðŸ¦°", "ðŸ§‘â€ðŸ¦°", "ðŸ‘¨â€ðŸ¦°", "ðŸ‘±â€â™€ï¸", "ðŸ‘±", "ðŸ‘±â€â™‚ï¸", "ðŸ‘©â€ðŸ¦³", "ðŸ§‘â€ðŸ¦³", "ðŸ‘¨â€ðŸ¦³", "ðŸ‘©â€ðŸ¦²", "ðŸ§‘â€ðŸ¦²", "ðŸ‘¨â€ðŸ¦²", "ðŸ§”â€â™€ï¸", "ðŸ§”", "ðŸ§”â€â™‚ï¸", "ðŸ‘µ", "ðŸ§“", "ðŸ‘´", "ðŸ‘²", "ðŸ‘³â€â™€ï¸", "ðŸ‘³", "ðŸ‘³â€â™‚ï¸", "ðŸ§•", "ðŸ‘®â€â™€ï¸", "ðŸ‘®", "ðŸ‘®â€â™‚ï¸", "ðŸ’‚â€â™€ï¸", "ðŸ’‚", "ðŸ’‚â€â™‚ï¸", "ðŸ¥·", "ðŸ‘·â€â™€ï¸", "ðŸ‘·", "ðŸ‘·â€â™‚ï¸", "ðŸ«…", "ðŸ¤´", "ðŸ‘¸", "ðŸ‘°â€â™€ï¸", "ðŸ‘°", "ðŸ‘°â€â™‚ï¸", "ðŸ¤µâ€â™€ï¸", "ðŸ¤µ", "ðŸ¤µâ€â™‚ï¸"]
    },
    {
        name: "Äá»™ng váº­t",
        icon: "ðŸ¶",
        emojis: ["ðŸ¶", "ðŸ±", "ðŸ­", "ðŸ¹", "ðŸ°", "ðŸ¦Š", "ðŸ»", "ðŸ¼", "ðŸ»â€â„ï¸", "ðŸ¨", "ðŸ¯", "ðŸ¦", "ðŸ®", "ðŸ·", "ðŸ¸", "ðŸµ", "ðŸ™ˆ", "ðŸ™‰", "ðŸ™Š", "ðŸ’", "ðŸ”", "ðŸ§", "ðŸ¦", "ðŸ¤", "ðŸ£", "ðŸ¥", "ðŸ¦†", "ðŸ¦…", "ðŸ¦‰", "ðŸ¦‡", "ðŸº", "ðŸ—", "ðŸ´", "ðŸ¦„", "ðŸ", "ðŸª±", "ðŸ›", "ðŸ¦‹", "ðŸŒ", "ðŸž", "ðŸœ", "ðŸª°", "ðŸª²", "ðŸª³", "ðŸ¦Ÿ", "ðŸ¦—", "ðŸ•·ï¸", "ðŸ•¸ï¸", "ðŸ¦‚", "ðŸ¢", "ðŸ", "ðŸ¦Ž", "ðŸ¦–", "ðŸ¦•", "ðŸ™", "ðŸ¦‘", "ðŸ¦", "ðŸ¦ž", "ðŸ¦€", "ðŸ¡", "ðŸ ", "ðŸŸ", "ðŸ¬", "ðŸ³", "ðŸ‹", "ðŸ¦ˆ", "ðŸª¸", "ðŸŠ", "ðŸ…", "ðŸ†", "ðŸ¦“", "ðŸ¦", "ðŸ¦§", "ðŸ˜", "ðŸ¦›", "ðŸ¦", "ðŸª", "ðŸ«", "ðŸ¦’", "ðŸ¦˜", "ðŸ¦¬", "ðŸƒ", "ðŸ‚", "ðŸ„", "ðŸŽ", "ðŸ–", "ðŸ", "ðŸ‘", "ðŸ¦™", "ðŸ", "ðŸ¦Œ", "ðŸ•", "ðŸ©", "ðŸ¦®"]
    },
    {
        name: "Äá»“ Äƒn",
        icon: "ðŸ”",
        emojis: ["ðŸ", "ðŸŽ", "ðŸ", "ðŸŠ", "ðŸ‹", "ðŸŒ", "ðŸ‰", "ðŸ‡", "ðŸ“", "ðŸ«", "ðŸˆ", "ðŸ’", "ðŸ‘", "ðŸ¥­", "ðŸ", "ðŸ¥¥", "ðŸ¥", "ðŸ…", "ðŸ†", "ðŸ¥‘", "ðŸ«›", "ðŸ¥¦", "ðŸ¥¬", "ðŸ¥’", "ðŸŒ¶ï¸", "ðŸ«‘", "ðŸŒ½", "ðŸ¥•", "ðŸ«’", "ðŸ§„", "ðŸ§…", "ðŸ«š", "ðŸ¥”", "ðŸ ", "ðŸ«˜", "ðŸ¥", "ðŸ¥¯", "ðŸž", "ðŸ¥–", "ðŸ¥¨", "ðŸ§€", "ðŸ¥š", "ðŸ³", "ðŸ§ˆ", "ðŸ¥ž", "ðŸ§‡", "ðŸ¥“", "ðŸ¥©", "ðŸ—", "ðŸ–", "ðŸŒ­", "ðŸ”", "ðŸŸ", "ðŸ•", "ðŸ«“", "ðŸ¥ª", "ðŸ¥™", "ðŸ§†", "ðŸŒ®", "ðŸŒ¯", "ðŸ«”", "ðŸ¥—", "ðŸ¥˜", "ðŸ«•", "ðŸ¥«", "ðŸ", "ðŸœ", "ðŸ²", "ðŸ›", "ðŸ£", "ðŸ±", "ðŸ¥Ÿ", "ðŸ¦ª", "ðŸ¤", "ðŸ™", "ðŸš", "ðŸ˜", "ðŸ¥", "ðŸ¥ ", "ðŸ¥®", "ðŸ¢", "ðŸ¡", "ðŸ§", "ðŸ¨", "ðŸ¦", "ðŸ¥§", "ðŸ§", "ðŸ°", "ðŸŽ‚", "ðŸ®", "ðŸ­", "ðŸ¬", "ðŸ«", "ðŸ¿", "ðŸ©", "ðŸª", "ðŸŒ°", "ðŸ¥œ", "ðŸ¯", "ðŸ¥›", "ðŸ¼", "ðŸ«–", "â˜•", "ðŸµ", "ðŸ§ƒ", "ðŸ¥¤", "ðŸ§‹", "ðŸ«§", "ðŸ¶", "ðŸº", "ðŸ»", "ðŸ¥‚", "ðŸ·", "ðŸ«—", "ðŸ¥ƒ", "ðŸ¸", "ðŸ¹", "ðŸ§‰", "ðŸ¾", "ðŸ§Š"]
    },
    {
        name: "Hoáº¡t Ä‘á»™ng",
        icon: "âš½",
        emojis: ["âš½", "ðŸ€", "ðŸˆ", "âš¾", "ðŸ¥Ž", "ðŸŽ¾", "ðŸ", "ðŸ‰", "ðŸ¥", "ðŸŽ±", "ðŸª€", "ðŸ“", "ðŸ¸", "ðŸ’", "ðŸ‘", "ðŸ¥", "ðŸ", "ðŸªƒ", "ðŸ¥…", "â›³", "ðŸª", "ðŸ¹", "ðŸŽ£", "ðŸ¤¿", "ðŸ¥Š", "ðŸ¥‹", "ðŸŽ½", "ðŸ›¹", "ðŸ›¼", "ðŸ›·", "â›¸ï¸", "ðŸ¥Œ", "ðŸŽ¿", "â›·ï¸", "ðŸ‚", "ðŸª‚", "ðŸ‹ï¸â€â™€ï¸", "ðŸ‹ï¸", "ðŸ‹ï¸â€â™‚ï¸", "ðŸ¤¸â€â™€ï¸", "ðŸ¤¸", "ðŸ¤¸â€â™‚ï¸", "â›¹ï¸â€â™€ï¸", "â›¹ï¸", "â›¹ï¸â€â™‚ï¸", "ðŸ¤º", "ðŸ¤¾â€â™€ï¸", "ðŸ¤¾", "ðŸ¤¾â€â™‚ï¸", "ðŸŒï¸â€â™€ï¸", "ðŸŒï¸", "ðŸŒï¸â€â™‚ï¸", "ðŸ‡", "ðŸ§˜â€â™€ï¸", "ðŸ§˜", "ðŸ§˜â€â™‚ï¸", "ðŸ„â€â™€ï¸", "ðŸ„", "ðŸ„â€â™‚ï¸", "ðŸŠâ€â™€ï¸", "ðŸŠ", "ðŸŠâ€â™‚ï¸", "ðŸŽª", "ðŸŽ­", "ðŸŽ¨", "ðŸŽ¬", "ðŸŽ¤", "ðŸŽ§", "ðŸŽ¼", "ðŸŽ¹", "ðŸ¥", "ðŸª˜", "ðŸŽ·", "ðŸŽº", "ðŸª—", "ðŸŽ¸", "ðŸª•", "ðŸŽ»", "ðŸŽ²", "â™Ÿï¸", "ðŸŽ¯", "ðŸŽ³", "ðŸŽ®", "ðŸ•¹ï¸", "ðŸŽ°"]
    },
    {
        name: "Du lá»‹ch",
        icon: "âœˆï¸",
        emojis: ["ðŸš—", "ðŸš•", "ðŸš™", "ðŸšŒ", "ðŸšŽ", "ðŸŽï¸", "ðŸš“", "ðŸš‘", "ðŸš’", "ðŸš", "ðŸ›»", "ðŸšš", "ðŸš›", "ðŸšœ", "ðŸ¦¯", "ðŸ¦½", "ðŸ¦¼", "ðŸ›´", "ðŸš²", "ðŸ›µ", "ðŸï¸", "ðŸ›º", "ðŸš¨", "ðŸš”", "ðŸš", "ðŸš˜", "ðŸš–", "ðŸ›ž", "ðŸš¡", "ðŸš ", "ðŸšŸ", "ðŸšƒ", "ðŸš‹", "ðŸšž", "ðŸš", "ðŸš„", "ðŸš…", "ðŸšˆ", "ðŸš‚", "ðŸš†", "ðŸš‡", "ðŸšŠ", "ðŸš‰", "âœˆï¸", "ðŸ›«", "ðŸ›¬", "ðŸ›©ï¸", "ðŸ’º", "ðŸ›°ï¸", "ðŸš€", "ðŸ›¸", "ðŸš", "ðŸ›¶", "â›µ", "ðŸš¤", "ðŸ›¥ï¸", "ðŸ›³ï¸", "â›´ï¸", "ðŸš¢", "ðŸ—½", "ðŸ—¼", "ðŸ°", "ðŸ¯", "ðŸŸï¸", "ðŸŽ¡", "ðŸŽ¢", "ðŸŽ ", "â›²", "â›±ï¸", "ðŸ–ï¸", "ðŸï¸", "ðŸœï¸", "ðŸŒ‹", "â›°ï¸", "ðŸ”ï¸", "ðŸ—»", "ðŸ•ï¸", "ðŸ›–", "ðŸ ", "ðŸ¡", "ðŸ—ï¸", "ðŸ¢", "ðŸ¬", "ðŸ£", "ðŸ¤", "ðŸ¥", "ðŸ¦", "ðŸ¨", "ðŸª", "ðŸ«", "ðŸ©", "ðŸ’’", "ðŸ›ï¸", "â›ª", "ðŸ•Œ", "ðŸ•", "ðŸ›•", "ðŸ•‹", "â›©ï¸"]
    },
    {
        name: "Äá»“ váº­t",
        icon: "ðŸ’¡",
        emojis: ["âŒš", "ðŸ“±", "ðŸ“²", "ðŸ’»", "âŒ¨ï¸", "ðŸ–¥ï¸", "ðŸ–¨ï¸", "ðŸ–±ï¸", "ðŸ–²ï¸", "ðŸ•¹ï¸", "ðŸ—œï¸", "ðŸ’½", "ðŸ’¾", "ðŸ’¿", "ðŸ“€", "ðŸ“¼", "ðŸ“·", "ðŸ“¸", "ðŸ“¹", "ðŸŽ¥", "ðŸ“½ï¸", "ðŸŽžï¸", "ðŸ“ž", "â˜Žï¸", "ðŸ“Ÿ", "ðŸ“ ", "ðŸ“º", "ðŸ“»", "ðŸŽ™ï¸", "ðŸŽšï¸", "ðŸŽ›ï¸", "ðŸ§­", "â±ï¸", "â²ï¸", "â°", "ðŸ•°ï¸", "âŒ›", "â³", "ðŸ“¡", "ðŸ”‹", "ðŸª«", "ðŸ”Œ", "ðŸ’¡", "ðŸ”¦", "ðŸ•¯ï¸", "ðŸª”", "ðŸ§¯", "ðŸ›¢ï¸", "ðŸª™", "ðŸ’°", "ðŸ’´", "ðŸ’µ", "ðŸ’¶", "ðŸ’·", "ðŸªª", "ðŸ’³", "ðŸ’Ž", "âš–ï¸", "ðŸªœ", "ðŸ§°", "ðŸª›", "ðŸ”§", "ðŸ”¨", "âš’ï¸", "ðŸ› ï¸", "â›ï¸", "ðŸªš", "ðŸ”©", "âš™ï¸", "ðŸª¤", "ðŸ§±", "â›“ï¸", "ðŸ§²", "ðŸ”«", "ðŸ’£", "ðŸ§¨", "ðŸª“", "ðŸ”ª", "ðŸ—¡ï¸", "âš”ï¸", "ðŸ›¡ï¸", "ðŸš¬", "âš°ï¸", "ðŸª¦", "âš±ï¸", "ðŸº", "ðŸ”®", "ðŸ“¿", "ðŸ§¿", "ðŸª¬", "ðŸ’ˆ", "âš—ï¸", "ðŸ”­", "ðŸ”¬", "ðŸ•³ï¸", "ðŸ©¹", "ðŸ©º", "ðŸ©»", "ðŸ©¼", "ðŸ’Š", "ðŸ’‰", "ðŸ©¸", "ðŸ§¬", "ðŸ¦ ", "ðŸ§«", "ðŸ§ª", "ðŸŒ¡ï¸", "ðŸ§¹", "ðŸª ", "ðŸ§º", "ðŸ§»", "ðŸ§¼", "ðŸ«§", "ðŸª¥", "ðŸ§½", "ðŸ§¯", "ðŸ›’", "ðŸš¬"]
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

    // Sá»­ dá»¥ng Array.from Ä‘á»ƒ tÃ¡ch kÃ½ tá»±/emoji surrogate pairs chuáº©n xÃ¡c
    const chars = Array.from(text);
    chars.pop();
    input.value = chars.join("");

    input.dispatchEvent(new Event("input", { bubbles: true }));

    // TrÃ¡nh tá»± Ä‘á»™ng focus trÃªn mobile Ä‘á»ƒ khÃ´ng lÃ m nháº£y bÃ n phÃ­m áº£o
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

    // 1. ThÃªm nÃºt "ABC" vÃ o Ä‘áº§u Ä‘á»ƒ táº¯t emoji quay vá» bÃ n phÃ­m chá»¯
    const abcTab = document.createElement("div");
    abcTab.className = "emoji-category-tab abc-tab";
    abcTab.innerText = "ABC";
    abcTab.onclick = (e) => {
        e.stopPropagation();
        switchToTextKeyboard();
    };
    tabsContainer.appendChild(abcTab);

    // 2. Táº¡o category tabs tá»« EMOJI_DATA
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

    // 3. ThÃªm nÃºt backspace (xÃ³a chá»¯) vÃ o cuá»‘i
    const deleteTab = document.createElement("div");
    deleteTab.className = "emoji-category-tab delete-tab";
    deleteTab.innerHTML = '<i class="fas fa-backspace"></i>';
    deleteTab.title = "XÃ³a";

    // Xá»­ lÃ½ giá»¯ nÃºt Ä‘á»ƒ xÃ³a nhanh (giá»‘ng bÃ n phÃ­m tháº­t)
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

    // Táº¡o emoji grid
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
        // Cá»™ng 1 Ä‘á»ƒ bá» qua tab "ABC" á»Ÿ vá»‹ trÃ­ Ä‘áº§u tiÃªn
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

    // Chá»‰ focus láº¡i trÃªn Desktop (Ä‘á»ƒ tiáº¿p tá»¥c gÃµ), trÃªn mobile trÃ¡nh gá»i focus gÃ¢y báº­t bÃ n phÃ­m áº£o che máº¥t emoji
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
        // Táº¯t bÃ n phÃ­m áº£o trÃªn mobile khi báº­t chá»n emoji
        const input = document.getElementById("message-input");
        if (input) input.blur();

        initEmojiPicker();
        panel.classList.add("show");
        if (btn) btn.classList.add("active");

        // ThÃªm class emoji-open á»Ÿ input-area
        const inputArea = document.getElementById("input-area");
        if (inputArea) inputArea.classList.add("emoji-open");

        // Clear search
        const searchInput = document.getElementById("emoji-search-input");
        if (searchInput) searchInput.value = "";

        // Reset to show all emojis
        const grid = document.getElementById("emoji-grid");
        if (grid) renderAllEmojis(grid);
        setActiveCategoryTab(0);

        // Tá»± Ä‘á»™ng cuá»™n tin nháº¯n xuá»‘ng cuá»‘i sau khi má»Ÿ emoji picker
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

    // XÃ³a class emoji-open á»Ÿ input-area
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
            grid.innerHTML = '<div class="emoji-no-results">KhÃ´ng tÃ¬m tháº¥y emoji ðŸ˜¢</div>';
        } else {
            grid.innerHTML = '<div class="emoji-no-results">KhÃ´ng tÃ¬m tháº¥y danh má»¥c phÃ¹ há»£p ðŸ˜¢</div>';
        }
    }
}

// Close emoji picker when clicking outside
document.addEventListener("click", (e) => {
    const panel = document.getElementById("emoji-picker-panel");
    const wrapper = document.querySelector(".emoji-picker-wrapper");
    if (panel && panel.classList.contains("show")) {
        // TrÃ¡nh Ä‘Ã³ng panel khi click vÃ o trong chÃ­nh panel hoáº·c vÃ o nÃºt báº¥m toggle
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

// --- Há»– TRá»¢ CÃ€I Äáº¶T á»¨NG Dá»¤NG (PWA INSTALLATION) ---
let deferredPrompt = null;

// Láº¯ng nghe sá»± kiá»‡n trÆ°á»›c khi cÃ i Ä‘áº·t (chá»‰ kÃ­ch hoáº¡t trÃªn Android / Chrome Desktop)
window.addEventListener("beforeinstallprompt", (e) => {
    // NgÄƒn cháº·n trÃ¬nh duyá»‡t hiá»ƒn thá»‹ banner máº·c Ä‘á»‹nh
    e.preventDefault();
    // LÆ°u trá»¯ sá»± kiá»‡n Ä‘á»ƒ kÃ­ch hoáº¡t sau
    deferredPrompt = e;

    // Hiá»ƒn thá»‹ cÃ¡c nÃºt cÃ i Ä‘áº·t trÃªn giao diá»‡n
    const installProfileItem = document.getElementById("install-app-profile-item");
    const installAuthBtn = document.getElementById("install-app-auth-btn");

    if (installProfileItem) installProfileItem.style.display = "flex";
    if (installAuthBtn) installAuthBtn.style.display = "flex";
});

// HÃ m kÃ­ch hoáº¡t há»™p thoáº¡i cÃ i Ä‘áº·t cá»§a trÃ¬nh duyá»‡t
async function triggerPwaInstall() {
    if (deferredPrompt) {
        // Hiá»‡n há»™p thoáº¡i cÃ i Ä‘áº·t
        deferredPrompt.prompt();
        // Nháº­n pháº£n há»“i tá»« ngÆ°á»i dÃ¹ng
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Lá»±a chá»n cÃ i Ä‘áº·t cá»§a ngÆ°á»i dÃ¹ng: ${outcome}`);
        // XÃ³a prompt Ä‘Ã£ lÆ°u
        deferredPrompt = null;

        // áº¨n cÃ¡c nÃºt cÃ i Ä‘áº·t
        hideInstallButtons();
    } else {
        alert("á»¨ng dá»¥ng Ä‘Ã£ Ä‘Æ°á»£c cÃ i Ä‘áº·t hoáº·c trÃ¬nh duyá»‡t cá»§a báº¡n khÃ´ng há»— trá»£ cÃ i Ä‘áº·t tá»± Ä‘á»™ng. HÃ£y sá»­ dá»¥ng Google Chrome trÃªn Android Ä‘á»ƒ cÃ i Ä‘áº·t.");
    }
}

function hideInstallButtons() {
    const installProfileItem = document.getElementById("install-app-profile-item");
    const installAuthBtn = document.getElementById("install-app-auth-btn");
    if (installProfileItem) installProfileItem.style.display = "none";
    if (installAuthBtn) installAuthBtn.style.display = "none";
}

// áº¨n nÃºt khi á»©ng dá»¥ng Ä‘Ã£ cÃ i Ä‘áº·t thÃ nh cÃ´ng
window.addEventListener("appinstalled", () => {
    console.log("á»¨ng dá»¥ng Ä‘Ã£ Ä‘Æ°á»£c cÃ i Ä‘áº·t thÃ nh cÃ´ng lÃ m PWA!");
    hideInstallButtons();
});

// Gáº¯n sá»± kiá»‡n click vÃ o cÃ¡c nÃºt báº¥m tÆ°Æ¡ng á»©ng sau khi DOM load xong
document.addEventListener("DOMContentLoaded", () => {
    // ÄÄƒng kÃ½ Service Worker toÃ n cá»¥c ngay khi táº£i trang Ä‘á»ƒ Ä‘áº£m báº£o tÃ­nh nÄƒng PWA (cÃ i Ä‘áº·t app) hoáº¡t Ä‘á»™ng Ä‘á»™c láº­p vá»›i ThÃ´ng bÃ¡o
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then((registration) => {
                console.log("PWA Service Worker Ä‘Ã£ Ä‘Æ°á»£c Ä‘Äƒng kÃ½ toÃ n cá»¥c thÃ nh cÃ´ng!");
                // Chá»§ Ä‘á»™ng cáº­p nháº­t service worker náº¿u cÃ³ phiÃªn báº£n má»›i
                registration.update();
            })
            .catch((err) => {
                console.error("Lá»—i Ä‘Äƒng kÃ½ Service Worker toÃ n cá»¥c:", err);
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

    // --- NÃšT CUá»˜N XUá»NG DÆ¯á»šI (SCROLL TO BOTTOM BUTTON) ---
    const messagesDiv = document.getElementById("messages");
    const scrollBtn = document.getElementById("scroll-to-bottom-btn");

    if (messagesDiv && scrollBtn) {
        messagesDiv.addEventListener("scroll", () => {
            const distanceFromBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight;
            // Náº¿u ngÆ°á»i dÃ¹ng cuá»™n lÃªn quÃ¡ 300px thÃ¬ hiá»‡n nÃºt
            if (distanceFromBottom > 300) {
                scrollBtn.classList.add("visible");
            } else {
                scrollBtn.classList.remove("visible");
            }
        });

        scrollBtn.addEventListener("click", () => {
            messagesDiv.scrollTo({
                top: messagesDiv.scrollHeight,
                behavior: "smooth"
            });
        });
    }

    // KhÃ´ng tá»± Ä‘á»™ng kÃ­ch hoáº¡t trÃªn iOS (chá»‰ há»— trá»£ Android/Chrome thÃ´ng qua event beforeinstallprompt)
});

// ==========================================================================
// TÃNH NÄ‚NG TIN Tá»¨C REAL-TIME (TECH & AI NEWS)
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
            <p style="color: var(--text-light); font-size: 13.5px;">Äang táº£i tin tá»©c má»›i nháº¥t...</p>
        `;
    }

    try {
        const response = await fetch(`${API_URL}/news`);
        const json = await response.json();

        if (json.success && Array.isArray(json.data)) {
            allNewsItems = json.data;
            newsListLoaded = true;

            // LÃ m sáº¡ch readNewsIds: chá»‰ giá»¯ láº¡i IDs thuá»™c vá» tin tá»©c hiá»‡n táº¡i
            const validIds = new Set(allNewsItems.map(item => item.id));
            readNewsIds = readNewsIds.filter(id => validIds.has(id));
            try {
                localStorage.setItem("read_news_ids", JSON.stringify(readNewsIds));
            } catch (e) {
                console.error("Failed to save cleaned read news IDs:", e);
            }

            renderNews();
        } else {
            throw new Error(json.message || "KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u.");
        }
    } catch (error) {
        console.error("Lá»—i khi táº£i danh sÃ¡ch tin tá»©c ban Ä‘áº§u:", error);
        if (emptyState) {
            emptyState.style.display = "block";
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: #ef4444; margin-bottom: 12px; display: block;"></i>
                <p style="color: #ef4444; font-size: 13.5px;">KhÃ´ng thá»ƒ káº¿t ná»‘i mÃ¡y chá»§ tin tá»©c. Vui lÃ²ng thá»­ láº¡i.</p>
            `;
        }
    }
    updateNewsBadge();
}

function renderNews() {
    const newsList = document.getElementById("news-list");
    const emptyState = document.getElementById("news-empty-state");

    if (!newsList) return;

    // XÃ³a cÃ¡c news-card cÅ©
    const cards = newsList.querySelectorAll(".news-card");
    cards.forEach(card => card.remove());

    // Lá»c tin tá»©c theo danh má»¥c
    const filteredNews = allNewsItems.filter(item => {
        if (currentNewsFilter === "all") return true;
        return item.category === currentNewsFilter;
    });

    // Sáº¯p xáº¿p tin tá»©c: ChÆ°a Ä‘á»c lÃªn trÃªn, ÄÃ£ Ä‘á»c xuá»‘ng dÆ°á»›i. CÃ¹ng tráº¡ng thÃ¡i thÃ¬ tin má»›i hÆ¡n lÃªn Ä‘áº§u.
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
                <p style="color: var(--text-light); font-size: 13.5px;">ChÆ°a cÃ³ tin tá»©c nÃ o thuá»™c danh má»¥c nÃ y.</p>
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
            return { label: "Tháº¿ giá»›i", badgeClass: "world-badge" };
        case "Vietnam":
            return { label: "Viá»‡t Nam", badgeClass: "vietnam-badge" };
        case "Tech_AI":
        default:
            return { label: "CÃ´ng nghá»‡ & AI", badgeClass: "tech-badge" };
    }
}

function getNewsCardHtml(newsItem, isNewRealtime = false) {
    const animationClass = isNewRealtime ? "realtime-news-animation" : "";
    const { label, badgeClass } = getCategoryDetails(newsItem.category);

    // Kiá»ƒm tra tráº¡ng thÃ¡i Ä‘Ã£ Ä‘á»c hay chÆ°a
    const isRead = readNewsIds.includes(newsItem.id);
    const readClass = isRead ? "read" : "";

    // Táº¡o nhÃ£n "ÄÃ£ Ä‘á»c" / "ChÆ°a Ä‘á»c"
    const statusBadge = isRead
        ? `<span class="read-status-badge read" id="status-badge-${newsItem.id}">ÄÃ£ Ä‘á»c</span>`
        : `<span class="read-status-badge unread" id="status-badge-${newsItem.id}">ChÆ°a Ä‘á»c</span>`;

    // NhÃ£n "Má»›i" cho tin cÃ o trong vÃ²ng 6 tiáº¿ng gáº§n Ä‘Ã¢y
    const isNew = (Date.now() - new Date(newsItem.createdAt).getTime()) < 6 * 60 * 60 * 1000;
    const hotBadge = isNew ? `<span class="read-status-badge hot-new">Má»šI</span>` : "";

    // Äá»‹nh dáº¡ng ngÃ y giá» thÃ¢n thiá»‡n
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
    // LÆ°u vÃ o bá»™ nhá»› cá»¥c bá»™
    allNewsItems.unshift(newsItem);

    // Náº¿u tin tá»©c má»›i khá»›p vá»›i bá»™ lá»c hiá»‡n táº¡i, chÃ¨n lÃªn Ä‘áº§u danh sÃ¡ch kÃ¨m hiá»‡u á»©ng
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

    // Cáº­p nháº­t tráº¡ng thÃ¡i active cho nÃºt báº¥m lá»c
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

    // TÃ¬m bÃ i viáº¿t trong bá»™ nhá»› cá»¥c bá»™ Ä‘á»ƒ hiá»‡n cÃ¡c thÃ´ng tin cÆ¡ báº£n ngay láº­p tá»©c
    const newsItem = allNewsItems.find(item => item.id === newsId);
    if (!newsItem) return;

    // GÃ¡n dá»¯ liá»‡u cÆ¡ báº£n
    const { label, badgeClass } = getCategoryDetails(newsItem.category);
    detailTitle.textContent = newsItem.title;
    detailBadge.textContent = label;
    detailBadge.className = `news-detail-badge ${badgeClass}`;

    const date = new Date(newsItem.createdAt);
    detailTime.textContent = date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) +
        " " + date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' });

    // Hiá»ƒn thá»‹ mÃ n hÃ¬nh chi tiáº¿t
    detailView.style.display = "flex";

    // ÄÃ¡nh dáº¥u Ä‘Ã£ Ä‘á»c bÃ i viáº¿t
    if (!readNewsIds.includes(newsId)) {
        readNewsIds.push(newsId);
        try {
            localStorage.setItem("read_news_ids", JSON.stringify(readNewsIds));
        } catch (e) {
            console.error(e);
        }

        // Rerender láº¡i toÃ n bá»™ danh sÃ¡ch Ä‘á»ƒ tá»± Ä‘á»™ng Ä‘Æ°a tin Ä‘Ã£ Ä‘á»c xuá»‘ng dÆ°á»›i vÃ  Ä‘áº©y tin chÆ°a Ä‘á»c lÃªn trÃªn
        renderNews();
        updateNewsBadge();
    }

    // Hiá»ƒn thá»‹ biá»ƒu tÆ°á»£ng táº£i dá»¯ liá»‡u
    detailBody.innerHTML = `
        <div style="text-align: center; padding: 60px 0;">
            <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--primary-color); margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;"></i>
            <p style="color: var(--text-light); font-size: 13.5px;">Äang táº£i ná»™i dung chi tiáº¿t...</p>
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
        console.error("Lá»—i khi táº£i chi tiáº¿t bÃ i bÃ¡o:", error);
        detailBody.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: #ef4444; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;"></i>
                <p style="color: #ef4444; font-size: 13.5px;">KhÃ´ng thá»ƒ táº£i ná»™i dung chi tiáº¿t. Báº¡n cÃ³ thá»ƒ Ä‘á»c trá»±c tiáº¿p táº¡i nguá»“n bÃ¡o:</p>
                ${newsItem.link ? (() => {
                let hostName = "trang gá»‘c";
                try { hostName = new URL(newsItem.link).hostname.replace("www.", ""); } catch (e) { }
                return `<a href="${newsItem.link}" target="_blank" style="color: var(--primary-color); font-weight: 600; text-decoration: underline; font-size: 14px; margin-top: 12px; display: inline-block;">Äá»c bÃ i viáº¿t gá»‘c trÃªn ${hostName} <i class="fas fa-external-link-alt"></i></a>`;
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

// ÄÄƒng kÃ½ toÃ n cá»¥c Ä‘á»ƒ cÃ¡c hÃ m inline onclick hoáº¡t Ä‘á»™ng Ä‘Æ°á»£c
window.filterNews = filterNews;
window.openNewsLink = openNewsLink;
window.showNewsDetail = showNewsDetail;
window.closeNewsDetail = closeNewsDetail;

// --- QUáº¢N LÃ CHI TIáº¾T Cáº¢M XÃšC (REACTIONS DETAIL MODAL) ---
function getUserNameFromCache(userId) {
    if (isSameId(userId, myId)) {
        return "Báº¡n";
    }
    if (currentChatPartnerId && isSameId(userId, currentChatPartnerId)) {
        const nickname = (currentNicknames && currentNicknames[currentChatPartnerId]);
        if (nickname) return nickname;
        const headerName = document.getElementById("chat-header-name");
        if (headerName) return headerName.innerText;
        return "Äá»‘i tÃ¡c";
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
    return "NgÆ°á»i dÃ¹ng khÃ¡c";
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
    allTab.innerText = `Táº¥t cáº£ (${entries.length})`;
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
// HÃ m kiá»ƒm tra ngÆ°á»i dÃ¹ng cÃ³ Ä‘ang á»Ÿ gáº§n cuá»‘i danh sÃ¡ch tin nháº¯n khÃ´ng
// NgÆ°á»¡ng 150px: náº¿u cÃ¡ch Ä‘Ã¡y <= 150px thÃ¬ coi nhÆ° "Ä‘ang á»Ÿ cuá»‘i"
window.isNearBottom = function(threshold) {
    const messagesDiv = document.getElementById("messages");
    if (!messagesDiv) return true;
    const t = threshold || 150;
    return (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) <= t;
};

// Smart scroll: Chá»‰ scroll xuá»‘ng cuá»‘i náº¿u ngÆ°á»i dÃ¹ng Ä‘ang á»Ÿ gáº§n cuá»‘i
// Náº¿u há» Ä‘ang kÃ©o lÃªn xem tin cÅ© â†’ KHÃ”NG scroll
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

    // PhÃ¡t hiá»‡n thiáº¿t bá»‹ iOS (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
        document.body.classList.add('is-ios');
    }

    const isMobileChatActive = () =>
        window.innerWidth <= 768 && document.body.classList.contains("mobile-chat-active");

    const applyViewportVars = () => {
        rafId = null;
        // Chá»‰ set --vv-height trÃªn iOS Ä‘á»ƒ trÃ¡nh xung Ä‘á»™t co giÃ£n tá»± nhiÃªn cá»§a Android
        if (isIOS) {
            root.style.setProperty('--vv-height', `${vv.height}px`);
        }

        if (window.isNearBottom(200)) {
            if (typeof window.scrollToBottomInstant === "function") {
                window.scrollToBottomInstant();
            }
        }
    };

    const handleViewportChange = () => {
        if (!isMobileChatActive()) return;
        // Bá» debounce 16ms: bÃ¡m sÃ¡t rAF Ä‘á»ƒ mÆ°á»£t theo tá»«ng frame bÃ n phÃ­m di chuyá»ƒn
        if (rafId === null) {
            rafId = requestAnimationFrame(applyViewportVars);
        }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    // CÃ¡c lá»›p báº£o vá»‡ chá»‘ng tá»± cuá»™n trÃªn táº¥t cáº£ thiáº¿t bá»‹ di Ä‘á»™ng
    // Fallback cho trÃ¬nh duyá»‡t cá»‘ cuá»™n layout viewport (window.scrollY lá»‡ch khá»i 0), Ã©p vá» láº¡i ngay láº­p tá»©c
    const lockLayoutScroll = () => {
        if (!isMobileChatActive()) return;
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    };
    window.addEventListener('scroll', lockLayoutScroll, { passive: true });

    // KhoÃ¡ ngay táº¡i thá»i Ä‘iá»ƒm focus, trÆ°á»›c khi trÃ¬nh duyá»‡t ká»‹p thá»±c hiá»‡n auto-scroll
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('focus', () => {
            if (!isMobileChatActive()) return;
            window.scrollTo(0, 0);
            requestAnimationFrame(() => window.scrollTo(0, 0));
        });
    }

    // Reset khi Ä‘Ã³ng bÃ n phÃ­m
    document.addEventListener('focusout', (e) => {
        if (e.target && e.target.id === 'message-input') {
            // FIX iOS #4: TÄƒng delay lÃªn 300ms cho iOS Ä‘á»ƒ keyboard ká»‹p Ä‘Ã³ng hoÃ n toÃ n
            // TrÆ°á»›c Ä‘Ã³ lÃ  100ms, quÃ¡ ngáº¯n cho animation keyboard trÃªn iOS
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

// --- ÄÃ“NG MÃ€N HÃŒNH CHÃ€O SPLASH SCREEN ---
function hideSplashScreen() {
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.remove();
            }, 500);
        }
    }, 1800); // Hiá»ƒn thá»‹ mÃ n hÃ¬nh chÃ o trong 1.8 giÃ¢y giá»‘ng Zalo
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hideSplashScreen);
} else {
    hideSplashScreen();
}