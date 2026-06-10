// Per-tab handoff of the shots list's visible order (sort + filters applied)
// to the editor's [ / ] prev-next keys. sessionStorage by design: each tab
// carries the order its user last clicked through; deep links and new tabs
// have no context and the keys no-op.
const KEY_PREFIX = "sb:shots:nav-order"

function navOrderKey(clientId: string, projectId: string): string {
  return `${KEY_PREFIX}:${clientId}:${projectId}`
}

export function writeShotListNavOrder(
  clientId: string,
  projectId: string,
  shotIds: ReadonlyArray<string>,
): void {
  try {
    sessionStorage.setItem(navOrderKey(clientId, projectId), JSON.stringify(shotIds))
  } catch {
    // Storage unavailable — [ / ] simply stays inert in this tab.
  }
}

export function readShotListNavOrder(
  clientId: string,
  projectId: string,
): ReadonlyArray<string> | null {
  try {
    const raw = sessionStorage.getItem(navOrderKey(clientId, projectId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every((id) => typeof id === "string")) return null
    return parsed
  } catch {
    return null
  }
}
