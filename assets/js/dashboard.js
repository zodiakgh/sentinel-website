/* Dashboard page: Discord login via the auth Worker (see /auth-worker). Inert unless authApiUrl is set. */
(function () {
  "use strict";
  var S = window.Sentinel, CFG = (S && S.config) || {};
  var t = function (k, f) { return S.t(k, f); };
  var off = document.getElementById("dash-off"), on = document.getElementById("dash-on");
  if (!off || !on) return;
  var API = (CFG.authApiUrl || "").replace(/\/+$/, "");
  var el = function (id) { return document.getElementById(id); };
  var state = { mode: API ? "loading" : "off", me: null, notice: "" };

  function show(id, v) { var n = el(id); if (n) n.hidden = !v; }
  function toggleHeads(isOn) {
    document.querySelectorAll("[data-dash-off]").forEach(function (n) { n.hidden = isOn; });
    document.querySelectorAll("[data-dash-on]").forEach(function (n) { n.hidden = !isOn; });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function render() {
    var isOn = state.mode !== "off";
    off.hidden = isOn; on.hidden = !isOn; toggleHeads(isOn);
    if (!isOn) return;
    show("dash-loading", state.mode === "loading");
    show("dash-error", state.mode === "error");
    show("dash-anon", state.mode === "anon");
    show("dash-user", state.mode === "user");
    var n = el("dash-notice"); n.hidden = !state.notice;
    if (state.notice) el("dash-notice-text").textContent = t(state.notice, state.notice);
    if (state.mode === "anon") el("dash-login").setAttribute("href", API + "/auth/login");
    if (state.mode === "user" && state.me) {
      var u = state.me.user;
      el("dash-name").textContent = u.name;
      el("dash-handle").textContent = "@" + u.username;
      var av = el("dash-avatar"); av.innerHTML = "";
      if (u.avatarUrl) { var i = new Image(); i.alt = ""; i.width = 64; i.height = 64; i.referrerPolicy = "no-referrer";
        i.onerror = function () { av.textContent = (u.name || "?").charAt(0).toUpperCase(); }; i.src = u.avatarUrl; av.appendChild(i); }
      else av.textContent = (u.name || "?").charAt(0).toUpperCase();
      var list = el("dash-guilds"), gs = state.me.guilds || [];
      show("dash-noguilds", gs.length === 0);
      list.innerHTML = gs.map(function (g) {
        var icon = g.iconUrl ? '<img src="' + esc(g.iconUrl) + '" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">' : esc(g.name.charAt(0).toUpperCase());
        var badge = g.botPresent === true ? '<span class="badge perm">' + esc(t("dash.added", "Sentinel added")) + "</span>"
          : g.botPresent === false ? '<span class="badge">' + esc(t("dash.notadded", "Sentinel not added")) + "</span>" : "";
        var own = g.owner ? '<span class="badge">' + esc(t("dash.owner", "Owner")) + "</span>" : "";
        var action = "";
        if (g.botPresent === false) {
          var inv = S.inviteFor(g.id);
          action = inv ? '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(inv) + '">' + esc(t("dash.add", "Add Sentinel ↗")) + "</a>" : "";
        } else if (g.botPresent === true) {
          action = '<a class="btn btn-sm btn-primary" href="/builder?guild=' + encodeURIComponent(g.id) + '">' + esc(t("dash.build", "Server builder")) + "</a>";
        }
        return '<li class="guild"><span class="g-ic" aria-hidden="true">' + icon + '</span><span class="g-main"><strong>' + esc(g.name) + '</strong><span class="meta">' + own + badge + "</span></span>" + action + "</li>";
      }).join("");
    }
  }

  function load() {
    if (!API) { state.mode = "off"; render(); return; }
    state.mode = "loading"; render();
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 10000);
    fetch(API + "/api/me", { credentials: "include", signal: ctl.signal, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (r.status === 401) { state.mode = "anon"; return; }
        if (!r.ok) throw new Error("http " + r.status);
        return r.json().then(function (j) { state.me = j; state.mode = "user"; });
      })
      .catch(function () { state.mode = "error"; })
      .then(function () { clearTimeout(to); render(); });
  }

  var p = new URLSearchParams(window.location.search).get("auth");
  if (p === "cancelled") state.notice = "dash.n.cancelled";
  else if (p === "error") state.notice = "dash.n.error";
  if (p) { try { var q = new URLSearchParams(window.location.search); q.delete("auth"); window.history.replaceState(null, "", window.location.pathname + (q.toString() ? "?" + q : "") + window.location.hash); } catch (e) { /* ignore */ } }

  el("dash-retry").addEventListener("click", load);
  el("dash-logout").addEventListener("click", function () {
    fetch(API + "/auth/logout", { method: "POST", credentials: "include" })
      .catch(function () { /* ignore */ })
      .then(function () { state.me = null; state.mode = "anon"; state.notice = ""; render(); });
  });
  S.onLang(render);
  render(); load();
})();
