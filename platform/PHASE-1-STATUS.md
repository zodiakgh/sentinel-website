# Sentinel Analytics — Phase 1 status

Branch: `feature/sentinel-analytics-platform`

## Completed

- Isolated the new Next.js application in `platform/`; existing root-level archive files remain untouched.
- Added Next.js, React, Tailwind CSS v4 and OpenNext for Cloudflare project configuration.
- Added the initial Cloudflare Workers configuration with Node.js compatibility and observability.
- Created the public marketing homepage and dark monochrome design system.
- Added login and signup preview routes with explicit notices that authentication is not active.
- Documented product architecture, deployment prerequisites and planned phases.

## Not yet active

- No production deployment has been made.
- No DNS or custom-domain routing has been changed.
- No D1 database has been created or bound.
- No authentication provider is configured.
- No user accounts, website projects or analytics events are being collected.
- Dashboard and tracking endpoints are not implemented yet.

## Next actions

1. Install dependencies and run a production build to validate the scaffold.
2. Configure the Cloudflare Worker deployment for the `platform/` directory.
3. Provision D1 and design tenant-isolated user/workspace/site tables.
4. Implement email/password, Google and GitHub authentication with secure sessions.
5. Add verified email flows and abuse protection before opening registration.
