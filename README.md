# Sentinel Analytics

A privacy-conscious multi-tenant website analytics platform built with Next.js, Cloudflare Workers/OpenNext and Cloudflare D1.

## Local development

- Node.js 20.9+ (use the current LTS supported by the installed Next.js release)
- Install: `npm install`
- Run: `npm run dev`

## Cloudflare

1. Create a **new dedicated D1 database** named `sentinel-analytics`.
2. Replace the placeholder `database_id` in `wrangler.jsonc` with its actual ID.
3. Apply the initial schema with `wrangler d1 migrations apply sentinel-analytics --remote`.
4. Configure authentication secrets only through Cloudflare secrets; never commit credentials.
5. Build and preview with `npm run preview`.

Do not point production DNS at this Worker until the app, authentication, tenant isolation, tracking and privacy controls have passed validation.

## Current status

The public marketing pages and visual sign-in / sign-up previews are implemented. Authentication, OAuth, live dashboard data, tracking ingestion, billing and production deployment are **not active yet**. The preview forms are deliberately disabled.

The D1 migration is a starting schema, not a complete authentication schema. Authentication tables must be generated and reviewed for the chosen auth provider before enabling sign-in.

## Architecture principles

- Separate workspace and site ownership on every server-side query.
- Never trust a site ID or workspace ID supplied by a browser without verifying membership.
- Store only hashed API keys.
- Use provider-confirmed payment webhooks; never collect or store payment-card details.
- Define consent, retention, export and deletion behavior before enabling production analytics.
- Keep the existing Sentinel newsletter Worker and its D1 database isolated.
