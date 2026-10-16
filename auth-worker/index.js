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
 * Bindings (see wrangler.toml / README.md)
 *   vars:    DISCORD_CLIENT_ID, SITE_ORIGIN, API_ORIGIN
 *   secrets: DISCORD_CLIENT_SECRET, STATE_SECRET, BOT_TOKEN (optional)
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
  const h = new Headers({ Location: `${env.SITE_ORIGIN}/dashboard.html?auth=${q}`, "Cache-Control": "no-store" });
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
  if (url.searchParams.get("error")) return back(env, "cancelled", [clear]);
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const [cState, cSig] = (cookies(req).sentinel_state || "").split(".");
  if (!code || !state || !cState || !safeEqual(state, cState) || !safeEqual(cSig || "", await sign(env.STATE_SECRET, cState)))
    return back(env, "error", [clear]);
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

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });
    if (req.method === "GET" && pathname === "/auth/login") return login(env);
    if (req.method === "GET" && pathname === "/auth/callback") return callback(env, req);
    if (req.method === "GET" && pathname === "/api/me") return me(env, req);
    if (req.method === "POST" && pathname === "/auth/logout") return logout(env, req);
    return json(env, req, { error: "not_found" }, 404);
  },
};
