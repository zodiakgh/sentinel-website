/*
 * Sentinel website: public configuration.
 * Only PUBLIC values belong here. Never put bot tokens, client secrets,
 * webhook URLs or any other credential in this file (it is served to everyone).
 */
window.SENTINEL_CONFIG = {
  /* Support server. Every "Join the support server" link on the site reads this value.
   * It must be an invitation link (https://discord.gg/xxxx). A server ID cannot be used to join. */
  supportUrl: "https://discord.gg/NwXnVdzyuf",
  supportGuildId: "1560609973547827271",
  githubUrl: "https://github.com/zodiakgh/sentinel-website",
  siteUrl: "https://sentineldashboard.site",

  /* Bot invitation. inviteUrl wins over applicationId. */
  applicationId: "1545465845524996219",
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=1545465845524996219",
  invitePermissions: "8",

  /* Discord login and server verification: the Cloudflare Worker in /auth-worker.
   * Leave empty to keep the dashboard in its "no login" state. */
  authApiUrl: "https://api.sentineldashboard.site",

  /* Live status: optional HTTPS JSON endpoint, see assets/js/status.js. */
  statusApiUrl: ""
};
