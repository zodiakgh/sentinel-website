(function() {
  "use strict";
  var S = window.Sentinel, CFG = S && S.config || {};
  var API = (CFG.authApiUrl || "").replace(/\/+$/, "");
  var form = document.getElementById("sform");
  if (!form) return;
  var el = function(id) {
    return document.getElementById(id);
  };
  var EN = {};
  try {
    EN = JSON.parse(el("sf-en").textContent);
  } catch (e) {
  }
  var last = "", busy = false, widgetId = null, token = "", needCaptcha = false;
  function tr(k) {
    return S.lang() === "fr" ? S.t(k, EN[k] || k) : EN[k] || k;
  }
  function msg(k, bad) {
    last = k;
    var m = el("sf-msg");
    if (!k) {
      m.hidden = true;
      return;
    }
    m.hidden = false;
    m.textContent = tr(k);
    m.className = "vmsg" + (bad ? " bad" : " good");
  }
  S.onLang(function() {
    if (last) msg(last, el("sf-msg").classList.contains("bad"));
  });
  var siteKey = CFG.turnstileSiteKey || "";
  if (siteKey) {
    needCaptcha = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function() {
      if (!window.turnstile) return;
      el("sf-captcha").hidden = false;
      widgetId = window.turnstile.render("#sf-captcha", {
        sitekey: siteKey,
        theme: "dark",
        callback: function(t) {
          token = t;
        },
        "expired-callback": function() {
          token = "";
        }
      });
    };
    document.head.appendChild(s);
  }
  form.addEventListener("submit", function(ev) {
    ev.preventDefault();
    if (busy) return;
    var v = {
      email: el("sf-email").value.trim(),
      discord: el("sf-discord").value.trim(),
      subject: el("sf-subject").value.trim(),
      message: el("sf-message").value.trim(),
      website: el("sf-web").value,
      turnstile: token
    };
    if (!API) {
      msg("sf.m.unavailable", true);
      return;
    }
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v.email)) {
      msg("sf.m.invalid_email", true);
      el("sf-email").focus();
      return;
    }
    if (v.discord.length < 2) {
      msg("sf.m.invalid_discord", true);
      el("sf-discord").focus();
      return;
    }
    if (v.subject.length < 3) {
      msg("sf.m.invalid_subject", true);
      el("sf-subject").focus();
      return;
    }
    if (v.message.length < 20 || v.message.length > 4e3) {
      msg("sf.m.invalid_message", true);
      el("sf-message").focus();
      return;
    }
    if (needCaptcha && !token) {
      msg("sf.m.captcha_failed", true);
      return;
    }
    busy = true;
    el("sf-go").disabled = true;
    msg("sf.m.sending", false);
    var ctl = new AbortController(), to = setTimeout(function() {
      ctl.abort();
    }, 15e3);
    fetch(API + "/support/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(v),
      signal: ctl.signal
    }).then(function(r) {
      return r.json().catch(function() {
        return {};
      }).then(function(j) {
        return { ok: r.ok, j };
      });
    }).then(function(x) {
      clearTimeout(to);
      busy = false;
      el("sf-go").disabled = false;
      if (x.ok && x.j.ok) {
        form.reset();
        token = "";
        msg("sf.m.ok", false);
      } else {
        var e = x.j.error, known = ["invalid_email", "invalid_discord", "invalid_subject", "invalid_message", "slow_down", "captcha_failed"];
        msg(known.indexOf(e) >= 0 ? "sf.m." + e : e === "not_configured" ? "sf.m.unavailable" : "sf.m.failed", true);
      }
      if (window.turnstile && widgetId !== null) {
        try {
          window.turnstile.reset(widgetId);
        } catch (err) {
        }
        token = "";
      }
    }).catch(function() {
      clearTimeout(to);
      busy = false;
      el("sf-go").disabled = false;
      msg("sf.m.failed", true);
    });
  });
})();
