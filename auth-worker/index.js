const DISCORD = "https://discord.com/api/v10";
const SESSION_TTL = 60 * 60 * 24;
const STATE_TTL = 600;
const MANAGE_GUILD = 0x20n, ADMINISTRATOR = 0x8n;
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookies(req) {
  const out = {};
  (req.headers.get("Cookie") || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
const cookie = (name, value, { maxAge, path = "/" } = {}) => `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
function allowedSiteOrigin(env, origin) {
  if (!origin || !env.SITE_ORIGIN) return false;
  let configured, incoming;
  try {
    configured = new URL(env.SITE_ORIGIN);
    incoming = new URL(origin);
  } catch (_) {
    return false;
  }
  if (incoming.protocol !== "https:" || configured.protocol !== "https:") return false;
  const root = configured.hostname.startsWith("www.") ? configured.hostname.slice(4) : configured.hostname;
  const hosts = new Set([root, `www.${root}`, `support.${root}`]);
  return incoming.origin === origin && hosts.has(incoming.hostname) && incoming.port === configured.port;
}
function cors(env, req, extra = {}) {
  const h = { "Vary": "Origin", "Cache-Control": "no-store", ...extra };
  const origin = req.headers.get("Origin");
  if (allowedSiteOrigin(env, origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Credentials"] = "true";
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Accept";
  }
  return h;
}
const json = (env, req, body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: cors(env, req, { "Content-Type": "application/json", ...extra }) });
const back = (env, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/dashboard?auth=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};
async function dget(path, auth) {
  const r = await fetch(DISCORD + path, { headers: { Authorization: auth, "User-Agent": "SentinelAuth (https://sentineldashboard.site, 1.0)" } });
  if (!r.ok) throw new Error(`discord ${path} ${r.status}`);
  return r.json();
}
async function botGuildIds(env) {
  if (!env.BOT_TOKEN) return null;
  const ids = new Set();
  let after = "";
  for (let page = 0; page < 10; page++) {
    const list = await dget(`/users/@me/guilds?limit=200${after ? "&after=" + after : ""}`, `Bot ${env.BOT_TOKEN}`);
    list.forEach((g) => ids.add(g.id));
    if (list.length < 200) break;
    after = list[list.length - 1].id;
  }
  return ids;
}
async function exchange(env, code) {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: `${env.API_ORIGIN}/auth/callback`
  });
  const r = await fetch(`${DISCORD}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("token exchange " + r.status);
  return r.json();
}
async function revoke(env, token) {
  try {
    await fetch(`${DISCORD}/oauth2/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, token })
    });
  } catch (_) {
  }
}
const ACCOUNT_TTL = 60 * 60 * 24 * 30;
const VERIFY_CODE_TTL = 10 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function digest(value) {
  const out = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(out)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function accountKey(email) {
  return `a:${await digest(email.trim().toLowerCase())}`;
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltB64 = salt.replace(/-/g, "+").replace(/_/g, "/");
  const saltBytes = Uint8Array.from(atob(saltB64 + "=".repeat((4 - saltB64.length % 4) % 4)), (c) => c.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 1e5, hash: "SHA-256" }, key, 256);
  return b64url(bits);
}
function originOK(env, req) {
  return allowedSiteOrigin(env, req.headers.get("Origin"));
}
async function readBody(req) {
  const len = Number(req.headers.get("Content-Length") || 0);
  if (len > 24e3) throw new Error("too_large");
  const b = await req.json();
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("bad_body");
  return b;
}
async function sendVerification(env, email, code) {
  if (!env.RESEND_API_KEY) throw new Error("email_not_configured");
  const from = env.ACCOUNT_EMAIL_FROM || "Sentinel <noreply@sentineldashboard.site>";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({
    from,
    to: [email],
    subject: "Your Sentinel verification code",
    text: `Your Sentinel verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;background:#0b1020;color:#f4f7ff;padding:32px;border-radius:16px"><h1 style="margin:0 0 12px">Sentinel</h1><p>Use this code to verify your email address:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 0">${code}</div><p>This code expires in 10 minutes. If you did not request it, ignore this message.</p></div>`
  }) });
  if (!response.ok) throw new Error("email_send_failed");
}
async function accountRegister(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
  if (!EMAIL_RE.test(email) || email.length > 254 || password.length < 10 || password.length > 128) return json(env, req, { error: "invalid_input", message: "Use a valid email and a password of 10–128 characters." }, 400);
  const key = await accountKey(email);
  if (await env.SESSIONS.get(key)) return json(env, req, { error: "account_exists" }, 409);
  const rateKey = `rl:reg:${await digest((req.headers.get("CF-Connecting-IP") || "unknown") + ":" + email)}`;
  if (await env.SESSIONS.get(rateKey)) return json(env, req, { error: "rate_limited" }, 429);
  await env.SESSIONS.put(rateKey, "1", { expirationTtl: 60 });
  const salt = rand(16), code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, "0");
  const account = { email, salt, passwordHash: await passwordHash(password, salt), verified: false, created: Date.now(), discord: null };
  await env.SESSIONS.put(key, JSON.stringify(account), { expirationTtl: VERIFY_CODE_TTL });
  await env.SESSIONS.put(`ev:${await digest(email)}`, JSON.stringify({ codeHash: await digest(code), attempts: 0, accountKey: key }), { expirationTtl: VERIFY_CODE_TTL });
  try {
    await sendVerification(env, email, code);
  } catch (_) {
    await env.SESSIONS.delete(key);
    await env.SESSIONS.delete(`ev:${await digest(email)}`);
    return json(env, req, { error: "email_send_failed", message: "Email could not be sent. Please try again later." }, 502);
  }
  return json(env, req, { ok: true, needsVerification: true });
}
async function accountVerify(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const email = String(b.email || "").trim().toLowerCase(), code = String(b.code || "").trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return json(env, req, { error: "invalid_code" }, 400);
  const vh = `ev:${await digest(email)}`, raw = await env.SESSIONS.get(vh);
  if (!raw) return json(env, req, { error: "code_expired" }, 400);
  const v = JSON.parse(raw);
  if (v.attempts >= 5) {
    await env.SESSIONS.delete(vh);
    return json(env, req, { error: "too_many_attempts" }, 429);
  }
  if (!safeEqual(v.codeHash, await digest(code))) {
    v.attempts++;
    await env.SESSIONS.put(vh, JSON.stringify(v), { expirationTtl: VERIFY_CODE_TTL });
    return json(env, req, { error: "invalid_code" }, 400);
  }
  const account = JSON.parse(await env.SESSIONS.get(v.accountKey) || "null");
  if (!account || account.email !== email) return json(env, req, { error: "account_not_found" }, 400);
  account.verified = true;
  await env.SESSIONS.put(v.accountKey, JSON.stringify(account));
  await env.SESSIONS.delete(vh);
  return json(env, req, { ok: true });
}
async function accountLogin(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
  if (!EMAIL_RE.test(email) || password.length > 128) return json(env, req, { error: "invalid_credentials" }, 401);
  const rateKey = `rl:login:${await digest((req.headers.get("CF-Connecting-IP") || "unknown") + ":" + email)}`;
  const attempts = Number(await env.SESSIONS.get(rateKey) || "0");
  if (attempts >= 10) return json(env, req, { error: "rate_limited" }, 429);
  const key = await accountKey(email), raw = await env.SESSIONS.get(key), account = raw ? JSON.parse(raw) : null;
  if (!account || !safeEqual(account.passwordHash || "", await passwordHash(password, account.salt || rand(16)))) {
    await env.SESSIONS.put(rateKey, String(attempts + 1), { expirationTtl: 15 * 60 });
    return json(env, req, { error: "invalid_credentials" }, 401);
  }
  await env.SESSIONS.delete(rateKey);
  if (!account.verified) return json(env, req, { error: "email_not_verified" }, 403);
  const sid = rand(32);
  await env.SESSIONS.put(`s:${sid}`, JSON.stringify({ accountEmail: email, created: Date.now() }), { expirationTtl: SESSION_TTL });
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_session", sid, { maxAge: SESSION_TTL }) });
}
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const maskPhone = (p) => p.slice(0, 3) + " " + "•".repeat(Math.max(2, p.length - 7)) + " " + p.slice(-2);
function phoneEnabled(env) { return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SID); }
function twilio(env, path, params) {
  return fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/${path}`, { method: "POST",
    headers: { Authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
}
async function phoneRate(env, key, limit, ttl) {
  const n = Number(await env.SESSIONS.get(key) || "0"); if (n >= limit) return false;
  await env.SESSIONS.put(key, String(n + 1), { expirationTtl: ttl }); return true;
}
async function phoneStatus(env, req) { return json(env, req, { enabled: phoneEnabled(env) }, 200, { "Cache-Control": "no-store" }); }
async function phoneBody(env, req) {
  if (!originOK(env, req)) return { err: json(env, req, { error: "forbidden" }, 403) };
  if (!phoneEnabled(env)) return { err: json(env, req, { error: "phone_unavailable", message: "Phone sign-in isn't available yet." }, 503) };
  let b; try { b = await readBody(req); } catch (_) { return { err: json(env, req, { error: "bad_request" }, 400) }; }
  const phone = String(b.phone || "").replace(/[\s().-]/g, "");
  if (!PHONE_RE.test(phone)) return { err: json(env, req, { error: "invalid_phone", message: "Enter your number with the country code, like +33 6 12 34 56 78." }, 400) };
  const allow = String(env.PHONE_ALLOWED_PREFIXES || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (allow.length && !allow.some((x) => phone.startsWith(x))) return { err: json(env, req, { error: "country_not_supported", message: "Phone sign-in isn't available for this country yet." }, 400) };
  return { b, phone };
}
async function phoneStart(env, req) {
  const r = await phoneBody(env, req); if (r.err) return r.err;
  const ip = req.headers.get("CF-Connecting-IP") || "unknown", day = new Date().toISOString().slice(0, 10), pd = await digest(r.phone);
  if (env.TURNSTILE_SECRET && env.PHONE_TURNSTILE === "1") {
    const t = String(r.b.turnstile || ""); let ok = false;
    if (t) { const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t, remoteip: ip }) }); ok = v.ok && (await v.json()).success === true; }
    if (!ok) return json(env, req, { error: "captcha_failed", message: "Please complete the check and try again." }, 400);
  }
  const cap = Number(env.PHONE_DAILY_CAP || 150);
  if (!(await phoneRate(env, `rl:phg:${day}`, cap, 90000))) return json(env, req, { error: "busy", message: "Too many codes were requested today. Try again tomorrow." }, 429);
  if (!(await phoneRate(env, `rl:phi:${await digest(ip)}`, 5, 3600)) || !(await phoneRate(env, `rl:php:${pd}`, 3, 3600))) return json(env, req, { error: "rate_limited", message: "Too many attempts. Please wait a while before asking for another code." }, 429);
  if (r.b.mode === "link") { const s = await session(env, req); if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401); if (await env.SESSIONS.get(`ph:${pd}`)) return json(env, req, { error: "phone_in_use", message: "That number is already used by another account." }, 409); }
  const t = await twilio(env, "Verifications", { To: r.phone, Channel: "sms" });
  if (!t.ok) return json(env, req, { error: "sms_failed", message: t.status === 429 ? "Too many attempts for this number. Please wait a bit." : "The SMS could not be sent. Check the number and try again." }, t.status === 429 ? 429 : 502);
  return json(env, req, { ok: true });
}
async function phoneVerify(env, req) {
  const r = await phoneBody(env, req); if (r.err) return r.err;
  const code = String(r.b.code || "").trim(); if (!/^\d{4,10}$/.test(code)) return json(env, req, { error: "invalid_code", message: "Enter the code from the SMS." }, 400);
  const pd = await digest(r.phone), ak = `rl:phv:${pd}`;
  if (!(await phoneRate(env, ak, 6, 600))) return json(env, req, { error: "too_many_attempts", message: "Too many wrong codes. Ask for a new code in a few minutes." }, 429);
  const t = await twilio(env, "VerificationCheck", { To: r.phone, Code: code });
  const j = t.ok ? await t.json().catch(() => ({})) : {};
  if (!t.ok || j.status !== "approved") return json(env, req, { error: "invalid_code", message: "That code is wrong or has expired." }, 400);
  await env.SESSIONS.delete(ak);
  const idxKey = `ph:${pd}`;
  if (r.b.mode === "link") {
    const s = await session(env, req); if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
    const owner = await env.SESSIONS.get(idxKey), key = await accountKey(s.data.accountEmail);
    if (owner && owner !== key) return json(env, req, { error: "phone_in_use", message: "That number is already used by another account." }, 409);
    const a = JSON.parse(await env.SESSIONS.get(key) || "null"); if (!a) return json(env, req, { error: "account_not_found" }, 404);
    if (a.phone && a.phone.e164 !== r.phone) await env.SESSIONS.delete(`ph:${await digest(a.phone.e164)}`);
    a.phone = { e164: r.phone, linkedAt: Date.now() }; await env.SESSIONS.put(key, JSON.stringify(a)); await env.SESSIONS.put(idxKey, key);
    return json(env, req, { ok: true, linked: true });
  }
  let key = await env.SESSIONS.get(idxKey), id;
  if (key) { const a = JSON.parse(await env.SESSIONS.get(key) || "null"); if (!a) { await env.SESSIONS.delete(idxKey); key = null; } else id = a.email || a.accountId; }
  if (!key) {
    id = `tel:${r.phone}`; key = await accountKey(id);
    if (await env.SESSIONS.get(key)) return json(env, req, { error: "account_exists" }, 409);
    await env.SESSIONS.put(key, JSON.stringify({ email: "", accountId: id, label: maskPhone(r.phone), salt: "", passwordHash: "", verified: true, created: Date.now(), discord: null, phone: { e164: r.phone, linkedAt: Date.now() } }));
    await env.SESSIONS.put(idxKey, key);
  }
  const sid = rand(32);
  await env.SESSIONS.put(`s:${sid}`, JSON.stringify({ accountEmail: id, created: Date.now() }), { expirationTtl: SESSION_TTL });
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_session", sid, { maxAge: SESSION_TTL }) });
}
async function phoneUnlink(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req); if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const key = await accountKey(s.data.accountEmail), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a || !a.phone) return json(env, req, { error: "not_linked" }, 400);
  if (!a.email && !a.telegram) return json(env, req, { error: "last_login_method", message: "This number is your only way to sign in, so it can't be removed." }, 400);
  await env.SESSIONS.delete(`ph:${await digest(a.phone.e164)}`); delete a.phone; await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
async function tgVerify(env, u) {
  if (!u || !u.id || !u.hash) return false;
  const age = Date.now() / 1000 - Number(u.auth_date || 0);
  if (!(age >= -60 && age < 600)) return false;
  const data = Object.keys(u).filter((k) => k !== "hash").sort().map((k) => `${k}=${u[k]}`).join("\n");
  const enc = new TextEncoder(), secret = await crypto.subtle.digest("SHA-256", enc.encode(env.TELEGRAM_BOT_TOKEN));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(sig, String(u.hash));
}
async function telegramStatus(env, req) {
  const on = !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME);
  return json(env, req, { enabled: on, bot: on ? env.TELEGRAM_BOT_USERNAME : "" }, 200, { "Cache-Control": "no-store" });
}
async function telegramAuth(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  if (!env.TELEGRAM_BOT_TOKEN) return json(env, req, { error: "telegram_unavailable", message: "Telegram sign-in isn't available yet." }, 503);
  let b; try { b = await readBody(req); } catch (_) { return json(env, req, { error: "bad_request" }, 400); }
  const u = b.user || {};
  if (!(await phoneRate(env, `rl:tgi:${await digest(req.headers.get("CF-Connecting-IP") || "unknown")}`, 30, 600))) return json(env, req, { error: "rate_limited" }, 429);
  if (!(await tgVerify(env, u))) return json(env, req, { error: "telegram_invalid", message: "Telegram sign-in failed. Please try again." }, 400);
  const idxKey = `tg:${await digest(String(u.id))}`, name = String(u.username || u.first_name || "").slice(0, 64);
  if (b.mode === "link") {
    const s = await session(env, req); if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
    const owner = await env.SESSIONS.get(idxKey), key = await accountKey(s.data.accountEmail);
    if (owner && owner !== key) return json(env, req, { error: "telegram_in_use", message: "That Telegram account is already linked to another account." }, 409);
    const a = JSON.parse(await env.SESSIONS.get(key) || "null"); if (!a) return json(env, req, { error: "account_not_found" }, 404);
    if (a.telegram && String(a.telegram.id) !== String(u.id)) await env.SESSIONS.delete(`tg:${await digest(String(a.telegram.id))}`);
    a.telegram = { id: String(u.id), name, linkedAt: Date.now() }; await env.SESSIONS.put(key, JSON.stringify(a)); await env.SESSIONS.put(idxKey, key);
    return json(env, req, { ok: true, linked: true });
  }
  let key = await env.SESSIONS.get(idxKey), id;
  if (key) { const a = JSON.parse(await env.SESSIONS.get(key) || "null"); if (!a) { await env.SESSIONS.delete(idxKey); key = null; } else id = a.email || a.accountId; }
  if (!key) {
    id = `tgu:${u.id}`; key = await accountKey(id);
    if (await env.SESSIONS.get(key)) return json(env, req, { error: "account_exists" }, 409);
    await env.SESSIONS.put(key, JSON.stringify({ email: "", accountId: id, label: name || "Telegram", salt: "", passwordHash: "", verified: true, created: Date.now(), discord: null, telegram: { id: String(u.id), name, linkedAt: Date.now() } }));
    await env.SESSIONS.put(idxKey, key);
  }
  const sid = rand(32);
  await env.SESSIONS.put(`s:${sid}`, JSON.stringify({ accountEmail: id, created: Date.now() }), { expirationTtl: SESSION_TTL });
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_session", sid, { maxAge: SESSION_TTL }) });
}
async function telegramUnlink(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req); if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const key = await accountKey(s.data.accountEmail), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a || !a.telegram) return json(env, req, { error: "not_linked" }, 400);
  if (!a.email && !a.phone) return json(env, req, { error: "last_login_method", message: "Telegram is your only way to sign in, so it can't be removed." }, 400);
  await env.SESSIONS.delete(`tg:${await digest(a.telegram.id)}`); delete a.telegram; await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
async function accountMe(env, req) {
  const s = await session(env, req);
  if (!s) return json(env, req, { error: "unauthenticated" }, 401);
  if (!s.data.accountEmail) return json(env, req, { error: "not_email_account" }, 400);
  const raw = await env.SESSIONS.get(await accountKey(s.data.accountEmail));
  if (!raw) return json(env, req, { error: "account_not_found" }, 404);
  const a = JSON.parse(raw);
  return json(env, req, { email: a.email || "", phone: a.phone ? { masked: maskPhone(a.phone.e164) } : null, canUnlinkPhone: !!(a.email || a.telegram), telegram: a.telegram ? { name: a.telegram.name } : null, canUnlinkTelegram: !!(a.email || a.phone), verified: !!a.verified, created: a.created, discord: a.discord ? { id: a.discord.id, username: a.discord.username, name: a.discord.name, avatarUrl: cdn("avatars", a.discord.id, a.discord.avatar) } : null, google: a.google ? { email: a.google.email } : null, steam: a.steam ? { id: a.steam.id, name: await steamData(env, a.steam.id).then((d) => d && d.name).catch(() => null) } : null, hasPassword: !!a.passwordHash });
}
async function accountUnlinkDiscord(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const email = s.data.accountEmail, key = await accountKey(email), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a) return json(env, req, { error: "unauthenticated" }, 401);
  if (a.discord && a.discord.id) await env.SESSIONS.delete(`d:${a.discord.id}`);
  a.discord = null;
  await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
const googleRedirect = (env, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/account?google=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};
async function googleStart(env, req) {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((k) => !env[k]);
  if (missing.length) return googleRedirect(env, "misconfigured");
  const link = new URL(req.url).searchParams.get("link") === "1";
  if (link) {
    const s = await session(env, req);
    if (!s || !s.data.accountEmail) return googleRedirect(env, "login_required");
  }
  const state = (link ? "gl-" : "gi-") + rand(16), sig = await sign(env.STATE_SECRET, state), url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, response_type: "code", scope: "openid email", redirect_uri: `${env.API_ORIGIN}/auth/google/callback`, state, prompt: "select_account" });
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store", "Set-Cookie": cookie("sentinel_gstate", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }) } });
}
async function googleCallback(env, req) {
  const url = new URL(req.url), clear = ["Set-Cookie", cookie("sentinel_gstate", "", { maxAge: 0, path: "/auth" })], fail = (q) => googleRedirect(env, q, [clear]);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("misconfigured");
  if (url.searchParams.get("error")) return fail("cancelled");
  const code = url.searchParams.get("code"), state = url.searchParams.get("state"), [cState, cSig] = (cookies(req).sentinel_gstate || "").split(".");
  if (!code || !state || !cState || !safeEqual(state, cState) || !safeEqual(cSig || "", await sign(env.STATE_SECRET, cState))) return fail("error");
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${env.API_ORIGIN}/auth/google/callback`, grant_type: "authorization_code" })
    });
    if (!tr.ok) return fail("error");
    const t = await tr.json(), seg = String(t.id_token || "").split(".")[1];
    if (!seg) return fail("error");
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/"), pl = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64 + "=".repeat((4 - b64.length % 4) % 4)), (c) => c.charCodeAt(0))));
    if (pl.aud !== env.GOOGLE_CLIENT_ID || !["https://accounts.google.com", "accounts.google.com"].includes(pl.iss) || !(pl.exp * 1e3 > Date.now()) || !pl.sub || !pl.email || pl.email_verified !== true) return fail("error");
    const sub = String(pl.sub), gmail = String(pl.email).trim().toLowerCase(), gKey = `g:${sub}`;
    if (!EMAIL_RE.test(gmail)) return fail("error");
    if (state.startsWith("gl-")) {
      const s = await session(env, req);
      if (!s || !s.data.accountEmail) return fail("login_required");
      const email2 = s.data.accountEmail, owner = await env.SESSIONS.get(gKey);
      if (owner && owner !== email2) return fail("already_used");
      const aKey2 = await accountKey(email2), a2 = JSON.parse(await env.SESSIONS.get(aKey2) || "null");
      if (!a2) return fail("error");
      if (a2.google && a2.google.sub && a2.google.sub !== sub) await env.SESSIONS.delete(`g:${a2.google.sub}`);
      a2.google = { sub, email: gmail, linkedAt: Date.now() };
      await env.SESSIONS.put(aKey2, JSON.stringify(a2));
      await env.SESSIONS.put(gKey, email2);
      return fail("linked");
    }
    let email = await env.SESSIONS.get(gKey), a = null, aKey = "";
    if (email) {
      aKey = await accountKey(email);
      a = JSON.parse(await env.SESSIONS.get(aKey) || "null");
    }
    if (!a) {
      email = gmail;
      aKey = await accountKey(email);
      const raw = await env.SESSIONS.get(aKey);
      if (raw) {
        a = JSON.parse(raw);
        if (!a.verified) {
          a.verified = true;
          delete a.passwordHash;
          delete a.salt;
        }
      } else a = { email, salt: "", passwordHash: "", verified: true, created: Date.now(), discord: null };
      a.google = { sub, email: gmail, linkedAt: Date.now() };
      await env.SESSIONS.put(aKey, JSON.stringify(a));
      await env.SESSIONS.put(gKey, email);
    }
    const sid = rand(32);
    await env.SESSIONS.put(`s:${sid}`, JSON.stringify({ accountEmail: email, created: Date.now() }), { expirationTtl: SESSION_TTL });
    return googleRedirect(env, "ok", [clear, ["Set-Cookie", cookie("sentinel_session", sid, { maxAge: SESSION_TTL })]]);
  } catch (_) {
    return fail("error");
  }
}
async function accountUnlinkGoogle(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const key = await accountKey(s.data.accountEmail), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a) return json(env, req, { error: "unauthenticated" }, 401);
  if (!a.passwordHash && !(a.discord && a.discord.id)) return json(env, req, { error: "last_login_method", message: "Set a password first, otherwise you could not sign in anymore." }, 400);
  if (a.google && a.google.sub) await env.SESSIONS.delete(`g:${a.google.sub}`);
  a.google = null;
  await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
const STEAM_OPENID = "https://steamcommunity.com/openid/login";
const steamRedirect = (env, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/account?steam=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};
async function steamStart(env, req) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return steamRedirect(env, "login_required");
  const state = "sl-" + rand(16), sig = await sign(env.STATE_SECRET, state), ret = `${env.API_ORIGIN}/auth/steam/callback?state=${state}`, url = new URL(STEAM_OPENID);
  url.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": ret,
    "openid.realm": env.API_ORIGIN,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
  });
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store", "Set-Cookie": cookie("sentinel_sstate", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }) } });
}
async function steamCallback(env, req) {
  const url = new URL(req.url), clear = ["Set-Cookie", cookie("sentinel_sstate", "", { maxAge: 0, path: "/auth" })], fail = (q) => steamRedirect(env, q, [clear]);
  const state = url.searchParams.get("state") || "", [cState, cSig] = (cookies(req).sentinel_sstate || "").split(".");
  if (!state || !cState || !safeEqual(state, cState) || !safeEqual(cSig || "", await sign(env.STATE_SECRET, cState))) return fail("error_state");
  if (url.searchParams.get("openid.mode") !== "id_res") return fail("cancelled");
  if (url.searchParams.get("openid.return_to") !== `${env.API_ORIGIN}/auth/steam/callback?state=${state}`) return fail("error_return");
  const m = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(url.searchParams.get("openid.claimed_id") || "");
  if (!m) return fail("error_claim");
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return fail("login_required");
  try {
    const p = new URLSearchParams();
    for (const [k, v] of url.searchParams) if (k.startsWith("openid.")) p.set(k, v);
    p.set("openid.mode", "check_authentication");
    const vr = await fetch(STEAM_OPENID, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: p });
    const vt = await vr.text();
    if (!vr.ok) return fail("error_verify_" + vr.status);
    if (!/is_valid\s*:\s*true/.test(vt)) return fail("error_invalid");
    const id = m[1], email = s.data.accountEmail, mapKey = `st:${id}`, owner = await env.SESSIONS.get(mapKey);
    if (owner && owner !== email) return fail("already_used");
    const aKey = await accountKey(email), a = JSON.parse(await env.SESSIONS.get(aKey) || "null");
    if (!a) return fail("error_account");
    if (a.steam && a.steam.id && a.steam.id !== id) await env.SESSIONS.delete(`st:${a.steam.id}`);
    a.steam = { id, linkedAt: Date.now() };
    await env.SESSIONS.put(aKey, JSON.stringify(a));
    await env.SESSIONS.put(mapKey, email);
    return fail("linked");
  } catch (e) {
    return fail("error_exc");
  }
}
async function accountUnlinkSteam(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const key = await accountKey(s.data.accountEmail), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a) return json(env, req, { error: "unauthenticated" }, 401);
  if (a.steam && a.steam.id) {
    await env.SESSIONS.delete(`st:${a.steam.id}`);
    await env.SESSIONS.delete(`sd:${a.steam.id}`);
  }
  a.steam = null;
  await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
async function steamData(env, id) {
  if (!/^\d{17}$/.test(String(id || ""))) return null;
  const ck = `sd:${id}`, hit = await env.SESSIONS.get(ck);
  if (hit) {
    try {
      return JSON.parse(hit);
    } catch (_) {
    }
  }
  if (!env.STEAM_API_KEY) {
    const xml = async (path) => {
      const r = await fetch(`https://steamcommunity.com/profiles/${id}${path}`, { headers: { "User-Agent": "SentinelProfile/1.0 (+https://sentineldashboard.site)" }, cf: { cacheTtl: 600 } });
      if (!r.ok) throw new Error("steam " + r.status);
      return r.text();
    };
    const tag = (x, t) => {
      const m2 = new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`).exec(x);
      return m2 ? m2[1].trim() : "";
    };
    const num = (v) => Number(String(v || "0").replace(/,/g, "")) || 0;
    const [prof, gl, glHtml] = await Promise.all([xml("/?xml=1"), xml("/games?tab=all&xml=1").catch(() => ""), xml("/games/?tab=all").catch(() => "")]);
    if (!/<profile>/.test(prof) || !tag(prof, "steamID")) return null;
    const state = tag(prof, "onlineState"), games2 = [];
    const re = /<game>([\s\S]*?)<\/game>/g;
    let m;
    while ((m = re.exec(gl)) && games2.length < 3e3) games2.push({ id: num(tag(m[1], "appID")), name: profileText(tag(m[1], "name"), 60), total: num(tag(m[1], "hoursOnRecord")), recent: num(tag(m[1], "hoursLast2Weeks")) });
    let diag = "x" + gl.length + " h" + glHtml.length;
    if (!games2.length) {
      const page = glHtml || gl, hasApp = (o, d = 0) => {
        if (!o || typeof o !== "object" || d > 5) return null;
        if (Array.isArray(o)) {
          if (o.length && o[0] && typeof o[0] === "object" && o[0].appid !== void 0) return o;
          for (const x of o.slice(0, 5)) {
            const r = hasApp(x, d + 1);
            if (r) return r;
          }
          return null;
        }
        for (const k2 of Object.keys(o)) {
          const r = hasApp(o[k2], d + 1);
          if (r) return r;
        }
        return null;
      };
      const dec = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const attrs = [];
      let am;
      const are = /\b(data-[a-z0-9-]+)="([^"]{40,})"/g;
      let found = null;
      while ((am = are.exec(page)) && !found) {
        attrs.push(am[1].replace("data-", "").slice(0, 14));
        try {
          found = hasApp(JSON.parse(dec(am[2])));
        } catch (_) {
        }
      }
      if (!found) {
        const idx = page.indexOf("rgGames");
        if (idx >= 0) {
          const d2 = dec(page.slice(idx - 5, idx + 4e5)), st = d2.indexOf("[");
          let depth = 0, end = -1;
          for (let i = st; i >= 0 && i < d2.length; i++) {
            if (d2[i] === "[") depth++;
            else if (d2[i] === "]" && --depth === 0) {
              end = i;
              break;
            }
          }
          try {
            found = JSON.parse(d2.slice(st, end + 1));
          } catch (_) {
          }
        }
      }
      diag += " attrs:" + (attrs.slice(0, 4).join(",") || "none") + (/profile_private_info/.test(page) ? " P" : "") + (/playtime_forever|hours_forever/.test(page) ? " H" : "") + (/appid/.test(page) ? " A" : "");
      if (found) for (const g of found.slice(0, 3e3)) {
        const total = g.hours_forever !== void 0 ? num(g.hours_forever) : Math.round(num(g.playtime_forever) / 6) / 10, rec = g.hours !== void 0 ? num(g.hours) : Math.round(num(g.playtime_2weeks) / 6) / 10;
        games2.push({ id: num(g.appid), name: profileText(g.name, 60), total, recent: rec });
      }
    }
    let partial = false;
    if (!games2.length) {
      const mre = /<mostPlayedGame>([\s\S]*?)<\/mostPlayedGame>/g;
      let mm;
      while ((mm = mre.exec(prof)) && games2.length < 10) {
        const link = tag(mm[1], "gameLink"), idm = /\/app\/(\d+)/.exec(link);
        games2.push({ id: idm ? Number(idm[1]) : 0, name: profileText(tag(mm[1], "gameName"), 60), img: safeHttpUrl(tag(mm[1], "gameLogo"), 300, true), total: num(tag(mm[1], "hoursOnRecord")), recent: num(tag(mm[1], "hoursPlayed")) });
      }
      if (games2.length) partial = true;
      else diag += " mp:0";
    }
    const priv = !games2.length;
    const out2 = {
      name: profileText(tag(prof, "steamID"), 40),
      avatar: safeHttpUrl(tag(prof, "avatarFull"), 300, true),
      url: `https://steamcommunity.com/profiles/${id}`,
      online: state === "online" || state === "in-game",
      playing: state === "in-game" ? profileText(tag(prof, "stateMessage").replace(/<[^>]*>/g, "").replace(/^In-Game\s*/i, ""), 60) : "",
      private: priv,
      partial: partial || void 0,
      diag: priv ? diag : void 0,
      gameCount: games2.length,
      totalHours: Math.round(games2.reduce((t, g) => t + g.total, 0) * 10) / 10,
      top: games2.filter((g) => g.total > 0).sort((a, b) => b.total - a.total).slice(0, 5).map((g) => ({ id: g.id, name: g.name, hours: g.total, img: g.img || void 0 })),
      recent: games2.filter((g) => g.recent > 0).sort((a, b) => b.recent - a.recent).slice(0, 3).map((g) => ({ id: g.id, name: g.name, hours: g.recent, img: g.img || void 0 }))
    };
    await env.SESSIONS.put(ck, JSON.stringify(out2), { expirationTtl: priv ? 120 : 3600 });
    return out2;
  }
  const k = encodeURIComponent(env.STEAM_API_KEY), get = async (path) => {
    const r = await fetch(`https://api.steampowered.com${path}&key=${k}&format=json`);
    if (!r.ok) throw new Error("steam " + r.status);
    return r.json();
  };
  const [sum, owned, recent] = await Promise.all([
    get(`/ISteamUser/GetPlayerSummaries/v2/?steamids=${id}`),
    get(`/IPlayerService/GetOwnedGames/v1/?steamid=${id}&include_appinfo=1&include_played_free_games=1`).catch(() => null),
    get(`/IPlayerService/GetRecentlyPlayedGames/v1/?steamid=${id}&count=3`).catch(() => null)
  ]);
  const pl = sum && sum.response && sum.response.players && sum.response.players[0];
  if (!pl) return null;
  const games = owned && owned.response && Array.isArray(owned.response.games) ? owned.response.games : null, hrs = (m) => Math.round(Number(m || 0) / 6) / 10;
  const row = (g, f) => ({ id: Number(g.appid) || 0, name: profileText(g.name, 60), hours: hrs(g[f]) });
  const out = {
    name: profileText(pl.personaname, 40),
    avatar: safeHttpUrl(pl.avatarfull, 300, true),
    url: `https://steamcommunity.com/profiles/${id}`,
    online: Number(pl.personastate) > 0,
    playing: profileText(pl.gameextrainfo, 60),
    private: !games,
    gameCount: games ? games.length : 0,
    totalHours: games ? hrs(games.reduce((t, g) => t + (g.playtime_forever || 0), 0)) : 0,
    top: games ? games.filter((g) => g.playtime_forever > 0).sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 5).map((g) => row(g, "playtime_forever")) : [],
    recent: recent && recent.response && Array.isArray(recent.response.games) ? recent.response.games.slice(0, 3).map((g) => row(g, "playtime_2weeks")) : []
  };
  await env.SESSIONS.put(ck, JSON.stringify(out), { expirationTtl: 3600 });
  return out;
}
async function lyricsSearch(env, req) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const u = new URL(req.url), title = profileText(u.searchParams.get("title"), 100), artist = profileText(u.searchParams.get("artist"), 100), dur = Math.round(Number(u.searchParams.get("duration")) || 0);
  if (title.length < 1) return json(env, req, { error: "missing_title", message: "Enter the song title first." }, 400);
  const rk = `rl:lyr:${await digest(s.data.accountEmail)}`, n = Number(await env.SESSIONS.get(rk) || "0");
  if (n >= 40) return json(env, req, { error: "rate_limited", message: "Too many lookups, try again in a while." }, 429);
  await env.SESSIONS.put(rk, String(n + 1), { expirationTtl: 3600 });
  const H = { "User-Agent": "SentinelProfile/1.0 (https://sentineldashboard.site)" }, cf = { cacheTtl: 86400, cacheEverything: true };
  const pick = (x) => x && (x.syncedLyrics || x.plainLyrics) ? { synced: String(x.syncedLyrics || ""), plain: String(x.plainLyrics || ""), title: profileText(x.trackName, 100), artist: profileText(x.artistName, 100), duration: Math.round(Number(x.duration) || 0) } : null;
  try {
    let hit = null;
    if (artist) {
      const r = await fetch(`https://lrclib.net/api/get?${new URLSearchParams(dur ? { track_name: title, artist_name: artist, duration: String(dur) } : { track_name: title, artist_name: artist })}`, { headers: H, cf });
      if (r.ok) hit = pick(await r.json());
    }
    if (!hit) {
      const r = await fetch(`https://lrclib.net/api/search?${new URLSearchParams(artist ? { track_name: title, artist_name: artist } : { q: title })}`, { headers: H, cf });
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list)) {
          const byDur = (a, bb) => Math.abs((a.duration || 0) - dur) - Math.abs((bb.duration || 0) - dur), syn = list.filter((x) => x && x.syncedLyrics);
          if (dur) syn.sort(byDur);
          hit = pick(syn[0] || list.find((x) => x && x.plainLyrics));
          if (hit && syn[0]) hit.duration = Math.round(syn[0].duration || 0);
        }
      }
    }
    if (!hit) return json(env, req, { error: "not_found", message: "No lyrics found. Check the title and artist, or paste them yourself." }, 404);
    return json(env, req, { ok: true, ...hit, lyrics: (hit.synced || hit.plain).slice(0, 6e3), isSynced: !!hit.synced });
  } catch (_) {
    return json(env, req, { error: "lookup_failed", message: "The lyrics service is unavailable right now." }, 502);
  }
}
async function dashGuild(env, req, gid) {
  const bad = (status, error, message) => ({ err: json(env, req, { error, message }, status) });
  if (!SNOWFLAKE.test(gid)) return bad(400, "bad_request");
  const s = await session(env, req);
  if (!s) return bad(401, "unauthenticated", "Sign in first.");
  let guilds = [];
  if (s.data.accountEmail) {
    const a = JSON.parse(await env.SESSIONS.get(await accountKey(s.data.accountEmail)) || "null");
    if (!a || !a.discord) return bad(403, "link_discord", "Link your Discord account on the account page first.");
    if (Date.now() - Number(a.discord.linkedAt || 0) > 30 * 864e5) return bad(403, "relink_discord", "Re-link Discord on the account page to refresh your server permissions.");
    guilds = Array.isArray(a.discord.guilds) ? a.discord.guilds : [];
  } else guilds = Array.isArray(s.data.guilds) ? s.data.guilds : [];
  const g = guilds.find((x) => x.id === gid);
  if (!g) return bad(403, "forbidden", "You don't manage this server.");
  if (!env.BOT_TOKEN) return { err: json(env, req, { error: "misconfigured", missing: ["BOT_TOKEN"] }, 500) };
  return { s, g };
}
const TK_OPS = new Set(["settings", "type_create", "type_update", "type_delete", "panel_create", "panel_update", "panel_delete", "panel_publish", "server_build"]);
async function botKeyOK(env, req) {
  if (!env.BOT_API_KEY) return json(env, req, { error: "misconfigured", missing: ["BOT_API_KEY"] }, 500);
  const given = req.headers.get("X-Sentinel-Key") || "";
  if (!safeEqual(await sign(env.STATE_SECRET, given), await sign(env.STATE_SECRET, env.BOT_API_KEY))) return json(env, req, { error: "forbidden" }, 403);
  return null;
}
async function dashGuildGet(env, req, gid) {
  const a = await dashGuild(env, req, gid);
  if (a.err) return a.err;
  const [ch, ro, gi] = await Promise.all([botCall(env, "GET", `/guilds/${gid}/channels`), botCall(env, "GET", `/guilds/${gid}/roles`), botCall(env, "GET", `/guilds/${gid}`)]);
  if (gi.status === 404 || gi.status === 403 || ch.status === 403 || ch.status === 404) return json(env, req, { error: "bot_missing", message: "Sentinel isn't in this server yet." }, 404);
  const chj = ch.ok ? await ch.json() : [], roj = ro.ok ? await ro.json() : [];
  const channels = chj.filter((c) => [0, 4].includes(c.type)).sort((x, y) => x.position - y.position).map((c) => ({ id: c.id, name: String(c.name || "").slice(0, 100), type: c.type === 4 ? "category" : "text", parent: c.parent_id || null }));
  const roles = roj.filter((r) => r.id !== gid && !r.managed).sort((x, y) => y.position - x.position).map((r) => ({ id: r.id, name: String(r.name || "").slice(0, 100), color: r.color ? "#" + r.color.toString(16).padStart(6, "0") : "" }));
  const [sn, q, rs] = await Promise.all([env.SESSIONS.get(`tks:${gid}`), env.SESSIONS.get(`tkq:${gid}`), env.SESSIONS.get(`tkr:${gid}`)]), gj = gi.ok ? await gi.json() : {};
  return json(env, req, {
    guild: { id: gid, name: a.g.name || gj.name, iconUrl: cdn("icons", gid, a.g.icon || gj.icon) },
    channels,
    roles,
    snapshot: sn ? JSON.parse(sn) : null,
    queue: q ? JSON.parse(q) : [],
    results: rs ? JSON.parse(rs) : []
  }, 200, { "Cache-Control": "no-store" });
}
async function dashTicketsOp(env, req, gid) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const a = await dashGuild(env, req, gid);
  if (a.err) return a.err;
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  if (!b || !TK_OPS.has(b.op) || typeof b.data !== "object" || b.data === null || Array.isArray(b.data)) return json(env, req, { error: "bad_request" }, 400);
  if (JSON.stringify(b.data).length > (b.op === "server_build" ? 6e4 : 3e4)) return json(env, req, { error: "too_large", message: "That change is too large." }, 413);
  const raw = await env.SESSIONS.get(`tkq:${gid}`), q = raw ? JSON.parse(raw) : [];
  if (b.op === "server_build" && q.some((i) => i.op === "server_build")) return json(env, req, { error: "busy", message: "A server build is already waiting for the bot." }, 429);
  if (q.length >= 30) return json(env, req, { error: "busy", message: "Too many changes are waiting for the bot. Make sure it's online, then try again." }, 429);
  const item = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), ts: Date.now(), op: b.op, data: b.data, by: a.s.data.accountEmail ? "account" : String(a.s.data.user && a.s.data.user.id || "") };
  q.push(item);
  await env.SESSIONS.put(`tkq:${gid}`, JSON.stringify(q), { expirationTtl: 86400 });
  const ir = await env.SESSIONS.get("tkqidx"), idx = ir ? JSON.parse(ir) : [];
  if (!idx.includes(gid)) {
    idx.push(gid);
    await env.SESSIONS.put("tkqidx", JSON.stringify(idx.slice(-500)));
  }
  return json(env, req, { ok: true, id: item.id });
}
async function botTicketsPending(env, req) {
  const bad = await botKeyOK(env, req);
  if (bad) return bad;
  const hb = Number(await env.SESSIONS.get("hb") || "0");
  if (Date.now() - hb > 240000) await env.SESSIONS.put("hb", String(Date.now()));
  const ir = await env.SESSIONS.get("tkqidx"), idx = ir ? JSON.parse(ir) : [], items = [];
  for (const gid of idx.slice(0, 100)) {
    const r = await env.SESSIONS.get(`tkq:${gid}`);
    const ops = r ? JSON.parse(r) : [];
    if (ops.length) items.push({ gid, ops });
  }
  return json(env, req, { items }, 200, { "Cache-Control": "no-store" });
}
async function botTicketsAck(env, req) {
  const bad = await botKeyOK(env, req);
  if (bad) return bad;
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const gid = String(b && b.gid || "");
  if (!SNOWFLAKE.test(gid) || !Array.isArray(b.results)) return json(env, req, { error: "bad_request" }, 400);
  const res = b.results.slice(0, 30).map((x) => ({ id: String(x.id || "").slice(0, 16), ok: !!x.ok, error: String(x.error || "").slice(0, 300), info: String(x.info || "").slice(0, 300), ts: Date.now() }));
  const done = new Set(res.map((x) => x.id)), raw = await env.SESSIONS.get(`tkq:${gid}`), q = (raw ? JSON.parse(raw) : []).filter((i) => !done.has(i.id));
  if (q.length) await env.SESSIONS.put(`tkq:${gid}`, JSON.stringify(q), { expirationTtl: 86400 });
  else {
    await env.SESSIONS.delete(`tkq:${gid}`);
    const ir = await env.SESSIONS.get("tkqidx");
    if (ir) await env.SESSIONS.put("tkqidx", JSON.stringify(JSON.parse(ir).filter((g) => g !== gid)));
  }
  const rr = await env.SESSIONS.get(`tkr:${gid}`), old = rr ? JSON.parse(rr) : [];
  await env.SESSIONS.put(`tkr:${gid}`, JSON.stringify([...old, ...res].slice(-30)), { expirationTtl: 86400 * 7 });
  return json(env, req, { ok: true });
}
async function botTicketsSnapshot(env, req, gid) {
  const bad = await botKeyOK(env, req);
  if (bad) return bad;
  const text = await req.text();
  if (text.length > 9e5) return json(env, req, { error: "too_large" }, 413);
  let b;
  try {
    b = JSON.parse(text);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  if (!b || typeof b !== "object") return json(env, req, { error: "bad_request" }, 400);
  b.ts = Date.now();
  await env.SESSIONS.put(`tks:${gid}`, JSON.stringify(b));
  return json(env, req, { ok: true });
}
async function accountChangePassword(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const email = s.data.accountEmail, key = await accountKey(email), a = JSON.parse(await env.SESSIONS.get(key) || "null");
  if (!a || a.passwordHash && !safeEqual(a.passwordHash, await passwordHash(String(b.currentPassword || ""), a.salt))) return json(env, req, { error: "invalid_credentials" }, 401);
  const next = String(b.newPassword || "");
  if (next.length < 10 || next.length > 128) return json(env, req, { error: "weak_password" }, 400);
  a.salt = rand(16);
  a.passwordHash = await passwordHash(next, a.salt);
  await env.SESSIONS.put(key, JSON.stringify(a));
  return json(env, req, { ok: true });
}
async function linkDiscord(env) {
  const state = `l-${rand(16)}`, sig = await sign(env.STATE_SECRET, state), url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope: "identify guilds", redirect_uri: `${env.API_ORIGIN}/auth/callback`, state, prompt: "consent" });
  const h = new Headers({ Location: url.toString(), "Cache-Control": "no-store" });
  h.append("Set-Cookie", cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }));
  h.append("Set-Cookie", cookie("sentinel_link", state, { maxAge: STATE_TTL, path: "/auth" }));
  return new Response(null, { status: 302, headers: h });
}
function linkRedirect(env, query, clear) {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/account?link=${query}`, "Cache-Control": "no-store" });
  h.append(clear[0], clear[1]);
  h.append("Set-Cookie", cookie("sentinel_link", "", { maxAge: 0, path: "/auth" }));
  return new Response(null, { status: 302, headers: h });
}
async function linkDiscordCallback(env, req, code, state, clear) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return linkRedirect(env, "login_required", clear);
  try {
    const tok = await exchange(env, code), user = await dget("/users/@me", `Bearer ${tok.access_token}`), guilds = await dget("/users/@me/guilds", `Bearer ${tok.access_token}`);
    revoke(env, tok.access_token);
    const mapKey = `d:${user.id}`, existing = await env.SESSIONS.get(mapKey), email = s.data.accountEmail, aKey = await accountKey(email), raw = await env.SESSIONS.get(aKey), a = raw ? JSON.parse(raw) : null;
    if (!a || existing && existing !== email) return linkRedirect(env, "already_used", clear);
    if (a.discord && a.discord.id && a.discord.id !== user.id) await env.SESSIONS.delete(`d:${a.discord.id}`);
    a.discord = { id: user.id, username: user.username, name: user.global_name || user.username, avatar: user.avatar, linkedAt: Date.now() };
    const manageable = guilds.filter((g) => g.owner || (BigInt(g.permissions || "0") & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n).map((g) => ({ id: g.id, name: g.name, icon: g.icon, owner: !!g.owner, botPresent: null }));
    a.discord.guilds = manageable;
    await env.SESSIONS.put(aKey, JSON.stringify(a));
    await env.SESSIONS.put(mapKey, email);
    return linkRedirect(env, "ok", clear);
  } catch (_) {
    return linkRedirect(env, "error", clear);
  }
}
async function login(env) {
  const state = rand(16);
  const sig = await sign(env.STATE_SECRET, state);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    scope: "identify guilds",
    redirect_uri: `${env.API_ORIGIN}/auth/callback`,
    state,
    prompt: "none"
  });
  return new Response(null, { status: 302, headers: {
    Location: url.toString(),
    "Cache-Control": "no-store",
    "Set-Cookie": cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" })
  } });
}
async function callback(env, req) {
  const url = new URL(req.url);
  const clear = ["Set-Cookie", cookie("sentinel_state", "", { maxAge: 0, path: "/auth" })];
  const vEarly = VERIFY_STATE.exec(url.searchParams.get("state") || "");
  const stEarly = url.searchParams.get("state") || "";
  if (url.searchParams.get("error") && (RJ_STATE.test(stEarly) || RV_STATE.test(stEarly))) return rjBack(env, "cancelled", [clear[0], clear[1]], (RJ_STATE.exec(stEarly) || [])[1] || "");
  if (url.searchParams.get("error")) return vEarly ? verifyBack(env, vEarly[1], "cancelled", [clear]) : back(env, "cancelled", [clear]);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const [cState, cSig] = (cookies(req).sentinel_state || "").split(".");
  if (!code || !state || !cState || !safeEqual(state, cState) || !safeEqual(cSig || "", await sign(env.STATE_SECRET, cState)))
    return vEarly ? verifyBack(env, vEarly[1], "error", [clear]) : back(env, "error", [clear]);
  if (vEarly) return verifyCallback(env, code, vEarly[1], clear);
  if (RJ_STATE.test(state) || RV_STATE.test(state)) return rejoinCallback(env, code, state, clear);
  const linkState = cookies(req).sentinel_link || "";
  if (linkState && state === linkState && state.startsWith("l-") && safeEqual(cSig || "", await sign(env.STATE_SECRET, state))) {
    return linkDiscordCallback(env, req, code, state, clear);
  }
  try {
    const tok = await exchange(env, code);
    const auth = `Bearer ${tok.access_token}`;
    const [user, guilds, botIds] = await Promise.all([dget("/users/@me", auth), dget("/users/@me/guilds", auth), botGuildIds(env).catch(() => null)]);
    revoke(env, tok.access_token);
    const linkedEmail = await env.SESSIONS.get(`d:${user.id}`);
    if (linkedEmail) {
      const linkedAccount = await env.SESSIONS.get(await accountKey(linkedEmail));
      if (linkedAccount) {
        const accountData = JSON.parse(linkedAccount);
        if (accountData.verified && accountData.discord && accountData.discord.id === user.id) {
          const linkedSid = rand(32);
          await env.SESSIONS.put(`s:${linkedSid}`, JSON.stringify({ accountEmail: linkedEmail, created: Date.now() }), { expirationTtl: SESSION_TTL });
          return back(env, "ok", [clear, ["Set-Cookie", cookie("sentinel_session", linkedSid, { maxAge: SESSION_TTL })]]);
        }
      }
    }
    const manageable = guilds.filter((g) => g.owner || (BigInt(g.permissions || "0") & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n).map((g) => ({ id: g.id, name: g.name, icon: g.icon, owner: !!g.owner, botPresent: botIds ? botIds.has(g.id) : null }));
    const sid = rand(32);
    await env.SESSIONS.put(`s:${sid}`, JSON.stringify({
      user: { id: user.id, username: user.username, name: user.global_name || user.username, avatar: user.avatar },
      guilds: manageable,
      created: Date.now()
    }), { expirationTtl: SESSION_TTL });
    return back(env, "ok", [clear, ["Set-Cookie", cookie("sentinel_session", sid, { maxAge: SESSION_TTL })]]);
  } catch (e) {
    return back(env, "error", [clear]);
  }
}
async function session(env, req) {
  const sid = cookies(req).sentinel_session;
  if (!sid || !/^[A-Za-z0-9_-]{20,64}$/.test(sid)) return null;
  const raw = await env.SESSIONS.get(`s:${sid}`);
  return raw ? { sid, data: JSON.parse(raw) } : null;
}
const cdn = (kind, id, hash, ext = "png") => hash ? `https://cdn.discordapp.com/${kind}/${id}/${hash}.${ext}?size=128` : null;
async function me(env, req) {
  const s = await session(env, req);
  if (!s) return json(env, req, { error: "unauthenticated" }, 401);
  if (s.data.accountEmail) {
    const raw = await env.SESSIONS.get(await accountKey(s.data.accountEmail));
    if (!raw) return json(env, req, { error: "account_not_found" }, 404);
    const a = JSON.parse(raw), d = a.discord;
    const guilds2 = d && Array.isArray(d.guilds) ? d.guilds : [];
    return json(env, req, {
      accountType: "email",
      email: a.email || a.label || "",
      verified: !!a.verified,
      user: d ? { id: d.id, username: d.username, name: d.name, avatarUrl: cdn("avatars", d.id, d.avatar) } : { id: a.email || a.label || "account", username: a.email || a.label || "account", name: (a.email || a.label || "account").split("@")[0], avatarUrl: null },
      linkedDiscord: d ? { id: d.id, username: d.username, name: d.name } : null,
      guilds: guilds2.map((g) => ({ id: g.id, name: g.name, iconUrl: cdn("icons", g.id, g.icon), owner: g.owner, botPresent: g.botPresent })),
      botStatusKnown: false
    });
  }
  const { user, guilds } = s.data;
  return json(env, req, { accountType: "discord", user: { id: user.id, username: user.username, name: user.name, avatarUrl: cdn("avatars", user.id, user.avatar) }, guilds: guilds.map((g) => ({ id: g.id, name: g.name, iconUrl: cdn("icons", g.id, g.icon), owner: g.owner, botPresent: g.botPresent })), botStatusKnown: guilds.some((g) => g.botPresent !== null) });
}
async function logout(env, req) {
  if (req.headers.get("Origin") !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (s) await env.SESSIONS.delete(`s:${s.sid}`);
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_session", "", { maxAge: 0 }) });
}
const SNOWFLAKE = /^\d{15,25}$/;
const RJ_STATE = /^rj-(\d{15,25})-/;
const RV_STATE = /^rv-/;
const b64dec = (str) => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function rjKey(env) {
  if (!env.TOKEN_ENC_KEY) return null;
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", enc.encode(env.TOKEN_ENC_KEY)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function rjSeal(env, obj) {
  const k = await rjKey(env), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64url(out);
}
async function rjOpen(env, str) {
  try {
    const k = await rjKey(env), raw = b64dec(str);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12))));
  } catch (_) { return null; }
}
const rjBack = (env, q, clear, gid) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/rejoin?${gid ? "guild=" + gid + "&" : ""}status=${q}`, "Cache-Control": "no-store" });
  if (clear) h.append(clear[0], clear[1]);
  return new Response(null, { status: 302, headers: h });
};
async function rjAuthorize(env, state, scope) {
  const sig = await sign(env.STATE_SECRET, state), url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope, redirect_uri: `${env.API_ORIGIN}/auth/callback`, state, prompt: "consent" });
  const h = new Headers({ Location: url.toString(), "Cache-Control": "no-store" });
  h.append("Set-Cookie", cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }));
  return new Response(null, { status: 302, headers: h });
}
async function rejoinStart(env, req) {
  const gid = new URL(req.url).searchParams.get("guild") || "";
  if (!SNOWFLAKE.test(gid) || !env.TOKEN_ENC_KEY || !env.BOT_TOKEN) return rjBack(env, "unavailable", null, "");
  const km = JSON.parse(await env.SESSIONS.get(`km:${gid}`) || "null");
  if (!km || !km.enabled) return rjBack(env, "disabled", null, gid);
  return rjAuthorize(env, `rj-${gid}-${rand(12)}`, "identify guilds.join");
}
async function rejoinRevokeStart(env) {
  return rjAuthorize(env, `rv-${rand(12)}`, "identify");
}
async function rjDrop(env, uid, gid) {
  await env.SESSIONS.delete(`rc:${gid}:${uid}`);
  const list = JSON.parse(await env.SESSIONS.get(`ru:${uid}`) || "[]").filter((x) => x !== gid);
  if (list.length) { await env.SESSIONS.put(`ru:${uid}`, JSON.stringify(list)); return; }
  await env.SESSIONS.delete(`ru:${uid}`);
  const t = await rjOpen(env, await env.SESSIONS.get(`rt:${uid}`) || "");
  await env.SESSIONS.delete(`rt:${uid}`);
  if (t && t.refresh) revoke(env, t.refresh);
}
async function rejoinCallback(env, code, state, clear) {
  const rj = RJ_STATE.exec(state);
  try {
    const tok = await exchange(env, code), user = await dget("/users/@me", `Bearer ${tok.access_token}`);
    if (!rj) {
      for (const g of JSON.parse(await env.SESSIONS.get(`ru:${user.id}`) || "[]")) await rjDrop(env, user.id, g);
      await env.SESSIONS.delete(`rt:${user.id}`);
      revoke(env, tok.access_token);
      return rjBack(env, "revoked", clear, "");
    }
    const gid = rj[1], km = JSON.parse(await env.SESSIONS.get(`km:${gid}`) || "null");
    if (!km || !km.enabled || !tok.refresh_token || !(await rjKey(env))) { revoke(env, tok.access_token); return rjBack(env, "disabled", clear, gid); }
    const m = await botCall(env, "GET", `/guilds/${gid}/members/${user.id}`);
    if (!m.ok) { revoke(env, tok.access_token); return rjBack(env, "not_member", clear, gid); }
    await env.SESSIONS.put(`rt:${user.id}`, await rjSeal(env, { access: tok.access_token, refresh: tok.refresh_token, exp: Date.now() + (tok.expires_in || 604800) * 1000 - 60000 }));
    await env.SESSIONS.put(`rc:${gid}:${user.id}`, JSON.stringify({ ts: Date.now() }));
    const list = new Set(JSON.parse(await env.SESSIONS.get(`ru:${user.id}`) || "[]")); list.add(gid);
    await env.SESSIONS.put(`ru:${user.id}`, JSON.stringify([...list]));
    return rjBack(env, "ok", clear, gid);
  } catch (_) {
    return rjBack(env, "error", clear, rj ? rj[1] : "");
  }
}
async function rjAccessToken(env, uid) {
  const t = await rjOpen(env, await env.SESSIONS.get(`rt:${uid}`) || "");
  if (!t) return null;
  if (Date.now() < t.exp) return t.access;
  const r = await fetch(`${DISCORD}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: t.refresh }) });
  if (!r.ok) return r.status === 400 || r.status === 401 ? "" : null;
  const n = await r.json();
  await env.SESSIONS.put(`rt:${uid}`, await rjSeal(env, { access: n.access_token, refresh: n.refresh_token || t.refresh, exp: Date.now() + (n.expires_in || 604800) * 1000 - 60000 }));
  return n.access_token;
}
async function dashMembersGet(env, req, gid) {
  const r = await dashGuild(env, req, gid); if (r.err) return r.err;
  const km = JSON.parse(await env.SESSIONS.get(`km:${gid}`) || "null"), l = km && km.enabled ? await env.SESSIONS.list({ prefix: `rc:${gid}:`, limit: 1000 }) : { keys: [] };
  return json(env, req, { available: !!(env.TOKEN_ENC_KEY && env.BOT_TOKEN), owner: !!r.g.owner, enabled: !!(km && km.enabled), count: l.keys.length, more: l.list_complete === false, link: `${env.SITE_ORIGIN}/rejoin?guild=${gid}` }, 200, { "Cache-Control": "no-store" });
}
async function dashMembersSet(env, req, gid) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const r = await dashGuild(env, req, gid); if (r.err) return r.err;
  if (!env.TOKEN_ENC_KEY) return json(env, req, { error: "unavailable", message: "This feature isn't configured yet." }, 503);
  if (!r.g.owner) return json(env, req, { error: "owner_only", message: "Only the server owner can change this." }, 403);
  let b; try { b = await readBody(req); } catch (_) { return json(env, req, { error: "bad_request" }, 400); }
  if (b.enabled) {
    const g = await botCall(env, "GET", `/guilds/${gid}`);
    if (!g.ok) return json(env, req, { error: "bot_missing", message: "Add Sentinel to the server first." }, 400);
    await env.SESSIONS.put(`km:${gid}`, JSON.stringify({ enabled: true, owner: (await g.json()).owner_id, ts: Date.now() }));
  } else {
    await env.SESSIONS.delete(`km:${gid}`);
    let cursor;
    do {
      const l = await env.SESSIONS.list({ prefix: `rc:${gid}:`, limit: 200, cursor });
      for (const k of l.keys) await rjDrop(env, k.name.split(":")[2], gid);
      cursor = l.list_complete ? null : l.cursor;
    } while (cursor);
  }
  return json(env, req, { ok: true });
}
async function botRejoinRun(env, req) {
  const bad = await botKeyOK(env, req); if (bad) return bad;
  let b; try { b = await readBody(req); } catch (_) { return json(env, req, { error: "bad_request" }, 400); }
  const src = String(b.source || ""), dst = String(b.target || "");
  if (!SNOWFLAKE.test(src) || !SNOWFLAKE.test(dst) || !env.TOKEN_ENC_KEY || !env.BOT_TOKEN) return json(env, req, { error: "bad_request" }, 400);
  const km = JSON.parse(await env.SESSIONS.get(`km:${src}`) || "null");
  if (!km || !km.enabled) return json(env, req, { enabled: false, done: true });
  const g = await botCall(env, "GET", `/guilds/${dst}`);
  if (!g.ok || (await g.json()).owner_id !== km.owner) return json(env, req, { error: "not_owner", message: "Only the original server owner can bring members back." }, 403);
  const l = await env.SESSIONS.list({ prefix: `rc:${src}:`, limit: 15, cursor: b.cursor || void 0 });
  const out = { enabled: true, joined: 0, already: 0, failed: 0, done: !!l.list_complete, cursor: l.list_complete ? null : l.cursor };
  for (const k of l.keys) {
    const uid = k.name.split(":")[2], at = await rjAccessToken(env, uid);
    if (at === "") { await rjDrop(env, uid, src); out.failed++; continue; }
    if (!at) { out.failed++; continue; }
    const r = await botCall(env, "PUT", `/guilds/${dst}/members/${uid}`, { access_token: at }, "Sentinel backup restore");
    if (r.status === 201) out.joined++; else if (r.status === 204) out.already++;
    else if (r.status === 429) { out.retry = Number(r.headers.get("Retry-After") || 5); out.done = false; out.cursor = b.cursor || null; break; }
    else out.failed++;
  }
  return json(env, req, out);
}
const VERIFY_STATE = /^v-(\d{15,25})-/;
const VERIFY_TTL = 60 * 15;
const UA = "SentinelAuth (https://sentineldashboard.site, 1.0)";
const DISCORD_EPOCH = 14200704e5;
const verifyBack = (env, guild, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/verify?guild=${guild}&auth=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};
const botCall = (env, method, path, body, reason) => {
  const h = { Authorization: `Bot ${env.BOT_TOKEN}`, "User-Agent": UA };
  if (body) h["Content-Type"] = "application/json";
  if (reason) h["X-Audit-Log-Reason"] = encodeURIComponent(reason);
  return fetch(DISCORD + path, { method, headers: h, body: body ? JSON.stringify(body) : void 0 });
};
const intIn = (v, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
};
async function verifyRegister(env, req) {
  if (!env.BOT_API_KEY) return json(env, req, { error: "misconfigured", missing: ["BOT_API_KEY"] }, 500);
  const given = req.headers.get("X-Sentinel-Key") || "";
  if (!safeEqual(await sign(env.STATE_SECRET, given), await sign(env.STATE_SECRET, env.BOT_API_KEY)))
    return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await req.json();
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  if (!b || !SNOWFLAKE.test(String(b.guild_id)) || !SNOWFLAKE.test(String(b.role_id))) return json(env, req, { error: "bad_request" }, 400);
  const cfg = {
    role_id: String(b.role_id),
    unverified_role_id: SNOWFLAKE.test(String(b.unverified_role_id || "")) ? String(b.unverified_role_id) : null,
    log_channel_id: SNOWFLAKE.test(String(b.log_channel_id || "")) ? String(b.log_channel_id) : null,
    min_account_age_days: intIn(b.min_account_age_days, 3650),
    min_server_age_days: intIn(b.min_server_age_days, 3650),
    guild_name: String(b.guild_name || "").slice(0, 100),
    guild_icon: /^[a-z0-9_]{1,64}$/i.test(String(b.guild_icon || "")) ? String(b.guild_icon) : null,
    updated: Date.now()
  };
  await env.SESSIONS.put(`v:${b.guild_id}`, JSON.stringify(cfg));
  return json(env, req, { ok: true, verify_url: `${env.SITE_ORIGIN}/verify?guild=${b.guild_id}` });
}
async function vConfig(env, guild) {
  if (!SNOWFLAKE.test(guild || "")) return null;
  const raw = await env.SESSIONS.get(`v:${guild}`);
  return raw ? JSON.parse(raw) : null;
}
async function verifyInfo(env, req) {
  const guild = new URL(req.url).searchParams.get("guild");
  const cfg = await vConfig(env, guild);
  return json(env, req, {
    configured: !!cfg,
    guildName: cfg ? cfg.guild_name : null,
    iconUrl: cfg && cfg.guild_icon ? cdn("icons", guild, cfg.guild_icon) : null,
    captcha: !!(env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY),
    siteKey: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null
  });
}
async function verifyLogin(env, req) {
  const guild = new URL(req.url).searchParams.get("guild");
  if (!SNOWFLAKE.test(guild || "") || !await vConfig(env, guild)) return Response.redirect(`${env.SITE_ORIGIN}/verify?guild=${SNOWFLAKE.test(guild || "") ? guild : ""}&auth=error`, 302);
  const state = `v-${guild}-${rand(12)}`;
  const sig = await sign(env.STATE_SECRET, state);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    scope: "identify",
    redirect_uri: `${env.API_ORIGIN}/auth/callback`,
    state,
    prompt: "none"
  });
  return new Response(null, { status: 302, headers: {
    Location: url.toString(),
    "Cache-Control": "no-store",
    "Set-Cookie": cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" })
  } });
}
async function verifyCallback(env, code, guild, clear) {
  try {
    const tok = await exchange(env, code);
    const user = await dget("/users/@me", `Bearer ${tok.access_token}`);
    revoke(env, tok.access_token);
    const sid = rand(32);
    await env.SESSIONS.put(`vs:${sid}`, JSON.stringify({ uid: user.id, name: user.global_name || user.username, avatar: user.avatar, guild }), { expirationTtl: VERIFY_TTL });
    return verifyBack(env, guild, "ok", [clear, ["Set-Cookie", cookie("sentinel_verify", sid, { maxAge: VERIFY_TTL, path: "/verify" })]]);
  } catch (_) {
    return verifyBack(env, guild, "error", [clear]);
  }
}
async function vSession(env, req, guild) {
  const sid = cookies(req).sentinel_verify;
  if (!sid || !/^[A-Za-z0-9_-]{20,64}$/.test(sid)) return null;
  const raw = await env.SESSIONS.get(`vs:${sid}`);
  if (!raw) return null;
  const d = JSON.parse(raw);
  return d.guild === guild ? { sid, ...d } : null;
}
async function evaluate(env, cfg, guild, uid) {
  const r = await botCall(env, "GET", `/guilds/${guild}/members/${uid}`);
  if (r.status === 404) return { code: "not_member" };
  if (!r.ok) return { code: "bot_error" };
  const m = await r.json();
  if (Array.isArray(m.roles) && m.roles.includes(cfg.role_id)) return { code: "already" };
  const created = Number(BigInt(uid) >> 22n) + DISCORD_EPOCH;
  if (cfg.min_account_age_days && Date.now() - created < cfg.min_account_age_days * 864e5) return { code: "account_too_new", days: cfg.min_account_age_days };
  const joined = m.joined_at ? Date.parse(m.joined_at) : 0;
  if (cfg.min_server_age_days && joined && Date.now() - joined < cfg.min_server_age_days * 864e5) return { code: "joined_too_recently", days: cfg.min_server_age_days };
  return { code: "ok", member: m };
}
async function verifyStatus(env, req) {
  const guild = new URL(req.url).searchParams.get("guild");
  const cfg = await vConfig(env, guild), s = cfg && await vSession(env, req, guild);
  if (!cfg) return json(env, req, { error: "not_configured" }, 404);
  if (!s) return json(env, req, { error: "unauthenticated" }, 401);
  const ev = await evaluate(env, cfg, guild, s.uid);
  return json(env, req, { user: { name: s.name, avatarUrl: cdn("avatars", s.uid, s.avatar) }, status: ev.code, days: ev.days || null });
}
async function verifyComplete(env, req) {
  if (req.headers.get("Origin") !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await req.json();
  } catch (_) {
    b = {};
  }
  const guild = String(b.guild || "");
  const cfg = await vConfig(env, guild);
  if (!cfg) return json(env, req, { error: "not_configured" }, 404);
  const s = await vSession(env, req, guild);
  if (!s) return json(env, req, { error: "unauthenticated" }, 401);
  if (env.TURNSTILE_SECRET) {
    const t = String(b.turnstile || "");
    let ok = false;
    if (t) {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t, remoteip: req.headers.get("CF-Connecting-IP") || "" })
      });
      ok = r.ok && (await r.json()).success === true;
    }
    if (!ok) return json(env, req, { error: "captcha_failed" }, 400);
  }
  if (await env.SESSIONS.get(`cd:${s.uid}`)) return json(env, req, { error: "slow_down" }, 429);
  const ev = await evaluate(env, cfg, guild, s.uid);
  if (ev.code === "already") return json(env, req, { ok: true, already: true });
  if (ev.code !== "ok") return json(env, req, { error: ev.code, days: ev.days || null }, ev.code === "bot_error" ? 502 : 403);
  await env.SESSIONS.put(`cd:${s.uid}`, "1", { expirationTtl: 60 });
  const add = await botCall(env, "PUT", `/guilds/${guild}/members/${s.uid}/roles/${cfg.role_id}`, null, "Sentinel web verification");
  if (!add.ok) return json(env, req, { error: "role_failed" }, 502);
  if (cfg.unverified_role_id) await botCall(env, "DELETE", `/guilds/${guild}/members/${s.uid}/roles/${cfg.unverified_role_id}`, null, "Sentinel web verification").catch(() => {
  });
  if (cfg.log_channel_id) await botCall(env, "POST", `/channels/${cfg.log_channel_id}/messages`, {
    embeds: [{ title: "Member verified", description: `<@${s.uid}> completed verification on the website.`, color: 4963945 }],
    allowed_mentions: { parse: [] }
  }).catch(() => {
  });
  await env.SESSIONS.delete(`vs:${s.sid}`);
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_verify", "", { maxAge: 0, path: "/verify" }) });
}
const PROFILE_RESERVED = new Set(["account", "u", "api", "profile", "profile-editor", "dashboard", "support", "admin", "auth", "assets", "terms", "privacy", "features", "commands", "docs", "status", "verify", "premium", "team", "sentinel", "www"]);
const profileSlugOK = (s) => /^[a-z0-9][a-z0-9_-]{0,23}$/.test(s) && !PROFILE_RESERVED.has(s);
const profileNewSlugOK = (s) => /^[a-z0-9][a-z0-9_-]{0,15}$/.test(s) && !PROFILE_RESERVED.has(s);
function profileText(v, max) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
function safeHttpUrl(value, max = 500, httpsOnly = false) {
  const s = profileText(value, max);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (!(httpsOnly ? u.protocol === "https:" : u.protocol === "https:" || u.protocol === "http:")) return "";
    if (u.username || u.password) return "";
    return u.toString();
  } catch (_) {
    return "";
  }
}
function safeProfileBackground(v) {
  const s = profileText(v, 180);
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(s)) return s;
  const gradient = /^linear-gradient\((?:to (?:right|left|top|bottom|top right|top left|bottom right|bottom left)|\d{1,3}deg),\s*#[0-9a-f]{3,8}\s*,\s*#[0-9a-f]{3,8}(?:\s*,\s*#[0-9a-f]{3,8})?\)$/i;
  return gradient.test(s) ? s : "linear-gradient(135deg, #0b1020, #29204d)";
}
function safeMusicUrl(value) {
  const s = safeHttpUrl(value, 500, true);
  if (!s) return "";
  try {
    const u = new URL(s), host = u.hostname.toLowerCase();
    if ((host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") && u.pathname === "/watch" && /^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get("v") || "")) return "https://www.youtube.com/watch?v=" + u.searchParams.get("v");
    if ((host === "youtu.be" || host === "www.youtu.be") && /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1))) return "https://www.youtube.com/watch?v=" + u.pathname.slice(1);
    if ((host === "open.spotify.com" || host === "www.open.spotify.com") && /^\/(?:track|album|playlist|episode|show)\/[A-Za-z0-9]+\/?$/.test(u.pathname)) return "https://open.spotify.com" + u.pathname.replace(/\/$/, "");
  } catch (_) {
  }
  return "";
}
const OWNER_HASH = "b658adb64cf43b60ce2a8bf811350a63467aa3a2ebfaf286408934344435495b";
const OWNER_USERNAMES = new Set(["ben"]);
const D = (s) => Date.parse(s + "T00:00:00Z");
const BADGES = {
  owner: { label: "Owner", icon: "👑", color: "#f5c542", tier: "staff", kind: "owner", desc: "Founder and owner of Sentinel.", how: "Reserved for the owner." },
  coowner: { label: "Co-Owner", icon: "💠", color: "#7dd3fc", tier: "staff", kind: "manual", desc: "Co-owner of Sentinel.", how: "Given by the owner." },
  admin: { label: "Admin", icon: "🛡️", color: "#f87171", tier: "staff", kind: "manual", desc: "Sentinel administrator.", how: "Given by the owner." },
  moderator: { label: "Moderator", icon: "⚔️", color: "#fb923c", tier: "staff", kind: "manual", desc: "Sentinel moderator.", how: "Given by the owner." },
  developer: { label: "Developer", icon: "💻", color: "#a78bfa", tier: "staff", kind: "manual", desc: "Works on Sentinel's code.", how: "Given by the owner." },
  support: { label: "Support Team", icon: "🎧", color: "#34d399", tier: "staff", kind: "manual", desc: "Helps members on the support server.", how: "Given by the owner." },
  partner: { label: "Partner", icon: "🤝", color: "#60a5fa", tier: "special", kind: "manual", desc: "Official Sentinel partner.", how: "Given by the owner." },
  creator: { label: "Content Creator", icon: "🎬", color: "#fb7185", tier: "special", kind: "manual", desc: "Creates content about Sentinel.", how: "Given by the owner." },
  premium: { label: "Premium", icon: "💎", color: "#22d3ee", tier: "special", kind: "manual", desc: "Sentinel Premium member.", how: "Given by the owner." },
  supporter: { label: "Supporter", icon: "💜", color: "#c084fc", tier: "special", kind: "manual", desc: "Supports Sentinel's development.", how: "Given by the owner." },
  bughunter: { label: "Bug Hunter", icon: "🐞", color: "#fbbf24", tier: "special", kind: "manual", desc: "Reported a bug that got fixed.", how: "Given by the owner." },
  beta: { label: "Beta Tester", icon: "🧪", color: "#86efac", tier: "special", kind: "manual", desc: "Helped test Sentinel before release.", how: "Given by the owner." },
  founding: { label: "Founding Member", icon: "🌟", color: "#fde047", tier: "member", kind: "auto", desc: "Joined Sentinel in its first months.", how: "Create your account before December 2026." },
  verified: { label: "Verified", icon: "✅", color: "#4ade80", tier: "member", kind: "auto", desc: "Has a verified email address.", how: "Verify your email address." },
  discord: { label: "Discord Linked", icon: "🔗", color: "#818cf8", tier: "member", kind: "auto", desc: "Linked a Discord account.", how: "Link Discord in your account page." },
  google: { label: "Google Linked", icon: "G", color: "#60a5fa", tier: "member", kind: "auto", desc: "Linked a Google account.", how: "Link Google in your account page." },
  steam: { label: "Steam Linked", icon: "🎮", color: "#66c0f4", tier: "member", kind: "auto", desc: "Linked a Steam account.", how: "Link Steam in your account page." },
  halloween2026: { label: "Halloween 2026", icon: "🎃", color: "#fb923c", tier: "event", kind: "event", desc: "Joined the Halloween 2026 event.", how: "Save your profile between Oct 15 and Nov 1, 2026.", from: D("2026-10-15"), to: D("2026-11-02") },
  christmas2026: { label: "Christmas 2026", icon: "🎄", color: "#4ade80", tier: "event", kind: "event", desc: "Celebrated Christmas 2026 on Sentinel.", how: "Save your profile between Dec 1 and Dec 26, 2026.", from: D("2026-12-01"), to: D("2026-12-27") },
  newyear2027: { label: "New Year 2027", icon: "🎆", color: "#facc15", tier: "event", kind: "event", desc: "Started 2027 on Sentinel.", how: "Save your profile between Dec 27, 2026 and Jan 7, 2027.", from: D("2026-12-27"), to: D("2027-01-08") },
  autumn2026: { label: "Autumn 2026", icon: "🍂", color: "#f59e0b", tier: "event", kind: "event", desc: "Was here in autumn 2026.", how: "Save your profile between Sep 22 and Dec 20, 2026.", from: D("2026-09-22"), to: D("2026-12-21") },
  winter2027: { label: "Winter 2026-27", icon: "❄️", color: "#93c5fd", tier: "event", kind: "event", desc: "Was here in winter 2026-27.", how: "Save your profile between Dec 21, 2026 and Mar 19, 2027.", from: D("2026-12-21"), to: D("2027-03-20") },
  spring2027: { label: "Spring 2027", icon: "🌸", color: "#f9a8d4", tier: "event", kind: "event", desc: "Was here in spring 2027.", how: "Save your profile between Mar 20 and Jun 20, 2027.", from: D("2027-03-20"), to: D("2027-06-21") },
  summer2027: { label: "Summer 2027", icon: "☀️", color: "#fcd34d", tier: "event", kind: "event", desc: "Was here in summer 2027.", how: "Save your profile between Jun 21 and Sep 21, 2027.", from: D("2027-06-21"), to: D("2027-09-22") }
};
const BADGE_ORDER = ["owner", "coowner", "admin", "moderator", "developer", "support", "partner", "creator", "premium", "supporter", "bughunter", "beta", "founding", "verified", "discord", "google", "steam", "halloween2026", "christmas2026", "newyear2027", "autumn2026", "winter2027", "spring2027", "summer2027"];
async function badgeGrants(env, ownerHash) {
  const raw = await env.SESSIONS.get(`bg:${ownerHash}`);
  try {
    const g = raw ? JSON.parse(raw) : {};
    return { manual: Array.isArray(g.manual) ? g.manual.filter((id) => BADGES[id]) : [], earned: Array.isArray(g.earned) ? g.earned.filter((id) => BADGES[id]) : [] };
  } catch (_) {
    return { manual: [], earned: [] };
  }
}
async function awardEventBadges(env, ownerHash) {
  const g = await badgeGrants(env, ownerHash), now = Date.now();
  let changed = false;
  for (const [id, bd] of Object.entries(BADGES)) if (bd.kind === "event" && now >= bd.from && now < bd.to && !g.earned.includes(id)) {
    g.earned.push(id);
    changed = true;
  }
  if (changed) await env.SESSIONS.put(`bg:${ownerHash}`, JSON.stringify(g));
}
async function earnedBadgeIds(env, ownerHash, account) {
  const g = await badgeGrants(env, ownerHash), ids = new Set([...g.manual, ...g.earned]), ok = !!(account && account.verified);
  if (ownerHash === OWNER_HASH && ok) ids.add("owner");
  if (ok) ids.add("verified");
  if (account && account.discord && account.discord.id) ids.add("discord");
  if (account && account.google && account.google.sub) ids.add("google");
  if (account && account.steam && account.steam.id) ids.add("steam");
  const created = Number(account && account.created);
  if (ok && Number.isFinite(created) && created > 0 && created < D("2026-12-01")) ids.add("founding");
  return BADGE_ORDER.filter((id) => ids.has(id));
}
const badgeShape = (id) => ({ id, label: BADGES[id].label, icon: BADGES[id].icon, color: BADGES[id].color, tier: BADGES[id].tier, desc: BADGES[id].desc });
async function badgesFor(env, p, account, includeHidden) {
  const ids = await earnedBadgeIds(env, p.ownerHash, account), hidden = new Set(p.hiddenBadges || []);
  return ids.filter((id) => includeHidden || !hidden.has(id)).map(badgeShape);
}
function badgeCatalog(earned) {
  const have = new Set(earned);
  return BADGE_ORDER.map((id) => ({ ...badgeShape(id), kind: BADGES[id].kind, how: BADGES[id].how, earned: have.has(id) }));
}
async function adminAuth(env, req) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return null;
  const h = await digest(s.data.accountEmail.trim().toLowerCase());
  if (h !== OWNER_HASH) return null;
  const raw = await env.SESSIONS.get(`a:${h}`), a = raw ? JSON.parse(raw) : null;
  return a && a.verified ? { ownerHash: h } : null;
}
async function adminBadge(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  if (!await adminAuth(env, req)) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const username = profileText(b.username, 25).toLowerCase().replace(/^@/, ""), id = String(b.badge || ""), action = b.action === "revoke" ? "revoke" : b.action === "grant" ? "grant" : "";
  if (!profileSlugOK(username) || !action) return json(env, req, { error: "bad_request", message: "Enter a valid username." }, 400);
  if (!BADGES[id] || BADGES[id].kind === "auto" || id === "owner") return json(env, req, { error: "bad_badge", message: "That badge cannot be granted manually." }, 400);
  const raw = await env.SESSIONS.get(`p:${username}`);
  if (!raw) return json(env, req, { error: "profile_not_found", message: "No profile with that username." }, 404);
  const p = JSON.parse(raw), g = await badgeGrants(env, p.ownerHash);
  if (action === "grant") {
    if (!g.manual.includes(id)) g.manual.push(id);
  } else {
    g.manual = g.manual.filter((x) => x !== id);
    g.earned = g.earned.filter((x) => x !== id);
  }
  await env.SESSIONS.put(`bg:${p.ownerHash}`, JSON.stringify(g));
  return json(env, req, { ok: true, username, manual: g.manual, earned: g.earned });
}
async function adminLookup(env, req) {
  if (!await adminAuth(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const username = profileText(new URL(req.url).searchParams.get("username"), 25).toLowerCase().replace(/^@/, "");
  const raw = profileSlugOK(username) ? await env.SESSIONS.get(`p:${username}`) : null;
  if (!raw) return json(env, req, { error: "profile_not_found" }, 404);
  const g = await badgeGrants(env, JSON.parse(raw).ownerHash);
  return json(env, req, { username, manual: g.manual, earned: g.earned });
}
async function friendCard(env, slug) {
  if (!profileSlugOK(slug)) return null;
  const raw = await env.SESSIONS.get(`p:${slug}`);
  if (!raw) return null;
  const f = JSON.parse(raw), araw = await env.SESSIONS.get(`a:${f.ownerHash}`), acc = araw ? JSON.parse(araw) : null;
  return { username: f.username, displayName: f.displayName || f.username, avatarUrl: f.avatarUrl || (acc && acc.discord ? cdn("avatars", acc.discord.id, acc.discord.avatar) || "" : "") };
}
async function resolveFriends(env, slugs) {
  const out = [];
  for (const sl of (Array.isArray(slugs) ? slugs : []).slice(0, 8)) {
    const c = await friendCard(env, sl).catch(() => null);
    if (c) out.push(c);
  }
  return out;
}
async function profileLookup(env, req) {
  const u = profileText(new URL(req.url).searchParams.get("u"), 24).toLowerCase().replace(/^@/, "");
  const c = await friendCard(env, u);
  if (!c) return json(env, req, { error: "not_found", message: "No profile with that username." }, 404);
  return json(env, req, { ok: true, ...c });
}
function profilePublicShape(p, views, account, badges) {
  return {
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: p.avatarUrl || (account && account.discord ? cdn("avatars", account.discord.id, account.discord.avatar) || "" : ""),
    bannerUrl: p.bannerUrl,
    backgroundUrl: p.backgroundUrl,
    background: p.background,
    accentColor: p.accentColor,
    status: p.status,
    statusEmoji: p.statusEmoji,
    links: p.links || [],
    widgets: p.widgets || [],
    musicUrl: p.musicUrl,
    backgroundVideoUrl: p.backgroundVideoUrl || "",
    audioAssets: p.audioAssets || [],
    audioMeta: p.audioMeta || [],
    sections: p.sections || [],
    friends: p.friends || [],
    mediaAssets: p.mediaAssets || [],
    badges: badges || [],
    views: Number(views || 0),
    customization: p.customization || {},
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}
async function profileMe(env, req) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  const ownerHash = await digest(s.data.accountEmail.trim().toLowerCase());
  const accountRaw = await env.SESSIONS.get(`a:${ownerHash}`), account = accountRaw ? JSON.parse(accountRaw) : null;
  const earned = await earnedBadgeIds(env, ownerHash, account);
  const extra = { allBadges: earned.map(badgeShape), catalog: badgeCatalog(earned), isOwner: ownerHash === OWNER_HASH && !!(account && account.verified) };
  const slug = await env.SESSIONS.get(`pa:${ownerHash}`);
  extra.steamLinked = !!(account && account.steam);
  if (!slug) return json(env, req, { profile: null, hiddenBadges: [], ...extra });
  const raw = await env.SESSIONS.get(`p:${slug}`);
  if (!raw) {
    await env.SESSIONS.delete(`pa:${ownerHash}`);
    return json(env, req, { profile: null, hiddenBadges: [], ...extra });
  }
  const p = JSON.parse(raw);
  const mine = profilePublicShape(p, await env.SESSIONS.get(`pv:${slug}`), account, await badgesFor(env, p, account));
  mine.friendsData = await resolveFriends(env, p.friends);
  if (account && account.steam && account.steam.id) mine.steam = await steamData(env, account.steam.id).catch(() => null);
  return json(env, req, { profile: mine, steamLinked: !!(account && account.steam), hiddenBadges: p.hiddenBadges || [], nameChanges: Number(p.nameChanges) || 0, canRename: (Number(p.nameChanges) || 0) < 1 || ownerHash === OWNER_HASH, ...extra, url: `${env.SITE_ORIGIN}/u/${slug}` });
}
async function profileSave(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return json(env, req, { error: "unauthenticated" }, 401);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const ownerHash = await digest(s.data.accountEmail.trim().toLowerCase());
  const accountRaw = await env.SESSIONS.get(`a:${ownerHash}`), account = accountRaw ? JSON.parse(accountRaw) : null;
  if (!account || !account.verified) return json(env, req, { error: "email_not_verified" }, 403);
  const username = profileText(b.username, 24).toLowerCase();
  const prevName = await env.SESSIONS.get(`pa:${ownerHash}`);
  if (!(username === prevName ? profileSlugOK(username) : profileNewSlugOK(username))) return json(env, req, { error: "invalid_username", message: "Use 1–16 lowercase letters, numbers, hyphens or underscores. Some names are reserved." }, 400);
  if (OWNER_USERNAMES.has(username) && ownerHash !== OWNER_HASH) return json(env, req, { error: "username_taken", message: "That profile URL is reserved." }, 409);
  const ownerIndex = `pa:${ownerHash}`, previousSlug = await env.SESSIONS.get(ownerIndex);
  let nameChanges = 0;
  if (previousSlug) {
    const prevRaw = await env.SESSIONS.get(`p:${previousSlug}`);
    if (prevRaw) {
      try {
        nameChanges = Number(JSON.parse(prevRaw).nameChanges) || 0;
      } catch (_) {
      }
    }
  }
  const renaming = !!previousSlug && previousSlug !== username;
  if (renaming && nameChanges >= 1 && !(ownerHash === OWNER_HASH)) return json(env, req, { error: "username_change_limit", message: "You already changed your username once. It can't be changed again." }, 403);
  const existingRaw = await env.SESSIONS.get(`p:${username}`);
  if (existingRaw) {
    const existing = JSON.parse(existingRaw);
    if (existing.ownerHash !== ownerHash) return json(env, req, { error: "username_taken", message: "That profile URL is already taken." }, 409);
  }
  const linksIn = Array.isArray(b.links) ? b.links.slice(0, 20) : [];
  const links = [];
  for (const item of linksIn) {
    if (!item || typeof item !== "object") continue;
    const label = profileText(item.label, 40);
    if (item.kind === "header") {
      if (label) links.push({ kind: "header", label });
      continue;
    }
    const url = safeHttpUrl(item.url, 500);
    if (!label || !url) continue;
    const entry = { label, url };
    const icon = profileText(item.icon, 4), desc = profileText(item.desc, 80);
    if (icon) entry.icon = icon;
    if (desc) entry.desc = desc;
    if (item.featured === true) entry.featured = true;
    links.push(entry);
  }
  const widgetsIn = Array.isArray(b.widgets) ? b.widgets.slice(0, 10) : [];
  const widgets = [];
  for (const item of widgetsIn) {
    if (!item || typeof item !== "object") continue;
    const type = ["text", "quote", "link", "gallery", "countdown", "stats"].includes(item.type) ? item.type : "text";
    const title = profileText(item.title, 50), url = type === "link" ? safeHttpUrl(item.url, 500) : "";
    let content = "";
    if (type === "gallery") {
      content = String(item.content || "").split(/\s+/).map((u) => safeHttpUrl(u, 500, true)).filter(Boolean).slice(0, 6).join("\n");
    } else if (type === "countdown") {
      const d = String(item.content || "").trim();
      content = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : "";
    } else if (type === "stats") {
      content = String(item.content || "").split("\n").slice(0, 4).map((l) => {
        const [a, ...r] = l.split("|");
        const k = profileText(a, 24), v = profileText(r.join("|"), 24);
        return k && v ? k + "|" + v : "";
      }).filter(Boolean).join("\n");
    } else content = profileText(item.content, 500);
    if (title || content || type === "link" && url) widgets.push({ id: rand(8), type, title, content, url });
  }
  const c = b.customization && typeof b.customization === "object" ? b.customization : {};
  const enumVal = (key, allowed, fallback) => allowed.includes(String(c[key] ?? "")) ? String(c[key]) : fallback;
  const intVal = (key, min, max, fallback) => {
    const n = Number(c[key]);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  const boolVal = (key, fallback = true) => typeof c[key] === "boolean" ? c[key] : fallback;
  const colorVal = (key, fallback) => /^#[0-9a-f]{6}$/i.test(String(c[key] || "")) ? String(c[key]) : fallback;
  const customization = {
    // --- structure ---
    layout: enumVal("layout", ["centered", "left", "wide"], "centered"),
    respectReducedMotion: boolVal("respectReducedMotion", false),
    linkColumns: enumVal("linkColumns", ["1", "2"], "1"),
    widgetsFirst: boolVal("widgetsFirst", false),
    showShare: boolVal("showShare", true),
    linkIconShape: enumVal("linkIconShape", ["circle", "square", "none"], "square"),
    cardStyle: enumVal("cardStyle", ["glass", "solid", "outline", "minimal"], "glass"),
    contentWidth: intVal("contentWidth", 320, 1200, 900),
    bannerHeight: intVal("bannerHeight", 0, 360, 220),
    avatarShape: enumVal("avatarShape", ["circle", "rounded", "square"], "circle"),
    widgetColumns: enumVal("widgetColumns", ["1", "2", "3"], "2"),
    alignment: enumVal("alignment", ["center", "left"], "center"),
    spacing: enumVal("spacing", ["compact", "normal", "relaxed"], "normal"),
    cardVAlign: enumVal("cardVAlign", ["top", "center"], "top"),
    // --- colors ---
    pageColor: colorVal("pageColor", "#090d17"),
    cardColor: colorVal("cardColor", "#0b1020"),
    textColor: colorVal("textColor", "#f5f7ff"),
    mutedColor: colorVal("mutedColor", "#98a6bf"),
    borderColor: colorVal("borderColor", "#ffffff"),
    widgetColor: colorVal("widgetColor", "#ffffff"),
    nameColor2: colorVal("nameColor2", "#ffffff"),
    glowColor: colorVal("glowColor", "#8b7cff"),
    cursorColor: colorVal("cursorColor", "#ffffff"),
    particleColor: colorVal("particleColor", "#ffffff"),
    // --- surface ---
    overlay: enumVal("overlay", ["none", "light", "medium", "strong"], "medium"),
    bgDim: intVal("bgDim", 0, 95, c.overlay === "none" ? 0 : c.overlay === "light" ? 25 : c.overlay === "strong" ? 80 : 55),
    bgBlur: intVal("bgBlur", 0, 24, 0),
    blur: intVal("blur", 0, 40, 18),
    radius: intVal("radius", 0, 40, 24),
    glowStrength: intVal("glowStrength", 0, 80, 0),
    shadow: enumVal("shadow", ["none", "soft", "deep", "colored"], "soft"),
    hoverEffect: enumVal("hoverEffect", ["none", "lift", "glow", "scale"], "lift"),
    animation: enumVal("animation", ["none", "fade", "rise", "zoom", "blur"], "fade"),
    borderStyle: enumVal("borderStyle", ["none", "subtle", "accent"], "subtle"),
    // --- visibility ---
    showBio: boolVal("showBio"),
    showStatus: boolVal("showStatus"),
    showBadges: boolVal("showBadges"),
    showLinks: boolVal("showLinks"),
    showPage2: boolVal("showPage2", true),
    page2Hint: boolVal("page2Hint", true),
    friendsTitle: profileText(c.friendsTitle, 30) || "Best friends",
    friendsStyle: enumVal("friendsStyle", ["cards", "avatars"], "cards"),
    showLyrics: boolVal("showLyrics", true),
    lyricsPlace: enumVal("lyricsPlace", ["below", "bottom", "center", "page"], "below"),
    lyricsStyle: enumVal("lyricsStyle", ["lines", "scroll"], "lines"),
    lyricsFont: enumVal("lyricsFont", ["inherit", "system", "inter", "mono", "serif", "bricolage", "instrument"], "inherit"),
    lyricsSize: intVal("lyricsSize", 12, 48, 18),
    lyricsColor: colorVal("lyricsColor", ""),
    lyricsAlign: enumVal("lyricsAlign", ["left", "center", "right"], "center"),
    lyricsGlow: boolVal("lyricsGlow", false),
    showSteam: boolVal("showSteam", false),
    steamGames: enumVal("steamGames", ["top", "recent", "none"], "top"),
    showWidgets: boolVal("showWidgets"),
    showMusic: boolVal("showMusic"),
    showViews: boolVal("showViews"),
    showBranding: boolVal("showBranding"),
    showAvatar: boolVal("showAvatar"),
    showHandle: boolVal("showHandle"),
    showBanner: boolVal("showBanner"),
    showFooter: boolVal("showFooter"),
    showLocation: boolVal("showLocation"),
    showJoined: boolVal("showJoined", false),
    // --- text ---
    linkStyle: enumVal("linkStyle", ["glass", "solid", "outline", "minimal"], "glass"),
    badgeStyle: enumVal("badgeStyle", ["pill", "square", "minimal", "icons"], "pill"),
    fontFamily: enumVal("fontFamily", ["system", "inter", "mono", "serif", "bricolage", "instrument"], "system"),
    nameSize: intVal("nameSize", 24, 72, 42),
    letterSpacing: enumVal("letterSpacing", ["tight", "normal", "wide"], "normal"),
    bannerPosition: enumVal("bannerPosition", ["center", "top", "bottom", "left", "right"], "center"),
    tagline: profileText(c.tagline, 160),
    footerText: profileText(c.footerText, 100),
    location: profileText(c.location, 40),
    pageTitle: profileText(c.pageTitle, 60),
    embedTitle: profileText(c.embedTitle, 80),
    embedDescription: profileText(c.embedDescription, 200),
    embedColor: colorVal("embedColor", "#5865f2"),
    embedImage: enumVal("embedImage", ["avatar", "banner", "none"], "avatar"),
    embedLarge: boolVal("embedLarge", false),
    nameEffect: enumVal("nameEffect", ["none", "glow", "gradient", "shimmer", "glitch", "neon"], "none"),
    taglineTypewriter: boolVal("taglineTypewriter", false),
    bioTypewriter: boolVal("bioTypewriter", false),
    // --- avatar / links ---
    avatarSize: intVal("avatarSize", 64, 200, 112),
    widgetGap: intVal("widgetGap", 6, 28, 12),
    cardOpacity: intVal("cardOpacity", 0, 100, 86),
    bioSize: intVal("bioSize", 12, 22, 15),
    avatarBorder: enumVal("avatarBorder", ["accent", "none", "white"], "accent"),
    avatarEffect: enumVal("avatarEffect", ["none", "glow", "pulse", "spin"], "none"),
    bannerOverlay: enumVal("bannerOverlay", ["none", "soft", "strong"], "none"),
    linkAlignment: enumVal("linkAlignment", ["center", "left"], "center"),
    linkRadius: intVal("linkRadius", 0, 30, 12),
    widgetStyle: enumVal("widgetStyle", ["glass", "solid", "outline"], "glass"),
    linkDisplay: enumVal("linkDisplay", ["buttons", "icons", "chips"], "buttons"),
    iconSize: intVal("iconSize", 16, 48, 26),
    iconColorMode: enumVal("iconColorMode", ["brand", "accent", "text"], "brand"),
    // --- effects ---
    splashEnabled: boolVal("splashEnabled", false),
    splashText: profileText(c.splashText, 40) || "click to enter",
    tilt: boolVal("tilt", false),
    cursorStyle: enumVal("cursorStyle", ["default", "dot", "ring", "crosshair"], "default"),
    cursorTrail: enumVal("cursorTrail", ["none", "dots", "sparkles"], "none"),
    particles: enumVal("particles", ["none", "snow", "stars", "embers", "rain", "fireflies", "bubbles", "leaves", "petals"], "none"),
    particleDensity: intVal("particleDensity", 10, 100, 40),
    // --- audio player ---
    playerStyle: enumVal("playerStyle", ["card", "bar", "minimal", "hidden"], "card"),
    audioVolume: intVal("audioVolume", 0, 100, 60),
    audioLoop: boolVal("audioLoop", true),
    audioAutoplay: boolVal("audioAutoplay", true),
    // --- v3 polish ---
    nameFont: enumVal("nameFont", ["inherit", "system", "inter", "mono", "serif", "bricolage", "instrument"], "inherit"),
    nameWeight: intVal("nameWeight", 400, 900, 760),
    nameTransform: enumVal("nameTransform", ["none", "uppercase", "lowercase"], "none"),
    animatedBorder: boolVal("animatedBorder", false),
    cardPattern: enumVal("cardPattern", ["none", "grid", "dots", "scanlines", "noise"], "none"),
    bgGrain: boolVal("bgGrain", false),
    bgVignette: intVal("bgVignette", 0, 100, 0),
    bgParallax: boolVal("bgParallax", false),
    linkHover: enumVal("linkHover", ["lift", "glow", "fill", "none"], "lift"),
    linkSize: enumVal("linkSize", ["small", "medium", "large"], "medium"),
    headerStyle: enumVal("headerStyle", ["stacked", "inline"], "stacked"),
    statusDot: enumVal("statusDot", ["none", "online", "idle", "dnd", "offline"], "none"),
    cardPadding: enumVal("cardPadding", ["compact", "normal", "spacious"], "normal"),
    staggerIn: boolVal("staggerIn", true),
    cardHAlign: enumVal("cardHAlign", ["left", "center", "right"], "center"),
    avatarBorderColor: colorVal("avatarBorderColor", ""),
    avatarBorderWidth: intVal("avatarBorderWidth", 0, 10, 4),
    iconBg: enumVal("iconBg", ["soft", "brand", "none"], "soft")
  };
  const oldRaw = previousSlug ? await env.SESSIONS.get(`p:${previousSlug}`) : null;
  const old = oldRaw ? JSON.parse(oldRaw) : {};
  const hiddenBadges = Array.isArray(b.hiddenBadges) ? [...new Set(b.hiddenBadges.filter((id) => typeof id === "string" && BADGES[id]))].slice(0, 40) : old.hiddenBadges || [];
  const assetListRaw = await env.SESSIONS.get(`paassets:${ownerHash}`);
  const ownedAssets = assetListRaw ? JSON.parse(assetListRaw) : [];
  const ownedUrls = new Set(ownedAssets.map((a) => a.url));
  const mediaAssets = Array.isArray(b.mediaAssets) ? b.mediaAssets.filter((id) => ownedAssets.some((a) => a.id === id)).slice(0, 11) : old.mediaAssets || [];
  const backgroundVideoCandidate = safeHttpUrl(b.backgroundVideoUrl, 700, true);
  const backgroundVideoUrl = backgroundVideoCandidate && ownedUrls.has(backgroundVideoCandidate) && ownedAssets.some((a) => a.url === backgroundVideoCandidate && a.kind === "video") ? backgroundVideoCandidate : "";
  const audioAssets = Array.isArray(b.audioAssets) ? b.audioAssets.filter((url) => typeof url === "string" && ownedUrls.has(url) && ownedAssets.some((a) => a.url === url && a.kind === "audio")).slice(0, 3) : old.audioAssets || [];
  const audioMeta = Array.isArray(b.audioMeta) ? b.audioMeta.slice(0, 3).map((m) => ({ title: profileText(m && m.title, 60), artist: profileText(m && m.artist, 60), cover: safeHttpUrl(m && m.cover, 700, true) || "", offset: Math.max(-30, Math.min(30, Math.round((Number(m && m.offset) || 0) * 10) / 10)), lyrics: String(m && m.lyrics || "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 6e3) })) : old.audioMeta || [];
  const sectionsIn = Array.isArray(b.sections) ? b.sections : null;
  const sections = sectionsIn ? sectionsIn.slice(0, 6).map((sc) => ({
    title: profileText(sc && sc.title, 40),
    kind: ["cards", "list", "text"].includes(sc && sc.kind) ? sc.kind : "cards",
    text: String(sc && sc.text || "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 800),
    items: (Array.isArray(sc && sc.items) ? sc.items : []).slice(0, 12).map((it) => ({ title: profileText(it && it.title, 60), desc: profileText(it && it.desc, 140), url: safeHttpUrl(it && it.url, 500, true), img: safeHttpUrl(it && it.img, 700, true) })).filter((it) => it.title || it.img)
  })).filter((sc) => sc.title || sc.text || sc.items.length) : old.sections || [];
  const friends = Array.isArray(b.friends) ? [...new Set(b.friends.map((x) => profileText(x, 24).toLowerCase().replace(/^@/, "")).filter((x) => profileSlugOK(x) && x !== username))].slice(0, 8) : old.friends || [];
  const profile = {
    username,
    ownerHash,
    displayName: profileText(b.displayName, 40) || username,
    bio: profileText(b.bio, 220),
    avatarUrl: safeHttpUrl(b.avatarUrl, 500, true),
    bannerUrl: safeHttpUrl(b.bannerUrl, 500, true),
    backgroundUrl: safeHttpUrl(b.backgroundUrl, 500, true),
    background: safeProfileBackground(b.background),
    accentColor: /^#[0-9a-f]{6}$/i.test(String(b.accentColor || "")) ? b.accentColor : "#8b7cff",
    status: profileText(b.status, 80),
    statusEmoji: profileText(b.statusEmoji, 8),
    links,
    widgets,
    musicUrl: safeMusicUrl(b.musicUrl),
    backgroundVideoUrl,
    audioAssets,
    audioMeta,
    sections,
    friends,
    mediaAssets,
    customization,
    hiddenBadges,
    nameChanges: nameChanges + (renaming ? 1 : 0),
    createdAt: old.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  await env.SESSIONS.put(`p:${username}`, JSON.stringify(profile));
  await env.SESSIONS.put(ownerIndex, username);
  if (previousSlug && previousSlug !== username) await env.SESSIONS.delete(`p:${previousSlug}`);
  await awardEventBadges(env, ownerHash);
  const allBadges = await badgesFor(env, profile, account, true);
  return json(env, req, { ok: true, nameChanges: profile.nameChanges, canRename: profile.nameChanges < 1 || ownerHash === OWNER_HASH, profile: profilePublicShape(profile, await env.SESSIONS.get(`pv:${username}`), account, await badgesFor(env, profile, account)), hiddenBadges, allBadges, catalog: badgeCatalog(allBadges.map((x) => x.id)), url: `${env.SITE_ORIGIN}/u/${username}` });
}
async function publicProfile(env, req, username) {
  if (!profileSlugOK(username)) return json(env, req, { error: "profile_not_found" }, 404);
  const raw = await env.SESSIONS.get(`p:${username}`);
  if (!raw) return json(env, req, { error: "profile_not_found" }, 404);
  const profile = JSON.parse(raw);
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const visitor = (await sign(env.STATE_SECRET, `profile-view|${username}|${ip}`)).slice(0, 32);
  const uniqueKey = `pvu:${username}:${visitor}`;
  if (!await env.SESSIONS.get(uniqueKey)) {
    await env.SESSIONS.put(uniqueKey, "1", { expirationTtl: 86400 });
    const views = Number(await env.SESSIONS.get(`pv:${username}`) || "0") + 1;
    await env.SESSIONS.put(`pv:${username}`, String(views));
  }
  const accountRaw = await env.SESSIONS.get(`a:${profile.ownerHash}`), account = accountRaw ? JSON.parse(accountRaw) : null;
  const shape = profilePublicShape(profile, await env.SESSIONS.get(`pv:${username}`), account, await badgesFor(env, profile, account));
  shape.friendsData = await resolveFriends(env, profile.friends);
  if (profile.customization && profile.customization.showSteam && account && account.steam && account.steam.id) shape.steam = await steamData(env, account.steam.id).catch(() => null);
  return json(env, req, { profile: shape }, 200, { "Cache-Control": "no-store" });
}
async function profileAssetAuth(env, req) {
  const s = await session(env, req);
  if (!s || !s.data.accountEmail) return { error: json(env, req, { error: "unauthenticated", message: "Sign in to manage profile media." }, 401) };
  const ownerHash = await digest(s.data.accountEmail.trim().toLowerCase());
  const accountRaw = await env.SESSIONS.get(`a:${ownerHash}`);
  const account = accountRaw ? JSON.parse(accountRaw) : null;
  if (!account || !account.verified) return { error: json(env, req, { error: "email_not_verified", message: "Verify your email before uploading media." }, 403) };
  return { ownerHash, account };
}
function profileAssetPublicShape(a) {
  return { id: a.id, kind: a.kind, name: a.name, mime: a.mime, size: a.size, url: a.url, createdAt: a.createdAt };
}
async function profileAssetsList(env, req) {
  const auth = await profileAssetAuth(env, req);
  if (auth.error) return auth.error;
  if (!env.PROFILE_ASSETS || typeof env.PROFILE_ASSETS.get !== "function") return json(env, req, { error: "storage_not_configured", message: "The PROFILE_ASSETS R2 binding is missing. Check the Worker binding and redeploy." }, 503);
  const raw = await env.SESSIONS.get(`paassets:${auth.ownerHash}`), assets = raw ? JSON.parse(raw) : [];
  const counts = { image: 0, audio: 0, video: 0 };
  assets.forEach((a) => {
    if (counts[a.kind] !== void 0) counts[a.kind]++;
  });
  return json(env, req, { assets: assets.map(profileAssetPublicShape), counts, limits: { image: 5, audio: 3, video: 3 } });
}
async function profileAssetUpload(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const auth = await profileAssetAuth(env, req);
  if (auth.error) return auth.error;
  if (!env.PROFILE_ASSETS || typeof env.PROFILE_ASSETS.put !== "function") return json(env, req, { error: "storage_not_configured", message: "Media storage is not configured yet. Add the PROFILE_ASSETS R2 bucket binding, then redeploy the Worker." }, 503);
  let form;
  try {
    form = await req.formData();
  } catch (_) {
    return json(env, req, { error: "bad_upload", message: "Could not read the uploaded file." }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return json(env, req, { error: "missing_file", message: "Choose a file first." }, 400);
  const mime = String(file.type || "").toLowerCase();
  let kind = "", maxBytes = 0;
  if (["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(mime)) {
    kind = "image";
    maxBytes = 8 * 1024 * 1024;
  } else if (["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm"].includes(mime)) {
    kind = "audio";
    maxBytes = 15 * 1024 * 1024;
  } else if (["video/mp4", "video/webm", "video/quicktime"].includes(mime)) {
    kind = "video";
    maxBytes = 45 * 1024 * 1024;
  } else return json(env, req, { error: "unsupported_type", message: "Supported: PNG/JPG/WebP/GIF/AVIF, MP3/WAV/OGG/M4A, or MP4/WebM/MOV." }, 415);
  if (!file.size || file.size > maxBytes) return json(env, req, { error: "file_too_large", message: `This ${kind} file must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.` }, 413);
  const raw = await env.SESSIONS.get(`paassets:${auth.ownerHash}`), assets = raw ? JSON.parse(raw) : [];
  const limits = { image: 5, audio: 3, video: 3 };
  if (assets.filter((a) => a.kind === kind).length >= limits[kind]) return json(env, req, { error: "quota_reached", message: `Free quota reached: ${limits[kind]} ${kind} files per account.` }, 409);
  const id = rand(18).replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = String(file.name || `${kind}-upload`).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100);
  const key = `profile-assets/${auth.ownerHash}/${id}`;
  await env.PROFILE_ASSETS.put(key, file.stream(), { httpMetadata: { contentType: mime, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { assetId: id, ownerHash: auth.ownerHash, kind } });
  const asset = { id, kind, name: safeName, mime, size: file.size, url: `${env.API_ORIGIN}/profile-assets/${id}`, createdAt: Date.now(), key };
  assets.push(asset);
  await env.SESSIONS.put(`paassets:${auth.ownerHash}`, JSON.stringify(assets));
  await env.SESSIONS.put(`paasset:${id}`, JSON.stringify({ ownerHash: auth.ownerHash, key, url: asset.url, kind, mime, size: file.size }));
  return json(env, req, { ok: true, asset: profileAssetPublicShape(asset), assets: assets.map(profileAssetPublicShape), counts: { image: assets.filter((a) => a.kind === "image").length, audio: assets.filter((a) => a.kind === "audio").length, video: assets.filter((a) => a.kind === "video").length } }, 201);
}
async function profileAssetDelete(env, req) {
  if (!originOK(env, req)) return json(env, req, { error: "forbidden" }, 403);
  const auth = await profileAssetAuth(env, req);
  if (auth.error) return auth.error;
  if (!env.PROFILE_ASSETS) return json(env, req, { error: "storage_not_configured" }, 503);
  let b;
  try {
    b = await readBody(req);
  } catch (_) {
    return json(env, req, { error: "bad_request" }, 400);
  }
  const raw = await env.SESSIONS.get(`paassets:${auth.ownerHash}`), assets = raw ? JSON.parse(raw) : [];
  const asset = assets.find((a) => a.id === String(b.id || ""));
  if (!asset) return json(env, req, { error: "asset_not_found" }, 404);
  const slug = await env.SESSIONS.get(`pa:${auth.ownerHash}`), profileRaw = slug ? await env.SESSIONS.get(`p:${slug}`) : null;
  if (profileRaw) {
    const p = JSON.parse(profileRaw);
    if ([p.avatarUrl, p.bannerUrl, p.backgroundUrl, p.backgroundVideoUrl, ...p.audioAssets || []].includes(asset.url)) return json(env, req, { error: "asset_in_use", message: "Remove this media from your profile and save before deleting it." }, 409);
  }
  await env.PROFILE_ASSETS.delete(asset.key || `profile-assets/${auth.ownerHash}/${asset.id}`);
  await env.SESSIONS.delete(`paasset:${asset.id}`);
  const next = assets.filter((a) => a.id !== asset.id);
  await env.SESSIONS.put(`paassets:${auth.ownerHash}`, JSON.stringify(next));
  return json(env, req, { ok: true, assets: next.map(profileAssetPublicShape), counts: { image: next.filter((a) => a.kind === "image").length, audio: next.filter((a) => a.kind === "audio").length, video: next.filter((a) => a.kind === "video").length } });
}
async function profileAssetPublic(env, req, id) {
  if (!env.PROFILE_ASSETS) return new Response("Media storage unavailable", { status: 503 });
  const metaRaw = await env.SESSIONS.get(`paasset:${id}`);
  const meta = metaRaw ? JSON.parse(metaRaw) : null;
  if (!meta) return new Response("Not found", { status: 404 });
  const objKey = meta.key || `profile-assets/${meta.ownerHash}/${id}`;
  let range = null;
  const rm = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("Range") || "");
  if (rm && (rm[1] || rm[2])) range = rm[1] === "" ? { suffix: Number(rm[2]) } : rm[2] === "" ? { offset: Number(rm[1]) } : { offset: Number(rm[1]), length: Number(rm[2]) - Number(rm[1]) + 1 };
  if (range && range.length !== void 0 && range.length <= 0) range = null;
  let object;
  try {
    object = await env.PROFILE_ASSETS.get(objKey, range ? { range } : void 0);
  } catch (_) {
    return new Response("Range not satisfiable", { status: 416, headers: { "Content-Range": "bytes */*" } });
  }
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": object.httpMetadata?.contentType || meta.mime || "application/octet-stream", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": allowedSiteOrigin(env, req.headers.get("Origin")) ? req.headers.get("Origin") : env.SITE_ORIGIN, "Cross-Origin-Resource-Policy": "cross-origin" });
  headers.set("Accept-Ranges", "bytes");
  if (range && object.range && object.size) {
    const off = object.range.offset ?? object.size - (object.range.length ?? 0), len = object.range.length ?? object.size - off;
    headers.set("Content-Range", `bytes ${off}-${off + len - 1}/${object.size}`);
    headers.set("Content-Length", String(len));
    return new Response(req.method === "HEAD" ? null : object.body, { status: 206, headers });
  }
  if (object.size) headers.set("Content-Length", String(object.size));
  return new Response(req.method === "HEAD" ? null : object.body, { headers });
}
const clean1 = (v, n) => String(v ?? "").replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, n);
async function supportSend(env, req) {
  if (!env.RESEND_API_KEY || !env.SUPPORT_TO) return json(env, req, { error: "not_configured" }, 503);
  const origin = req.headers.get("Origin");
  if (origin && origin !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);
  let b;
  try {
    b = await req.json();
  } catch {
    return json(env, req, { error: "bad_request" }, 400);
  }
  if (b.website) return json(env, req, { ok: true });
  const email = clean1(b.email, 254), discord = clean1(b.discord, 64), subject = clean1(b.subject, 120);
  const message = String(b.message ?? "").replace(/\r\n?/g, "\n").trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(email)) return json(env, req, { error: "invalid_email" }, 400);
  if (discord.length < 2) return json(env, req, { error: "invalid_discord" }, 400);
  if (subject.length < 3) return json(env, req, { error: "invalid_subject" }, 400);
  if (message.length < 20 || message.length > 4e3) return json(env, req, { error: "invalid_message" }, 400);
  if (env.TURNSTILE_SECRET) {
    const t = String(b.turnstile || "");
    let ok = false;
    if (t) {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t, remoteip: req.headers.get("CF-Connecting-IP") || "" })
      });
      ok = r.ok && (await r.json()).success === true;
    }
    if (!ok) return json(env, req, { error: "captcha_failed" }, 400);
  }
  const ipKey = "sp:" + (await sign(env.STATE_SECRET, "sp|" + (req.headers.get("CF-Connecting-IP") || "?"))).slice(0, 32);
  if (await env.SESSIONS.get(ipKey)) return json(env, req, { error: "slow_down" }, 429);
  await env.SESSIONS.put(ipKey, "1", { expirationTtl: 60 });
  const text = `New support request from the website

E-mail:   ${email}
Discord:  ${discord}
Subject:  ${subject}

${message}
`;
  const from = env.SUPPORT_FROM || "Sentinel Support <support@sentineldashboard.site>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [env.SUPPORT_TO],
        reply_to: email,
        subject: `[Sentinel support] ${subject}`,
        text
      })
    });
    if (!response.ok) {
      await env.SESSIONS.delete(ipKey);
      return json(env, req, { error: "send_failed" }, 502);
    }
  } catch {
    await env.SESSIONS.delete(ipKey);
    return json(env, req, { error: "send_failed" }, 502);
  }
  return json(env, req, { ok: true });
}
const BOT_DOWN_AFTER = 12 * 60000;
function tgSend(env, chat, text) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) }).catch(() => null);
}
async function botStatusText(env) {
  const hb = Number(await env.SESSIONS.get("hb") || "0");
  if (!hb) return "Sentinel: no signal received yet.";
  const mins = Math.max(0, Math.round((Date.now() - hb) / 60000));
  return Date.now() - hb < BOT_DOWN_AFTER ? "Sentinel is online ✅" : `Sentinel looks offline ⚠️\nLast signal about ${mins} min ago.`;
}
async function telegramWebhook(env, req) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "", env.TELEGRAM_WEBHOOK_SECRET)) return new Response("forbidden", { status: 403 });
  let u; try { u = await req.json(); } catch (_) { return new Response("ok"); }
  const m = u && u.message, chat = m && m.chat && m.chat.id, cmd = String((m && m.text) || "").trim().split(/[\s@]/)[0].toLowerCase();
  if (!chat || m.chat.type !== "private") return new Response("ok");
  if (cmd === "/status") await tgSend(env, chat, await botStatusText(env));
  else if (cmd === "/id") await tgSend(env, chat, `Your Telegram ID: ${chat}`);
  else if (cmd === "/start" || cmd === "/help") await tgSend(env, chat, "Sentinel status bot.\n/status - is Sentinel online?\n/id - show your Telegram ID");
  return new Response("ok");
}
async function botWatch(env) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const hb = Number(await env.SESSIONS.get("hb") || "0"); if (!hb) return;
  const down = Date.now() - hb > BOT_DOWN_AFTER, was = (await env.SESSIONS.get("hbs")) === "down";
  if (down === was) return;
  await env.SESSIONS.put("hbs", down ? "down" : "up");
  const ids = String(env.TELEGRAM_ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const text = down ? "⚠️ Sentinel looks offline. No signal for over 12 minutes." : "✅ Sentinel is back online.";
  await Promise.all(ids.map((id) => tgSend(env, id, text)));
}
export default {
  async scheduled(_e, env, ctx) { ctx.waitUntil(botWatch(env)); },
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });
    const missing = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "STATE_SECRET", "SITE_ORIGIN", "API_ORIGIN"].filter((k) => !env[k]);
    if (!env.SESSIONS) missing.push("SESSIONS (KV binding)");
    if (missing.length && pathname !== "/api/me") return json(env, req, { error: "misconfigured", missing }, 500);
    if (req.method === "GET" && pathname === "/auth/login") return login(env);
    if (req.method === "GET" && pathname === "/auth/link") {
      const s = await session(env, req);
      if (!s || !s.data.accountEmail) return new Response(null, { status: 302, headers: { Location: `${env.SITE_ORIGIN}/account?link=login_required`, "Cache-Control": "no-store" } });
      return linkDiscord(env);
    }
    {
      const dm = pathname.match(/^\/dash\/guild\/(\d{15,25})(\/tickets\/op)?$/);
      if (dm) {
        if (req.method === "GET" && !dm[2]) return dashGuildGet(env, req, dm[1]);
        if (req.method === "POST" && dm[2]) return dashTicketsOp(env, req, dm[1]);
      }
      const mm = pathname.match(/^\/dash\/guild\/(\d{15,25})\/members-backup$/);
      if (mm && req.method === "GET") return dashMembersGet(env, req, mm[1]);
      if (mm && req.method === "POST") return dashMembersSet(env, req, mm[1]);
      if (req.method === "GET" && pathname === "/rejoin/start") return rejoinStart(env, req);
      if (req.method === "GET" && pathname === "/rejoin/revoke") return rejoinRevokeStart(env);
      if (req.method === "POST" && pathname === "/bot/rejoin/run") return botRejoinRun(env, req);
      if (req.method === "GET" && pathname === "/bot/tickets/pending") return botTicketsPending(env, req);
      if (req.method === "POST" && pathname === "/bot/tickets/ack") return botTicketsAck(env, req);
      const bm = pathname.match(/^\/bot\/guilds\/(\d{15,25})\/tickets\/snapshot$/);
      if (bm && req.method === "POST") return botTicketsSnapshot(env, req, bm[1]);
    }
    if (req.method === "GET" && pathname === "/lyrics/search") return lyricsSearch(env, req);
    if (req.method === "GET" && pathname === "/profiles/lookup") return profileLookup(env, req);
    if (req.method === "GET" && pathname === "/auth/steam") return steamStart(env, req);
    if (req.method === "GET" && pathname === "/auth/steam/callback") return steamCallback(env, req);
    if (req.method === "POST" && pathname === "/account/steam/unlink") return accountUnlinkSteam(env, req);
    if (req.method === "GET" && pathname === "/auth/google") return googleStart(env, req);
    if (req.method === "GET" && pathname === "/auth/google/callback") return googleCallback(env, req);
    if (req.method === "POST" && pathname === "/account/google/unlink") return accountUnlinkGoogle(env, req);
    if (req.method === "GET" && pathname === "/auth/callback") return callback(env, req);
    if (req.method === "GET" && pathname === "/api/me") return me(env, req);
    if (req.method === "GET" && pathname === "/account/phone/status") return phoneStatus(env, req);
    if (req.method === "POST" && pathname === "/telegram/webhook") return telegramWebhook(env, req);
    if (req.method === "GET" && pathname === "/account/telegram/status") return telegramStatus(env, req);
    if (req.method === "POST" && pathname === "/account/telegram/auth") return telegramAuth(env, req);
    if (req.method === "POST" && pathname === "/account/telegram/unlink") return telegramUnlink(env, req);
    if (req.method === "POST" && pathname === "/account/phone/start") return phoneStart(env, req);
    if (req.method === "POST" && pathname === "/account/phone/verify") return phoneVerify(env, req);
    if (req.method === "POST" && pathname === "/account/phone/unlink") return phoneUnlink(env, req);
    if (req.method === "POST" && pathname === "/account/register") return accountRegister(env, req);
    if (req.method === "POST" && pathname === "/account/verify") return accountVerify(env, req);
    if (req.method === "POST" && pathname === "/account/login") return accountLogin(env, req);
    if (req.method === "GET" && pathname === "/account/me") return accountMe(env, req);
    if (req.method === "POST" && pathname === "/account/password") return accountChangePassword(env, req);
    if (req.method === "POST" && pathname === "/account/discord/unlink") return accountUnlinkDiscord(env, req);
    if (req.method === "GET" && pathname === "/profiles/me") return profileMe(env, req);
    if (req.method === "POST" && pathname === "/profiles/save") return profileSave(env, req);
    if (req.method === "GET" && pathname === "/profiles/assets") return profileAssetsList(env, req);
    if (req.method === "POST" && pathname === "/profiles/assets/upload") return profileAssetUpload(env, req);
    if (req.method === "POST" && pathname === "/profiles/assets/delete") return profileAssetDelete(env, req);
    const profileAssetMatch = pathname.match(/^\/profile-assets\/([A-Za-z0-9_-]{10,64})$/);
    if ((req.method === "GET" || req.method === "HEAD") && profileAssetMatch) return profileAssetPublic(env, req, profileAssetMatch[1]);
    const publicProfileMatch = pathname.match(/^\/profiles\/([a-z0-9][a-z0-9_-]{0,23})$/);
    if (req.method === "GET" && publicProfileMatch) return publicProfile(env, req, publicProfileMatch[1]);
    const shortProfileMatch = pathname.match(/^\/u\/([a-z0-9][a-z0-9_-]{0,23})$/);
    if (req.method === "GET" && shortProfileMatch) return publicProfile(env, req, shortProfileMatch[1]);
    if (req.method === "POST" && pathname === "/admin/badge") return adminBadge(env, req);
    if (req.method === "GET" && pathname === "/admin/lookup") return adminLookup(env, req);
    if (req.method === "POST" && pathname === "/support/send") return supportSend(env, req);
    if (pathname.startsWith("/verify/")) {
      const needBot = ["/verify/status", "/verify/complete"].includes(pathname) && !env.BOT_TOKEN;
      if (needBot) return json(env, req, { error: "misconfigured", missing: ["BOT_TOKEN"] }, 500);
      if (req.method === "POST" && pathname === "/verify/register") return verifyRegister(env, req);
      if (req.method === "GET" && pathname === "/verify/info") return verifyInfo(env, req);
      if (req.method === "GET" && pathname === "/verify/login") return verifyLogin(env, req);
      if (req.method === "GET" && pathname === "/verify/status") return verifyStatus(env, req);
      if (req.method === "POST" && pathname === "/verify/complete") return verifyComplete(env, req);
    }
    if (req.method === "POST" && pathname === "/auth/logout") return logout(env, req);
    return json(env, req, { error: "not_found" }, 404);
  }
};
