/**
 * HANAP — CSU Lost & Found Management System
 * Backend-Connected Domain Controller (Express + PostgreSQL API)
 */

const API_BASE = "http://localhost:5000/api";
let currentUser = null;
let activeModalReportId = null;

let state = {
  reports: [],
  claims: [],
  notifications: [],
  activityLogs: [],
};

async function initializeAppFromDB() {
  try {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error("Failed to fetch reports from backend");
    state.reports = await res.json();
    renderItemsDirectory();
  } catch (err) {
    console.error("Database connection error:", err);
    showToast(
      "Offline / Database connection error. Ensure your backend server is running.",
    );
    document.getElementById("connectivity-banner").classList.remove("hidden");
  }
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function setAuthenticatedUser(user) {
  currentUser = user;
  document.getElementById("landing-view").classList.add("hidden");
  document.getElementById("guest-nav").classList.add("hidden");
  document.getElementById("app-workspace").classList.remove("hidden");
  document.getElementById("auth-nav").classList.remove("hidden");

  document.getElementById("current-user-label").textContent =
    `${user.full_name || user.fullName} (${user.role})`;

  const isStaff =
    user.role === "Security Personnel" || user.role === "Administrator";
  const isAdmin = user.role === "Administrator";

  document
    .getElementById("nav-verify-tab")
    .classList.toggle("hidden", !isStaff);
  document.getElementById("nav-admin-tab").classList.toggle("hidden", !isAdmin);

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("rep-date").max = today;
  document.getElementById("prefill-contact-preview").textContent =
    `${user.email}${user.mobile ? " • " + user.mobile : ""}`;

  switchView("browse");
}

function logout() {
  currentUser = null;
  document.getElementById("app-workspace").classList.add("hidden");
  document.getElementById("auth-nav").classList.add("hidden");
  document.getElementById("landing-view").classList.remove("hidden");
  document.getElementById("guest-nav").classList.remove("hidden");
  showToast("You have been signed out.");
}

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

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  const email = document
    .getElementById("login-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || "Invalid email or password.";
      return;
    }

    setAuthenticatedUser(data);
    showToast(`Welcome back, ${data.full_name}!`);
  } catch (err) {
    errorEl.textContent = "Unable to connect to the backend server.";
  }
});

document.querySelectorAll("[data-demo-email]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const email = btn.dataset.demoEmail;
    document.getElementById("login-email").value = email;
    document.getElementById("login-password").value = "Password123";
    document.getElementById("login-form").dispatchEvent(new Event("submit"));
  });
});

document.getElementById("logout-btn").addEventListener("click", logout);

function switchView(viewName) {
  document
    .querySelectorAll(".app-view")
    .forEach((sec) => sec.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.remove("hidden");

  if (viewName === "browse") {
    initializeAppFromDB();
  } else if (viewName === "my-records") {
    loadUserRecords();
  } else if (viewName === "verify") {
    loadVerificationQueue();
  }
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
   Verification Queue & "Claim Pending" Section
   ========================================================================== */
async function loadVerificationQueue() {
  try {
    const [reportsRes, claimsRes] = await Promise.all([
      fetch(`${API_BASE}/reports`),
      fetch(`${API_BASE}/claims`),
    ]);

    if (!reportsRes.ok || !claimsRes.ok)
      throw new Error("Failed to fetch queue data");
    const reports = await reportsRes.json();
    const claims = await claimsRes.json();

    const container = document.getElementById("verification-list");
    container.innerHTML = "";
    document.getElementById("pending-badge").textContent = claims.length;

    // --- SECTION 1: CLAIM PENDING (Ownership Claims) ---
    const claimsHeader = document.createElement("h2");
    claimsHeader.className = "section-heading";
    claimsHeader.textContent = "Claim Pending (Submitted Claims)";
    container.appendChild(claimsHeader);

    if (claims.length === 0) {
      const p = document.createElement("p");
      p.className = "muted-text";
      p.style.marginBottom = "2rem";
      p.textContent = "No pending item claims at this time.";
      container.appendChild(p);
    } else {
      claims.forEach((claim) => {
        const el = document.createElement("div");
        el.className = "record-row";
        el.style.marginBottom = "0.75rem";
        el.innerHTML = `
          <div>
            <span class="type-tag">Item: ${escapeHtml(claim.item_name)} (${claim.item_report_id})</span>
            <strong>Claimant: ${escapeHtml(claim.claimant_name)} &bull; ${escapeHtml(claim.claimant_email)}</strong>
            <p class="item-meta">Proof of Ownership: "${escapeHtml(claim.proof_description)}"</p>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="status-badge status-Claim-Pending">${claim.status}</span>
            ${
              claim.status === "Pending"
                ? `
              <button type="button" class="btn-outline-sm" style="color: #2D4224; border-color: #2D4224;" data-approve-claim="${claim.claim_id}">Approve</button>
              <button type="button" class="btn-outline-sm" style="color: #9B3B33; border-color: #9B3B33;" data-reject-claim="${claim.claim_id}">Reject</button>
            `
                : ""
            }
          </div>
        `;
        container.appendChild(el);
      });
    }

    // --- SECTION 2: ALL REPORTS MANAGEMENT ---
    const reportsHeader = document.createElement("h2");
    reportsHeader.className = "section-heading mt-lg";
    reportsHeader.textContent = "All Active Reports & Management";
    container.appendChild(reportsHeader);

    reports.forEach((item) => {
      const itemID = item.report_id || item.id;
      const statusClass = `status-${item.status.replace(/\s+/g, "-")}`;
      const isAdmin = currentUser && currentUser.role === "Administrator";

      const el = document.createElement("div");
      el.className = "record-row";
      el.innerHTML = `
        <div>
          <span class="type-tag">${item.type} Item • ${item.category}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <p class="item-meta">${escapeHtml(item.location)} • ${item.date}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="status-badge ${statusClass}">${item.status}</span>
          <button type="button" class="btn-outline-sm" data-open-item="${itemID}">View Details</button>
          ${isAdmin ? `<button type="button" class="btn-outline-sm" style="color: #9B3B33; border-color: #9B3B33;" data-delete-report="${itemID}">Delete</button>` : ""}
        </div>
      `;
      container.appendChild(el);
    });

    // Attach click events for claims approval/rejection
    container.querySelectorAll("[data-approve-claim]").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateClaimStatus(btn.dataset.approveClaim, "Approved"),
      );
    });
    container.querySelectorAll("[data-reject-claim]").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateClaimStatus(btn.dataset.rejectClaim, "Rejected"),
      );
    });

    // Attach click events for reports
    container.querySelectorAll("[data-open-item]").forEach((btn) => {
      btn.addEventListener("click", () => openItemModal(btn.dataset.openItem));
    });

    container.querySelectorAll("[data-delete-report]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const reportIdToDelete = btn.dataset.deleteReport;
        if (
          confirm(`Are you sure you want to delete report ${reportIdToDelete}?`)
        ) {
          await deleteReport(reportIdToDelete);
          loadVerificationQueue();
        }
      });
    });
  } catch (err) {
    console.error("Error loading verification queue:", err);
    showToast("Error loading verification queue.");
  }
}

async function updateClaimStatus(claimId, status) {
  try {
    const res = await fetch(`${API_BASE}/claims/${claimId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update claim status");
    showToast(`Claim ${status.toLowerCase()} successfully.`);
    loadVerificationQueue();
  } catch (err) {
    console.error("Claim update error:", err);
    showToast("Error updating claim status.");
  }
}

async function loadUserRecords() {
  if (!currentUser) return;
  const userId = currentUser.user_id || currentUser.id;
  const isAdmin = currentUser.role === "Administrator";

  try {
    const res = await fetch(`${API_BASE}/reports/user/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch user reports");
    const userReports = await res.json();

    const container = document.getElementById("my-reports-list");
    container.innerHTML = "";

    if (userReports.length === 0) {
      container.innerHTML = `<p class="muted-text">You have not submitted any reports yet.</p>`;
      return;
    }

    userReports.forEach((item) => {
      const itemID = item.report_id || item.id;
      const statusClass = `status-${item.status.replace(/\s+/g, "-")}`;
      const el = document.createElement("div");
      el.className = "record-row";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p class="item-meta">${item.type} • ${item.category} • ${item.date}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="status-badge ${statusClass}">${item.status}</span>
          ${isAdmin || item.reporter_id == userId ? `<button type="button" class="btn-outline-sm" style="color: #9B3B33; border-color: #9B3B33;" data-delete-report="${itemID}">Delete</button>` : ""}
        </div>
      `;
      container.appendChild(el);
    });

    container.querySelectorAll("[data-delete-report]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const reportIdToDelete = btn.dataset.deleteReport;
        if (
          confirm(`Are you sure you want to delete report ${reportIdToDelete}?`)
        ) {
          await deleteReport(reportIdToDelete);
          loadUserRecords();
        }
      });
    });
  } catch (err) {
    console.error("Error loading user records:", err);
    showToast("Error loading your personal records.");
  }
}

async function deleteReport(reportId) {
  try {
    const res = await fetch(`${API_BASE}/reports/${reportId}`, {
      method: "DELETE",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete report");

    showToast(`Report ${reportId} deleted successfully.`);
    initializeAppFromDB();
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("Error deleting report from server.");
  }
}

function renderItemsDirectory() {
  const keyword = document
    .getElementById("filter-keyword")
    .value.trim()
    .toLowerCase();
  const type = document.getElementById("filter-type").value;
  const category = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;

  const filtered = state.reports.filter((item) => {
    if (status === "ALL" && item.status === "Closed") return false;
    if (status !== "ALL" && item.status !== status) return false;
    if (type !== "ALL" && item.type !== type) return false;
    if (category !== "ALL" && item.category !== category) return false;
    if (keyword) {
      const haystack =
        `${item.name} ${item.description} ${item.location} ${item.report_id || item.id}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  document.getElementById("results-count").textContent =
    `Showing ${filtered.length} matching ${filtered.length === 1 ? "item" : "items"}`;

  const grid = document.getElementById("items-grid");
  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="surface-card"><p class="muted-text">No matching items found in PostgreSQL database.</p></div>`;
    return;
  }

  filtered.forEach((item) => {
    const itemID = item.report_id || item.id;
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
        <span class="ref-code">${itemID}</span>
        <button type="button" class="btn-outline-sm" data-open-item="${itemID}">View Details</button>
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

  if (!name || !category || !location || !date || !description) {
    errorEl.textContent = "Please fill in all required fields marked with *.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name,
        category,
        description,
        location,
        date,
        custodyLocation,
        reporterId: currentUser.user_id || currentUser.id,
      }),
    });

    if (!res.ok) throw new Error("Failed to save report to database");

    const newReport = await res.json();
    showToast(`Report saved to PostgreSQL! ID: ${newReport.report_id}`);
    e.target.reset();
    document.getElementById("custody-group").classList.add("hidden");
    switchView("browse");
  } catch (err) {
    errorEl.textContent = "Error connecting to database server.";
  }
});

function openItemModal(reportId) {
  const item = state.reports.find((r) => (r.report_id || r.id) === reportId);
  if (!item) return;
  activeModalReportId = reportId;

  const badge = document.getElementById("modal-item-badge");
  badge.textContent = item.status;
  badge.className = `status-badge status-${item.status.replace(/\s+/g, "-")}`;

  document.getElementById("modal-item-ref").textContent =
    `${item.type.toUpperCase()} • ${item.report_id || item.id}`;
  document.getElementById("modal-item-title").textContent = item.name;
  document.getElementById("modal-item-meta").textContent =
    `${item.category} • ${item.location} • ${item.date}`;
  document.getElementById("modal-item-desc").textContent = item.description;

  const claimSection = document.getElementById("modal-claim-section");
  const isFoundOpen = item.type === "Found" && item.status === "Open";
  claimSection.classList.toggle("hidden", !isFoundOpen);

  document.getElementById("item-modal").classList.remove("hidden");
}

document.getElementById("close-modal-btn").addEventListener("click", () => {
  document.getElementById("item-modal").classList.add("hidden");
  activeModalReportId = null;
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document
  .getElementById("register-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("register-error");
    errorEl.textContent = "";

    const full_name = document.getElementById("reg-name").value.trim();
    const univ_id = document.getElementById("reg-univ-id").value.trim();
    const role = document.getElementById("reg-role").value;
    const email = document
      .getElementById("reg-email")
      .value.trim()
      .toLowerCase();
    const mobile = document.getElementById("reg-mobile").value.trim();
    const password = document.getElementById("reg-password").value;

    if (!full_name || !univ_id || !email || !password) {
      errorEl.textContent = "Please fill in all required fields.";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name,
          univ_id,
          email,
          mobile,
          role,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || "Registration and sign-up failed.";
        return;
      }

      showToast("Account created successfully! Please log in.");

      document.getElementById("register-card").classList.add("hidden");
      document.getElementById("login-card").classList.remove("hidden");

      document.getElementById("login-email").value = email;
      document.getElementById("login-password").value = "";
      document.getElementById("register-form").reset();
    } catch (err) {
      errorEl.textContent = "Unable to connect to the backend server.";
    }
  });

document.getElementById("claim-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const proofDescription = document
    .getElementById("claim-details")
    .value.trim();

  if (!proofDescription) {
    showToast("Please provide identifying details as proof of ownership.");
    return;
  }

  if (!activeModalReportId || !currentUser) {
    showToast("You must be logged in to submit a claim.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: activeModalReportId,
        claimantId: currentUser.user_id || currentUser.id,
        proofDescription,
      }),
    });

    if (!res.ok) throw new Error("Failed to submit claim");

    const newClaim = await res.json();
    showToast(`Claim submitted successfully! ID: ${newClaim.claim_id}`);

    document.getElementById("claim-form").reset();
    document.getElementById("item-modal").classList.add("hidden");
    activeModalReportId = null;

    initializeAppFromDB();
  } catch (err) {
    console.error("Claim submit error:", err);
    showToast("Error submitting claim to server.");
  }
});

window.addEventListener("DOMContentLoaded", () => {
  initializeAppFromDB();
});
