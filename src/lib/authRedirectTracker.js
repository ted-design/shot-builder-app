const REDIRECT_MARKER_KEY = "auth:redirect-started";

export function markAuthRedirectStart(source = "unknown") {
  if (typeof window === "undefined") return null;
  const payload = {
    source,
    ts: Date.now(),
    path: window.location.pathname,
  };
  try {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[AuthRedirect] Failed to store redirect marker", error);
  }
  return payload;
}

export function consumeAuthRedirectMarker() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(REDIRECT_MARKER_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(REDIRECT_MARKER_KEY);
    try {
      return JSON.parse(raw);
    } catch (error) {
      return { raw };
    }
  } catch (error) {
    console.warn("[AuthRedirect] Failed to read redirect marker", error);
    return null;
  }
}
