// Dev-only counter for active Firestore live subscriptions.
//
// Purpose: measure how many `onSnapshot` listeners a given route keeps alive
// at steady state so we can verify pages stay under their subscription budget.
//
// In production builds these helpers are no-ops (import.meta.env.DEV is
// statically false and Vite tree-shakes the body).
//
// Inspect in DevTools:
//   window.__sbSubs()                 // { total, byPath }
//   window.__sbSubs.reset?.()         // clear counts (dev tool, optional)

const active = new Map<string, number>()

declare global {
  interface Window {
    __sbSubs?: {
      (): { total: number; byPath: Record<string, number> }
      reset: () => void
    }
  }
}

function install(): void {
  if (typeof window === "undefined") return
  if (window.__sbSubs) return
  const snapshot = Object.assign(
    () => ({
      total: [...active.values()].reduce((sum, n) => sum + n, 0),
      byPath: Object.fromEntries(active),
    }),
    {
      reset: () => {
        active.clear()
      },
    },
  )
  window.__sbSubs = snapshot as Window["__sbSubs"]
}

export function markSubscriptionMount(path: string): void {
  if (!import.meta.env.DEV) return
  install()
  active.set(path, (active.get(path) ?? 0) + 1)
}

export function markSubscriptionUnmount(path: string): void {
  if (!import.meta.env.DEV) return
  const existing = active.get(path) ?? 0
  if (existing <= 1) active.delete(path)
  else active.set(path, existing - 1)
}

export function getActiveSubscriptionCount(): number {
  return [...active.values()].reduce((sum, n) => sum + n, 0)
}

export function getActiveSubscriptionMap(): Record<string, number> {
  return Object.fromEntries(active)
}
