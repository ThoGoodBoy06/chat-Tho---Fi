/**
 * Chat Tho - Fi Admin Control Center
 * Full Logic Client Controller (Pure Vanilla ES6+)
 */

const STATE = {
  token: localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token") || null,
  currentUser: null,
  currentTab: "overview",
  usersPage: 1,
  usersTotalPages: 1,
  auditPage: 1,
  auditTotalPages: 1,
  pendingDeleteUser: null,
  activeCallsInterval: null,
  statsInterval: null,
};

// =========================================================================
// 1. HELPER FUNCTIONS
// =========================================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "✅" : (type === "error" ? "❌" : "⚠️");
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatVietnamTime(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch (e) {
    return dateStr;
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function apiFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (STATE.token) {
    headers["Authorization"] = `Bearer ${STATE.token}`;
  }

  try {
    const response = await fetch(endpoint, { credentials: "omit", ...options, headers });
    const data = await response.json();

    if (response.status === 401) {
      STATE.token = null;
      localStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_token");
      openModal("modal-login");
      throw new Error(data.message || "Phiên đăng nhập đã hết hạn.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Yêu cầu thất bại.");
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err.message);
    throw err;
  }
}

// Modal Management
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("active");
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-close");
    closeModal(target);
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.active").forEach((m) => m.classList.remove("active"));
  }
});

// =========================================================================
// 2. AUTHENTICATION
// =========================================================================

async function initAuth() {
  if (!STATE.token) {
    openModal("modal-login");
    return false;
  }

  try {
    const res = await apiFetch("/api/admin/me");
    STATE.currentUser = res.data;

    // Cập nhật profile mini
    const nameEl = document.getElementById("sidebar-admin-name");
    const roleEl = document.getElementById("sidebar-admin-role");
    const avatarEl = document.getElementById("sidebar-admin-avatar");

    if (nameEl) nameEl.textContent = STATE.currentUser.fullName || STATE.currentUser.username;
    if (roleEl) {
      roleEl.textContent = STATE.currentUser.role;
      if (STATE.currentUser.role === "SUPER_ADMIN") roleEl.style.color = "#d8b4fe";
    }
    if (avatarEl && STATE.currentUser.avatar) avatarEl.src = STATE.currentUser.avatar;

    closeModal("modal-login");
    updateSystemStatus(true);
    return true;
  } catch (err) {
    console.warn("Auth check failed:", err.message);
    openModal("modal-login");
    return false;
  }
}

// Form Đăng nhập
const loginForm = document.getElementById("admin-login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Đăng nhập thất bại.");
      }

      const role = data.data.role;
      if (!["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(role)) {
        throw new Error("Tài khoản của bạn không có quyền truy cập Admin Control Center.");
      }

      STATE.token = data.token;
      localStorage.setItem("admin_token", data.token);
      sessionStorage.setItem("admin_token", data.token);

      showToast(`Chào mừng ${data.data.fullName}!`, "success");
      closeModal("modal-login");
      await initAuth();
      loadTab(STATE.currentTab);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// Nút Đăng xuất
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi Admin Control Center?")) {
      STATE.token = null;
      localStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_token");
      location.reload();
    }
  });
}

function updateSystemStatus(isOnline, text = "Sẵn sàng") {
  const dot = document.getElementById("system-status-dot");
  const label = document.getElementById("system-status-text");
  if (dot) dot.style.background = isOnline ? "var(--accent-emerald)" : "var(--accent-rose)";
  if (label) label.textContent = isOnline ? text : "Mất kết nối";
}

// =========================================================================
// 3. TAB NAVIGATION
// =========================================================================

const TAB_TITLES = {
  overview: "Tổng quan hệ thống",
  users: "Quản lý người dùng",
  conversations: "Tin nhắn & Lịch sử hội thoại",
  moderation: "Kiểm duyệt & Báo cáo vi phạm",
  notifications: "Thông báo đẩy FCM",
  calls: "Giám sát cuộc gọi WebRTC",
  media: "Phân tích lưu trữ & Media",
  system: "Cấu hình & Vận hành",
  audit: "Nhật ký quản trị (Audit Logs)",
};

document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const targetTab = item.getAttribute("data-tab");
    switchTab(targetTab);
  });
});

function switchTab(tabId) {
  STATE.currentTab = tabId;

  // Cập nhật nav active
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (activeNav) activeNav.classList.add("active");

  // Cập nhật panel active
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const targetPanel = document.getElementById(`tab-${tabId}`);
  if (targetPanel) targetPanel.classList.add("active");

  // Cập nhật title
  const heading = document.getElementById("page-heading");
  if (heading) heading.textContent = TAB_TITLES[tabId] || "Control Center";

  // Dừng timer call nếu rời tab calls
  if (tabId !== "calls" && STATE.activeCallsInterval) {
    clearInterval(STATE.activeCallsInterval);
    STATE.activeCallsInterval = null;
  }

  loadTab(tabId);
}

function loadTab(tabId) {
  switch (tabId) {
    case "overview":
      loadOverviewData();
      break;
    case "users":
      loadUsersData();
      break;
    case "conversations":
      loadConversationsList();
      break;
    case "moderation":
      loadReportsData();
      break;
    case "notifications":
      updateNotificationEstimate();
      break;
    case "calls":
      loadCallsData();
      if (!STATE.activeCallsInterval) {
        STATE.activeCallsInterval = setInterval(loadCallsData, 5000);
      }
      break;
    case "media":
      loadMediaData();
      break;
    case "system":
      loadSystemConfig();
      break;
    case "audit":
      loadAuditLogs();
      break;
  }
}

// =========================================================================
// 4. TAB 1: OVERVIEW
// =========================================================================

async function loadOverviewData() {
  try {
    const [statsRes, healthRes] = await Promise.all([
      apiFetch("/api/admin/stats"),
      apiFetch("/api/admin/system/health"),
    ]);

    const s = statsRes.data;
    const h = healthRes.data;

    // KPI
    document.getElementById("stat-total-users").textContent = s.users.total.toLocaleString();
    document.getElementById("stat-online-users").textContent = s.users.online.toLocaleString();
    document.getElementById("stat-active-calls").textContent = s.operations.activeCallsCount.toLocaleString();
    document.getElementById("stat-pending-reports").textContent = s.moderation.pendingReports.toLocaleString();
    document.getElementById("stat-total-messages").textContent = s.chat.totalMessages.toLocaleString();

    // Badges sidebar
    const rBadge = document.getElementById("badge-pending-reports");
    if (rBadge) {
      rBadge.textContent = s.moderation.pendingReports;
      rBadge.style.display = s.moderation.pendingReports > 0 ? "inline-block" : "none";
    }

    const cBadge = document.getElementById("badge-active-calls");
    if (cBadge) {
      cBadge.textContent = s.operations.activeCallsCount;
      cBadge.style.display = s.operations.activeCallsCount > 0 ? "inline-block" : "none";
    }

    // Health detail
    const hours = Math.floor(h.uptimeSeconds / 3600);
    const mins = Math.floor((h.uptimeSeconds % 3600) / 60);
    document.getElementById("overview-uptime").textContent = `${hours}h ${mins}m`;
    document.getElementById("overview-db-latency").textContent = `${h.database.latencyMs} ms`;
    document.getElementById("overview-socket-conns").textContent = h.socketIO.connectedClients;
    document.getElementById("overview-ram").textContent = `${h.memory.rssMb} MB`;

    updateSystemStatus(true, "Máy chủ hoạt động tốt");
  } catch (err) {
    console.error("Lỗi tải overview:", err);
  }
}

// =========================================================================
// 5. TAB 2: USERS MANAGEMENT
// =========================================================================

let searchUserDebounce = null;
const searchUserInput = document.getElementById("input-search-user");
if (searchUserInput) {
  searchUserInput.addEventListener("input", () => {
    clearTimeout(searchUserDebounce);
    searchUserDebounce = setTimeout(() => {
      STATE.usersPage = 1;
      loadUsersData();
    }, 400);
  });
}

document.getElementById("filter-user-role")?.addEventListener("change", () => {
  STATE.usersPage = 1;
  loadUsersData();
});

document.getElementById("filter-user-status")?.addEventListener("change", () => {
  STATE.usersPage = 1;
  loadUsersData();
});

document.getElementById("btn-users-prev")?.addEventListener("click", () => {
  if (STATE.usersPage > 1) {
    STATE.usersPage--;
    loadUsersData();
  }
});

document.getElementById("btn-users-next")?.addEventListener("click", () => {
  if (STATE.usersPage < STATE.usersTotalPages) {
    STATE.usersPage++;
    loadUsersData();
  }
});

async function loadUsersData() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  const search = document.getElementById("input-search-user")?.value || "";
  const role = document.getElementById("filter-user-role")?.value || "";
  const status = document.getElementById("filter-user-status")?.value || "";

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Đang tải dữ liệu...</td></tr>`;

  try {
    const url = `/api/admin/users?page=${STATE.usersPage}&limit=20&search=${encodeURIComponent(search)}&role=${role}&status=${status}`;
    const res = await apiFetch(url);

    STATE.usersTotalPages = res.pagination.totalPages || 1;
    document.getElementById("users-page-info").textContent = `Trang ${res.pagination.page} / ${STATE.usersTotalPages} (Tổng: ${res.pagination.total})`;
    document.getElementById("btn-users-prev").disabled = STATE.usersPage <= 1;
    document.getElementById("btn-users-next").disabled = STATE.usersPage >= STATE.usersTotalPages;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy người dùng phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data
      .map((u) => {
        const isSuspended = u.status === "suspended" || u.isBlocked;
        const statusBadge =
          u.status === "pending_deletion"
            ? `<span class="badge badge-pending-del">Chờ xóa</span>`
            : u.status === "deleted"
            ? `<span class="badge badge-deleted">Đã xóa</span>`
            : isSuspended
            ? `<span class="badge badge-suspended">Bị khóa</span>`
            : `<span class="badge badge-active">Hoạt động</span>`;

        let roleBadgeClass = "badge-user";
        if (u.role === "SUPER_ADMIN") roleBadgeClass = "badge-super-admin";
        else if (u.role === "ADMIN") roleBadgeClass = "badge-admin";
        else if (u.role === "MODERATOR") roleBadgeClass = "badge-mod";

        const isSelf = STATE.currentUser && STATE.currentUser.id === u.id;
        const isSuperAdmin = STATE.currentUser && STATE.currentUser.role === "SUPER_ADMIN";

        return `
          <tr>
            <td>
              <div class="user-cell">
                <img src="${u.avatar}" class="user-avatar" alt="${u.username}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'36\' height=\'36\' fill=\'%23475569\' viewBox=\'0 0 24 24\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'">
                <div>
                  <div class="user-meta-name" title="${u.fullName}">${u.fullName}</div>
                  <div class="user-meta-sub">@${u.username} ${u.isOnline ? '<span style="color:var(--accent-emerald);">● online</span>' : ''}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="font-size:12px;">${u.email || '—'}</div>
              <div style="font-size:11px; color:var(--text-muted);">${u.phone || '—'}</div>
            </td>
            <td><span class="badge ${roleBadgeClass}">${u.role}</span></td>
            <td>${statusBadge}</td>
            <td><span style="font-weight:600;">${u.deviceCount || 0}</span> thiết bị</td>
            <td style="font-size:12px; color:var(--text-muted);">${formatVietnamTime(u.lastActive || u.createdAt)}</td>
            <td style="text-align:right;">
              <div style="display:inline-flex; gap:6px;">
                ${
                  !isSelf && u.status !== 'deleted'
                    ? `
                  <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}', '${isSuspended ? 'active' : 'suspended'}')" title="${isSuspended ? 'Mở khóa' : 'Khóa tài khoản'}">
                    ${isSuspended ? '🔓 Mở khóa' : '🔒 Khóa'}
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="inspectUserChat('${u.fullName.replace(/'/g, "\\'")}')" title="Xem tin nhắn và hình ảnh của người dùng">
                    💬 Xem chat
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="generateResetPwd('${u.id}')" title="Sinh link đặt lại mật khẩu">
                    🔑 Reset MK
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="forceUserLogout('${u.id}')" title="Bắt buộc đăng xuất toàn bộ thiết bị">
                    🚪 Đăng xuất
                  </button>
                `
                    : ''
                }

                ${
                  isSuperAdmin && !isSelf && u.status !== 'deleted'
                    ? `
                  <button class="btn btn-warning btn-sm" onclick="changeUserRole('${u.id}', '${u.role}')" title="Thay đổi vai trò">
                    👑 Đổi Role
                  </button>
                  ${
                    u.status !== 'pending_deletion'
                      ? `<button class="btn btn-warning btn-sm" onclick="markPendingDeletion('${u.id}', '${u.username}')" title="Chuyển sang trạng thái chờ xóa">
                          ⏳ Chờ xóa
                        </button>`
                      : `<button class="btn btn-danger btn-sm" onclick="promptPermanentDelete('${u.id}', '${u.username}')" title="Xóa vĩnh viễn (Super Admin)">
                          💥 Xóa vĩnh viễn
                        </button>`
                  }
                `
                    : ''
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--accent-rose);">${err.message}</td></tr>`;
  }
}

// User Actions
window.toggleUserStatus = async function (userId, targetStatus) {
  const isLocking = targetStatus === "suspended";
  const actionText = isLocking ? "khóa tài khoản này và thu hồi toàn bộ token" : "mở khóa tài khoản này";
  if (!confirm(`Bạn có chắc chắn muốn ${actionText}?`)) return;

  try {
    const res = await apiFetch(`/api/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: targetStatus }),
    });
    showToast(res.message, "success");
    loadUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.generateResetPwd = async function (userId) {
  try {
    const res = await apiFetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
    });
    const linkInput = document.getElementById("reset-pwd-result-link");
    if (linkInput) linkInput.value = res.data.resetUrl;
    openModal("modal-reset-pwd");
  } catch (err) {
    showToast(err.message, "error");
  }
};

document.getElementById("btn-copy-reset-pwd")?.addEventListener("click", () => {
  const linkInput = document.getElementById("reset-pwd-result-link");
  if (linkInput) {
    navigator.clipboard.writeText(linkInput.value);
    showToast("Đã sao chép liên kết đặt lại mật khẩu!", "success");
  }
});

window.forceUserLogout = async function (userId) {
  if (!confirm("Bắt buộc người dùng này đăng xuất trên toàn bộ thiết bị ngay lập tức?")) return;
  try {
    const res = await apiFetch(`/api/admin/users/${userId}/force-logout`, { method: "POST" });
    showToast(res.message, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.changeUserRole = async function (userId, currentRole) {
  const newRole = prompt(
    `Nhập vai trò mới (SUPER_ADMIN, ADMIN, MODERATOR, USER):`,
    currentRole
  );
  if (!newRole || newRole.trim() === currentRole) return;

  const normalized = newRole.trim().toUpperCase();
  if (!["SUPER_ADMIN", "ADMIN", "MODERATOR", "USER"].includes(normalized)) {
    alert("Vai trò không hợp lệ!");
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role: normalized }),
    });
    showToast(res.message, "success");
    loadUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.markPendingDeletion = async function (userId, username) {
  if (
    !confirm(
      `Chuyển tài khoản "${username}" sang trạng thái Chờ Xóa (Pending Deletion)? Người dùng sẽ bị khóa đăng nhập ngay tức khắc.`
    )
  )
    return;

  try {
    const res = await apiFetch(`/api/admin/users/${userId}/pending-deletion`, {
      method: "POST",
      body: JSON.stringify({ reason: "Quản trị viên chuyển trạng thái chờ xóa" }),
    });
    showToast(res.message, "success");
    loadUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
};

window.promptPermanentDelete = function (userId, username) {
  STATE.pendingDeleteUser = { id: userId, username };
  const targetText = `XÓA VĨNH VIỄN ${username}`;
  document.getElementById("delete-phrase-target").textContent = targetText;

  const input = document.getElementById("input-confirm-delete");
  input.value = "";
  const btn = document.getElementById("btn-confirm-permanent-delete");
  btn.disabled = true;

  input.oninput = () => {
    btn.disabled = input.value.trim() !== targetText;
  };

  openModal("modal-delete-permanent");
};

document.getElementById("btn-confirm-permanent-delete")?.addEventListener("click", async () => {
  if (!STATE.pendingDeleteUser) return;
  const { id, username } = STATE.pendingDeleteUser;
  const confirmText = document.getElementById("input-confirm-delete").value.trim();

  try {
    const res = await apiFetch(`/api/admin/users/${id}/permanent`, {
      method: "DELETE",
      body: JSON.stringify({ confirmText }),
    });
    showToast(res.message, "success");
    closeModal("modal-delete-permanent");
    STATE.pendingDeleteUser = null;
    loadUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// Modal Invite Link
document.getElementById("btn-open-invite-modal")?.addEventListener("click", () => {
  document.getElementById("invite-result-area").style.display = "none";
  openModal("modal-invite");
});

document.getElementById("btn-create-invite-submit")?.addEventListener("click", async () => {
  const email = document.getElementById("invite-email")?.value.trim();
  const role = document.getElementById("invite-role")?.value;
  const expiresInHours = parseInt(document.getElementById("invite-expiry")?.value) || 48;

  try {
    const res = await apiFetch("/api/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email, role, expiresInHours }),
    });

    const resultArea = document.getElementById("invite-result-area");
    const resultInput = document.getElementById("invite-result-link");
    if (resultArea && resultInput) {
      resultInput.value = res.data.inviteUrl;
      resultArea.style.display = "block";
    }
    showToast("Đã tạo liên kết mời thành công!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("btn-copy-invite")?.addEventListener("click", () => {
  const resultInput = document.getElementById("invite-result-link");
  if (resultInput) {
    navigator.clipboard.writeText(resultInput.value);
    showToast("Đã sao chép liên kết mời!", "success");
  }
});

// =========================================================================
// TAB CONVERSATIONS & CHAT INSPECTOR (XEM TIN NHẮN & HÌNH ẢNH)
// =========================================================================

let allConversationsCache = [];
let currentInspectedConvId = null;

window.inspectUserChat = async function (fullName) {
  switchTab("conversations");
  const searchInput = document.getElementById("input-search-conv");
  if (searchInput) {
    searchInput.value = fullName;
  }
  await loadConversationsList();
  if (allConversationsCache && allConversationsCache.length > 0) {
    const search = fullName.trim().toLowerCase();
    const match = allConversationsCache.find((c) => {
      const nameMatch = (c.name || "").toLowerCase().includes(search);
      const memberMatch = (c.members || []).some(
        (m) =>
          (m.fullName || "").toLowerCase().includes(search) ||
          (m.username || "").toLowerCase().includes(search)
      );
      return nameMatch || memberMatch;
    });
    if (match) {
      selectConversation(match.id);
    }
  }
};

const inputSearchConv = document.getElementById("input-search-conv");
if (inputSearchConv) {
  inputSearchConv.addEventListener("input", () => {
    renderConversationsList();
  });
}

async function loadConversationsList() {
  const listEl = document.getElementById("conversations-list-body");
  if (!listEl) return;

  listEl.innerHTML = `<li style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Đang tải danh sách hội thoại...</li>`;

  try {
    const res = await apiFetch("/api/admin/conversations");
    allConversationsCache = res.data || [];
    renderConversationsList();

    // Tự động mở cuộc trò chuyện có tin nhắn đầu tiên để xem ngay
    if (!currentInspectedConvId && allConversationsCache.length > 0) {
      const firstWithMsgs = allConversationsCache.find((c) => c.messageCount > 0) || allConversationsCache[0];
      if (firstWithMsgs) {
        selectConversation(firstWithMsgs.id);
      }
    }
  } catch (err) {
    listEl.innerHTML = `<li style="text-align:center; padding:30px; color:var(--accent-rose); font-size:13px;">${err.message}</li>`;
  }
}

function renderConversationsList() {
  const listEl = document.getElementById("conversations-list-body");
  if (!listEl) return;

  const search = document.getElementById("input-search-conv")?.value.trim().toLowerCase() || "";
  const filtered = allConversationsCache.filter((c) => {
    if (!search) return true;
    const nameMatch = (c.name || "").toLowerCase().includes(search);
    const memberMatch = (c.members || []).some(
      (m) =>
        (m.fullName || "").toLowerCase().includes(search) ||
        (m.username || "").toLowerCase().includes(search)
    );
    return nameMatch || memberMatch;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<li style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Không tìm thấy hội thoại phù hợp.</li>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((c) => {
      const isActive = c.id === currentInspectedConvId;
      const avatarSrc = c.avatar || (c.members && c.members[0] ? `/api/users/${c.members[0].id}/avatar` : "");
      return `
        <li class="conversation-item ${isActive ? "active" : ""}" onclick="selectConversation('${c.id}')">
          <img src="${avatarSrc}" class="conv-avatar" alt="Avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%2364748b\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
          <div class="conv-info">
            <div class="conv-name" title="${c.name}">${c.name}</div>
            <div class="conv-sub">
              <span>${c.type === "private" ? "👤 1-1" : "👥 Nhóm"}</span>
              <span>•</span>
              <span>${c.messageCount} tin nhắn</span>
            </div>
          </div>
        </li>
      `;
    })
    .join("");
}

window.selectConversation = async function (convId) {
  currentInspectedConvId = convId;
  renderConversationsList();

  const conv = allConversationsCache.find((c) => c.id === convId);
  const titleEl = document.getElementById("inspector-chat-title");
  const subEl = document.getElementById("inspector-chat-sub");
  const refreshBtn = document.getElementById("btn-refresh-messages");

  if (titleEl) titleEl.textContent = conv ? conv.name : "Hội thoại";
  if (subEl) {
    const memberList = conv ? conv.members.map((m) => m.fullName).join(", ") : "";
    subEl.textContent = `Thành viên: ${memberList} (${conv?.type === "private" ? "Chat 1-1" : "Nhóm chat"})`;
  }
  if (refreshBtn) {
    refreshBtn.style.display = "inline-flex";
    refreshBtn.onclick = () => loadConversationMessages(convId);
  }

  await loadConversationMessages(convId);
};

async function loadConversationMessages(convId) {
  const streamEl = document.getElementById("chat-messages-stream");
  if (!streamEl) return;

  streamEl.innerHTML = `<div style="text-align:center; margin:auto; color:var(--text-muted); font-size:13px;">Đang tải tin nhắn và hình ảnh...</div>`;

  try {
    const res = await apiFetch(`/api/admin/conversations/${convId}/messages`);
    const messages = res.data || [];

    if (messages.length === 0) {
      streamEl.innerHTML = `<div style="text-align:center; margin:auto; color:var(--text-muted); font-size:13px;">Phòng chat này chưa có tin nhắn nào.</div>`;
      return;
    }

    streamEl.innerHTML = messages
      .map((m) => {
        let mediaHtml = "";

        // Hình ảnh đính kèm (Có thể bấm để xem ảnh phóng to toàn màn hình)
        const senderSafe = (m.senderName || "Người gửi").replace(/'/g, "\\'");
        const receiverSafe = (m.receiverName || "Người nhận").replace(/'/g, "\\'");
        const imgCaption = `Người gửi: ${senderSafe} ➔ Người nhận: ${receiverSafe} (${formatVietnamTime(m.createdAt)})`;

        if (m.imageUrl) {
          mediaHtml += `
            <img src="${m.imageUrl}" class="message-image" alt="Ảnh đính kèm" onclick="openLightbox('${m.imageUrl}', '${imgCaption}')" title="Bấm để xem ảnh phóng to" onerror="this.alt='Không thể tải ảnh';">
          `;
        }

        // Video
        if (m.videoUrl) {
          mediaHtml += `
            <video src="${m.videoUrl}" class="message-video" controls preload="metadata"></video>
          `;
        }

        // Voice audio
        if (m.audioUrl) {
          mediaHtml += `
            <audio src="${m.audioUrl}" class="message-audio" controls preload="metadata"></audio>
          `;
        }

        // Tệp tin
        if (m.fileUrl && !m.imageUrl && !m.videoUrl && !m.audioUrl) {
          mediaHtml += `
            <div style="margin-top:6px;">
              <a href="${m.fileUrl}" target="_blank" style="color:var(--primary-cyan); font-size:12px; text-decoration:underline;">📎 Tệp đính kèm (${m.fileUrl.split("/").pop()})</a>
            </div>
          `;
        }

        const avatarSrc = m.senderAvatar || "data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'34\\' height=\\'34\\' fill=\\'%2364748b\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>";

        return `
          <div class="message-bubble" id="msg-${m.id}">
            <img src="${avatarSrc}" class="message-avatar" alt="${m.senderName}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'34\\' height=\\'34\\' fill=\\'%2364748b\\' viewBox=\\'0 0 24 24\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
            <div class="message-content-wrapper">
              <div class="message-direction-header">
                <span class="direction-tag direction-sender">👤 ${m.senderName}</span>
                <span class="direction-arrow">➔</span>
                <span class="direction-tag direction-receiver">${m.isDirect ? `🎯 ${m.receiverName}` : `👥 ${m.receiverName}`}</span>
              </div>
              ${m.isRecalled ? `<span class="badge badge-pending-del" style="font-size:10px; margin-bottom:4px; display:inline-block;">⚠️ Tin nhắn này đã bị người dùng thu hồi</span>` : ""}
              ${m.content ? `<div class="message-text">${m.content}</div>` : ""}
              ${mediaHtml}
              <div class="message-footer">
                <span class="message-time">${formatVietnamTime(m.createdAt)}</span>
                <button class="btn-msg-delete" onclick="adminDeleteMessage('${m.id}', '${convId}')" title="Xóa vĩnh viễn tin nhắn vi phạm này">🗑️ Xóa</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Tự động cuộn xuống cuối
    streamEl.scrollTop = streamEl.scrollHeight;
  } catch (err) {
    streamEl.innerHTML = `<div style="text-align:center; margin:auto; color:var(--accent-rose); font-size:13px;">${err.message}</div>`;
  }
}

window.adminDeleteMessage = async function (messageId, convId) {
  if (!confirm("Bạn có chắc chắn muốn xóa tin nhắn / hình ảnh này khỏi hệ thống?")) return;
  try {
    const res = await apiFetch(`/api/admin/messages/${messageId}`, { method: "DELETE" });
    showToast(res.message, "success");
    const el = document.getElementById(`msg-${messageId}`);
    if (el) el.remove();
    const lookupEl = document.getElementById(`lookup-msg-${messageId}`);
    if (lookupEl) lookupEl.remove();
  } catch (err) {
    showToast(err.message, "error");
  }
};

// =========================================================================
// SUBTABS & TRA CỨU: AI ĐÃ GỬI TIN NHẮN / HÌNH ẢNH CHO AI
// =========================================================================

document.getElementById("btn-subtab-inspector")?.addEventListener("click", () => {
  document.getElementById("btn-subtab-inspector").classList.add("active");
  document.getElementById("btn-subtab-lookup").classList.remove("active");
  document.getElementById("view-conversations-inspector").style.display = "grid";
  document.getElementById("view-direct-lookup").style.display = "none";
});

document.getElementById("btn-subtab-lookup")?.addEventListener("click", () => {
  document.getElementById("btn-subtab-lookup").classList.add("active");
  document.getElementById("btn-subtab-inspector").classList.remove("active");
  document.getElementById("view-conversations-inspector").style.display = "none";
  document.getElementById("view-direct-lookup").style.display = "block";
  loadUsersForLookupSelects();
  executeDirectLookup();
});

let cachedLookupUsers = [];
async function loadUsersForLookupSelects() {
  if (cachedLookupUsers.length > 0) return;
  try {
    const res = await apiFetch("/api/admin/users/all-simple");
    cachedLookupUsers = res.data || [];
    const senderSelect = document.getElementById("lookup-sender-select");
    const receiverSelect = document.getElementById("lookup-receiver-select");

    const optionsHtml = cachedLookupUsers
      .map((u) => `<option value="${u.id}">${u.fullName} (@${u.username})</option>`)
      .join("");

    if (senderSelect) {
      senderSelect.innerHTML = `<option value="">-- Tất cả người gửi --</option>` + optionsHtml;
    }
    if (receiverSelect) {
      receiverSelect.innerHTML = `<option value="">-- Tất cả người nhận --</option>` + optionsHtml;
    }
  } catch (err) {
    console.error("Lỗi loadUsersForLookupSelects:", err);
  }
}

document.getElementById("btn-reset-lookup")?.addEventListener("click", () => {
  const s = document.getElementById("lookup-sender-select");
  const r = document.getElementById("lookup-receiver-select");
  const k = document.getElementById("lookup-search-keyword");
  if (s) s.value = "";
  if (r) r.value = "";
  if (k) k.value = "";
  document.getElementById("lookup-results-stream").innerHTML = `
    <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">
      Vui lòng chọn người gửi và người nhận để xem toàn bộ tin nhắn và hình ảnh được gửi qua lại.
    </div>
  `;
  document.getElementById("lookup-result-summary").textContent = "Chưa thực hiện tra cứu. Hãy chọn người gửi và người nhận rồi bấm 'Tra cứu ngay'.";
});

document.getElementById("btn-exec-lookup")?.addEventListener("click", executeDirectLookup);

async function executeDirectLookup() {
  const senderId = document.getElementById("lookup-sender-select")?.value || "";
  const receiverId = document.getElementById("lookup-receiver-select")?.value || "";
  const keyword = document.getElementById("lookup-search-keyword")?.value.trim() || "";
  const onlyImages = document.getElementById("lookup-only-images")?.checked;
  const bidirectional = document.getElementById("lookup-bidirectional")?.checked;

  const streamEl = document.getElementById("lookup-results-stream");
  const summaryEl = document.getElementById("lookup-result-summary");

  streamEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Đang tìm kiếm tin nhắn và hình ảnh...</div>`;

  try {
    const params = new URLSearchParams({
      senderId,
      receiverId,
      search: keyword,
      onlyMedia: onlyImages ? "image" : "",
      bidirectional: bidirectional ? "1" : "0",
      limit: 60,
    });

    const res = await apiFetch(`/api/admin/messages/lookup?${params.toString()}`);
    const items = res.data || [];

    if (items.length === 0) {
      streamEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:13px;">Không tìm thấy tin nhắn / hình ảnh nào phù hợp.</div>`;
      summaryEl.textContent = `Kết quả: 0 tin nhắn.`;
      return;
    }

    summaryEl.innerHTML = `Tìm thấy <strong style="color:var(--primary-cyan);">${res.pagination.total}</strong> tin nhắn & hình ảnh đã gửi:`;

    streamEl.innerHTML = items
      .map((m) => {
        let mediaHtml = "";
        const senderSafe = (m.senderName || "Người gửi").replace(/'/g, "\\'");
        const receiverSafe = (m.receiverName || "Người nhận").replace(/'/g, "\\'");
        const caption = `Người gửi: ${senderSafe} ➔ Người nhận: ${receiverSafe} (${formatVietnamTime(m.createdAt)})`;

        if (m.imageUrl) {
          mediaHtml += `
            <img src="${m.imageUrl}" class="message-image" alt="Ảnh" onclick="openLightbox('${m.imageUrl}', '${caption}')" title="Bấm xem ảnh phóng to" onerror="this.alt='Không thể tải ảnh';">
          `;
        }
        if (m.videoUrl) {
          mediaHtml += `<video src="${m.videoUrl}" class="message-video" controls preload="metadata"></video>`;
        }
        if (m.audioUrl) {
          mediaHtml += `<audio src="${m.audioUrl}" class="message-audio" controls preload="metadata"></audio>`;
        }
        if (m.fileUrl && !m.imageUrl && !m.videoUrl && !m.audioUrl) {
          mediaHtml += `<a href="${m.fileUrl}" target="_blank" style="color:var(--primary-cyan); font-size:12px; text-decoration:underline;">📎 Tệp đính kèm (${m.fileUrl.split("/").pop()})</a>`;
        }

        return `
          <div class="lookup-msg-card" id="lookup-msg-${m.id}">
            <div class="message-direction-header">
              <span class="direction-tag direction-sender">👤 Người gửi: ${m.senderName} (@${m.senderUsername})</span>
              <span class="direction-arrow">➔ gửi cho ➔</span>
              <span class="direction-tag direction-receiver">${m.isDirect ? `🎯 Người nhận: ${m.receiverName} (@${m.receiverUsername || 'N/A'})` : `👥 Nhóm: ${m.receiverName}`}</span>
              <span style="font-size:11px; color:var(--text-muted); margin-left:auto;">${formatVietnamTime(m.createdAt)}</span>
            </div>

            ${m.isRecalled ? `<span class="badge badge-pending-del" style="font-size:10px; display:inline-block; width:fit-content;">⚠️ Tin nhắn này đã bị người dùng thu hồi</span>` : ""}
            ${m.content ? `<div class="message-text" style="font-size:13px; color:var(--text-primary); margin: 4px 0;">${m.content}</div>` : ""}
            ${mediaHtml}

            <div style="display:flex; justify-content:flex-end; margin-top:4px;">
              <button class="btn-msg-delete" onclick="adminDeleteMessage('${m.id}', '${m.conversationId}')" title="Xóa tin nhắn vi phạm">🗑️ Xóa vĩnh viễn</button>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    streamEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--accent-rose); font-size:13px;">${err.message}</div>`;
  }
}

// =========================================================================
// 6. TAB 3: MODERATION & REPORTS
// =========================================================================

document.getElementById("filter-report-status")?.addEventListener("change", loadReportsData);

async function loadReportsData() {
  const tbody = document.getElementById("reports-table-body");
  if (!tbody) return;

  const status = document.getElementById("filter-report-status")?.value || "";
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Đang tải báo cáo...</td></tr>`;

  try {
    const res = await apiFetch(`/api/admin/reports?status=${status}`);

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Không có báo cáo vi phạm nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data
      .map((r) => {
        const isPending = r.status === "PENDING";
        const statusBadge =
          r.status === "RESOLVED"
            ? `<span class="badge badge-active">Đã giải quyết</span>`
            : r.status === "DISMISSED"
            ? `<span class="badge badge-deleted">Đã bỏ qua</span>`
            : `<span class="badge badge-suspended">Chờ xử lý</span>`;

        return `
          <tr>
            <td>
              <div style="font-weight:600;">${r.reporter?.fullName || 'Ẩn danh'}</div>
              <div style="font-size:11px; color:var(--text-muted);">@${r.reporter?.username || 'N/A'}</div>
            </td>
            <td>
              <div style="font-weight:600; color:var(--accent-rose);">${r.reportedUser?.fullName || 'N/A'}</div>
              <div style="font-size:11px; color:var(--text-muted);">@${r.reportedUser?.username || 'N/A'} ${r.reportedUser?.isBlocked ? '(Đang bị khóa)' : ''}</div>
            </td>
            <td style="max-width:240px; word-break:break-word;">${r.reason}</td>
            <td style="font-size:12px; color:var(--text-muted);">${formatVietnamTime(r.createdAt)}</td>
            <td>${statusBadge}</td>
            <td style="text-align:right;">
              ${
                isPending
                  ? `
                <div style="display:inline-flex; gap:6px;">
                  <button class="btn btn-primary btn-sm" onclick="handleReport('${r.id}', 'RESOLVED', false)" title="Đánh dấu đã giải quyết">
                    ✓ Giải quyết
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="handleReport('${r.id}', 'RESOLVED', true)" title="Khóa tài khoản vi phạm">
                    🔒 Khóa vi phạm
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="handleReport('${r.id}', 'DISMISSED', false)" title="Bỏ qua báo cáo">
                    ✕ Bỏ qua
                  </button>
                </div>
              `
                  : `<span style="font-size:12px; color:var(--text-muted);">Hoàn tất</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--accent-rose);">${err.message}</td></tr>`;
  }
}

window.handleReport = async function (reportId, status, suspendUser) {
  const confirmMsg = suspendUser
    ? "Giải quyết báo cáo VÀ đình chỉ khóa tài khoản bị báo cáo?"
    : `Cập nhật trạng thái báo cáo thành: ${status}?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await apiFetch(`/api/admin/reports/${reportId}`, {
      method: "PUT",
      body: JSON.stringify({ status, suspendUser }),
    });
    showToast(res.message, "success");
    loadReportsData();
    loadOverviewData();
  } catch (err) {
    showToast(err.message, "error");
  }
};

// =========================================================================
// 7. TAB 4: FCM NOTIFICATIONS
// =========================================================================

const fcmTitleInput = document.getElementById("fcm-title");
const fcmBodyInput = document.getElementById("fcm-body");
const fcmAudienceSelect = document.getElementById("fcm-audience");
const fcmTargetRoleSelect = document.getElementById("fcm-target-role");

fcmTitleInput?.addEventListener("input", (e) => {
  document.getElementById("preview-notif-title").textContent = e.target.value.trim() || "Tiêu đề thông báo mẫu";
});

fcmBodyInput?.addEventListener("input", (e) => {
  document.getElementById("preview-notif-body").textContent = e.target.value.trim() || "Nội dung thông báo sẽ xuất hiện trên màn hình khóa...";
});

fcmAudienceSelect?.addEventListener("change", (e) => {
  const roleGroup = document.getElementById("fcm-role-group");
  if (roleGroup) roleGroup.style.display = e.target.value === "ROLE" ? "block" : "none";
  updateNotificationEstimate();
});

fcmTargetRoleSelect?.addEventListener("change", updateNotificationEstimate);

async function updateNotificationEstimate() {
  const audience = fcmAudienceSelect ? fcmAudienceSelect.value : "ALL";
  const targetRole = fcmTargetRoleSelect ? fcmTargetRoleSelect.value : "USER";
  const textEl = document.getElementById("fcm-estimate-text");

  try {
    const res = await apiFetch("/api/admin/notifications/preview", {
      method: "POST",
      body: JSON.stringify({ audience, targetRole }),
    });
    if (textEl) {
      textEl.textContent = `Ước tính: ~${res.data.estimatedUsers} người dùng (${res.data.estimatedDevices} thiết bị)`;
    }
  } catch (e) {
    if (textEl) textEl.textContent = "Không tính được ước tính.";
  }
}

document.getElementById("fcm-broadcast-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = fcmTitleInput.value.trim();
  const body = fcmBodyInput.value.trim();
  const audience = fcmAudienceSelect.value;
  const targetRole = fcmTargetRoleSelect.value;

  if (!title || !body) {
    showToast("Vui lòng nhập tiêu đề và nội dung!", "error");
    return;
  }

  if (
    !confirm(
      `XÁC NHẬN PHÁT THÔNG BÁO:\n\nTiêu đề: ${title}\nĐối tượng: ${audience} ${audience === 'ROLE' ? targetRole : ''}\n\nBạn có chắc chắn muốn gửi tới các thiết bị?`
    )
  )
    return;

  const btn = document.getElementById("btn-submit-fcm");
  btn.disabled = true;
  btn.textContent = "Đang phát sóng...";

  try {
    const res = await apiFetch("/api/admin/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify({ title, body, audience, targetRole }),
    });
    showToast(res.message, "success");
    fcmTitleInput.value = "";
    fcmBodyInput.value = "";
    document.getElementById("preview-notif-title").textContent = "Tiêu đề thông báo mẫu";
    document.getElementById("preview-notif-body").textContent = "Nội dung thông báo sẽ xuất hiện trên màn hình khóa...";
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Xem trước & Gửi";
  }
});

// =========================================================================
// 8. TAB 5: CALLS MONITORING
// =========================================================================

async function loadCallsData() {
  const tbody = document.getElementById("active-calls-table-body");
  const missedTbody = document.getElementById("missed-calls-table-body");

  try {
    const [activeRes, statsRes] = await Promise.all([
      apiFetch("/api/admin/calls/active"),
      apiFetch("/api/admin/calls/stats"),
    ]);

    // Active calls
    if (tbody) {
      if (!activeRes.data || activeRes.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">Hiện không có cuộc gọi nào đang diễn ra.</td></tr>`;
      } else {
        tbody.innerHTML = activeRes.data
          .map(
            (c) => `
          <tr>
            <td style="font-family:monospace; font-size:11px; color:var(--primary-cyan);">${c.room.slice(0, 16)}...</td>
            <td><strong>${c.callerName}</strong></td>
            <td><strong>${c.calleeName}</strong></td>
            <td><span class="badge badge-admin">${c.callType.toUpperCase()}</span></td>
            <td><span class="badge badge-active">Đang kết nối</span></td>
            <td style="font-family:monospace; font-weight:700; color:var(--accent-emerald);">${formatDuration(c.durationSeconds)}</td>
          </tr>
        `
          )
          .join("");
      }
    }

    // Missed calls
    if (missedTbody) {
      if (!statsRes.data.recentCalls || statsRes.data.recentCalls.length === 0) {
        missedTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">Không có cuộc gọi nhỡ gần đây.</td></tr>`;
      } else {
        missedTbody.innerHTML = statsRes.data.recentCalls
          .map(
            (m) => `
          <tr>
            <td><strong>${m.callerName}</strong></td>
            <td style="font-size:11px; color:var(--text-muted);">${m.conversationId ? m.conversationId.slice(0, 12) + '...' : '1-1'}</td>
            <td><span class="badge badge-suspended">${m.content}</span></td>
            <td style="font-size:12px; color:var(--text-muted);">${formatVietnamTime(m.createdAt)}</td>
          </tr>
        `
          )
          .join("");
      }
    }
  } catch (err) {
    console.error("Lỗi tải calls data:", err);
  }
}

// =========================================================================
// 9. TAB 6: MEDIA & STORAGE METRICS
// =========================================================================

async function loadMediaData() {
  try {
    const res = await apiFetch("/api/admin/media/stats");
    const counts = res.data.counts;

    document.getElementById("media-stat-images").textContent = counts.images.toLocaleString();
    document.getElementById("media-stat-videos").textContent = counts.videos.toLocaleString();
    document.getElementById("media-stat-audios").textContent = counts.audios.toLocaleString();
    document.getElementById("media-stat-avatars").textContent = counts.avatars.toLocaleString();

    // Tải thư viện hình ảnh gần đây
    loadMediaGallery();
  } catch (err) {
    console.error("Lỗi tải media stats:", err);
  }
}

// Media Gallery
const filterGalleryType = document.getElementById("filter-gallery-type");
if (filterGalleryType) {
  filterGalleryType.addEventListener("change", (e) => {
    loadMediaGallery(e.target.value);
  });
}

document.getElementById("btn-refresh-gallery")?.addEventListener("click", () => {
  const type = filterGalleryType ? filterGalleryType.value : "all";
  loadMediaGallery(type);
});

async function loadMediaGallery(type = "image") {
  const gridEl = document.getElementById("media-gallery-grid-body");
  if (!gridEl) return;

  gridEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Đang tải thư viện media...</div>`;

  try {
    const res = await apiFetch(`/api/admin/media/gallery?type=${type}&limit=36`);
    const items = res.data || [];

    if (items.length === 0) {
      gridEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy tệp media nào.</div>`;
      return;
    }

    gridEl.innerHTML = items
      .map((m) => {
        let thumbHtml = "";
        const senderSafe = (m.senderName || "Ẩn danh").replace(/'/g, "\\'");
        const receiverSafe = (m.receiverName || "Người nhận").replace(/'/g, "\\'");
        const caption = `Người gửi: ${senderSafe} ➔ Người nhận: ${receiverSafe} (${formatVietnamTime(m.createdAt)})`;

        if (m.imageUrl) {
          thumbHtml = `
            <img src="${m.imageUrl}" class="gallery-thumb" alt="Photo" onclick="openLightbox('${m.imageUrl}', '${caption}')" title="Bấm để xem ảnh phóng to">
          `;
        } else if (m.videoUrl) {
          thumbHtml = `
            <video src="${m.videoUrl}" class="gallery-thumb" controls preload="metadata"></video>
          `;
        } else if (m.audioUrl) {
          thumbHtml = `
            <div style="height:150px; display:flex; align-items:center; justify-content:center; background:#020617; padding:10px;">
              <audio src="${m.audioUrl}" controls style="width:100%;"></audio>
            </div>
          `;
        }

        return `
          <div class="gallery-card">
            ${thumbHtml}
            <div class="gallery-meta">
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600;">
                <span class="gallery-meta-sender" style="color:var(--primary-cyan);" title="Người gửi: ${m.senderName}">👤 ${m.senderName}</span>
                <span style="color:var(--text-muted);">➔</span>
                <span style="color:#818cf8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Người nhận: ${m.receiverName}">${m.isDirect ? `🎯 ${m.receiverName}` : `👥 ${m.receiverName}`}</span>
              </div>
              <span style="font-size:10px; color:var(--text-muted);">${m.conversationName}</span>
              <span style="font-size:10px; color:var(--text-muted);">${formatVietnamTime(m.createdAt)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    gridEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--accent-rose);">${err.message}</div>`;
  }
}

// =========================================================================
// LIGHTBOX ZOOM ẢNH
// =========================================================================

window.openLightbox = function (imgUrl, caption = "") {
  const modal = document.getElementById("modal-lightbox");
  const img = document.getElementById("lightbox-image-target");
  const captionEl = document.getElementById("lightbox-caption-target");

  if (img) img.src = imgUrl;
  if (captionEl) captionEl.textContent = caption;
  if (modal) modal.classList.add("active");
};

document.getElementById("btn-close-lightbox")?.addEventListener("click", () => {
  document.getElementById("modal-lightbox")?.classList.remove("active");
});

document.getElementById("modal-lightbox")?.addEventListener("click", (e) => {
  if (e.target.id === "modal-lightbox") {
    document.getElementById("modal-lightbox").classList.remove("active");
  }
});

// =========================================================================
// 10. TAB 7: SYSTEM CONFIG
// =========================================================================

async function loadSystemConfig() {
  try {
    const res = await apiFetch("/api/admin/system/config");
    const cfg = res.data;

    const chkMaint = document.getElementById("cfg-maintenance-mode");
    const msgMaint = document.getElementById("cfg-maintenance-msg");
    const chkReg = document.getElementById("cfg-allow-registration");
    const chkVoice = document.getElementById("cfg-allow-voice-calls");
    const chkVideo = document.getElementById("cfg-allow-video-calls");
    const chkFiles = document.getElementById("cfg-allow-file-uploads");

    if (chkMaint) chkMaint.checked = !!cfg.maintenanceMode;
    if (msgMaint) msgMaint.value = cfg.maintenanceMessage || "";
    if (chkReg) chkReg.checked = cfg.allowRegistration !== false;
    if (chkVoice) chkVoice.checked = cfg.allowVoiceCalls !== false;
    if (chkVideo) chkVideo.checked = cfg.allowVideoCalls !== false;
    if (chkFiles) chkFiles.checked = cfg.allowFileUploads !== false;
  } catch (err) {
    showToast("Không thể tải cấu hình hệ thống", "error");
  }
}

document.getElementById("system-config-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const maintenanceMode = document.getElementById("cfg-maintenance-mode").checked;
  const maintenanceMessage = document.getElementById("cfg-maintenance-msg").value.trim();
  const allowRegistration = document.getElementById("cfg-allow-registration").checked;
  const allowVoiceCalls = document.getElementById("cfg-allow-voice-calls").checked;
  const allowVideoCalls = document.getElementById("cfg-allow-video-calls").checked;
  const allowFileUploads = document.getElementById("cfg-allow-file-uploads").checked;

  try {
    const res = await apiFetch("/api/admin/system/config", {
      method: "PUT",
      body: JSON.stringify({
        maintenanceMode,
        maintenanceMessage,
        allowRegistration,
        allowVoiceCalls,
        allowVideoCalls,
        allowFileUploads,
      }),
    });
    showToast(res.message, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
});

// =========================================================================
// 11. TAB 8: AUDIT LOGS
// =========================================================================

let searchAuditDebounce = null;
document.getElementById("input-search-audit")?.addEventListener("input", () => {
  clearTimeout(searchAuditDebounce);
  searchAuditDebounce = setTimeout(() => {
    STATE.auditPage = 1;
    loadAuditLogs();
  }, 400);
});

document.getElementById("filter-audit-action")?.addEventListener("change", () => {
  STATE.auditPage = 1;
  loadAuditLogs();
});

document.getElementById("btn-audit-prev")?.addEventListener("click", () => {
  if (STATE.auditPage > 1) {
    STATE.auditPage--;
    loadAuditLogs();
  }
});

document.getElementById("btn-audit-next")?.addEventListener("click", () => {
  if (STATE.auditPage < STATE.auditTotalPages) {
    STATE.auditPage++;
    loadAuditLogs();
  }
});

async function loadAuditLogs() {
  const tbody = document.getElementById("audit-table-body");
  if (!tbody) return;

  const search = document.getElementById("input-search-audit")?.value || "";
  const action = document.getElementById("filter-audit-action")?.value || "";

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Đang tải nhật ký...</td></tr>`;

  try {
    const url = `/api/admin/audit-logs?page=${STATE.auditPage}&limit=20&search=${encodeURIComponent(search)}&action=${action}`;
    const res = await apiFetch(url);

    STATE.auditTotalPages = res.pagination.totalPages || 1;
    document.getElementById("audit-page-info").textContent = `Trang ${res.pagination.page} / ${STATE.auditTotalPages} (Tổng: ${res.pagination.total})`;
    document.getElementById("btn-audit-prev").disabled = STATE.auditPage <= 1;
    document.getElementById("btn-audit-next").disabled = STATE.auditPage >= STATE.auditTotalPages;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có bản ghi nhật ký nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data
      .map(
        (log) => `
        <tr>
          <td style="font-size:12px; font-family:monospace; color:var(--text-secondary);">${formatVietnamTime(log.createdAt)}</td>
          <td><strong>@${log.adminUsername}</strong></td>
          <td><span class="badge badge-admin">${log.action}</span></td>
          <td><span style="font-size:12px;">${log.targetType}${log.targetId ? ` (#${log.targetId.slice(0, 8)})` : ''}</span></td>
          <td style="font-family:monospace; font-size:11px; color:var(--text-muted);">${log.ipAddress || '127.0.0.1'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick='alert(${JSON.stringify(JSON.stringify(log.details, null, 2))})'>
              Xem JSON
            </button>
          </td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--accent-rose);">${err.message}</td></tr>`;
  }
}

// =========================================================================
// 12. INITIALIZATION
// =========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const isAuthed = await initAuth();
  if (isAuthed) {
    loadTab("overview");
  }

  // Mobile sidebar toggle
  const toggleBtn = document.getElementById("btn-toggle-sidebar");
  const sidebar = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
    });
  }

  // Poll stats every 15s
  setInterval(() => {
    if (STATE.token && STATE.currentTab === "overview") {
      loadOverviewData();
    }
  }, 15000);
});
