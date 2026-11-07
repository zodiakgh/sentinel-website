# SENTINEL — Open Software Discovery

A curated discovery platform for software that is both free to use and open source.

## Phase 1

This repository contains the initial Next.js foundation and first visual homepage.

## Requirements

- Node.js 20.9+
- npm
- Cloudflare account for deployment

## Local development

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

Before deployment, configure the required Cloudflare bindings and secrets. Do not commit credentials.

## Important product rule

A listing must be confirmed as both free to use and licensed under an approved open-source license. A source-code link alone is not sufficient proof.
