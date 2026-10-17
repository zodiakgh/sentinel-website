/**
 * Sentinel — Discord login (OAuth2 authorization-code flow) for Cloudflare Workers.
 *
 * Why a Worker: the Discord client secret must never reach the browser, and GitHub Pages
 * can only serve static files. This tiny service keeps the secret and issues a session cookie.
 *
 * Routes
 *   GET  /auth/login      -> redirects to Discord (scopes: identify guilds)
 *   GET  /auth/callback   -> exchanges the code, builds a session, redirects to the site
 *   GET  /api/me          -> { user, guilds } for the current session (401 if none)
 *   POST /auth/logout     -> deletes the session
 *
 * Server verification (member verification page, /verify)
 *   POST /verify/register -> called by the bot (X-Sentinel-Key) to register guild -> role
 *   GET  /verify/info     -> public: is this server set up? (name, captcha on/off)
 *   GET  /verify/login    -> Discord login (scope: identify) for the person verifying
 *   GET  /verify/status   -> who is logged in + are they eligible
 *   POST /verify/complete -> re-checks everything server-side and gives the role
 *
 * Bindings (see wrangler.toml / README.md)
 *   vars:    DISCORD_CLIENT_ID, SITE_ORIGIN, API_ORIGIN
 *   secrets: DISCORD_CLIENT_SECRET, STATE_SECRET, BOT_TOKEN (optional for login,
 *            required for verification), BOT_API_KEY (verification), TURNSTILE_SECRET (optional captcha)
 *   vars:    TURNSTILE_SITE_KEY (optional, public)
 *   KV:      SESSIONS
 */

const DISCORD = "https://discord.com/api/v10";
const SESSION_TTL = 60 * 60 * 24;          // 24 h
const STATE_TTL = 600;                     // 10 min
const MANAGE_GUILD = 0x20n, ADMINISTRATOR = 0x8n;
const enc = new TextEncoder();

/* ---------- helpers ---------- */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cookies(req) {
  const out = {};
  (req.headers.get("Cookie") || "").split(";").forEach((p) => {
    const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
const cookie = (name, value, { maxAge, path = "/" } = {}) =>
  `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

function cors(env, req, extra = {}) {
  const h = { "Vary": "Origin", "Cache-Control": "no-store", ...extra };
  if (req.headers.get("Origin") === env.SITE_ORIGIN) {
    h["Access-Control-Allow-Origin"] = env.SITE_ORIGIN;
    h["Access-Control-Allow-Credentials"] = "true";
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return h;
}
const json = (env, req, body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(env, req, { "Content-Type": "application/json", ...extra }) });
const back = (env, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/dashboard?auth=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};

/* ---------- Discord calls ---------- */
async function dget(path, auth) {
  const r = await fetch(DISCORD + path, { headers: { Authorization: auth, "User-Agent": "SentinelAuth (https://sentineldashboard.site, 1.0)" } });
  if (!r.ok) throw new Error(`discord ${path} ${r.status}`);
  return r.json();
}
async function botGuildIds(env) {
  if (!env.BOT_TOKEN) return null;                      // feature optional
  const ids = new Set(); let after = "";
  for (let page = 0; page < 10; page++) {               // up to 2 000 servers
    const list = await dget(`/users/@me/guilds?limit=200${after ? "&after=" + after : ""}`, `Bot ${env.BOT_TOKEN}`);
    list.forEach((g) => ids.add(g.id));
    if (list.length < 200) break; after = list[list.length - 1].id;
  }
  return ids;
}
async function exchange(env, code) {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code", code, redirect_uri: `${env.API_ORIGIN}/auth/callback`,
  });
  const r = await fetch(`${DISCORD}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("token exchange " + r.status);
  return r.json();
}
async function revoke(env, token) {
  try {
    await fetch(`${DISCORD}/oauth2/token/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, token }) });
  } catch (_) { /* best effort */ }
}

/* ---------- routes ---------- */
async function login(env) {
  const state = rand(16);
  const sig = await sign(env.STATE_SECRET, state);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope: "identify guilds",
    redirect_uri: `${env.API_ORIGIN}/auth/callback`, state, prompt: "none",
  });
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store",
    "Set-Cookie": cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }) } });
}

async function callback(env, req) {
  const url = new URL(req.url);
  const clear = ["Set-Cookie", cookie("sentinel_state", "", { maxAge: 0, path: "/auth" })];
  const vEarly = VERIFY_STATE.exec(url.searchParams.get("state") || "");   // digits only -> safe redirect target
  if (url.searchParams.get("error")) return vEarly ? verifyBack(env, vEarly[1], "cancelled", [clear]) : back(env, "cancelled", [clear]);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const [cState, cSig] = (cookies(req).sentinel_state || "").split(".");
  if (!code || !state || !cState || !safeEqual(state, cState) || !safeEqual(cSig || "", await sign(env.STATE_SECRET, cState)))
    return vEarly ? verifyBack(env, vEarly[1], "error", [clear]) : back(env, "error", [clear]);
  if (vEarly) return verifyCallback(env, code, vEarly[1], clear);
  try {
    const tok = await exchange(env, code);
    const auth = `Bearer ${tok.access_token}`;
    const [user, guilds, botIds] = await Promise.all([dget("/users/@me", auth), dget("/users/@me/guilds", auth), botGuildIds(env).catch(() => null)]);
    revoke(env, tok.access_token);                       // we never keep the Discord token
    const manageable = guilds.filter((g) => g.owner || (BigInt(g.permissions || "0") & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n)
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon, owner: !!g.owner, botPresent: botIds ? botIds.has(g.id) : null }));
    const sid = rand(32);
    await env.SESSIONS.put(`s:${sid}`, JSON.stringify({
      user: { id: user.id, username: user.username, name: user.global_name || user.username, avatar: user.avatar },
      guilds: manageable, created: Date.now(),
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
  const { user, guilds } = s.data;
  return json(env, req, {
    user: { id: user.id, username: user.username, name: user.name, avatarUrl: cdn("avatars", user.id, user.avatar) },
    guilds: guilds.map((g) => ({ id: g.id, name: g.name, iconUrl: cdn("icons", g.id, g.icon), owner: g.owner, botPresent: g.botPresent })),
    botStatusKnown: guilds.some((g) => g.botPresent !== null),
  });
}

async function logout(env, req) {
  if (req.headers.get("Origin") !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);   // CSRF guard
  const s = await session(env, req);
  if (s) await env.SESSIONS.delete(`s:${s.sid}`);
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_session", "", { maxAge: 0 }) });
}

/* ================= SERVER VERIFICATION ================= */
const SNOWFLAKE = /^\d{15,25}$/;
const VERIFY_STATE = /^v-(\d{15,25})-/;
const VERIFY_TTL = 60 * 15;                // 15 min to finish
const UA = "SentinelAuth (https://sentineldashboard.site, 1.0)";
const DISCORD_EPOCH = 1420070400000;
const verifyBack = (env, guild, q, headers = []) => {
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/verify?guild=${guild}&auth=${q}`, "Cache-Control": "no-store" });
  headers.forEach(([k, v]) => h.append(k, v));
  return new Response(null, { status: 302, headers: h });
};
const botCall = (env, method, path, body, reason) => {
  const h = { Authorization: `Bot ${env.BOT_TOKEN}`, "User-Agent": UA };
  if (body) h["Content-Type"] = "application/json";
  if (reason) h["X-Audit-Log-Reason"] = encodeURIComponent(reason);
  return fetch(DISCORD + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
};
const intIn = (v, max) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : 0; };

// Called by the bot. Authenticated with a shared key (NOT the bot token).
async function verifyRegister(env, req) {
  if (!env.BOT_API_KEY) return json(env, req, { error: "misconfigured", missing: ["BOT_API_KEY"] }, 500);
  const given = req.headers.get("X-Sentinel-Key") || "";
  if (!safeEqual(await sign(env.STATE_SECRET, given), await sign(env.STATE_SECRET, env.BOT_API_KEY)))
    return json(env, req, { error: "forbidden" }, 403);
  let b; try { b = await req.json(); } catch (_) { return json(env, req, { error: "bad_request" }, 400); }
  if (!b || !SNOWFLAKE.test(String(b.guild_id)) || !SNOWFLAKE.test(String(b.role_id))) return json(env, req, { error: "bad_request" }, 400);
  const cfg = {
    role_id: String(b.role_id),
    unverified_role_id: SNOWFLAKE.test(String(b.unverified_role_id || "")) ? String(b.unverified_role_id) : null,
    log_channel_id: SNOWFLAKE.test(String(b.log_channel_id || "")) ? String(b.log_channel_id) : null,
    min_account_age_days: intIn(b.min_account_age_days, 3650),
    min_server_age_days: intIn(b.min_server_age_days, 3650),
    guild_name: String(b.guild_name || "").slice(0, 100),
    guild_icon: /^[a-z0-9_]{1,64}$/i.test(String(b.guild_icon || "")) ? String(b.guild_icon) : null,
    updated: Date.now(),
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
    siteKey: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null,
  });
}

async function verifyLogin(env, req) {
  const guild = new URL(req.url).searchParams.get("guild");
  if (!SNOWFLAKE.test(guild || "") || !(await vConfig(env, guild))) return Response.redirect(`${env.SITE_ORIGIN}/verify?guild=${SNOWFLAKE.test(guild || "") ? guild : ""}&auth=error`, 302);
  const state = `v-${guild}-${rand(12)}`;
  const sig = await sign(env.STATE_SECRET, state);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: "code", scope: "identify",
    redirect_uri: `${env.API_ORIGIN}/auth/callback`, state, prompt: "none",
  });
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store",
    "Set-Cookie": cookie("sentinel_state", `${state}.${sig}`, { maxAge: STATE_TTL, path: "/auth" }) } });
}

// Reached through /auth/callback (same redirect URI as the dashboard login).
async function verifyCallback(env, code, guild, clear) {
  try {
    const tok = await exchange(env, code);
    const user = await dget("/users/@me", `Bearer ${tok.access_token}`);
    revoke(env, tok.access_token);
    const sid = rand(32);
    await env.SESSIONS.put(`vs:${sid}`, JSON.stringify({ uid: user.id, name: user.global_name || user.username, avatar: user.avatar, guild }), { expirationTtl: VERIFY_TTL });
    return verifyBack(env, guild, "ok", [clear, ["Set-Cookie", cookie("sentinel_verify", sid, { maxAge: VERIFY_TTL, path: "/verify" })]]);
  } catch (_) { return verifyBack(env, guild, "error", [clear]); }
}

async function vSession(env, req, guild) {
  const sid = cookies(req).sentinel_verify;
  if (!sid || !/^[A-Za-z0-9_-]{20,64}$/.test(sid)) return null;
  const raw = await env.SESSIONS.get(`vs:${sid}`);
  if (!raw) return null;
  const d = JSON.parse(raw);
  return d.guild === guild ? { sid, ...d } : null;
}

// Decides whether this person may receive the role. Always done server-side.
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
  if (req.headers.get("Origin") !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);   // CSRF guard
  let b; try { b = await req.json(); } catch (_) { b = {}; }
  const guild = String(b.guild || "");
  const cfg = await vConfig(env, guild);
  if (!cfg) return json(env, req, { error: "not_configured" }, 404);
  const s = await vSession(env, req, guild);
  if (!s) return json(env, req, { error: "unauthenticated" }, 401);
  if (env.TURNSTILE_SECRET) {
    const t = String(b.turnstile || "");
    let ok = false;
    if (t) {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST",
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t, remoteip: req.headers.get("CF-Connecting-IP") || "" }) });
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
  if (cfg.unverified_role_id) await botCall(env, "DELETE", `/guilds/${guild}/members/${s.uid}/roles/${cfg.unverified_role_id}`, null, "Sentinel web verification").catch(() => {});
  if (cfg.log_channel_id) await botCall(env, "POST", `/channels/${cfg.log_channel_id}/messages`, {
    embeds: [{ title: "Member verified", description: `<@${s.uid}> completed verification on the website.`, color: 0x4bbe69 }], allowed_mentions: { parse: [] } }).catch(() => {});
  await env.SESSIONS.delete(`vs:${s.sid}`);
  return json(env, req, { ok: true }, 200, { "Set-Cookie": cookie("sentinel_verify", "", { maxAge: 0, path: "/verify" }) });
}


// ───────────────────────── SUPPORT FORM ─────────────────────────
// POST /support/send {email, discord, subject, message, website(honeypot), turnstile?}
// Sends the support request through Resend. RESEND_API_KEY must be stored as a Worker secret.
const clean1 = (v, n) => String(v ?? "").replace(/[\r\n\u2028\u2029]+/g, " ").trim().slice(0, n);

async function supportSend(env, req) {
  if (!env.RESEND_API_KEY || !env.SUPPORT_TO) return json(env, req, { error: "not_configured" }, 503);
  const origin = req.headers.get("Origin");
  if (origin && origin !== env.SITE_ORIGIN) return json(env, req, { error: "forbidden" }, 403);
  let b; try { b = await req.json(); } catch { return json(env, req, { error: "bad_request" }, 400); }
  if (b.website) return json(env, req, { ok: true }); // honeypot: pretend success
  const email = clean1(b.email, 254), discord = clean1(b.discord, 64), subject = clean1(b.subject, 120);
  const message = String(b.message ?? "").replace(/\r\n?/g, "\n").trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(email)) return json(env, req, { error: "invalid_email" }, 400);
  if (discord.length < 2) return json(env, req, { error: "invalid_discord" }, 400);
  if (subject.length < 3) return json(env, req, { error: "invalid_subject" }, 400);
  if (message.length < 20 || message.length > 4000) return json(env, req, { error: "invalid_message" }, 400);
  if (env.TURNSTILE_SECRET) {
    const t = String(b.turnstile || ""); let ok = false;
    if (t) {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST",
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: t, remoteip: req.headers.get("CF-Connecting-IP") || "" }) });
      ok = r.ok && (await r.json()).success === true;
    }
    if (!ok) return json(env, req, { error: "captcha_failed" }, 400);
  }
  // One message per visitor per minute; only a keyed hash is stored and it expires after 60 seconds.
  const ipKey = "sp:" + (await sign(env.STATE_SECRET, "sp|" + (req.headers.get("CF-Connecting-IP") || "?"))).slice(0, 32);
  if (await env.SESSIONS.get(ipKey)) return json(env, req, { error: "slow_down" }, 429);
  await env.SESSIONS.put(ipKey, "1", { expirationTtl: 60 });

  const text = `New support request from the website\n\nE-mail:   ${email}\nDiscord:  ${discord}\nSubject:  ${subject}\n\n${message}\n`;
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

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    // Fail with a readable message (names only, never values) instead of a Cloudflare 1101 page.
    const missing = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "STATE_SECRET", "SITE_ORIGIN", "API_ORIGIN"].filter((k) => !env[k]);
    if (!env.SESSIONS) missing.push("SESSIONS (KV binding)");
    if (missing.length && pathname !== "/api/me") return json(env, req, { error: "misconfigured", missing }, 500);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });
    if (req.method === "GET" && pathname === "/auth/login") return login(env);
    if (req.method === "GET" && pathname === "/auth/callback") return callback(env, req);
    if (req.method === "GET" && pathname === "/api/me") return me(env, req);
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
  },
};
