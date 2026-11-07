# Sentinel Analytics Platform

Public multi-tenant website analytics SaaS for `sentineldashboard.site`.

## Phase 1 — foundation

This folder contains the new Next.js application. It is intentionally isolated from the existing static archive at the repository root so the current production site is not replaced before the new platform is ready.

### Stack

- Next.js App Router + React
- Tailwind CSS v4
- Cloudflare Workers
- OpenNext for Cloudflare
- Cloudflare D1 for account, workspace and project metadata (to be provisioned)
- Cloudflare Analytics Engine for high-volume event analytics (to be configured)
- Authentication provider integration is a Phase 2 task

### Local development

Use Node.js 22 or newer.

```bash
cd platform
npm install
npm run dev
```

### Cloudflare build

```bash
npm run preview
```

Deploy only after the Cloudflare Worker, D1 database, secrets and custom-domain routing have been configured.

### Product decisions

- Public self-service registration.
- Same primary domain: `sentineldashboard.site`.
- English-first interface.
- Dark monochrome visual identity.
- Each account can own multiple websites.
- Tenant isolation is mandatory for every database query and analytics endpoint.
- Never collect payment-card details. Payment events will later be received from a payment provider via verified webhooks.
- Tracking must be privacy-conscious and configurable for applicable consent requirements.

### Planned phases

1. Foundation: app scaffold, public landing page, deployment configuration.
2. Authentication: email/password, Google OAuth, GitHub OAuth, sessions and verification.
3. Multi-tenant data model: users, workspaces, memberships, sites and project keys.
4. Tracking pipeline: JavaScript snippet, ingestion API, event validation and bot filtering.
5. Analytics dashboard: realtime, traffic, pages, sources, devices, geography and custom events.
6. Billing and administration: payment-provider webhooks, plans, quotas, audit logs and abuse controls.

### Important

The landing page preview contains illustrative sample values only. No tracking, authentication, customer data or production analytics are active yet.
