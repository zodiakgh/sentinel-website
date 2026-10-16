/* Sentinel command directory: renders window.SENTINEL_COMMANDS with search + category filters. */
(function () {
  "use strict";
  var DATA = window.SENTINEL_COMMANDS;
  var root = document.getElementById("cmd-root");
  if (!root) return;
  var S = window.Sentinel;
  var t = function (k, f) { return S ? S.t(k, f) : (f || k); };

  var CAT_EN = {
    moderation: "Moderation & Security", tickets: "Tickets & Support", community: "Community & Engagement",
    economy: "Economy", music: "Music", tempvoice: "TempVoice", automation: "Automation & Server tools",
    fun: "Fun & Games", utility: "Utilities & Lookup"
  };

  var state = { q: "", cat: "all" };
  var searchEl = document.getElementById("cmd-search");
  var clearEl = document.getElementById("cmd-clear");
  var chipsEl = document.getElementById("cmd-chips");
  var metaEl = document.getElementById("cmd-meta");
  var emptyEl = document.getElementById("cmd-empty");
  var loadingEl = document.getElementById("cmd-loading");
  var errorEl = document.getElementById("cmd-error");
  var expandBtn = document.getElementById("cmd-expand");
  var backTop = document.getElementById("cmd-back");
  var expandedAll = false;
  var openSet = {};

  if (!DATA || !DATA.commands || !DATA.commands.length) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    return;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function catLabel(id) { return t("cat." + id, CAT_EN[id] || id); }
  function descOf(c) { return (S && S.lang() === "fr" && c.f) ? c.f : c.d; }
  function syntax(c) {
    var s = "/" + c.p.join(" ");
    var args = (c.a || []).map(function (a) { return a[1] ? "<" + a[0] + ">" : "[" + a[0] + "]"; });
    return { base: s, args: args };
  }
  function hay(c) {
    var sx = syntax(c);
    return (sx.base + " " + sx.args.join(" ") + " " + c.d + " " + (c.f || "") + " " + (c.r || []).join(" ") + " " + catLabel(c.c)).toLowerCase();
  }
  DATA.commands.forEach(function (c) { c._h = hay(c); });

  function tokens() { return state.q.toLowerCase().replace(/^\//, "").split(/\s+/).filter(Boolean); }
  function match(c, toks) {
    if (state.cat !== "all" && c.c !== state.cat) return false;
    for (var i = 0; i < toks.length; i++) if (c._h.indexOf(toks[i].replace(/^\//, "")) < 0) return false;
    return true;
  }
  function hl(text, toks) {
    var out = esc(text);
    toks.forEach(function (tk) {
      if (!tk) return;
      var re = new RegExp("(" + tk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(/(<[^>]+>)|([^<]+)/g, function (m, tag, txt) { return tag ? tag : txt.replace(re, "<mark>$1</mark>"); });
    });
    return out;
  }

  function renderChips(counts) {
    var html = '<button type="button" class="chip" data-cat="all" aria-pressed="' + (state.cat === "all") + '">' +
      esc(t("cmd.all", "All")) + "<i>" + counts.all + "</i></button>";
    DATA.categories.forEach(function (id) {
      html += '<button type="button" class="chip" data-cat="' + id + '" aria-pressed="' + (state.cat === id) + '">' +
        esc(catLabel(id)) + "<i>" + (counts[id] || 0) + "</i></button>";
    });
    chipsEl.innerHTML = html;
  }

  function render() {
    var toks = tokens();
    var searching = toks.length > 0;
    var counts = { all: 0 };
    DATA.categories.forEach(function (c) { counts[c] = 0; });
    var byGroup = {};
    var total = 0, shown = 0;
    DATA.commands.forEach(function (c) {
      total++;
      // counts per category ignore the category filter but respect the search
      var saveCat = state.cat; state.cat = "all";
      var inSearch = match(c, toks);
      state.cat = saveCat;
      if (inSearch) { counts.all++; counts[c.c]++; }
      if (match(c, toks)) { shown++; (byGroup[c.p[0]] = byGroup[c.p[0]] || []).push(c); }
    });
    renderChips(counts);

    var html = "";
    var groupCount = 0;
    DATA.groups.forEach(function (g) {
      var list = byGroup[g.name];
      if (!list || !list.length) return;
      groupCount++;
      var open = searching || expandedAll || openSet[g.name];
      var gdesc = (S && S.lang() === "fr" && g.f) ? g.f : g.d;
      html += '<details class="cmd-group" id="g-' + esc(g.name) + '" data-g="' + esc(g.name) + '"' + (open ? " open" : "") + ">" +
        '<summary><span class="g-name">/' + hl(g.name, toks) + '</span><span class="g-desc">' + hl(gdesc || "", toks) + "</span>" +
        '<span class="g-count">' + list.length + (list.length !== g.count ? " / " + g.count : "") + '</span><span class="g-arrow" aria-hidden="true">›</span></summary>' +
        '<ul class="cmd-list">';
      var lastSub = null;
      list.forEach(function (c) {
        var depth = Math.max(0, c.p.length - 2);
        if (c.p.length >= 3 && c.p[1] !== lastSub) {
          html += '<li class="sub-label" style="--d:0" aria-hidden="true">/' + esc(c.p[0] + " " + c.p[1]) + "</li>";
        }
        lastSub = c.p.length >= 3 ? c.p[1] : null;
        var sx = syntax(c);
        var d = descOf(c);
        html += '<li class="cmd" style="--d:' + depth + '"><div class="syn">' + hl(sx.base, toks) +
          (sx.args.length ? ' <span class="o">' + hl(sx.args.join(" "), toks) + "</span>" : "") + '</div><div class="desc">' + hl(d, toks) + "</div>";
        var meta = "";
        (c.r || []).forEach(function (p) { meta += '<span class="badge perm">' + esc(t("cmd.requires", "Requires")) + ": " + esc(t("perm." + p, p)) + "</span>"; });
        if (c.h) meta += '<span class="badge">' + esc(t("cmd.prefix", "also available as a prefix command")) + "</span>";
        if (c.n === "support-server") meta += '<span class="badge">' + esc(t("cmd.supportonly", "tied to the Sentinel support server")) + "</span>";
        if (meta) html += '<div class="meta">' + meta + "</div>";
        html += "</li>";
      });
      html += "</ul></details>";
    });
    root.innerHTML = html;
    loadingEl.hidden = true;
    emptyEl.hidden = shown !== 0;
    root.hidden = shown === 0;
    var word = shown === 1 ? t("cmd.command", "command") : t("cmd.commands", "commands");
    var gw = groupCount === 1 ? t("cmd.group", "command group") : t("cmd.groups", "command groups");
    metaEl.textContent = t("cmd.showing", "Showing") + " " + shown + " / " + total + " " + word + " · " + groupCount + " " + gw;
    clearEl.hidden = !state.q;
    expandBtn.hidden = searching || shown === 0;
    expandBtn.textContent = expandedAll ? t("cmd.collapse", "Collapse all") : t("cmd.expand", "Expand all");
    expandBtn.setAttribute("aria-pressed", String(expandedAll));
    var qs = new URLSearchParams(window.location.search);
    if (state.q) qs.set("q", state.q); else qs.delete("q");
    if (state.cat !== "all") qs.set("cat", state.cat); else qs.delete("cat");
    try { window.history.replaceState(null, "", window.location.pathname + (qs.toString() ? "?" + qs.toString() : "") + window.location.hash); } catch (e) { /* ignore */ }
  }

  root.addEventListener("toggle", function (e) {
    var d = e.target; if (d && d.matches && d.matches("details.cmd-group")) openSet[d.getAttribute("data-g")] = d.open;
  }, true);
  searchEl.addEventListener("input", function () { state.q = searchEl.value.trim(); render(); });
  clearEl.addEventListener("click", function () { searchEl.value = ""; state.q = ""; render(); searchEl.focus(); });
  var clearAll = document.getElementById("cmd-reset");
  if (clearAll) clearAll.addEventListener("click", function () { searchEl.value = ""; state.q = ""; state.cat = "all"; render(); searchEl.focus(); });
  chipsEl.addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    state.cat = b.getAttribute("data-cat"); render();
  });
  expandBtn.addEventListener("click", function () {
    expandedAll = !expandedAll; if (!expandedAll) openSet = {}; render();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchEl && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); searchEl.focus(); }
    if (e.key === "Escape" && document.activeElement === searchEl && state.q) { searchEl.value = ""; state.q = ""; render(); }
  });
  window.addEventListener("scroll", function () { if (backTop) backTop.classList.toggle("show", window.scrollY > 700); }, { passive: true });

  var qs0 = new URLSearchParams(window.location.search);
  if (qs0.get("q")) { state.q = qs0.get("q"); searchEl.value = state.q; }
  if (qs0.get("cat") && DATA.categories.indexOf(qs0.get("cat")) >= 0) state.cat = qs0.get("cat");
  var hash = window.location.hash.replace(/^#g-/, "").replace(/^#/, "");
  if (hash && DATA.groups.some(function (g) { return g.name === hash; })) openSet[hash] = true;

  render();
  if (hash && openSet[hash]) { var el = document.getElementById("g-" + hash); if (el) el.scrollIntoView(); }
  if (S) S.onLang(function () { render(); searchEl.placeholder = t("cmd.placeholder", searchEl.placeholder); });
})();
