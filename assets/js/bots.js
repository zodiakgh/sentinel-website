/* Recommended bots: list comes from /bots.json (edit that file to add or change bots). */
(function () {
  "use strict";
  var list = document.getElementById("bots-list"), q = document.getElementById("bots-q"), cats = document.getElementById("bots-cats"), empty = document.getElementById("bots-empty");
  var FR = function () { return document.documentElement.lang === "fr"; };
  var NAMES = { all: ["All", "Tous"], moderation: ["Moderation", "Modération"], utility: ["Utility", "Utilitaires"], community: ["Community", "Communauté"], music: ["Music", "Musique"], support: ["Support", "Support"], fun: ["Fun", "Fun"], games: ["Games", "Jeux"] };
  var data = [], cat = "all";
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function safe(u) { return /^(https:\/\/|\/)/.test(u || "") ? u : "#"; }
  function label(k) { var n = NAMES[k] || [k, k]; return FR() ? n[1] : n[0]; }
  function draw() {
    var term = (q.value || "").toLowerCase().trim(), n = 0; list.textContent = "";
    data.forEach(function (b) {
      var d = FR() && b.descriptionFr ? b.descriptionFr : b.description;
      if (cat !== "all" && b.category !== cat) return;
      if (term && (b.name + " " + d).toLowerCase().indexOf(term) < 0) return;
      var li = el("li", "bot-card" + (b.featured ? " featured" : "")), top = el("div", "bot-top"), a = el("a", "bot-name", b.name); a.href = safe(b.url);
      if (/^https:/.test(b.url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      top.append(a); if (b.tag) top.append(el("span", "badge", b.tag)); top.append(el("span", "badge", label(b.category)));
      li.append(top, el("p", "bot-desc", d));
      var go = el("a", "btn btn-sm", FR() ? "Voir le bot" : "View bot"); go.href = safe(b.url); if (/^https:/.test(b.url)) { go.target = "_blank"; go.rel = "noopener noreferrer"; }
      li.append(go); list.append(li); n++;
    });
    empty.hidden = n > 0;
  }
  function chips() {
    cats.textContent = ""; var keys = ["all"]; data.forEach(function (b) { if (keys.indexOf(b.category) < 0) keys.push(b.category); });
    keys.forEach(function (k) { var b = el("button", "btn btn-sm" + (cat === k ? " btn-primary" : ""), label(k)); b.type = "button"; b.addEventListener("click", function () { cat = k; chips(); draw(); }); cats.append(b); });
  }
  q.addEventListener("input", draw);
  new MutationObserver(function () { chips(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  fetch("/bots.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) { data = (j.bots || []).slice(0, 200); chips(); draw(); }).catch(function () { empty.hidden = false; empty.textContent = "Could not load the list."; });
})();
