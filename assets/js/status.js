/*
 * Sentinel status page.
 * No monitoring API exists yet, so this page never invents a state.
 *
 * To connect a real source, set SENTINEL_CONFIG.statusApiUrl to an HTTPS endpoint returning JSON:
 *   { "updated": "2026-01-01T12:00:00Z",
 *     "components": [ { "id": "bot", "status": "operational" | "degraded" | "outage" } ] }
 * Component ids must match those in COMPONENTS below. Anything else is shown as "unknown".
 */
(function () {
  "use strict";
  var list = document.getElementById("status-list");
  if (!list) return;
  var S = window.Sentinel; var CFG = (S && S.config) || {};
  var t = function (k, f) { return S ? S.t(k, f) : f; };
  var COMPONENTS = [
    { id: "bot", key: "status.c.bot", en: "Discord bot" },
    { id: "music", key: "status.c.music", en: "Music playback (Lavalink node)" },
    { id: "site", key: "status.c.site", en: "This website" }
  ];
  var banner = document.getElementById("status-banner");
  var bannerText = document.getElementById("status-banner-text");
  var updated = document.getElementById("status-updated");
  var retry = document.getElementById("status-retry");
  var data = null, mode = CFG.statusApiUrl ? "loading" : "none";

  function label(s) {
    return ({ operational: t("status.operational", "Operational"), degraded: t("status.degraded", "Degraded"), outage: t("status.outage", "Outage") })[s] || t("status.unknown", "Not monitored");
  }
  function cls(s) { return s === "operational" ? "ok" : (s === "degraded" || s === "outage") ? "bad" : "unk"; }
  function render() {
    list.innerHTML = COMPONENTS.map(function (c) {
      var st = "unknown";
      if (mode === "ok" && data && Array.isArray(data.components)) {
        var f = data.components.filter(function (x) { return x.id === c.id; })[0];
        if (f) st = f.status;
      }
      return '<div class="status-row"><span><span class="dot ' + cls(st) + '" aria-hidden="true"></span>' + t(c.key, c.en) + "</span><strong>" + label(st) + "</strong></div>";
    }).join("");
    retry.hidden = mode !== "error";
    if (mode === "none") bannerText.textContent = t("status.none", "Live status monitoring is not connected. This page does not show real-time information.");
    else if (mode === "loading") bannerText.textContent = t("status.loading", "Loading status…");
    else if (mode === "error") bannerText.textContent = t("status.error", "The status service could not be reached. No status is shown.");
    else bannerText.textContent = t("status.live", "Status provided by the configured monitoring endpoint.");
    updated.textContent = mode === "ok" && data && data.updated ? t("status.updated", "Last update") + ": " + data.updated : "";
  }
  function load() {
    if (!CFG.statusApiUrl) { mode = "none"; render(); return; }
    mode = "loading"; render();
    var ctl = new AbortController(); var to = setTimeout(function () { ctl.abort(); }, 8000);
    fetch(CFG.statusApiUrl, { signal: ctl.signal, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { data = j; mode = "ok"; })
      .catch(function () { mode = "error"; })
      .then(function () { clearTimeout(to); render(); });
  }
  retry.addEventListener("click", load);
  if (S) S.onLang(render);
  render(); load();
})();
