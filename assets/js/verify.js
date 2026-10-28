(function() {
  "use strict";
  var S = window.Sentinel, CFG = S && S.config || {};
  var API = (CFG.authApiUrl || "").replace(/\/+$/, "");
  var q = new URLSearchParams(window.location.search);
  var guild = q.get("guild") || "";
  var authResult = q.get("auth");
  var el = function(id) {
    return document.getElementById(id);
  };
  var t = function(k, f) {
    return S.t(k, f);
  };
  var info = null, user = null, widgetId = null, captchaToken = "", busy = false;
  var last = { key: "v.m.loading", vars: null };
  var EN = {};
  try {
    EN = JSON.parse(el("v-en").textContent);
  } catch (e) {
  }
  function tr(key) {
    return S.lang() === "fr" ? t(key, EN[key] || key) : EN[key] || key;
  }
  function msg(key, vars) {
    last = { key, vars: vars || null };
    var text = tr(key);
    if (vars) Object.keys(vars).forEach(function(k) {
      text = text.replace("{" + k + "}", vars[k]);
    });
    el("v-msg").textContent = text;
  }
  function show(id, v) {
    var n = el(id);
    if (n) n.hidden = !v;
  }
  function buttons(o) {
    ["login", "go", "open", "retry"].forEach(function(b) {
      show("v-" + b, !!o[b]);
    });
    show("v-captcha", !!o.captcha);
  }
  function step(n) {
    el("vs1").className = n > 1 ? "done" : "on";
    el("vs2").className = n === 2 ? "on" : n > 2 ? "done" : "";
  }
  function setHead() {
    var name = info && info.guildName;
    if (name) el("v-name").textContent = name;
    var ic = el("v-icon");
    if (info && info.iconUrl) {
      ic.innerHTML = "";
      var i = new Image();
      i.alt = "";
      i.width = 56;
      i.height = 56;
      i.referrerPolicy = "no-referrer";
      i.onerror = function() {
        ic.textContent = (name || "S").charAt(0).toUpperCase();
      };
      i.src = info.iconUrl;
      ic.appendChild(i);
    } else ic.textContent = (name || "S").charAt(0).toUpperCase();
    document.title = (name ? name + " — " : "") + t("meta.verify", "Verify — Sentinel");
  }
  function done(already) {
    step(3);
    msg(already ? "v.m.already" : "v.m.done");
    buttons({ open: true });
    el("v-open").setAttribute("href", "https://discord.com/channels/" + guild);
    if (!already) {
      var svg = '<svg class="vcheck" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"></circle><path d="M20 33l9 9 16-18"></path></svg>';
      el("v-card").classList.add("center");
      el("v-body").insertAdjacentHTML("afterbegin", svg);
    }
  }
  function api(path, opt) {
    var ctl = new AbortController(), to = setTimeout(function() {
      ctl.abort();
    }, 12e3);
    opt = opt || {};
    opt.credentials = "include";
    opt.signal = ctl.signal;
    return fetch(API + path, opt).then(function(r) {
      clearTimeout(to);
      return r;
    }, function(e) {
      clearTimeout(to);
      throw e;
    });
  }
  function renderStatus(j) {
    user = j.user;
    var c = j.status;
    if (c === "ok") {
      step(2);
      msg("v.m.ready", { name: user.name });
      buttons({ go: true, captcha: !!(info && info.captcha) });
      setupCaptcha();
    } else if (c === "already") done(true);
    else {
      step(1);
      msg("v.m." + c, { days: j.days || "" });
      buttons({ retry: c !== "not_member" ? true : true });
    }
  }
  function setupCaptcha() {
    if (!info || !info.captcha || widgetId !== null) return;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function() {
      if (!window.turnstile) return;
      widgetId = window.turnstile.render("#v-captcha", {
        sitekey: info.siteKey,
        theme: "dark",
        callback: function(tok) {
          captchaToken = tok;
        },
        "expired-callback": function() {
          captchaToken = "";
        }
      });
    };
    document.head.appendChild(s);
  }
  function load() {
    if (!API) {
      msg("v.m.off");
      buttons({});
      return;
    }
    if (!/^\d{15,25}$/.test(guild)) {
      msg("v.m.invalid");
      buttons({});
      return;
    }
    msg("v.m.loading");
    buttons({});
    api("/verify/info?guild=" + encodeURIComponent(guild), { headers: { Accept: "application/json" } }).then(function(r) {
      if (!r.ok) throw new Error("http");
      return r.json();
    }).then(function(j) {
      info = j;
      setHead();
      if (!j.configured) {
        msg("v.m.notconfigured");
        buttons({});
        return;
      }
      if (authResult === "cancelled") {
        step(1);
        msg("v.m.cancelled");
        buttons({ login: true });
        return;
      }
      if (authResult === "error") {
        step(1);
        msg("v.m.error");
        buttons({ login: true });
        return;
      }
      return api("/verify/status?guild=" + encodeURIComponent(guild), { headers: { Accept: "application/json" } }).then(function(r) {
        if (r.status === 401) {
          step(1);
          msg("v.m.anon");
          buttons({ login: true });
          return;
        }
        if (!r.ok) throw new Error("http");
        return r.json().then(renderStatus);
      });
    }).catch(function() {
      msg("v.m.unreachable");
      buttons({ retry: true });
    });
  }
  function complete() {
    if (busy) return;
    busy = true;
    el("v-go").disabled = true;
    msg("v.m.working");
    api("/verify/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ guild, turnstile: captchaToken })
    }).then(function(r) {
      return r.json().catch(function() {
        return {};
      }).then(function(j) {
        return { ok: r.ok, j };
      });
    }).then(function(x) {
      busy = false;
      el("v-go").disabled = false;
      if (x.ok && x.j.ok) {
        done(!!x.j.already);
        return;
      }
      var e = x.j.error || "generic";
      if (window.turnstile && widgetId !== null) {
        try {
          window.turnstile.reset(widgetId);
        } catch (err) {
        }
        captchaToken = "";
      }
      if (e === "unauthenticated") {
        step(1);
        msg("v.m.unauthenticated");
        buttons({ login: true });
        return;
      }
      var known = ["captcha_failed", "slow_down", "not_member", "account_too_new", "joined_too_recently", "bot_error", "role_failed", "not_configured"];
      if (known.indexOf(e) < 0) e = "generic";
      msg(e === "not_configured" ? "v.m.notconfigured" : "v.m." + e, { days: x.j.days || "" });
      var keepGo = e === "captcha_failed" || e === "slow_down";
      buttons({ go: keepGo, retry: !keepGo, captcha: keepGo && !!(info && info.captcha) });
    }).catch(function() {
      busy = false;
      el("v-go").disabled = false;
      msg("v.m.unreachable");
      buttons({ go: true, captcha: !!(info && info.captcha) });
    });
  }
  var login = el("v-login");
  if (API) login.setAttribute("href", API + "/verify/login?guild=" + encodeURIComponent(guild));
  el("v-go").addEventListener("click", function() {
    if (info && info.captcha && !captchaToken) {
      msg("v.m.captcha_failed");
      return;
    }
    complete();
  });
  el("v-retry").addEventListener("click", load);
  S.onLang(function() {
    msg(last.key, last.vars);
    if (info) setHead();
  });
  if (authResult) {
    try {
      q.delete("auth");
      window.history.replaceState(null, "", window.location.pathname + (q.toString() ? "?" + q : "") + window.location.hash);
    } catch (e) {
    }
  }
  load();
})();
