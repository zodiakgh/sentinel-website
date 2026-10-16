# Sentinel website

Static, bilingual (EN/FR) site for GitHub Pages — domain `sentineldashboard.site` (see `CNAME`, unchanged).

## Publish
```
git add -A && git commit -m "Redesign website" && git push origin main
```
Pages settings stay as they are (deploy from branch, root). No build step.

## Before going live
1. `assets/js/config.js`: set `applicationId` (or `inviteUrl`) and review `invitePermissions`.
2. `terms.html` / `privacy.html`: fill the highlighted `[PLACEHOLDER]` items; get legal review.
3. Optional: `statusApiUrl` for real monitoring (format documented in `assets/js/status.js`).

## Layout
- `*.html` pages, `assets/css/main.css`, `assets/js/` (`app.js` language/nav, `commands.js` explorer, `status.js`).
- `assets/js/i18n-fr.js`: French strings (English lives in the HTML). `assets/js/commands-data.js`: generated from the bot source by static analysis; regenerate when commands change.

## Discord login (optional)
Needs the Cloudflare Worker in `auth-worker/` (see its README). Until `authApiUrl` is set in `assets/js/config.js`, the Dashboard page stays in its "no login yet" state.
