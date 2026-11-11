# Sentinel Status

A free uptime monitoring and status-page service for developers and teams.

## Repository layout

- `index.html`, `style.css`, `script.js`: public site and authenticated dashboard UI.
- `404.html`: GitHub Pages fallback for public status-page routes.
- `worker/index.js`: Cloudflare Worker API and scheduled monitor runner.
- `worker/schema.sql`: D1 schema.
- `wrangler.toml`: Worker deployment configuration.

## Infrastructure

- Frontend: GitHub Pages on `sentineldashboard.site`.
- API: Cloudflare Worker on `api.sentineldashboard.site`.
- Database: Cloudflare D1 database `sentinel-status` (EU jurisdiction).
- Transactional email: Resend, sender `login@sentineldashboard.site`.
- Scheduled checks: Cloudflare Cron Trigger, once per minute; each monitor is scheduled at its own interval.

## Worker secrets

Set these secrets on the `sentinel-status-api` Worker:

- `RESEND_API_KEY`: Resend sending-only key scoped to `sentineldashboard.site`.
- `AUTH_PEPPER`: random high-entropy secret used when hashing one-time codes.

Optional Worker variable:

- `EMAIL_FROM`: defaults to `Sentinel Status <login@sentineldashboard.site>`.

## Deploy

1. Install Wrangler: `npm install -g wrangler`.
2. Authenticate: `wrangler login`.
3. From the repository root, deploy with: `wrangler deploy --config wrangler.toml`.
4. Configure the custom domain `api.sentineldashboard.site` for the Worker.
5. Add the two secrets using `wrangler secret put RESEND_API_KEY` and `wrangler secret put AUTH_PEPPER`.
6. Publish the root files from the `sentinel-status` branch to GitHub Pages after review.

## Initial product limits

- 5 monitors per organization.
- 2 public status pages per organization.
- 5-minute minimum monitor interval.
- 30-day detailed check history.
- Passwordless email OTP; no permanent passwords.

## Important production hardening

Before opening public signups broadly, add DNS-level egress protection for monitor targets (including protection against DNS rebinding), delivery retries and webhook notifications, subscription confirmation, audit logs, abuse monitoring, and automated tests. The current monitor URL validator rejects IP literals, local hostnames and non-standard ports and does not follow redirects; it is a first layer, not a substitute for an isolated egress service.
