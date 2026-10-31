(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var grid = $("srv-list"), feat = $("srv-featured"), featWrap = $("srv-featured-wrap"), count = $("srv-count"), msg = $("srv-msg"),
    more = $("srv-more"), qInput = $("srv-q"), activeBox = $("srv-active"), tagsRow = $("srv-toptags"), statsBox = $("srv-stats"),
    nsfwSeg = $("srv-nsfw"), btnVer = $("srv-verified"), btnRat = $("srv-rating"), ageDlg = $("srv-age"), detDlg = $("srv-detail"), detBody = $("srv-detail-body");
  if (!grid || !qInput) return;

  var CFG = window.SENTINEL_CONFIG || {};
  var API = String(CFG.serversApiUrl || "").replace(/\/+$/, "");
  var PER = 12;
  var FR = function () { return document.documentElement.lang === "fr"; };
  var T = {
    servers1: ["server", "serveur"], serversN: ["servers", "serveurs"], members: ["members", "membres"], reviews1: ["review", "avis"], reviewsN: ["reviews", "avis"],
    cat: ["Category", "Catégorie"], lang: ["Language", "Langue"], sort: ["Sort by", "Trier par"],
    allCats: ["All categories", "Toutes les catégories"], allLangs: ["All languages", "Toutes les langues"],
    sbump: ["Recently bumped", "Bump récent"], srat: ["Top rated", "Mieux notés"], smem: ["Most members", "Plus de membres"], snew: ["Newest", "Plus récents"],
    nHide: ["No NSFW", "Sans NSFW"], nShow: ["With NSFW", "Avec NSFW"], nOnly: ["NSFW only", "NSFW seul"],
    ver: ["Verified only", "Vérifiés"], rat: ["4★ and up", "4★ et plus"], pop: ["Popular tags", "Tags populaires"],
    featured: ["Featured", "À la une"], verifiedT: ["Verified server", "Serveur vérifié"], tag: ["Tag", "Tag"], clear: ["Clear", "Retirer"], clearAll: ["Clear all", "Tout effacer"],
    join: ["Join", "Rejoindre"], details: ["Details", "Détails"], bumped: ["Bumped", "Bump"], more: ["Load more", "Voir plus"], search: ["Search…", "Rechercher…"],
    none: ["No server matches your filters.", "Aucun serveur ne correspond à tes filtres."], noneHint: ["Try removing a filter or searching for something else.", "Essaie de retirer un filtre ou de chercher autre chose."],
    err: ["Could not load the directory.", "Impossible de charger l'annuaire."], retry: ["Retry", "Réessayer"],
    off: ["The server directory is not available yet.", "L'annuaire de serveurs n'est pas encore disponible."],
    mixed: ["The directory API must use HTTPS.", "L'API de l'annuaire doit utiliser HTTPS."],
    noRating: ["No ratings yet", "Pas encore de note"], outOf: ["out of 5", "sur 5"], revH: ["Reviews", "Avis"], noRev: ["No reviews yet. Members can be the first!", "Pas encore d'avis. Les membres peuvent être les premiers !"],
    howRev: ["Members can rate this server with", "Les membres peuvent noter ce serveur avec"], howRep: ["Something wrong? Use", "Un problème ? Utilise"],
    close: ["Close", "Fermer"], loading: ["Loading…", "Chargement…"], noDesc: ["No description.", "Aucune description."]
  };
  function tr(k) { return T[k][FR() ? 1 : 0]; }

  var meta = { categories: [], languages: [], tags: [], total: 0, members: 0, reviews: 0 };
  var S = { q: "", category: "", language: "", sort: "bump", nsfw: "hide", tag: "", verified: false, rating: false, page: 1 };
  var adult = false, ctl = null, shown = [], featList = [], featIds = {}, lastFailed = false, openId = "";
  try { adult = localStorage.getItem("sentinel.adult18") === "1"; } catch (e) {}

  /* ---------- helpers ---------- */
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function cdn(u) { return typeof u === "string" && u.indexOf("https://cdn.discordapp.com/") === 0 ? u : ""; }
  function invite(u) { return typeof u === "string" && u.indexOf("https://discord.gg/") === 0 ? u : ""; }
  function lab(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return FR() ? list[i].fr : list[i].en; return id; }
  function num(n) { return Number(n || 0).toLocaleString(FR() ? "fr-FR" : "en-US"); }
  function plural(n, one, many) { return num(n) + " " + (n === 1 ? tr(one) : tr(many)); }
  function ago(ts) {
    var d = ts - Math.floor(Date.now() / 1000), a = Math.abs(d), r = new Intl.RelativeTimeFormat(FR() ? "fr" : "en", { numeric: "auto" });
    return a < 3600 ? r.format(Math.round(d / 60), "minute") : a < 86400 ? r.format(Math.round(d / 3600), "hour") : r.format(Math.round(d / 86400), "day");
  }
  function stars(avg) {
    var s = el("span", "srv-stars", "★★★★★");
    s.style.setProperty("--p", Math.max(0, Math.min(100, (avg || 0) / 5 * 100)) + "%");
    s.setAttribute("role", "img"); s.setAttribute("aria-label", avg ? avg.toFixed(1) + " " + tr("outOf") : tr("noRating"));
    return s;
  }
  function check() {
    var NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg"), p = document.createElementNS(NS, "path");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "16"); s.setAttribute("height", "16"); s.setAttribute("class", "srv-check");
    s.setAttribute("role", "img"); s.setAttribute("aria-label", tr("verifiedT"));
    p.setAttribute("d", "M12 2l2.4 1.9 3-.2 1 2.8 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-1 2.8-3-.2L12 22l-2.4-1.9-3 .2-1-2.8-2.5-1.7.9-2.9-.9-2.9 2.5-1.7 1-2.8 3 .2z");
    p.setAttribute("fill", "currentColor");
    var c = document.createElementNS(NS, "path"); c.setAttribute("d", "m8.5 12.2 2.4 2.4 4.7-4.9"); c.setAttribute("fill", "none"); c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", "2"); c.setAttribute("stroke-linecap", "round"); c.setAttribute("stroke-linejoin", "round");
    s.append(p, c); return s;
  }
  function avatar(v, size) {
    var ic = cdn(v.icon), a;
    if (ic) { a = el("img", "bot-av"); a.src = ic; a.alt = ""; a.width = a.height = size; a.loading = "lazy"; a.referrerPolicy = "no-referrer"; }
    else { a = el("span", "bot-av bot-ph", (v.name || "?").charAt(0).toUpperCase()); a.style.background = "#5865f2"; a.setAttribute("aria-hidden", "true"); }
    return a;
  }
  function filtersActive() { return !!(S.q || S.category || S.language || S.tag || S.verified || S.rating || S.nsfw !== "hide"); }

  /* ---------- custom dropdown ---------- */
  function Dropdown(root, cfg) {
    var btn = el("button", "srv-dd-btn"), cap = el("span", "srv-dd-cap"), val = el("span", "srv-dd-val"), chev = el("span", "srv-dd-chev");
    btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false"); chev.setAttribute("aria-hidden", "true");
    btn.append(cap, val, chev);
    var pop = el("div", "srv-dd-pop"), search = null, list = el("ul", "srv-dd-list");
    pop.hidden = true; list.setAttribute("role", "listbox");
    if (cfg.searchable) { search = el("input", "srv-dd-search"); search.type = "search"; search.autocomplete = "off"; pop.append(search); }
    pop.append(list); root.append(btn, pop);
    var opts = [], value = "", act = -1, vis = [];
    function render() {
      list.textContent = ""; vis = [];
      if (search) search.placeholder = tr("search");
      var term = search ? search.value.trim().toLowerCase() : "";
      opts.forEach(function (o, i) {
        if (term && o[1].toLowerCase().indexOf(term) < 0) return;
        var li = el("li", "srv-dd-opt" + (o[0] === value ? " sel" : ""), o[1]);
        li.setAttribute("role", "option"); li.setAttribute("aria-selected", String(o[0] === value));
        li.addEventListener("click", function () { choose(i); });
        li.addEventListener("mousemove", function () { setAct(vis.indexOf(i)); });
        list.append(li); vis.push(i);
      });
      if (!vis.length) list.append(el("li", "srv-dd-empty", "—"));
      var cur = vis.indexOf(opts.findIndex(function (o) { return o[0] === value; }));
      setAct(cur >= 0 ? cur : 0, true);
    }
    function setAct(i, scroll) {
      act = i; var items = list.querySelectorAll(".srv-dd-opt");
      items.forEach(function (n, k) { n.classList.toggle("act", k === i); });
      if (scroll && items[i] && items[i].scrollIntoView) items[i].scrollIntoView({ block: "nearest" });
    }
    function paint() {
      cap.textContent = cfg.caption(); var o = opts.filter(function (x) { return x[0] === value; })[0];
      val.textContent = o ? o[1] : ""; root.classList.toggle("on", !!value && value !== cfg.neutral);
    }
    function open() {
      if (!pop.hidden) return;
      pop.hidden = false; root.classList.add("open"); btn.setAttribute("aria-expanded", "true");
      if (search) { search.value = ""; render(); setTimeout(function () { search.focus(); }, 0); } else render();
    }
    function close(focus) {
      if (pop.hidden) return;
      pop.hidden = true; root.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
      if (focus) btn.focus();
    }
    function choose(i) { value = opts[i][0]; paint(); close(true); cfg.onChange(value); }
    btn.addEventListener("click", function () { pop.hidden ? open() : close(); });
    if (search) search.addEventListener("input", render);
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(true); return; }
      if (pop.hidden) { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setAct(Math.min(vis.length - 1, act + 1), true); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setAct(Math.max(0, act - 1), true); }
      else if (e.key === "Home") { e.preventDefault(); setAct(0, true); }
      else if (e.key === "End") { e.preventDefault(); setAct(vis.length - 1, true); }
      else if (e.key === "Enter" && vis[act] != null && e.target !== btn) { e.preventDefault(); choose(vis[act]); }
    });
    root.addEventListener("pointerdown", function (e) { if (e.target === root) close(); });
    document.addEventListener("pointerdown", function (e) { if (!root.contains(e.target)) close(); });
    return {
      setOptions: function (o) { opts = o; paint(); if (!pop.hidden) render(); },
      setValue: function (v) { value = v; paint(); },
      repaint: paint
    };
  }

  var ddCat = Dropdown($("dd-category"), { searchable: true, neutral: "", caption: function () { return tr("cat"); }, onChange: function (v) { S.category = v; paintActive(); load(true); } });
  var ddLang = Dropdown($("dd-language"), { searchable: true, neutral: "", caption: function () { return tr("lang"); }, onChange: function (v) { S.language = v; paintActive(); load(true); } });
  var ddSort = Dropdown($("dd-sort"), { searchable: false, neutral: "bump", caption: function () { return tr("sort"); }, onChange: function (v) { S.sort = v; load(true); } });

  function paintFilters() {
    ddCat.setOptions([["", tr("allCats")]].concat(meta.categories.map(function (c) { return [c.id, FR() ? c.fr : c.en]; }))); ddCat.setValue(S.category);
    ddLang.setOptions([["", tr("allLangs")]].concat(meta.languages.map(function (c) { return [c.id, FR() ? c.fr : c.en]; }))); ddLang.setValue(S.language);
    ddSort.setOptions([["bump", tr("sbump")], ["rating", tr("srat")], ["members", tr("smem")], ["new", tr("snew")]]); ddSort.setValue(S.sort);
    nsfwSeg.textContent = "";
    [["hide", "nHide"], ["show", "nShow"], ["only", "nOnly"]].forEach(function (o) {
      var b = el("button", "srv-seg-b" + (S.nsfw === o[0] ? " on" : ""), tr(o[1]));
      b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(S.nsfw === o[0]));
      b.addEventListener("click", function () { setNsfw(o[0]); });
      nsfwSeg.append(b);
    });
    btnVer.textContent = tr("ver"); btnVer.classList.toggle("on", S.verified); btnVer.setAttribute("aria-pressed", String(S.verified));
    btnRat.textContent = tr("rat"); btnRat.classList.toggle("on", S.rating); btnRat.setAttribute("aria-pressed", String(S.rating));
    qInput.placeholder = tr("search");
    more.textContent = tr("more");
    paintTags(); paintActive(); paintStats();
  }
  function paintStats() {
    statsBox.textContent = "";
    if (!meta.total) { statsBox.hidden = true; return; }
    statsBox.hidden = false;
    [[meta.total, meta.total === 1 ? "servers1" : "serversN"], [meta.members, "members"], [meta.reviews, meta.reviews === 1 ? "reviews1" : "reviewsN"]].forEach(function (s) {
      var li = el("li"); li.append(el("b", "", num(s[0])), document.createTextNode(" " + tr(s[1]))); statsBox.append(li);
    });
  }
  function paintTags() {
    tagsRow.textContent = "";
    if (!meta.tags || !meta.tags.length) return;
    tagsRow.append(el("span", "srv-tagsrow-l", tr("pop")));
    meta.tags.slice(0, 12).forEach(function (t) {
      var b = el("button", "srv-pill" + (S.tag === t.tag ? " on" : ""), "#" + t.tag); b.type = "button";
      b.addEventListener("click", function () { S.tag = S.tag === t.tag ? "" : t.tag; paintTags(); paintActive(); load(true); });
      tagsRow.append(b);
    });
  }
  function paintActive() {
    activeBox.textContent = "";
    var chips = [];
    if (S.category) chips.push([lab(meta.categories, S.category), function () { S.category = ""; ddCat.setValue(""); }]);
    if (S.language) chips.push([lab(meta.languages, S.language), function () { S.language = ""; ddLang.setValue(""); }]);
    if (S.tag) chips.push(["#" + S.tag, function () { S.tag = ""; paintTags(); }]);
    if (S.verified) chips.push([tr("ver"), function () { S.verified = false; paintFilters(); }]);
    if (S.rating) chips.push([tr("rat"), function () { S.rating = false; paintFilters(); }]);
    if (S.nsfw !== "hide") chips.push([S.nsfw === "only" ? tr("nOnly") : tr("nShow"), function () { S.nsfw = "hide"; paintFilters(); }]);
    if (!chips.length) return;
    chips.forEach(function (c) {
      var chip = el("span", "srv-chip", c[0] + " "), x = el("button", "srv-x", "×");
      x.type = "button"; x.title = tr("clear"); x.setAttribute("aria-label", tr("clear") + " " + c[0]);
      x.addEventListener("click", function () { c[1](); paintActive(); load(true); });
      chip.append(x); activeBox.append(chip);
    });
    var all = el("button", "srv-clear", tr("clearAll")); all.type = "button";
    all.addEventListener("click", resetFilters); activeBox.append(all);
  }
  function resetFilters() {
    S.q = ""; qInput.value = ""; S.category = ""; S.language = ""; S.tag = ""; S.verified = false; S.rating = false; S.nsfw = "hide";
    paintFilters(); load(true);
  }

  /* ---------- cards ---------- */
  function card(v, big) {
    var li = el("li", "bot-card srv-card" + (v.featured ? " srv-feat" : "")), ban = el("div", "srv-banner"), b = cdn(v.banner);
    if (b) ban.style.backgroundImage = "url('" + encodeURI(b) + "')";
    var head = el("div", "bot-head"), id = el("div", "bot-id"), nm = el("div", "srv-namerow");
    var name = el("button", "bot-name srv-name", v.name); name.type = "button";
    name.addEventListener("click", function () { openDetail(v.id); });
    nm.append(name); if (v.verified) nm.append(check());
    var sub = el("div", "srv-sub"); sub.append(stars(v.rating));
    sub.append(el("span", "mg-hint", (v.reviews ? "(" + num(v.reviews) + ")" : tr("noRating")) + " · " + num(v.members) + " " + tr("members")));
    id.append(nm, sub); head.append(avatar(v, 56), id);
    var tags = el("div", "bot-tags");
    tags.append(el("span", "badge", lab(meta.categories, v.category)), el("span", "badge", lab(meta.languages, v.language)));
    if (v.nsfw) tags.append(el("span", "badge srv-nsfw", "NSFW"));
    li.append(ban, head, tags, el("p", "bot-desc srv-desc", v.description || ""));
    if (v.tags && v.tags.length) {
      var row = el("div", "bot-tags");
      v.tags.forEach(function (t) {
        var b2 = el("button", "srv-tagbtn", "#" + t); b2.type = "button";
        b2.addEventListener("click", function () { S.tag = t; paintTags(); paintActive(); load(true); window.scrollTo({ top: 0, behavior: "smooth" }); });
        row.append(b2);
      });
      li.append(row);
    }
    var act = el("div", "bot-actions srv-actions"), inv = invite(v.invite);
    if (inv) { var a = el("a", "btn btn-sm btn-primary", tr("join")); a.href = inv; a.target = "_blank"; a.rel = "noopener noreferrer"; act.append(a); }
    var d = el("button", "btn btn-sm", tr("details")); d.type = "button"; d.addEventListener("click", function () { openDetail(v.id); }); act.append(d);
    li.append(el("div", "srv-foot mg-hint", tr("bumped") + " " + ago(v.bumped_at)), act);
    return li;
  }
  function skeletons(box, n) { box.textContent = ""; for (var i = 0; i < n; i++) box.append(el("li", "srv-skel")); }
  function paintList() {
    grid.textContent = "";
    shown.forEach(function (v) { if (!featIds[v.id]) grid.append(card(v)); });
    feat.textContent = ""; featList.forEach(function (v) { feat.append(card(v)); });
    featWrap.hidden = !featList.length; $("srv-featured-h").textContent = tr("featured");
  }

  /* ---------- state messages ---------- */
  function note(kind, retry) {
    msg.textContent = ""; msg.hidden = !kind; if (!kind) return;
    if (kind === "none") {
      msg.append(el("p", "srv-state-t", tr("none")), el("p", "mg-hint", tr("noneHint")));
      if (filtersActive()) { var c = el("button", "btn btn-sm", tr("clearAll")); c.type = "button"; c.addEventListener("click", resetFilters); msg.append(c); }
    } else {
      msg.append(el("p", "srv-state-t", tr(kind)));
      if (retry) { var r = el("button", "btn btn-sm", tr("retry")); r.type = "button"; r.addEventListener("click", function () { load(true); }); msg.append(r); }
    }
  }
  function problem() {
    if (!API) return "off";
    if (location.protocol === "https:" && API.indexOf("https://") !== 0) return "mixed";
    return "";
  }
  function sync() {
    var p = new URLSearchParams(location.search);
    ["q", "category", "language", "tag"].forEach(function (k) { if (S[k]) p.set(k, S[k]); else p.delete(k); });
    if (S.sort !== "bump") p.set("sort", S.sort); else p.delete("sort");
    if (S.nsfw !== "hide") p.set("nsfw", S.nsfw); else p.delete("nsfw");
    if (S.verified) p.set("verified", "1"); else p.delete("verified");
    if (S.rating) p.set("rating", "1"); else p.delete("rating");
    if (openId) p.set("server", openId); else p.delete("server");
    var q = p.toString(); try { history.replaceState(null, "", location.pathname + (q ? "?" + q : "")); } catch (e) {}
  }
  function get(path) {
    return fetch(API + path, ctl && ctl.signal ? { signal: ctl.signal } : {}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function query(extra) {
    var o = { q: S.q, category: S.category, language: S.language, sort: S.sort, nsfw: S.nsfw, tag: S.tag, page: S.page, per_page: PER };
    if (S.verified) o.verified = "1"; if (S.rating) o.min_rating = "4";
    for (var k in extra) o[k] = extra[k];
    return new URLSearchParams(o).toString();
  }

  /* ---------- loading ---------- */
  function load(reset) {
    var pb = problem();
    if (pb) { grid.textContent = ""; feat.textContent = ""; featWrap.hidden = true; count.textContent = ""; more.hidden = true; note(pb); return; }
    if (reset) S.page = 1;
    if (ctl) ctl.abort();
    ctl = window.AbortController ? new AbortController() : null;
    note(""); more.hidden = true;
    if (reset) { skeletons(grid, 6); }
    var wantFeat = reset && !filtersActive() && S.sort === "bump";
    var pFeat = wantFeat ? get("/api/servers?featured=1&per_page=3&nsfw=hide").catch(function () { return { items: [] }; }) : Promise.resolve(null);
    Promise.all([pFeat, get("/api/servers?" + query({}))]).then(function (res) {
      var fr = res[0], d = res[1];
      if (reset) { shown = []; if (fr) { featList = fr.items; featIds = {}; featList.forEach(function (v) { featIds[v.id] = 1; }); } else { featList = []; featIds = {}; } }
      d.items.forEach(function (v) { shown.push(v); });
      paintList();
      count.textContent = plural(d.total, "servers1", "serversN");
      if (!d.total) note("none");
      more.hidden = d.page >= d.pages; S.page = d.page; lastFailed = false; sync();
    }).catch(function (e) {
      if (e && e.name === "AbortError") return;
      grid.textContent = ""; feat.textContent = ""; featWrap.hidden = true; more.hidden = true; lastFailed = true; note("err", true);
    });
  }

  /* ---------- detail modal ---------- */
  function closeDetail() { if (detDlg.open) detDlg.close(); }
  function openDetail(id) {
    if (problem()) return;
    openId = id; sync();
    detBody.textContent = ""; detBody.append(el("p", "srv-state", tr("loading")));
    if (detDlg.showModal) { if (!detDlg.open) detDlg.showModal(); } else detDlg.setAttribute("open", "");
    fetch(API + "/api/servers/" + encodeURIComponent(id)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(paintDetail)
      .catch(function () { detBody.textContent = ""; detBody.append(el("p", "srv-state", tr("err"))); });
  }
  function paintDetail(v) {
    detBody.textContent = "";
    var ban = el("div", "srv-dban"), b = cdn(v.banner); if (b) ban.style.backgroundImage = "url('" + encodeURI(b) + "')";
    var head = el("div", "srv-dhead"), info = el("div", "srv-dinfo"), nm = el("h2", "srv-dname", v.name);
    if (v.verified) nm.append(check());
    var badges = el("div", "bot-tags");
    badges.append(el("span", "badge", lab(meta.categories, v.category)), el("span", "badge", lab(meta.languages, v.language)));
    if (v.nsfw) badges.append(el("span", "badge srv-nsfw", "NSFW"));
    if (v.featured) badges.append(el("span", "badge", "★ " + tr("featured")));
    info.append(nm, el("p", "mg-hint", num(v.members) + " " + tr("members") + " · " + tr("bumped") + " " + ago(v.bumped_at)), badges);
    head.append(avatar(v, 72), info);
    var inv = invite(v.invite);
    if (inv) { var a = el("a", "btn btn-primary srv-djoin", tr("join")); a.href = inv; a.target = "_blank"; a.rel = "noopener noreferrer"; head.append(a); }
    detBody.append(ban, head, el("p", "srv-ddesc", v.description || tr("noDesc")));
    if (v.tags && v.tags.length) {
      var tg = el("div", "bot-tags");
      v.tags.forEach(function (t) {
        var x = el("button", "srv-pill", "#" + t); x.type = "button";
        x.addEventListener("click", function () { closeDetail(); S.tag = t; paintTags(); paintActive(); load(true); window.scrollTo({ top: 0, behavior: "smooth" }); });
        tg.append(x);
      });
      detBody.append(tg);
    }
    var sum = el("div", "srv-rsum"), big = el("div", "srv-rbig");
    big.append(el("div", "srv-rnum", v.rating ? v.rating.toFixed(1) : "–"), stars(v.rating), el("div", "mg-hint", v.reviews ? plural(v.reviews, "reviews1", "reviewsN") : tr("noRating")));
    var bars = el("div", "srv-rbars"), total = v.reviews || 0;
    for (var s = 5; s >= 1; s--) {
      var n = (v.distribution && v.distribution[String(s)]) || 0, row = el("div", "srv-rrow"), track = el("span", "srv-rtrack"), fill = el("span", "srv-rfill");
      fill.style.width = (total ? n / total * 100 : 0) + "%"; track.append(fill);
      row.append(el("span", "srv-rlab", s + "★"), track, el("span", "srv-rcnt", String(n))); bars.append(row);
    }
    sum.append(big, bars); detBody.append(sum);
    detBody.append(el("h3", "srv-h", tr("revH")));
    var list = el("ul", "srv-revs");
    if (!v.review_list || !v.review_list.length) list.append(el("li", "mg-hint", tr("noRev")));
    else v.review_list.forEach(function (r) {
      var li = el("li", "srv-rev"), top = el("div", "srv-rtop");
      top.append(el("b", "", r.name), stars(r.rating), el("span", "mg-hint", ago(r.at)));
      li.append(top); if (r.text) li.append(el("p", "srv-rtext", r.text)); list.append(li);
    });
    detBody.append(list);
    var how = el("p", "mg-hint srv-how");
    how.append(document.createTextNode(tr("howRev") + " "), el("code", "", "/servers review"), document.createTextNode(". " + tr("howRep") + " "), el("code", "", "/servers report"), document.createTextNode("."));
    detBody.append(how);
  }
  $("srv-detail-x").addEventListener("click", closeDetail);
  detDlg.addEventListener("click", function (e) { if (e.target === detDlg) closeDetail(); });
  detDlg.addEventListener("close", function () { openId = ""; sync(); });

  /* ---------- NSFW gate ---------- */
  function askAdult() {
    return new Promise(function (ok) {
      if (!ageDlg || !ageDlg.showModal) return ok(window.confirm(FR() ? "Contenu adulte. Continue seulement si tu as 18 ans ou plus." : "Adult content. Continue only if you are 18 or older."));
      var yes = $("srv-age-yes"), no = $("srv-age-no");
      function done(v) { ageDlg.close(); ok(v); }
      yes.onclick = function () { done(true); }; no.onclick = function () { done(false); }; ageDlg.showModal();
    });
  }
  function setNsfw(v) {
    var go = v === "hide" || adult ? Promise.resolve(true) : askAdult();
    go.then(function (ok) {
      if (ok && v !== "hide") { adult = true; try { localStorage.setItem("sentinel.adult18", "1"); } catch (e) {} }
      S.nsfw = ok ? v : "hide"; paintFilters(); load(true);
    });
  }

  /* ---------- wiring ---------- */
  var deb;
  qInput.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(function () { S.q = qInput.value.trim(); paintActive(); load(true); }, 300); });
  btnVer.addEventListener("click", function () { S.verified = !S.verified; paintFilters(); load(true); });
  btnRat.addEventListener("click", function () { S.rating = !S.rating; paintFilters(); load(true); });
  more.addEventListener("click", function () { S.page += 1; load(false); });
  new MutationObserver(function () { paintFilters(); paintList(); if (!msg.hidden && lastFailed) note("err", true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  var p = new URLSearchParams(location.search);
  S.q = (p.get("q") || "").slice(0, 80); S.category = p.get("category") || ""; S.language = p.get("language") || ""; S.tag = (p.get("tag") || "").slice(0, 20);
  S.sort = ["bump", "rating", "members", "new"].indexOf(p.get("sort")) >= 0 ? p.get("sort") : "bump";
  S.nsfw = adult && ["show", "only"].indexOf(p.get("nsfw")) >= 0 ? p.get("nsfw") : "hide";
  S.verified = p.get("verified") === "1"; S.rating = p.get("rating") === "1";
  qInput.value = S.q;
  paintFilters();
  if (problem()) { note(problem()); return; }
  skeletons(grid, 6);
  fetch(API + "/api/meta").then(function (r) { return r.json(); }).then(function (m) { meta = m; }).catch(function () {}).then(function () {
    paintFilters(); load(true);
    var sid = (p.get("server") || "").replace(/\D/g, ""); if (sid) openDetail(sid);
  });
})();
