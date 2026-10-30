(function() {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var q = new URLSearchParams(location.search), gid = q.get("guild") || "";
  var stateBox = document.getElementById("mg-state"), app = document.getElementById("mg-app"), lead = document.getElementById("mg-lead");
  var FR = document.documentElement.lang === "fr";
  function T(en, fr) { return FR ? fr : en; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== void 0) n.textContent = text; return n; }
  function show(msg) { stateBox.hidden = false; stateBox.textContent = msg; }
  function api(path, body) {
    return fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" }, body: body ? JSON.stringify(body) : void 0 }).then(function(r) {
      return r.json().catch(function() { return {}; }).then(function(j) {
        if (!r.ok) { var e = new Error(j.message || j.error || "Request failed"); e.code = j.error; throw e; }
        return j;
      });
    });
  }
  function section(title) { var s = el("div", "mg-sec"); s.appendChild(el("h2", "", title)); app.appendChild(s); app.hidden = false; return s; }
  if (!API) { lead.textContent = ""; return show(T("The dashboard service is not configured yet.", "Le service du dashboard n'est pas encore configuré.")); }
  if (!/^\d{15,25}$/.test(gid)) { lead.textContent = ""; return show(T("No server selected. Choose one in the dashboard.", "Aucun serveur sélectionné. Choisis-en un dans le dashboard.")); }
  lead.textContent = T("Let Sentinel bring your members back if you ever rebuild this server from a backup.", "Permets à Sentinel de ramener tes membres si tu recrées ce serveur depuis une sauvegarde.");
  function render(d) {
    app.textContent = "";
    var s = section(T("Keep my members", "Garder mes membres"));
    s.appendChild(el("p", "mg-hint", T("Members who choose to stay connected can be re-added automatically when you restore a backup (/backup use) on a new server. Only members who agree on the link below are kept, and each can withdraw at any time. Only the server owner can use this.", "Les membres qui choisissent de rester connectés peuvent être rajoutés automatiquement quand tu restaures une sauvegarde (/backup use) sur un nouveau serveur. Seuls les membres qui acceptent via le lien ci-dessous sont gardés, et chacun peut se retirer à tout moment. Seul le propriétaire du serveur peut utiliser cette option.")));
    if (!d.available) { s.appendChild(el("p", "mg-hint", T("This feature is not configured on the server yet.", "Cette fonction n'est pas encore configurée sur le serveur."))); return; }
    var lab = el("label", "mg-chk"), box = el("input"); box.type = "checkbox"; box.checked = d.enabled; box.disabled = !d.owner;
    lab.appendChild(box); lab.appendChild(document.createTextNode(" " + T("Keep members of this server for backups", "Garder les membres de ce serveur pour les sauvegardes")));
    s.appendChild(lab);
    if (!d.owner) s.appendChild(el("p", "mg-hint", T("Only the owner of the server can change this.", "Seul le propriétaire du serveur peut modifier ceci.")));
    var msg = el("p", "mg-hint"); s.appendChild(msg);
    box.addEventListener("change", function() {
      box.disabled = true;
      api("/dash/guild/" + gid + "/members-backup", { enabled: box.checked }).then(load).catch(function(e) { box.checked = !box.checked; box.disabled = false; msg.textContent = e.message; });
    });
    if (d.enabled) {
      var l = section(T("Invite your members", "Invite tes membres"));
      l.appendChild(el("p", "mg-hint", T("Share this link. Members who open it and accept will be kept. Members who disable it later are removed.", "Partage ce lien. Les membres qui l'ouvrent et acceptent sont gardés. Ceux qui se retirent plus tard sont supprimés.")));
      var inp = el("input"); inp.type = "text"; inp.readOnly = true; inp.value = d.link; inp.addEventListener("focus", function() { inp.select(); });
      l.appendChild(inp);
      l.appendChild(el("p", "mg-hint", T("Members kept so far: ", "Membres gardés pour l'instant : ") + d.count + (d.more ? "+" : "")));
    }
  }
  function load() { return api("/dash/guild/" + gid + "/members-backup").then(render).catch(function(e) { app.hidden = true; show(e.code === "unauthenticated" ? T("Sign in on the dashboard first.", "Connecte-toi d'abord sur le dashboard.") : e.message); }); }
  load();
})();
