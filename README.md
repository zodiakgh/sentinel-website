# SENTINEL — Controlled Chaos

A monochrome, interactive browser experiment inspired by experimental corners of the internet.

The experience is intentionally opt-in:
- The visual sequence starts only when the visitor presses the button.
- Signal distortion, gravity, and cursor echo are individually switchable.
- Reset All Effects immediately returns the page to its default state.
- All effects run locally in the current tab.

No forced popups, automatic downloads, permission prompts, third-party account actions, or navigation traps.

## Development

- Node.js 22+
- `npm install`
- `npm run dev`

## Cloudflare

This project uses Next.js with OpenNext for Cloudflare Workers.

- `npm run preview`
- `npm run deploy`

The Worker name and compatibility settings are kept in `wrangler.jsonc`.
