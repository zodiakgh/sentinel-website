const API = "https://status-api.sentineldashboard.site";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let currentEmail = "";
let currentSection = "overview";
let dashboardData = { monitors: [], incidents: [], statusPages: [], analytics: {} };
let modalKind = null;
let currentIncidentId = null;
let resendTimer = null;
const request = async (path, options = {}) => {
  const response = await fetch(API + path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed. Please try again.");
  return payload;
};
const toast = (message) => {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2800);
};
const showView = (view) => {
  $("#marketing-view")?.classList.toggle("hidden", view !== "marketing");
  $("#auth-view")?.classList.toggle("hidden", view !== "auth");
  $("#dashboard-view")?.classList.toggle("hidden", view !== "dashboard");
  $(".site-footer")?.classList.toggle("hidden", view === "dashboard");
  window.scrollTo({ top: 0, behavior: "instant" });
};
const openAuth = () => {
  showView("auth");
  $("#email-step").classList.remove("hidden");
  $("#code-step").classList.add("hidden");
  $("#auth-message").textContent = "";
  $("#email").focus();
};
const startResendCountdown = () => {
  const button = $("#resend-code");
  const counter = $("#resend-countdown");
  let remaining = 60;
  button.disabled = true;
  counter.textContent = "in 60s";
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    counter.textContent = remaining > 0 ? `in ${remaining}s` : "";
    if (remaining <= 0) {
      clearInterval(resendTimer);
      button.disabled = false;
    }
  }, 1000);
};
const setAuthMessage = (message, error = false) => {
  const node = $("#auth-message");
  node.textContent = message;
  node.style.color = error ? "#e3a3a3" : "#b8d8c1";
};
const requestCode = async () => {
  const email = $("#email").value.trim().toLowerCase();
  if (!email) return;
  currentEmail = email;
  const button = $("#email-form button");
  button.disabled = true;
  button.textContent = "Sending code…";
  try {
    await request("/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
    $("#email-destination").textContent = email;
    $("#email-step").classList.add("hidden");
    $("#code-step").classList.remove("hidden");
    $("#otp").value = "";
    $("#otp").focus();
    setAuthMessage("If the address can receive sign-in codes, an email is on its way.");
    startResendCountdown();
  } catch (error) {
    setAuthMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send login code <span>↗</span>';
  }
};
const verifyCode = async () => {
  const code = $("#otp").value.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) return setAuthMessage("Enter the 6-digit code.", true);
  const button = $("#code-form button");
  button.disabled = true;
  button.textContent = "Verifying…";
  try {
    await request("/auth/verify-code", { method: "POST", body: JSON.stringify({ email: currentEmail, code }) });
    await enterDashboard();
  } catch (error) {
    setAuthMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Verify and continue <span>↗</span>';
  }
};
const enterDashboard = async () => {
  showView("dashboard");
  await loadDashboard();
};
const logout = async () => {
  try { await request("/auth/logout", { method: "POST", body: "{}" }); } catch (_) {}
  dashboardData = { monitors: [], incidents: [], statusPages: [], analytics: {} };
  showView("marketing");
  window.location.hash = "";
  toast("You have been signed out.");
};
const navigate = (section) => {
  currentSection = section;
  $$(".app-section").forEach((el) => el.classList.toggle("active", el.id === `section-${section}`));
  $$(".app-nav button").forEach((el) => el.classList.toggle("active", el.dataset.section === section));
  $("#page-title").textContent = section.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  window.location.hash = "dashboard/" + section;
};
const fmtDate = (seconds) => {
  if (!seconds) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(seconds * 1000));
};
const fmtLatency = (ms) => ms == null ? "—" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const renderMonitors = () => {
  const monitors = dashboardData.monitors || [];
  $("#monitor-count").textContent = monitors.length;
  $("#metric-monitors").innerHTML = `${monitors.length} <small>/ 5</small>`;
  const up = monitors.filter((m) => m.last_status === "up").length;
  $("#metric-up").textContent = monitors.length ? `${Math.round(up / monitors.length * 100)}%` : "—";
  const body = $("#monitor-table");
  if (!monitors.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-empty">No monitors created yet. Add your first endpoint to begin.</td></tr>';
    $("#overview-monitors").innerHTML = '<span class="empty-symbol">⌁</span><b>No monitors yet</b><p>Add your first endpoint to start tracking uptime.</p><button class="button button-primary button-small" id="empty-add-monitor">Add your first monitor</button>';
    $("#empty-add-monitor")?.addEventListener("click", () => openModal("monitor"));
    return;
  }
  body.innerHTML = monitors.map((m) => `<tr><td><b>${escapeHtml(m.name)}</b><br><span class="muted-cell">${escapeHtml(m.url)}</span></td><td><span class="status-label ${m.last_status === "down" ? "down" : ""}">${m.last_status === "pending" ? "Pending first check" : m.last_status === "up" ? "Operational" : "Down"}</span></td><td>${fmtLatency(m.last_latency_ms)}</td><td>${Math.round(m.interval_seconds / 60)} min</td><td>${fmtDate(m.last_checked_at)}</td><td><button class="row-actions" data-delete-monitor="${m.id}" title="Delete monitor">•••</button></td></tr>`).join("");
  $("#overview-monitors").innerHTML = monitors.slice(0, 4).map((m) => `<div class="service-row"><span><i class="service-dot"></i>${escapeHtml(m.name)}</span><div></div><b class="${m.last_status === "down" ? "text-red" : ""}">${m.last_status === "pending" ? "Pending" : m.last_status === "up" ? "Up" : "Down"}</b></div>`).join("");
  $$("[data-delete-monitor]").forEach((button) => button.addEventListener("click", () => deleteMonitor(button.dataset.deleteMonitor)));
};
const renderIncidents = () => {
  const incidents = dashboardData.incidents || [];
  $("#metric-incidents").textContent = incidents.filter((i) => i.status !== "resolved").length;
  const html = incidents.length ? incidents.map((i) => `<article class="incident-card"><span class="incident-pill">${escapeHtml(i.status.toUpperCase())}</span><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.latest_message || "No public update yet.")}</p><div class="incident-meta">${fmtDate(i.created_at)} · ${escapeHtml(i.impact)} impact</div><button class="button button-quiet button-small" type="button" data-update-incident="${escapeHtml(i.id)}">Post update</button></article>`).join("") : '<div class="empty-state"><span class="empty-symbol">✓</span><b>No incidents recorded</b><p>When something goes wrong, you will see it here.</p></div>';
  $("#incident-list").innerHTML = html;
  $("#overview-incidents").innerHTML = incidents.length ? incidents.slice(0, 3).map((i) => `<div class="incident-card"><span class="incident-pill">${escapeHtml(i.status.toUpperCase())}</span><h3>${escapeHtml(i.title)}</h3><div class="incident-meta">${fmtDate(i.created_at)}</div></div>`).join("") : '<div class="empty-state compact"><span class="empty-symbol">✓</span><b>No incidents</b><p>You are all caught up.</p></div>';
};
const renderStatusPages = () => {
  const pages = dashboardData.statusPages || [];
  $("#metric-pages").innerHTML = `${pages.length} <small>/ 2</small>`;
  const target = $("#status-page-grid");
  target.innerHTML = pages.length ? pages.map((p) => `<article class="resource-card"><span class="integration-icon">▤</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description || "Public service status page.")}</p><a class="inline-link" href="/status/${encodeURIComponent(p.slug)}" target="_blank">Open public page ↗</a><p class="muted-cell">sentineldashboard.site/status/${escapeHtml(p.slug)}</p></article>`).join("") : '<div class="empty-state"><span class="empty-symbol">▤</span><b>No status pages yet</b><p>Publish your first public status page.</p><button class="button button-primary button-small" id="empty-create-page">Create status page</button></div>';
  $("#empty-create-page")?.addEventListener("click", () => openModal("status-page"));
};
const renderAnalytics = () => {
  const a = dashboardData.analytics || {};
  $("#analytics-checks").textContent = a.total_checks ?? 0;
  $("#analytics-failed").textContent = a.failed_checks ?? 0;
  $("#analytics-success").textContent = a.success_rate == null ? "—" : a.success_rate + "%";
  $("#analytics-latency").textContent = fmtLatency(a.avg_latency_ms);
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const loadDashboard = async () => {
  try {
    const data = await request("/api/overview");
    dashboardData = data;
    $("#user-email").textContent = data.user.email;
    $("#settings-email").textContent = data.user.email;
    $("#user-avatar").textContent = data.user.email.slice(0, 1).toUpperCase();
    $("#workspace-name").textContent = data.organization.name;
    $("#settings-workspace").textContent = data.organization.name;
    $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date());
    renderMonitors(); renderIncidents(); renderStatusPages(); renderAnalytics();
  } catch (error) {
    if (error.message.toLowerCase().includes("unauthorized")) { showView("marketing"); openAuth(); }
    else toast(error.message);
  }
};
const openModal = (kind) => {
  modalKind = kind;
  const fields = $("#modal-fields");
  $("#modal-error").textContent = "";
  $("#modal-backdrop").classList.remove("hidden");
  if (kind === "monitor") {
    $("#modal-eyebrow").textContent = "ENDPOINT MONITORING";
    $("#modal-title").textContent = "Add a monitor";
    $("#modal-description").textContent = "Sentinel will check this endpoint every five minutes.";
    $("#modal-submit").textContent = "Create monitor";
    fields.innerHTML = '<div class="modal-field"><label for="m-name">Monitor name</label><input id="m-name" name="name" placeholder="Production API" maxlength="80" required></div><div class="modal-field"><label for="m-url">Endpoint URL</label><input id="m-url" name="url" type="url" placeholder="https://api.example.com/health" required></div>';
  } else if (kind === "status-page") {
    $("#modal-eyebrow").textContent = "PUBLIC COMMUNICATION";
    $("#modal-title").textContent = "Create a status page";
    $("#modal-description").textContent = "Choose a name and a public URL slug.";
    $("#modal-submit").textContent = "Publish page";
    fields.innerHTML = '<div class="modal-field"><label for="p-name">Page name</label><input id="p-name" name="name" placeholder="Acme System Status" maxlength="80" required></div><div class="modal-field"><label for="p-slug">Public URL slug</label><input id="p-slug" name="slug" placeholder="acme-status" maxlength="48" pattern="[a-z0-9-]+" required></div><div class="modal-field"><label for="p-description">Description (optional)</label><textarea id="p-description" name="description" rows="2" placeholder="Current status of Acme services"></textarea></div>';
  } else if (kind === "incident") {
    $("#modal-eyebrow").textContent = "INCIDENT MANAGEMENT";
    $("#modal-title").textContent = "Report an incident";
    $("#modal-description").textContent = "Create an incident and publish an initial update.";
    $("#modal-submit").textContent = "Create incident";
    fields.innerHTML = '<div class="modal-field"><label for="i-title">Incident title</label><input id="i-title" name="title" placeholder="Elevated API latency" maxlength="120" required></div><div class="modal-field"><label for="i-impact">Impact</label><select id="i-impact" name="impact"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></div><div class="modal-field"><label for="i-message">Initial update</label><textarea id="i-message" name="message" rows="3" placeholder="We are investigating reports of an issue." required></textarea></div>';
  } else if (kind === "incident-update") {
    $("#modal-eyebrow").textContent = "INCIDENT MANAGEMENT";
    $("#modal-title").textContent = "Post an update";
    $("#modal-description").textContent = "Publish a new incident status and message.";
    $("#modal-submit").textContent = "Publish update";
    fields.innerHTML = '<div class="modal-field"><label for="iu-status">Incident status</label><select id="iu-status" name="status"><option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select></div><div class="modal-field"><label for="iu-message">Public update</label><textarea id="iu-message" name="message" rows="4" placeholder="Share what changed and what users should expect." maxlength="2000" required></textarea></div>';
  }
};
const closeModal = () => $("#modal-backdrop").classList.add("hidden");
const submitModal = async (event) => {
  event.preventDefault();
  const button = $("#modal-submit");
  button.disabled = true;
  button.textContent = "Saving…";
  const values = Object.fromEntries(new FormData($("#modal-form")).entries());
  try {
    if (modalKind === "monitor") {
      await request("/api/monitors", { method: "POST", body: JSON.stringify({ name: values.name, url: values.url, interval_seconds: 300 }) });
      toast("Monitor created. First check will run shortly.");
    } else if (modalKind === "status-page") {
      await request("/api/status-pages", { method: "POST", body: JSON.stringify(values) });
      toast("Your public status page has been created.");
    } else if (modalKind === "incident") {
      await request("/api/incidents", { method: "POST", body: JSON.stringify(values) });
      toast("Incident created.");
    }
    closeModal();
    await loadDashboard();
  } catch (error) {
    $("#modal-error").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = modalKind === "monitor" ? "Create monitor" : modalKind === "status-page" ? "Publish page" : modalKind === "incident-update" ? "Publish update" : "Create incident";
  }
};
const deleteMonitor = async (id) => {
  if (!confirm("Delete this monitor and its check history?")) return;
  try { await request("/api/monitors/" + encodeURIComponent(id), { method: "DELETE" }); toast("Monitor deleted."); await loadDashboard(); }
  catch (error) { toast(error.message); }
};
const loadPublicStatus = async (slug) => {
  showView("marketing");
  const marketing = $("#marketing-view");
  marketing.innerHTML = '<section class="public-status shell"><div class="eyebrow">PUBLIC STATUS PAGE</div><h1>Loading status…</h1></section>';
  try {
    const data = await request("/public/status/" + encodeURIComponent(slug));
    const status = data.overall_status;
    const rows = data.monitors.map((m) => `<div class="service-row"><span><i class="service-dot"></i>${escapeHtml(m.name)}</span><div class="uptime-bars" data-bars="35"></div><b>${m.last_status === "up" ? "Operational" : m.last_status === "down" ? "Degraded" : "Pending"}</b></div>`).join("");
    marketing.innerHTML = `<section class="public-status shell"><a class="brand" href="/"><span class="brand-mark">S</span><span class="brand-word">SENTINEL<span>STATUS</span></span></a><div class="public-status-card"><div class="eyebrow">SYSTEM STATUS</div><h1>${escapeHtml(data.page.name)}</h1><p>${escapeHtml(data.page.description || "Current service availability and incident updates.")}</p><div class="public-status-banner ${status === "operational" ? "good" : "bad"}"><b>${status === "operational" ? "✓ All systems operational" : "△ Service disruption detected"}</b><small>Last updated ${new Date().toLocaleString()}</small></div><h2>Service components</h2>${rows || "<p>No components have been published yet.</p>"}<h2>Recent incidents</h2>${data.incidents.length ? data.incidents.map((i) => `<article class="incident-card"><span class="incident-pill">${escapeHtml(i.status.toUpperCase())}</span><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.latest_message || "")}</p></article>`).join("") : "<p>No recent incidents.</p>"}</div><div class="public-powered">Powered by Sentinel Status · Free uptime monitoring</div></section>`;
  } catch (error) {
    marketing.innerHTML = `<section class="public-status shell"><a class="brand" href="/"><span class="brand-mark">S</span><span class="brand-word">SENTINEL<span>STATUS</span></span></a><h1>Status page unavailable</h1><p>${escapeHtml(error.message)}</p><a href="/" class="text-link">← Back to Sentinel Status</a></section>`;
  }
};
const initBars = () => $$(".uptime-bars:not([data-ready])").forEach((container) => { const count = Number(container.dataset.bars || 35); container.innerHTML = Array.from({ length: count }, () => "<i></i>").join(""); container.dataset.ready = "1"; });
document.addEventListener("DOMContentLoaded", async () => {
  initBars();
  ["#login-open", "#signup-open", "#hero-start", "#pricing-start"].forEach((selector) => $(selector)?.addEventListener("click", openAuth));
  $("#email-form").addEventListener("submit", (e) => { e.preventDefault(); requestCode(); });
  $("#code-form").addEventListener("submit", (e) => { e.preventDefault(); verifyCode(); });
  $("#back-email").addEventListener("click", () => { $("#code-step").classList.add("hidden"); $("#email-step").classList.remove("hidden"); $("#auth-message").textContent = ""; });
  $("#resend-code").addEventListener("click", async () => { try { await request("/auth/request-code", { method: "POST", body: JSON.stringify({ email: currentEmail }) }); setAuthMessage("A new code has been sent."); startResendCountdown(); } catch (e) { setAuthMessage(e.message, true); } });
  $("#otp").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
  $("#logout-button").addEventListener("click", logout);
  $$(".app-nav button[data-section]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.section)));
  $$("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  $("#add-monitor").addEventListener("click", () => openModal("monitor"));
  $("#top-add-monitor").addEventListener("click", () => openModal("monitor"));
  $("#empty-add-monitor")?.addEventListener("click", () => openModal("monitor"));
  $("#add-status-page").addEventListener("click", () => openModal("status-page"));
  $("#empty-create-page")?.addEventListener("click", () => openModal("status-page"));
  $("#quick-create-page").addEventListener("click", () => openModal("status-page"));
  $("#add-incident").addEventListener("click", () => openModal("incident"));\n  $("#incident-list").addEventListener("click", (event) => { const button = event.target.closest("[data-update-incident]"); if (button) openModal("incident-update", button.dataset.updateIncident); });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") closeModal(); });
  $("#modal-form").addEventListener("submit", submitModal);
  const path = window.location.pathname;
  if (path.startsWith("/status/")) { await loadPublicStatus(decodeURIComponent(path.slice(8).split("/")[0])); return; }
  if (path === "/dashboard" || path.startsWith("/dashboard/") || window.location.hash.startsWith("#dashboard")) {
    try { await request("/auth/me"); await enterDashboard(); const section = path.startsWith("/dashboard/") ? path.split("/")[2] : window.location.hash.split("/")[1]; if (section) navigate(section); return; } catch (_) {}
  }
  try { await request("/auth/me"); await enterDashboard(); } catch (_) { showView("marketing"); }
});