# SENTINEL — Open Software Discovery

A curated directory for discovering software with verifiable open-source licenses.

## Current catalog

The first catalog seed contains **114 software projects** across 10 categories. Each listing includes:
- Official project website
- Source-code repository
- SPDX license identifier and license reference
- Category and supported platform metadata
- Separate pricing-status field

The current seed focuses on software that can be downloaded or self-hosted without paying. Hosted services may still offer paid plans; those are not the same thing as the software license.

## Catalog standards

- A listing must have a verifiable open-source license.
- License identifiers are checked against the SPDX license list and OSI-approved license references.
- A source-code link alone is not proof of an open-source license.
- Pricing and licensing are separate fields. Free tiers are not treated as open-source.
- Public search only returns approved, verified entries.

## Data sources

- [SPDX License List](https://spdx.org/licenses/)
- [Open Source Initiative — Licenses](https://opensource.org/licenses)
- [Awesome Self-Hosted](https://github.com/awesome-selfhosted/awesome-selfhosted) as a discovery index
- Official project websites and source repositories linked on each software record

## Database

- `migrations/0001_initial_schema.sql` — initial D1 schema
- `migrations/0002_catalog_seed.sql` — categories, licenses, software, platforms, and source references

## Local development

Requirements: Node.js 22+, npm, and a Cloudflare account for remote deployment.

```bash
npm install
npm run dev
```

## Cloudflare

The project uses Next.js with OpenNext for Cloudflare Workers.

```bash
npm run preview
npm run deploy
```

Configure the D1 binding and required secrets before deployment. Never commit credentials.
