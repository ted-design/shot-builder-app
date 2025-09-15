/**
 * Use: append ?auth=on or ?auth=off to toggle newAuthContext locally.
 * Add &noreload=1 to skip automatic reload after setting.
 */
(function bootstrapFlagFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("auth");
    if (q === "on" || q === "off") {
      window.localStorage.setItem("flag.newAuthContext", q === "on" ? "1" : "0");
      if (url.searchParams.get("noreload") !== "1") {
        // Remove params to avoid leaking in shared URLs
        url.searchParams.delete("auth");
        url.searchParams.delete("noreload");
        window.location.replace(url.toString());
      }
    }
  } catch {}
})();

