# Sentinel Discord Toolkit

The public Discord lookup and developer tools at **sentineldashboard.site**.

## Included

- Discord user lookup by numeric ID
- Server lookup by numeric ID
- Invite metadata lookup
- Snowflake decoder and timestamp builder
- CDN URL builder
- Permission bitfield inspector
- JSON formatter
- Consent-based voice session statistics API

## Run locally

- Node.js 20+
- `npm install`
- `npm run dev`

## Deploy

`npm run deploy`

The Worker is named `sentinel-website`. Cloudflare resources are configured in `wrangler.jsonc`.

## Required Worker secrets

- `BOT_TOKEN`: Discord bot token used for API requests. The bot must have access to the server for server lookup.
- `BOT_API_KEY`: existing Sentinel bot API key, used to authenticate voice event ingestion.

Do not put secret values in this repository.

## Voice event collection

Voice statistics are not provided by Discord's public API. The Sentinel bot must send join/leave events to `POST /api/voice/events`. The server and user must both opt in before a session is stored or displayed. The endpoint does not accept audio or message contents.

See the API reference on the site for the event payload.
