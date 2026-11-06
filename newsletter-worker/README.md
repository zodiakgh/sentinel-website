# Sentinel Archive + Newsletter

The static archive lives on GitHub Pages. The newsletter API is a separate Cloudflare Worker so the existing Discord auth Worker is not modified.

## 1. Create the D1 database

```bash
npx wrangler d1 create sentinel-newsletter
```

Copy the returned database ID into `newsletter-worker/wrangler.toml` (replace `REPLACE_WITH_D1_DATABASE_ID`).

Apply the schema:

```bash
Run the command from the `newsletter-worker` directory:
```bash
npx wrangler d1 execute sentinel-newsletter --remote --file=schema.sql
```

## 2. Configure Resend

Verify the sending domain `sentineldashboard.site` in Resend and publish the DNS records it provides. Then create an API key.

In the Cloudflare Worker settings for `sentinel-newsletter`, add:
- Secret `RESEND_API_KEY`: your Resend API key.
- Secret `ADMIN_TOKEN`: a long, unique random password. Never put it in GitHub.
- Variable `RESEND_FROM`: `Sentinel <updates@sentineldashboard.site>` (only after the domain is verified).

## 3. Deploy the Worker

From `newsletter-worker`:

```bash
npm install -g wrangler
npx wrangler deploy
```

Cloudflare will attach the custom domain `newsletter.sentineldashboard.site`. Ensure the domain is active on the same Cloudflare account.

Check:
```
https://newsletter.sentineldashboard.site/health
```

## 4. Admin

Open `https://sentineldashboard.site/admin` and enter the ADMIN_TOKEN. The token is kept in session storage for the current browser tab/session and is sent only to the newsletter API over HTTPS.

## Notes

- Subscribers must confirm their email before receiving announcements.
- Every announcement includes an unsubscribe link.
- The admin API is protected by the ADMIN_TOKEN; do not share it.
- D1 stores subscriber consent and subscription status.
- This first version sends to at most 100 active subscribers per campaign. If the list grows, add a queued batch sender before increasing that limit.
- The existing Discord auth Worker is intentionally untouched.
