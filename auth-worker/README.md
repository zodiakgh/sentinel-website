# Sentinel auth Worker (Discord login)

Keeps the Discord client secret off the website. Deploy once; the static site only talks to it.

1. Discord Developer Portal → your application → **OAuth2** → **Redirects**: add `https://api.sentineldashboard.site/auth/callback`. Copy the **Client Secret**.
2. Move the `sentineldashboard.site` DNS to Cloudflare (free) so the Worker can use `api.sentineldashboard.site`.
3. In this folder:
   ```
   npm install -g wrangler        (or use npx wrangler)
   npx wrangler login
   npx wrangler kv namespace create SESSIONS      # paste the id into wrangler.toml
   npx wrangler secret put DISCORD_CLIENT_SECRET
   npx wrangler secret put STATE_SECRET           # long random string
   npx wrangler secret put BOT_TOKEN              # optional (rotate your bot token first!)
   npx wrangler deploy
   ```
4. In `assets/js/config.js` set `authApiUrl: "https://api.sentineldashboard.site"` and push the site.

Data: Discord ID, username, display name, avatar hash and the list of servers where you can manage the server are kept in Workers KV for 24 h under a random session id (HttpOnly cookie). The Discord access token is revoked right after login and never stored.
