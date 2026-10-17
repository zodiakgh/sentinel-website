# Sentinel website

Static, bilingual (EN/FR) site for GitHub Pages, domain `sentineldashboard.site` (see `CNAME`, unchanged).
Pages are served without `.html` (`/dashboard`, `/commands`, `/verify`…): GitHub Pages maps `/name` to `name.html`.

## Publish
```
git add -A && git commit -m "Update website" && git push origin main
```
Pages settings stay as they are (deploy from branch, root). No build step.

## Configuration
Everything public lives in `assets/js/config.js`:
- `supportUrl`: the support server **invitation link** (`https://discord.gg/...`). Every "Join the support server" button reads it. A server ID alone cannot be used to join, so `supportGuildId` is only stored for reference.
- `inviteUrl` / `applicationId` / `invitePermissions`: the "Add to Discord" buttons.
- `authApiUrl`: the Cloudflare Worker used by the Discord login and the verification page.
- `statusApiUrl`: optional real monitoring (format documented in `assets/js/status.js`).

## Layout
- `*.html` pages, `assets/css/main.css`, `assets/js/` (`app.js` language/nav/animations, `commands.js` explorer, `dashboard.js` login, `verify.js` verification page, `status.js`).
- `assets/fonts/`: self-hosted fonts (SIL OFL licences in `LICENSES.txt`). No third-party font or tracking requests.
- `assets/js/i18n-fr.js`: French strings (English lives in the HTML). `assets/js/commands-data.js`: generated from the bot source by static analysis; regenerate when commands change.
- `terms.html` / `privacy.html`: full legal texts in English and French. Have them reviewed by a lawyer and update the date when you change them.

## Discord login and server verification
Both need the Cloudflare Worker in `auth-worker/` (see its README).
