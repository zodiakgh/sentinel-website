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
  var st = q.get("status") || "";
  var msgs = {
    ok: T("You're set. If this server is ever rebuilt, its owner can bring you back.", "C'est fait. Si ce serveur est un jour recréé, son propriétaire pourra te faire revenir."),
    revoked: T("Done. Sentinel no longer keeps your access for any server.", "C'est fait. Sentinel ne conserve plus ton accès pour aucun serveur."),
    cancelled: T("Cancelled. Nothing was saved.", "Annulé. Rien n'a été enregistré."),
    disabled: T("This server doesn't use this option.", "Ce serveur n'utilise pas cette option."),
    not_member: T("You need to be a member of this server first.", "Tu dois d'abord être membre de ce serveur."),
    unavailable: T("This option isn't available right now.", "Cette option n'est pas disponible pour le moment."),
    error: T("Something went wrong. Please try again.", "Une erreur est survenue. Réessaie.")
  };
  lead.textContent = T("A server owner can keep a way to re-add you if the server is deleted and rebuilt.", "Le propriétaire d'un serveur peut garder un moyen de te rajouter si le serveur est supprimé puis recréé.");
  if (st && msgs[st]) show(msgs[st]);
  if (!API) return;
  var s = section(T("What this does", "Ce que ça fait"));
  [T("If you agree, Sentinel stores an encrypted Discord access token for you. It is only used to add you back to a server rebuilt by its original owner.", "Si tu acceptes, Sentinel conserve un jeton d'accès Discord chiffré. Il sert uniquement à te rajouter à un serveur recréé par son propriétaire d'origine."),
   T("Sentinel can't read your messages or see your email. You can withdraw at any time below, and the token is deleted.", "Sentinel ne peut pas lire tes messages ni voir ton email. Tu peux te retirer à tout moment ci-dessous, et le jeton est supprimé."),
   T("See the Privacy Policy for details.", "Voir la politique de confidentialité pour plus de détails.")].forEach(function(t) { s.appendChild(el("p", "mg-hint", t)); });
  var row = el("div", ""); row.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:6px";
  if (/^\d{15,25}$/.test(gid)) { var a = el("a", "btn btn-primary", T("Keep me connected", "Me garder connecté")); a.href = API + "/rejoin/start?guild=" + gid; row.appendChild(a); }
  var r = el("a", "btn", T("Withdraw my authorization", "Retirer mon autorisation")); r.href = API + "/rejoin/revoke"; row.appendChild(r);
  s.appendChild(row); var p = el("a", "mg-hint", T("Privacy Policy", "Politique de confidentialité")); p.href = "/privacy"; s.appendChild(p);
})();
