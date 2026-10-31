(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var list = $("sa-list"), gate = $("sa-gate"), app = $("sa-app"), msg = $("sa-msg"), count = $("sa-count"), seg = $("sa-seg"), q = $("sa-q");
  var items = [], filter = "all", busy = false;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function say(t, bad) { msg.textContent = t || ""; msg.style.color = bad ? "var(--red)" : ""; }
  function showGate(t, link) {
    app.hidden = true; gate.hidden = false; gate.textContent = ""; gate.append(el("p", "srv-state-t", t));
    if (link) { var a = el("a", "btn btn-sm btn-primary", "Sign in"); a.href = "/dashboard"; gate.append(a); }
  }
  function call(path, opts) {
    return fetch(API + path, Object.assign({ credentials: "include" }, opts || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.message || d.error || r.status); e.status = r.status; throw e; } return d; });
    });
  }
  function act(action, id, value, reason) {
    if (busy) return Promise.resolve();
    busy = true; say("Working…");
    return call("/admin/servers/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: action, guild_id: id, value: value, reason: reason || "" }) })
      .then(function () { say("Done."); return refresh(); })
      .catch(function (e) { say(e.message || "Failed.", true); })
      .then(function () { busy = false; });
  }
  function pill(text, on, fn, danger) {
    var b = el("button", "srv-toggle" + (on ? " on" : ""), text); b.type = "button"; b.style.minHeight = "38px"; b.setAttribute("aria-pressed", String(on));
    if (danger) b.style.borderColor = "#5a2222";
    b.addEventListener("click", fn); return b;
  }
  function row(v) {
    var li = el("li", "bot-card sa-row"), head = el("div", "bot-head"), id = el("div", "bot-id");
    var av;
    if (v.icon && v.icon.indexOf("https://cdn.discordapp.com/") === 0) { av = el("img", "bot-av"); av.src = v.icon; av.alt = ""; av.width = av.height = 56; av.referrerPolicy = "no-referrer"; }
    else av = el("span", "bot-av bot-ph", (v.name || "?").charAt(0).toUpperCase());
    var tags = el("div", "bot-tags");
    if (v.verified) tags.append(el("span", "badge", "Verified"));
    if (v.featured) tags.append(el("span", "badge", "Featured"));
    if (v.hidden) tags.append(el("span", "badge srv-nsfw", "Hidden"));
    if (v.nsfw) tags.append(el("span", "badge srv-nsfw", "NSFW"));
    if (v.reports) tags.append(el("span", "badge srv-nsfw", v.reports + " report" + (v.reports > 1 ? "s" : "") + ": " + v.report_reasons.join(", ")));
    id.append(el("span", "bot-name", v.name), el("span", "mg-hint", v.id + " · " + v.members.toLocaleString("en-US") + " members" + (v.rating ? " · " + v.rating + "★ (" + v.reviews + ")" : "")), tags);
    head.append(av, id);
    var acts = el("div", "bot-actions");
    acts.append(
      pill(v.verified ? "Unverify" : "Verify", v.verified, function () { act("verify", v.id, !v.verified); }),
      pill(v.featured ? "Unfeature" : "Feature", v.featured, function () { act("feature", v.id, !v.featured); }),
      pill(v.hidden ? "Show" : "Hide", v.hidden, function () { act("hide", v.id, !v.hidden); })
    );
    if (v.reports) {
      acts.append(pill("Dismiss reports", false, function () { act("resolve", v.id, true); }), pill("Mark actioned", false, function () { act("resolve", v.id, false); }));
    }
    acts.append(pill("Unlist", false, function () { if (confirm("Remove " + v.name + " from the directory?")) act("unlist", v.id, true); }, true));
    acts.append(pill("Ban", false, function () { var r = prompt("Reason (internal):", ""); if (r !== null && confirm("Ban " + v.name + " and forbid it from listing again?")) act("ban", v.id, true, r); }, true));
    li.append(head, el("p", "bot-desc", v.description || ""), acts);
    return li;
  }
  function paint() {
    var term = (q.value || "").trim().toLowerCase();
    var shown = items.filter(function (v) {
      if (filter === "reports" && !v.reports) return false;
      if (filter === "hidden" && !v.hidden) return false;
      if (filter === "unverified" && v.verified) return false;
      if (term && (v.name + " " + v.id).toLowerCase().indexOf(term) < 0) return false;
      return true;
    });
    list.textContent = ""; shown.forEach(function (v) { list.append(row(v)); });
    count.textContent = shown.length + " of " + items.length + " listed servers";
    seg.textContent = "";
    [["all", "All"], ["reports", "Reported"], ["hidden", "Hidden"], ["unverified", "Unverified"]].forEach(function (o) {
      var b = el("button", "srv-seg-b" + (filter === o[0] ? " on" : ""), o[1]); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(filter === o[0]));
      b.addEventListener("click", function () { filter = o[0]; paint(); }); seg.append(b);
    });
  }
  function refresh() {
    return call("/admin/servers").then(function (d) { items = d.items || []; gate.hidden = true; app.hidden = false; paint(); });
  }
  q.addEventListener("input", paint);
  $("sa-ban").addEventListener("click", function () { var id = $("sa-id").value.trim(); if (!/^\d{15,22}$/.test(id)) return say("Enter a valid server ID.", true); if (confirm("Ban server " + id + "?")) act("ban", id, true, $("sa-reason").value); });
  $("sa-unban").addEventListener("click", function () { var id = $("sa-id").value.trim(); if (!/^\d{15,22}$/.test(id)) return say("Enter a valid server ID.", true); act("unban", id, true); });
  if (!API) return showGate("The auth API is not configured.");
  refresh().catch(function (e) {
    if (e.status === 403 || e.status === 401) showGate("Access denied. Sign in with the owner account first.", true);
    else if (e.status === 503) showGate("Not configured yet: " + e.message);
    else showGate(e.message || "Could not load.");
  });
})();
