(function() {
  "use strict";
  var c = window.SENTINEL_CONFIG || {}, client = c.adsenseClient || "";
  if (!/^ca-pub-\d+$/.test(client)) return;
  var slots = document.querySelectorAll(".ad-slot");
  if (!slots.length) return;
  var s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + client;
  document.head.appendChild(s);
  slots.forEach(function(box) {
    if (!c.adsenseSlot) return;
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", c.adsenseSlot);
    ins.setAttribute("data-ad-format", "horizontal");
    ins.setAttribute("data-full-width-responsive", "false");
    box.appendChild(ins);
    box.hidden = false;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
  });
})();
