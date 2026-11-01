(function () {
  "use strict";
  var api = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var buy = document.getElementById("pr-buy"), soon = document.getElementById("pr-soon");
  if (!api || !buy || !soon) return;
  fetch(api + "/premium/status", { credentials: "omit" }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && d.purchasable === true) { buy.hidden = false; soon.hidden = true; }
  }).catch(function () {});
})();
