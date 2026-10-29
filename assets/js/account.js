(function() {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var $ = function(id) {
    return document.getElementById(id);
  };
  var loginForm = $("login-form"), registerForm = $("register-form"), verifyForm = $("verify-form"), authArea = $("auth-area"), settings = $("settings-area"), message = $("message"), settingsMessage = $("account-message"), currentEmail = "";
  function say(el, text, error) {
    el.textContent = text || "";
    el.classList.toggle("error", !!error);
  }
  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }
  async function api(path, body) {
    var r = await fetch(API + path, { method: body ? "POST" : "GET", credentials: "include", headers: body ? { "Content-Type": "application/json", "Accept": "application/json" } : { "Accept": "application/json" }, body: body ? JSON.stringify(body) : void 0 });
    var j = {};
    try {
      j = await r.json();
    } catch (_) {
    }
    if (!r.ok) {
      var e = new Error(j.message || j.error || "Request failed");
      e.code = j.error || "error";
      throw e;
    }
    return j;
  }
  function busy(form, on) {
    var b = form.querySelector('button[type="submit"]');
    if (b) {
      b.disabled = on;
      b.dataset.old = b.dataset.old || b.textContent;
      b.textContent = on ? "Please wait…" : b.dataset.old;
    }
  }
  function showMode(mode) {
    [loginForm, registerForm, verifyForm].forEach(function(f) {
      f.classList.add("account-hide");
    });
    if (mode === "login") loginForm.classList.remove("account-hide");
    if (mode === "register") registerForm.classList.remove("account-hide");
    if (mode === "verify") verifyForm.classList.remove("account-hide");
    $("tab-login").setAttribute("aria-selected", String(mode === "login"));
    $("tab-register").setAttribute("aria-selected", String(mode === "register"));
  }
  $("tab-login").addEventListener("click", function() {
    showMode("login");
    say(message, "");
  });
  $("tab-register").addEventListener("click", function() {
    showMode("register");
    say(message, "");
  });
  loginForm.addEventListener("submit", async function(ev) {
    ev.preventDefault();
    say(message, "");
    var d = formData(loginForm);
    busy(loginForm, true);
    try {
      await api("/account/login", { email: d.email, password: d.password });
      location.href = "/account";
    } catch (e) {
      say(message, e.code === "email_not_verified" ? "Please verify your email first." : e.message, true);
    } finally {
      busy(loginForm, false);
    }
  });
  registerForm.addEventListener("submit", async function(ev) {
    ev.preventDefault();
    say(message, "");
    var d = formData(registerForm);
    if (d.password !== d.confirm) {
      say(message, "Passwords do not match.", true);
      return;
    }
    busy(registerForm, true);
    try {
      await api("/account/register", { email: d.email, password: d.password });
      currentEmail = d.email;
      verifyForm.elements.email.value = d.email;
      showMode("verify");
      say(message, "We sent a verification code to your email address.");
    } catch (e) {
      say(message, e.code === "account_exists" ? "An account already exists for this email. Try signing in." : e.message, true);
    } finally {
      busy(registerForm, false);
    }
  });
  verifyForm.addEventListener("submit", async function(ev) {
    ev.preventDefault();
    say(message, "");
    var d = formData(verifyForm);
    busy(verifyForm, true);
    try {
      await api("/account/verify", { email: d.email, code: d.code });
      loginForm.elements.email.value = d.email;
      showMode("login");
      say(message, "Email verified. You can now sign in.");
    } catch (e) {
      say(message, e.message, true);
    } finally {
      busy(verifyForm, false);
    }
  });
  $("password-form").addEventListener("submit", async function(ev) {
    ev.preventDefault();
    say(settingsMessage, "");
    var d = formData(ev.currentTarget);
    busy(ev.currentTarget, true);
    try {
      await api("/account/password", { currentPassword: d.currentPassword, newPassword: d.newPassword });
      ev.currentTarget.reset();
      say(settingsMessage, "Password updated successfully.");
    } catch (e) {
      say(settingsMessage, e.message, true);
    } finally {
      busy(ev.currentTarget, false);
    }
  });
  $("unlink-discord").addEventListener("click", async function() {
    if (!window.confirm("Unlink your Discord account from Sentinel?")) return;
    try {
      await api("/account/discord/unlink", {});
      say(settingsMessage, "Discord has been unlinked.");
      await load();
    } catch (e) {
      say(settingsMessage, e.message, true);
    }
  });
  $("logout").addEventListener("click", async function() {
    try {
      await fetch(API + "/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      location.href = "/account";
    }
  });
  $("google-login").href = API + "/auth/google";
  $("unlink-steam").addEventListener("click", async function() {
    if (!window.confirm("Unlink your Steam account from Sentinel?")) return;
    try {
      await api("/account/steam/unlink", {});
      say(settingsMessage, "Steam has been unlinked.");
      await load();
    } catch (e) {
      say(settingsMessage, e.message, true);
    }
  });
  $("unlink-google").addEventListener("click", async function() {
    if (!window.confirm("Unlink your Google account from Sentinel?")) return;
    try {
      await api("/account/google/unlink", {});
      say(settingsMessage, "Google has been unlinked.");
      await load();
    } catch (e) {
      say(settingsMessage, e.message, true);
    }
  });

  var phoneForm = $("phone-form"), phoneOpen = $("phone-open"), phoneStep = 0, phoneNum = "";
  var phoneOn = false;
  api("/account/phone/status").then(function(s) { phoneOn = !!s.enabled; if (phoneOn) { phoneOpen.hidden = false; phoneOpen.style.display = "flex"; $("phone-section").hidden = false; } }).catch(function() {});
  phoneOpen.addEventListener("click", function() {
    [loginForm, registerForm, verifyForm].forEach(function(f) { f.classList.add("account-hide"); });
    phoneForm.classList.remove("account-hide");
    say(message, "");
  });
  ["tab-login", "tab-register"].forEach(function(id) { $(id).addEventListener("click", function() { phoneForm.classList.add("account-hide"); phoneStep = 0; $("phone-code-label").classList.add("account-hide"); $("phone-submit").textContent = "Send code"; }); });
  function phoneFlow(form, labelId, submitId, mode, area, done) {
    var step = 0;
    form.addEventListener("submit", async function(ev) {
      ev.preventDefault();
      var d = formData(form), btn = $(submitId);
      say(area, "");
      btn.disabled = true;
      try {
        if (step === 0) {
          await api("/account/phone/start", { phone: d.phone, mode: mode });
          step = 1;
          $(labelId).classList.remove("account-hide");
          form.elements.code.required = true;
          form.elements.code.focus();
          btn.textContent = mode === "link" ? "Verify and add" : "Verify and continue";
          say(area, "Code sent. It can take a minute to arrive.");
        } else {
          await api("/account/phone/verify", { phone: d.phone, code: d.code, mode: mode });
          step = 0;
          form.reset();
          $(labelId).classList.add("account-hide");
          form.elements.code.required = false;
          btn.textContent = "Send code";
          await done();
        }
      } catch (e) {
        say(area, e.message, true);
      } finally {
        btn.disabled = false;
      }
    });
    return function reset() { step = 0; $(labelId).classList.add("account-hide"); btn0(); function btn0() { $(submitId).textContent = "Send code"; } form.reset(); };
  }
  phoneFlow(phoneForm, "phone-code-label", "phone-submit", "login", message, function() { location.href = "/account"; });
  var linkForm = $("phone-link-form");
  phoneFlow(linkForm, "phone-link-code-label", "phone-link-submit", "link", settingsMessage, async function() { linkForm.classList.add("account-hide"); say(settingsMessage, "Phone number added."); await load(); });
  $("link-phone").addEventListener("click", function() { linkForm.classList.toggle("account-hide"); });
  $("unlink-phone").addEventListener("click", async function() {
    if (!window.confirm("Remove your phone number from this account?")) return;
    try { await api("/account/phone/unlink", {}); say(settingsMessage, "Phone number removed."); await load(); } catch (e) { say(settingsMessage, e.message, true); }
  });
  async function load() {
    if (!API) {
      say(message, "The account service is not configured yet.", true);
      return;
    }
    try {
      var a = await api("/account/me");
      authArea.classList.add("account-hide");
      settings.classList.remove("account-hide");
      $("account-email").textContent = a.email || (a.phone ? a.phone.masked : "your account");
      $("phone-state").textContent = a.phone ? "Linked: " + a.phone.masked + "." : "No phone number is linked.";
      $("link-phone").textContent = a.phone ? "Change number" : "Add phone";
      $("unlink-phone").classList.toggle("account-hide", !a.phone || a.canUnlinkPhone === false);
      $("verified-state").textContent = !a.email ? "You signed in with your phone number." : a.verified ? "Your email address is verified." : "Your email address is not verified.";
      if (a.discord) {
        $("discord-state").textContent = "Linked to " + (a.discord.name || a.discord.username) + " (" + a.discord.username + ").";
        $("link-discord").textContent = "Discord linked";
        $("unlink-discord").classList.remove("account-hide");
      } else {
        $("discord-state").textContent = "No Discord account is linked.";
        $("link-discord").textContent = "Link Discord";
        $("unlink-discord").classList.add("account-hide");
      }
      $("link-discord").href = API + "/auth/link";
      if (a.google) {
        $("google-state").textContent = "Linked to " + a.google.email + ".";
        $("link-google").textContent = "Google linked";
        $("unlink-google").classList.remove("account-hide");
      } else {
        $("google-state").textContent = "No Google account is linked.";
        $("link-google").textContent = "Link Google";
        $("unlink-google").classList.add("account-hide");
      }
      $("link-google").href = API + "/auth/google?link=1";
      if (a.steam) {
        $("steam-state").textContent = "Linked to " + (a.steam.name || "Steam ID " + a.steam.id) + ".";
        $("link-steam").textContent = "Steam linked";
        $("unlink-steam").classList.remove("account-hide");
      } else {
        $("steam-state").textContent = "No Steam account is linked.";
        $("link-steam").textContent = "Link Steam";
        $("unlink-steam").classList.add("account-hide");
      }
      $("link-steam").href = API + "/auth/steam";
      $("current-pw-label").classList.toggle("account-hide", a.hasPassword === false);
    } catch (e) {
      if (e.code !== "unauthenticated") {
        say(message, "Could not load account settings: " + e.message, true);
      } else {
        authArea.classList.remove("account-hide");
        settings.classList.add("account-hide");
      }
    }
  }
  var params = new URLSearchParams(location.search), link = params.get("link"), linkNotice = "";
  if (link) {
    var msg = { ok: "Discord account linked successfully.", already_used: "That Discord account is already linked to another Sentinel account.", error: "Discord linking failed. Please try again.", login_required: "Sign in to your Sentinel email account before linking Discord." };
    linkNotice = msg[link] || "";
    history.replaceState(null, "", location.pathname);
  }
  var sp = params.get("steam");
  if (sp) {
    var sm = { linked: "Steam account linked successfully.", already_used: "That Steam account is already linked to another Sentinel account.", cancelled: "Steam linking was cancelled.", error: "Steam linking failed. Please try again.", login_required: "Sign in to your Sentinel account before linking Steam." };
    linkNotice = sm[sp] || (/^error_/.test(sp) ? "Steam linking failed (" + sp.slice(6) + "). Please try again." : "");
    link = sp === "linked" ? "ok" : "err";
    history.replaceState(null, "", location.pathname);
  }
  var gp = params.get("google");
  if (gp) {
    var gm = { ok: "Signed in with Google.", linked: "Google account linked successfully.", already_used: "That Google account is already linked to another Sentinel account.", cancelled: "Google sign-in was cancelled.", error: "Google sign-in failed. Please try again.", login_required: "Sign in to your Sentinel account before linking Google.", misconfigured: "Google sign-in is not configured yet." };
    linkNotice = gm[gp] || "";
    link = gp === "ok" || gp === "linked" ? "ok" : "err";
    history.replaceState(null, "", location.pathname);
  }
  load().then(function() {
    if (linkNotice) {
      if (!settings.classList.contains("account-hide")) say(settingsMessage, linkNotice, link !== "ok");
      else say(message, linkNotice, link !== "login_required" && link !== "ok");
    }
  });
})();
