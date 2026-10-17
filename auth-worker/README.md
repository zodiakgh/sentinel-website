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


## Server verification (member verification page)

The same Worker also powers `https://sentineldashboard.site/verify?guild=<server id>`.

1. Add two secrets to the Worker: `BOT_TOKEN` (the bot token, needed to give the role) and `BOT_API_KEY` (any long random string).
2. In the bot's environment (not in the website repo) add the same random string as `SENTINEL_API_KEY`, then replace `bot/cogs/verify.py` with the patched file.
3. Run `/verify setup` again (or any command that registers the server). The bot sends the server's role, log channel and age limits to `POST /verify/register`.
4. In Discord's developer portal, the redirect URI stays `https://api.sentineldashboard.site/auth/callback` (already used by the dashboard login).
5. Optional captcha: create a Cloudflare Turnstile widget, set the variable `TURNSTILE_SITE_KEY` and the secret `TURNSTILE_SECRET`.

The bot's role must be above the verified role and have Manage Roles. Every check (membership, account age, time in the server, captcha) is repeated by the Worker; the browser cannot give itself a role.


## Support form
`POST /support/send` e-mails the contact form (e-mail, Discord username, subject, message) with the Cloudflare Email Routing `send_email` binding.
1. Cloudflare dashboard → your domain → **Email → Email Routing** → enable it and add your real inbox as a **verified destination address**.
2. Add to `wrangler.toml`: `send_email = [{ name = "SUPPORT_MAIL" }]`, and a variable `SUPPORT_TO` = that verified address (optional `SUPPORT_FROM`, an address on your domain).
3. Messages arrive with *Reply-To* set to the visitor, so you can simply reply. One message per visitor per minute, honeypot, optional Turnstile (`TURNSTILE_SECRET`, plus `turnstileSiteKey` in `assets/js/config.js`).
