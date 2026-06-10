export const RELOAD_GUARD_KEY = "sb:chunk-reload-at"
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

// Stale-chunk recovery: reload once to pick up the new build; within the guard window the error propagates to ErrorBoundary instead (no reload loop on a broken deploy).
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
