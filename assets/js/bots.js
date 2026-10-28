(function () {
  "use strict";
  var list = document.getElementById("bots-list"), q = document.getElementById("bots-q"), cats = document.getElementById("bots-cats"), empty = document.getElementById("bots-empty"), count = document.getElementById("bots-count");
  var FR = function () { return document.documentElement.lang === "fr"; };
  var NAMES = { all: ["All", "Tous"], moderation: ["Moderation", "Modération"], utility: ["Utility", "Utilitaires"], community: ["Community", "Communauté"], music: ["Music", "Musique"], support: ["Support", "Support"], fun: ["Fun", "Fun"], games: ["Games", "Jeux"] };
  var COLORS = ["#5865f2", "#3ba55d", "#e67e22", "#e91e63", "#9b59b6", "#16a085", "#c0392b", "#2980b9"];
  var data = [], cat = "all";
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function safe(u) { return /^(https:\/\/|\/)/.test(u || "") ? u : ""; }
  function ext(a) { if (/^https:/.test(a.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } return a; }
  function label(k) { var n = NAMES[k] || [k, k]; return FR() ? n[1] : n[0]; }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }
  function avatar(b) {
    var src = safe(b.image);
    function ph() { var d = el("span", "bot-av bot-ph", (b.name || "?").charAt(0).toUpperCase()); d.style.background = hue(b.name || "?"); d.setAttribute("aria-hidden", "true"); return d; }
    if (!src) return ph();
    var i = el("img", "bot-av"); i.src = src; i.alt = ""; i.width = i.height = 56; i.loading = "lazy"; i.referrerPolicy = "no-referrer";
    i.addEventListener("error", function () { if (i.parentNode) i.parentNode.replaceChild(ph(), i); });
    return i;
  }
  function btn(text, url, cls) { var u = safe(url); if (!u) return null; var a = el("a", "btn btn-sm" + (cls ? " " + cls : ""), text); a.href = u; return ext(a); }
  function draw() {
    var term = (q.value || "").toLowerCase().trim(), n = 0; list.textContent = "";
    data.forEach(function (b) {
      var d = FR() && b.descriptionFr ? b.descriptionFr : (b.description || "");
      if (cat !== "all" && b.category !== cat) return;
      if (term && (b.name + " " + d + " " + (b.tag || "")).toLowerCase().indexOf(term) < 0) return;
      var li = el("li", "bot-card" + (b.featured ? " featured" : "")), head = el("div", "bot-head"), id = el("div", "bot-id"), tags = el("div", "bot-tags");
      var site = safe(b.url), name;
      if (site) { name = el("a", "bot-name", b.name); name.href = site; ext(name); } else name = el("span", "bot-name", b.name);
      if (b.tag) tags.append(el("span", "badge perm", b.tag));
      tags.append(el("span", "badge", label(b.category)));
      id.append(name, tags); head.append(avatar(b), id);
      var acts = el("div", "bot-actions");
      [btn(FR() ? "Inviter" : "Invite", b.invite, "btn-primary"), btn(FR() ? "Site" : "Website", b.url), btn("Support", b.support)].forEach(function (x) { if (x) acts.append(x); });
      li.append(head, el("p", "bot-desc", d)); if (acts.childNodes.length) li.append(acts);
      list.append(li); n++;
    });
    empty.hidden = n > 0; count.textContent = n + (FR() ? (n > 1 ? " bots" : " bot") : (n > 1 ? " bots" : " bot"));
  }
  function chips() {
    cats.textContent = ""; var keys = ["all"]; data.forEach(function (b) { if (keys.indexOf(b.category) < 0) keys.push(b.category); });
    keys.forEach(function (k) { var b = el("button", "btn btn-sm" + (cat === k ? " btn-primary" : ""), label(k)); b.type = "button"; b.addEventListener("click", function () { cat = k; chips(); draw(); }); cats.append(b); });
  }
  q.addEventListener("input", draw);
  new MutationObserver(function () { chips(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  fetch("/bots.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) {
    data = (j.bots || []).slice(0, 300).sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); }); chips(); draw();
  }).catch(function () { empty.hidden = false; empty.textContent = "Could not load the list."; });
})();
