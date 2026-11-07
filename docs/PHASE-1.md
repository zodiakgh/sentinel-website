# Phase 1 — Foundation and first catalog

## Product rules

- A public listing must have a verifiable open-source license.
- License and pricing are recorded separately.
- The first seed focuses on projects that can be downloaded or self-hosted at no cost.
- A paid hosted plan does not automatically make the underlying software proprietary.
- A source-code link alone does not qualify a project: the actual license must be verified.
- Only approved and verified listings appear in public search.

## Database

D1 database: `sentinel-open-catalog`

Apply the schema and seed migrations in order:

```bash
npx wrangler d1 migrations apply sentinel-open-catalog --local
npx wrangler d1 migrations apply sentinel-open-catalog --remote
```

- `0001_initial_schema.sql` creates the application tables.
- `0002_catalog_seed.sql` seeds 114 software projects, 10 categories, SPDX license references, platforms, and source links.

## Phase 1 checklist

- [x] Next.js + TypeScript foundation
- [x] Tailwind CSS foundation
- [x] OpenNext Cloudflare configuration
- [x] Initial D1 schema and binding
- [x] 114 curated software listings inserted into D1
- [x] Official website, source-code, and license references recorded for every listing
- [x] Category filtering and expanded catalog search endpoint
- [x] Reproducible catalog seed migration
- [ ] Authentication and user accounts
- [ ] Software detail pages
- [ ] Automated source/license re-checks
- [ ] Community submissions and moderation

## Security notes

- Passwords must be hashed with a modern password-hashing algorithm; never store plaintext passwords.
- Session cookies must be HttpOnly, Secure in production, and SameSite.
- Enforce authorization in server-side handlers.
- Never expose admin routes based only on client-side state.
- Do not commit secrets or production credentials.
