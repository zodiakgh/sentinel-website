(function () {
  "use strict";
  var grid = document.getElementById("srv-list"), count = document.getElementById("srv-count"), msg = document.getElementById("srv-msg"),
    more = document.getElementById("srv-more"), tagBox = document.getElementById("srv-tag"), dlg = document.getElementById("srv-age"),
    f = { q: document.getElementById("srv-q"), category: document.getElementById("srv-category"), language: document.getElementById("srv-language"),
      sort: document.getElementById("srv-sort"), nsfw: document.getElementById("srv-nsfw") };
  if (!grid || !f.q) return;
  var CFG = window.SENTINEL_CONFIG || {};
  var API = String(CFG.serversApiUrl || "").replace(/\/+$/, "");
  var PER = 12;
  var FR = function () { return document.documentElement.lang === "fr"; };
  var T = {
    all: ["All categories", "Toutes les catégories"], langs: ["All languages", "Toutes les langues"],
    sbump: ["Recently bumped", "Bump récent"], smem: ["Most members", "Plus de membres"], snew: ["Newest", "Plus récents"],
    nhide: ["Hide NSFW", "Masquer le NSFW"], nshow: ["Show NSFW", "Afficher le NSFW"], nonly: ["NSFW only", "NSFW uniquement"],
    members: ["members", "membres"], bumped: ["Bumped", "Bump"], join: ["Join", "Rejoindre"], tag: ["Tag", "Tag"], clear: ["Clear", "Retirer"],
    more: ["Load more", "Voir plus"], none: ["No server matches your filters.", "Aucun serveur ne correspond à tes filtres."],
    err: ["Could not load the directory. Try again later.", "Impossible de charger l'annuaire. Réessaie plus tard."],
    off: ["The server directory is not available yet.", "L'annuaire de serveurs n'est pas encore disponible."],
    mixed: ["The directory API must use HTTPS.", "L'API de l'annuaire doit utiliser HTTPS."]
  };
  function tr(k) { return T[k][FR() ? 1 : 0]; }
  var meta = { categories: [], languages: [] };
  var s = { q: "", category: "", language: "", sort: "bump", nsfw: "hide", tag: "", page: 1 };
  var adult = false, ctl = null, shown = [];
  try { adult = localStorage.getItem("sentinel.adult18") === "1"; } catch (e) {}

  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function cdn(u) { return typeof u === "string" && u.indexOf("https://cdn.discordapp.com/") === 0 ? u : ""; }
  function invite(u) { return typeof u === "string" && u.indexOf("https://discord.gg/") === 0 ? u : ""; }
  function lab(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return FR() ? list[i].fr : list[i].en; return id; }
  function ago(ts) {
    var d = ts - Math.floor(Date.now() / 1000), a = Math.abs(d), r = new Intl.RelativeTimeFormat(FR() ? "fr" : "en", { numeric: "auto" });
    return a < 3600 ? r.format(Math.round(d / 60), "minute") : a < 86400 ? r.format(Math.round(d / 3600), "hour") : r.format(Math.round(d / 86400), "day");
  }
  function fill(sel, opts, val) {
    sel.textContent = "";
    opts.forEach(function (o) { var n = el("option", "", o[1]); n.value = o[0]; sel.append(n); });
    sel.value = val;
  }
  function filters() {
    fill(f.category, [["", tr("all")]].concat(meta.categories.map(function (c) { return [c.id, FR() ? c.fr : c.en]; })), s.category);
    fill(f.language, [["", tr("langs")]].concat(meta.languages.map(function (c) { return [c.id, FR() ? c.fr : c.en]; })), s.language);
    fill(f.sort, [["bump", tr("sbump")], ["members", tr("smem")], ["new", tr("snew")]], s.sort);
    fill(f.nsfw, [["hide", tr("nhide")], ["show", tr("nshow")], ["only", tr("nonly")]], s.nsfw);
    more.textContent = tr("more");
    tagChip();
  }
  function tagChip() {
    tagBox.textContent = "";
    if (!s.tag) return;
    var c = el("span", "badge", tr("tag") + ": " + s.tag + " "), x = el("button", "srv-x", "×");
    x.type = "button"; x.title = tr("clear"); x.setAttribute("aria-label", tr("clear"));
    x.addEventListener("click", function () { s.tag = ""; tagChip(); load(true); });
    c.append(x); tagBox.append(c);
  }
  function card(v) {
    var li = el("li", "bot-card srv-card"), ban = el("div", "srv-banner"), b = cdn(v.banner);
    if (b) ban.style.backgroundImage = "url('" + encodeURI(b) + "')";
    var head = el("div", "bot-head"), id = el("div", "bot-id"), tags = el("div", "bot-tags"), ic = cdn(v.icon), av;
    if (ic) { av = el("img", "bot-av"); av.src = ic; av.alt = ""; av.width = av.height = 56; av.loading = "lazy"; av.referrerPolicy = "no-referrer"; }
    else { av = el("span", "bot-av bot-ph", (v.name || "?").charAt(0).toUpperCase()); av.style.background = "#5865f2"; av.setAttribute("aria-hidden", "true"); }
    tags.append(el("span", "badge", lab(meta.categories, v.category)), el("span", "badge", lab(meta.languages, v.language)));
    if (v.nsfw) tags.append(el("span", "badge srv-nsfw", "NSFW"));
    id.append(el("span", "bot-name", v.name), el("span", "mg-hint", Number(v.members || 0).toLocaleString(FR() ? "fr-FR" : "en-US") + " " + tr("members") + " · " + tr("bumped") + " " + ago(v.bumped_at)), tags);
    head.append(av, id);
    li.append(ban, head, el("p", "bot-desc", v.description || ""));
    if (v.tags && v.tags.length) {
      var row = el("div", "bot-tags");
      v.tags.forEach(function (t) {
        var b2 = el("button", "srv-tagbtn", "#" + t); b2.type = "button";
        b2.addEventListener("click", function () { s.tag = t; tagChip(); load(true); window.scrollTo({ top: 0, behavior: "smooth" }); });
        row.append(b2);
      });
      li.append(row);
    }
    var inv = invite(v.invite);
    if (inv) { var a = el("a", "btn btn-sm btn-primary", tr("join")); a.href = inv; a.target = "_blank"; a.rel = "noopener noreferrer"; var act = el("div", "bot-actions"); act.append(a); li.append(act); }
    return li;
  }
  function problem() {
    if (!API) return "off";
    if (location.protocol === "https:" && API.indexOf("https://") !== 0) return "mixed";
    return "";
  }
  function note(k) { msg.hidden = !k; msg.textContent = k ? tr(k) : ""; }
  function sync() {
    var p = new URLSearchParams(location.search);
    ["q", "category", "language", "tag"].forEach(function (k) { if (s[k]) p.set(k, s[k]); else p.delete(k); });
    if (s.sort !== "bump") p.set("sort", s.sort); else p.delete("sort");
    if (s.nsfw !== "hide") p.set("nsfw", s.nsfw); else p.delete("nsfw");
    var q = p.toString(); history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
  }
  function load(reset) {
    var pb = problem();
    if (pb) { grid.textContent = ""; count.textContent = ""; more.hidden = true; note(pb); return; }
    if (reset) s.page = 1;
    if (ctl) ctl.abort();
    ctl = window.AbortController ? new AbortController() : null;
    note(""); more.hidden = true;
    var qs = new URLSearchParams({ q: s.q, category: s.category, language: s.language, sort: s.sort, nsfw: s.nsfw, tag: s.tag, page: s.page, per_page: PER });
    fetch(API + "/api/servers?" + qs, ctl ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      if (reset) { grid.textContent = ""; shown = []; }
      d.items.forEach(function (v) { shown.push(v); grid.append(card(v)); });
      count.textContent = d.total + (FR() ? (d.total > 1 ? " serveurs" : " serveur") : (d.total === 1 ? " server" : " servers"));
      if (!d.total) note("none");
      more.hidden = d.page >= d.pages; s.page = d.page; sync();
    }).catch(function (e) { if (e && e.name === "AbortError") return; grid.textContent = ""; more.hidden = true; note("err"); });
  }
  function askAdult() {
    return new Promise(function (ok) {
      if (!dlg || !dlg.showModal) return ok(window.confirm(FR() ? "Contenu adulte. Continuer seulement si tu as 18 ans ou plus." : "Adult content. Continue only if you are 18 or older."));
      var yes = document.getElementById("srv-age-yes"), no = document.getElementById("srv-age-no");
      function done(v) { dlg.close(); ok(v); }
      yes.onclick = function () { done(true); }; no.onclick = function () { done(false); }; dlg.showModal();
    });
  }
  function setNsfw(v) {
    var go = v === "hide" || adult ? Promise.resolve(true) : askAdult();
    go.then(function (ok) {
      if (ok && v !== "hide") { adult = true; try { localStorage.setItem("sentinel.adult18", "1"); } catch (e) {} }
      s.nsfw = ok ? v : "hide"; f.nsfw.value = s.nsfw; load(true);
    });
  }
  var deb;
  f.q.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(function () { s.q = f.q.value.trim(); load(true); }, 300); });
  f.category.addEventListener("change", function () { s.category = f.category.value; load(true); });
  f.language.addEventListener("change", function () { s.language = f.language.value; load(true); });
  f.sort.addEventListener("change", function () { s.sort = f.sort.value; load(true); });
  f.nsfw.addEventListener("change", function () { setNsfw(f.nsfw.value); });
  more.addEventListener("click", function () { s.page += 1; load(false); });
  new MutationObserver(function () { filters(); grid.textContent = ""; shown.forEach(function (v) { grid.append(card(v)); }); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  var p = new URLSearchParams(location.search);
  s.q = (p.get("q") || "").slice(0, 80); s.category = p.get("category") || ""; s.language = p.get("language") || ""; s.tag = (p.get("tag") || "").slice(0, 20);
  s.sort = ["bump", "members", "new"].indexOf(p.get("sort")) >= 0 ? p.get("sort") : "bump";
  s.nsfw = adult && ["show", "only"].indexOf(p.get("nsfw")) >= 0 ? p.get("nsfw") : "hide";
  f.q.value = s.q;
  filters();
  if (problem()) { note(problem()); return; }
  fetch(API + "/api/meta").then(function (r) { return r.json(); }).then(function (m) { meta = m; filters(); }).catch(function () {}).then(function () { load(true); });
})();
