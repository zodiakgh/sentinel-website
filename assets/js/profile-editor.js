/* Sentinel profile editor. Talks to the Worker (same routes as before) and renders the live preview
 * with the exact same renderer as the public page (profile-render.js). */
(function () {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var SP = window.SentinelProfile, DEF = SP.DEFAULTS;
  var $ = function (id) { return document.getElementById(id); };
  var LIMITS = { image: 5, audio: 3, video: 3 }, SIZES = { image: 8, audio: 15, video: 45 };
  var state = null, saved = "", savedState = null, assets = [], counts = {}, view = null, account = null, serverProfile = null;
  var activeTab = "templates", pvTimer = 0, saving = false, phone = false;

  /* ---------------- tiny DOM + API helpers ---------------- */
  function E(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function say(text, kind) { var s = $("save-message"); s.textContent = text || ""; s.className = "grow" + (kind ? " " + kind : ""); }
  async function api(path, body) {
    var r = await fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var j = {}; try { j = await r.json(); } catch (_) { }
    if (!r.ok) { var e = new Error(j.message || j.error || "Request failed"); e.code = j.error || "error"; throw e; }
    return j;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- state ---------------- */
  var KEYS = ["username", "displayName", "bio", "status", "statusEmoji", "accentColor", "avatarUrl", "bannerUrl", "backgroundUrl", "background", "musicUrl", "backgroundVideoUrl", "audioAssets", "links", "widgets", "customization"];
  function serialize() { var o = {}; KEYS.forEach(function (k) { o[k] = state[k]; }); return JSON.stringify(o); }
  function fromProfile(p, acc) {
    var base = { username: "", displayName: "", bio: "", status: "", statusEmoji: "✨", accentColor: "#8b7cff", avatarUrl: "", bannerUrl: "", backgroundUrl: "", background: "linear-gradient(135deg, #0b1020, #29204d)", musicUrl: "", backgroundVideoUrl: "", audioAssets: [], links: [], widgets: [], customization: {} };
    if (!p) {
      var local = (acc.email || "member").split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      base.username = local.length >= 3 ? local : "member" + local; base.displayName = (acc.discord && acc.discord.name) || (acc.email || "").split("@")[0];
      base.avatarUrl = (acc.discord && acc.discord.avatarUrl) || "";
      base.links = [{ label: "Discord", url: "https://discord.com" }];
      base.customization = Object.assign({}, DEF, TEMPLATES[0].c); base.accentColor = TEMPLATES[0].accent; base.background = TEMPLATES[0].bg;
      return base;
    }
    KEYS.forEach(function (k) { if (p[k] !== undefined && p[k] !== null) base[k] = clone(p[k]); });
    base.customization = Object.assign({}, DEF, p.customization || {});
    return base;
  }
  function val(path) {
    var ks = path.split("."), o = state; for (var i = 0; i < ks.length && o !== undefined && o !== null; i++) o = o[ks[i]];
    if ((o === undefined || o === null) && ks[0] === "customization") return DEF[ks[1]];
    return o;
  }
  function put(path, v) { var ks = path.split("."), last = ks.pop(), o = state; ks.forEach(function (k) { o = o[k]; }); o[last] = v; changed(); }

  function changed() {
    clearTimeout(pvTimer); pvTimer = setTimeout(function () { if (view) view.update(previewProfile()); }, 90);
    var dirty = serialize() !== saved;
    if (!saving) say(dirty ? "Unsaved changes" : "All changes saved", dirty ? "dirty" : "ok");
  }
  function previewProfile() {
    var badges = [];
    if (account && account.verified) badges.push({ id: "verified", label: "Verified", icon: "✓" });
    if (account && account.discord) badges.push({ id: "discord", label: "Discord linked", icon: "◈" });
    var p = clone(state); p.badges = badges; p.views = serverProfile ? serverProfile.views || 0 : 0; p.createdAt = serverProfile ? serverProfile.createdAt : Date.now();
    if (!p.avatarUrl && account && account.discord) p.avatarUrl = account.discord.avatarUrl || "";
    return p;
  }

  /* ---------------- control builders ---------------- */
  function field(label, input, hint) { var f = E("div", "pe-f"), l = E("label", "", label); f.append(l, input); if (hint) f.append(E("span", "pe-hint", hint)); return f; }
  function tText(label, path, o) {
    o = o || {}; var i = E("input"); i.type = o.url ? "url" : "text"; i.maxLength = o.max || 200; i.placeholder = o.ph || ""; i.value = val(path) || "";
    if (o.url) { i.inputMode = "url"; i.autocapitalize = "off"; }
    i.addEventListener("input", function () { put(path, o.lower ? i.value.toLowerCase() : i.value); }); return field(label, i, o.hint);
  }
  function tArea(label, path, o) { o = o || {}; var i = E("textarea"); i.maxLength = o.max || 300; i.placeholder = o.ph || ""; i.value = val(path) || ""; i.addEventListener("input", function () { put(path, i.value); }); return field(label, i, o.hint); }
  function tColor(label, path, fb) { var i = E("input"); i.type = "color"; i.value = /^#[0-9a-f]{6}$/i.test(val(path) || "") ? val(path) : fb; i.addEventListener("input", function () { put(path, i.value); }); return field(label, i); }
  function tRange(label, path, min, max, step, unit) {
    var f = E("div", "pe-f"), l = E("div", "pe-lab"), o = E("output"), i = E("input"); l.append(E("span", "", label), o);
    i.type = "range"; i.min = min; i.max = max; i.step = step || 1; i.value = val(path); var show = function () { o.textContent = i.value + (unit || ""); }; show();
    i.addEventListener("input", function () { show(); put(path, Number(i.value)); }); f.append(l, i); return f;
  }
  function tSelect(label, path, opts, hint) {
    var s = E("select"); opts.forEach(function (o) { var op = E("option", "", o[1]); op.value = o[0]; s.appendChild(op); }); s.value = String(val(path));
    s.addEventListener("change", function () { put(path, s.value); }); return field(label, s, hint);
  }
  function tSeg(label, path, opts, hint) {
    var box = E("div", "pe-seg"), f = field(label, box, hint);
    opts.forEach(function (o) {
      var b = E("button", "", o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(String(val(path)) === o[0]));
      b.addEventListener("click", function () { put(path, o[0]); Array.prototype.forEach.call(box.children, function (x, ix) { x.setAttribute("aria-pressed", String(opts[ix][0] === o[0])); }); }); box.appendChild(b);
    });
    return f;
  }
  function tToggle(label, path, hint) {
    var b = E("button", "pe-tg"), t = E("div"); b.type = "button"; b.setAttribute("role", "switch"); t.append(E("span", "", label)); if (hint) t.append(E("small", "", hint));
    b.append(t, E("span", "pe-sw")); b.setAttribute("aria-checked", String(!!val(path)));
    b.addEventListener("click", function () { var v = !val(path); put(path, v); b.setAttribute("aria-checked", String(v)); }); return b;
  }
  function sec(title, hint) { var s = E("section", "pe-sec"); s.appendChild(E("h2", "", title)); if (hint) s.appendChild(E("p", "pe-hint", hint)); for (var i = 2; i < arguments.length; i++) if (arguments[i]) s.appendChild(arguments[i]); return s; }
  function grid(cls) { var g = E("div", cls || "pe-g2"); for (var i = 1; i < arguments.length; i++) if (arguments[i]) g.appendChild(arguments[i]); return g; }
  function btn(label, fn, cls) { var b = E("button", "pe-btn" + (cls ? " " + cls : ""), label); b.type = "button"; b.addEventListener("click", fn); return b; }

  /* ---------------- templates ---------------- */
  var TEMPLATES = [
    { name: "Midnight Glass", note: "Clean, dark, soft glow", accent: "#8b7cff", bg: "linear-gradient(135deg, #0b1020, #29204d)", c: { contentWidth: 560, showBanner: false, bannerHeight: 0, cardVAlign: "center", avatarEffect: "glow", linkDisplay: "buttons", cardStyle: "glass", radius: 26, animation: "rise", bgDim: 30 } },
    { name: "Neon Night", note: "Glow, stars, enter screen", accent: "#22d3ee", bg: "linear-gradient(135deg, #04050c, #0a1d33)", c: { contentWidth: 520, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "neon", glowStrength: 42, glowColor: "#22d3ee", particles: "stars", linkDisplay: "icons", iconSize: 28, avatarEffect: "spin", splashEnabled: true, splashText: "click to enter", tilt: true, bgDim: 20, radius: 28, borderStyle: "accent" } },
    { name: "Minimal Mono", note: "No effects, just you", accent: "#ffffff", bg: "#0a0a0a", c: { contentWidth: 460, showBanner: false, bannerHeight: 0, cardVAlign: "center", cardStyle: "minimal", linkDisplay: "chips", fontFamily: "instrument", avatarBorder: "white", nameSize: 36, animation: "fade", hoverEffect: "none", shadow: "none", bgDim: 0 } },
    { name: "Sakura", note: "Pink petals and sparkles", accent: "#ff7eb6", bg: "linear-gradient(135deg, #1a0b16, #3a1230)", c: { contentWidth: 540, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "gradient", nameColor2: "#ffd1e6", particles: "snow", particleColor: "#ffc2dd", cursorTrail: "sparkles", cursorColor: "#ffc2dd", avatarShape: "rounded", linkDisplay: "chips", radius: 30, glowStrength: 26, glowColor: "#ff7eb6", fontFamily: "bricolage", bgDim: 25 } },
    { name: "Terminal", note: "Green mono, typewriter", accent: "#3dff7a", bg: "#020a05", c: { contentWidth: 600, showBanner: false, bannerHeight: 0, cardVAlign: "center", fontFamily: "mono", cardStyle: "outline", borderStyle: "accent", radius: 6, nameEffect: "glitch", bioTypewriter: true, taglineTypewriter: true, tagline: "root@sentinel|building things|security first", layout: "left", alignment: "left", linkDisplay: "buttons", linkAlignment: "left", avatarShape: "square", linkRadius: 4, textColor: "#c8ffd9", mutedColor: "#5fbf84", bgDim: 0 } },
    { name: "Ember", note: "Warm embers, shimmer", accent: "#ff8a3d", bg: "linear-gradient(135deg, #120804, #2b0f05)", c: { contentWidth: 560, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "shimmer", nameColor2: "#ffd29a", particles: "embers", glowStrength: 30, glowColor: "#ff6a00", hoverEffect: "glow", linkDisplay: "buttons", bgDim: 15, radius: 22 } },
    { name: "Aurora", note: "Fireflies and cool light", accent: "#6ee7b7", bg: "linear-gradient(135deg, #06121c, #0b2a3a)", c: { contentWidth: 580, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "gradient", nameColor2: "#60a5fa", particles: "fireflies", particleColor: "#a7f3d0", linkDisplay: "buttons", fontFamily: "bricolage", glowStrength: 24, glowColor: "#6ee7b7", radius: 28, bgDim: 20 } },
    { name: "Paper Light", note: "A bright, calm light theme", accent: "#4f46e5", bg: "linear-gradient(135deg, #f4f4f5, #e4e4f7)", c: { contentWidth: 520, showBanner: false, bannerHeight: 0, cardVAlign: "center", cardStyle: "solid", cardColor: "#ffffff", textColor: "#16161d", mutedColor: "#6b6b7b", borderColor: "#000000", widgetColor: "#000000", shadow: "soft", linkDisplay: "buttons", fontFamily: "instrument", avatarBorder: "accent", bgDim: 0, radius: 22 } }
  ];
  function templatesPanel() {
    var g = E("div", "pe-tpl-grid");
    TEMPLATES.forEach(function (t) {
      var b = E("button", "pe-tpl"); b.type = "button";
      var sw = E("div", "pe-tpl-sw"); sw.style.background = SP.safeBg(t.bg) || "#0b1020"; var i = E("i"); i.style.background = t.c.cardColor ? t.c.cardColor : "rgba(255,255,255,.08)"; i.style.borderColor = t.accent; sw.appendChild(i);
      b.append(sw, E("b", "", t.name), E("small", "", t.note));
      b.addEventListener("click", function () {
        if (serialize() !== saved && !confirm("Apply this template? It replaces your colors, layout and effects (your text, links and media stay).")) return;
        state.customization = Object.assign({}, DEF, t.c); state.accentColor = t.accent; state.background = t.bg;
        buildPanels(); changed(); toast("Applied " + t.name);
      });
      g.appendChild(b);
    });
    return [sec("Templates", "Start from a look, then fine-tune every detail in the other tabs. Your text, links and uploaded media are kept.", g)];
  }
  function toast(t) { say(t, "ok"); setTimeout(function () { changed(); }, 1800); }

  /* ---------------- media: upload + library ---------------- */
  var fileInput = null;
  function kindOf(mime) { return /^image\//.test(mime) ? "image" : /^audio\//.test(mime) ? "audio" : /^video\//.test(mime) ? "video" : ""; }
  function assetsOf(kind) { return assets.filter(function (a) { return a.kind === kind; }); }
  function pickUpload(kind, cb) {
    fileInput = fileInput || $("media-file");
    fileInput.accept = kind === "image" ? "image/png,image/jpeg,image/webp,image/gif,image/avif" : kind === "audio" ? "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/webm" : kind === "video" ? "video/mp4,video/webm,video/quicktime" : fileInput.accept;
    fileInput.onchange = function () { var f = fileInput.files && fileInput.files[0]; fileInput.value = ""; if (f) upload(f, kind, cb); };
    fileInput.click();
  }
  function upload(file, expect, cb) {
    var kind = kindOf(file.type);
    if (!kind || (expect && kind !== expect)) { say("Choose " + (expect === "image" ? "an image" : expect === "audio" ? "an audio" : expect === "video" ? "a video" : "a supported") + " file.", "error"); return; }
    if (file.size > SIZES[kind] * 1048576) { say("This " + kind + " must be under " + SIZES[kind] + " MB.", "error"); return; }
    if (assetsOf(kind).length >= LIMITS[kind]) { say("Free quota reached: " + LIMITS[kind] + " " + kind + " files. Delete one in Media first.", "error"); return; }
    var fd = new FormData(), x = new XMLHttpRequest(); fd.append("file", file, file.name);
    x.open("POST", API + "/profiles/assets/upload"); x.withCredentials = true; x.setRequestHeader("Accept", "application/json");
    x.upload.onprogress = function (e) { if (e.lengthComputable) say("Uploading " + file.name + " " + Math.round(e.loaded / e.total * 100) + "%", "dirty"); };
    x.onerror = function () { say("Upload failed. Check your connection.", "error"); };
    x.onload = function () {
      var j = {}; try { j = JSON.parse(x.responseText); } catch (_) { }
      if (x.status < 200 || x.status >= 300) { say(j.message || j.error || "Upload failed.", "error"); return; }
      assets = j.assets || assets.concat([j.asset]); counts = j.counts || counts; renderLibrary(); say("Upload complete", "ok"); setTimeout(changed, 1500);
      if (cb) cb(j.asset);
    };
    say("Uploading " + file.name + "…", "dirty"); x.send(fd);
  }
  var libraryBoxes = [];
  function renderLibrary() {
    libraryBoxes = libraryBoxes.filter(function (b) { return document.body.contains(b.grid); });
    libraryBoxes.forEach(function (b) {
      var g = b.grid; while (g.firstChild) g.removeChild(g.firstChild);
      ["image", "audio", "video"].forEach(function (k) { var q = b.quota[k]; if (q) q.textContent = assetsOf(k).length + " / " + LIMITS[k]; });
      if (!assets.length) { g.appendChild(E("p", "pe-hint", "No uploads yet. Use Upload next to avatar, banner, background, video or audio.")); return; }
      assets.forEach(function (a) {
        var c = E("div", "pe-asset"), th = E("div", "th");
        if (a.kind === "image") th.style.backgroundImage = "url(" + JSON.stringify(a.url) + ")"; else th.textContent = a.kind === "audio" ? "♫" : "▶";
        var del = btn("Delete", function () {
          if (!confirm("Delete " + a.name + "?")) return;
          api("/profiles/assets/delete", { id: a.id }).then(function (r) { assets = r.assets || assets.filter(function (x) { return x.id !== a.id; }); counts = r.counts || counts; renderLibrary(); say("File deleted", "ok"); })
            .catch(function (e) { say(e.code === "asset_in_use" ? "Remove it from your profile and save before deleting." : (e.message || "Could not delete."), "error"); });
        }, "bad");
        c.append(th, E("div", "nm", a.name), E("div", "mt", a.kind + " · " + (a.size >= 1048576 ? (a.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(a.size / 1024)) + " KB")), E("div", "ac")); c.lastChild.appendChild(del); g.appendChild(c);
      });
    });
  }
  function openSheet(title, hint, body) {
    var sh = $("sheet"); while (sh.firstChild) sh.removeChild(sh.firstChild);
    var h = E("div", "pe-sheet-head"), t = E("div"); t.append(E("h3", "", title), E("p", "pe-hint", hint || "")); h.append(t, btn("Close", closeSheet));
    sh.append(h, body); $("modal").classList.remove("pe-hide");
  }
  function closeSheet() { $("modal").classList.add("pe-hide"); }
  function openLibrary(kind, onPick) {
    var list = assetsOf(kind), body = E("div", "pe-lib");
    if (!list.length) body.appendChild(E("p", "pe-hint", "No " + kind + " uploaded yet."));
    list.forEach(function (a) {
      var c = E("button", "pe-asset"); c.type = "button"; c.style.cursor = "pointer"; c.style.textAlign = "left"; c.style.color = "inherit"; c.style.padding = "0"; c.style.font = "inherit";
      var th = E("div", "th"); if (kind === "image") th.style.backgroundImage = "url(" + JSON.stringify(a.url) + ")"; else th.textContent = kind === "audio" ? "♫" : "▶";
      c.append(th, E("div", "nm", a.name), E("div", "mt", "Tap to use")); c.addEventListener("click", function () { closeSheet(); onPick(a); }); body.appendChild(c);
    });
    var wrap = E("div"); wrap.style.cssText = "display:flex;flex-direction:column;gap:12px"; wrap.append(btn("Upload a new " + kind, function () { closeSheet(); pickUpload(kind, onPick); }, "pri"), body);
    openSheet("Choose " + (kind === "image" ? "an image" : kind === "audio" ? "a track" : "a video"), "From your uploads.", wrap);
  }
  function mediaField(label, key, kind, hint) {
    var f = E("div", "pe-f pe-media-f"), l = E("label", "", label), row = E("div", "pe-row"), th = E("div", "pe-thumb"), inp = E("input"), row2 = E("div", "pe-row");
    inp.type = "url"; inp.placeholder = kind === "video" ? "Uploaded video URL" : "https://… or upload"; inp.maxLength = 700; inp.value = val(key) || ""; inp.inputMode = "url"; inp.autocapitalize = "off";
    function thumb() { var v = inp.value; th.textContent = ""; th.style.backgroundImage = ""; if (kind === "image" && /^https?:\/\//i.test(v)) th.style.backgroundImage = "url(" + JSON.stringify(v) + ")"; else if (kind === "video") th.textContent = v ? "▶" : ""; }
    function setV(v) { inp.value = v; put(key, v); thumb(); }
    inp.addEventListener("input", function () { put(key, inp.value.trim()); thumb(); });
    row.append(th, inp);
    row2.append(btn("Upload", function () { pickUpload(kind, function (a) { setV(a.url); }); }), btn("Library", function () { openLibrary(kind, function (a) { setV(a.url); }); }), btn("Clear", function () { setV(""); }));
    f.append(l, row, row2); if (hint) f.append(E("span", "pe-hint", hint)); thumb(); return f;
  }
  function librarySection() {
    var q = E("div", "pe-quota"), quota = {};
    ["image", "audio", "video"].forEach(function (k) { var d = E("div"), s = E("strong", "", "0 / " + LIMITS[k]); quota[k] = s; d.append(E("span", "", k === "image" ? "Images" : k === "audio" ? "Audio" : "Video"), s); q.appendChild(d); });
    var g = E("div", "pe-lib"); libraryBoxes.push({ grid: g, quota: quota });
    var s = sec("Your uploads", "Free storage: images up to 8 MB, audio up to 15 MB, video up to 45 MB. Files stay private until you use them on your profile.", q, g, btn("Refresh", refreshLibrary));
    setTimeout(renderLibrary, 0); return s;
  }
  function refreshLibrary() { return api("/profiles/assets").then(function (d) { assets = d.assets || []; counts = d.counts || {}; renderLibrary(); }).catch(function (e) { say(e.message || "Media library unavailable.", "error"); }); }

  /* ---------------- links + widgets ---------------- */
  function linksSection() {
    var box = E("div"); box.style.cssText = "display:flex;flex-direction:column;gap:10px";
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      state.links.forEach(function (l, i) {
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"), ico = E("span", "ico"), name = E("strong", "", "Link " + (i + 1));
        function setIcon() { while (ico.firstChild) ico.removeChild(ico.firstChild); ico.appendChild(SP.iconSvg(SP.iconName(l.url || ""))); name.textContent = SP.iconName(l.url || "") || "Link " + (i + 1); }
        setIcon();
        head.append(ico, name, btn("↑", function () { if (i > 0) { state.links.splice(i - 1, 0, state.links.splice(i, 1)[0]); redraw(); changed(); } }), btn("↓", function () { if (i < state.links.length - 1) { state.links.splice(i + 1, 0, state.links.splice(i, 1)[0]); redraw(); changed(); } }), btn("✕", function () { state.links.splice(i, 1); redraw(); changed(); }, "bad"));
        var lab = E("input"), url = E("input"); lab.type = "text"; lab.maxLength = 32; lab.placeholder = "Label (Discord)"; lab.value = l.label || ""; url.type = "url"; url.maxLength = 500; url.placeholder = "https://…"; url.value = l.url || ""; url.inputMode = "url"; url.autocapitalize = "off";
        lab.addEventListener("input", function () { l.label = lab.value; changed(); }); url.addEventListener("input", function () { l.url = url.value.trim(); setIcon(); changed(); });
        it.append(head, lab, url); box.appendChild(it);
      });
      if (!state.links.length) box.appendChild(E("p", "pe-hint", "No links yet."));
    }
    redraw();
    var add = btn("＋ Add link", function () { if (state.links.length >= 12) { say("Maximum 12 links.", "error"); return; } state.links.push({ label: "", url: "" }); redraw(); changed(); });
    return sec("Social links", "Up to 12 links. Brand icons are detected automatically from the address (Discord, TikTok, GitHub, YouTube, Spotify and more).", box, add);
  }
  function widgetsSection() {
    var box = E("div"); box.style.cssText = "display:flex;flex-direction:column;gap:10px";
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      state.widgets.forEach(function (w, i) {
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"), sel = E("select"), title = E("input"), content = E("textarea"), url = E("input");
        [["text", "Text card"], ["quote", "Quote"], ["link", "Link card"]].forEach(function (o) { var op = E("option", "", o[1]); op.value = o[0]; sel.appendChild(op); }); sel.value = ["text", "quote", "link"].indexOf(w.type) >= 0 ? w.type : "text";
        title.type = "text"; title.maxLength = 50; title.placeholder = "Title"; title.value = w.title || ""; content.maxLength = 500; content.placeholder = "Text / quote"; content.value = w.content || ""; content.style.minHeight = "64px";
        url.type = "url"; url.maxLength = 500; url.placeholder = "Link URL"; url.value = w.url || ""; url.inputMode = "url"; url.autocapitalize = "off"; url.classList.toggle("pe-hide", sel.value !== "link");
        sel.addEventListener("change", function () { w.type = sel.value; url.classList.toggle("pe-hide", sel.value !== "link"); changed(); });
        title.addEventListener("input", function () { w.title = title.value; changed(); }); content.addEventListener("input", function () { w.content = content.value; changed(); }); url.addEventListener("input", function () { w.url = url.value.trim(); changed(); });
        head.append(sel, btn("✕", function () { state.widgets.splice(i, 1); redraw(); changed(); }, "bad")); it.append(head, title, content, url); box.appendChild(it);
      });
      if (!state.widgets.length) box.appendChild(E("p", "pe-hint", "No widgets yet."));
    }
    redraw();
    var add = btn("＋ Add widget", function () { if (state.widgets.length >= 8) { say("Maximum 8 widgets.", "error"); return; } state.widgets.push({ type: "text", title: "", content: "", url: "" }); redraw(); changed(); });
    return sec("Widgets", "Text cards, quotes or link cards. Up to 8.", box, add);
  }

  /* ---------------- page background (solid / gradient) ---------------- */
  function parseBg(s) {
    var g = /^linear-gradient\((\d{1,3})deg,\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})/i.exec(s || ""); if (g) return { mode: "gradient", angle: +g[1], c1: g[2], c2: g[3] };
    if (/^#[0-9a-f]{6}$/i.test(s || "")) return { mode: "solid", angle: 135, c1: s, c2: "#29204d" };
    return { mode: "gradient", angle: 135, c1: "#0b1020", c2: "#29204d" };
  }
  function backgroundSection() {
    var b = parseBg(state.background), wrap = E("div"); wrap.style.cssText = "display:flex;flex-direction:column;gap:14px";
    function write() { put("background", b.mode === "solid" ? b.c1 : "linear-gradient(" + b.angle + "deg, " + b.c1 + ", " + b.c2 + ")"); }
    var c1 = E("input"), c2 = E("input"), ang = E("input"), angOut = E("output"), mode = E("div", "pe-seg");
    c1.type = "color"; c1.value = b.c1; c2.type = "color"; c2.value = b.c2; ang.type = "range"; ang.min = 0; ang.max = 360; ang.step = 5; ang.value = b.angle; angOut.textContent = b.angle + "°";
    var f2 = field("Color 2", c2), fa = E("div", "pe-f"), la = E("div", "pe-lab"); la.append(E("span", "", "Gradient angle"), angOut); fa.append(la, ang);
    function sync() { f2.classList.toggle("pe-hide", b.mode === "solid"); fa.classList.toggle("pe-hide", b.mode === "solid"); Array.prototype.forEach.call(mode.children, function (x, i) { x.setAttribute("aria-pressed", String(["solid", "gradient"][i] === b.mode)); }); }
    [["solid", "Solid color"], ["gradient", "Gradient"]].forEach(function (o) { var x = E("button", "", o[1]); x.type = "button"; x.addEventListener("click", function () { b.mode = o[0]; sync(); write(); }); mode.appendChild(x); });
    c1.addEventListener("input", function () { b.c1 = c1.value; write(); }); c2.addEventListener("input", function () { b.c2 = c2.value; write(); }); ang.addEventListener("input", function () { b.angle = +ang.value; angOut.textContent = b.angle + "°"; write(); });
    sync(); wrap.append(field("Style", mode), grid("pe-g2", field("Color 1", c1), f2), fa);
    return sec("Page background", "Shown behind your background image or video (if any).", wrap, mediaField("Background image", "backgroundUrl", "image"), mediaField("Background video (looping, muted)", "backgroundVideoUrl", "video", "Keep clips short and light for fast loading."), tRange("Darken background", "customization.bgDim", 0, 95, 1, "%"), tRange("Blur background image/video", "customization.bgBlur", 0, 24, 1, "px"));
  }

  /* ---------------- audio tracks ---------------- */
  function tracksSection() {
    var box = E("div"); box.style.cssText = "display:flex;flex-direction:column;gap:10px";
    function nameOf(u) { var a = assets.filter(function (x) { return x.url === u; })[0]; return a ? a.name : u; }
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      state.audioAssets.forEach(function (u, i) {
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"); head.append(E("span", "ico", "♫"), E("strong", "", (i + 1) + ". " + nameOf(u)),
          btn("↑", function () { if (i > 0) { state.audioAssets.splice(i - 1, 0, state.audioAssets.splice(i, 1)[0]); redraw(); changed(); } }),
          btn("✕", function () { state.audioAssets.splice(i, 1); redraw(); changed(); }, "bad")); it.appendChild(head); box.appendChild(it);
      });
      if (!state.audioAssets.length) box.appendChild(E("p", "pe-hint", "No tracks selected."));
    }
    function add(a) { if (state.audioAssets.length >= 3) { say("Maximum 3 tracks.", "error"); return; } if (state.audioAssets.indexOf(a.url) < 0) state.audioAssets.push(a.url); redraw(); changed(); }
    redraw();
    var row = E("div", "pe-row"); row.append(btn("Upload track", function () { pickUpload("audio", add); }), btn("Choose from library", function () { openLibrary("audio", add); }));
    return sec("Your tracks", "Up to 3 audio files (MP3, WAV, OGG, M4A). They play in order.", box, row);
  }

  /* ---------------- panels ---------------- */
  var TABS = [
    ["templates", "Templates", templatesPanel],
    ["profile", "Profile", function () {
      return [
        sec("Identity", "Your public address is /u/username.", tText("Username", "username", { max: 24, lower: true, ph: "yourname", hint: "3–24 letters, numbers, hyphens or underscores." }), tText("Display name", "displayName", { max: 40 }),
          tArea("Bio", "bio", { max: 220, ph: "A little about you…" }), grid("pe-g2", tText("Status", "status", { max: 80, ph: "Building Sentinel" }), tText("Status emoji", "statusEmoji", { max: 8, ph: "✨" })), tColor("Accent color", "accentColor", "#8b7cff")),
        sec("Details", "Small touches that make the page feel personal.", tText("Tagline", "customization.tagline", { max: 160, ph: "dev | gamer | security", hint: "Separate several phrases with | to rotate them." }),
          tToggle("Typewriter tagline", "customization.taglineTypewriter", "Types and deletes your tagline phrases."), tToggle("Typewriter bio", "customization.bioTypewriter", "Types your bio once when the page opens."),
          tText("Location", "customization.location", { max: 40, ph: "Paris, France" }))
      ];
    }],
    ["media", "Media", function () {
      return [sec("Images", "Upload from your phone or paste a direct HTTPS address.", mediaField("Avatar", "avatarUrl", "image"), mediaField("Banner (optional)", "bannerUrl", "image", "Set Banner height to 0 in Style to hide the banner area.")), librarySection()];
    }],
    ["links", "Links", function () {
      return [linksSection(),
        sec("How links look", null, tSeg("Display", "customization.linkDisplay", [["buttons", "Buttons"], ["icons", "Icons only"], ["chips", "Chips"]]),
          tSeg("Icon color", "customization.iconColorMode", [["brand", "Brand"], ["accent", "Accent"], ["text", "Text"]]), tRange("Icon size", "customization.iconSize", 16, 48, 1, "px"),
          tSeg("Button style", "customization.linkStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"], ["minimal", "Minimal"]]), tRange("Corner radius", "customization.linkRadius", 0, 30, 1, "px")),
        widgetsSection(), sec("Widget layout", null, tSeg("Columns", "customization.widgetColumns", [["1", "1"], ["2", "2"], ["3", "3"]]), tSeg("Style", "customization.widgetStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"]]), tRange("Spacing", "customization.widgetGap", 6, 28, 1, "px"))];
    }],
    ["style", "Style", function () {
      return [backgroundSection(),
        sec("Card", null, tSeg("Style", "customization.cardStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"], ["minimal", "None"]]), tRange("Width", "customization.contentWidth", 320, 1200, 10, "px"), tRange("Corner radius", "customization.radius", 0, 40, 1, "px"),
          tRange("Glass blur", "customization.blur", 0, 40, 1, "px"), tRange("Card opacity", "customization.cardOpacity", 0, 100, 1, "%"), grid("pe-g2", tColor("Card color", "customization.cardColor", "#0b1020"), tColor("Border color", "customization.borderColor", "#ffffff")),
          tSeg("Border", "customization.borderStyle", [["none", "None"], ["subtle", "Subtle"], ["accent", "Accent"]]), tSeg("Shadow", "customization.shadow", [["none", "None"], ["soft", "Soft"], ["deep", "Deep"], ["colored", "Colored"]])),
        sec("Colors & text", null, grid("pe-g2", tColor("Text", "customization.textColor", "#f5f7ff"), tColor("Muted text", "customization.mutedColor", "#98a6bf")), tColor("Links & widgets tint", "customization.widgetColor", "#ffffff"),
          tSelect("Font", "customization.fontFamily", [["system", "System"], ["inter", "Inter"], ["instrument", "Instrument Sans"], ["bricolage", "Bricolage Grotesque"], ["mono", "JetBrains Mono"], ["serif", "Serif"]]),
          tRange("Name size", "customization.nameSize", 24, 72, 1, "px"), tSeg("Letter spacing", "customization.letterSpacing", [["tight", "Tight"], ["normal", "Normal"], ["wide", "Wide"]]), tRange("Bio size", "customization.bioSize", 12, 22, 1, "px")),
        sec("Avatar & banner", null, tSeg("Avatar shape", "customization.avatarShape", [["circle", "Circle"], ["rounded", "Rounded"], ["square", "Square"]]), tRange("Avatar size", "customization.avatarSize", 64, 200, 2, "px"),
          tSeg("Avatar border", "customization.avatarBorder", [["accent", "Accent"], ["white", "White"], ["none", "None"]]), tRange("Banner height (0 = none)", "customization.bannerHeight", 0, 360, 10, "px"),
          tSeg("Banner focus", "customization.bannerPosition", [["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]), tSeg("Banner shade", "customization.bannerOverlay", [["none", "None"], ["soft", "Soft"], ["strong", "Strong"]])),
        sec("Layout", null, tSeg("Layout", "customization.layout", [["centered", "Centered"], ["left", "Left"], ["wide", "Wide"]]), tSeg("Text alignment", "customization.alignment", [["center", "Center"], ["left", "Left"]]),
          tSeg("Vertical position", "customization.cardVAlign", [["top", "Top"], ["center", "Middle"]]), tSeg("Spacing", "customization.spacing", [["compact", "Compact"], ["normal", "Normal"], ["relaxed", "Relaxed"]]),
          tSeg("Badge style", "customization.badgeStyle", [["pill", "Pill"], ["square", "Square"], ["minimal", "Minimal"]]))];
    }],
    ["effects", "Effects", function () {
      return [
        sec("Enter screen", "A full-screen “click to enter” overlay. It also lets your music start automatically.", tToggle("Enable enter screen", "customization.splashEnabled"), tText("Text", "customization.splashText", { max: 40, ph: "click to enter" })),
        sec("Name & avatar", null, tSelect("Name effect", "customization.nameEffect", [["none", "None"], ["glow", "Glow"], ["gradient", "Gradient"], ["shimmer", "Shimmer"], ["neon", "Neon"], ["glitch", "Glitch"]]), tColor("Second name color", "customization.nameColor2", "#ffffff"),
          tSelect("Avatar effect", "customization.avatarEffect", [["none", "None"], ["glow", "Glow"], ["pulse", "Pulse"], ["spin", "Spinning ring"]])),
        sec("Card glow", null, tRange("Glow strength", "customization.glowStrength", 0, 80, 1), tColor("Glow color", "customization.glowColor", "#8b7cff")),
        sec("Particles", "Animated background. Turned off automatically for visitors who reduce motion.", tSelect("Type", "customization.particles", [["none", "None"], ["snow", "Snow"], ["stars", "Stars"], ["embers", "Embers"], ["rain", "Rain"], ["fireflies", "Fireflies"], ["bubbles", "Bubbles"]]),
          tRange("Amount", "customization.particleDensity", 10, 100, 1, "%"), tColor("Color", "customization.particleColor", "#ffffff")),
        sec("Cursor & interaction", "Cursor effects only appear on computers with a mouse.", tSeg("Cursor", "customization.cursorStyle", [["default", "Default"], ["dot", "Dot"], ["ring", "Ring"], ["crosshair", "Cross"]]), tColor("Cursor color", "customization.cursorColor", "#ffffff"),
          tSeg("Mouse trail", "customization.cursorTrail", [["none", "None"], ["dots", "Dots"], ["sparkles", "Sparkles"]]), tToggle("3D tilt on hover", "customization.tilt")),
        sec("Motion", null, tSeg("Entrance", "customization.animation", [["none", "None"], ["fade", "Fade"], ["rise", "Rise"], ["zoom", "Zoom"], ["blur", "Blur"]]), tSeg("Card hover", "customization.hoverEffect", [["none", "None"], ["lift", "Lift"], ["glow", "Glow"], ["scale", "Scale"]]))
      ];
    }],
    ["audio", "Audio", function () {
      return [tracksSection(),
        sec("Player", null, tSeg("Player style", "customization.playerStyle", [["card", "In card"], ["bar", "Floating bar"], ["minimal", "Mini button"], ["hidden", "Hidden"]]), tRange("Volume", "customization.audioVolume", 0, 100, 1, "%"),
          tToggle("Loop playlist", "customization.audioLoop"), tToggle("Start automatically", "customization.audioAutoplay", "Browsers only allow sound after a click, so pair this with the enter screen.")),
        sec("Streaming embed", "Optional YouTube or Spotify player under your links.", tText("YouTube / Spotify URL", "musicUrl", { url: true, max: 500, ph: "https://open.spotify.com/track/…" }))];
    }],
    ["visibility", "Visibility", function () {
      var T = function (l, k) { return tToggle(l, "customization." + k); };
      return [sec("Show on your page", null, T("Avatar", "showAvatar"), T("Username (@handle)", "showHandle"), T("Banner", "showBanner"), T("Badges", "showBadges"), T("Bio", "showBio"), T("Status", "showStatus"), T("Location", "showLocation"), T("Join date", "showJoined"), T("Links", "showLinks"), T("Widgets", "showWidgets"), T("Music", "showMusic")),
        sec("Footer & browser tab", null, T("Footer", "showFooter"), T("View counter", "showViews"), T("“Made with Sentinel”", "showBranding"), tText("Footer text", "customization.footerText", { max: 100 }), tText("Browser tab title", "customization.pageTitle", { max: 60, ph: "Zodiak (@zodiak)" }))];
    }]
  ];

  function buildPanels() {
    libraryBoxes = [];
    var tabs = $("tabs"), panels = $("panels"); while (tabs.firstChild) tabs.removeChild(tabs.firstChild); while (panels.firstChild) panels.removeChild(panels.firstChild);
    TABS.forEach(function (t) {
      var b = E("button", "pe-tab", t[1]); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.tab = t[0]; b.setAttribute("aria-selected", String(t[0] === activeTab));
      b.addEventListener("click", function () { showTab(t[0]); b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }); tabs.appendChild(b);
      var p = E("div", "pe-panel" + (t[0] === activeTab ? " on" : "")); p.id = "panel-" + t[0]; t[2]().forEach(function (s) { p.appendChild(s); }); panels.appendChild(p);
    });
  }
  function showTab(k) {
    activeTab = k;
    Array.prototype.forEach.call($("tabs").children, function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === k)); });
    Array.prototype.forEach.call($("panels").children, function (p) { p.classList.toggle("on", p.id === "panel-" + k); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- preview chrome ---------------- */
  function pvActive() { return window.innerWidth >= 980 || document.body.classList.contains("show-pv"); }
  function syncPv() { if (view) view.setPaused(!pvActive()); }
  $("bar-pv").addEventListener("click", function () { var on = document.body.classList.toggle("show-pv"); $("bar-pv").textContent = on ? "Edit" : "Preview"; syncPv(); if (on) window.scrollTo(0, 0); });
  $("pv-device").addEventListener("click", function () { phone = !phone; $("pv-frame").classList.toggle("phone", phone); $("pv-device").textContent = phone ? "Desktop view" : "Mobile view"; });
  $("pv-splash").addEventListener("click", function () { if (view) view.showSplash(); });
  window.addEventListener("resize", syncPv);
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("beforeunload", function (e) { if (state && serialize() !== saved) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------------- save / revert ---------------- */
  function usedMediaIds() {
    var used = [state.avatarUrl, state.bannerUrl, state.backgroundUrl, state.backgroundVideoUrl].concat(state.audioAssets);
    return assets.filter(function (a) { return used.indexOf(a.url) >= 0; }).map(function (a) { return a.id; });
  }
  async function save() {
    if (saving) return;
    if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(state.username)) { say("Username: 3–24 lowercase letters, numbers, - or _.", "error"); showTab("profile"); return; }
    saving = true; $("save-profile").disabled = true; $("save-profile").textContent = "Saving…"; say("Saving…", "dirty");
    var payload = clone(state); payload.mediaAssets = usedMediaIds(); payload.links = state.links.filter(function (l) { return l.label && l.url; }); payload.widgets = state.widgets.filter(function (w) { return w.title || w.content || w.url; });
    try {
      var r = await api("/profiles/save", payload);
      serverProfile = r.profile; var link = $("open-profile"); link.href = "/u/" + r.profile.username; link.hidden = false;
      state.username = r.profile.username; saved = serialize(); savedState = clone(state);
      say("Saved · " + location.host + "/u/" + r.profile.username, "ok");
    } catch (e) {
      say(e.code === "username_taken" ? "That username is already taken." : e.code === "unauthenticated" ? "Session expired. Sign in again." : (e.message || "Could not save."), "error");
    } finally { saving = false; $("save-profile").disabled = false; $("save-profile").textContent = "Save profile"; }
  }
  $("save-profile").addEventListener("click", save);
  $("reset-profile").addEventListener("click", function () {
    if (serialize() === saved) return; if (!confirm("Discard unsaved changes?")) return;
    state = clone(savedState); buildPanels(); view.update(previewProfile()); changed();
  });

  /* ---------------- boot ---------------- */
  async function init() {
    var msg = $("auth-message");
    if (!API) { msg.textContent = "Account API is not configured."; msg.className = "pe-status error"; return; }
    try {
      account = await api("/account/me");
      if (!account.verified) { msg.textContent = "Verify your email before publishing a profile."; msg.className = "pe-status error"; return; }
      var data = await api("/profiles/me"); serverProfile = data.profile;
      try { var m = await api("/profiles/assets"); assets = m.assets || []; counts = m.counts || {}; } catch (_) { }
      state = fromProfile(data.profile, account); saved = data.profile ? serialize() : ""; savedState = clone(state);
      if (data.profile) { var l = $("open-profile"); l.href = "/u/" + data.profile.username; l.hidden = false; }
      msg.classList.add("pe-hide"); $("app").classList.remove("pe-hide"); $("bar").classList.remove("pe-hide");
      activeTab = data.profile ? "profile" : "templates"; buildPanels();
      view = SP.mount($("pv"), previewProfile(), { preview: true }); syncPv(); changed();
    } catch (e) {
      msg.className = "pe-status error"; msg.textContent = e.code === "unauthenticated" ? "Please sign in to your Sentinel account first. " : "Could not load your profile: " + e.message + " ";
      var a = E("a", "pe-btn pri", "Go to account sign in"); a.href = "/account"; msg.appendChild(a);
    }
  }
  init();
})();

