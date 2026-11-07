# Sentinel Pulse

Independent SaaS application for website and API uptime monitoring.

This application lives in `pulse/` so the existing Sentinel website and newsletter at the repository root remain untouched.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS v4
- Cloudflare Workers + OpenNext
- Cloudflare D1, R2, Queues and Cron Triggers (to be provisioned in later foundation steps)

## Local development

Requirements: Node.js 20.9+ and npm.

```bash
cd pulse
npm install
npm run dev
```

## Cloudflare

The Cloudflare Worker name is `sentinel-pulse`. The Cloudflare build root must be set to `pulse`.

Before the first deployment:
1. Create a dedicated Cloudflare D1 database for Pulse.
2. Add its binding and database ID to `wrangler.jsonc`.
3. Configure authentication and email secrets.
4. Build and test with `npm run preview`.

Do not reuse the old newsletter database or the former Discord bot's data.

## Current status

The initial Next.js/OpenNext scaffold and visual product shell are in place. Dashboard figures are intentionally empty; authentication, database access and real monitoring are not implemented yet.
