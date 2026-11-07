# Sentinel Pulse — Product brief

## Positioning
Sentinel Pulse is an independent SaaS platform for developers and businesses to monitor website and API availability, understand incidents, and communicate service health.

## Product principles
- Accurate data only; never fabricate uptime or performance metrics.
- Separate public marketing pages, authenticated workspace pages, and public status pages.
- Enforce workspace isolation and role permissions server-side.
- Build the monitoring engine as asynchronous background work, not inside page requests.
- Protect monitors against SSRF, private-network access, unsafe redirects, and resource exhaustion.
- Keep the former Sentinel Discord bot and its data completely separate.

## Initial release scope
1. Foundation: Next.js app, design system, Cloudflare deployment scaffold, authentication, D1 schema, workspaces.
2. Monitoring: HTTP/HTTPS checks, scheduling, queues, persisted results.
3. Analytics: uptime and response-time history.
4. Incidents: confirmed failure detection, lifecycle, notifications.
5. Status pages: public components and incident history.
6. Developer platform: API keys, REST API, signed webhooks.
7. Business: teams, billing, reports, advanced retention.

## Current implementation status
The initial frontend scaffold and product shell exist. Authentication, persistence, workspace creation, live monitoring, notifications, and billing are not implemented yet.
