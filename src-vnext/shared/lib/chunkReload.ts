const RELOAD_GUARD_KEY = "sb:chunk-reload-at"
const RELOAD_LOOP_WINDOW_MS = 60_000

function readLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0
  } catch {
    return 0
  }
}

function writeLastReloadAt(value: number): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(value))
  } catch {
    // Storage unavailable (private mode quota, etc.) — reload anyway; the
    // window guard just won't persist, and the boundary remains the backstop.
  }
}

/**
 * Stale-chunk recovery: after a deploy, an already-open tab requesting a
 * lazy route chunk gets the SPA-rewritten index.html instead of the old
 * hashed file and throws (e.g. "Unexpected token '<'"). One automatic
 * reload picks up the new build. The sessionStorage timestamp guard keeps
 * a genuinely broken deploy from reload-looping — within the window the
 * error propagates to ErrorBoundary, which already renders the
 * chunk-aware "Reload required" fallback and reports to Sentry.
 */
export function handlePreloadError(event: Event): void {
  const now = Date.now()
  if (now - readLastReloadAt() < RELOAD_LOOP_WINDOW_MS) return
  writeLastReloadAt(now)
  event.preventDefault()
  window.location.reload()
}

export function installChunkReloadHandler(): void {
  window.addEventListener("vite:preloadError", handlePreloadError)
}
