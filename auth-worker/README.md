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


## Support form (Resend)
`POST /support/send` sends the contact form (e-mail, Discord username, subject, message) using Resend's API. Cloudflare Email Routing is not required and your existing MX records should remain unchanged.

1. In Resend, verify `sentineldashboard.site` and create an API key with permission to send emails.
2. From this folder, run `npx wrangler secret put RESEND_API_KEY` and paste the API key when prompted. Never put the key in the website or commit it to Git.
3. In the Cloudflare Worker variables, set `SUPPORT_TO` to the real inbox where you want support requests delivered. Optionally set `SUPPORT_FROM` to an address on the domain verified in Resend. The default sender is `Sentinel Support <support@sentineldashboard.site>`.
4. Deploy the Worker with `npx wrangler deploy`.

Messages have *Reply-To* set to the visitor, so you can reply directly. The form limits each IP to one message per minute using a keyed hash that expires after 60 seconds, includes a honeypot, and supports optional Turnstile (`TURNSTILE_SECRET`, plus `turnstileSiteKey` in `assets/js/config.js`).
