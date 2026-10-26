/* Sentinel server dashboard: ticket system settings. Talks to the Worker (/dash/guild/<id>); the bot reads the saved config. */
(function () {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var gid = new URLSearchParams(location.search).get("guild") || "";
  var stateBox = document.getElementById("mg-state"), app = document.getElementById("mg-app"), title = document.getElementById("mg-title"), lead = document.getElementById("mg-lead");
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function show(msg, cta) { stateBox.hidden = false; app.hidden = true; stateBox.textContent = msg; if (cta) { stateBox.appendChild(document.createTextNode(" ")); var a = el("a", "", cta[0]); a.href = cta[1]; stateBox.appendChild(a); } }
  function api(path, body) {
    return fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || j.error || "Request failed"); e.code = j.error; e.status = r.status; throw e; } return j; }); });
  }
  if (!API) { lead.textContent = ""; return show("The dashboard service is not configured yet."); }
  if (!/^\d{15,25}$/.test(gid)) { lead.textContent = ""; return show("No server selected.", ["Choose one in the dashboard", "/dashboard"]); }
  var data, cfg, msg;
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "ticket"; }
  function field(label, control, hint) { var f = el("div", "mg-f"), l = el("label", "", label); f.append(l, control); if (hint) f.append(el("span", "mg-hint", hint)); return f; }
  function section(name, hint) { var s = el("section", "mg-sec"); s.appendChild(el("h2", "", name)); if (hint) s.appendChild(el("p", "mg-hint", hint)); for (var i = 2; i < arguments.length; i++) if (arguments[i]) s.appendChild(arguments[i]); return s; }
  function toggle(label, key, hint) { var w = el("label", "mg-tg"), i = el("input"); i.type = "checkbox"; i.checked = !!cfg[key]; i.addEventListener("change", function () { cfg[key] = i.checked; }); w.append(i, el("span", "", label)); if (hint) w.append(el("small", "", hint)); return w; }
  function text(key, obj, o) { o = o || {}; var i = el(o.area ? "textarea" : "input"); if (!o.area) i.type = "text"; else i.rows = o.rows || 3; i.maxLength = o.max || 100; i.placeholder = o.ph || ""; i.value = obj[key] || ""; i.addEventListener("input", function () { obj[key] = i.value; preview(); }); return i; }
  function select(opts, cur, on, empty) { var s = el("select"); if (empty !== undefined) { var e = el("option", "", empty); e.value = ""; s.appendChild(e); } opts.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; s.appendChild(op); }); s.value = cur || ""; s.addEventListener("change", function () { on(s.value); preview(); }); return s; }
  var pv;
  function preview() {
    if (!pv) return; while (pv.firstChild) pv.removeChild(pv.firstChild);
    var card = el("div", "mg-embed"); card.style.borderLeftColor = /^#[0-9a-f]{6}$/i.test(cfg.panel.color) ? cfg.panel.color : "#5865f2";
    card.appendChild(el("b", "", cfg.panel.title || "Support tickets")); card.appendChild(el("p", "", cfg.panel.description || "")); if (cfg.panel.footer) card.appendChild(el("small", "", cfg.panel.footer));
    var row = el("div", "mg-btns"); cfg.types.forEach(function (t) { row.appendChild(el("span", "mg-btn " + cfg.panel.buttonStyle, (t.emoji ? t.emoji + " " : "") + (t.label || "…"))); }); card.appendChild(row); pv.appendChild(card);
  }
  function typesEditor() {
    var box = el("div", "mg-types");
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      cfg.types.forEach(function (t, i) {
        var r = el("div", "mg-type"), em = text("emoji", t, { max: 8, ph: "🎫" }), lb = text("label", t, { max: 40, ph: "Support" }), ds = text("description", t, { max: 100, ph: "What is this for?" });
        em.className = "mg-emoji"; var rm = el("button", "btn btn-sm", "Remove"); rm.type = "button"; rm.disabled = cfg.types.length <= 1; rm.addEventListener("click", function () { cfg.types.splice(i, 1); redraw(); preview(); });
        r.append(em, lb, ds, rm); box.appendChild(r);
      });
      if (cfg.types.length < 5) { var add = el("button", "btn btn-sm", "Add a ticket type"); add.type = "button"; add.addEventListener("click", function () { cfg.types.push({ id: "", label: "", emoji: "", description: "" }); redraw(); }); box.appendChild(add); }
    }
    redraw(); return box;
  }
  function rolesPicker() {
    var box = el("div", "mg-roles");
    data.roles.forEach(function (r) { var l = el("label", "mg-chip"), i = el("input"); i.type = "checkbox"; i.checked = cfg.supportRoleIds.indexOf(r.id) >= 0; if (r.color) l.style.setProperty("--rc", r.color);
      i.addEventListener("change", function () { var k = cfg.supportRoleIds.indexOf(r.id); if (i.checked && k < 0) { if (cfg.supportRoleIds.length >= 5) { i.checked = false; return say("Up to 5 support roles.", true); } cfg.supportRoleIds.push(r.id); } else if (!i.checked && k >= 0) cfg.supportRoleIds.splice(k, 1); });
      l.append(i, el("span", "", r.name)); box.appendChild(l); });
    if (!data.roles.length) box.appendChild(el("p", "mg-hint", "This server has no roles Sentinel can use."));
    return box;
  }
  function say(t, err) { msg.textContent = t || ""; msg.className = "mg-msg" + (err ? " err" : t ? " ok" : ""); }
  function payload() { cfg.types.forEach(function (t) { if (!t.id) t.id = slug(t.label); }); return cfg; }
  function build() {
    while (app.firstChild) app.removeChild(app.firstChild); stateBox.hidden = true; app.hidden = false;
    var text_ch = data.channels.filter(function (c) { return c.type === "text"; }).map(function (c) { return [c.id, "# " + c.name]; });
    var cats = data.channels.filter(function (c) { return c.type === "category"; }).map(function (c) { return [c.id, c.name]; });
    msg = el("div", "mg-msg"); msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    pv = el("div", "mg-pv");
    app.appendChild(section("Ticket system", "Members press a button in your panel channel and get a private channel with your team. Settings are saved here and read by the Sentinel bot.", toggle("Enable tickets on this server", "enabled")));
    app.appendChild(section("Where", "Sentinel needs permission to view and send messages in the panel channel, and to manage channels in the category.",
      field("Panel channel", select(text_ch, cfg.panelChannelId, function (v) { cfg.panelChannelId = v; }, "Choose a channel…"), "The channel where the “open a ticket” message is posted."),
      field("Category for new tickets", select(cats, cfg.categoryId, function (v) { cfg.categoryId = v; }, "Choose a category…")),
      field("Log channel (optional)", select(text_ch, cfg.logChannelId, function (v) { cfg.logChannelId = v; }, "None"), "Opened/closed tickets and transcripts are sent here.")));
    app.appendChild(section("Support team", "These roles can see and answer every ticket.", rolesPicker()));
    app.appendChild(section("Behaviour",null,
      field("Open tickets per member", select([1, 2, 3, 5, 10].map(function (n) { return [String(n), String(n)]; }), String(cfg.maxOpen), function (v) { cfg.maxOpen = Number(v); })),
      field("Channel name", select([["ticket-{number}", "ticket-0001"], ["ticket-{user}", "ticket-username"], ["{type}-{number}", "type-0001"]], cfg.namePattern, function (v) { cfg.namePattern = v; })),
      toggle("“Claim” button for staff", "claim"), toggle("Save a transcript when a ticket is closed", "transcript", "Sent to the log channel as a text file."), toggle("Ask for confirmation before closing", "confirmClose")));
    app.appendChild(section("Ticket types", "Up to 5 buttons on the panel. Members pick the one that fits.", typesEditor()));
    app.appendChild(section("Panel message", null,
      field("Title", text("title", cfg.panel, { max: 80 })), field("Description", text("description", cfg.panel, { area: true, max: 1000, rows: 4 })),
      (function () { var c = el("input"); c.type = "color"; c.value = cfg.panel.color; c.addEventListener("input", function () { cfg.panel.color = c.value; preview(); }); return field("Colour", c); })(),
      field("Footer (optional)", text("footer", cfg.panel, { max: 80 })),
      field("Button colour", select([["primary", "Blue"], ["secondary", "Grey"], ["success", "Green"], ["danger", "Red"]], cfg.panel.buttonStyle, function (v) { cfg.panel.buttonStyle = v; })), el("div", "mg-hint", "Preview"), pv));
    app.appendChild(section("Welcome message", "Sent inside each new ticket. You can use {user}, {type} and {number}.", field("Message", text("welcome", cfg, { area: true, max: 1000, rows: 4 }))));
    var bar = el("div", "mg-bar"), save = el("button", "btn btn-primary", "Save settings"), post = el("button", "btn", cfg.panelMessageId ? "Update the panel in Discord" : "Post the panel in Discord");
    save.type = post.type = "button";
    function busy(on) { save.disabled = post.disabled = on; }
    save.addEventListener("click", function () { busy(true); say("Saving…"); api("/dash/guild/" + gid + "/tickets", payload()).then(function (j) { cfg = j.tickets; say("Saved."); }).catch(function (e) { say(e.message, true); }).then(function () { busy(false); }); });
    post.addEventListener("click", function () {
      busy(true); say("Saving and posting…");
      api("/dash/guild/" + gid + "/tickets", payload()).then(function (j) { cfg = j.tickets; return api("/dash/guild/" + gid + "/tickets/panel", {}); })
        .then(function (j) { say(j.edited ? "Panel updated in Discord." : "Panel posted in Discord."); post.textContent = "Update the panel in Discord"; }).catch(function (e) { say(e.message, true); }).then(function () { busy(false); });
    });
    bar.append(save, post); app.append(bar, msg); preview();
  }
  api("/dash/guild/" + gid).then(function (j) {
    data = j; cfg = j.tickets; cfg.panel = cfg.panel || {}; cfg.supportRoleIds = cfg.supportRoleIds || []; cfg.types = cfg.types && cfg.types.length ? cfg.types : [{ id: "support", label: "Support", emoji: "🎫", description: "" }];
    title.textContent = j.guild.name; lead.textContent = "Ticket system"; document.title = j.guild.name + " — Sentinel"; build();
  }).catch(function (e) {
    lead.textContent = "";
    if (e.status === 401) show("Sign in to manage your servers.", ["Sign in", "/account"]);
    else if (e.code === "bot_missing") show("Sentinel isn't in this server yet.", ["Back to dashboard", "/dashboard"]);
    else if (e.code === "link_discord" || e.code === "relink_discord") show(e.message, ["Account page", "/account"]);
    else show(e.message || "Could not load this server.", ["Back to dashboard", "/dashboard"]);
  });
})();
