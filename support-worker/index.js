/* Sentinel support subdomain proxy.
 * Serves the existing support page at https://support.sentineldashboard.site
 * by fetching it from the main site (GitHub Pages). No secrets, no state.
 *
 * Setup (Cloudflare dashboard):
 *   1. Workers & Pages -> Create -> Worker -> paste this file -> Deploy.
 *   2. Worker -> Settings -> Domains & Routes -> Add -> Custom domain -> support.sentineldashboard.site
 *   3. Turnstile (if used) -> add support.sentineldashboard.site to the widget's allowed hostnames.
 */
const ORIGIN = "https://www.sentineldashboard.site";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    let path = url.pathname;
    if (path === "/" || path === "/support" || path === "/support/" || path === "/support.html") path = "/support.html";
    // Only the support page and shared static assets are served here.
    const allowed = path === "/support.html" || path === "/sentinel.png" || path === "/robots.txt" || path.startsWith("/assets/");
    if (!allowed) return Response.redirect(ORIGIN + url.pathname + url.search, 302);
    const res = await fetch(ORIGIN + path, { method: request.method, headers: { Accept: request.headers.get("Accept") || "*/*" }, cf: { cacheTtl: path === "/support.html" ? 0 : 300, cacheEverything: path !== "/support.html" } });
    const h = new Headers(res.headers);
    h.set("X-Content-Type-Options", "nosniff");
    h.delete("Set-Cookie");
    if (path === "/support.html") h.set("Cache-Control", "no-cache");
    return new Response(res.body, { status: res.status, headers: h });
  },
};
