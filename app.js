/**
 * HANAP — CSU Lost & Found Management System
 * Client-Side Domain Controller & State Store (SRS v1.0 Baseline)
 */

const STORAGE_KEY = "hanap_csu_state_v1";
const DRAFT_KEY = "hanap_report_draft_v1";

// Seed Data matching CSU Campus Context & SRS User Classes
const INITIAL_STATE = {
  users: [
    {
      id: "USR-001",
      fullName: "Jane Rivera",
      univId: "231-00412",
      email: "jane.rivera@carsu.edu.ph",
      mobile: "0917 555 0142",
      role: "Student",
      password: "Password123",
      active: true,
      failedAttempts: 0,
      lockUntil: null,
    },
    {
      id: "USR-002",
      fullName: "Officer Mateo Cruz",
      univId: "EMP-0089",
      email: "security@carsu.edu.ph",
      mobile: "0918 555 0199",
      role: "Security Personnel",
      password: "Password123",
      active: true,
      failedAttempts: 0,
      lockUntil: null,
    },
    {
      id: "USR-003",
      fullName: "Engr. Marilou Umpad",
      univId: "ADM-0001",
      email: "admin@carsu.edu.ph",
      mobile: "0919 555 0101",
      role: "Administrator",
      password: "Password123",
      active: true,
      failedAttempts: 0,
      lockUntil: null,
    },
  ],
  reports: [
    {
      id: "REP-2026-101",
      type: "Found",
      name: "Olive Green Hydro Flask (32 oz)",
      category: "Others",
      description:
        "Found on a study bench near Hiraya Hall Ground Floor. Has two small botanical stickers near the base.",
      location: "Hiraya Hall Ground Floor",
      date: "2026-11-14",
      custodyLocation: "CSU Main Gate Security Office",
      status: "Open",
      reporterId: "USR-002",
      photoDataUrl: null,
      createdAt: "2026-11-14T09:15:00Z",
    },
    {
      id: "REP-2026-102",
      type: "Lost",
      name: "Casio fx-991ES PLUS Scientific Calculator",
      category: "Electronics",
      description:
        "Lost after CSC 106 lecture. Slide cover has faded initials written in silver marker.",
      location: "CCIS Computer Laboratory 2",
      date: "2026-11-15",
      custodyLocation: "",
      status: "Open",
      reporterId: "USR-001",
      photoDataUrl: null,
      createdAt: "2026-11-15T14:20:00Z",
    },
    {
      id: "REP-2026-103",
      type: "Found",
      name: "CSU Student ID & BPI Debit Card Holder",
      category: "IDs and Cards",
      description:
        "Brown leather cardholder turned in at OCSS. Owner name withheld for verification.",
      location: "University Library 2nd Floor",
      date: "2026-11-16",
      custodyLocation: "OCSS Front Desk",
      status: "Claim Pending",
      reporterId: "USR-003",
      photoDataUrl: null,
      createdAt: "2026-11-16T08:40:00Z",
    },
  ],
  claims: [
    {
      id: "CLM-2026-01",
      reportId: "REP-2026-103",
      claimantId: "USR-001",
      identifyingDetails:
        "Student ID ending in 0412 with a blue lanyard and a library receipt inside.",
      status: "Pending",
      reviewerId: null,
      remarks: "",
      submittedAt: "2026-11-16T10:05:00Z",
    },
  ],
  notifications: [
    {
      id: "NTF-01",
      recipientId: "USR-001",
      text: 'Your claim CLM-2026-01 on "CSU Student ID & BPI Debit Card Holder" is now under Security review.',
      date: "2026-11-16 10:05",
      read: false,
    },
  ],
  activityLogs: [
    {
      id: "LOG-01",
      actor: "System Seed",
      action: "Initialized HANAP v1.0 baseline records",
      timestamp: "2026-11-16 08:00",
    },
  ],
};

// Application State
let state = loadState();
let currentUser = null;
let activeModalReportId = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(INITIAL_STATE);
  } catch {
    return structuredClone(INITIAL_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function logActivity(actorName, actionText) {
  state.activityLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-5)}`,
    actor: actorName,
    action: actionText,
    timestamp: new Date().toLocaleString("en-PH", { hour12: false }),
  });
  saveState();
}

function notifyUser(recipientId, text) {
  state.notifications.unshift({
    id: `NTF-${Date.now().toString().slice(-5)}`,
    recipientId,
    text,
    date: new Date().toLocaleString("en-PH", { hour12: false }),
    read: false,
  });
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ==========================================================================
   Authentication & Session Management (FR-001, FR-002, NFR-004)
   ========================================================================== */
function setAuthenticatedUser(user) {
  currentUser = user;
  document.getElementById("landing-view").classList.add("hidden");
  document.getElementById("guest-nav").classList.add("hidden");
  document.getElementById("app-workspace").classList.remove("hidden");
  document.getElementById("auth-nav").classList.remove("hidden");

  document.getElementById("current-user-label").textContent =
    `${user.fullName} (${user.role})`;

  // Role-based navigation visibility (SRS Section 5.1 & NFR-002)
  const isStaff =
    user.role === "Security Personnel" || user.role === "Administrator";
  const isAdmin = user.role === "Administrator";

  document
    .getElementById("nav-verify-tab")
    .classList.toggle("hidden", !isStaff);
  document.getElementById("nav-admin-tab").classList.toggle("hidden", !isAdmin);

  // Set default max date to today for report forms
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("rep-date").max = today;
  document.getElementById("prefill-contact-preview").textContent =
    `${user.email}${user.mobile ? " • " + user.mobile : ""}`;

  restoreReportDraft();
  switchView("browse");
  updateBadges();
}

function logout() {
  currentUser = null;
  document.getElementById("app-workspace").classList.add("hidden");
  document.getElementById("auth-nav").classList.add("hidden");
  document.getElementById("landing-view").classList.remove("hidden");
  document.getElementById("guest-nav").classList.remove("hidden");
  showToast("You have been signed out.");
}

// Switch between Register and Login cards
document.getElementById("switch-to-login").addEventListener("click", () => {
  document.getElementById("register-card").classList.add("hidden");
  document.getElementById("login-card").classList.remove("hidden");
});

document.getElementById("nav-login-trigger").addEventListener("click", () => {
  document.getElementById("register-card").classList.add("hidden");
  document.getElementById("login-card").classList.remove("hidden");
  document.getElementById("login-email").focus();
});

document.getElementById("switch-to-register").addEventListener("click", () => {
  document.getElementById("login-card").classList.add("hidden");
  document.getElementById("register-card").classList.remove("hidden");
});

// Registration Submit (FR-001)
document.getElementById("register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  const fullName = document.getElementById("reg-name").value.trim();
  const univId = document.getElementById("reg-univ-id").value.trim();
  const role = document.getElementById("reg-role").value;
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const mobile = document.getElementById("reg-mobile").value.trim();
  const password = document.getElementById("reg-password").value;

  if (!fullName || !univId || !email || password.length < 8) {
    errorEl.textContent =
      "Please complete all required fields (password must be at least 8 characters).";
    return;
  }

  if (
    state.users.some(
      (u) =>
        u.email === email || u.univId.toLowerCase() === univId.toLowerCase(),
    )
  ) {
    errorEl.textContent =
      "An account with that email or University ID already exists.";
    return;
  }

  const newUser = {
    id: `USR-${Date.now().toString().slice(-4)}`,
    fullName,
    univId,
    email,
    mobile,
    role,
    password,
    active: true,
    failedAttempts: 0,
    lockUntil: null,
  };

  state.users.push(newUser);
  logActivity(fullName, `Registered new ${role} account (${univId})`);
  saveState();
  showToast("Account created! Welcome to HANAP.");
  setAuthenticatedUser(newUser);
});

// Login Submit with 5-attempt lockout (FR-002, NFR-004)
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  const email = document
    .getElementById("login-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("login-password").value;
  const user = state.users.find((u) => u.email === email);

  if (!user) {
    errorEl.textContent = "Invalid email or password.";
    return;
  }

  if (!user.active) {
    errorEl.textContent =
      "This account has been deactivated by an Administrator.";
    return;
  }

  if (user.lockUntil && Date.now() < user.lockUntil) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    errorEl.textContent = `Account temporarily locked due to failed attempts. Try again in ${mins} min(s).`;
    return;
  }

  if (user.password !== password) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    if (user.failedAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000;
      errorEl.textContent =
        "Account locked for 15 minutes after 5 consecutive failed attempts (NFR-004).";
    } else {
      errorEl.textContent = `Invalid credentials. Attempt ${user.failedAttempts} of 5.`;
    }
    saveState();
    return;
  }

  user.failedAttempts = 0;
  user.lockUntil = null;
  saveState();
  setAuthenticatedUser(user);
});

// Demo One-Click Logins
document.querySelectorAll("[data-demo-email]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const user = state.users.find((u) => u.email === btn.dataset.demoEmail);
    if (user && user.active) {
      setAuthenticatedUser(user);
      showToast(`Signed in as ${user.fullName} (${user.role})`);
    }
  });
});

document.getElementById("logout-btn").addEventListener("click", logout);

/* ==========================================================================
   View Routing & Navigation
   ========================================================================== */
function switchView(viewName) {
  document
    .querySelectorAll(".app-view")
    .forEach((sec) => sec.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");

  if (viewName === "browse") renderItemsDirectory();
  if (viewName === "my-records") renderMyRecords();
  if (viewName === "verify") renderVerificationQueue();
  if (viewName === "admin") renderAdminDashboard();
}

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

document
  .getElementById("cta-new-report")
  .addEventListener("click", () => switchView("report"));
document
  .getElementById("cancel-report-btn")
  .addEventListener("click", () => switchView("browse"));

/* ==========================================================================
   Search & Filter Items (FR-005, FR-006)
   ========================================================================== */
function renderItemsDirectory() {
  const keyword = document
    .getElementById("filter-keyword")
    .value.trim()
    .toLowerCase();
  const type = document.getElementById("filter-type").value;
  const category = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;

  // Exclude archived 'Closed' records from normal search unless explicitly filtered (BR-008)
  const filtered = state.reports.filter((item) => {
    if (status === "ALL" && item.status === "Closed") return false;
    if (status !== "ALL" && item.status !== status) return false;
    if (type !== "ALL" && item.type !== type) return false;
    if (category !== "ALL" && item.category !== category) return false;
    if (keyword) {
      const haystack =
        `${item.name} ${item.description} ${item.location} ${item.id}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  document.getElementById("results-count").textContent =
    `Showing ${filtered.length} matching ${filtered.length === 1 ? "item" : "items"}`;

  const grid = document.getElementById("items-grid");
  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="surface-card"><p class="muted-text">No matching items found. Try adjusting your filters or submit a new report.</p></div>`;
    return;
  }

  filtered.forEach((item) => {
    const statusClass = `status-${item.status.replace(/\s+/g, "-")}`;
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <div>
        <div class="item-card-top">
          <span class="type-tag">${item.type} Item • ${item.category}</span>
          <span class="status-badge ${statusClass}">${item.status}</span>
        </div>
        <h3 class="item-title">${escapeHtml(item.name)}</h3>
        <p class="item-meta">${escapeHtml(item.location)} • ${item.date}</p>
        <p class="item-excerpt">${escapeHtml(item.description)}</p>
      </div>
      <div class="item-card-footer">
        <span class="ref-code">${item.id}</span>
        <button type="button" class="btn-outline-sm" data-open-item="${item.id}">View Details</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-open-item]").forEach((btn) => {
    btn.addEventListener("click", () => openItemModal(btn.dataset.openItem));
  });
}

["filter-keyword", "filter-type", "filter-category", "filter-status"].forEach(
  (id) => {
    document.getElementById(id).addEventListener("input", renderItemsDirectory);
  },
);

document.getElementById("reset-filters-btn").addEventListener("click", () => {
  document.getElementById("filter-keyword").value = "";
  document.getElementById("filter-type").value = "ALL";
  document.getElementById("filter-category").value = "ALL";
  document.getElementById("filter-status").value = "ALL";
  renderItemsDirectory();
});

/* ==========================================================================
   Submit Lost / Found Report + Draft Retention (FR-003, FR-004, NFR-011)
   ========================================================================== */
document.querySelectorAll('input[name="reportType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const isFound = e.target.value === "Found";
    document
      .getElementById("custody-group")
      .classList.toggle("hidden", !isFound);
    document.getElementById("rep-location-label").textContent = isFound
      ? "Location Found *"
      : "Location Last Seen *";
    document.getElementById("rep-date-label").textContent = isFound
      ? "Date Found *"
      : "Date Lost *";
  });
});

// Auto-save form draft for connectivity resilience (NFR-011)
[
  "rep-name",
  "rep-category",
  "rep-location",
  "rep-date",
  "rep-custody",
  "rep-desc",
].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    const draft = {
      name: document.getElementById("rep-name").value,
      category: document.getElementById("rep-category").value,
      location: document.getElementById("rep-location").value,
      date: document.getElementById("rep-date").value,
      custody: document.getElementById("rep-custody").value,
      desc: document.getElementById("rep-desc").value,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  });
});

function restoreReportDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!draft) return;
    document.getElementById("rep-name").value = draft.name || "";
    document.getElementById("rep-category").value = draft.category || "";
    document.getElementById("rep-location").value = draft.location || "";
    document.getElementById("rep-date").value = draft.date || "";
    document.getElementById("rep-custody").value = draft.custody || "";
    document.getElementById("rep-desc").value = draft.desc || "";
  } catch {
    // Ignore malformed draft
  }
}

document.getElementById("report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("report-error");
  errorEl.textContent = "";

  const type = document.querySelector('input[name="reportType"]:checked').value;
  const name = document.getElementById("rep-name").value.trim();
  const category = document.getElementById("rep-category").value;
  const location = document.getElementById("rep-location").value.trim();
  const date = document.getElementById("rep-date").value;
  const custodyLocation = document.getElementById("rep-custody").value.trim();
  const description = document.getElementById("rep-desc").value.trim();
  const photoInput = document.getElementById("rep-photo");

  if (!name || !category || !location || !date || !description) {
    errorEl.textContent = "Please fill in all required fields marked with *.";
    return;
  }

  if (type === "Found" && !custodyLocation) {
    errorEl.textContent =
      "Please specify the current custody location for the found item.";
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  if (date > today) {
    errorEl.textContent = "The date cannot be in the future.";
    return;
  }

  let photoDataUrl = null;
  if (photoInput.files && photoInput.files[0]) {
    const file = photoInput.files[0];
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      errorEl.textContent = "Photograph must be a JPG or PNG file under 5 MB.";
      return;
    }
    photoDataUrl = await readFileAsDataUrl(file);
  }

  const refId = `REP-2026-${Math.floor(104 + Math.random() * 895)}`;
  state.reports.unshift({
    id: refId,
    type,
    name,
    category,
    description,
    location,
    date,
    custodyLocation: type === "Found" ? custodyLocation : "",
    status: "Open",
    reporterId: currentUser.id,
    photoDataUrl,
    createdAt: new Date().toISOString(),
  });

  logActivity(
    currentUser.fullName,
    `Submitted ${type} report ${refId} (${name})`,
  );
  saveState();
  localStorage.removeItem(DRAFT_KEY);
  e.target.reset();
  document.getElementById("custody-group").classList.add("hidden");

  showToast(`Report submitted! Reference Number: ${refId}`);
  switchView("browse");
});

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   Item Details Modal, Claiming & Private Messaging (FR-006, FR-008, FR-015)
   ========================================================================== */
function openItemModal(reportId) {
  const item = state.reports.find((r) => r.id === reportId);
  if (!item) return;
  activeModalReportId = reportId;

  const badge = document.getElementById("modal-item-badge");
  badge.textContent = item.status;
  badge.className = `status-badge status-${item.status.replace(/\s+/g, "-")}`;

  document.getElementById("modal-item-ref").textContent =
    `${item.type.toUpperCase()} • ${item.id}`;
  document.getElementById("modal-item-title").textContent = item.name;
  document.getElementById("modal-item-meta").textContent =
    `${item.category} • ${item.location} • ${item.date}`;
  document.getElementById("modal-item-desc").textContent = item.description;

  // Optional Photo
  const photoBox = document.getElementById("modal-photo-container");
  if (item.photoDataUrl) {
    photoBox.innerHTML = `<img src="${item.photoDataUrl}" alt="${escapeHtml(item.name)}" />`;
    photoBox.classList.remove("hidden");
  } else {
    photoBox.classList.add("hidden");
  }

  // Custody location for Found items
  const custodyBox = document.getElementById("modal-custody-box");
  if (item.type === "Found" && item.custodyLocation) {
    document.getElementById("modal-item-custody").textContent =
      item.custodyLocation;
    custodyBox.classList.remove("hidden");
  } else {
    custodyBox.classList.add("hidden");
  }

  // Privacy Enforcement (NFR-005 & BR-004): Only reporter, Security, and Admin see contact info
  const reporter = state.users.find((u) => u.id === item.reporterId);
  const isPrivileged =
    currentUser.id === item.reporterId ||
    currentUser.role === "Security Personnel" ||
    currentUser.role === "Administrator";

  const privBox = document.getElementById("modal-privileged-contact");
  if (isPrivileged && reporter) {
    document.getElementById("modal-reporter-info").textContent =
      `Reported by ${reporter.fullName} (${reporter.univId}) • ${reporter.email}${reporter.mobile ? " • " + reporter.mobile : ""}`;
    privBox.classList.remove("hidden");
  } else {
    privBox.classList.add("hidden");
  }

  // Claim eligibility: Found item + status Open + not reporter + no duplicate claim (FR-008)
  const alreadyClaimed = state.claims.some(
    (c) => c.reportId === item.id && c.claimantId === currentUser.id,
  );
  const canClaim =
    item.type === "Found" &&
    item.status === "Open" &&
    item.reporterId !== currentUser.id &&
    !alreadyClaimed;
  document
    .getElementById("modal-claim-section")
    .classList.toggle("hidden", !canClaim);

  // Contact Reporter eligibility (FR-015): Active reporter & viewer is not reporter
  const canMessage =
    item.reporterId !== currentUser.id &&
    item.status !== "Closed" &&
    reporter?.active;
  document
    .getElementById("modal-message-section")
    .classList.toggle("hidden", !canMessage);

  // Personnel Status Override (FR-010)
  const isStaff =
    currentUser.role === "Security Personnel" ||
    currentUser.role === "Administrator";
  const statusSec = document.getElementById("modal-status-section");
  statusSec.classList.toggle("hidden", !isStaff);
  if (isStaff) {
    document.getElementById("modal-status-select").value = item.status;
  }

  document.getElementById("item-modal").classList.remove("hidden");
}

document.getElementById("close-modal-btn").addEventListener("click", () => {
  document.getElementById("item-modal").classList.add("hidden");
  activeModalReportId = null;
});

// Submit Claim (FR-008)
document.getElementById("claim-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const details = document.getElementById("claim-details").value.trim();
  const item = state.reports.find((r) => r.id === activeModalReportId);
  if (!details || !item) return;

  const claimId = `CLM-2026-${String(state.claims.length + 1).padStart(2, "0")}`;
  state.claims.unshift({
    id: claimId,
    reportId: item.id,
    claimantId: currentUser.id,
    identifyingDetails: details,
    status: "Pending",
    reviewerId: null,
    remarks: "",
    submittedAt: new Date().toLocaleString("en-PH", { hour12: false }),
  });

  item.status = "Claim Pending";
  notifyUser(
    item.reporterId,
    `A claim (${claimId}) was submitted on your found-item report "${item.name}".`,
  );
  logActivity(currentUser.fullName, `Submitted claim ${claimId} on ${item.id}`);
  saveState();

  e.target.reset();
  document.getElementById("item-modal").classList.add("hidden");
  showToast(`Claim ${claimId} submitted! Status is now Claim Pending.`);
  updateBadges();
  renderItemsDirectory();
});

// Send In-System Private Message (FR-015)
document.getElementById("message-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = document.getElementById("message-text").value.trim();
  const item = state.reports.find((r) => r.id === activeModalReportId);
  if (!text || !item) return;

  notifyUser(
    item.reporterId,
    `Private message from ${currentUser.fullName} regarding "${item.name}" (${item.id}): "${text}"`,
  );
  logActivity(
    currentUser.fullName,
    `Sent private message regarding ${item.id}`,
  );
  saveState();

  e.target.reset();
  showToast("Message delivered privately inside HANAP.");
});

// Personnel Status Update (FR-010)
document.getElementById("update-status-btn").addEventListener("click", () => {
  const item = state.reports.find((r) => r.id === activeModalReportId);
  if (!item) return;
  const newStatus = document.getElementById("modal-status-select").value;
  item.status = newStatus;
  notifyUser(
    item.reporterId,
    `Status of your report "${item.name}" (${item.id}) changed to ${newStatus}.`,
  );
  logActivity(
    currentUser.fullName,
    `Updated status of ${item.id} to ${newStatus}`,
  );
  saveState();

  document.getElementById("item-modal").classList.add("hidden");
  showToast(`Item status updated to ${newStatus}.`);
  renderItemsDirectory();
  updateBadges();
});

/* ==========================================================================
   My Records & Notifications (FR-007, FR-011)
   ========================================================================== */
function renderMyRecords() {
  const myReports = state.reports.filter(
    (r) => r.reporterId === currentUser.id,
  );
  const myClaims = state.claims.filter((c) => c.claimantId === currentUser.id);
  const myNotifs = state.notifications.filter(
    (n) => n.recipientId === currentUser.id,
  );

  const repContainer = document.getElementById("my-reports-list");
  repContainer.innerHTML = myReports.length
    ? myReports
        .map(
          (r) => `
        <div class="record-row">
          <div>
            <strong>${escapeHtml(r.name)}</strong> <span class="ref-code">(${r.id})</span>
            <div class="muted-text">${r.type} • ${escapeHtml(r.location)} • ${r.date}</div>
          </div>
          <span class="status-badge status-${r.status.replace(/\s+/g, "-")}">${r.status}</span>
        </div>`,
        )
        .join("")
    : '<p class="muted-text">You have not submitted any reports yet.</p>';

  const claimContainer = document.getElementById("my-claims-list");
  claimContainer.innerHTML = myClaims.length
    ? myClaims
        .map((c) => {
          const item = state.reports.find((r) => r.id === c.reportId);
          return `
          <div class="record-row">
            <div>
              <strong>Claim ${c.id}</strong> on <em>${escapeHtml(item?.name || c.reportId)}</em>
              <div class="muted-text">Proof: "${escapeHtml(c.identifyingDetails)}"</div>
              ${c.remarks ? `<div class="muted-text">Reviewer remarks: ${escapeHtml(c.remarks)}</div>` : ""}
            </div>
            <span class="status-badge status-${c.status === "Approved" ? "Returned" : c.status === "Rejected" ? "Closed" : "Claim-Pending"}">${c.status}</span>
          </div>`;
        })
        .join("")
    : '<p class="muted-text">You have not submitted any claims yet.</p>';

  const notifContainer = document.getElementById("notifications-list");
  notifContainer.innerHTML = myNotifs.length
    ? myNotifs
        .map(
          (n) => `
        <div class="notif-item ${n.read ? "" : "unread"}">
          <div>${escapeHtml(n.text)}</div>
          <small class="muted-text">${n.date}</small>
        </div>`,
        )
        .join("")
    : '<p class="muted-text">No notifications yet.</p>';
}

document.getElementById("mark-all-read-btn").addEventListener("click", () => {
  state.notifications.forEach((n) => {
    if (n.recipientId === currentUser.id) n.read = true;
  });
  saveState();
  updateBadges();
  renderMyRecords();
});

/* ==========================================================================
   Security Personnel & Admin Verification Queue (FR-009, BR-006, BR-007)
   ========================================================================== */
function renderVerificationQueue() {
  const pendingClaims = state.claims.filter((c) => c.status === "Pending");
  const container = document.getElementById("verification-list");

  if (!pendingClaims.length) {
    container.innerHTML =
      '<div class="surface-card"><p class="muted-text">No pending claims awaiting verification.</p></div>';
    return;
  }

  container.innerHTML = pendingClaims
    .map((c) => {
      const item = state.reports.find((r) => r.id === c.reportId);
      const claimant = state.users.find((u) => u.id === c.claimantId);
      const isSelfClaim = c.claimantId === currentUser.id; // BR-007 rule

      return `
      <div class="surface-card">
        <div class="item-card-top">
          <span class="ref-code">${c.id} • Item ${c.reportId}</span>
          <span class="status-badge status-Claim-Pending">Awaiting Verification</span>
        </div>
        <h3 class="item-title">${escapeHtml(item?.name || "Unknown Item")}</h3>
        <p class="item-meta">
          Claimant: <strong>${escapeHtml(claimant?.fullName || "Unknown")}</strong> (${claimant?.univId || ""}) •
          Custody: ${escapeHtml(item?.custodyLocation || "N/A")}
        </p>
        <div class="info-callout">
          <strong>Submitted Identifying Details:</strong> ${escapeHtml(c.identifyingDetails)}
        </div>
        ${
          isSelfClaim
            ? '<p class="form-error">BR-007 Enforcement: You cannot review a claim that you submitted.</p>'
            : `
          <div class="form-group">
            <label for="remarks-${c.id}">Verification Remarks <span class="optional-tag">(mandatory if rejecting)</span></label>
            <input type="text" id="remarks-${c.id}" placeholder="Enter verification notes or rejection reason..." />
          </div>
          <div class="form-actions">
            <button type="button" class="btn-outline" data-decide-claim="${c.id}" data-decision="Rejected">Reject Claim</button>
            <button type="button" class="btn-primary" data-decide-claim="${c.id}" data-decision="Approved">Approve &amp; Mark Returned</button>
          </div>`
        }
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-decide-claim]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const claimId = btn.dataset.decideClaim;
      const decision = btn.dataset.decision;
      const remarks = document
        .getElementById(`remarks-${claimId}`)
        .value.trim();

      // BR-006: Rejection requires remarks
      if (decision === "Rejected" && !remarks) {
        showToast("Rejection remarks are required (BR-006).");
        return;
      }

      const claim = state.claims.find((c) => c.id === claimId);
      const item = state.reports.find((r) => r.id === claim.reportId);

      claim.status = decision;
      claim.reviewerId = currentUser.id;
      claim.remarks = remarks || "Verified and released to rightful owner.";

      if (item) {
        item.status = decision === "Approved" ? "Returned" : "Open";
      }

      notifyUser(
        claim.claimantId,
        `Your claim ${claim.id} on "${item?.name}" was ${decision}. Remarks: ${claim.remarks}`,
      );
      logActivity(
        currentUser.fullName,
        `${decision} claim ${claim.id} (${item?.id})`,
      );
      saveState();

      showToast(`Claim ${claimId} ${decision.toLowerCase()}.`);
      renderVerificationQueue();
      updateBadges();
    });
  });
}

/* ==========================================================================
   Administrator Dashboard & User Governance (FR-012, FR-013, FR-014)
   ========================================================================== */
function renderAdminDashboard() {
  const totalLost = state.reports.filter((r) => r.type === "Lost").length;
  const totalFound = state.reports.filter((r) => r.type === "Found").length;
  const openCount = state.reports.filter((r) => r.status === "Open").length;
  const returnedCount = state.reports.filter(
    (r) => r.status === "Returned",
  ).length;

  document.getElementById("admin-stats-grid").innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalLost}</div><div class="muted-text">Lost Reports</div></div>
    <div class="stat-card"><div class="stat-value">${totalFound}</div><div class="muted-text">Found Reports</div></div>
    <div class="stat-card"><div class="stat-value">${openCount}</div><div class="muted-text">Open Cases</div></div>
    <div class="stat-card"><div class="stat-value">${returnedCount}</div><div class="muted-text">Items Returned</div></div>
  `;

  document.getElementById("admin-users-tbody").innerHTML = state.users
    .map(
      (u) => `
      <tr>
        <td><strong>${escapeHtml(u.fullName)}</strong><br /><small class="muted-text">${u.univId} • ${u.email}</small></td>
        <td>${u.role}</td>
        <td>${u.active ? "Active" : "Deactivated"}</td>
        <td>
          ${
            u.id !== currentUser.id
              ? `<button type="button" class="btn-outline-sm" data-toggle-user="${u.id}">
                  ${u.active ? "Deactivate" : "Reactivate"}
                </button>`
              : '<span class="muted-text">Current</span>'
          }
        </td>
      </tr>`,
    )
    .join("");

  document.querySelectorAll("[data-toggle-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetUser = state.users.find(
        (u) => u.id === btn.dataset.toggleUser,
      );
      if (!targetUser) return;
      targetUser.active = !targetUser.active;
      logActivity(
        currentUser.fullName,
        `${targetUser.active ? "Reactivated" : "Deactivated"} user account ${targetUser.email}`,
      );
      saveState();
      renderAdminDashboard();
      showToast(
        `Account ${targetUser.active ? "reactivated" : "deactivated"}.`,
      );
    });
  });

  document.getElementById("admin-logs-list").innerHTML = state.activityLogs
    .slice(0, 15)
    .map(
      (l) => `
      <div class="log-entry">
        <strong>${escapeHtml(l.actor)}</strong>: ${escapeHtml(l.action)}
        <div class="muted-text">${l.timestamp}</div>
      </div>`,
    )
    .join("");
}

function updateBadges() {
  if (!currentUser) return;
  const unreadCount = state.notifications.filter(
    (n) => n.recipientId === currentUser.id && !n.read,
  ).length;
  const pendingCount = state.claims.filter(
    (c) => c.status === "Pending",
  ).length;

  document.getElementById("notif-badge").textContent = unreadCount;
  document.getElementById("pending-badge").textContent = pendingCount;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Offline / Online Detection (NFR-011)
window.addEventListener("offline", () => {
  document.getElementById("connectivity-banner").classList.remove("hidden");
});
window.addEventListener("online", () => {
  document.getElementById("connectivity-banner").classList.add("hidden");
});
