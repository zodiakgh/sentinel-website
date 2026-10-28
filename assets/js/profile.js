(function() {
  "use strict";
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var host = document.getElementById("profile-root");
  if (!host) return;
  host.className = "sp-root is-page";
  function state(title, text, cta) {
    host.textContent = "";
    var s = document.createElement("div"), b = document.createElement("div"), h = document.createElement("h1"), p = document.createElement("p");
    s.className = "sp-state";
    b.className = "sp-state-box";
    h.textContent = title;
    p.textContent = text;
    b.append(h, p);
    if (cta) {
      var a = document.createElement("a");
      a.href = cta[1];
      a.textContent = cta[0];
      b.appendChild(a);
    }
    s.appendChild(b);
    host.appendChild(s);
  }
  var m = location.pathname.match(/^\/u\/([^/]+)\/?$/i), qs = new URLSearchParams(location.search).get("u"), slug = m ? decodeURIComponent(m[1]) : qs;
  if (!slug || !API) return state("Profile not found", "This profile doesn't exist or is not public.", ["Create your own profile", "/account"]);
  slug = slug.toLowerCase();
  if (!m && qs && /^[a-z0-9][a-z0-9_-]{0,23}$/.test(slug) && history.replaceState) history.replaceState(null, "", "/u/" + encodeURIComponent(slug));
  state("Loading profile…", "One moment.");
  fetch(API + "/profiles/" + encodeURIComponent(slug), { headers: { Accept: "application/json" }, credentials: "omit" }).then(function(r) {
    return r.json().then(function(j) {
      if (!r.ok || !j.profile) throw new Error("nf");
      return j.profile;
    });
  }).then(function(profile) {
    window.SentinelProfile.mount(host, profile, { page: true });
    var top = document.createElement("div"), a = document.createElement("a");
    top.className = "sp-top";
    a.href = "/account";
    a.textContent = "Create your profile";
    top.appendChild(a);
    host.appendChild(top);
  }).catch(function() {
    state("Profile not found", "This profile doesn't exist or is not public.", ["Create your own profile", "/account"]);
  });
})();
