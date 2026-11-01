(function () {
  var API = ((window.SENTINEL_CONFIG || {}).authApiUrl || "").replace(/\/+$/, "");
  var $ = function (i) { return document.getElementById(i); };
  var st = new URLSearchParams(location.search).get("status");
  var texts = { confirmed: "You are subscribed. Thank you!", unsubscribed: "You are unsubscribed. You will not get more emails.", invalid: "This link is not valid.", expired: "This link expired. Please subscribe again." };
  if (st && texts[st]) { var n = $("nl-status"); n.textContent = texts[st]; n.hidden = false; }
  var f = $("nl-form"), msg = $("nl-msg");
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("nl-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Enter a valid email address."; return; }
    if (!API) { msg.textContent = "Not available right now."; return; }
    $("nl-btn").disabled = true; msg.textContent = "Sending…";
    fetch(API + "/newsletter/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.message || "Something went wrong."); }); })
      .then(function () { msg.textContent = "Check your inbox and click the link to confirm."; f.reset(); })
      .catch(function (er) { msg.textContent = er.message || "Something went wrong."; })
      .then(function () { $("nl-btn").disabled = false; });
  });
})();
