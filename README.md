# Sentinel Pulse

Sentinel Pulse is a new, independent SaaS platform for website and API monitoring, performance analytics, incident management and public status pages.

This repository is being rebuilt from the previous static Sentinel website. The previous application is intentionally not part of the new product architecture.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS 4
- Cloudflare Workers with OpenNext
- Cloudflare D1, R2, Queues and Cron Triggers (introduced as features require them)

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Cloudflare

```bash
npm run cf-typegen
npm run build
npm run preview
```

Review the generated OpenNext output locally before deploying. Configure the Cloudflare Worker and custom domain in the Cloudflare dashboard; do not reuse the old website's Worker bindings or database.

## Environment

Copy `.env.example` to `.env.local` for local-only configuration. Never commit secrets.

## Product principles

- Real monitoring data only; clearly label previews and sample data.
- Strict workspace isolation and server-side authorization.
- Validate and restrict monitored destinations to prevent SSRF.
- Keep the public status page separate from private workspace data.
