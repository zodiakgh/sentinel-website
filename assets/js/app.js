/* Sentinel website — shared behaviour: language, navigation, invite, helpers. */
(function () {
  "use strict";
  var CFG = window.SENTINEL_CONFIG || {};
  var FR = window.SENTINEL_FR || {};
  var KEY = "sentinel.lang";
  var listeners = [];
  var current = "en";

  function safeGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function detect() {
    var p = new URLSearchParams(window.location.search).get("lang");
    if (p === "fr" || p === "en") return p;
    var s = safeGet(KEY);
    return s === "fr" ? "fr" : "en";
  }

  function t(key, fallback) {
    if (current === "fr" && Object.prototype.hasOwnProperty.call(FR, key)) return FR[key];
    return fallback !== undefined ? fallback : key;
  }

  function applyText(lang) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      var k = el.getAttribute("data-i18n");
      var v = lang === "fr" && FR[k] !== undefined ? FR[k] : el.dataset.en;
      if (el.tagName === "TITLE") document.title = v; else el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      if (el.dataset.enHtml === undefined) el.dataset.enHtml = el.innerHTML;
      var k = el.getAttribute("data-i18n-html");
      el.innerHTML = lang === "fr" && FR[k] !== undefined ? FR[k] : el.dataset.enHtml;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var parts = pair.split(":"); var attr = parts[0].trim(); var k = parts[1].trim();
        var store = "en_" + attr.replace(/-/g, "_");
        if (el.dataset[store] === undefined) el.dataset[store] = el.getAttribute(attr) || "";
        var v = lang === "fr" && FR[k] !== undefined ? FR[k] : el.dataset[store];
        el.setAttribute(attr, v);
      });
    });
  }

  function isInternal(href) {
    if (!href) return false;
    if (/^(https?:|mailto:|tel:|javascript:|\/\/)/i.test(href)) return false;
    if (href.charAt(0) === "#") return false;
    return true;
  }

  function localizeLinks(lang) {
    document.querySelectorAll("a[href]").forEach(function (a) {
      if (a.dataset.href === undefined) a.dataset.href = a.getAttribute("href");
      var base = a.dataset.href;
      if (!isInternal(base)) return;
      var hashAt = base.indexOf("#");
      var hash = hashAt >= 0 ? base.slice(hashAt) : "";
      var path = hashAt >= 0 ? base.slice(0, hashAt) : base;
      var qAt = path.indexOf("?");
      var qs = new URLSearchParams(qAt >= 0 ? path.slice(qAt + 1) : "");
      var file = qAt >= 0 ? path.slice(0, qAt) : path;
      if (lang === "fr") qs.set("lang", "fr"); else qs.delete("lang");
      var q = qs.toString();
      a.setAttribute("href", file + (q ? "?" + q : "") + hash);
    });
  }

  function setLang(lang, persist) {
    current = lang === "fr" ? "fr" : "en";
    document.documentElement.lang = current;
    applyText(current);
    localizeLinks(current);
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === current));
    });
    if (persist) safeSet(KEY, current);
    try {
      var u = new URL(window.location.href);
      if (current === "fr") u.searchParams.set("lang", "fr"); else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
    listeners.forEach(function (fn) { try { fn(current); } catch (e) { console.error(e); } });
  }

  /* Navigation */
  function initNav() {
    var toggle = document.getElementById("menu-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;
    function close() { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); toggle.focus(); } });
    document.addEventListener("click", function (e) { if (!e.target.closest(".topbar")) close(); });
    window.matchMedia("(min-width: 821px)").addEventListener("change", close);
  }

  /* Invitation links */
  function inviteUrl() {
    if (CFG.inviteUrl) return CFG.inviteUrl;
    if (CFG.applicationId && /^\d{15,25}$/.test(CFG.applicationId)) {
      return "https://discord.com/oauth2/authorize?client_id=" + CFG.applicationId +
        "&permissions=" + encodeURIComponent(CFG.invitePermissions || "8") +
        "&scope=" + encodeURIComponent("bot applications.commands");
    }
    return "";
  }
  function inviteFor(guildId) {
    var u = inviteUrl(); if (!u) return "";
    try { var x = new URL(u); x.searchParams.set("guild_id", guildId); x.searchParams.set("disable_guild_select", "true"); return x.toString(); }
    catch (e) { return u; }
  }
  function initInvite() {
    var url = inviteUrl();
    document.querySelectorAll("[data-invite]").forEach(function (a) {
      if (url) {
        a.setAttribute("href", url); a.dataset.href = url;
        a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
      } else {
        a.dataset.href = "/docs#invite";
        a.setAttribute("href", "/docs#invite");
      }
    });
    document.querySelectorAll("[data-invite-missing]").forEach(function (n) { n.hidden = !!url; });
    document.querySelectorAll("[data-invite-ready]").forEach(function (n) { n.hidden = !url; });
  }

  /* Support server link: one place to change it (assets/js/config.js -> supportUrl) */
  function initSupport() {
    if (!CFG.supportUrl) return;
    document.querySelectorAll("[data-support]").forEach(function (a) {
      a.setAttribute("href", CFG.supportUrl); a.dataset.href = CFG.supportUrl;
    });
  }

  /* Header gets a background once the page scrolls; blocks fade in once as they enter the viewport */
  function initChrome() {
    var bar = document.getElementById("topbar");
    if (bar) {
      var onScroll = function () { bar.classList.toggle("scrolled", window.scrollY > 8); };
      window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    }
    // Add scroll reveals to common content blocks across every page without changing page behaviour.
    var autoReveal = document.querySelectorAll(
      ".page-head .wrap > *, .layer-grid > li, .cap, .cmd-group, .doc-layout > *, .legal > section, .prose > section, .member, .status-row, .guild, .vsteps li, details.faq, .sform-wrap > *, .cta-band, .login-card, .vcard, .foot-grid > div"
    );
    autoReveal.forEach(function (n) { if (!n.hasAttribute("data-reveal")) n.setAttribute("data-reveal", ""); });
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) { items.forEach(function (n) { n.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (n, i) { n.style.transitionDelay = ((i % 4) * 70) + "ms"; io.observe(n); });
  }

  /* Pages are served without ".html" (/dashboard); tidy the address if someone opens the old form */
  function cleanUrl() {
    try {
      var m = window.location.pathname.match(/^(.*?)(?:\/index)?\.html$/);
      if (m && window.location.pathname !== "/404.html") {
        var p = (m[1] === "" ? "/" : m[1]);
        window.history.replaceState(null, "", p + window.location.search + window.location.hash);
      }
    } catch (e) { /* ignore */ }
  }

  /* Misc */
  function initMisc() {
    document.querySelectorAll("[data-year]").forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var text = b.getAttribute("data-copy");
        var label = b.querySelector("[data-copy-label]") || b;
        var original = label.textContent;
        function done(ok) {
          label.textContent = ok ? t("common.copied", "Copied") : t("common.copy_failed", "Copy failed");
          window.setTimeout(function () { label.textContent = original; }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          try {
            var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
            ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
            var ok = document.execCommand("copy"); document.body.removeChild(ta); done(ok);
          } catch (e) { done(false); }
        }
      });
    });
    // Avatars: fall back to an initial if the remote image cannot load.
    document.querySelectorAll("img[data-fallback]").forEach(function (img) {
      function fb() {
        var s = document.createElement("span"); s.textContent = img.getAttribute("data-fallback");
        s.setAttribute("aria-hidden", "true"); img.replaceWith(s);
      }
      img.addEventListener("error", fb);
      if (img.complete && img.naturalWidth === 0) fb();
    });
    // Sidebar scroll-spy
    var links = Array.prototype.slice.call(document.querySelectorAll(".side a[href^='#'], .side a[data-spy], .toc a[href^='#']"));
    if (links.length && "IntersectionObserver" in window) {
      var map = {};
      links.forEach(function (a) {
        var id = (a.dataset.spy || a.getAttribute("href")).replace(/^.*#/, "");
        var el = document.getElementById(id); if (el) map[id] = a;
      });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (l) { l.classList.remove("on"); });
            var a = map[en.target.id]; if (a) a.classList.add("on");
          }
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    cleanUrl();
    initNav();
    initInvite();
    initSupport();
    initChrome();
    initMisc();
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () { setLang(b.dataset.lang, true); });
    });
    setLang(detect(), false);
  });

  window.Sentinel = {
    config: CFG,
    inviteFor: inviteFor,
    t: t,
    lang: function () { return current; },
    onLang: function (fn) { listeners.push(fn); },
    withLang: function (href) {
      if (current !== "fr") return href;
      var h = href.indexOf("#"), hash = h >= 0 ? href.slice(h) : "", path = h >= 0 ? href.slice(0, h) : href;
      return path + (path.indexOf("?") >= 0 ? "&" : "?") + "lang=fr" + hash;
    }
  };
})();
