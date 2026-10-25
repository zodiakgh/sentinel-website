/* Sentinel "What's new" page. Reads /changelog.json (edit it on GitHub) and shows exactly what it says. */
(function () {
  "use strict";
  var box = document.getElementById("changelog");
  if (!box) return;
  var S = window.Sentinel, t = function (k, f) { return S ? S.t(k, f) : f; };
  var fr = function () { return document.documentElement.lang === "fr"; };
  var empty = document.getElementById("changelog-empty"), retry = document.getElementById("changelog-retry");
  var data = null, failed = false;
  var TYPES = { new: ["cl.new", "New"], improved: ["cl.improved", "Improved"], fixed: ["cl.fixed", "Fixed"] };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function render() {
    while (box.firstChild) box.removeChild(box.firstChild);
    var list = data && Array.isArray(data.entries) ? data.entries.slice(0, 60) : [];
    list.forEach(function (e) {
      var card = el("article", "cl-entry"), head = el("header", "cl-head"), d = new Date(e.date + "T12:00:00");
      head.appendChild(el("time", "cl-date", isNaN(d) ? String(e.date || "") : d.toLocaleDateString(fr() ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })));
      if (e.version) head.appendChild(el("span", "cl-ver", String(e.version)));
      card.appendChild(head);
      var title = (fr() && e.titleFr) || e.title; if (title) card.appendChild(el("h2", "cl-title", title));
      var ul = el("ul", "cl-items");
      (Array.isArray(e.items) ? e.items : []).slice(0, 30).forEach(function (it) {
        var ty = TYPES[it.type] ? it.type : "improved", li = el("li", "cl-item");
        li.appendChild(el("span", "cl-tag " + ty, t(TYPES[ty][0], TYPES[ty][1])));
        li.appendChild(el("span", "cl-text", (fr() && it.textFr) || it.text || ""));
        ul.appendChild(li);
      });
      card.appendChild(ul); box.appendChild(card);
    });
    empty.hidden = !!list.length || failed;
    retry.hidden = !failed;
    if (failed) { empty.hidden = false; empty.textContent = t("status.error", "Could not load."); }
  }
  function load() {
    failed = false;
    fetch("/changelog.json?t=" + Date.now(), { cache: "no-store", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
      .then(function (j) { data = j; }).catch(function () { failed = true; }).then(render);
  }
  retry.addEventListener("click", load);
  if (S) S.onLang(render);
  load();
})();
