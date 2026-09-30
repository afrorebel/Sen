/* AEO GrowthLead: counts visits that arrive from AI assistants. No cookies, no personal data. */
(function () {
  try {
    var s = document.currentScript;
    var t = s && s.getAttribute("data-t");
    if (!t) return;
    var q = new URLSearchParams(location.search);
    var body = JSON.stringify({ t: t, r: document.referrer || "", s: q.get("utm_source") || "", p: location.pathname });
    if (!document.referrer && !q.get("utm_source")) return;
    var url = new URL("/api/traffic/collect", s.src).toString();
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    else fetch(url, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
  } catch (e) {}
})();
