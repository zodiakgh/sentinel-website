(function () {
  "use strict";
  var tabs = ["features", "commands", "guide"], btns = {}, panels = {};
  tabs.forEach(function (t) { btns[t] = document.getElementById("tabbtn-" + t); panels[t] = document.getElementById("tab-" + t); });
  if (!panels.features) return;
  function show(t, keepHash) {
    tabs.forEach(function (k) { var on = k === t; panels[k].hidden = !on; btns[k].setAttribute("aria-selected", String(on)); btns[k].classList.toggle("on", on); });
    if (!keepHash && history.replaceState) history.replaceState(null, "", location.pathname + location.search + "#" + t);
  }
  function route(scroll) {
    var id = decodeURIComponent((location.hash || "").slice(1)), t = "features";
    if (tabs.indexOf(id) >= 0) t = id;
    else if (id) {
      var el = document.getElementById(id);
      if (el) { var p = el.closest(".doc-panel"); if (p) t = p.id.replace("tab-", ""); }
    }
    show(t, true);
    if (scroll && id && tabs.indexOf(id) < 0) { var e = document.getElementById(id); if (e) setTimeout(function () { e.scrollIntoView(); }, 30); }
  }
  tabs.forEach(function (t) { btns[t].addEventListener("click", function () { show(t); window.scrollTo({ top: 0 }); }); });
  window.addEventListener("hashchange", function () { route(true); });
  route(true);
})();
