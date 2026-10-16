/*
 * Sentinel website — public configuration.
 * Only PUBLIC values belong here. Never put bot tokens, client secrets,
 * webhook URLs or any other credential in this file (it is served to everyone).
 */
window.SENTINEL_CONFIG = {
  supportUrl: "https://discord.gg/NwXnVdzyuf",
  githubUrl: "https://github.com/zodiakgh/sentinel-website",
  siteUrl: "https://sentineldashboard.site",

  /* --- Bot invitation ---------------------------------------------------
   * The supplied bot source contains NO application (client) ID, so a real
   * invitation URL cannot be built. To enable the "Add to Discord" buttons:
   *   1. Paste the numeric Application ID (Discord Developer Portal →
   *      General Information) into applicationId below, OR paste a full
   *      invite URL into inviteUrl (it wins over applicationId).
   *   2. Review invitePermissions (see docs.html#permissions).
   * Until then, "Add to Discord" opens the invitation guide instead.      */
  applicationId: "1545465845524996219",
  inviteUrl: "https://canary.discord.com/oauth2/authorize?client_id=1545465845524996219",              // TODO: optional full invite URL
  invitePermissions: "8",     // TODO: REVIEW — 8 = Administrator (see docs)

  /* --- Live status ------------------------------------------------------
   * No monitoring/status API exists in the supplied code. When one is
   * available, set statusApiUrl to an HTTPS JSON endpoint; see
   * assets/js/status.js for the expected response shape.                  */
  /* --- Discord login ----------------------------------------------------
   * Needs the small Cloudflare Worker in /auth-worker (it keeps the Discord
   * client secret). Leave empty until it is deployed: the dashboard page then
   * stays in its honest "no login yet" state. Example:
   *   authApiUrl: "https://api.sentineldashboard.site"                      */
  authApiUrl: "",

  statusApiUrl: ""
};
