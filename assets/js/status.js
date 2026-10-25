/*
 * Sentinel status page.
 * Reads /status.json (a plain file in the repository) and shows exactly what it says.
 * Edit status.json on GitHub to change the page. Nothing is invented here.
 *
 *   { "updated": "ISO date", "message": "", "messageFr": "",
 *     "components": [ { "id", "name", "nameFr", "status": "operational|degraded|outage|maintenance", "note", "noteFr" } ] }
 */
(function () {
  "use strict";
  var list = document.getElementById("status-list");
  if (!list) return;
  var S = window.Sentinel, CFG = (S && S.config) || {};
  var t = function (k, f) { return S ? S.t(k, f) : f; };
  var fr = function () { return document.documentElement.lang === "fr"; };
  var URL_ = CFG.statusApiUrl || "/status.json";
  var overall = document.getElementById("status-overall"), overallText = document.getElementById("status-overall-text");
  var msgBox = document.getElementById("status-message"), updated = document.getElementById("status-updated"), retry = document.getElementById("status-retry");
  var data = null, mode = "loading";
  var VALID = { operational: 1, degraded: 1, outage: 1, maintenance: 1 };

  function label(s) {
    return ({ operational: t("status.operational", "Operational"), degraded: t("status.degraded", "Degraded"), outage: t("status.outage", "Outage"), maintenance: t("status.maintenance", "Maintenance") })[s] || t("status.unknown", "Unknown");
  }
  function cls(s) { return VALID[s] ? s : "unknown"; }
  function worst(items) {
    var rank = { operational: 0, maintenance: 1, degraded: 2, outage: 3 }, w = "operational";
    items.forEach(function (c) { var s = VALID[c.status] ? c.status : "operational"; if (rank[s] > rank[w]) w = s; });
    return w;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render() {
    var comps = mode === "ok" && data && Array.isArray(data.components) ? data.components.slice(0, 20) : [];
    list.innerHTML = comps.map(function (c) {
      var name = (fr() && c.nameFr) || c.name || c.id || "", note = (fr() && c.noteFr) || c.note || "", st = cls(c.status);
      return '<div class="status-row ' + st + '"><span class="st-name"><span class="dot ' + st + '" aria-hidden="true"></span><span>' + esc(name) + (note ? '<small>' + esc(note) + "</small>" : "") + '</span></span><strong class="st-label ' + st + '">' + esc(label(c.status)) + "</strong></div>";
    }).join("");
    list.hidden = !comps.length;
    retry.hidden = mode !== "error";
    var w = comps.length ? worst(comps) : "unknown";
    ["operational", "degraded", "outage", "maintenance", "unknown"].forEach(function (k) { overall.classList.remove(k); }); overall.classList.add(mode === "ok" ? w : "unknown");
    if (mode === "loading") overallText.textContent = t("status.loading", "Loading status…");
    else if (mode === "error") overallText.textContent = t("status.error", "The status could not be loaded.");
    else overallText.textContent = ({ operational: t("status.all.ok", "All systems operational"), maintenance: t("status.all.maint", "Scheduled maintenance"), degraded: t("status.all.deg", "Some systems are degraded"), outage: t("status.all.out", "Some systems are down") })[w];
    var m = mode === "ok" && data ? ((fr() && data.messageFr) || data.message || "") : "";
    msgBox.textContent = m; msgBox.hidden = !m;
    var d = mode === "ok" && data && data.updated ? new Date(data.updated) : null;
    updated.textContent = d && !isNaN(d) ? t("status.updated", "Last update") + ": " + d.toLocaleString(fr() ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
  }
  function load() {
    mode = "loading"; render();
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 8000);
    fetch(URL_ + (URL_.indexOf("?") < 0 ? "?t=" + Date.now() : ""), { signal: ctl.signal, cache: "no-store", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { data = j; mode = "ok"; })
      .catch(function () { mode = "error"; })
      .then(function () { clearTimeout(to); render(); });
  }
  retry.addEventListener("click", load);
  if (S) S.onLang(render);
  load();
})();
