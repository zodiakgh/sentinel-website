/* Sentinel link-preview (embed) worker.
 * Makes https://sentineldashboard.site/u/<name> show a rich card when pasted in Discord, X, Slack, Telegram, WhatsApp…
 * Chat apps cannot run JavaScript, so for THEIR crawlers only we answer with a tiny HTML page holding the
 * Open Graph tags built from the member's profile (title, description, color and picture chosen in the profile editor).
 * Everybody else (browsers) passes straight through to the normal site.
 *
 * Setup (Cloudflare dashboard):
 *   1. Workers & Pages -> Create -> Worker -> paste this file -> Deploy.
 *   2. Worker -> Settings -> Domains & Routes -> Add -> Route:
 *        www.sentineldashboard.site/u/*     (zone: sentineldashboard.site)
 *        sentineldashboard.site/u/*
 *      The DNS records for the site must be "Proxied" (orange cloud) for routes to apply.
 */
const API = "https://api.sentineldashboard.site";
const SITE = "https://sentineldashboard.site";
const BOTS = /(discordbot|twitterbot|slackbot|telegrambot|whatsapp|facebookexternalhit|linkedinbot|mastodon|skypeuripreview|embedly|pinterest|redditbot|vkshare|applebot)/i;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const httpsUrl = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.href : ""; } catch (_) { return ""; } };
const hex = (c, f) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : f);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/u\/([a-z0-9][a-z0-9_-]{0,23})\/?$/i);
    const ua = request.headers.get("User-Agent") || "";
    if (request.method !== "GET" || !m || !BOTS.test(ua)) return fetch(request);
    const name = m[1].toLowerCase();
    let p;
    try {
      const r = await fetch(`${API}/profiles/${encodeURIComponent(name)}`, { headers: { Accept: "application/json" }, cf: { cacheTtl: 120, cacheEverything: true } });
      if (!r.ok) return fetch(request);
      p = (await r.json()).profile;
    } catch (_) { return fetch(request); }
    if (!p) return fetch(request);

    const c = p.customization || {};
    const title = (c.embedTitle || `${p.displayName || name} (@${p.username || name})`).slice(0, 80);
    const desc = (c.embedDescription || p.bio || `${p.displayName || name} on Sentinel`).slice(0, 200);
    const color = hex(c.embedColor, hex(p.accentColor, "#5865f2"));
    const which = c.embedImage === "banner" || c.embedImage === "none" ? c.embedImage : "avatar";
    let image = which === "none" ? "" : httpsUrl(which === "banner" ? (p.bannerUrl || p.avatarUrl) : p.avatarUrl);
    if (!image && which !== "none") image = `${SITE}/sentinel.png`;
    const large = !!c.embedLarge || which === "banner";
    const canonical = `${SITE}/u/${esc(name)}`;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${esc(color)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Sentinel">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="${image && large ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ""}
</head><body><a href="${canonical}">${esc(title)}</a></body></html>`;
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  },
};
