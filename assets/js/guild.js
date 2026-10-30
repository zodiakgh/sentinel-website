(function() {
  "use strict";
  var gid = new URLSearchParams(location.search).get("guild") || "";
  var stateBox = document.getElementById("mg-state"), app = document.getElementById("mg-app"), lead = document.getElementById("mg-lead");
  var FR = document.documentElement.lang === "fr";
  function T(en, fr) { return FR ? fr : en; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== void 0) n.textContent = text; return n; }
  if (!/^\d{15,25}$/.test(gid)) {
    lead.textContent = "";
    stateBox.hidden = false;
    stateBox.textContent = T("No server selected. Choose one in the dashboard.", "Aucun serveur sélectionné. Choisis-en un dans le dashboard.");
    return;
  }
  lead.textContent = T("Choose what you want to manage on this server.", "Choisis ce que tu veux gérer sur ce serveur.");
  var q = "?guild=" + encodeURIComponent(gid);
  var items = [
    { href: "/builder" + q, title: T("Server builder", "Constructeur de serveur"), text: T("Build or complete your server: roles, categories, channels and permissions.", "Construis ou complète ton serveur : rôles, catégories, salons et permissions.") },
    { href: "/members" + q, title: T("Member backup", "Sauvegarde des membres"), text: T("Choose whether Sentinel keeps your members so they can be brought back after a restore. Owner only.", "Choisis si Sentinel garde tes membres pour pouvoir les ramener après une restauration. Réservé au propriétaire.") },
    { href: "/manage" + q, title: T("Tickets", "Tickets"), text: T("Ticket types and panels. Currently under maintenance.", "Types de tickets et panneaux. Actuellement en maintenance."), badge: T("Maintenance", "Maintenance") }
  ];
  var grid = el("div", "mg-hub");
  items.forEach(function(it) {
    var a = el("a", "mg-sec mg-card");
    a.href = it.href;
    var h = el("h2", "", it.title);
    if (it.badge) h.appendChild(el("span", "badge", it.badge));
    a.appendChild(h);
    a.appendChild(el("p", "mg-hint", it.text));
    grid.appendChild(a);
  });
  app.appendChild(grid);
  app.hidden = false;
  var back = el("a", "mg-hint", T("← Back to the dashboard", "← Retour au dashboard"));
  back.href = "/dashboard";
  app.appendChild(back);
})();
