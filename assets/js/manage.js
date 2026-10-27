/* Sentinel server dashboard: drives the bot's own ticket system.
 * The bot publishes a snapshot (settings schema, types, panels); changes are queued here and the bot applies them. */
(function () {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var gid = new URLSearchParams(location.search).get("guild") || "";
  var stateBox = document.getElementById("mg-state"), app = document.getElementById("mg-app"), title = document.getElementById("mg-title"), lead = document.getElementById("mg-lead");
  var FR = (document.documentElement.lang || "").indexOf("fr") === 0 || /(?:^|;\s*)lang=fr/.test(document.cookie) || (function () { try { return localStorage.getItem("lang") === "fr"; } catch (_) { return false; } })();
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function show(msg, cta) { stateBox.hidden = false; app.hidden = true; stateBox.textContent = msg; if (cta) { stateBox.appendChild(document.createTextNode(" ")); var a = el("a", "", cta[0]); a.href = cta[1]; stateBox.appendChild(a); } }
  function api(path, body) {
    return fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || j.error || "Request failed"); e.code = j.error; e.status = r.status; throw e; } return j; }); });
  }
  var MAINTENANCE = true; /* passe à false pour réactiver la gestion des tickets */
  if (MAINTENANCE) { lead.textContent = ""; title.textContent = "Ticket management"; return show("Ticket management is under maintenance. It will be back soon.", ["Back to the dashboard", "/dashboard"]); }
  if (!API) { lead.textContent = ""; return show("The dashboard service is not configured yet."); }
  if (!/^\d{15,25}$/.test(gid)) { lead.textContent = ""; return show("No server selected.", ["Choose one in the dashboard", "/dashboard"]); }
  var lastMsg = "", data, snap, tab = "settings", dirty = {}, msg, editing = null;
  var SEC = { general: "General", roles: "Roles", channels: "Channels", logging: "Logging", limits: "Limits", naming: "Naming", closing: "Closing", transcripts: "Transcripts", ratings: "Ratings", priorities: "Priorities", controls: "Ticket buttons" };
  function say(t, err) { lastMsg = t && !err ? t : ""; if (!msg) return; msg.textContent = t || ""; msg.className = "mg-msg" + (err ? " err" : t ? " ok" : ""); }
  function field(label, control, hint) { var f = el("div", "mg-f"); f.append(el("label", "", label), control); if (hint) f.append(el("span", "mg-hint", hint)); return f; }
  function section(name, hint) { var s = el("section", "mg-sec"); s.appendChild(el("h2", "", name)); if (hint) s.appendChild(el("p", "mg-hint", hint)); for (var i = 2; i < arguments.length; i++) if (arguments[i]) s.appendChild(arguments[i]); return s; }
  function opts(list, cur, on, empty) { var s = el("select"); if (empty !== undefined) { var e = el("option", "", empty); e.value = ""; s.appendChild(e); } list.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; s.appendChild(op); }); s.value = cur == null ? "" : String(cur); s.addEventListener("change", function () { on(s.value); }); return s; }
  var textCh = function () { return data.channels.filter(function (c) { return c.type === "text"; }).map(function (c) { return [c.id, "# " + c.name]; }); };
  var cats = function () { return data.channels.filter(function (c) { return c.type === "category"; }).map(function (c) { return [c.id, c.name]; }); };
  function rolePicker(cur, on) {
    var box = el("div", "mg-roles"), set = (cur || []).map(String);
    data.roles.forEach(function (r) { var l = el("label", "mg-chip"), i = el("input"); i.type = "checkbox"; i.checked = set.indexOf(r.id) >= 0; if (r.color) l.style.setProperty("--rc", r.color);
      i.addEventListener("change", function () { var k = set.indexOf(r.id); if (i.checked && k < 0) set.push(r.id); else if (!i.checked && k >= 0) set.splice(k, 1); on(set.slice()); });
      l.append(i, el("span", "", r.name)); box.appendChild(l); });
    if (!data.roles.length) box.appendChild(el("p", "mg-hint", "This server has no roles Sentinel can use."));
    return box;
  }
  function toggle(label, cur, on) { var w = el("label", "mg-tg"), i = el("input"); i.type = "checkbox"; i.checked = !!cur; i.addEventListener("change", function () { on(i.checked); }); w.append(i, el("span", "", label)); return w; }
  function textIn(cur, on, o) { o = o || {}; var i = el(o.area ? "textarea" : "input"); if (!o.area) i.type = "text"; else i.rows = o.rows || 3; i.maxLength = o.max || 100; i.placeholder = o.ph || ""; i.value = cur == null ? "" : cur; i.addEventListener("input", function () { on(i.value); }); return i; }
  function colorIn(cur, on) { var c = el("input"); c.type = "color"; c.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#2b2b2b"; c.addEventListener("input", function () { on(c.value); }); return c; }
  function numIn(cur, on, d) { var i = el("input"); i.type = "number"; if (d && d.min != null) i.min = d.min; if (d && d.max != null) i.max = d.max; i.value = cur; i.addEventListener("input", function () { on(i.value); }); return i; }

  /* ---- operations ---- */
  function queue(op, d) { return api("/dash/guild/" + gid + "/tickets/op", { op: op, data: d }); }
  function wait(id, tries) {
    return new Promise(function (res, rej) {
      (function poll(n) {
        api("/dash/guild/" + gid).then(function (j) {
          var hit = (j.results || []).filter(function (r) { return r.id === id; })[0];
          if (hit) { data = j; snap = j.snapshot; return hit.ok ? res() : rej(new Error(hit.error || "The bot refused this change.")); }
          if (n >= (tries || 14)) return rej(new Error("The bot didn't answer in time. Check that it's online and that ticket_dashboard.py is loaded; the change stays queued."));
          setTimeout(function () { poll(n + 1); }, 2500);
        }).catch(rej);
      })(0);
    });
  }
  function run(op, d, okMsg, btns) {
    btns.forEach(function (b) { b.disabled = true; }); say("Sending to the bot…");
    return queue(op, d).then(function (j) { return wait(j.id); }).then(function () { say(okMsg || "Done."); return true; })
      .catch(function (e) { say(e.message, true); return false; }).then(function (ok) { btns.forEach(function (b) { b.disabled = false; }); return ok; });
  }

  /* ---- settings tab ---- */
  function control(d) {
    var cur = key(d), set = function (v) { dirty[d.key] = v; };
    switch (d.kind) {
      case "bool": return toggle(label(d), cur, set);
      case "int": return field(label(d), numIn(cur, set, d), d.min != null ? d.min + " – " + d.max : "");
      case "text": return field(label(d), textIn(cur, set, { max: d.maxlen }), d.placeholders.length ? "Placeholders: " + d.placeholders.map(function (p) { return "{" + p + "}"; }).join(" ") : "");
      case "longtext": return field(label(d), textIn(cur, set, { max: d.maxlen, area: true, rows: 4 }), d.placeholders.length ? "Placeholders: " + d.placeholders.map(function (p) { return "{" + p + "}"; }).join(" ") : "");
      case "url": return field(label(d), textIn(cur, set, { max: 500, ph: "https://…" }));
      case "color": return field(label(d), colorIn(cur, set));
      case "enum": return field(label(d), opts(d.choices.map(function (c) { return [c, c]; }), cur, set));
      case "roles": return field(label(d), rolePicker(cur, set));
      case "channel": return field(label(d), opts(d.channelTypes.indexOf("category") >= 0 && d.channelTypes.indexOf("text") < 0 ? cats() : textCh(), cur, set, "None"));
      case "strlist": return field(label(d), textIn((cur || []).join("\n"), function (v) { set(v.split("\n")); }, { area: true, max: 2500, rows: 4 }), "One per line");
    }
    return null;
  }
  function key(d) { return d.key in dirty ? dirty[d.key] : snap.values[d.key]; }
  function label(d) { var t = FR && d.labelFr && d.labelFr.indexOf("set.") !== 0 ? d.labelFr : d.label; return t && t.indexOf("set.") !== 0 ? t : d.key.replace(/[_.]/g, " "); }
  function settingsTab(box) {
    var order = [], by = {};
    snap.schema.forEach(function (d) { if (!by[d.section]) { by[d.section] = []; order.push(d.section); } by[d.section].push(d); });
    order.forEach(function (s) { var sec = section(SEC[s] || s); by[s].forEach(function (d) { var c = control(d); if (c) sec.appendChild(c); }); box.appendChild(sec); });
    var save = el("button", "btn btn-primary", "Save settings"); save.type = "button";
    save.addEventListener("click", function () {
      if (!Object.keys(dirty).length) return say("Nothing to save.");
      run("settings", { changes: dirty }, "Settings saved.", [save]).then(function (ok) { if (ok) { dirty = {}; render(); } });
    });
    box.appendChild(el("div", "mg-bar")).appendChild(save);
  }

  /* ---- types tab ---- */
  function typesTab(box) {
    var list = el("div", "mg-types");
    snap.types.forEach(function (t) {
      var r = el("div", "mg-type"), b = el("button", "btn btn-sm", "Edit"); b.type = "button";
      r.append(el("span", "mg-emoji", t.emoji || "🎫"), el("b", "", t.name + (t.enabled ? "" : " (disabled)")), el("span", "mg-hint", t.description || (t.formFields ? t.formFields + " form field(s)" : "")), b);
      b.addEventListener("click", function () { editing = { kind: "type", d: JSON.parse(JSON.stringify(t)) }; render(); }); list.appendChild(r);
    });
    var add = el("button", "btn btn-sm", "New ticket type"); add.type = "button"; add.disabled = snap.types.length >= snap.limits.types;
    add.addEventListener("click", function () { editing = { kind: "type", d: { id: 0, name: "", description: "", emoji: "", enabled: true, askReason: false, categoryId: "", staffRoleIds: [], notifyRoleIds: [], userLimit: 0, defaultPriority: "", welcomeMessage: "", namingFormat: "" } }; render(); });
    box.appendChild(section("Ticket types", "The kinds of ticket members can open. Question forms (custom fields) are still edited with /ticket setup in Discord.", list, add));
  }
  function typeForm(box) {
    var t = editing.d, sec = section(t.id ? "Edit type" : "New ticket type"), b = [];
    sec.append(field("Name", textIn(t.name, function (v) { t.name = v; }, { max: 100 })), field("Description", textIn(t.description, function (v) { t.description = v; }, { max: 100 })),
      field("Emoji", textIn(t.emoji, function (v) { t.emoji = v; }, { max: 40, ph: "🎫" })), toggle("Enabled", t.enabled, function (v) { t.enabled = v; }), toggle("Ask for a reason when opening", t.askReason, function (v) { t.askReason = v; }),
      field("Category for these tickets", opts(cats(), t.categoryId, function (v) { t.categoryId = v; }, "Default category")),
      field("Staff roles", rolePicker(t.staffRoleIds, function (v) { t.staffRoleIds = v; }), "Empty = the server's general support roles."),
      field("Roles to ping", rolePicker(t.notifyRoleIds, function (v) { t.notifyRoleIds = v; })),
      field("Open tickets per member (0 = server default)", numIn(t.userLimit, function (v) { t.userLimit = Number(v) || 0; }, { min: 0, max: 50 })),
      field("Default priority", opts(snap.priorities.map(function (p) { return [p, p]; }), t.defaultPriority, function (v) { t.defaultPriority = v; }, "Server default")),
      field("Welcome message", textIn(t.welcomeMessage, function (v) { t.welcomeMessage = v; }, { area: true, max: 1500, rows: 4 }), "Empty = the server's welcome message."),
      field("Channel name format", textIn(t.namingFormat, function (v) { t.namingFormat = v; }, { max: 100, ph: "ticket-{number}" })));
    var bar = el("div", "mg-bar"), save = el("button", "btn btn-primary", "Save type"), back = el("button", "btn", "Cancel"); save.type = back.type = "button"; b.push(save, back); bar.append(save, back);
    if (t.id) { var del = el("button", "btn", "Delete"); del.type = "button"; b.push(del); bar.append(del); del.addEventListener("click", function () { if (confirm("Delete this ticket type? Existing tickets keep working.")) run("type_delete", { id: t.id }, "Type deleted.", b).then(function (ok) { if (ok) { editing = null; render(); } }); }); }
    back.addEventListener("click", function () { editing = null; render(); });
    save.addEventListener("click", function () { var d = JSON.parse(JSON.stringify(t)); run(t.id ? "type_update" : "type_create", d, "Type saved.", b).then(function (ok) { if (ok) { editing = null; render(); } }); });
    sec.appendChild(bar); box.appendChild(sec);
  }

  /* ---- panels tab ---- */
  function panelsTab(box) {
    var list = el("div", "mg-types");
    snap.panels.forEach(function (p) {
      var r = el("div", "mg-type"), b = el("button", "btn btn-sm", "Edit"); b.type = "button"; var ch = data.channels.filter(function (c) { return c.id === p.channelId; })[0];
      r.append(el("span", "mg-emoji", p.published ? "✅" : "📝"), el("b", "", p.name), el("span", "mg-hint", (ch ? "# " + ch.name : "no channel") + (p.published ? " · live" : " · not posted")), b);
      b.addEventListener("click", function () { editing = { kind: "panel", d: JSON.parse(JSON.stringify(p)) }; render(); }); list.appendChild(r);
    });
    var add = el("button", "btn btn-sm", "New panel"); add.type = "button"; add.disabled = snap.panels.length >= snap.limits.panels;
    add.addEventListener("click", function () { editing = { kind: "panel", d: { id: 0, name: "Support", channelId: "", title: "", description: "", color: "#5865f2", bannerUrl: "", thumbnailUrl: "", footer: "", mode: "select", placeholder: "", buttonStyle: "primary", typeIds: [], showTypes: false } }; render(); });
    box.appendChild(section("Panels", "A panel is the message members use to open a ticket. Posting it from here sends it to the channel you pick.", list, add));
  }
  function panelForm(box) {
    var p = editing.d, sec = section(p.id ? "Edit panel" : "New panel"), b = [];
    var tp = el("div", "mg-roles");
    snap.types.forEach(function (t) { var l = el("label", "mg-chip"), i = el("input"); i.type = "checkbox"; i.checked = p.typeIds.indexOf(t.id) >= 0; i.addEventListener("change", function () { var k = p.typeIds.indexOf(t.id); if (i.checked && k < 0) p.typeIds.push(t.id); else if (!i.checked && k >= 0) p.typeIds.splice(k, 1); }); l.append(i, el("span", "", (t.emoji ? t.emoji + " " : "") + t.name)); tp.appendChild(l); });
    sec.append(field("Panel name (internal)", textIn(p.name, function (v) { p.name = v; }, { max: 60 })), field("Channel", opts(textCh(), p.channelId, function (v) { p.channelId = v; }, "Choose a channel…")),
      field("Title", textIn(p.title, function (v) { p.title = v; }, { max: 256 })), field("Description", textIn(p.description, function (v) { p.description = v; }, { area: true, max: 4000, rows: 5 })),
      field("Colour", colorIn(p.color, function (v) { p.color = v; })), field("Footer", textIn(p.footer, function (v) { p.footer = v; }, { max: 256 })),
      field("Banner image URL", textIn(p.bannerUrl, function (v) { p.bannerUrl = v; }, { max: 500, ph: "https://…" })), field("Thumbnail URL", textIn(p.thumbnailUrl, function (v) { p.thumbnailUrl = v; }, { max: 500, ph: "https://…" })),
      field("Style", opts([["select", "Dropdown menu"], ["buttons", "Buttons"]], p.mode, function (v) { p.mode = v; })), field("Dropdown placeholder", textIn(p.placeholder, function (v) { p.placeholder = v; }, { max: 100 })),
      field("Button colour", opts([["primary", "Blue"], ["secondary", "Grey"], ["success", "Green"], ["danger", "Red"]], p.buttonStyle, function (v) { p.buttonStyle = v; })),
      toggle("List the types in the message", p.showTypes, function (v) { p.showTypes = v; }), field("Ticket types shown", tp, "None selected = all enabled types."));
    var bar = el("div", "mg-bar"), save = el("button", "btn btn-primary", p.published ? "Save & update in Discord" : "Save"), post = el("button", "btn", "Save & post in Discord"), back = el("button", "btn", "Cancel");
    save.type = post.type = back.type = "button"; b.push(save, post, back); bar.append(save, back);
    if (!p.published) bar.insertBefore(post, back);
    if (p.id) { var del = el("button", "btn", "Delete"); del.type = "button"; b.push(del); bar.append(del); del.addEventListener("click", function () { if (confirm("Delete this panel? The message already posted in Discord stays until you remove it.")) run("panel_delete", { id: p.id }, "Panel deleted.", b).then(function (ok) { if (ok) { editing = null; render(); } }); }); }
    back.addEventListener("click", function () { editing = null; render(); });
    function go(publish) { var d = JSON.parse(JSON.stringify(p)); d.publish = publish; run(p.id ? "panel_update" : "panel_create", d, publish ? "Panel saved and posted." : "Panel saved.", b).then(function (ok) { if (ok) { editing = null; render(); } }); }
    save.addEventListener("click", function () { go(false); }); post.addEventListener("click", function () { go(true); });
    sec.appendChild(bar); box.appendChild(sec);
  }

  function render() {
    while (app.firstChild) app.removeChild(app.firstChild); stateBox.hidden = true; app.hidden = false;
    if (!snap) {
      var s = section("Waiting for the bot", "The bot hasn't shared this server's ticket settings yet. Make sure the Sentinel bot is online with the ticket_dashboard module installed (see the bot-module README); this page refreshes every few seconds.");
      app.appendChild(s); setTimeout(function () { if (!snap) load(true); }, 6000); return;
    }
    var nav = el("div", "mg-bar");
    [["settings", "Settings"], ["types", "Ticket types"], ["panels", "Panels"]].forEach(function (t) { var b = el("button", "btn btn-sm" + (tab === t[0] ? " btn-primary" : ""), t[1]); b.type = "button"; b.addEventListener("click", function () { tab = t[0]; editing = null; render(); }); nav.appendChild(b); });
    app.appendChild(nav);
    msg = el("div", "mg-msg"); msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite"); app.appendChild(msg);
    if (data.queue && data.queue.length) app.appendChild(el("p", "mg-hint", data.queue.length + " change(s) are waiting for the bot to pick them up."));
    var box = el("div"); app.appendChild(box); if (lastMsg) say(lastMsg);
    if (editing && editing.kind === "type") typeForm(box); else if (editing && editing.kind === "panel") panelForm(box);
    else if (tab === "settings") settingsTab(box); else if (tab === "types") typesTab(box); else panelsTab(box);
  }
  function load(quiet) {
    return api("/dash/guild/" + gid).then(function (j) {
      data = j; snap = j.snapshot; title.textContent = j.guild.name; lead.textContent = "Ticket system"; document.title = j.guild.name + " — Sentinel";
      if (!quiet || !snap || !app.firstChild) render(); else if (!snap) render();
    }).catch(function (e) {
      lead.textContent = "";
      if (e.status === 401) show("Sign in to manage your servers.", ["Sign in", "/account"]);
      else if (e.code === "bot_missing") show("Sentinel isn't in this server yet.", ["Back to dashboard", "/dashboard"]);
      else if (e.code === "link_discord" || e.code === "relink_discord") show(e.message, ["Account page", "/account"]);
      else show(e.message || "Could not load this server.", ["Back to dashboard", "/dashboard"]);
    });
  }
  load();
})();
