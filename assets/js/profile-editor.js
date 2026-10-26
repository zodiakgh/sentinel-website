/* Sentinel profile editor. Talks to the Worker (same routes as before) and renders the live preview
 * with the exact same renderer as the public page (profile-render.js). */
(function () {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var SP = window.SentinelProfile, DEF = SP.DEFAULTS;
  var $ = function (id) { return document.getElementById(id); };
  var LIMITS = { image: 5, audio: 3, video: 3 }, SIZES = { image: 8, audio: 15, video: 45 };
  var state = null, saved = "", savedState = null, assets = [], counts = {}, view = null, account = null, serverProfile = null, badgeData = { all: [], catalog: [], isOwner: false };
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
  var KEYS = ["username", "displayName", "bio", "status", "statusEmoji", "accentColor", "avatarUrl", "bannerUrl", "backgroundUrl", "background", "musicUrl", "backgroundVideoUrl", "audioAssets", "audioMeta", "links", "widgets", "customization", "hiddenBadges"];
  function serialize() { var o = {}; KEYS.forEach(function (k) { o[k] = state[k]; }); return JSON.stringify(o); }
  function fromProfile(p, acc) {
    var base = { username: "", displayName: "", bio: "", status: "", statusEmoji: "✨", accentColor: "#8b7cff", avatarUrl: "", bannerUrl: "", backgroundUrl: "", background: "linear-gradient(135deg, #0b1020, #29204d)", musicUrl: "", backgroundVideoUrl: "", audioAssets: [], audioMeta: [], links: [], widgets: [], customization: {} };
    if (!p) {
      var local = (acc.email || "member").split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      base.username = local.length >= 3 ? local : "member" + local; base.displayName = (acc.discord && acc.discord.name) || (acc.email || "").split("@")[0];
      base.avatarUrl = (acc.discord && acc.discord.avatarUrl) || "";
      base.links = [{ label: "Discord", url: "https://discord.com" }];
      base.hiddenBadges = []; base.customization = Object.assign({}, DEF, TEMPLATES[0].c); base.accentColor = TEMPLATES[0].accent; base.background = TEMPLATES[0].bg;
      return base;
    }
    KEYS.forEach(function (k) { if (p[k] !== undefined && p[k] !== null) base[k] = clone(p[k]); });
    base.customization = Object.assign({}, DEF, p.customization || {}); if (!Array.isArray(base.hiddenBadges)) base.hiddenBadges = [];
    return base;
  }
  function val(path) {
    var ks = path.split("."), o = state; for (var i = 0; i < ks.length && o !== undefined && o !== null; i++) o = o[ks[i]];
    if ((o === undefined || o === null) && ks[0] === "customization") return DEF[ks[1]];
    return o;
  }
  function put(path, v) { var ks = path.split("."), last = ks.pop(), o = state; ks.forEach(function (k) { o = o[k]; }); o[last] = v; changed(); }

  var embedRefresh = null;
  function changed() {
    if (embedRefresh) embedRefresh();
    clearTimeout(pvTimer); pvTimer = setTimeout(function () { if (view) view.update(previewProfile()); }, 90);
    var dirty = serialize() !== saved;
    if (!saving) say(dirty ? "Unsaved changes" : "All changes saved", dirty ? "dirty" : "ok");
  }
  var steamInfo = null, steamLinked = false;
  function previewProfile() {
    var hid = state.hiddenBadges || [], badges = [];
    if (badgeData.all.length) badges = badgeData.all.filter(function (b) { return hid.indexOf(b.id) < 0; });
    else {
      if (account && account.verified) badges.push({ id: "verified", label: "Verified", icon: "✅", color: "#3ba55d", tier: "core" });
      if (account && account.discord) badges.push({ id: "discord", label: "Discord linked", icon: "🔗", color: "#5865f2", tier: "core" });
    }
    var p = clone(state); p.badges = badges; p.views = serverProfile ? serverProfile.views || 0 : 0; p.createdAt = serverProfile ? serverProfile.createdAt : Date.now();
    if (state.customization && state.customization.showSteam && steamInfo) p.steam = steamInfo;
    if (!p.avatarUrl && account && account.discord) p.avatarUrl = account.discord.avatarUrl || "";
    return p;
  }

  /* ---------------- control builders ---------------- */
  function field(label, input, hint) { var f = E("div", "pe-f"), l = E("label", "", label); f.append(l, input); if (hint) f.append(E("span", "pe-hint", hint)); return f; }
  function tText(label, path, o) {
    o = o || {}; var i = E("input"); i.type = o.url ? "url" : "text"; i.maxLength = o.max || 200; i.placeholder = o.ph || ""; i.value = val(path) || ""; if (o.readonly) { i.readOnly = true; i.style.opacity = ".6"; }
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
    { name: "Paper Light", note: "A bright, calm light theme", accent: "#4f46e5", bg: "linear-gradient(135deg, #f4f4f5, #e4e4f7)", c: { contentWidth: 520, showBanner: false, bannerHeight: 0, cardVAlign: "center", cardStyle: "solid", cardColor: "#ffffff", textColor: "#16161d", mutedColor: "#6b6b7b", borderColor: "#000000", widgetColor: "#000000", shadow: "soft", linkDisplay: "buttons", fontFamily: "instrument", avatarBorder: "accent", bgDim: 0, radius: 22 } },
    { name: "Halloween", note: "Pumpkin orange, embers", accent: "#ff7a1a", bg: "linear-gradient(135deg, #0d0605, #2a0f03)", c: { contentWidth: 540, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "glow", particles: "embers", bgVignette: 60, cardPattern: "scanlines", animatedBorder: true, staggerIn: true } },
    { name: "Christmas", note: "Snow, red and green", accent: "#ef4444", bg: "linear-gradient(135deg, #07140d, #1d0a0d)", c: { contentWidth: 540, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "gradient", nameColor2: "#34d399", particles: "snow", bgVignette: 45, staggerIn: true, glowColor: "#ef4444" } },
    { name: "Autumn", note: "Falling leaves, warm tones", accent: "#e8833a", bg: "linear-gradient(135deg, #140a05, #2e1608)", c: { contentWidth: 540, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "shimmer", nameColor2: "#fbd38d", particles: "leaves", bgGrain: true, bgVignette: 50, staggerIn: true } },
    { name: "Cyberpunk", note: "Grid, neon, glitch", accent: "#f0abfc", bg: "linear-gradient(135deg, #07030f, #1a0638)", c: { contentWidth: 560, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameEffect: "glitch", cardPattern: "grid", animatedBorder: true, linkHover: "glow", particles: "stars", cursorTrail: "sparkles", radius: 8 } },
    { name: "Royal Gold", note: "Black and gold, serif", accent: "#f5c542", bg: "linear-gradient(135deg, #0a0805, #1a1306)", c: { contentWidth: 520, showBanner: false, bannerHeight: 0, cardVAlign: "center", nameFont: "serif", nameWeight: 800, nameEffect: "shimmer", nameColor2: "#fff1b8", avatarBorderColor: "#f5c542", avatarBorderWidth: 5, animatedBorder: true, bgVignette: 55, bgGrain: true } }
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
    function move(arr, i, d, redraw) { var j = i + d; if (j < 0 || j >= arr.length) return; arr.splice(j, 0, arr.splice(i, 1)[0]); redraw(); changed(); }
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      state.links.forEach(function (l, i) {
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"), ico = E("span", "ico"), name = E("strong", "");
        var isHead = l.kind === "header";
        function setIcon() { while (ico.firstChild) ico.removeChild(ico.firstChild); if (isHead) { ico.textContent = "≡"; name.textContent = "Section title"; return; } ico.appendChild(SP.iconSvg(SP.iconName(l.url || ""))); name.textContent = SP.iconName(l.url || "") || "Link " + (i + 1); }
        setIcon();
        head.append(ico, name, btn("↑", function () { move(state.links, i, -1, redraw); }), btn("↓", function () { move(state.links, i, 1, redraw); }), btn("✕", function () { state.links.splice(i, 1); redraw(); changed(); }, "bad"));
        it.appendChild(head);
        var lab = E("input"); lab.type = "text"; lab.maxLength = 40; lab.placeholder = isHead ? "Section name (Socials, Projects…)" : "Label (Discord)"; lab.value = l.label || "";
        lab.addEventListener("input", function () { l.label = lab.value; changed(); }); it.appendChild(lab);
        if (!isHead) {
          var url = E("input"); url.type = "url"; url.maxLength = 500; url.placeholder = "https://…"; url.value = l.url || ""; url.inputMode = "url"; url.autocapitalize = "off";
          url.addEventListener("input", function () { l.url = url.value.trim(); setIcon(); changed(); });
          var row = E("div", "pe-g2"), emo = E("input"), desc = E("input");
          emo.type = "text"; emo.maxLength = 4; emo.placeholder = "Emoji (optional)"; emo.value = l.icon || ""; emo.addEventListener("input", function () { l.icon = emo.value; changed(); });
          desc.type = "text"; desc.maxLength = 80; desc.placeholder = "Short description (optional)"; desc.value = l.desc || ""; desc.addEventListener("input", function () { l.desc = desc.value; changed(); });
          row.append(emo, desc);
          var ft = E("button", "pe-tg"), t = E("div"); ft.type = "button"; ft.setAttribute("role", "switch"); t.append(E("span", "", "Highlight this link ★")); ft.append(t, E("span", "pe-sw")); ft.setAttribute("aria-checked", String(!!l.featured));
          ft.addEventListener("click", function () { l.featured = !l.featured; ft.setAttribute("aria-checked", String(l.featured)); changed(); });
          it.append(url, row, ft);
        }
        box.appendChild(it);
      });
      if (!state.links.length) box.appendChild(E("p", "pe-hint", "No links yet."));
    }
    redraw();
    var add = btn("＋ Add link", function () { if (state.links.length >= 20) { say("Maximum 20 entries.", "error"); return; } state.links.push({ label: "", url: "" }); redraw(); changed(); });
    var addH = btn("＋ Add section title", function () { if (state.links.length >= 20) { say("Maximum 20 entries.", "error"); return; } state.links.push({ kind: "header", label: "" }); redraw(); changed(); });
    var rowb = E("div", "pe-g2"); rowb.append(add, addH);
    return sec("Links", "Up to 20 entries. Brand icons are detected from the address; add an emoji, a short description or a highlight, and group links under section titles.", box, rowb);
  }
  var WTYPES = [["text", "Text card"], ["quote", "Quote"], ["link", "Link card"], ["gallery", "Photo gallery"], ["countdown", "Countdown"], ["stats", "Stats"]];
  var WHINT = { text: "Text", quote: "Quote", link: "Text under the title", gallery: "One HTTPS image address per line (up to 6)", countdown: "Date: 2027-01-01 or 2027-01-01T20:00", stats: "One per line: Label|Value  (e.g. Followers|12k)" };
  function widgetsSection() {
    var box = E("div"); box.style.cssText = "display:flex;flex-direction:column;gap:10px";
    function redraw() {
      while (box.firstChild) box.removeChild(box.firstChild);
      state.widgets.forEach(function (w, i) {
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"), sel = E("select"), title = E("input"), content = E("textarea"), url = E("input");
        WTYPES.forEach(function (o) { var op = E("option", "", o[1]); op.value = o[0]; sel.appendChild(op); }); sel.value = WTYPES.some(function (o) { return o[0] === w.type; }) ? w.type : "text";
        title.type = "text"; title.maxLength = 50; title.placeholder = "Title"; title.value = w.title || ""; content.maxLength = 1500; content.value = w.content || ""; content.style.minHeight = "64px";
        url.type = "url"; url.maxLength = 500; url.placeholder = "Link URL"; url.value = w.url || ""; url.inputMode = "url"; url.autocapitalize = "off";
        var sync = function () { content.placeholder = WHINT[sel.value] || ""; url.classList.toggle("pe-hide", sel.value !== "link"); }; sync();
        sel.addEventListener("change", function () { w.type = sel.value; sync(); changed(); });
        title.addEventListener("input", function () { w.title = title.value; changed(); }); content.addEventListener("input", function () { w.content = content.value; changed(); }); url.addEventListener("input", function () { w.url = url.value.trim(); changed(); });
        head.append(sel, btn("↑", function () { if (i > 0) { state.widgets.splice(i - 1, 0, state.widgets.splice(i, 1)[0]); redraw(); changed(); } }), btn("↓", function () { if (i < state.widgets.length - 1) { state.widgets.splice(i + 1, 0, state.widgets.splice(i, 1)[0]); redraw(); changed(); } }), btn("✕", function () { state.widgets.splice(i, 1); redraw(); changed(); }, "bad"));
        it.append(head, title, content, url); box.appendChild(it);
      });
      if (!state.widgets.length) box.appendChild(E("p", "pe-hint", "No widgets yet."));
    }
    redraw();
    var add = btn("＋ Add widget", function () { if (state.widgets.length >= 10) { say("Maximum 10 widgets.", "error"); return; } state.widgets.push({ type: "text", title: "", content: "", url: "" }); redraw(); changed(); });
    return sec("Widgets", "Text, quotes, link cards, photo galleries, countdowns and stats. Up to 10.", box, add);
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
      state.audioMeta = Array.isArray(state.audioMeta) ? state.audioMeta : [];
      while (state.audioMeta.length < state.audioAssets.length) state.audioMeta.push({ title: "", artist: "", cover: "" });
      state.audioMeta.length = state.audioAssets.length;
      state.audioAssets.forEach(function (u, i) {
        var m = state.audioMeta[i] = state.audioMeta[i] || { title: "", artist: "", cover: "" };
        var it = E("div", "pe-item"), head = E("div", "pe-item-head"); head.append(E("span", "ico", "♫"), E("strong", "", (i + 1) + ". " + nameOf(u)),
          btn("↑", function () { if (i > 0) { state.audioAssets.splice(i - 1, 0, state.audioAssets.splice(i, 1)[0]); state.audioMeta.splice(i - 1, 0, state.audioMeta.splice(i, 1)[0]); redraw(); changed(); } }),
          btn("✕", function () { state.audioAssets.splice(i, 1); state.audioMeta.splice(i, 1); redraw(); changed(); }, "bad")); it.appendChild(head);
        function inp(label, key, ph, url) { var x = E("input"); x.type = url ? "url" : "text"; x.maxLength = url ? 700 : 60; x.placeholder = ph; x.value = m[key] || ""; if (url) { x.inputMode = "url"; x.autocapitalize = "off"; } x.addEventListener("input", function () { m[key] = x.value; changed(); }); return field(label, x); }
        var cov = inp("Cover image URL", "cover", "https://…", true);
        it.append(inp("Title", "title", "Song title"), inp("Artist", "artist", "Artist name"), cov);
        var pick = E("div", "pe-row"); pick.append(btn("Pick cover from library", function () { openLibrary("image", function (a) { m.cover = a.url; redraw(); changed(); }); }), m.cover ? btn("Remove cover", function () { m.cover = ""; redraw(); changed(); }, "bad") : E("span"));
        it.appendChild(pick);
        var ta = E("textarea"); ta.rows = 5; ta.maxLength = 6000; ta.placeholder = "Lyrics. Plain text, or synced lines like [00:12.50] first line"; ta.value = m.lyrics || ""; ta.style.cssText = "width:100%;min-height:90px;font-family:inherit";
        ta.addEventListener("input", function () { m.lyrics = ta.value; changed(); });
        var lmsg = E("span", "pe-hint", m.lyrics ? "" : "Fill title and artist, then find lyrics automatically or paste your own."), lrow = E("div", "pe-row");
        lrow.append(btn("Find lyrics automatically", function () {
          if (!String(m.title || "").trim()) { lmsg.textContent = "Enter the title first."; return; }
          lmsg.textContent = "Searching…";
          api("/lyrics/search?" + new URLSearchParams({ title: m.title || "", artist: m.artist || "" }).toString()).then(function (j) { m.lyrics = j.lyrics || ""; ta.value = m.lyrics; changed(); lmsg.textContent = (j.isSynced ? "Synced lyrics found" : "Lyrics found") + " for “" + (j.title || m.title) + "”" + (j.artist ? " by " + j.artist : "") + ". You can edit them."; })
            .catch(function (e) { lmsg.textContent = e.message || "Lookup failed."; });
        }), m.lyrics ? btn("Clear", function () { m.lyrics = ""; ta.value = ""; changed(); lmsg.textContent = ""; }, "bad") : E("span"));
        it.append(field("Lyrics", ta), lrow, lmsg); box.appendChild(it);
      });
      if (!state.audioAssets.length) box.appendChild(E("p", "pe-hint", "No tracks selected."));
    }
    function add(a) { if (state.audioAssets.length >= 3) { say("Maximum 3 tracks.", "error"); return; } if (state.audioAssets.indexOf(a.url) < 0) { state.audioAssets.push(a.url); state.audioMeta = state.audioMeta || []; state.audioMeta.push({ title: String(a.name || "").replace(/\.[a-z0-9]{2,4}$/i, "").slice(0, 60), artist: "", cover: "" }); } redraw(); changed(); }
    redraw();
    var row = E("div", "pe-row"); row.append(btn("Upload track", function () { pickUpload("audio", add); }), btn("Choose from library", function () { openLibrary("audio", add); }));
    return sec("Your tracks", "Up to 3 audio files (MP3, WAV, OGG, M4A). They play in order. Set a title, artist and cover for each.", box, row);
  }


  /* ---------------- badges + admin ---------------- */
  function badgesPanel() {
    var out = [], hid = function () { return state.hiddenBadges || (state.hiddenBadges = []); };
    var owned = {}; badgeData.all.forEach(function (b) { owned[b.id] = true; });
    var box = E("div", "pe-bd-list");
    (badgeData.catalog.length ? badgeData.catalog : badgeData.all).forEach(function (b) {
      var has = !!owned[b.id], row = E("div", "pe-bd" + (has ? "" : " locked"));
      var ic = E("span", "pe-bd-ic", b.icon || "•"); ic.style.setProperty("--bc", b.color || "#8b7cff");
      var tx = E("div", "pe-bd-tx"); tx.append(E("b", "", b.label), E("small", "", has ? (b.desc || "") : (b.how || b.desc || "Locked")));
      row.append(ic, tx);
      if (has) {
        var t = E("button", "pe-btn", hid().indexOf(b.id) < 0 ? "Shown" : "Hidden"); t.type = "button";
        t.addEventListener("click", function () { var h = hid(), i = h.indexOf(b.id); if (i < 0) h.push(b.id); else h.splice(i, 1); t.textContent = i < 0 ? "Hidden" : "Shown"; changed(); });
        row.appendChild(t);
      } else row.appendChild(E("span", "pe-bd-lock", "🔒"));
      box.appendChild(row);
    });
    out.push(sec("Your badges", "Badges are awarded by Sentinel and cannot be edited. Hide the ones you don't want on your page. Event badges are earned by saving your profile while the event is running.", box));
    out.push(sec("Badge display", null, tSeg("Style", "customization.badgeStyle", [["pill", "Pill"], ["square", "Square"], ["minimal", "Minimal"], ["icons", "Icons"]]), tToggle("Show badges", "customization.showBadges")));
    if (badgeData.isOwner) out.push(adminSection());
    return out;
  }
  function adminSection() {
    var u = E("input"); u.placeholder = "username"; u.autocapitalize = "off"; u.maxLength = 24;
    var sel = E("select"); (badgeData.catalog || []).forEach(function (b) { if (b.kind === "auto") return; var o = E("option", "", (b.icon || "") + " " + b.label); o.value = b.id; sel.appendChild(o); });
    var msg = E("p", "pe-hint", "");
    var run = function (action) {
      var name = u.value.trim().toLowerCase().replace(/^@/, ""); if (!name) { msg.textContent = "Enter a username."; return; }
      msg.textContent = "Working…";
      api("/admin/badge", { username: name, badge: sel.value, action: action }).then(function () { msg.textContent = (action === "grant" ? "Granted " : "Revoked ") + sel.value + " for @" + name + "."; })
        .catch(function (e) { msg.textContent = "Failed: " + (e.message || e.code); });
    };
    var look = function () {
      var name = u.value.trim().toLowerCase().replace(/^@/, ""); if (!name) return; msg.textContent = "Looking up…";
      fetch(API + "/admin/lookup?username=" + encodeURIComponent(name), { credentials: "include" }).then(function (r) { return r.json(); })
        .then(function (j) { msg.textContent = j.error ? "Failed: " + j.error : "@" + name + " badges: " + ((j.badges || []).map(function (b) { return b.id || b; }).join(", ") || "none"); }).catch(function () { msg.textContent = "Lookup failed."; });
    };
    return sec("Owner tools", "Only you can see this. Grant or revoke manual badges (Co-Owner, Admin, Partner, Christmas, …).", field("Username", u), field("Badge", sel), grid("pe-g2", btn("Grant", function () { run("grant"); }, "pri"), btn("Revoke", function () { run("revoke"); })), btn("Look up user", look), msg);
  }


  function toolsSection() {
    var ta = E("textarea"); ta.placeholder = "Paste a design here to import it…"; ta.style.minHeight = "90px";
    var msg = E("p", "pe-hint", "");
    var exp = btn("Copy my design", function () {
      var d = JSON.stringify({ accentColor: state.accentColor, background: state.background, customization: state.customization });
      var done = function () { msg.textContent = "Design copied. Share it, then paste it into another profile."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d).then(done, function () { ta.value = d; ta.select(); msg.textContent = "Copy the text above."; }); else { ta.value = d; ta.select(); msg.textContent = "Copy the text above."; }
    });
    var imp = btn("Import design", function () {
      try {
        var d = JSON.parse(ta.value); if (!d || typeof d !== "object") throw 0;
        if (/^#[0-9a-f]{6}$/i.test(d.accentColor || "")) state.accentColor = d.accentColor;
        if (typeof d.background === "string") state.background = d.background.slice(0, 200);
        if (d.customization && typeof d.customization === "object") { Object.keys(d.customization).forEach(function (k) { if (k in DEF) state.customization[k] = d.customization[k]; }); }
        buildPanels(); changed(); if (view) view.update(previewProfile()); msg.textContent = "Design imported. Review it, then save.";
      } catch (e) { msg.textContent = "That doesn't look like a Sentinel design."; }
    });
    var copyLink = btn("Copy my profile link", function () {
      var u = location.origin + "/u/" + state.username; var done = function () { msg.textContent = "Copied " + u; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { msg.textContent = u; }); else msg.textContent = u;
    });
    var g = E("div", "pe-g2"); g.append(exp, imp);
    return sec("Tools", "Share your look with friends, or copy someone else's.", g, ta, copyLink, msg);
  }


  /* ---------------- link preview (Discord embed) ---------------- */
  function embedPanel() {
    var prev = E("div", "pe-embed"), bar = E("div", "pe-embed-bar"), body = E("div", "pe-embed-body"), site = E("div", "pe-embed-site", "Sentinel"), ttl = E("div", "pe-embed-title"), dsc = E("div", "pe-embed-desc"), img = E("img", "pe-embed-img");
    img.alt = ""; img.referrerPolicy = "no-referrer";
    body.append(site, ttl, dsc, img); prev.append(bar, body);
    function pick() {
      var c = state.customization, which = c.embedImage || "avatar";
      if (which === "none") return "";
      var u = which === "banner" ? (state.bannerUrl || state.avatarUrl) : state.avatarUrl;
      if (!u && account && account.discord) u = account.discord.avatarUrl || "";
      return /^https:\/\//i.test(u || "") ? u : "/sentinel.png";
    }
    embedRefresh = function () {
      var c = state.customization, name = state.displayName || state.username || "name";
      bar.style.background = /^#[0-9a-f]{6}$/i.test(c.embedColor || "") ? c.embedColor : "#5865f2";
      ttl.textContent = c.embedTitle || (name + " (@" + (state.username || "name") + ")");
      dsc.textContent = c.embedDescription || state.bio || (name + " on Sentinel");
      var u = pick(), large = !!c.embedLarge || c.embedImage === "banner";
      img.hidden = !u; if (u) img.src = u;
      prev.classList.toggle("large", large);
    };
    embedRefresh();
    var link = E("p", "pe-hint", "Link: " + location.origin + "/u/" + (state.username || "name"));
    return [
      sec("Link preview", "What your link looks like when someone pastes it in Discord, X, Slack or Telegram. The picture shown by Discord is cached for a while, so changes can take some time to appear.", prev, link),
      sec("Customize", null, tText("Title", "customization.embedTitle", { max: 80, ph: "Leave empty for your name and @username" }), tArea("Description", "customization.embedDescription", { max: 200, ph: "Leave empty to use your bio" }),
        tColor("Side color", "customization.embedColor", "#5865f2"), tSeg("Picture", "customization.embedImage", [["avatar", "Avatar"], ["banner", "Banner"], ["none", "None"]]), tToggle("Large picture", "customization.embedLarge", "Show the picture big under the text (always on with Banner)."))
    ];
  }

  /* ---------------- panels ---------------- */
  var TABS = [
    ["templates", "Templates", templatesPanel],
    ["profile", "Profile", function () {
      return [
        sec("Identity", "Your public address is /u/username.", tText("Username", "username", { max: 16, lower: true, ph: "yourname", readonly: serverProfile && serverProfile.canRename === false, hint: serverProfile && serverProfile.canRename === false ? "You already used your one username change." : serverProfile ? "1–16 letters, numbers, hyphens or underscores. You can change it only once." : "1–16 letters, numbers, hyphens or underscores. After you publish, you can change it only once." }), tText("Display name", "displayName", { max: 40 }),
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
          tSeg("Button style", "customization.linkStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"], ["minimal", "Minimal"]]), tRange("Corner radius", "customization.linkRadius", 0, 30, 1, "px"), tSeg("Size", "customization.linkSize", [["small", "Small"], ["medium", "Medium"], ["large", "Large"]]), tSeg("Columns", "customization.linkColumns", [["1", "1"], ["2", "2"]]), tSeg("Icon shape", "customization.linkIconShape", [["square", "Square"], ["circle", "Circle"], ["none", "None"]]), tSeg("Hover", "customization.linkHover", [["lift", "Lift"], ["glow", "Glow"], ["fill", "Fill"], ["none", "None"]]), tSeg("Icon background", "customization.iconBg", [["soft", "Soft"], ["brand", "Brand"], ["none", "None"]])),
        widgetsSection(), sec("Widget layout", null, tToggle("Widgets above links", "customization.widgetsFirst"), tSeg("Columns", "customization.widgetColumns", [["1", "1"], ["2", "2"], ["3", "3"]]), tSeg("Style", "customization.widgetStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"]]), tRange("Spacing", "customization.widgetGap", 6, 28, 1, "px"))];
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
          tSeg("Badge style", "customization.badgeStyle", [["pill", "Pill"], ["square", "Square"], ["minimal", "Minimal"], ["icons", "Icons"]]),
          tSeg("Header", "customization.headerStyle", [["stacked", "Stacked"], ["inline", "Side by side"]]), tSeg("Status dot", "customization.statusDot", [["none", "None"], ["online", "Online"], ["idle", "Idle"], ["dnd", "Busy"], ["offline", "Offline"]])),
        sec("Name", null, tSelect("Font", "customization.nameFont", [["inherit", "Same as page"], ["serif", "Serif"], ["mono", "Monospace"], ["display", "Display"], ["rounded", "Rounded"]]), tRange("Weight", "customization.nameWeight", 400, 900, 100), tSeg("Case", "customization.nameTransform", [["none", "Normal"], ["uppercase", "UPPER"], ["lowercase", "lower"], ["capitalize", "Title"]])),
        sec("Polish", "Extra finishing touches for the card and background.", tSelect("Card pattern", "customization.cardPattern", [["none", "None"], ["grid", "Grid"], ["dots", "Dots"], ["scanlines", "Scanlines"], ["noise", "Noise"]]), tToggle("Animated border", "customization.animatedBorder", "A slowly rotating accent outline."), tToggle("Film grain", "customization.bgGrain"), tRange("Vignette", "customization.bgVignette", 0, 100, 1, "%"), tToggle("Background parallax", "customization.bgParallax", "Background shifts slightly with the mouse."), tToggle("Respect “reduce motion” setting", "customization.respectReducedMotion", "Off by default so effects always show. Turn on to disable particles, trail and tilt for visitors who enabled Reduce Motion on their device."), tToggle("Staggered entrance", "customization.staggerIn", "Elements appear one after another."),
          tSeg("Card position", "customization.cardHAlign", [["left", "Left"], ["center", "Center"], ["right", "Right"]]), tSeg("Padding", "customization.cardPadding", [["compact", "Compact"], ["normal", "Normal"], ["spacious", "Spacious"]]),
          tColor("Avatar border color", "customization.avatarBorderColor", "#8b7cff"), tRange("Avatar border width", "customization.avatarBorderWidth", 0, 10, 1, "px"))];
    }],
    ["effects", "Effects", function () {
      return [
        sec("Enter screen", "A full-screen “click to enter” overlay. It also lets your music start automatically.", tToggle("Enable enter screen", "customization.splashEnabled"), tText("Text", "customization.splashText", { max: 40, ph: "click to enter" })),
        sec("Name & avatar", null, tSelect("Name effect", "customization.nameEffect", [["none", "None"], ["glow", "Glow"], ["gradient", "Gradient"], ["shimmer", "Shimmer"], ["neon", "Neon"], ["glitch", "Glitch"]]), tColor("Second name color", "customization.nameColor2", "#ffffff"),
          tSelect("Avatar effect", "customization.avatarEffect", [["none", "None"], ["glow", "Glow"], ["pulse", "Pulse"], ["spin", "Spinning ring"]])),
        sec("Card glow", null, tRange("Glow strength", "customization.glowStrength", 0, 80, 1), tColor("Glow color", "customization.glowColor", "#8b7cff")),
        sec("Particles", "Animated background. Turned off automatically for visitors who reduce motion.", tSelect("Type", "customization.particles", [["none", "None"], ["snow", "Snow"], ["stars", "Stars"], ["embers", "Embers"], ["rain", "Rain"], ["fireflies", "Fireflies"], ["bubbles", "Bubbles"], ["leaves", "Autumn leaves"], ["petals", "Petals"]]),
          tRange("Amount", "customization.particleDensity", 10, 100, 1, "%"), tColor("Color", "customization.particleColor", "#ffffff")),
        sec("Cursor & interaction", "Works with a mouse and with your finger on phones (the dot, ring and trail follow your touch).", tSeg("Cursor", "customization.cursorStyle", [["default", "Default"], ["dot", "Dot"], ["ring", "Ring"], ["crosshair", "Cross"]]), tColor("Cursor color", "customization.cursorColor", "#ffffff"),
          tSeg("Mouse trail", "customization.cursorTrail", [["none", "None"], ["dots", "Dots"], ["sparkles", "Sparkles"]]), tToggle("3D tilt on hover", "customization.tilt")),
        sec("Motion", null, tSeg("Entrance", "customization.animation", [["none", "None"], ["fade", "Fade"], ["rise", "Rise"], ["zoom", "Zoom"], ["blur", "Blur"]]), tSeg("Card hover", "customization.hoverEffect", [["none", "None"], ["lift", "Lift"], ["glow", "Glow"], ["scale", "Scale"]]))
      ];
    }],
    ["badges", "Badges", badgesPanel],
    ["audio", "Audio", function () {
      return [tracksSection(),
        sec("Player", null, tSeg("Player style", "customization.playerStyle", [["card", "In card"], ["bar", "Floating bar"], ["minimal", "Mini button"], ["hidden", "Hidden"]]), tRange("Volume", "customization.audioVolume", 0, 100, 1, "%"),
          tToggle("Loop playlist", "customization.audioLoop"), tToggle("Start automatically", "customization.audioAutoplay", "Browsers only allow sound after a click, so pair this with the enter screen.")),
        sec("Lyrics display", "Lyrics are added per track above. Synced lyrics follow the music line by line.", tToggle("Show lyrics", "customization.showLyrics"),
          tSeg("Position", "customization.lyricsPlace", [["below", "Under player"], ["bottom", "Screen bottom"], ["center", "Screen center"]]), tSeg("Style", "customization.lyricsStyle", [["lines", "Current line"], ["scroll", "Full scroll"]]),
          tSelect("Font", "customization.lyricsFont", [["inherit", "Same as page"], ["system", "System"], ["inter", "Inter"], ["mono", "Monospace"], ["serif", "Serif"], ["bricolage", "Bricolage"], ["instrument", "Instrument"]]),
          tRange("Size", "customization.lyricsSize", 12, 48, 1, "px"), tColor("Color", "customization.lyricsColor", "#ffffff"), tSeg("Alignment", "customization.lyricsAlign", [["left", "Left"], ["center", "Center"], ["right", "Right"]]), tToggle("Glow on current line", "customization.lyricsGlow")),
        sec("Streaming embed", "Optional YouTube or Spotify player under your links.", tText("YouTube / Spotify URL", "musicUrl", { url: true, max: 500, ph: "https://open.spotify.com/track/…" }))];
    }],
    ["embed", "Share", embedPanel],
    ["tools", "Tools", function () { return [toolsSection()]; }],
    ["visibility", "Visibility", function () {
      var T = function (l, k) { return tToggle(l, "customization." + k); };
      return [sec("Show on your page", null, T("Avatar", "showAvatar"), T("Username (@handle)", "showHandle"), T("Banner", "showBanner"), T("Badges", "showBadges"), T("Bio", "showBio"), T("Status", "showStatus"), T("Location", "showLocation"), T("Join date", "showJoined"), T("Links", "showLinks"), T("Widgets", "showWidgets"), T("Music", "showMusic")),
        sec("Steam", steamLinked ? "Shows your Steam profile and playtime. Needs “Game details” set to Public in your Steam privacy settings." : "Link your Steam account on the account page first.", T("Show Steam card", "showSteam"), tSeg("Games shown", "customization.steamGames", [["top", "Most played"], ["recent", "Recent"], ["none", "None"]])),
        sec("Footer & browser tab", null, T("Share button", "showShare"), T("Footer", "showFooter"), T("View counter", "showViews"), T("“Made with Sentinel”", "showBranding"), tText("Footer text", "customization.footerText", { max: 100 }), tText("Browser tab title", "customization.pageTitle", { max: 60, ph: "Zodiak (@zodiak)" }))];
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
    if (!(state.username === (serverProfile && serverProfile.username) ? /^[a-z0-9][a-z0-9_-]{0,23}$/ : /^[a-z0-9][a-z0-9_-]{0,15}$/).test(state.username)) { say("Username: 1–16 lowercase letters, numbers, - or _.", "error"); showTab("profile"); return; }
    saving = true; $("save-profile").disabled = true; $("save-profile").textContent = "Saving…"; say("Saving…", "dirty");
    var payload = clone(state); payload.mediaAssets = usedMediaIds(); payload.links = state.links.filter(function (l) { return l.label && l.url; }); payload.widgets = state.widgets.filter(function (w) { return w.title || w.content || w.url; });
    try {
      var r = await api("/profiles/save", payload);
      var hadRename = serverProfile ? serverProfile.canRename : true; serverProfile = Object.assign({}, r.profile, { nameChanges: r.nameChanges, canRename: r.canRename }); if (hadRename !== r.canRename) { buildPanels(); } if (r.allBadges) badgeData.all = r.allBadges; if (r.catalog) badgeData.catalog = r.catalog; var link = $("open-profile"); link.href = "/u/" + r.profile.username; link.hidden = false;
      state.username = r.profile.username; saved = serialize(); savedState = clone(state);
      say("Saved · " + location.host + "/u/" + r.profile.username, "ok");
    } catch (e) {
      say(e.code === "username_change_limit" ? "You already changed your username once." : e.code === "username_taken" ? "That username is already taken." : e.code === "unauthenticated" ? "Session expired. Sign in again." : (e.message || "Could not save."), "error");
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
      var data = await api("/profiles/me"); steamInfo = data.profile && data.profile.steam ? data.profile.steam : null; steamLinked = !!data.steamLinked; serverProfile = data.profile ? Object.assign({}, data.profile, { nameChanges: data.nameChanges, canRename: data.canRename }) : null; badgeData = { all: data.allBadges || [], catalog: data.catalog || [], isOwner: !!data.isOwner };
      try { var m = await api("/profiles/assets"); assets = m.assets || []; counts = m.counts || {}; } catch (_) { }
      state = fromProfile(data.profile, account); if (data.profile) state.hiddenBadges = Array.isArray(data.hiddenBadges) ? data.hiddenBadges.slice() : []; saved = data.profile ? serialize() : ""; savedState = clone(state);
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
