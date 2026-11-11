const COOKIE = "sentinel_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const OTP_SECONDS = 60 * 5;
const MAX_MONITORS = 5;
const MAX_STATUS_PAGES = 2;
const ALLOWED_ORIGINS = new Set(["https://sentineldashboard.site", "https://www.sentineldashboard.site", "http://localhost:5500", "http://127.0.0.1:5500"]);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
});
const now = () => Math.floor(Date.now() / 1000);
const id = () => crypto.randomUUID();
const enc = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const digest = async (value) => hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
const randomToken = (bytes = 32) => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};
const readJson = async (request) => {
  try { return await request.json(); } catch { throw new HttpError(400, "Invalid JSON body."); }
};
const corsHeaders = (request) => {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://sentineldashboard.site";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
};
const withCors = (response, request) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
const cookieValue = (request, name) => {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
};
const setSessionCookie = (token) => `${COOKIE}=${token}; Domain=.sentineldashboard.site; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
const clearSessionCookie = () => `${COOKIE}=; Domain=.sentineldashboard.site; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const emailValid = (email) => typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const slugify = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function rateLimit(env, key, max, windowSeconds) {
  const time = now();
  const row = await env.DB.prepare("SELECT window_started_at, request_count FROM auth_rate_limits WHERE rate_key = ?").bind(key).first();
  if (row && time - row.window_started_at < windowSeconds && row.request_count >= max) throw new HttpError(429, "Too many attempts. Please wait before trying again.");
  if (!row || time - row.window_started_at >= windowSeconds) {
    await env.DB.prepare("INSERT INTO auth_rate_limits (rate_key, window_started_at, request_count) VALUES (?, ?, 1) ON CONFLICT(rate_key) DO UPDATE SET window_started_at=excluded.window_started_at, request_count=1").bind(key, time).run();
  } else {
    await env.DB.prepare("UPDATE auth_rate_limits SET request_count = request_count + 1 WHERE rate_key = ?").bind(key).run();
  }
}
async function sendOtp(env, email, code) {
  if (!env.RESEND_API_KEY) throw new HttpError(503, "Email delivery is not configured yet.");
  const html = `<!doctype html><html><body style="margin:0;background:#08090b;color:#f1f3f6;font-family:Arial,sans-serif;padding:32px"><div style="max-width:480px;margin:auto;border:1px solid #303844;border-radius:12px;padding:28px;background:#101319"><p style="font-size:11px;letter-spacing:3px;color:#aab4c0;font-weight:bold">SENTINEL STATUS</p><h1 style="font-size:24px;margin:28px 0 8px">Your sign-in code</h1><p style="font-size:14px;line-height:1.6;color:#aab3bd">Use this one-time code to securely access your Sentinel Status workspace.</p><div style="margin:28px 0;padding:18px;text-align:center;background:#080b10;border:1px solid #303844;border-radius:8px;font:700 32px monospace;letter-spacing:10px;color:#fff">${code}</div><p style="font-size:12px;color:#aab3bd">This code expires in 5 minutes and can only be used once.</p><p style="font-size:11px;color:#707b88;margin-top:28px">If you did not request this code, you can safely ignore this email.</p></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Sentinel Status <login@sentineldashboard.site>",
      to: [email],
      subject: "Your Sentinel Status sign-in code",
      html,
      text: `Your Sentinel Status sign-in code is ${code}. It expires in 5 minutes. If you did not request it, ignore this email.`
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Resend delivery failed", response.status, detail.slice(0, 300));
    throw new HttpError(502, "We could not send your sign-in email. Please try again shortly.");
  }
}
async function userSession(request, env) {
  const token = cookieValue(request, COOKIE);
  if (!token) throw new HttpError(401, "Unauthorized.");
  const tokenHash = await digest(token);
  const row = await env.DB.prepare("SELECT s.id AS session_id, s.user_id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash, now()).first();
  if (!row) throw new HttpError(401, "Unauthorized.");
  await env.DB.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").bind(now(), row.session_id).run();
  const membership = await env.DB.prepare("SELECT o.id AS organization_id,o.name,o.slug,m.role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? ORDER BY m.created_at LIMIT 1").bind(row.user_id).first();
  if (!membership) throw new HttpError(403, "No workspace is associated with this account.");
  return { id: row.user_id, email: row.email, organization: membership };
}
function validateMonitorUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new HttpError(400, "Enter a valid endpoint URL."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new HttpError(400, "Only HTTP and HTTPS endpoints are supported.");
  if (url.username || url.password) throw new HttpError(400, "URLs containing credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new HttpError(400, "Only standard HTTP and HTTPS ports are allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test")) {
    throw new HttpError(400, "Local and internal hostnames cannot be monitored.");
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    if (parts.some((n) => n > 255) || parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || parts[0] >= 224 ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)) throw new HttpError(400, "Private or reserved IP addresses cannot be monitored.");
    throw new HttpError(400, "Use a public hostname instead of an IP address.");
  }
  if (host.includes(":")) throw new HttpError(400, "IP address targets are not supported. Use a public hostname.");
  url.hash = "";
  return url.toString();
}
async function getOverview(user, env) {
  const orgId = user.organization.organization_id;
  const [monitors, incidents, statusPages, analytics] = await Promise.all([
    env.DB.prepare("SELECT id,name,url,interval_seconds,enabled,last_checked_at,next_check_at,last_status,last_status_code,last_latency_ms,created_at FROM monitors WHERE organization_id=? ORDER BY created_at DESC").bind(orgId).all(),
    env.DB.prepare("SELECT i.id,i.title,i.impact,i.status,i.created_at,i.updated_at,i.resolved_at,(SELECT message FROM incident_updates u WHERE u.incident_id=i.id ORDER BY created_at DESC LIMIT 1) AS latest_message FROM incidents i WHERE i.organization_id=? ORDER BY i.created_at DESC LIMIT 20").bind(orgId).all(),
    env.DB.prepare("SELECT id,name,slug,description,is_public,created_at FROM status_pages WHERE organization_id=? ORDER BY created_at DESC").bind(orgId).all(),
    env.DB.prepare("SELECT COUNT(*) AS total_checks,SUM(CASE WHEN status='down' THEN 1 ELSE 0 END) AS failed_checks,AVG(latency_ms) AS avg_latency_ms FROM monitor_checks c JOIN monitors m ON m.id=c.monitor_id WHERE m.organization_id=? AND c.checked_at>?").bind(orgId, now() - 30 * 86400).first()
  ]);
  const total = analytics?.total_checks || 0;
  const failed = analytics?.failed_checks || 0;
  return {
    user: { id: user.id, email: user.email },
    organization: { id: orgId, name: user.organization.name, slug: user.organization.slug, role: user.organization.role },
    monitors: monitors.results || [],
    incidents: incidents.results || [],
    statusPages: statusPages.results || [],
    analytics: { total_checks: total, failed_checks: failed, avg_latency_ms: analytics?.avg_latency_ms == null ? null : Math.round(analytics.avg_latency_ms), success_rate: total ? Math.round((total - failed) / total * 10000) / 100 : null }
  };
}
async function requestOtp(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  if (!emailValid(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!env.AUTH_PEPPER) throw new HttpError(503, "Authentication security is not configured yet.");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  await rateLimit(env, await digest("email:" + email), 3, 3600);
  await rateLimit(env, await digest("ip:" + ip), 10, 3600);
  const digits = new Uint32Array(1); crypto.getRandomValues(digits);
  const code = String(digits[0] % 1000000).padStart(6, "0");
  const codeHash = await digest(env.AUTH_PEPPER + ":" + email + ":" + code);
  const challengeId = id();
  const time = now();
  await env.DB.prepare("DELETE FROM auth_codes WHERE email=?").bind(email).run();
  await env.DB.prepare("INSERT INTO auth_codes (id,email,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,0,?)").bind(challengeId, email, codeHash, time + OTP_SECONDS, time).run();
  try { await sendOtp(env, email, code); }
  catch (error) { await env.DB.prepare("DELETE FROM auth_codes WHERE id=?").bind(challengeId).run(); throw error; }
  return json({ ok: true, expires_in: OTP_SECONDS, resend_after: 60 });
}
async function verifyOtp(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").replace(/\D/g, "");
  if (!emailValid(email) || !/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the email address and 6-digit code.");
  if (!env.AUTH_PEPPER) throw new HttpError(503, "Authentication security is not configured yet.");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  await rateLimit(env, await digest("verify-email:" + email), 8, 900);
  await rateLimit(env, await digest("verify-ip:" + ip), 20, 900);
  const challenge = await env.DB.prepare("SELECT id,code_hash,expires_at,attempts FROM auth_codes WHERE email=? ORDER BY created_at DESC LIMIT 1").bind(email).first();
  if (!challenge || challenge.expires_at <= now()) throw new HttpError(400, "That code has expired. Request a new one.");
  if (challenge.attempts >= 5) throw new HttpError(429, "Too many incorrect attempts. Request a new code.");
  const candidate = await digest(env.AUTH_PEPPER + ":" + email + ":" + code);
  if (!safeEqual(candidate, challenge.code_hash)) {
    await env.DB.prepare("UPDATE auth_codes SET attempts=attempts+1 WHERE id=? AND attempts<5").bind(challenge.id).run();
    throw new HttpError(400, "That code is incorrect. Check your email and try again.");
  }
  const consumed = await env.DB.prepare("DELETE FROM auth_codes WHERE id=? AND expires_at>? AND attempts<5 AND code_hash=?").bind(challenge.id, now(), candidate).run();
  if (!consumed.meta?.changes) throw new HttpError(400, "That code has already been used or expired. Request a new one.");
  const time = now();
  let user = await env.DB.prepare("SELECT id,email FROM users WHERE email=?").bind(email).first();
  if (!user) {
    const userId = id();
    await env.DB.prepare("INSERT INTO users (id,email,created_at,last_login_at) VALUES (?,?,?,?)").bind(userId, email, time, time).run();
    user = { id: userId, email };
    const orgId = id();
    const slug = "workspace-" + userId.slice(0, 8);
    await env.DB.prepare("INSERT INTO organizations (id,name,slug,owner_id,created_at) VALUES (?,?,?,?,?)").bind(orgId, "My workspace", slug, userId, time).run();
    await env.DB.prepare("INSERT INTO memberships (organization_id,user_id,role,created_at) VALUES (?,?,?,?)").bind(orgId, userId, "owner", time).run();
  } else {
    await env.DB.prepare("UPDATE users SET last_login_at=? WHERE id=?").bind(time, user.id).run();
  }
  const token = randomToken(32);
  const tokenHash = await digest(token);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_codes WHERE email=?").bind(email),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(time),
    env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)").bind(id(), user.id, tokenHash, time + SESSION_SECONDS, time, time)
  ]);
  return json({ ok: true, user: { id: user.id, email: user.email } }, 200, { "Set-Cookie": setSessionCookie(token) });
}
async function createMonitor(user, env, request) {
  const body = await readJson(request);
  const name = String(body.name || "").trim().slice(0, 80);
  if (!name) throw new HttpError(400, "A monitor name is required.");
  const url = validateMonitorUrl(body.url);
  const orgId = user.organization.organization_id;
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM monitors WHERE organization_id=?").bind(orgId).first();
  if ((count?.count || 0) >= MAX_MONITORS) throw new HttpError(403, "Your free workspace includes up to 5 monitors.");
  const monitorId = id();
  const time = now();
  await env.DB.prepare("INSERT INTO monitors (id,organization_id,name,url,method,interval_seconds,timeout_ms,expected_status_min,expected_status_max,enabled,next_check_at,last_status,created_at) VALUES (?,?,?,?, 'GET',300,10000,200,399,1,?,'pending',?)").bind(monitorId, orgId, name, url, time + 3, time).run();
  const pages = await env.DB.prepare("SELECT id FROM status_pages WHERE organization_id=?").bind(orgId).all();
  if (pages.results?.length) await env.DB.batch(pages.results.map((page) => env.DB.prepare("INSERT OR IGNORE INTO status_page_monitors (status_page_id,monitor_id) VALUES (?,?)").bind(page.id, monitorId)));
  return json({ ok: true, id: monitorId }, 201);
}
async function createStatusPage(user, env, request) {
  const body = await readJson(request);
  const name = String(body.name || "").trim().slice(0, 80);
  const slug = slugify(body.slug || name);
  const description = String(body.description || "").trim().slice(0, 240);
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "Enter a page name and a valid URL slug.");
  const orgId = user.organization.organization_id;
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM status_pages WHERE organization_id=?").bind(orgId).first();
  if ((count?.count || 0) >= MAX_STATUS_PAGES) throw new HttpError(403, "Your free workspace includes up to 2 public status pages.");
  const pageId = id();
  const time = now();
  try {
    await env.DB.prepare("INSERT INTO status_pages (id,organization_id,name,slug,description,is_public,created_at) VALUES (?,?,?,?,?,1,?)").bind(pageId, orgId, name, slug, description, time).run();
  } catch (error) { throw new HttpError(409, "That status page URL is already in use."); }
  const monitors = await env.DB.prepare("SELECT id FROM monitors WHERE organization_id=?").bind(orgId).all();
  if (monitors.results?.length) await env.DB.batch(monitors.results.map((monitor) => env.DB.prepare("INSERT INTO status_page_monitors (status_page_id,monitor_id) VALUES (?,?)").bind(pageId, monitor.id)));
  return json({ ok: true, id: pageId, slug }, 201);
}
async function createIncident(user, env, request) {
  const body = await readJson(request);
  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 2000);
  const impact = ["minor", "major", "critical"].includes(body.impact) ? body.impact : "minor";
  if (!title || !message) throw new HttpError(400, "An incident title and initial update are required.");
  const incidentId = id();
  const time = now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO incidents (id,organization_id,title,impact,status,created_at,updated_at) VALUES (?,?,?,?,'investigating',?,?)").bind(incidentId, user.organization.organization_id, title, impact, time, time),
    env.DB.prepare("INSERT INTO incident_updates (id,incident_id,status,message,created_at) VALUES (?,?,'investigating',?,?)").bind(id(), incidentId, message, time)
  ]);
  return json({ ok: true, id: incidentId }, 201);
}
async function publicStatus(env, slug) {
  const page = await env.DB.prepare("SELECT id,name,slug,description,created_at FROM status_pages WHERE slug=? AND is_public=1").bind(slug).first();
  if (!page) throw new HttpError(404, "Status page not found.");
  const [monitors, incidents] = await Promise.all([
    env.DB.prepare("SELECT m.id,m.name,m.last_status,m.last_checked_at,m.last_status_code,m.last_latency_ms FROM status_page_monitors spm JOIN monitors m ON m.id=spm.monitor_id WHERE spm.status_page_id=? ORDER BY m.name").bind(page.id).all(),
    env.DB.prepare("SELECT i.id,i.title,i.impact,i.status,i.created_at,i.updated_at,(SELECT message FROM incident_updates u WHERE u.incident_id=i.id ORDER BY created_at DESC LIMIT 1) AS latest_message FROM incidents i WHERE i.organization_id=(SELECT organization_id FROM status_pages WHERE id=?) AND i.created_at>? ORDER BY i.created_at DESC LIMIT 20").bind(page.id, now() - 90 * 86400).all()
  ]);
  const list = monitors.results || [];
  const overall = list.length === 0 ? "pending" : list.some((m) => m.last_status === "down") ? "degraded" : list.every((m) => m.last_status === "up") ? "operational" : "pending";
  return json({ page, overall_status: overall, monitors: list, incidents: incidents.results || [] }, 200, { "Cache-Control": "public, max-age=30, s-maxage=30" });
}
async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (path === "/health" && request.method === "GET") return json({ ok: true, service: "sentinel-status-api", version: "0.1.0" });
  if (path === "/auth/request-code" && request.method === "POST") return await requestOtp(request, env);
  if (path === "/auth/verify-code" && request.method === "POST") return await verifyOtp(request, env);
  if (path === "/auth/logout" && request.method === "POST") {
    const token = cookieValue(request, COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }
  const publicMatch = path.match(/^\/public\/status\/([a-z0-9-]+)$/);
  if (publicMatch && request.method === "GET") return await publicStatus(env, publicMatch[1]);
  const user = await userSession(request, env);
  if (path === "/auth/me" && request.method === "GET") return json({ user: { id: user.id, email: user.email }, organization: user.organization });
  if (path === "/api/overview" && request.method === "GET") return json(await getOverview(user, env));
  if (path === "/api/monitors" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM monitors WHERE organization_id=? ORDER BY created_at DESC").bind(user.organization.organization_id).all();
    return json({ monitors: rows.results || [] });
  }
  if (path === "/api/monitors" && request.method === "POST") return await createMonitor(user, env, request);
  const deleteMatch = path.match(/^\/api\/monitors\/([0-9a-f-]+)$/i);
  if (deleteMatch && request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM monitors WHERE id=? AND organization_id=?").bind(deleteMatch[1], user.organization.organization_id).run();
    if (!result.meta?.changes) throw new HttpError(404, "Monitor not found.");
    return json({ ok: true });
  }
  if (path === "/api/status-pages" && request.method === "POST") return await createStatusPage(user, env, request);
  if (path === "/api/incidents" && request.method === "POST") return await createIncident(user, env, request);
  return json({ error: "Not found." }, 404);
}
async function checkMonitor(env, monitor) {
  const checkedAt = now();
  const started = Date.now();
  let status = "down", statusCode = null, latency = null, error = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), Math.min(Math.max(monitor.timeout_ms || 10000, 1000), 15000));
    const response = await fetch(monitor.url, { method: "GET", redirect: "manual", signal: controller.signal, headers: { "User-Agent": "SentinelStatus-Monitor/0.1 (+https://sentineldashboard.site)" } });
    clearTimeout(timeout);
    statusCode = response.status;
    latency = Date.now() - started;
    status = statusCode >= monitor.expected_status_min && statusCode <= monitor.expected_status_max ? "up" : "down";
    if (status === "down") error = "Unexpected HTTP status " + statusCode;
    try { await response.body?.cancel(); } catch (_) {}
  } catch (err) {
    latency = Date.now() - started;
    error = err?.name === "AbortError" ? "Request timed out" : String(err?.message || "Network error").slice(0, 180);
  }
  const checkId = id();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO monitor_checks (id,monitor_id,status,status_code,latency_ms,error,checked_at) VALUES (?,?,?,?,?,?,?)").bind(checkId, monitor.id, status, statusCode, latency, error, checkedAt),
    env.DB.prepare("UPDATE monitors SET last_checked_at=?,next_check_at=?,last_status=?,last_status_code=?,last_latency_ms=? WHERE id=?").bind(checkedAt, checkedAt + monitor.interval_seconds, status, statusCode, latency, monitor.id)
  ]);
  const recent = await env.DB.prepare("SELECT status FROM monitor_checks WHERE monitor_id=? ORDER BY checked_at DESC LIMIT 2").bind(monitor.id).all();
  const twoDown = recent.results?.length === 2 && recent.results.every((row) => row.status === "down");
  const open = await env.DB.prepare("SELECT id FROM incidents WHERE monitor_id=? AND resolved_at IS NULL LIMIT 1").bind(monitor.id).first();
  if (twoDown && !open) {
    const incidentId = id();
    const time = now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO incidents (id,organization_id,monitor_id,title,impact,status,created_at,updated_at) VALUES (?,?,?,?,'major','investigating',?,?)").bind(incidentId, monitor.organization_id, monitor.id, "Monitor unavailable: " + monitor.name, time, time),
      env.DB.prepare("INSERT INTO incident_updates (id,incident_id,status,message,created_at) VALUES (?,?,'investigating',?,?)").bind(id(), incidentId, "Automated monitoring detected two consecutive failed checks.", time)
    ]);
  } else if (status === "up" && open) {
    const time = now();
    await env.DB.batch([
      env.DB.prepare("UPDATE incidents SET status='resolved',resolved_at=?,updated_at=? WHERE id=?").bind(time, time, open.id),
      env.DB.prepare("INSERT INTO incident_updates (id,incident_id,status,message,created_at) VALUES (?,?,'resolved',?,?)").bind(id(), open.id, "The monitor is responding normally again. The incident was automatically resolved.", time)
    ]);
  }
}
async function runScheduled(env) {
  const time = now();
  const due = await env.DB.prepare("SELECT id,organization_id,name,url,interval_seconds,timeout_ms,expected_status_min,expected_status_max FROM monitors WHERE enabled=1 AND next_check_at<=? ORDER BY next_check_at LIMIT 20").bind(time).all();
  for (const monitor of due.results || []) {
    try { await checkMonitor(env, monitor); }
    catch (error) { console.error("Monitor check failed", monitor.id, error); }
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM monitor_checks WHERE checked_at<?").bind(time - 30 * 86400),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(time),
    env.DB.prepare("DELETE FROM auth_codes WHERE expires_at<=?").bind(time),
    env.DB.prepare("DELETE FROM auth_rate_limits WHERE window_started_at<?").bind(time - 86400)
  ]);
}
export default {
  async fetch(request, env, ctx) {
    let response;
    try { response = await handleApi(request, env); }
    catch (error) {
      console.error("Request error", error);
      response = json({ error: error instanceof HttpError ? error.message : "An unexpected server error occurred." }, error instanceof HttpError ? error.status : 500);
    }
    return withCors(response, request);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  }
};