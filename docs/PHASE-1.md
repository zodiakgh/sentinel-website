# Phase 1 — Foundation

## Product rules

- A public catalogue entry must be both free to use and open source.
- Free-to-use status and open-source license are verified independently.
- Only approved entries may be exposed in public search.
- A visible code repository does not automatically qualify as open source.
- Paid tiers may exist only if the software also has a genuinely usable free version; such products are excluded from the strict catalogue unless the product owner later changes this policy.

## Database

Apply the initial schema with Wrangler after creating the D1 database:

```bash
npx wrangler d1 create sentinel-open-catalog
```

Copy the returned database_id into `wrangler.jsonc`, then run:

```bash
npx wrangler d1 migrations apply sentinel-open-catalog --local
npx wrangler d1 migrations apply sentinel-open-catalog --remote
```

The migration is located in `migrations/0001_initial_schema.sql`.

## Phase 1 completion checklist

- [x] Next.js + TypeScript foundation
- [x] Tailwind CSS foundation
- [x] OpenNext Cloudflare configuration
- [x] Initial homepage visual direction
- [x] Initial D1 schema
- [ ] Install dependencies and run a local build
- [ ] Create and bind the D1 database
- [ ] Configure Cloudflare deployment secrets and production build
- [ ] Add automated tests and CI
- [ ] Implement authentication in Phase 2

## Security notes

- Passwords must be hashed with a modern password-hashing algorithm; never store plaintext passwords.
- Session cookies must be HttpOnly, Secure in production, and SameSite.
- Enforce authorization in server-side handlers.
- Never expose admin routes based only on client-side state.
- Do not commit secrets or production credentials.
